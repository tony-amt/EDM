-- Phase 4 核心功能数据库脚本
-- 只包含必要的表和字段，专注于next_available_at间隔控制机制

-- 1. 创建task_wait_metrics表（使用正确的UUID类型）
CREATE TABLE IF NOT EXISTS task_wait_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL,  -- 使用UUID类型匹配tasks表
    user_id UUID NOT NULL,
    entry_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    first_send_time TIMESTAMP WITH TIME ZONE,
    completion_time TIMESTAMP WITH TIME ZONE,
    wait_duration_seconds INTEGER,
    status VARCHAR(20) DEFAULT 'waiting',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- 外键约束
    CONSTRAINT fk_task_wait_metrics_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    CONSTRAINT fk_task_wait_metrics_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- 检查约束
    CONSTRAINT chk_wait_duration_positive CHECK (wait_duration_seconds >= 0),
    CONSTRAINT chk_status_valid CHECK (status IN ('waiting', 'processing', 'completed', 'failed'))
);

-- 2. 为task_wait_metrics创建索引
CREATE INDEX IF NOT EXISTS idx_task_wait_metrics_task_id ON task_wait_metrics(task_id);
CREATE INDEX IF NOT EXISTS idx_task_wait_metrics_user_id ON task_wait_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_task_wait_metrics_status ON task_wait_metrics(status);
CREATE INDEX IF NOT EXISTS idx_task_wait_metrics_created_at ON task_wait_metrics(created_at);

-- 3. 确保email_services表有next_available_at字段（Phase 4核心机制）
DO $$
BEGIN
    -- 检查next_available_at字段是否存在
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_services' AND column_name = 'next_available_at') THEN
        ALTER TABLE email_services ADD COLUMN next_available_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        COMMENT ON COLUMN email_services.next_available_at IS 'Phase 4: 下次可用时间，替代冻结机制';
    END IF;
    
    -- 确保所有服务都有合理的next_available_at值
    UPDATE email_services 
    SET next_available_at = CURRENT_TIMESTAMP
    WHERE next_available_at IS NULL;
END $$;

-- 4. 优化email_services的索引（支持Phase 4查询）
CREATE INDEX IF NOT EXISTS idx_email_services_next_available_enabled 
ON email_services(next_available_at, is_enabled) 
WHERE is_enabled = true AND is_frozen = false;

-- 5. 添加注释
COMMENT ON TABLE task_wait_metrics IS 'Phase 4: 任务等待时间监控表，用于追踪任务从进入队列到开始发送的等待时间';
COMMENT ON COLUMN task_wait_metrics.entry_time IS '任务进入队列的时间';
COMMENT ON COLUMN task_wait_metrics.first_send_time IS '第一个邮件开始发送的时间';
COMMENT ON COLUMN task_wait_metrics.completion_time IS '任务完成的时间';
COMMENT ON COLUMN task_wait_metrics.wait_duration_seconds IS '等待时长（秒），从进入队列到开始发送';

-- 验证Phase 4核心功能准备就绪
DO $$
BEGIN
    -- 验证task_wait_metrics表存在
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_wait_metrics') THEN
        RAISE EXCEPTION 'task_wait_metrics表创建失败';
    END IF;
    
    -- 验证email_services表有next_available_at字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_services' AND column_name = 'next_available_at') THEN
        RAISE EXCEPTION 'email_services表缺少next_available_at字段';
    END IF;
    
    RAISE NOTICE 'Phase 4 核心功能数据库准备完成：专注于next_available_at间隔控制机制';
END $$; 