# 调度器架构对比分析

## 🔄 现有问题分析

### 1. **TaskScheduler.js 的问题**

#### 批处理逻辑混乱
```javascript
// 问题：batchSize 用于限制处理数量，但没有考虑发信服务的时间间隔
async processAllocatedSubTasks(batchSize = 50) {
  const allocatedSubTasks = await SubTask.findAll({
    limit: batchSize  // 简单的数量限制
  });
  
  for (const subtask of allocatedSubTasks) {
    // 连续发送，没有时间间隔控制
    await this.sendEmail(subtask);
  }
}
```

#### 缺乏多用户公平性
```javascript
// 问题：按时间顺序处理，先创建的任务会优先处理完
const allocatedSubTasks = await SubTask.findAll({
  order: [['scheduled_at', 'ASC']]  // 单纯按时间排序
});
```

#### 发信服务选择不合理
```javascript
// 问题：每次都重新选择服务，没有考虑服务的发送间隔
const selectedService = await EmailRoutingService.selectEmailService(userId, 1);
```

### 2. **EmailRoutingService.js 的问题**

#### 缺乏时间间隔控制
```javascript
// 问题：虽然有 sending_rate 字段，但没有真正按间隔发送
prioritizeServices(services) {
  return services.sort((a, b) => {
    return b.sending_rate - a.sending_rate; // 只是排序，没有时间控制
  });
}
```

## 🚀 新架构：QueueScheduler.js

### 核心设计思想

1. **任务创建时预生成队列**：避免运行时计算开销
2. **发信服务按自己的间隔轮询**：真正的速率控制
3. **多用户多任务公平轮询**：避免饥饿问题
4. **严格的额度控制**：创建时检查，发送时扣减

### 关键改进

#### 1. 预生成队列机制
```javascript
// 任务创建时就生成所有SubTask
async generateTaskQueue(taskId) {
  // 1. 检查用户额度
  const quotaCheck = await QuotaService.checkUserQuota(userId, estimatedCount);
  
  // 2. 检查发信服务可用性
  const availableServices = await EmailRoutingService.getUserAvailableServices(userId);
  
  // 3. 预扣减用户额度
  await QuotaService.deductUserQuota(userId, estimatedCount);
  
  // 4. 生成SubTask队列（按联系人ID排序）
  const subTasks = await this.createSubTaskQueue(task, contacts);
  
  // 5. 加入内存队列管理
  this.taskQueues.set(taskId, {
    subTasks: subTasks.map(st => st.id),
    currentIndex: 0,
    status: 'active'
  });
}
```

#### 2. 发信服务时间间隔控制
```javascript
// 每个发信服务按自己的间隔启动定时器
startServiceTimer(service) {
  const intervalMs = (service.sending_rate || 60) * 1000;
  
  const timer = setInterval(async () => {
    await this.processServiceQueue(service.id);
  }, intervalMs);
  
  this.serviceTimers.set(service.id, timer);
}
```

#### 3. 多用户公平轮询
```javascript
// 多层轮询：用户 -> 任务 -> SubTask
async getNextSubTaskForService(serviceId) {
  // 1. 按用户分组
  const userQueues = new Map();
  activeQueues.forEach(queue => {
    if (!userQueues.has(queue.userId)) {
      userQueues.set(queue.userId, []);
    }
    userQueues.get(queue.userId).push(queue);
  });

  // 2. 轮询用户
  for (const userId of userIds) {
    // 3. 轮询该用户的任务
    const lastTaskIndex = this.userTaskRotation.get(userId) || 0;
    const nextTaskIndex = (lastTaskIndex + 1) % userTaskQueues.length;
    
    // 4. 获取下一个SubTask
    const subTask = await this.getNextSubTaskFromQueue(selectedQueue);
    return subTask;
  }
}
```

#### 4. 严格的额度控制
```javascript
// 创建任务时的额度检查流程
async generateTaskQueue(taskId) {
  // 用户额度检查
  if (!quotaCheck.success) {
    return { error: '当前邮件发信额度不足' };
  }
  
  // 发信服务额度检查
  if (totalServiceQuota === 0) {
    return { error: '当前发信服务额度已用完' };
  }
  
  // 预扣减用户额度
  await QuotaService.deductUserQuota(userId, estimatedCount);
}
```

## 📊 对比总结

| 特性 | TaskScheduler (旧) | QueueScheduler (新) |
|------|-------------------|-------------------|
| **队列生成** | 运行时生成 | 任务创建时预生成 |
| **发送控制** | 批量处理 | 按服务间隔轮询 |
| **多用户公平性** | ❌ 按时间顺序 | ✅ 公平轮询 |
| **额度控制** | 发送时检查 | 创建时预扣减 |
| **服务间隔** | ❌ 未实现 | ✅ 真正的时间控制 |
| **故障处理** | 重试机制 | 暂停/恢复机制 |
| **性能** | 每次查询数据库 | 内存队列管理 |

## 🎯 实现你的需求

### 1. 任务创建时的额度检查
```javascript
// ✅ 已实现：创建任务时检查额度
if (!quotaCheck.success) {
  return { error: '当前邮件发信额度不足' };
}
```

### 2. 发信服务可用性检查
```javascript
// ✅ 已实现：检查服务可用性和额度
if (availableServices.length === 0) {
  return { error: '当前没有可用的发信服务' };
}
if (totalServiceQuota === 0) {
  return { error: '当前发信服务额度已用完' };
}
```

### 3. 发信服务时间间隔控制
```javascript
// ✅ 已实现：每个服务按自己的间隔轮询
const intervalMs = (service.sending_rate || 60) * 1000;
setInterval(() => processServiceQueue(serviceId), intervalMs);
```

### 4. 多用户多任务轮询
```javascript
// ✅ 已实现：用户级别和任务级别的公平轮询
// 用户轮询 -> 任务轮询 -> SubTask获取
```

## 🔧 使用方式

### 启动新调度器
```javascript
const QueueScheduler = require('./services/infrastructure/QueueScheduler');

// 启动调度器
await QueueScheduler.start();

// 创建任务时生成队列
const result = await QueueScheduler.generateTaskQueue(taskId);
```

### 监控调度器状态
```javascript
const status = QueueScheduler.getStatus();
console.log({
  is_running: status.is_running,
  active_queues: status.active_queues,
  active_services: status.active_services,
  total_pending_subtasks: status.total_pending_subtasks
});
```

新的QueueScheduler完全符合你描述的需求，实现了真正的多用户多任务公平轮询机制！ 