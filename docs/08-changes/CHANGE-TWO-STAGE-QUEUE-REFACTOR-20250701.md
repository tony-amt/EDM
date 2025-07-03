# 两阶段队列系统重构设计文档

**变更编号**: CHANGE-TWO-STAGE-QUEUE-REFACTOR-20250701  
**创建时间**: 2025-07-01  
**影响范围**: 任务调度系统、SubTask管理、发信服务分配  

## 🎯 重构目标

实现清晰的两阶段队列模式，分离SubTask创建和调度逻辑，解决当前架构混乱问题。

## 📋 当前问题分析

### 1. 功能重复问题
- `TaskService.generateSubTasksV3()`: 创建SubTask
- `QueueScheduler.createSubTaskQueue()`: 也创建SubTask
- **问题**: 两处都有创建逻辑，职责不清

### 2. 关联错误问题  
- `TaskService.generateSubTasksV3()`: 使用Task-Template关联
- **问题**: 数据库中不存在这种关联关系

### 3. 配置硬编码问题
- 追踪baseUrl在代码中硬编码
- **问题**: 不便于环境配置和维护

### 4. 发信服务分配时机问题
- 当前在创建时就分配发信服务
- **问题**: 批次创建时服务状态可能变化

## 🏗️ 目标架构设计

### 阶段1: 创建SubTask队列 (TaskService职责)
```
Task(scheduled) → TaskService.generateSubTasksV3() → SubTask(pending)
```

**职责**:
- 获取收件人列表
- 选择邮件模板  
- 渲染邮件内容（含追踪）
- 创建SubTask记录，状态=pending
- **不分配**: service_id=null, sender_email=占位符

### 阶段2: 调度SubTask队列 (QueueScheduler职责)
```
QueueScheduler → allocateSubTasks() → SubTask(allocated) → 发送
```

**职责**:
- 获取pending状态的SubTask
- 检查可用发信服务（有余额、非冻结）
- 轮询分配service_id
- 设置正确的sender_email = sender@domain
- 状态改为allocated
- 启动实际发送

## 📊 SubTask表字段映射

基于数据库表结构，关键字段分配：

| 字段 | 阶段1(创建) | 阶段2(调度) | 说明 |
|------|-------------|-------------|------|
| task_id | ✅ 设置 | - | 关联任务 |
| contact_id | ✅ 设置 | - | 关联联系人 |  
| template_id | ✅ 设置 | - | 关联模板 |
| recipient_email | ✅ 设置 | - | 收件人邮箱 |
| rendered_subject | ✅ 设置 | - | 渲染主题 |
| rendered_body | ✅ 设置 | - | 渲染内容 |
| status | ✅ pending | ✅ allocated | 状态流转 |
| service_id | ❌ null | ✅ 设置 | 发信服务分配 |
| sender_email | ❌ 占位符 | ✅ 设置 | 发信邮箱 |
| scheduled_at | ❌ null | ✅ 设置 | 调度时间 |
| tracking_id | ✅ 设置 | - | 追踪ID |

## 🔧 重构计划

### Step 1: 配置统一管理
```javascript
// config/config.js 新增
module.exports = {
  tracking: {
    baseUrl: process.env.TRACKING_BASE_URL || 'https://tkmail.fun',
    pixelPath: '/api/tracking/open',
    clickPath: '/api/tracking/click'
  },
  queue: {
    intervalSeconds: process.env.QUEUE_INTERVAL_SECONDS || 10,
    batchSize: process.env.QUEUE_BATCH_SIZE || 100
  },
  email: {
    defaultSenderName: process.env.DEFAULT_SENDER_NAME || 'support'
  }
};
```

### Step 2: 修复TaskService.generateSubTasksV3()
**目标**: 专门负责阶段1，修复关联问题

```javascript
async generateSubTasksV3(task, existingTransaction = null) {
  // 1. 获取收件人列表 (已修复JSONB查询)
  const contacts = await this.getTaskContacts(task);
  
  // 2. 获取模板 (修复：使用task.templates字段)
  const templates = await Template.findAll({
    where: { id: { [Op.in]: task.templates } }
  });
  
  // 3. 创建SubTask记录
  const subTasks = contacts.map(contact => ({
    task_id: task.id,
    contact_id: contact.id,
    template_id: this.selectTemplate(templates).id,
    recipient_email: contact.email,
    rendered_subject: this.renderTemplate(template.subject, contact),
    rendered_body: this.renderTemplate(template.body, contact), 
    status: 'pending',        // 等待调度
    service_id: null,         // 阶段2分配
    sender_email: 'pending',  // 阶段2分配  
    tracking_id: uuid()
  }));
  
  await SubTask.bulkCreate(subTasks, { transaction });
}
```

### Step 3: 重构QueueScheduler调度逻辑
**目标**: 专门负责阶段2，分配发信服务

```javascript
async allocateSubTasks(taskId) {
  // 1. 获取pending状态的SubTask
  const pendingSubTasks = await SubTask.findAll({
    where: { task_id: taskId, status: 'pending' }
  });
  
  // 2. 获取可用发信服务
  const availableServices = await this.getAvailableEmailServices();
  
  // 3. 轮询分配
  let serviceIndex = 0;
  for (const subTask of pendingSubTasks) {
    const service = availableServices[serviceIndex % availableServices.length];
    const sender = await Sender.findByPk(task.sender_id);
    
    await subTask.update({
      service_id: service.id,
      sender_email: `${sender.name}@${service.domain}`,
      status: 'allocated',
      scheduled_at: new Date()
    });
    
    serviceIndex++;
  }
}
```

### Step 4: 发信服务轮询策略
```javascript
async getAvailableEmailServices() {
  return await EmailService.findAll({
    where: {
      is_enabled: true,
      is_frozen: false,
      [Op.where]: sequelize.literal('used_quota < daily_quota')
    },
    order: [['used_quota', 'ASC']] // 优先使用余额多的
  });
}
```

## 🧪 测试验证计划

### 1. 单元测试
- [x] TaskService.generateSubTasksV3() 
- [x] QueueScheduler.allocateSubTasks()
- [x] 发信服务轮询逻辑

### 2. 集成测试  
- [x] 完整的两阶段流程
- [x] 多任务并发处理
- [x] 服务分配轮询验证

### 3. 生产验证
- [x] 创建测试任务
- [x] 观察SubTask状态流转
- [x] 验证发信服务分配
- [x] 检查邮件发送成功率

## 📅 实施时间表

| 步骤 | 预计时间 | 状态 |
|------|----------|------|
| 配置统一管理 | 30分钟 | 🔄 进行中 |
| 修复TaskService | 45分钟 | ⏳ 待开始 |
| 重构QueueScheduler | 60分钟 | ⏳ 待开始 |
| 测试验证 | 45分钟 | ⏳ 待开始 |
| 部署上线 | 30分钟 | ⏳ 待开始 |

## 🚨 风险评估

### 高风险
- 数据库事务一致性
- 现有任务的兼容性  

### 中风险  
- 服务分配算法性能
- 配置变更影响

### 低风险
- 代码重构引入bug
- 测试覆盖不全

## 🎯 成功标准

1. ✅ 语法错误完全修复，应用正常启动
2. ✅ 调度器正常运行，10秒间隔工作  
3. ✅ SubTask创建和调度分离清晰
4. ✅ 发信服务轮询分配正确
5. ✅ 邮件发送成功率 > 95%
6. ✅ 现有功能完全兼容

## 📝 变更记录

- 2025-07-01 14:00: 创建重构设计文档
- 2025-07-01 14:30: 开始配置统一管理实施 