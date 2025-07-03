-- 创建子任务表
-- 群发任务分解为一对一的子任务

-- V2.0 SubTask表（一对一邮件任务）
CREATE TABLE IF NOT EXISTS sub_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON UPDATE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON UPDATE CASCADE,
    
    -- V2.0新增：绑定的发信服务（调度时分配）
    service_id UUID REFERENCES email_services(id) ON UPDATE CASCADE ON DELETE SET NULL,
    
    sender_email VARCHAR(255) NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    template_id UUID NOT NULL REFERENCES email_templates(id) ON UPDATE CASCADE,
    rendered_subject VARCHAR(500) NOT NULL,
    rendered_body TEXT NOT NULL,
    
    -- V2.0增强的状态管理
    status enum_sub_tasks_status NOT NULL DEFAULT 'pending',
    
    -- 时间戳
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    
    -- 错误处理
    error_message TEXT,
    
    -- 跟踪相关
    tracking_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    email_service_response JSONB,
    
    -- 重试机制
    retry_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    
    -- V2.0新增：调度相关字段
    scheduled_at TIMESTAMP WITH TIME ZONE,  -- 计划发送时间
    allocated_quota INTEGER DEFAULT 1,      -- 分配的额度
    priority INTEGER DEFAULT 0,             -- 优先级（0=普通，1=高，-1=低）
    
    -- 跟踪数据
    tracking_data JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引优化
CREATE INDEX IF NOT EXISTS sub_tasks_task_id ON sub_tasks(task_id);
CREATE INDEX IF NOT EXISTS sub_tasks_status ON sub_tasks(status);
CREATE INDEX IF NOT EXISTS sub_tasks_created_at ON sub_tasks(created_at);
CREATE INDEX IF NOT EXISTS sub_tasks_tracking_id ON sub_tasks(tracking_id);

-- V2.0新增：调度相关索引
CREATE INDEX IF NOT EXISTS sub_tasks_service_id ON sub_tasks(service_id);
CREATE INDEX IF NOT EXISTS sub_tasks_scheduled_at ON sub_tasks(scheduled_at);
CREATE INDEX IF NOT EXISTS sub_tasks_priority ON sub_tasks(priority);
CREATE INDEX IF NOT EXISTS sub_tasks_status_scheduled ON sub_tasks(status, scheduled_at) WHERE status = 'pending';

-- 更新时间戳触发器
CREATE OR REPLACE FUNCTION update_sub_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sub_tasks_updated_at
    BEFORE UPDATE ON sub_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_sub_tasks_updated_at();

-- V2.0调度状态约束
ALTER TABLE sub_tasks 
ADD CONSTRAINT chk_sub_tasks_service_allocation 
CHECK (
    (status = 'pending' AND service_id IS NULL) OR 
    (status != 'pending' AND service_id IS NOT NULL)
);

-- 添加注释
COMMENT ON TABLE sub_tasks IS 'V2.0 SubTask表：一对一邮件发送任务，支持按需调度和服务绑定';
COMMENT ON COLUMN sub_tasks.service_id IS '发信服务ID：调度时分配，pending状态时为NULL';
COMMENT ON COLUMN sub_tasks.scheduled_at IS '计划发送时间：调度器根据此时间处理任务';
COMMENT ON COLUMN sub_tasks.allocated_quota IS '分配的发信额度：通常为1';
COMMENT ON COLUMN sub_tasks.priority IS '任务优先级：0=普通，1=高优先级，-1=低优先级'; 