-- 创建服务状态日志表
-- 记录发信服务状态变更历史

CREATE TABLE service_status_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES email_services(id) ON DELETE CASCADE,
    status_type VARCHAR(20) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    reason TEXT,
    operator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 添加索引
CREATE INDEX idx_service_status_logs_service_id ON service_status_logs(service_id);
CREATE INDEX idx_service_status_logs_status_type ON service_status_logs(status_type);
CREATE INDEX idx_service_status_logs_operator_id ON service_status_logs(operator_id);
CREATE INDEX idx_service_status_logs_created_at ON service_status_logs(created_at);

-- 添加注释
COMMENT ON TABLE service_status_logs IS '发信服务状态变更日志表';
COMMENT ON COLUMN service_status_logs.id IS '日志唯一标识';
COMMENT ON COLUMN service_status_logs.service_id IS '发信服务ID';
COMMENT ON COLUMN service_status_logs.status_type IS '状态类型：enabled/frozen/quota_reset/failure';
COMMENT ON COLUMN service_status_logs.old_value IS '变更前的值';
COMMENT ON COLUMN service_status_logs.new_value IS '变更后的值';
COMMENT ON COLUMN service_status_logs.reason IS '变更原因';
COMMENT ON COLUMN service_status_logs.operator_id IS '操作人ID（系统操作时为NULL）';
COMMENT ON COLUMN service_status_logs.created_at IS '创建时间';

-- 添加约束
ALTER TABLE service_status_logs ADD CONSTRAINT chk_service_status_type 
CHECK (status_type IN ('enabled', 'frozen', 'quota_reset', 'failure', 'config_update')); 