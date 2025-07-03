# 优化队列调度系统架构设计 V2.0

## 🎯 设计目标

### 业务目标
- 支持100+邮件服务并发
- 支持百万级联系人数据
- 支持复杂Campaign多轮触达
- 支持AI个性化内容生成
- 实现半自动邮件会话系统

### 技术目标
- 高吞吐量：10万+邮件/小时
- 低延迟：任务等待时间<30秒
- 高可用：99.9%系统可用性
- 可扩展：支持水平扩展

## 🏗️ 核心架构组件

### 1. 服务调度管理器 (ServiceScheduleManager)

```javascript
// 服务调度表设计
CREATE TABLE email_service_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES email_services(id),
  user_id UUID NOT NULL REFERENCES users(id),
  last_sent_at TIMESTAMP DEFAULT NOW(),
  sending_interval INTEGER NOT NULL, -- 秒
  next_available_at TIMESTAMP GENERATED ALWAYS AS (
    last_sent_at + INTERVAL '1 second' * sending_interval
  ) STORED,
  remaining_quota INTEGER DEFAULT 0,
  daily_quota INTEGER DEFAULT 0,
  quota_reset_at TIMESTAMP DEFAULT DATE_TRUNC('day', NOW() + INTERVAL '1 day'),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 核心索引
CREATE INDEX idx_service_schedule_user_available ON email_service_schedule(
  user_id, next_available_at, remaining_quota
) WHERE remaining_quota > 0;

CREATE INDEX idx_service_schedule_next_available ON email_service_schedule(
  next_available_at
) WHERE remaining_quota > 0;
```

### 2. 分层任务队列系统 (HierarchicalTaskQueue)

```javascript
// 用户任务队列表
CREATE TABLE user_task_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  task_id UUID NOT NULL,
  pending_subtasks INTEGER DEFAULT 0,
  processing_subtasks INTEGER DEFAULT 0,
  priority INTEGER DEFAULT 0, -- 0=normal, 1=high, -1=low
  last_processed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, task_id)
);

-- 中央处理队列表（内存+持久化）
CREATE TABLE central_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subtask_id UUID NOT NULL REFERENCES sub_tasks(id),
  user_id UUID NOT NULL,
  task_id UUID NOT NULL,
  priority INTEGER DEFAULT 0,
  reserved_at TIMESTAMP NULL,
  reserved_by VARCHAR(255) NULL, -- 处理进程ID
  timeout_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 等待队列表（配额不足、服务不可用等情况）
CREATE TABLE pending_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subtask_id UUID NOT NULL REFERENCES sub_tasks(id),
  reason VARCHAR(100) NOT NULL, -- 'no_quota', 'no_service', 'rate_limit'
  retry_at TIMESTAMP NOT NULL,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 10,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3. 并发控制器 (ConcurrencyController)

```javascript
// 服务预留表（防止并发冲突）
CREATE TABLE service_reservations (
  service_id UUID PRIMARY KEY REFERENCES email_services(id),
  reserved_by VARCHAR(255) NOT NULL, -- 进程ID
  subtask_id UUID NOT NULL,
  reserved_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 seconds'
);

-- 自动清理过期预留
CREATE OR REPLACE FUNCTION cleanup_expired_reservations()
RETURNS void AS $$
BEGIN
  DELETE FROM service_reservations WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 定时清理任务
SELECT cron.schedule('cleanup-reservations', '*/30 * * * * *', 'SELECT cleanup_expired_reservations();');
```

## 📊 业务监控指标设计

### 1. 任务等待时长监控

```javascript
// 任务处理监控表
CREATE TABLE task_processing_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL,
  user_id UUID NOT NULL,
  status VARCHAR(50) NOT NULL, -- 'created', 'first_sent', 'completed'
  timestamp TIMESTAMP DEFAULT NOW(),
  subtasks_sent INTEGER DEFAULT 0,
  total_subtasks INTEGER DEFAULT 0
);

// 关键监控指标
- 任务首封邮件发送延迟 (first_email_delay)
- 任务完成时长 (task_completion_time)  
- 10分钟无进展任务告警 (stuck_task_alert)
- 用户平均等待时长 (user_avg_wait_time)
```

### 2. 系统性能监控

```javascript
// 系统性能指标表
CREATE TABLE system_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name VARCHAR(100) NOT NULL,
  metric_value DECIMAL(10,2) NOT NULL,
  tags JSONB DEFAULT '{}',
  timestamp TIMESTAMP DEFAULT NOW()
);

// 核心指标
- 队列处理吞吐量 (queue_throughput)
- 服务利用率 (service_utilization)
- 平均响应时间 (avg_response_time)
- 错误率 (error_rate)
```

## ⚙️ 配置管理系统

### 1. 系统配置表扩展

```javascript
// 扩展现有system_config表
ALTER TABLE system_config ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'general';
ALTER TABLE system_config ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE system_config ADD COLUMN IF NOT EXISTS value_type VARCHAR(20) DEFAULT 'string';
ALTER TABLE system_config ADD COLUMN IF NOT EXISTS constraints JSONB DEFAULT '{}';

// 队列相关配置
INSERT INTO system_config (key, value, category, description, value_type, constraints) VALUES
('queue.central_batch_size', '50', 'queue', '中央队列批处理大小', 'integer', '{"min": 10, "max": 200}'),
('queue.concurrent_workers', '10', 'queue', '并发处理器数量', 'integer', '{"min": 1, "max": 50}'),
('queue.pending_retry_interval', '60', 'queue', '等待队列重试间隔(秒)', 'integer', '{"min": 30, "max": 300}'),
('queue.service_reservation_timeout', '30', 'queue', '服务预留超时时间(秒)', 'integer', '{"min": 10, "max": 120}'),
('monitoring.stuck_task_threshold', '600', 'monitoring', '任务卡住告警阈值(秒)', 'integer', '{"min": 300, "max": 1800}'),
('monitoring.metrics_retention_days', '30', 'monitoring', '监控数据保留天数', 'integer', '{"min": 7, "max": 90}');
```

## 🔄 故障恢复机制

### 1. 系统启动恢复

```javascript
class SystemRecoveryManager {
  async performStartupRecovery() {
    logger.info('🔄 开始系统启动恢复...');
    
    // 1. 清理过期的服务预留
    await this.cleanupExpiredReservations();
    
    // 2. 恢复发送中的任务
    await this.recoverSendingTasks();
    
    // 3. 重建任务队列
    await this.rebuildTaskQueues();
    
    // 4. 恢复中央处理队列
    await this.recoverCentralQueue();
    
    logger.info('✅ 系统启动恢复完成');
  }
  
  async recoverSendingTasks() {
    // 查找所有sending状态的任务
    const sendingTasks = await Task.findAll({
      where: { status: 'sending' },
      include: [{ model: SubTask, where: { status: ['pending', 'allocated'] } }]
    });
    
    for (const task of sendingTasks) {
      // 重新计算任务统计
      await this.recalculateTaskStats(task.id);
      
      // 将pending子任务加入队列
      await this.enqueueSubTasks(task.SubTasks.filter(st => st.status === 'pending'));
      
      // 重置allocated子任务为pending
      await this.resetAllocatedSubTasks(task.SubTasks.filter(st => st.status === 'allocated'));
    }
  }
}
```

## 🎨 用户界面优化

### 1. 实时任务监控面板

```javascript
// 任务状态实时更新API
GET /api/tasks/{taskId}/realtime-status
Response: {
  "taskId": "uuid",
  "status": "sending",
  "progress": {
    "total": 1000,
    "sent": 245,
    "pending": 755,
    "failed": 0
  },
  "metrics": {
    "avgWaitTime": 15, // 秒
    "throughput": 120, // 邮件/小时
    "estimatedCompletion": "2025-07-02T15:30:00Z"
  },
  "lastActivity": "2025-07-02T14:45:23Z"
}
```

### 2. 系统健康监控页面

```javascript
// 系统健康状态API
GET /api/system/health
Response: {
  "status": "healthy",
  "services": {
    "total": 100,
    "available": 98,
    "utilizationRate": 0.75
  },
  "queues": {
    "central": 45,
    "pending": 12,
    "processing": 8
  },
  "performance": {
    "throughput": 8500, // 邮件/小时
    "avgResponseTime": 250, // 毫秒
    "errorRate": 0.002
  }
}
```

## 🔧 核心算法实现

### 1. 智能服务选择算法

```javascript
class IntelligentServiceSelector {
  async selectOptimalService(userId, taskId, subTaskId) {
    // 1. 获取用户可用服务（按优先级排序）
    const availableServices = await this.getUserAvailableServices(userId);
    
    // 2. 实时过滤可用服务
    const readyServices = await this.filterReadyServices(availableServices);
    
    // 3. 智能选择最优服务
    return await this.selectBestService(readyServices, taskId);
  }
  
  async filterReadyServices(services) {
    const now = new Date();
    const readyServices = [];
    
    for (const service of services) {
      // 检查时间可用性
      if (service.next_available_at <= now && service.remaining_quota > 0) {
        readyServices.push({
          ...service,
          score: this.calculateServiceScore(service)
        });
      }
    }
    
    // 按评分排序
    return readyServices.sort((a, b) => b.score - a.score);
  }
  
  calculateServiceScore(service) {
    // 综合评分算法
    const quotaScore = service.remaining_quota / service.daily_quota; // 配额充足度
    const timeScore = Math.min(1, (Date.now() - service.last_sent_at) / (service.sending_interval * 1000)); // 时间充足度
    const reliabilityScore = service.success_rate || 0.95; // 历史成功率
    
    return quotaScore * 0.4 + timeScore * 0.4 + reliabilityScore * 0.2;
  }
}
```

### 2. 公平队列调度算法

```javascript
class FairQueueScheduler {
  async getNextSubTaskFairly() {
    // 轮询策略：确保不同用户和任务的公平性
    const userTaskQueues = await this.getUserTaskQueues();
    
    // 按最后处理时间排序，优先处理久未处理的
    userTaskQueues.sort((a, b) => a.last_processed_at - b.last_processed_at);
    
    for (const queue of userTaskQueues) {
      const subTask = await this.getNextSubTaskFromQueue(queue.user_id, queue.task_id);
      if (subTask) {
        // 更新最后处理时间
        await this.updateQueueProcessTime(queue.user_id, queue.task_id);
        return subTask;
      }
    }
    
    return null;
  }
}
```

## 📈 性能优化策略

### 1. 数据库优化

```sql
-- 分区表优化（按时间分区）
CREATE TABLE task_processing_metrics_y2025m07 PARTITION OF task_processing_metrics
FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');

-- 自动分区管理
CREATE OR REPLACE FUNCTION create_monthly_partitions()
RETURNS void AS $$
DECLARE
  start_date date;
  end_date date;
  partition_name text;
BEGIN
  start_date := date_trunc('month', CURRENT_DATE + interval '1 month');
  end_date := start_date + interval '1 month';
  partition_name := 'task_processing_metrics_y' || extract(year from start_date) || 'm' || lpad(extract(month from start_date)::text, 2, '0');
  
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF task_processing_metrics FOR VALUES FROM (%L) TO (%L)', 
    partition_name, start_date, end_date);
END;
$$ LANGUAGE plpgsql;
```

### 2. 缓存策略

```javascript
class CacheManager {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.serviceCache = new Map(); // 服务状态缓存
    this.configCache = new Map(); // 配置缓存
  }
  
  async cacheServiceSchedule(userId) {
    const services = await this.getServiceScheduleFromDB(userId);
    const cacheKey = `service_schedule:${userId}`;
    await this.redis.setex(cacheKey, 60, JSON.stringify(services)); // 1分钟缓存
    return services;
  }
  
  async getCachedServiceSchedule(userId) {
    const cacheKey = `service_schedule:${userId}`;
    const cached = await this.redis.get(cacheKey);
    return cached ? JSON.parse(cached) : null;
  }
}
```

## 🎯 关键成功指标

### 业务指标
- 任务首封邮件延迟 < 30秒
- 任务完成率 > 99%
- 用户满意度 > 95%

### 技术指标  
- 系统吞吐量 > 10万邮件/小时
- 服务可用性 > 99.9%
- 平均响应时间 < 500ms

### 扩展性指标
- 支持100+邮件服务
- 支持1000+并发用户
- 支持百万级联系人数据

---

**这个架构设计为EDM系统的未来发展奠定了坚实基础，支持AI个性化、多轮Campaign、半自动会话等高级功能的实现。** 