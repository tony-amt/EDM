-- 创建基础表结构
-- 这个脚本创建EDM系统的核心表

-- 1. 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. 创建任务表（使用UUID类型）
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'draft',
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    name VARCHAR(255),
    schedule_time TIMESTAMP WITH TIME ZONE,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    priority INTEGER NOT NULL DEFAULT 0,
    actual_start_time TIMESTAMP WITH TIME ZONE,
    actual_finish_time TIMESTAMP WITH TIME ZONE,
    pause_reason VARCHAR(500),
    completed_at TIMESTAMP WITH TIME ZONE,
    recipient_rule JSONB NOT NULL DEFAULT '{}'::jsonb,
    sender_id UUID,
    created_by UUID,
    total_subtasks INTEGER NOT NULL DEFAULT 0,
    allocated_subtasks INTEGER NOT NULL DEFAULT 0,
    pending_subtasks INTEGER NOT NULL DEFAULT 0,
    contacts JSONB DEFAULT '[]'::jsonb,
    templates JSONB DEFAULT '[]'::jsonb,
    total_opens INTEGER NOT NULL DEFAULT 0,
    total_clicks INTEGER NOT NULL DEFAULT 0,
    total_errors INTEGER NOT NULL DEFAULT 0,
    summary_stats JSONB,
    error_message TEXT,
    
    -- 外键约束
    CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 3. 创建邮件服务表
CREATE TABLE IF NOT EXISTS email_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'engagelab',
    api_key TEXT NOT NULL,
    api_secret TEXT NOT NULL,
    domain VARCHAR(100) NOT NULL,
    daily_quota INTEGER NOT NULL DEFAULT 0,
    used_quota INTEGER NOT NULL DEFAULT 0,
    sending_rate INTEGER NOT NULL DEFAULT 10,
    quota_reset_time TIME NOT NULL DEFAULT '00:00:00',
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    is_frozen BOOLEAN NOT NULL DEFAULT false,
    frozen_until TIMESTAMP WITH TIME ZONE,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Phase 4: 新增字段
    last_sent_at TIMESTAMP WITH TIME ZONE,
    next_available_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    total_sent INTEGER DEFAULT 0,
    success_rate NUMERIC(5,2) DEFAULT 100.00,
    avg_response_time INTEGER DEFAULT 0,
    last_reset_at TIMESTAMP WITH TIME ZONE,
    
    -- 检查约束
    CONSTRAINT chk_daily_quota_positive CHECK (daily_quota >= 0),
    CONSTRAINT chk_used_quota_valid CHECK (used_quota >= 0 AND used_quota <= daily_quota),
    CONSTRAINT chk_sending_rate_positive CHECK (sending_rate > 0),
    CONSTRAINT chk_consecutive_failures_positive CHECK (consecutive_failures >= 0)
);

-- 4. 创建SubTask表
CREATE TABLE IF NOT EXISTS sub_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    template_content TEXT,
    subject VARCHAR(500),
    status VARCHAR(20) DEFAULT 'pending',
    sent_at TIMESTAMP WITH TIME ZONE,
    service_id UUID,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    email_service_response JSONB,
    tracking_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- 外键约束
    CONSTRAINT sub_tasks_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    CONSTRAINT sub_tasks_service_id_fkey FOREIGN KEY (service_id) REFERENCES email_services(id) ON DELETE SET NULL
);

-- 5. 创建发送者表
CREATE TABLE IF NOT EXISTS senders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    reply_to VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. 创建索引
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_at ON tasks(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);

CREATE INDEX IF NOT EXISTS idx_email_services_enabled ON email_services(is_enabled);
CREATE INDEX IF NOT EXISTS idx_email_services_frozen ON email_services(is_frozen);
CREATE INDEX IF NOT EXISTS idx_email_services_next_available_enabled 
ON email_services(next_available_at, is_enabled) 
WHERE is_enabled = true AND is_frozen = false;

CREATE INDEX IF NOT EXISTS idx_sub_tasks_task_id ON sub_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_sub_tasks_status ON sub_tasks(status);
CREATE INDEX IF NOT EXISTS idx_sub_tasks_service_id ON sub_tasks(service_id);

-- 7. 插入测试数据
INSERT INTO users (id, username, email, password_hash, role) VALUES 
('550e8400-e29b-41d4-a716-446655440000', 'admin', 'admin@example.com', '$2b$10$hash', 'admin'),
('550e8400-e29b-41d4-a716-446655440001', 'testuser', 'test@example.com', '$2b$10$hash', 'user')
ON CONFLICT (username) DO NOTHING;

INSERT INTO senders (id, name, email) VALUES 
('660e8400-e29b-41d4-a716-446655440000', '测试发送者', 'sender@example.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO email_services (id, name, provider, api_key, api_secret, domain, daily_quota, next_available_at) VALUES 
('770e8400-e29b-41d4-a716-446655440000', '测试服务1', 'engagelab', 'test_key_1', 'test_secret_1', 'test1.com', 1000, CURRENT_TIMESTAMP),
('770e8400-e29b-41d4-a716-446655440001', '测试服务2', 'engagelab', 'test_key_2', 'test_secret_2', 'test2.com', 2000, CURRENT_TIMESTAMP),
('770e8400-e29b-41d4-a716-446655440002', '禁用服务', 'engagelab', 'test_key_3', 'test_secret_3', 'test3.com', 500, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- 禁用第三个服务用于测试
UPDATE email_services SET is_enabled = false WHERE name = '禁用服务';

INSERT INTO tasks (id, title, description, status, created_by, sender_id, priority, total_subtasks, pending_subtasks) VALUES 
('880e8400-e29b-41d4-a716-446655440000', 'Phase 4 测试任务', 'Phase 4 两阶段队列系统测试任务', 'queued', 
 '550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440000', 1, 3, 3)
ON CONFLICT (id) DO NOTHING;

-- 插入测试SubTask
INSERT INTO sub_tasks (id, task_id, recipient_email, recipient_name, subject, status) VALUES 
('990e8400-e29b-41d4-a716-446655440000', '880e8400-e29b-41d4-a716-446655440000', 'test1@example.com', '测试用户1', '测试邮件1', 'pending'),
('990e8400-e29b-41d4-a716-446655440001', '880e8400-e29b-41d4-a716-446655440000', 'test2@example.com', '测试用户2', '测试邮件2', 'pending'),
('990e8400-e29b-41d4-a716-446655440002', '880e8400-e29b-41d4-a716-446655440000', 'test3@example.com', '测试用户3', '测试邮件3', 'pending')
ON CONFLICT (id) DO NOTHING;

RAISE NOTICE '基础表结构创建完成，包含测试数据'; 