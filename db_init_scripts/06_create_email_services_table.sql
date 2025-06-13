-- 创建发信服务表
-- 管理第三方邮件服务提供商的配置信息

CREATE TABLE email_services (
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
    frozen_until TIMESTAMP WITH TIME ZONE NULL,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 添加索引
CREATE INDEX idx_email_services_provider ON email_services(provider);
CREATE INDEX idx_email_services_enabled ON email_services(is_enabled);
CREATE INDEX idx_email_services_frozen ON email_services(is_frozen);
CREATE INDEX idx_email_services_domain ON email_services(domain);

-- 添加注释
COMMENT ON TABLE email_services IS '发信服务配置表';
COMMENT ON COLUMN email_services.id IS '服务唯一标识';
COMMENT ON COLUMN email_services.name IS '服务名称';
COMMENT ON COLUMN email_services.provider IS '服务提供商：engagelab等';
COMMENT ON COLUMN email_services.api_key IS '服务API密钥';
COMMENT ON COLUMN email_services.api_secret IS '服务API密钥';
COMMENT ON COLUMN email_services.domain IS '发信域名';
COMMENT ON COLUMN email_services.daily_quota IS '每日发信额度';
COMMENT ON COLUMN email_services.used_quota IS '已使用额度';
COMMENT ON COLUMN email_services.sending_rate IS '发信频率（邮件/分钟）';
COMMENT ON COLUMN email_services.quota_reset_time IS '额度重置时间';
COMMENT ON COLUMN email_services.is_enabled IS '是否启用';
COMMENT ON COLUMN email_services.is_frozen IS '是否冻结';
COMMENT ON COLUMN email_services.frozen_until IS '冻结到期时间';
COMMENT ON COLUMN email_services.consecutive_failures IS '连续失败次数';
COMMENT ON COLUMN email_services.created_at IS '创建时间';
COMMENT ON COLUMN email_services.updated_at IS '更新时间';

-- 添加约束
ALTER TABLE email_services ADD CONSTRAINT chk_daily_quota_positive 
CHECK (daily_quota >= 0);

ALTER TABLE email_services ADD CONSTRAINT chk_used_quota_valid 
CHECK (used_quota >= 0 AND used_quota <= daily_quota);

ALTER TABLE email_services ADD CONSTRAINT chk_sending_rate_positive 
CHECK (sending_rate > 0);

ALTER TABLE email_services ADD CONSTRAINT chk_consecutive_failures_positive 
CHECK (consecutive_failures >= 0); 