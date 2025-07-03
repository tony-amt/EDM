# EDM两阶段队列系统 - 完整伪代码设计

## 📋 文档信息
- **创建时间**: 2025-07-01
- **版本**: v1.1 (修正sending_rate理解)
- **作用域**: EDM邮件营销系统
- **目标**: 完整描述两阶段队列系统的工程实现逻辑

## 🎯 系统架构概述

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   用户创建任务   │ -> │   阶段1: 队列生成  │ -> │   阶段2: 调度发送  │
│   (TaskService)  │    │  (TaskService)   │    │ (QueueScheduler) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔧 系统组件

### 核心服务
- **TaskService**: 任务管理和SubTask队列生成
- **QueueScheduler**: 发信服务调度和邮件发送
- **EmailRoutingService**: 发信服务路由
- **QuotaService**: 用户额度管理

### 数据模型
- **Task**: 群发任务主表
- **SubTask**: 子任务表（每个收件人一条记录）
- **Contact**: 联系人表
- **EmailService**: 发信服务表
- **Sender**: 发信人表
- **Template**: 邮件模板表

---

## 🔧 关键概念：发信服务全局原子性间隔控制

### 📋 sending_rate 正确理解
- **sending_rate = 53**: 表示每53秒发送一封邮件
- **sending_rate = 55**: 表示每55秒发送一封邮件
- **目的**: 保护域名不被邮局拉黑，确保发信频率合规

### 🔒 全局原子性机制
1. **每个发信服务全局只有一个发送队列**
2. **发送完一封邮件后，该服务立即进入冻结状态**
3. **冻结期间，任何用户、任何任务都不能使用该服务**
4. **冻结时间 = sending_rate 秒数**
5. **冻结时间到期后自动解冻，继续处理下一封邮件**

---

## 📋 完整系统伪代码

### 🎯 阶段0: 任务创建流程

```pseudocode
// ============================================================================
// 任务创建入口 (API Controller -> TaskService.createTask)
// ============================================================================
function createTask(taskData, userId) {
    transaction = beginTransaction()
    
    try {
        // 1. 安全验证：确保用户身份
        if (!userId) {
            throw Error("用户身份验证失败")
        }
        
        // 2. 验证依赖实体存在性和权限
        validateTaskDependencies(userId, {
            sender_id: taskData.sender_id,
            template_ids: taskData.template_ids
        })
        
        // 3. 获取联系人快照 (🔧 重要：带user_id安全过滤)
        contactSnapshot = getTaskContactsSnapshot(taskData.recipient_rule, userId)
        recipientCount = contactSnapshot.length
        
        if (recipientCount === 0) {
            throw Error("没有找到符合条件的联系人")
        }
        
        // 4. 验证用户发送额度
        quotaCheck = validateUserQuota(userId, recipientCount)
        if (!quotaCheck.success) {
            throw Error("用户邮件发送额度不足: 需要" + recipientCount + ", 可用" + quotaCheck.available)
        }
        
        // 5. 创建任务记录
        task = createTaskRecord({
            name: taskData.name,
            description: taskData.description,
            priority: parseInt(taskData.priority) || 0,
            recipient_rule: taskData.recipient_rule,
            sender_id: taskData.sender_id,
            created_by: userId,
            status: taskData.status || 'draft',          // 默认为草稿状态
            total_subtasks: 0,                           // 初始为0
            pending_subtasks: 0,
            allocated_subtasks: 0,
            contacts: contactSnapshot.map(c => c.id),    // 💾 保存联系人ID快照
            templates: taskData.template_ids,            // 💾 保存模板ID数组
            schedule_time: taskData.schedule_time,       // 用户设置的计划时间
            scheduled_at: taskData.schedule_time,        // 系统调度时间
            summary_stats: {                             // 初始统计
                total_recipients: recipientCount,
                pending: recipientCount,
                allocated: 0,
                sending: 0,
                sent: 0,
                delivered: 0,
                bounced: 0,
                opened: 0,
                clicked: 0,
                failed: 0
            }
        })
        
        commitTransaction(transaction)
        return formatTaskOutput(task)
        
    } catch (error) {
        rollbackTransaction(transaction)
        logger.error("任务创建失败: " + error.message)
        throw error
    }
}

// ============================================================================
// 联系人获取逻辑 (🔧 安全修复：强制user_id过滤)
// ============================================================================
function getTaskContactsSnapshot(recipientRule, userId) {
    // 🔧 安全检查：确保用户ID有效
    if (!userId) {
        throw Error("用户ID无效，安全检查失败")
    }
    
    type = recipientRule.type
    
    switch (type) {
        case 'specific':
            // 指定联系人ID列表
            if (!recipientRule.contact_ids || recipientRule.contact_ids.length === 0) {
                throw Error("specific类型需要提供联系人ID列表")
            }
            
            return findContacts({
                where: {
                    id: IN(recipientRule.contact_ids),
                    user_id: userId  // 🔧 安全修复：强制用户权限过滤
                },
                attributes: ['id', 'email', 'name', 'tags']
            })
            
        case 'tag_based':
            // 基于标签的联系人筛选
            whereClause = { user_id: userId }  // 🔧 安全修复：强制用户权限过滤
            
            if (recipientRule.include_tags && recipientRule.include_tags.length > 0) {
                // JSONB数组包含查询：tags字段包含任意一个指定标签
                whereClause.tags = JSONB_CONTAINS_ANY(recipientRule.include_tags)
            }
            
            if (recipientRule.exclude_tags && recipientRule.exclude_tags.length > 0) {
                // JSONB数组排除查询：tags字段不包含任何排除标签
                if (whereClause.tags) {
                    whereClause = AND(
                        whereClause.tags,
                        NOT(JSONB_CONTAINS_ANY(recipientRule.exclude_tags))
                    )
                } else {
                    whereClause.tags = NOT(JSONB_CONTAINS_ANY(recipientRule.exclude_tags))
                }
            }
            
            return findContacts({
                where: whereClause,
                attributes: ['id', 'email', 'name', 'tags']
            })
            
        case 'all_contacts':
            // 用户的所有联系人
            return findContacts({
                where: { user_id: userId },  // 🔧 安全修复：强制用户权限过滤
                attributes: ['id', 'email', 'name', 'tags']
            })
            
        default:
            throw Error("不支持的收件人规则类型: " + type)
    }
}
```

### 🎯 阶段1: SubTask队列生成流程

```pseudocode
// ============================================================================
// 阶段1触发条件检查 (QueueScheduler.processScheduledTasks)
// ============================================================================
function processScheduledTasks(batchSize = 20) {
    try {
        // 1. 查找符合调度条件的任务
        scheduledTasks = findTasks({
            where: {
                status: 'scheduled',
                scheduled_at: LESS_THAN_OR_EQUAL(getCurrentTime())
            },
            order: [['scheduled_at', 'ASC']],
            limit: batchSize,
            include: [{ model: 'User', attributes: ['id', 'remaining_quota'] }]
        })
        
        processedCount = 0
        failedCount = 0
        
        // 2. 逐个处理scheduled任务
        for each task in scheduledTasks {
            try {
                result = generateTaskQueue(task.id)
                if (result.success) {
                    processedCount++
                    logger.info("✅ 任务" + task.id + "处理成功")
                } else {
                    updateTaskStatus(task.id, 'failed', result.error)
                    failedCount++
                    logger.error("❌ 任务" + task.id + "处理失败: " + result.error)
                }
            } catch (error) {
                updateTaskStatus(task.id, 'failed', error.message)
                failedCount++
                logger.error("❌ 任务" + task.id + "处理异常: " + error.message)
            }
        }
        
        return {
            processed: processedCount,
            failed: failedCount,
            total: scheduledTasks.length
        }
        
    } catch (error) {
        logger.error("处理scheduled任务失败: " + error.message)
        throw error
    }
}

// ============================================================================
// 阶段1核心逻辑 (TaskService.generateSubTasksV3)
// ============================================================================
function generateSubTasksV3(task, existingTransaction) {
    transaction = existingTransaction || beginTransaction()
    
    try {
        logger.info("🔧 阶段1开始：为任务" + task.id + "生成SubTask队列")
        
        // 1. 🔧 安全检查：获取任务创建者user_id
        taskCreatorId = task.created_by || task.user_id
        if (!taskCreatorId) {
            throw Error("无法确定任务创建者，安全检查失败")
        }
        
        // 2. 获取收件人列表 (🔧 重要：带user_id安全过滤)
        contacts = getTaskContacts(task, taskCreatorId, transaction)
        if (!contacts || contacts.length === 0) {
            throw Error("没有找到符合条件的联系人")
        }
        
        // 3. 获取模板列表
        templates = findTemplates({
            where: { id: IN(task.templates || []) },
            attributes: ['id', 'name', 'subject', 'body']
        })
        
        if (!templates || templates.length === 0) {
            throw Error("任务没有关联有效的邮件模板")
        }
        
        // 4. 检查用户额度 (二次检查)
        estimatedCount = contacts.length
        quotaCheck = checkUserQuota(taskCreatorId, estimatedCount)
        if (!quotaCheck.success) {
            throw Error("用户邮件发送额度不足")
        }
        
        // 5. 检查发信服务可用性
        availableServices = getUserAvailableServices(taskCreatorId)
        if (availableServices.length === 0) {
            throw Error("当前没有可用的发信服务")
        }
        
        totalServiceQuota = availableServices.reduce((sum, s) => sum + s.available_quota, 0)
        if (totalServiceQuota === 0) {
            throw Error("当前发信服务额度已用完")
        }
        
        // 6. 预扣减用户额度
        deductResult = deductUserQuota(taskCreatorId, estimatedCount, task.id, "任务队列生成")
        if (!deductResult.success) {
            throw Error("用户额度扣减失败")
        }
        
        // 7. 为每个联系人创建SubTask记录
        subTasksData = []
        for each contact in contacts {
            // 7.1 随机选择模板 (可扩展为权重选择)
            selectedTemplate = selectRandomTemplate(templates)
            
            // 7.2 生成唯一追踪ID
            trackingId = generateUUID()
            
            // 7.3 构建SubTask数据
            subTasksData.push({
                task_id: task.id,
                contact_id: contact.id,
                template_id: selectedTemplate.id,
                recipient_email: contact.email,
                rendered_subject: renderTemplate(selectedTemplate.subject, contact),
                rendered_body: renderTemplate(selectedTemplate.body, contact, trackingId),
                status: 'pending',          // 🎯 关键：等待阶段2调度分配
                priority: task.priority || 0,
                tracking_id: trackingId,
                allocated_quota: 1,
                // 🎯 关键：以下字段由阶段2分配
                service_id: null,           // 阶段2分配发信服务
                sender_email: 'pending',    // 阶段2分配发信邮箱
                scheduled_at: null,         // 阶段2设置调度时间
            })
        }
        
        // 8. 批量创建SubTask记录
        createdSubTasks = bulkCreateSubTasks(subTasksData, transaction)
        
        // 9. 更新任务统计
        updateTask(task, {
            status: 'queued',                           // 状态变更为排队等待阶段2
            total_subtasks: createdSubTasks.length,
            pending_subtasks: createdSubTasks.length,   // 全部为pending状态
            allocated_subtasks: 0,                      // 还未分配
            summary_stats: {
                ...task.summary_stats,
                total_recipients: createdSubTasks.length,
                pending: createdSubTasks.length,
                allocated: 0,
                sending: 0,
                sent: 0,
                delivered: 0,
                opened: 0,
                clicked: 0,
                bounced: 0,
                failed: 0
            }
        }, transaction)
        
        if (!existingTransaction) {
            commitTransaction(transaction)
        }
        
        logger.info("✅ 阶段1完成：任务" + task.id + "创建了" + createdSubTasks.length + "个SubTask")
        return createdSubTasks
        
    } catch (error) {
        if (!existingTransaction && transaction && !transaction.finished) {
            rollbackTransaction(transaction)
        }
        logger.error("❌ 阶段1失败：任务" + task.id + "SubTask创建失败: " + error.message)
        throw error
    }
}
```

### 🎯 阶段2: 发信服务分配和调度流程

```pseudocode
// ============================================================================
// 阶段2触发入口 (QueueScheduler调度机制)
// ============================================================================
function startQueueScheduler() {
    if (isRunning) {
        logger.info("队列调度器已在运行中")
        return
    }
    
    isRunning = true
    logger.info("🚀 启动队列调度器")
    
    try {
        // 1. 加载现有的pending任务队列
        loadExistingQueues()
        
        // 2. 启动发信服务轮询定时器
        startServicePolling()
        
        // 3. 启动scheduled任务检查定时器
        startScheduledTaskTimer()
        
        logger.info("✅ 队列调度器启动完成")
    } catch (error) {
        logger.error("队列调度器启动失败: " + error.message)
        isRunning = false
    }
}

function startServicePolling() {
    // 获取所有启用的发信服务
    services = findEmailServices({
        where: {
            is_enabled: true,
            is_frozen: false
        },
        attributes: ['id', 'name', 'sending_rate', 'daily_quota', 'used_quota']
    })
    
    // 为每个服务启动独立的轮询定时器
    for each service in services {
        if (service.used_quota < service.daily_quota) {
            startServiceTimer(service)
        }
    }
    
    logger.info("✅ 启动了" + services.length + "个发信服务的轮询定时器")
}

function startServiceTimer(service) {
    // 🔧 修正：sending_rate直接表示每多少秒发送一封邮件
    intervalSeconds = service.sending_rate || 60  // 使用sending_rate或默认60秒
    intervalMs = intervalSeconds * 1000
    
    // 创建定时器，定期处理该服务的队列
    timer = setInterval(async function() {
        if (!isRunning) {
            clearInterval(timer)
            return
        }
        
        try {
            // 🔧 检查服务是否被冻结或达到额度限制
            currentService = findEmailService(service.id)
            if (!currentService || !currentService.is_enabled) {
                logger.warn("⏸️ 发信服务" + service.name + "已禁用，暂停处理")
                return
            }
            
            if (currentService.is_frozen) {
                logger.warn("❄️ 发信服务" + service.name + "已冻结，排队等待解冻")
                return
            }
            
            if (currentService.used_quota >= currentService.daily_quota) {
                logger.warn("📊 发信服务" + service.name + "额度已满，排队等待重置")
                return
            }
            
            // 处理该服务的发送队列
            processServiceQueue(service.id)
            
        } catch (error) {
            logger.error("发信服务" + service.id + "轮询处理失败: " + error.message)
        }
    }, intervalMs)
    
    // 保存定时器引用以便管理
    serviceTimers.set(service.id, timer)
    logger.info("✅ 发信服务" + service.name + "定时器启动，间隔: " + intervalSeconds + "秒")
}

// ============================================================================
// 阶段2核心逻辑 (发信服务队列处理 - 全局原子性控制)
// ============================================================================
function processServiceQueue(serviceId) {
    try {
        // 1. 二次检查服务可用性 (实时状态检查)
        service = findEmailService(serviceId)
        if (!service || !service.is_enabled || service.is_frozen ||
            service.used_quota >= service.daily_quota) {
            logger.warn("发信服务" + serviceId + "不可用，暂停轮询")
            pauseServiceTimer(serviceId)
            return
        }
        
        // 2. 🔧 全局原子性控制：每次只处理一个SubTask
        nextSubTask = getNextSubTaskForService(serviceId)
        if (!nextSubTask) {
            // 没有待发送的SubTask，继续等待下次轮询
            return
        }
        
        // 3. 🔧 为SubTask使用统一的计划时间
        batchScheduledTime = getCurrentTime()
        
        logger.info("🔄 开始处理SubTask: " + nextSubTask.id + ", 服务: " + service.name + 
                   ", 计划时间: " + batchScheduledTime.toISOString())
        
        // 4. 🔧 全局原子性控制：处理一个SubTask后立即冻结服务
        try {
            sendResult = allocateAndSendSubTask(nextSubTask, service, batchScheduledTime)
            
            if (sendResult.success) {
                logger.info("✅ SubTask " + nextSubTask.id + " 发送成功 via " + service.name + 
                           " (全局原子性控制)")
                
                // 🔧 关键：发送成功后立即冻结服务
                freezeEmailService(serviceId)
                
            } else {
                logger.warn("❌ SubTask " + nextSubTask.id + " 发送失败: " + sendResult.error)
            }
        } catch (error) {
            logger.error("❌ SubTask " + nextSubTask.id + " 处理异常: " + error.message)
        }
        
    } catch (error) {
        logger.error("处理发信服务队列失败" + serviceId + ": " + error.message)
    }
}

// ============================================================================
// 发信服务全局原子性冻结机制
// ============================================================================
function freezeEmailService(serviceId) {
    try {
        service = findEmailService(serviceId)
        if (!service) {
            logger.warn("⚠️ 发信服务" + serviceId + "不存在，无法冻结")
            return
        }
        
        // 🔧 修正：sending_rate直接表示每多少秒发送一封邮件
        intervalSeconds = service.sending_rate > 0 
            ? service.sending_rate  // 直接使用sending_rate作为冻结时间
            : 60  // 默认60秒间隔
        
        frozenUntil = getCurrentTime() + (intervalSeconds * 1000)  // 毫秒
        
        // 更新服务冻结状态
        updateService(service, {
            is_frozen: true,
            frozen_until: frozenUntil
        })
        
        logger.info("❄️ 发信服务" + service.name + "已冻结，解冻时间: " + frozenUntil.toISOString() +
                   " (间隔: " + intervalSeconds + "秒)")
        
        // 启动解冻定时器
        scheduleServiceUnfreeze(serviceId, intervalSeconds * 1000)
        
    } catch (error) {
        logger.error("❌ 冻结发信服务" + serviceId + "失败: " + error.message)
    }
}

function scheduleServiceUnfreeze(serviceId, delayMs) {
    // 清除可能存在的旧解冻定时器
    if (unfreezeTimers.has(serviceId)) {
        clearTimeout(unfreezeTimers.get(serviceId))
    }
    
    // 设置解冻定时器
    unfreezeTimer = setTimeout(async function() {
        unfreezeEmailService(serviceId)
        unfreezeTimers.delete(serviceId)
    }, delayMs)
    
    unfreezeTimers.set(serviceId, unfreezeTimer)
    logger.info("⏰ 已安排发信服务" + serviceId + "在" + Math.floor(delayMs / 1000) + "秒后解冻")
}

function unfreezeEmailService(serviceId) {
    try {
        service = findEmailService(serviceId)
        if (!service) {
            logger.warn("⚠️ 发信服务" + serviceId + "不存在，无法解冻")
            return
        }
        
        // 检查是否到了解冻时间
        now = getCurrentTime()
        if (service.frozen_until && now < service.frozen_until) {
            logger.warn("⏰ 发信服务" + service.name + "尚未到解冻时间: " + service.frozen_until.toISOString())
            return
        }
        
        // 解冻服务
        updateService(service, {
            is_frozen: false,
            frozen_until: null
        })
        
        logger.info("🔓 发信服务" + service.name + "已解冻，可以继续处理邮件")
        
        // 如果服务已解冻且有余额，重启轮询定时器
        if (service.is_enabled && service.used_quota < service.daily_quota) {
            startServiceTimer(service)
        }
        
    } catch (error) {
        logger.error("❌ 解冻发信服务" + serviceId + "失败: " + error.message)
    }
}

// ============================================================================
// 多用户公平轮询机制 (SubTask获取策略)
// ============================================================================
function getNextSubTaskForService(serviceId) {
    // 1. 获取所有活跃的任务队列，按用户分组
    activeQueues = getActiveTaskQueues().filter(function(queue) {
        return queue.status === 'active' && queue.subTasks.length > queue.currentIndex
    })
    
    if (activeQueues.length === 0) {
        return null
    }
    
    // 2. 按用户分组任务队列
    userQueues = groupQueuesByUser(activeQueues)
    userIds = Object.keys(userQueues)
    
    if (userIds.length === 0) return null
    
    // 3. 轮询用户 (公平分配机制)
    for each userId in userIds {
        userTaskQueues = userQueues[userId]
        
        // 3.1 轮询该用户的任务
        lastTaskIndex = getUserTaskRotation(userId) || 0
        nextTaskIndex = (lastTaskIndex + 1) % userTaskQueues.length
        setUserTaskRotation(userId, nextTaskIndex)
        
        selectedQueue = userTaskQueues[nextTaskIndex]
        
        // 3.2 检查该用户是否有权限使用此发信服务
        hasAccess = checkUserServiceAccess(userId, serviceId)
        if (!hasAccess) {
            continue  // 跳过该用户，检查下一个用户
        }
        
        // 3.3 获取队列中的下一个SubTask
        if (selectedQueue.currentIndex < selectedQueue.subTasks.length) {
            subTaskId = selectedQueue.subTasks[selectedQueue.currentIndex]
            selectedQueue.currentIndex++
            
            subTask = findSubTask(subTaskId, { 
                where: { status: 'pending' }  // 只获取pending状态的SubTask
            })
            
            if (subTask) {
                return subTask
            }
        }
    }
    
    return null
}

// ============================================================================
// 发信服务可用性检查 (带冻结和额度验证)
// ============================================================================
function getAvailableEmailServices(transaction = null) {
    // 🔧 实时冻结状态检查：考虑frozen_until时间
    now = getCurrentTime()
    availableServices = findEmailServices({
        where: {
            is_enabled: true,        // 🔧 服务已启用
            used_quota: LESS_THAN('daily_quota'),  // 🔧 服务有余额
            // 🔧 全局原子性冻结检查：未冻结 OR 冻结时间已过期
            OR: [
                { is_frozen: false },  // 未冻结
                { 
                    is_frozen: true, 
                    frozen_until: LESS_THAN(now)  // 冻结时间已过期
                },
                { frozen_until: null }  // 没有设置冻结时间
            ]
        },
        order: [['id', 'ASC']],            // 简单轮询
        attributes: ['id', 'name', 'domain', 'used_quota', 'daily_quota', 'sending_rate', 'is_frozen', 'frozen_until'],
        transaction: transaction
    })
    
    // 🔧 自动解冻过期的服务
    for each service in availableServices {
        if (service.is_frozen && service.frozen_until && now >= service.frozen_until) {
            try {
                updateService(service, {
                    is_frozen: false,
                    frozen_until: null
                }, transaction)
                logger.info("🔓 自动解冻过期服务: " + service.name)
            } catch (error) {
                logger.error("❌ 自动解冻服务失败" + service.name + ": " + error.message)
            }
        }
    }
    
    return availableServices
}
```

### 🎯 阶段3: 实际邮件发送流程

```pseudocode
// ============================================================================
// SubTask分配和发送 (QueueScheduler.allocateAndSendSubTask)
// ============================================================================
function allocateAndSendSubTask(subTask, service, batchScheduledTime = null) {
    transaction = beginTransaction()
    
    try {
        // 1. 获取任务和发信人信息
        task = findTask(subTask.task_id, {
            include: [{ model: 'Sender', as: 'sender' }],
            transaction: transaction
        })
        
        if (!task || !task.sender) {
            throw Error("任务或发信人不存在")
        }
        
        // 2. 生成发信邮箱地址
        senderEmail = task.sender.name + "@" + service.domain
        
        // 3. 🔧 使用批次统一的计划时间，确保同批次邮件时间一致
        scheduledAt = batchScheduledTime || getCurrentTime()
        
        // 4. 更新SubTask状态 (pending -> allocated)
        updateSubTask(subTask, {
            service_id: service.id,
            sender_email: senderEmail,
            status: 'allocated',
            scheduled_at: scheduledAt
        }, transaction)
        
        // 5. 预扣减服务额度
        updateService(service, {
            used_quota: service.used_quota + 1
        }, transaction)
        
        commitTransaction(transaction)
        
        // 6. 实际发送邮件 (调用第三方邮件服务API)
        sendResult = sendEmail(subTask, service)
        
        // 7. 更新发送结果
        if (sendResult.success) {
            // 传递服务平台信息（目前主要是engagelab，未来支持其他平台）
            servicePlatform = service.name || 'engagelab'
            markSubTaskSent(subTask.id, sendResult.response, servicePlatform)
        } else {
            markSubTaskFailed(subTask.id, sendResult.error)
        }
        
        return sendResult
        
    } catch (error) {
        rollbackTransaction(transaction)
        return { success: false, error: error.message }
    }
}

// ============================================================================
// 发送结果记录和状态更新
// ============================================================================
function markSubTaskSent(subTaskId, sendResult = null, servicePlatform = 'engagelab') {
    subTask = findSubTask(subTaskId)
    if (!subTask) return
    
    updateData = {
        status: 'sent',
        sent_at: getCurrentTime()  // 🔧 关键：实际发送时间，每封邮件不同
    }
    
    // 如果有发送结果，保存到email_service_response字段
    if (sendResult) {
        // 支持多种平台的message_id格式
        messageId = sendResult.message_id ||
            sendResult.messageId ||
            sendResult.id ||
            sendResult.email_id ||
            sendResult.response?.message_id
        
        // 生成平台特定的消息ID格式: platform:message_id
        platformMessageId = messageId ? servicePlatform + ":" + messageId : null
        
        // 更新email_service_response字段
        currentResponse = subTask.email_service_response || {}
        updateData.email_service_response = {
            ...currentResponse,
            platform: servicePlatform,
            message_id: platformMessageId,          // 统一格式: platform:id
            platform_message_id: messageId,        // 原始平台ID
            send_response: sendResult,
            sent_timestamp: getCurrentTime().toISOString(),
            // 兼容旧字段
            engagelab_message_id: servicePlatform === 'engagelab' ? messageId : undefined
        }
        
        if (platformMessageId) {
            logger.info("📧 保存" + servicePlatform + " Message ID: " + platformMessageId + 
                       " for SubTask " + subTaskId)
        } else {
            logger.warn("⚠️ " + servicePlatform + "响应中未找到message_id, SubTask: " + subTaskId)
        }
    }
    
    updateSubTask(subTask, updateData)
    
    // 更新任务统计
    updateTaskStats(subTask.task_id)
    
    // 🔧 关键：发信成功后立即冻结发信服务（全局原子性控制）
    if (subTask.service_id) {
        freezeEmailService(subTask.service_id)
    }
    
    logger.info("✅ SubTask " + subTaskId + " 标记为已发送")
}
```

---

## 🔧 关键设计特点说明

### 1. 🔒 发信服务全局原子性间隔控制

#### 核心机制
- **每个发信服务全局只有一个发送队列**
- **发送完一封邮件后，该服务立即进入冻结状态**
- **冻结期间，任何用户、任何任务都不能使用该服务**
- **冻结时间 = sending_rate 秒数**

#### 实际运行示例
```
发信服务: glodamarket.fun (sending_rate = 53)
├── 15:38:25.284 - 发送邮件1，服务立即冻结53秒
├── 15:39:18.284 - 自动解冻，可处理下一封邮件
├── 15:39:18.500 - 发送邮件2，服务立即冻结53秒
├── 15:40:11.500 - 自动解冻，可处理下一封邮件
└── ...

发信服务: glodamarket.store (sending_rate = 55)
├── 15:38:26.100 - 发送邮件1，服务立即冻结55秒
├── 15:39:21.100 - 自动解冻，可处理下一封邮件
├── 15:39:21.300 - 发送邮件2，服务立即冻结55秒
└── ...
```

### 2. 🔒 安全机制
- **用户权限隔离**: 所有联系人查询强制添加 `user_id` 过滤
- **任务创建者验证**: 确保只能操作自己的联系人和任务
- **发信服务权限**: 检查用户是否有权限使用指定发信服务

### 3. ⚡ 性能优化
- **批量处理**: SubTask批量创建
- **公平轮询**: 多用户多任务之间公平分配发送机会
- **内存队列**: 任务队列状态保存在内存中，减少数据库查询

### 4. 🛡️ 可靠性保证
- **事务处理**: 关键操作使用数据库事务保证一致性
- **错误恢复**: 完整的错误处理和状态回滚机制
- **状态追踪**: 详细的状态变更和统计信息

### 5. 📊 监控支持
- **邮件服务响应记录**: 记录所有第三方API调用结果
- **发送时间追踪**: 区分调度时间(scheduled_at)和实际发送时间(sent_at)
- **统计信息**: 实时更新任务和SubTask的统计数据

---

## 🎯 时间线说明

### 调度时间 vs 发送时间
- **scheduled_at**: 批次调度时间，同一批次内所有邮件相同
- **sent_at**: 实际发送时间，根据发信服务的sending_rate间隔递增

### 🔧 修正后的示例时间线
```
发信服务1 (glodamarket.fun, sending_rate=53秒):
├── SubTask1: sent_at = 2025-07-01 15:38:25.284 (立即发送)
├── [冻结53秒]
├── SubTask2: sent_at = 2025-07-01 15:39:18.284 (53秒后)
├── [冻结53秒]
└── SubTask3: sent_at = 2025-07-01 15:40:11.284 (53秒后)

发信服务2 (glodamarket.store, sending_rate=55秒):
├── SubTask4: sent_at = 2025-07-01 15:38:26.100 (立即发送)
├── [冻结55秒]
├── SubTask5: sent_at = 2025-07-01 15:39:21.100 (55秒后)
├── [冻结55秒]
└── SubTask6: sent_at = 2025-07-01 15:40:16.100 (55秒后)
```

---

## 📋 系统配置参数

### 核心配置
```pseudocode
// 发信服务配置 (数据库配置)
email_services: [
    {
        name: "极光触发glodamarket.fun",
        domain: "glodamarket.fun",
        sending_rate: 53,          // 🔧 修正：每53秒发送一封邮件
        daily_quota: 200,
        is_enabled: true
    },
    {
        name: "极光触发glodamarket.store", 
        domain: "glodamarket.store",
        sending_rate: 55,          // 🔧 修正：每55秒发送一封邮件
        daily_quota: 200,
        is_enabled: true
    }
]

// 队列调度配置
queue: {
    checkInterval: 30,          // scheduled任务检查间隔(秒)
    batchSize: 10,             // 每批次处理的SubTask数量
    maxConcurrentTasks: 5      // 最大并发任务数
}

// 邮件追踪配置
tracking: {
    baseUrl: 'https://tkmail.fun',
    pixelPath: '/api/tracking/open',
    clickPath: '/api/tracking/click',
    imageProxyPath: '/api/tracking/image'
}
```

---

---

## 🔧 补充机制：任务取消和额度恢复

### 任务取消机制
```pseudocode
// ============================================================================
// 任务取消和额度恢复机制
// ============================================================================
function cancelTask(taskId, userId, reason = "用户取消") {
    transaction = beginTransaction()
    
    try {
        // 1. 验证任务所有权
        task = findTask(taskId, {
            where: { created_by: userId },  // 安全检查
            transaction: transaction
        })
        
        if (!task) {
            throw Error("任务不存在或无权限取消")
        }
        
        // 2. 检查任务状态是否可取消
        cancelableStatuses = ['draft', 'scheduled', 'queued', 'sending']
        if (!cancelableStatuses.includes(task.status)) {
            throw Error("任务状态" + task.status + "不可取消")
        }
        
        // 3. 统计需要恢复的额度
        pendingSubTasks = countSubTasks({
            where: { 
                task_id: taskId, 
                status: IN(['pending', 'allocated'])  // 未发送的
            },
            transaction: transaction
        })
        
        // 4. 恢复用户额度
        if (pendingSubTasks > 0) {
            restoreResult = restoreUserQuota(
                userId, 
                pendingSubTasks, 
                taskId, 
                "任务取消恢复"
            )
            
            if (!restoreResult.success) {
                throw Error("用户额度恢复失败")
            }
        }
        
        // 5. 恢复发信服务额度（已分配但未发送的）
        allocatedSubTasks = findSubTasks({
            where: { 
                task_id: taskId, 
                status: 'allocated',
                service_id: NOT_NULL
            },
            transaction: transaction
        })
        
        // 按服务分组恢复额度
        serviceQuotaMap = {}
        for each subTask in allocatedSubTasks {
            if (!serviceQuotaMap[subTask.service_id]) {
                serviceQuotaMap[subTask.service_id] = 0
            }
            serviceQuotaMap[subTask.service_id]++
        }
        
        for each (serviceId, count) in serviceQuotaMap {
            updateService(serviceId, {
                used_quota: SUBTRACT(used_quota, count)
            }, transaction)
        }
        
        // 6. 更新任务状态
        updateTask(task, {
            status: 'cancelled',
            cancelled_at: getCurrentTime(),
            error_message: reason,
            cancelled_subtasks: pendingSubTasks,
            restored_quota: pendingSubTasks
        }, transaction)
        
        // 7. 更新SubTask状态
        updateSubTasks({
            where: { 
                task_id: taskId, 
                status: IN(['pending', 'allocated'])
            },
            data: { 
                status: 'cancelled',
                error_message: reason
            },
            transaction: transaction
        })
        
        // 8. 从内存队列中移除
        removeTaskQueue(taskId)
        
        commitTransaction(transaction)
        
        logger.info("✅ 任务" + taskId + "已取消，恢复额度: " + pendingSubTasks)
        return {
            success: true,
            cancelled_subtasks: pendingSubTasks,
            restored_quota: pendingSubTasks
        }
        
    } catch (error) {
        rollbackTransaction(transaction)
        logger.error("❌ 取消任务失败: " + error.message)
        throw error
    }
}

// 额度恢复服务
function restoreUserQuota(userId, amount, taskId, reason) {
    try {
        user = findUser(userId)
        if (!user) {
            throw Error("用户不存在")
        }
        
        // 更新用户剩余额度
        updateUser(user, {
            remaining_quota: user.remaining_quota + amount
        })
        
        // 记录额度恢复日志
        createQuotaLog({
            user_id: userId,
            task_id: taskId,
            quota_change: amount,
            operation_type: 'restore',
            reason: reason,
            before_quota: user.remaining_quota,
            after_quota: user.remaining_quota + amount,
            timestamp: getCurrentTime()
        })
        
        return { success: true }
        
    } catch (error) {
        return { success: false, error: error.message }
    }
}
```

---

## 🔧 补充机制：Webhook和追踪系统

### Webhook回调机制
```pseudocode
// ============================================================================
// 邮件状态回调处理 (第三方邮件服务 → 我们的系统)
// ============================================================================
function handleEmailWebhook(webhookData, servicePlatform = 'engagelab') {
    try {
        // 1. 验证Webhook签名（防止伪造）
        if (!verifyWebhookSignature(webhookData, servicePlatform)) {
            logger.warn("⚠️ Webhook签名验证失败")
            return { success: false, error: "签名验证失败" }
        }
        
        // 2. 解析Webhook数据
        messageId = webhookData.message_id || webhookData.messageId
        eventType = webhookData.event || webhookData.type  // delivered, bounced, opened, clicked
        timestamp = webhookData.timestamp || getCurrentTime()
        
        // 3. 查找对应的SubTask
        subTask = findSubTask({
            where: {
                [Op.or]: [
                    { "email_service_response.message_id": servicePlatform + ":" + messageId },
                    { "email_service_response.platform_message_id": messageId }
                ]
            }
        })
        
        if (!subTask) {
            logger.warn("⚠️ 未找到对应的SubTask, messageId: " + messageId)
            return { success: false, error: "SubTask不存在" }
        }
        
        // 4. 根据事件类型更新状态
        switch (eventType) {
            case 'delivered':
                updateSubTask(subTask, {
                    status: 'delivered',
                    delivered_at: timestamp
                })
                break
                
            case 'bounced':
            case 'failed':
                updateSubTask(subTask, {
                    status: 'bounced',
                    bounced_at: timestamp,
                    bounce_reason: webhookData.reason || webhookData.description
                })
                break
                
            case 'opened':
                // 可能多次打开，记录最新时间
                updateSubTask(subTask, {
                    opened_at: timestamp,
                    open_count: (subTask.open_count || 0) + 1
                })
                break
                
            case 'clicked':
                // 可能多次点击，记录最新时间
                updateSubTask(subTask, {
                    clicked_at: timestamp,
                    click_count: (subTask.click_count || 0) + 1
                })
                break
        }
        
        // 5. 更新任务统计
        updateTaskStats(subTask.task_id)
        
        // 6. 记录Webhook日志
        createWebhookLog({
            sub_task_id: subTask.id,
            service_platform: servicePlatform,
            event_type: eventType,
            message_id: messageId,
            webhook_data: webhookData,
            processed_at: getCurrentTime()
        })
        
        logger.info("✅ Webhook处理成功: " + eventType + ", SubTask: " + subTask.id)
        return { success: true }
        
    } catch (error) {
        logger.error("❌ Webhook处理失败: " + error.message)
        return { success: false, error: error.message }
    }
}

// Webhook签名验证
function verifyWebhookSignature(webhookData, servicePlatform) {
    switch (servicePlatform) {
        case 'engagelab':
            // 极光Webhook签名验证
            expectedSignature = calculateHMAC(webhookData.body, ENGAGELAB_WEBHOOK_SECRET)
            receivedSignature = webhookData.headers['x-engagelab-signature']
            return expectedSignature === receivedSignature
            
        case 'sendgrid':
            // SendGrid签名验证
            expectedSignature = calculateHMAC(webhookData.body, SENDGRID_WEBHOOK_SECRET)
            receivedSignature = webhookData.headers['x-twilio-email-event-webhook-signature']
            return expectedSignature === receivedSignature
            
        default:
            return true  // 未知平台暂时通过
    }
}
```

### 追踪像素机制
```pseudocode
// ============================================================================
// 邮件打开追踪 (追踪像素处理)
// ============================================================================
function handleTrackingPixel(subTaskId, requestInfo) {
    try {
        // 1. 查找SubTask
        subTask = findSubTask(subTaskId)
        if (!subTask) {
            logger.warn("⚠️ 追踪像素: SubTask不存在 " + subTaskId)
            return generateTransparentPixel()  // 仍返回透明像素
        }
        
        // 2. 记录打开事件
        currentTime = getCurrentTime()
        openCount = (subTask.open_count || 0) + 1
        
        updateSubTask(subTask, {
            opened_at: currentTime,
            open_count: openCount,
            first_opened_at: subTask.first_opened_at || currentTime
        })
        
        // 3. 记录详细追踪信息
        createTrackingEvent({
            sub_task_id: subTaskId,
            event_type: 'open',
            ip_address: requestInfo.ip,
            user_agent: requestInfo.userAgent,
            timestamp: currentTime,
            metadata: {
                referer: requestInfo.referer,
                country: requestInfo.country,  // IP地理位置
                device: parseUserAgent(requestInfo.userAgent),
                open_count: openCount
            }
        })
        
        // 4. 更新任务统计
        updateTaskStats(subTask.task_id)
        
        logger.info("📧 邮件打开追踪: SubTask " + subTaskId + ", 第" + openCount + "次打开")
        
        // 5. 返回1x1透明像素
        return generateTransparentPixel()
        
    } catch (error) {
        logger.error("❌ 追踪像素处理失败: " + error.message)
        return generateTransparentPixel()  // 确保总是返回像素
    }
}

// 链接点击追踪
function handleClickTracking(subTaskId, originalUrl, requestInfo) {
    try {
        // 1. 记录点击事件
        subTask = findSubTask(subTaskId)
        if (subTask) {
            clickCount = (subTask.click_count || 0) + 1
            currentTime = getCurrentTime()
            
            updateSubTask(subTask, {
                clicked_at: currentTime,
                click_count: clickCount,
                first_clicked_at: subTask.first_clicked_at || currentTime
            })
            
            // 记录点击详情
            createTrackingEvent({
                sub_task_id: subTaskId,
                event_type: 'click',
                target_url: originalUrl,
                ip_address: requestInfo.ip,
                user_agent: requestInfo.userAgent,
                timestamp: currentTime,
                metadata: {
                    referer: requestInfo.referer,
                    country: requestInfo.country,
                    device: parseUserAgent(requestInfo.userAgent),
                    click_count: clickCount
                }
            })
            
            // 更新任务统计
            updateTaskStats(subTask.task_id)
            
            logger.info("🔗 链接点击追踪: SubTask " + subTaskId + ", URL: " + originalUrl)
        }
        
        // 2. 重定向到原始链接
        return redirectTo(originalUrl)
        
    } catch (error) {
        logger.error("❌ 点击追踪处理失败: " + error.message)
        return redirectTo(originalUrl)  // 确保总是重定向
    }
}

// 生成透明像素
function generateTransparentPixel() {
    return {
        contentType: 'image/gif',
        body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'),
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        }
    }
}
```

---

## 🎉 总结

这个两阶段队列系统通过**全局原子性间隔控制**机制实现了：

1. **发信服务保护**: 每个服务严格按照sending_rate间隔发送，保护域名不被拉黑
2. **多用户公平**: 多用户多任务之间公平轮询，避免资源垄断
3. **系统可靠性**: 完整的事务处理和错误恢复机制
4. **安全隔离**: 严格的用户权限过滤，确保数据安全
5. **监控完整**: 详细的日志和统计信息，便于运维监控
6. **额度管理**: 双重额度控制和取消恢复机制
7. **追踪体系**: 完整的邮件追踪和Webhook回调处理

**核心创新**：通过发信服务的全局原子性冻结机制，确保了无论有多少用户、多少任务同时运行，每个发信服务都严格按照配置的时间间隔发送邮件，从根本上解决了高并发场景下的域名保护问题。 