-- 创建系统配置表
CREATE TABLE IF NOT EXISTS system_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    description VARCHAR(500),
    category VARCHAR(50) DEFAULT 'system',
    is_active BOOLEAN NOT NULL DEFAULT true,
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_system_configs_key ON system_configs(config_key);
CREATE INDEX IF NOT EXISTS idx_system_configs_category ON system_configs(category);
CREATE INDEX IF NOT EXISTS idx_system_configs_active ON system_configs(is_active);

-- 添加外键约束
ALTER TABLE system_configs 
ADD CONSTRAINT fk_system_configs_updated_by 
FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

-- 插入默认配置
INSERT INTO system_configs (config_key, config_value, description, category) VALUES
('queue_batch_size', '10', '每批处理的邮件数量', 'queue'),
('queue_interval_seconds', '5', '队列处理间隔（秒）', 'queue'),
('scheduled_check_interval', '30', '定时任务检查间隔（秒）', 'queue'),
('max_retry_attempts', '3', '邮件发送最大重试次数', 'mail')
ON CONFLICT (config_key) DO NOTHING;

-- 添加表注释
COMMENT ON TABLE system_configs IS '系统配置参数表';
COMMENT ON COLUMN system_configs.config_key IS '配置参数键名';
COMMENT ON COLUMN system_configs.config_value IS '配置参数值（JSON格式）';
COMMENT ON COLUMN system_configs.description IS '配置参数描述';
COMMENT ON COLUMN system_configs.category IS '配置分类：system, queue, mail, performance等';
COMMENT ON COLUMN system_configs.is_active IS '是否启用该配置';
COMMENT ON COLUMN system_configs.updated_by IS '最后更新人ID'; 