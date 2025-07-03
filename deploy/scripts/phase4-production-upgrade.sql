-- Phase 4: 队列系统升级 - 生产数据升级脚本
-- 执行时间：2025-07-03  
-- 目标：基于生产现有数据升级到Phase 4队列调度系统

-- ================================================
-- 阶段1: 生产数据状态检查
-- ================================================

DO $upgrade_check$
BEGIN
    RAISE NOTICE '=== Phase 4 生产升级前数据检查 ===';
    
    -- 检查现有任务数量
    RAISE NOTICE '现有任务总数: %', (SELECT COUNT(*) FROM tasks);
    
    -- 检查现有SubTask数量  
    RAISE NOTICE '现有SubTask总数: %', (SELECT COUNT(*) FROM sub_tasks);
    
    -- 检查邮件服务数量
    RAISE NOTICE '邮件服务总数: %', (SELECT COUNT(*) FROM email_services);
    
    -- 检查是否已有Phase 4字段
    RAISE NOTICE '已有last_reset_at字段的服务: %', (
        SELECT COUNT(*) FROM information_schema.columns 
        WHERE table_name = 'email_services' AND column_name = 'last_reset_at'
    );
END $upgrade_check$;

-- ================================================
-- 阶段2: 备份现有数据
-- ================================================

-- 2.1 备份关键表
CREATE TABLE IF NOT EXISTS tasks_backup_phase4 AS SELECT * FROM tasks;
CREATE TABLE IF NOT EXISTS sub_tasks_backup_phase4 AS SELECT * FROM sub_tasks;
CREATE TABLE IF NOT EXISTS email_services_backup_phase4 AS SELECT * FROM email_services;

-- ================================================
-- 阶段3: 升级email_services表结构
-- ================================================

-- 3.1 添加Phase 4所需字段
ALTER TABLE email_services 
  ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS next_available_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS total_sent INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS success_rate DECIMAL(5,2) DEFAULT 100.00 NOT NULL,
  ADD COLUMN IF NOT EXISTS avg_response_time INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS last_reset_at TIMESTAMP WITH TIME ZONE;

-- 3.2 为现有服务设置合理的初始值
UPDATE email_services SET 
  total_sent = COALESCE(used_quota, 0),
  success_rate = 100.00,
  avg_response_time = 0,
  last_reset_at = CURRENT_DATE
WHERE last_reset_at IS NULL;

-- ================================================  
-- 阶段4: 升级tasks表结构 (保持生产兼容性)
-- ================================================

-- 4.1 添加Phase 4统计字段 (如果不存在)
ALTER TABLE tasks 
  ADD COLUMN IF NOT EXISTS total_subtasks INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS allocated_subtasks INTEGER DEFAULT 0 NOT NULL, 
  ADD COLUMN IF NOT EXISTS pending_subtasks INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS total_opens INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS total_clicks INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS total_errors INTEGER DEFAULT 0 NOT NULL;

-- 4.2 同步现有任务的统计数据
UPDATE tasks SET 
  total_subtasks = (
    SELECT COUNT(*) FROM sub_tasks WHERE task_id = tasks.id
  ),
  pending_subtasks = (
    SELECT COUNT(*) FROM sub_tasks 
    WHERE task_id = tasks.id AND status IN ('pending', 'allocated')
  ),
  allocated_subtasks = (
    SELECT COUNT(*) FROM sub_tasks 
    WHERE task_id = tasks.id AND service_id IS NOT NULL
  ),
  total_opens = (
    SELECT COUNT(*) FROM sub_tasks 
    WHERE task_id = tasks.id AND opened_at IS NOT NULL
  ),
  total_clicks = (
    SELECT COUNT(*) FROM sub_tasks 
    WHERE task_id = tasks.id AND clicked_at IS NOT NULL  
  ),
  total_errors = (
    SELECT COUNT(*) FROM sub_tasks 
    WHERE task_id = tasks.id AND status = 'failed'
  );

-- ================================================
-- 阶段5: 升级sub_tasks表结构 (保持生产兼容性)  
-- ================================================

-- 5.1 添加Phase 4调度字段 (如果不存在)
ALTER TABLE sub_tasks
  ADD COLUMN IF NOT EXISTS allocated_quota INTEGER,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP WITH TIME ZONE;

-- 5.2 为现有SubTask设置初始值
UPDATE sub_tasks SET 
  retry_count = 0
WHERE retry_count IS NULL;

-- ================================================
-- 阶段6: 创建Phase 4监控表
-- ================================================

-- 6.1 创建任务等待监控表  
CREATE TABLE IF NOT EXISTS task_wait_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  wait_duration_seconds INTEGER,
  status VARCHAR(20) DEFAULT 'waiting',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 6.2 创建索引
CREATE INDEX IF NOT EXISTS idx_task_wait_metrics_task_id ON task_wait_metrics(task_id);
CREATE INDEX IF NOT EXISTS idx_task_wait_metrics_status ON task_wait_metrics(status);
CREATE INDEX IF NOT EXISTS idx_task_wait_metrics_created_at ON task_wait_metrics(created_at);

-- ================================================
-- 阶段7: 升级状态枚举 (如果需要)
-- ================================================

-- 7.1 添加Phase 4所需的SubTask状态
DO $add_enum_values$
BEGIN
  -- 添加allocated状态 (如果不存在)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'allocated' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_sub_tasks_status')
  ) THEN
    ALTER TYPE enum_sub_tasks_status ADD VALUE 'allocated';
  END IF;
  
  -- 添加delivered状态 (如果不存在)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'delivered' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_sub_tasks_status')
  ) THEN
    ALTER TYPE enum_sub_tasks_status ADD VALUE 'delivered';
  END IF;
  
  -- 添加其他必要状态
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'bounced' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_sub_tasks_status')
  ) THEN
    ALTER TYPE enum_sub_tasks_status ADD VALUE 'bounced';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'opened' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_sub_tasks_status')
  ) THEN
    ALTER TYPE enum_sub_tasks_status ADD VALUE 'opened';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'clicked' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_sub_tasks_status')
  ) THEN
    ALTER TYPE enum_sub_tasks_status ADD VALUE 'clicked';
  END IF;
END $add_enum_values$;

-- ================================================
-- 阶段8: 创建性能优化索引  
-- ================================================

-- 8.1 为队列调度创建关键索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sub_tasks_status_priority 
ON sub_tasks(status, priority DESC) WHERE status IN ('pending', 'allocated');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sub_tasks_service_next_available 
ON sub_tasks(service_id, scheduled_at) WHERE service_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_services_enabled_available 
ON email_services(is_enabled, next_available_at) WHERE is_enabled = true;

-- 8.2 为监控查询创建索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_status_priority 
ON tasks(status, priority DESC);

-- ================================================
-- 阶段9: 数据一致性验证
-- ================================================

DO $validation$
DECLARE
    task_count INTEGER;
    subtask_count INTEGER;
    service_count INTEGER;
BEGIN
    RAISE NOTICE '=== Phase 4 升级数据验证 ===';
    
    -- 验证任务统计字段同步
    SELECT COUNT(*) INTO task_count FROM tasks 
    WHERE total_subtasks != (SELECT COUNT(*) FROM sub_tasks WHERE task_id = tasks.id);
    
    IF task_count = 0 THEN
        RAISE NOTICE '✅ 任务统计字段同步正确';
    ELSE  
        RAISE WARNING '❌ 发现 % 个任务统计不一致', task_count;
    END IF;
    
    -- 验证邮件服务字段
    SELECT COUNT(*) INTO service_count FROM email_services 
    WHERE last_reset_at IS NULL;
    
    IF service_count = 0 THEN
        RAISE NOTICE '✅ 邮件服务字段升级完成';
    ELSE
        RAISE WARNING '❌ 发现 % 个服务字段未初始化', service_count;
    END IF;
    
    -- 显示升级统计
    RAISE NOTICE 'Phase 4 升级统计:';
    RAISE NOTICE '- 升级的任务: %', (SELECT COUNT(*) FROM tasks);
    RAISE NOTICE '- 升级的SubTask: %', (SELECT COUNT(*) FROM sub_tasks);  
    RAISE NOTICE '- 升级的邮件服务: %', (SELECT COUNT(*) FROM email_services);
END $validation$;

-- ================================================
-- 完成升级
-- ================================================

-- 最终状态报告
SELECT 
    'Phase 4 升级完成' as status,
    NOW() as completed_at,
    (SELECT COUNT(*) FROM tasks) as total_tasks,
    (SELECT COUNT(*) FROM sub_tasks) as total_subtasks,
    (SELECT COUNT(*) FROM email_services WHERE is_enabled = true) as active_services;
