# V3.0 队列调度器实现总结

## 🎯 实现目标

基于新的JSONB字段结构，设计并实现了完整的队列调度器系统，解决了原有TaskScheduler的架构问题。

## 🔄 主要变更

### 1. 调度器架构升级

**旧架构 (TaskScheduler.js)**
- 批处理逻辑混乱
- 缺乏多用户轮询
- 发信服务时间间隔未实现
- 按需生成SubTask，效率低

**新架构 (QueueScheduler.js)**
- 预生成队列机制
- 真正的时间间隔控制
- 多用户公平轮询
- 严格额度控制

### 2. 数据模型适配

**删除的模型和服务**
- `TaskScheduler.js` - 旧调度器
- `mailWorker.service.js` - 功能重复的邮件工作器
- 相关的关联表模型引用

**保留的服务**
- `mailServiceManager.service.js` - 邮件服务管理器（有用，继续使用）
- `subtask.service.js` - 已适配新的JSONB字段

### 3. 路由和控制器更新

**更新的文件**
- `scheduler.controller.js` - 切换到QueueScheduler
- `scheduler.routes.js` - 新增任务控制路由
- `task.controller.js` - 更新调度器引用
- `task.service.js` - 更新调度器引用
- `index.js` - 启动逻辑更新

## 🏗️ 新架构特性

### 1. 预生成队列机制

```javascript
// 任务创建时预生成所有SubTask
async processScheduledTasks(batchSize = 20) {
  const tasks = await this.getScheduledTasks(batchSize);
  
  for (const task of tasks) {
    // 1. 检查用户额度
    // 2. 获取联系人（使用JSONB字段）
    // 3. 生成完整的SubTask队列
    // 4. 按联系人ID排序
    const subtasks = await this.generateSubTaskQueue(task);
  }
}
```

### 2. 真正的时间间隔控制

```javascript
// 每个发信服务独立的定时器
async startServiceScheduler(serviceId) {
  const service = await EmailService.findByPk(serviceId);
  const interval = service.sending_rate * 1000; // 转换为毫秒
  
  const timer = setInterval(async () => {
    await this.processServiceQueue(serviceId);
  }, interval);
  
  this.serviceTimers.set(serviceId, timer);
}
```

### 3. 多用户公平轮询

```javascript
// 用户 → 任务 → SubTask 三层轮询
async processServiceQueue(serviceId) {
  const users = await this.getActiveUsers();
  
  for (const user of users) {
    const tasks = await this.getUserActiveTasks(user.id);
    
    for (const task of tasks) {
      const nextSubTask = await this.getNextQueuedSubTask(task.id, serviceId);
      if (nextSubTask) {
        await this.sendEmail(nextSubTask);
        break; // 每轮只处理一个，确保公平性
      }
    }
  }
}
```

### 4. 严格额度控制

```javascript
// 创建时检查用户额度
if (user.remaining_quota < requiredQuota) {
  throw new Error('用户额度不足');
}

// 轮询时检查服务额度
const remainingQuota = service.daily_quota - service.used_quota;
if (remainingQuota <= 0) {
  await this.pauseTasksForService(serviceId);
}
```

## 🧪 测试体系

### 1. 单元测试

**文件**: `tests/integration/queueScheduler.test.js`

测试覆盖：
- 任务队列生成
- 队列调度机制
- 额度控制
- 任务控制
- 错误处理
- 性能测试

### 2. 路由测试

**文件**: `tests/integration/emailRouting.test.js`

测试覆盖：
- 用户可用服务获取
- 服务选择算法
- 额度管理
- 负载均衡
- 服务健康检查
- 故障转移

### 3. 手动测试脚本

**文件**: `test-scheduler.js`

功能：
- 完整的端到端测试
- 实时状态观察
- 多用户公平性验证
- 额度控制验证
- 任务控制验证

## 📋 使用方法

### 1. 运行测试

```bash
# 运行Jest单元测试
cd src/backend
npm run test:queue
npm run test:routing

# 运行手动测试脚本
npm run test:scheduler
```

### 2. API调用

```bash
# 启动调度器
POST /api/scheduler/start

# 停止调度器
POST /api/scheduler/stop

# 暂停任务
POST /api/scheduler/tasks/:task_id/pause

# 恢复任务
POST /api/scheduler/tasks/:task_id/resume

# 获取状态
GET /api/scheduler/status

# 获取统计
GET /api/scheduler/stats
```

### 3. 任务创建

```javascript
// 使用新的JSONB字段创建任务
const task = await Task.create({
  name: 'Newsletter Campaign',
  status: 'scheduled',
  scheduled_at: new Date(),
  sender_id: senderId,
  created_by: userId,
  contacts: [1, 2, 3, 4, 5], // JSONB数组
  templates: [templateId], // JSONB数组
  recipient_rule: {
    type: 'tag_based',
    include_tags: ['newsletter'],
    exclude_tags: ['unsubscribed']
  }
});
```

## 🔧 配置说明

### 1. 发信服务配置

```javascript
// EmailService表中的sending_rate字段控制发送间隔
{
  name: 'Service A',
  sending_rate: 60, // 60秒间隔
  daily_quota: 1000,
  used_quota: 0
}
```

### 2. 队列配置

```javascript
// QueueScheduler构造函数中的配置
constructor() {
  this.maxRetries = 3; // 最大重试次数
  this.retryDelay = 60000; // 重试延迟（毫秒）
  this.batchSize = 50; // 批处理大小
  this.healthCheckInterval = 3600000; // 健康检查间隔（1小时）
}
```

## 🚀 性能优化

### 1. 数据库优化

- 使用JSONB字段减少JOIN查询
- 批量创建SubTask
- 索引优化（contact_id, task_id, status）

### 2. 内存优化

- 队列状态缓存
- 服务客户端缓存
- 定时器管理

### 3. 并发控制

- 每个服务独立定时器
- 用户间公平轮询
- 任务状态锁定

## 📊 监控指标

### 1. 调度器状态

```javascript
{
  is_running: true,
  active_services: 3,
  total_queued_subtasks: 1250,
  processing_rate: "45 emails/min",
  last_health_check: "2024-01-15T10:30:00Z"
}
```

### 2. 服务健康状态

```javascript
{
  service_id: "service-1",
  is_healthy: true,
  remaining_quota: 750,
  usage_percentage: 25,
  last_sent: "2024-01-15T10:29:45Z"
}
```

## 🔮 未来扩展

### 1. 优先级队列

- 支持任务优先级
- VIP用户优先处理
- 紧急任务插队

### 2. 智能调度

- 基于历史数据的发送时间优化
- 收件人时区感知
- 发送效果反馈调整

### 3. 分布式支持

- 多实例负载均衡
- Redis队列支持
- 集群状态同步

## ✅ 验收标准

- [x] 删除旧的TaskScheduler和相关冗余代码
- [x] 实现基于JSONB字段的新调度逻辑
- [x] 真正的时间间隔控制
- [x] 多用户公平轮询机制
- [x] 严格的额度控制
- [x] 完整的测试覆盖
- [x] 任务暂停/恢复功能
- [x] 服务健康检查
- [x] 错误处理和重试机制
- [x] 性能优化和监控

## 🎉 总结

V3.0队列调度器成功解决了原有架构的所有问题：

1. **架构清晰**：预生成队列 + 时间间隔控制 + 公平轮询
2. **功能完整**：额度控制 + 任务管理 + 错误处理
3. **性能优化**：JSONB字段 + 批量操作 + 缓存机制
4. **测试完备**：单元测试 + 集成测试 + 手动测试
5. **易于维护**：清理冗余代码 + 统一接口 + 完整文档

新的调度器为EDM系统提供了稳定、高效、可扩展的邮件发送能力。 