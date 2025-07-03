-- 创建用户额度日志表
-- 记录用户额度变更历史

CREATE TABLE user_quota_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    operation_type VARCHAR(20) NOT NULL,
    amount INTEGER NOT NULL,
    balance_before INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 添加索引
CREATE INDEX idx_user_quota_logs_user_id ON user_quota_logs(user_id);
CREATE INDEX idx_user_quota_logs_campaign_id ON user_quota_logs(campaign_id);
CREATE INDEX idx_user_quota_logs_operation_type ON user_quota_logs(operation_type);
CREATE INDEX idx_user_quota_logs_created_at ON user_quota_logs(created_at);

-- 添加注释
COMMENT ON TABLE user_quota_logs IS '用户额度变更日志表';
COMMENT ON COLUMN user_quota_logs.id IS '日志唯一标识';
COMMENT ON COLUMN user_quota_logs.user_id IS '用户ID';
COMMENT ON COLUMN user_quota_logs.operation_type IS '操作类型：allocate/deduct/refund/cancel';
COMMENT ON COLUMN user_quota_logs.amount IS '变更数量（正数为增加，负数为减少）';
COMMENT ON COLUMN user_quota_logs.balance_before IS '操作前余额';
COMMENT ON COLUMN user_quota_logs.balance_after IS '操作后余额';
COMMENT ON COLUMN user_quota_logs.campaign_id IS '关联的群发任务ID';
COMMENT ON COLUMN user_quota_logs.reason IS '操作原因';
COMMENT ON COLUMN user_quota_logs.created_at IS '创建时间';

-- 添加约束
ALTER TABLE user_quota_logs ADD CONSTRAINT chk_quota_operation_type 
CHECK (operation_type IN ('allocate', 'deduct', 'refund', 'cancel'));

ALTER TABLE user_quota_logs ADD CONSTRAINT chk_quota_balance_positive 
CHECK (balance_before >= 0 AND balance_after >= 0); 