 # EDM两阶段队列系统 - 完整伪代码设计

## 📋 文档信息
- **创建时间**: 2025-07-01
- **版本**: v1.0
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

// ============================================================================
// 模板渲染逻辑 (支持追踪功能)
// ============================================================================
function renderTemplate(templateContent, contact, subTaskId = null) {
    if (!templateContent) return ""
    
    // 1. 基础变量替换
    renderedContent = templateContent
        .replace(/\{\{name\}\}/g, contact.name || 'friends')
        .replace(/\{\{email\}\}/g, contact.email || '')
    
    // 2. 如果有subTaskId，添加邮件追踪功能
    if (subTaskId) {
        config = getSystemConfig()
        baseUrl = config.tracking.baseUrl || 'http://localhost:3000'
        
        // 2.1 添加打开追踪像素（在邮件末尾）
        trackingPixelUrl = baseUrl + config.tracking.pixelPath + "/" + subTaskId
        trackingPixel = '<img src="' + trackingPixelUrl + '" width="1" height="1" style="display:none;" alt="" />'
        
        // 2.2 处理链接追踪 - 将所有链接替换为追踪链接
        renderedContent = addClickTracking(renderedContent, subTaskId, baseUrl)
        
        // 2.3 在邮件末尾添加追踪像素
        if (renderedContent.includes('</body>')) {
            renderedContent = renderedContent.replace('</body>', trackingPixel + '</body>')
        } else {
            renderedContent += trackingPixel
        }
    }
    
    return renderedContent
}

function addClickTracking(htmlContent, subTaskId, baseUrl) {
    // 匹配所有的 <a href="..."> 标签
    linkRegex = /<a\s+([^>]*\s+)?href\s*=\s*["']([^"']+)["']([^>]*)>/gi
    
    return htmlContent.replace(linkRegex, function(match, beforeHref, originalUrl, afterHref) {
        // 跳过已经是追踪链接的URL
        if (originalUrl.includes('/api/tracking/click/')) {
            return match
        }
        
        // 跳过邮件地址和锚点链接
        if (originalUrl.startsWith('mailto:') || originalUrl.startsWith('#')) {
            return match
        }
        
        // 构建追踪URL
        config = getSystemConfig()
        trackingUrl = baseUrl + config.tracking.clickPath + "/" + subTaskId + "?url=" + encodeURIComponent(originalUrl)
        
        // 重构链接
        beforeHrefClean = beforeHref || ""
        afterHrefClean = afterHref || ""
        
        return '<a ' + beforeHrefClean + 'href="' + trackingUrl + '"' + afterHrefClean + '>'
    })
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
    // 🔧 使用SystemConfig中的队列间隔设置
    intervalConfig = getSystemConfig('queue_interval_seconds')
    intervalSeconds = intervalConfig ? intervalConfig.value : (service.sending_rate || 60)
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
// 阶段2核心逻辑 (发信服务队列处理)
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
        
        // 2. 🔧 获取系统配置的批次大小
        batchSizeConfig = getSystemConfig('queue_batch_size')
        batchSize = batchSizeConfig ? batchSizeConfig.value : 10
        
        // 3. 批量获取待发送的SubTask (多用户公平轮询)
        subTasks = []
        for (i = 0; i < batchSize; i++) {
            nextSubTask = getNextSubTaskForService(serviceId)
            if (nextSubTask) {
                subTasks.push(nextSubTask)
            } else {
                break  // 没有更多待发送的SubTask
            }
        }
        
        if (subTasks.length === 0) {
            // 没有待发送的SubTask，继续等待下次轮询
            return
        }
        
        // 4. 🔧 为整个批次使用统一的计划时间
        batchScheduledTime = getCurrentTime()
        
        logger.info("🔄 开始处理批次: " + subTasks.length + "个SubTask, 服务: " + service.name + 
                   ", 计划时间: " + batchScheduledTime.toISOString())
        
        // 5. 批量分配发信服务并发送 (🔧 添加发信间隔控制)
        successCount = 0
        failCount = 0
        
        // 🔧 获取发信间隔配置（秒）
        sendingInterval = service.sending_rate > 0 
            ? Math.floor(60 / service.sending_rate)  // 每分钟发送rate封，计算间隔秒数
            : 5  // 默认5秒间隔
        
        for (i = 0; i < subTasks.length; i++) {
            subTask = subTasks[i]
            
            try {
                // 🔧 发信间隔控制：除了第一封邮件，其他都要等待间隔
                if (i > 0) {
                    logger.info("⏰ 发信间隔控制：等待" + sendingInterval + "秒后发送下一封邮件")
                    await sleep(sendingInterval * 1000)  // 等待间隔时间
                }
                
                sendResult = allocateAndSendSubTask(subTask, service, batchScheduledTime)
                
                if (sendResult.success) {
                    successCount++
                    logger.info("✅ SubTask " + subTask.id + " 发送成功 via " + service.name + 
                               " (间隔: " + sendingInterval + "s)")
                } else {
                    failCount++
                    logger.warn("❌ SubTask " + subTask.id + " 发送失败: " + sendResult.error)
                }
            } catch (error) {
                failCount++
                logger.error("❌ SubTask " + subTask.id + " 处理异常: " + error.message)
            }
        }
        
        logger.info("📊 批次处理完成: 成功=" + successCount + ", 失败=" + failCount + 
                   ", 服务=" + service.name)
        
    } catch (error) {
        logger.error("处理发信服务队列失败" + serviceId + ": " + error.message)
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

function checkUserServiceAccess(userId, serviceId) {
    // 检查用户是否有权限使用指定的发信服务
    availableServices = getUserAvailableServices(userId)
    return availableServices.some(function(service) {
        return service.id === serviceId
    })
}

// ============================================================================
// 发信服务可用性检查 (带冻结和额度验证)
// ============================================================================
function getAvailableEmailServices(transaction = null) {
    config = getSystemConfig()
    
    return findEmailServices({
        where: {
            is_enabled: true,        // 🔧 服务已启用
            is_frozen: false,        // 🔧 服务未冻结
            used_quota: LESS_THAN('daily_quota')  // 🔧 服务有余额
        },
        order: [
            // 根据配置选择排序策略
            config.email.serviceRotationStrategy === 'least_used'
                ? ['used_quota', 'ASC']    // 优先使用余额多的
                : ['id', 'ASC']            // 简单轮询
        ],
        attributes: ['id', 'name', 'domain', 'used_quota', 'daily_quota'],
        transaction: transaction
    })
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
// 第三方邮件服务调用 (真实邮件发送)
// ============================================================================
function sendEmail(subTask, service) {
    startTime = getCurrentTime()
    responseData = null
    success = false
    statusCode = null
    errorMessage = null
    
    try {
        // 1. 创建邮件服务实例
        mailService = createMailService({
            api_key: service.api_key,
            api_secret: service.api_secret,
            domain: service.domain,
            name: service.name
        })
        
        // 2. 构建邮件选项
        mailOptions = {
            from: subTask.sender_email,
            to: [subTask.recipient_email],
            subject: subTask.rendered_subject,
            html: subTask.rendered_body,
            text: stripHtmlTags(subTask.rendered_body),  // 纯文本版本
            openTracking: true,      // 启用打开追踪
            clickTracking: true,     // 启用点击追踪
            customArgs: {            // 自定义参数
                subtask_id: subTask.id,
                task_id: subTask.task_id
            },
            requestId: subTask.tracking_id
        }
        
        // 3. 调用第三方邮件服务API
        result = mailService.sendMail(mailOptions)
        
        success = true
        responseData = result
        statusCode = result._metadata?.statusCode || 200
        
        // 4. 记录成功的邮件发送响应
        recordEmailServiceResponse(subTask.id, service, {
            success: true,
            statusCode: statusCode,
            responseData: result,
            requestData: mailOptions,
            duration: getCurrentTime() - startTime,
            requestId: subTask.tracking_id
        })
        
        return { success: true, response: result }
        
    } catch (error) {
        success = false
        errorMessage = error.message
        statusCode = error.responseStatus || 500
        responseData = error.responseData
        
        // 记录失败的邮件发送响应
        recordEmailServiceResponse(subTask.id, service, {
            success: false,
            statusCode: statusCode,
            responseData: responseData,
            requestData: mailOptions || {},
            duration: getCurrentTime() - startTime,
            requestId: subTask.tracking_id,
            errorMessage: errorMessage
        })
        
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
    
    logger.info("✅ SubTask " + subTaskId + " 标记为已发送")
}

function markSubTaskFailed(subTaskId, errorMessage) {
    subTask = findSubTask(subTaskId)
    if (!subTask) return
    
    updateSubTask(subTask, {
        status: 'failed',
        error_message: errorMessage,
        retry_count: subTask.retry_count + 1
    })
    
    // 更新任务统计
    updateTaskStats(subTask.task_id)
    
    logger.error("❌ SubTask " + subTaskId + " 标记为失败: " + errorMessage)
}

// ============================================================================
// 任务统计更新和完成检查
// ============================================================================
function updateTaskStats(taskId) {
    task = findTask(taskId)
    if (!task) return
    
    // 获取SubTask状态统计
    statusStats = getSubTaskStatusStats(taskId)
    
    stats = {
        total_recipients: 0,
        pending: 0,
        allocated: 0,
        sending: 0,
        sent: 0,
        delivered: 0,
        bounced: 0,
        opened: 0,
        clicked: 0,
        failed: 0
    }
    
    pendingCount = 0
    allocatedCount = 0
    
    for each stat in statusStats {
        count = parseInt(stat.count)
        stats[stat.status] = count
        stats.total_recipients += count
        
        if (stat.status === 'pending') {
            pendingCount += count
        } else if (['allocated', 'sending', 'sent', 'delivered'].includes(stat.status)) {
            allocatedCount += count
        }
    }
    
    // 更新任务的统计字段
    updateTask(task, {
        summary_stats: stats,
        total_subtasks: stats.total_recipients,
        pending_subtasks: pendingCount,
        allocated_subtasks: allocatedCount
    })
    
    logger.info("📊 任务" + taskId + "统计更新: " + JSON.stringify(stats))
    
    // 检查任务是否完成
    checkTaskCompletion(taskId, stats)
}

function checkTaskCompletion(taskId, stats = null) {
    if (!stats) {
        // 如果没有传入统计数据，重新获取
        stats = getSubTaskStatusStats(taskId)
    }
    
    pendingCount = stats.pending || 0
    sentCount = stats.sent || 0
    failedCount = stats.failed || 0
    
    newStatus = 'sending'
    if (pendingCount === 0) {
        // 所有SubTask都已完成
        newStatus = sentCount > 0 ? 'completed' : 'failed'
        
        // 从内存队列中移除
        removeTaskQueue(taskId)
        
        logger.info("🎉 任务" + taskId + "已完成，状态: " + newStatus)
    }
    
    updateTask(taskId, {
        status: newStatus,
        completed_at: newStatus === 'completed' ? getCurrentTime() : null
    })
}

// ============================================================================
// 邮件服务响应记录 (用于监控和调试)
// ============================================================================
function recordEmailServiceResponse(subTaskId, service, responseInfo) {
    try {
        createEmailServiceResponse({
            sub_task_id: subTaskId,
            request_id: responseInfo.requestId,
            service_name: service.name,
            domain: service.domain,
            success: responseInfo.success,
            status_code: responseInfo.statusCode,
            duration: responseInfo.duration,
            request_data: responseInfo.requestData,
            response_data: responseInfo.responseData,
            error_message: responseInfo.errorMessage,
            api_call: 'sendMail',
            timestamp: getCurrentTime()
        })
        
        logger.info("📝 记录邮件服务响应: SubTask " + subTaskId + ", 成功: " + responseInfo.success)
    } catch (error) {
        logger.error("❌ 记录邮件服务响应失败: " + error.message)
    }
}
```

// ============================================================================
// 📧 Webhook回调处理机制 (邮件状态反馈) - 重构版
// ============================================================================

/* 
 * 🔧 重构后的Webhook处理机制
 * 
 * EngageLab支持两种webhook格式：
 * 1. message_status: delivered, invalid_email, soft_bounce (状态返回)
 * 2. event: open, click, unsubscribe, report_spam, route (用户回应)
 * 
 * Webhook路由配置:
 * POST /api/webhook/mail - 统一处理EngageLab的两种格式
 */

function handleWebhookRequest(req, res) {
    try {
        webhookData = req.body
        timestamp = getCurrentTime()
        
        logger.info("🔔 收到Webhook请求", {
            event_type: webhookData.event_type,
            source: webhookData.source,
            message_id: webhookData.message_id,
            timestamp: timestamp.toISOString()
        })
        
        // 1. 记录原始webhook日志到WebhookLog表
        webhookLogId = createWebhookLog({
            event_type: webhookData.event_type || 'unknown',
            timestamp: webhookData.event_timestamp || timestamp,
            payload: webhookData,
            source: webhookData.source || 'engagelab',
            message_id: webhookData.message_id,
            email_address: webhookData.to_email,
            provider_event_id: webhookData.provider_event_id,
            status: 'processing',
            raw_webhook: webhookData
        })
        
        // 2. 解析关联信息 (SubTask关联)
        associations = parseWebhookAssociations(webhookData)
        
        // 3. 根据事件类型处理
        result = null
        switch (webhookData.event_type) {
            case 'delivered':
            case 'opened': 
            case 'clicked':
            case 'bounced':
            case 'spam_report':
            case 'unsubscribe':
                result = handleEmailStatusEvent(webhookData, associations)
                break
                
            case 'reply':
            case 'inbound':
                result = handleEmailReply(webhookData, associations)
                break
                
            default:
                logger.info("ℹ️ 未处理的webhook事件类型: " + webhookData.event_type)
                result = { message: "Event type " + webhookData.event_type + " recorded but not processed" }
        }
        
        // 4. 更新webhook日志状态
        updateWebhookLog(webhookLogId, {
            status: 'completed',
            processed_at: getCurrentTime(),
            result: result
        })
        
        // 5. 返回成功响应 (EngageLab要求3秒内返回200)
        res.status(200).json({
            success: true,
            message: 'Webhook processed successfully',
            webhook_id: webhookLogId
        })
        
    } catch (error) {
        logger.error("❌ Webhook处理失败: " + error.message, { webhookData })
        
        // 记录失败的webhook
        createWebhookLog({
            event_type: webhookData.event_type || 'unknown',
            timestamp: webhookData.event_timestamp || timestamp,
            payload: webhookData,
            source: webhookData.source || 'engagelab', 
            message_id: webhookData.message_id,
            email_address: webhookData.to_email,
            status: 'failed',
            error_message: error.message,
            raw_webhook: webhookData
        })
        
        res.status(500).json({
            success: false,
            message: "Webhook处理失败: " + error.message
        })
    }
}

function parseWebhookAssociations(webhookData) {
    result = {
        subTask: null,
        task: null,
        userId: null,
        contact: null
    }
    
    // 1. 通过message_id查找SubTask (关键关联)
    if (webhookData.message_id) {
        // 在email_service_response字段中搜索message_id
        subTasks = findSubTasks({
            where: {
                email_service_response: {
                    [Op.like]: "%message_id%:" + webhookData.message_id + "%"
                }
            }
        })
        
        if (subTasks.length > 0) {
            result.subTask = subTasks[0]
            result.task = findTask(result.subTask.task_id)
            if (result.task) {
                result.userId = result.task.created_by
            }
        }
    }
    
    // 2. 通过custom_args.subtask_id查找 (备用关联)
    if (!result.subTask && webhookData.custom_args && webhookData.custom_args.subtask_id) {
        result.subTask = findSubTask(webhookData.custom_args.subtask_id)
        if (result.subTask) {
            result.task = findTask(result.subTask.task_id)
            if (result.task) {
                result.userId = result.task.created_by
            }
        }
    }
    
    // 3. 查找联系人信息
    if (result.subTask) {
        result.contact = findContact(result.subTask.contact_id)
    }
    
    return result
}

function handleEmailStatusEvent(webhookData, associations) {
    if (!associations.subTask) {
        logger.warn("⚠️ Webhook无法找到关联的SubTask", { 
            message_id: webhookData.message_id,
            event_type: webhookData.event_type 
        })
        return { message: "SubTask not found" }
    }
    
    subTask = associations.subTask
    eventTime = webhookData.event_timestamp ? 
        new Date(webhookData.event_timestamp * 1000) : getCurrentTime()
    
    updateData = {}
    logMessage = ""
    
    switch (webhookData.event_type) {
        case 'delivered':
            updateData = {
                status: 'delivered',
                delivered_at: eventTime,
                tracking_data: mergeJsonb(subTask.tracking_data, {
                    delivered_at: eventTime.toISOString(),
                    email_id: webhookData.email_id || '',
                    webhook_delivered: true
                })
            }
            logMessage = "📬 邮件已送达"
            break
            
        case 'opened':
            updateData = {
                status: 'opened', 
                opened_at: eventTime,
                open_count: (subTask.open_count || 0) + 1,
                tracking_data: mergeJsonb(subTask.tracking_data, {
                    opens: ((subTask.tracking_data?.opens || 0) + 1),
                    last_open_at: eventTime.toISOString(),
                    webhook_opened: true
                })
            }
            logMessage = "👁️ 邮件已打开"
            break
            
        case 'clicked':
            updateData = {
                status: 'clicked',
                clicked_at: eventTime, 
                click_count: (subTask.click_count || 0) + 1,
                tracking_data: mergeJsonb(subTask.tracking_data, {
                    clicks: ((subTask.tracking_data?.clicks || 0) + 1),
                    last_click_at: eventTime.toISOString(),
                    clicked_url: webhookData.url || '',
                    webhook_clicked: true
                })
            }
            logMessage = "🔗 邮件链接已点击"
            break
            
        case 'bounced':
            updateData = {
                status: 'bounced',
                bounced_at: eventTime,
                bounce_reason: webhookData.bounce_reason || '',
                tracking_data: mergeJsonb(subTask.tracking_data, {
                    bounce_type: webhookData.bounce_type || 'unknown',
                    bounce_reason: webhookData.bounce_reason || '',
                    webhook_bounced: true
                })
            }
            logMessage = "⚠️ 邮件退回: " + (webhookData.bounce_reason || '未知原因')
            break
            
        case 'spam_report':
            updateData = {
                status: 'spam',
                tracking_data: mergeJsonb(subTask.tracking_data, {
                    spam_reported: true,
                    spam_reported_at: eventTime.toISOString()
                })
            }
            logMessage = "🚫 邮件被标记为垃圾邮件"
            break
            
        case 'unsubscribe':
            updateData = {
                status: 'unsubscribed',
                tracking_data: mergeJsonb(subTask.tracking_data, {
                    unsubscribed: true,
                    unsubscribed_at: eventTime.toISOString()
                })
            }
            logMessage = "❌ 收件人已退订"
            break
    }
    
    // 更新SubTask状态
    updateSubTask(subTask, updateData)
    
    // 更新任务统计
    updateTaskStats(subTask.task_id)
    
    logger.info(logMessage + " - SubTask: " + subTask.id + ", Event: " + webhookData.event_type)
    
    return { 
        message: "Event processed successfully",
        subtask_id: subTask.id,
        event_type: webhookData.event_type,
        status: updateData.status 
    }
}

// ============================================================================
// 📊 邮件追踪机制 (像素追踪和点击追踪)
// ============================================================================

/*
 * 追踪URL配置:
 * GET /api/tracking/open/:subTaskId - 邮件打开追踪 (1x1透明像素)
 * GET /api/tracking/click/:subTaskId?url=xxx - 邮件点击追踪 (重定向)
 */

function handleTrackingPixel(req, res) {
    try {
        subTaskId = req.params.subTaskId
        userAgent = req.get('User-Agent') || ''
        ip = req.ip || req.connection.remoteAddress
        timestamp = getCurrentTime()
        
        logger.info("📧 邮件打开追踪: SubTask " + subTaskId, {
            subTaskId,
            ip,
            userAgent,
            timestamp: timestamp.toISOString()
        })
        
        // 更新SubTask的打开状态
        updateQuery = {
            opened_at: timestamp,
            open_count: sequelize.literal('COALESCE(open_count, 0) + 1'),
            tracking_data: sequelize.literal(`
                COALESCE(tracking_data, '{}')::jsonb || 
                jsonb_build_object(
                    'opens', COALESCE((tracking_data->>'opens')::int, 0) + 1,
                    'last_open_at', '${timestamp.toISOString()}',
                    'open_ips', COALESCE(tracking_data->'open_ips', '[]'::jsonb) || 
                                jsonb_build_array('${ip}'),
                    'open_user_agents', COALESCE(tracking_data->'open_user_agents', '[]'::jsonb) || 
                                       jsonb_build_array('${userAgent}')
                )
            `)
        }
        
        updatedRows = updateSubTask(subTaskId, updateQuery)
        
        if (updatedRows > 0) {
            logger.info("✅ 邮件打开追踪记录成功: SubTask " + subTaskId)
            
            // 更新任务统计 (检查是否首次打开)
            subTask = findSubTask(subTaskId)
            if (subTask && subTask.status !== 'opened' && subTask.status !== 'clicked') {
                updateTaskStats(subTask.task_id, 'opened')
                logger.info("📊 Task统计已更新: " + subTask.task_id + " +1 opened")
            }
        }
        
        // 返回1x1透明PNG图片
        transparentPixel = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
            'base64'
        )
        
        res.set({
            'Content-Type': 'image/png',
            'Content-Length': transparentPixel.length,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        })
        
        res.send(transparentPixel)
        
    } catch (error) {
        logger.error("❌ 邮件打开追踪失败: " + error.message)
        
        // 即使出错也要返回透明像素，避免影响邮件显示
        transparentPixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
        res.set('Content-Type', 'image/gif')
        res.send(transparentPixel)
    }
}

function handleTrackingClick(req, res) {
    try {
        subTaskId = req.params.subTaskId
        originalUrl = req.query.url  // 原始URL
        userAgent = req.get('User-Agent') || ''
        ip = req.ip || req.connection.remoteAddress
        timestamp = getCurrentTime()
        
        logger.info("🔗 邮件点击追踪: SubTask " + subTaskId, {
            subTaskId,
            url: originalUrl,
            ip,
            userAgent,
            timestamp: timestamp.toISOString()
        })
        
        // 更新SubTask的点击状态
        updateQuery = {
            clicked_at: timestamp,
            click_count: sequelize.literal('COALESCE(click_count, 0) + 1'),
            tracking_data: sequelize.literal(`
                COALESCE(tracking_data, '{}')::jsonb || 
                jsonb_build_object(
                    'clicks', COALESCE((tracking_data->>'clicks')::int, 0) + 1,
                    'last_click_at', '${timestamp.toISOString()}',
                    'clicked_urls', COALESCE(tracking_data->'clicked_urls', '[]'::jsonb) || 
                                   jsonb_build_array('${originalUrl || ''}'),
                    'click_ips', COALESCE(tracking_data->'click_ips', '[]'::jsonb) || 
                                jsonb_build_array('${ip}'),
                    'click_user_agents', COALESCE(tracking_data->'click_user_agents', '[]'::jsonb) || 
                                        jsonb_build_array('${userAgent}')
                )
            `)
        }
        
        updatedRows = updateSubTask(subTaskId, updateQuery)
        
        if (updatedRows > 0) {
            logger.info("✅ 邮件点击追踪记录成功: SubTask " + subTaskId)
            
            // 更新任务统计
            subTask = findSubTask(subTaskId)
            if (subTask) {
                updateTaskStats(subTask.task_id, 'clicked')
                logger.info("📊 Task统计已更新: " + subTask.task_id + " +1 clicked")
            }
        }
        
        // 重定向到原始URL
        if (originalUrl) {
            res.redirect(302, originalUrl)
        } else {
            res.status(400).json({
                success: false,
                message: '缺少重定向URL参数'
            })
        }
        
    } catch (error) {
        logger.error("❌ 邮件点击追踪失败: " + error.message)
        
        // 出错时仍然重定向，避免用户体验受影响
        if (req.query.url) {
            res.redirect(302, req.query.url)
        } else {
            res.status(500).json({
                success: false,
                message: '追踪失败，但会继续重定向'
            })
        }
    }
}

// ============================================================================
// 🔗 追踪URL生成机制 (邮件模板渲染)
// ============================================================================

function renderTemplateWithTracking(template, contact, trackingId) {
    config = getSystemConfig()
    rendered = template
    
    // 1. 替换联系人变量
    rendered = rendered.replace(/\{\{name\}\}/g, contact.name || '')
    rendered = rendered.replace(/\{\{email\}\}/g, contact.email || '')
    
    // 2. 转换图片URL为邮件图片代理URL
    rendered = convertImageUrls(rendered, config)
    
    // 3. 如果提供了trackingId，插入跟踪功能
    if (trackingId) {
        // 3.1 在邮件末尾插入跟踪像素
        trackingPixelUrl = config.tracking.baseUrl + config.tracking.pixelPath + "/" + trackingId
        trackingPixel = '<img src="' + trackingPixelUrl + '" width="1" height="1" style="display:none;" alt="" />'
        
        // 如果是HTML邮件，在</body>前插入跟踪像素
        if (rendered.includes('</body>')) {
            rendered = rendered.replace('</body>', trackingPixel + '</body>')
        } else {
            // 如果不是完整HTML，在末尾添加
            rendered += '<br/>' + trackingPixel
        }
        
        // 3.2 处理邮件中的链接，添加点击跟踪
        rendered = addClickTracking(rendered, trackingId, config)
    }
    
    return rendered
}

function addClickTracking(htmlContent, trackingId, config) {
    // 匹配所有的链接
    linkRegex = /<a\s+([^>]*?)href\s*=\s*["']([^"']*?)["']([^>]*?)>/gi
    
    return htmlContent.replace(linkRegex, function(match, beforeHref, originalUrl, afterHref) {
        // 跳过已经是跟踪链接的URL
        if (originalUrl.includes('/tracking/click/') || 
            originalUrl.includes('mailto:') || 
            originalUrl.includes('tel:')) {
            return match
        }
        
        // 为原始URL生成跟踪链接
        trackingUrl = config.tracking.baseUrl + config.tracking.clickPath + "/" + 
                     trackingId + "?url=" + encodeURIComponent(originalUrl)
        
        // 重构链接
        beforeHrefClean = beforeHref || ""
        afterHrefClean = afterHref || ""
        
        return '<a ' + beforeHrefClean + 'href="' + trackingUrl + '"' + afterHrefClean + '>'
    })
}

```

---

## 🔧 关键设计特点说明

### 1. 🔒 安全机制
- **用户权限隔离**: 所有联系人查询强制添加 `user_id` 过滤
- **任务创建者验证**: 确保只能操作自己的联系人和任务
- **发信服务权限**: 检查用户是否有权限使用指定发信服务

### 2. ⚡ 性能优化
- **批量处理**: SubTask批量创建和批量发送
- **公平轮询**: 多用户多任务之间公平分配发送机会
- **内存队列**: 任务队列状态保存在内存中，减少数据库查询

### 3. 🛡️ 可靠性保证
- **事务处理**: 关键操作使用数据库事务保证一致性
- **错误恢复**: 完整的错误处理和状态回滚机制
- **状态追踪**: 详细的状态变更和统计信息

### 4. 📊 监控支持
- **邮件服务响应记录**: 记录所有第三方API调用结果
- **发送时间追踪**: 区分调度时间(scheduled_at)和实际发送时间(sent_at)
- **统计信息**: 实时更新任务和SubTask的统计数据

### 5. 🔧 发信控制
- **发信间隔**: 根据服务配置控制发送频率，避免被识别为垃圾邮件
- **服务轮询**: 多发信服务之间轮询使用，分散发送压力
- **额度管理**: 实时检查用户额度和服务额度限制

### 6. 📧 邮件追踪
- **打开追踪**: 在邮件中嵌入追踪像素
- **点击追踪**: 将所有链接替换为追踪链接
- **平台兼容**: 支持多种邮件服务平台的消息ID格式

---

## 🎯 时间线说明

### 调度时间 vs 发送时间
- **scheduled_at**: 批次调度时间，同一批次内所有邮件相同
- **sent_at**: 实际发送时间，根据发信间隔递增

### 示例时间线
```
批次1: scheduled_at = 2025-07-01 15:38:25.284
├── SubTask1: sent_at = 2025-07-01 15:38:25.284 (立即发送)
├── SubTask2: sent_at = 2025-07-01 15:38:30.284 (间隔5秒)
├── SubTask3: sent_at = 2025-07-01 15:38:35.284 (间隔5秒)
└── SubTask4: sent_at = 2025-07-01 15:38:40.284 (间隔5秒)
```

---

## 📋 系统配置参数

### 核心配置
```pseudocode
// 队列调度配置
queue: {
    intervalSeconds: 60,        // 发信服务轮询间隔(秒)
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

// 发信服务配置
email: {
    defaultSenderName: 'system',
    maxDailyQuota: 10000,
    serviceRotationStrategy: 'least_used'  // 'least_used' 或 'round_robin'
}
```

---

## 🎉 总结

这个两阶段队列系统实现了：
1. **任务创建的灵活性**: 支持多种收件人选择方式
2. **用户权限的安全性**: 严格的user_id过滤机制
3. **发送的可控性**: 发信间隔和服务轮询
4. **系统的可靠性**: 完整的事务和错误处理
5. **监控的完整性**: 详细的日志和统计信息

系统通过两阶段分离的设计，实现了任务创建和邮件发送的解耦，提高了系统的稳定性和可扩展性。