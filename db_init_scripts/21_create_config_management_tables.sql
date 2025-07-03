-- =====================================================
-- 配置管理系统数据库表 - Phase 2
-- 创建时间: 2025-07-02
-- 版本: v1.0
-- =====================================================

-- 1. 系统配置表 (system_configs)
CREATE TABLE IF NOT EXISTS system_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(100) NOT NULL,                    -- 配置分类 (email, queue, monitoring, etc.)
    config_key VARCHAR(200) NOT NULL,                  -- 配置键名
    config_value TEXT NOT NULL,                        -- 配置值 (JSON格式)
    data_type VARCHAR(50) NOT NULL DEFAULT 'string',   -- 数据类型 (string, number, boolean, json, array)
    description TEXT,                                   -- 配置描述
    is_sensitive BOOLEAN DEFAULT FALSE,                -- 是否敏感信息
    is_editable BOOLEAN DEFAULT TRUE,                  -- 是否可编辑
    validation_rules JSONB,                            -- 验证规则 (JSON格式)
    default_value TEXT,                                -- 默认值
    environment VARCHAR(50) DEFAULT 'all',             -- 环境限制 (all, development, production)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    
    -- 唯一约束: 同一分类下的配置键名不能重复
    UNIQUE(category, config_key, environment)
);

-- 2. 配置变更历史表 (config_change_history)
CREATE TABLE IF NOT EXISTS config_change_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES system_configs(id) ON DELETE CASCADE,
    change_type VARCHAR(50) NOT NULL,                  -- 变更类型 (create, update, delete)
    old_value TEXT,                                    -- 原值
    new_value TEXT,                                    -- 新值
    change_reason TEXT,                                -- 变更原因
    change_source VARCHAR(100) DEFAULT 'manual',       -- 变更来源 (manual, api, system)
    ip_address INET,                                   -- 操作IP地址
    user_agent TEXT,                                   -- 用户代理
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- 3. 配置模板表 (config_templates)
CREATE TABLE IF NOT EXISTS config_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(200) NOT NULL UNIQUE,       -- 模板名称
    template_description TEXT,                         -- 模板描述
    category VARCHAR(100) NOT NULL,                    -- 所属分类
    template_config JSONB NOT NULL,                    -- 模板配置 (JSON格式)
    is_active BOOLEAN DEFAULT TRUE,                    -- 是否激活
    version VARCHAR(50) DEFAULT '1.0.0',              -- 模板版本
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- 4. 配置分类表 (config_categories)
CREATE TABLE IF NOT EXISTS config_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_name VARCHAR(100) NOT NULL UNIQUE,       -- 分类名称
    category_display_name VARCHAR(200) NOT NULL,      -- 显示名称
    category_description TEXT,                         -- 分类描述
    category_icon VARCHAR(100),                        -- 分类图标
    sort_order INTEGER DEFAULT 0,                     -- 排序顺序
    parent_category_id UUID REFERENCES config_categories(id), -- 父分类ID
    is_system BOOLEAN DEFAULT FALSE,                   -- 系统分类(不可删除)
    is_active BOOLEAN DEFAULT TRUE,                    -- 是否激活
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. 配置权限表 (config_permissions)
CREATE TABLE IF NOT EXISTS config_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,                    -- 配置分类
    permission_type VARCHAR(50) NOT NULL,              -- 权限类型 (read, write, admin)
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    granted_by UUID REFERENCES users(id),
    expires_at TIMESTAMP WITH TIME ZONE,               -- 权限过期时间
    is_active BOOLEAN DEFAULT TRUE,                    -- 是否激活
    
    -- 唯一约束: 用户在同一分类下的同一权限类型只能有一条记录
    UNIQUE(user_id, category, permission_type)
);

-- =====================================================
-- 索引优化
-- =====================================================

-- system_configs 表索引
CREATE INDEX IF NOT EXISTS idx_system_configs_category ON system_configs(category);
CREATE INDEX IF NOT EXISTS idx_system_configs_key ON system_configs(config_key);
CREATE INDEX IF NOT EXISTS idx_system_configs_environment ON system_configs(environment);
CREATE INDEX IF NOT EXISTS idx_system_configs_sensitive ON system_configs(is_sensitive);
CREATE INDEX IF NOT EXISTS idx_system_configs_editable ON system_configs(is_editable);
CREATE INDEX IF NOT EXISTS idx_system_configs_updated_at ON system_configs(updated_at);

-- config_change_history 表索引
CREATE INDEX IF NOT EXISTS idx_config_history_config_id ON config_change_history(config_id);
CREATE INDEX IF NOT EXISTS idx_config_history_created_at ON config_change_history(created_at);
CREATE INDEX IF NOT EXISTS idx_config_history_created_by ON config_change_history(created_by);

-- config_templates 表索引
CREATE INDEX IF NOT EXISTS idx_config_templates_category ON config_templates(category);
CREATE INDEX IF NOT EXISTS idx_config_templates_active ON config_templates(is_active);

-- config_categories 表索引
CREATE INDEX IF NOT EXISTS idx_config_categories_active ON config_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_config_categories_parent ON config_categories(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_config_categories_sort ON config_categories(sort_order);

-- config_permissions 表索引
CREATE INDEX IF NOT EXISTS idx_config_permissions_user ON config_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_config_permissions_category ON config_permissions(category);
CREATE INDEX IF NOT EXISTS idx_config_permissions_active ON config_permissions(is_active);

-- =====================================================
-- 初始化数据
-- =====================================================

-- 插入系统默认配置分类
INSERT INTO config_categories (category_name, category_display_name, category_description, category_icon, sort_order, is_system) VALUES
('email', '邮件配置', '邮件发送相关配置', 'mail', 1, TRUE),
('queue', '队列配置', '任务队列相关配置', 'clock', 2, TRUE),
('monitoring', '监控配置', '系统监控相关配置', 'activity', 3, TRUE),
('security', '安全配置', '系统安全相关配置', 'shield', 4, TRUE),
('performance', '性能配置', '系统性能相关配置', 'zap', 5, TRUE),
('notification', '通知配置', '系统通知相关配置', 'bell', 6, TRUE),
('api', 'API配置', 'API接口相关配置', 'code', 7, TRUE),
('database', '数据库配置', '数据库相关配置', 'database', 8, TRUE),
('cache', '缓存配置', '缓存系统相关配置', 'layers', 9, TRUE),
('logging', '日志配置', '日志记录相关配置', 'file-text', 10, TRUE)
ON CONFLICT (category_name) DO NOTHING;

-- 插入系统默认配置
INSERT INTO system_configs (category, config_key, config_value, data_type, description, is_sensitive, is_editable, validation_rules, default_value) VALUES
-- 邮件配置
('email', 'max_send_rate', '1000', 'number', '每小时最大发送邮件数', FALSE, TRUE, '{"min": 100, "max": 10000}', '1000'),
('email', 'retry_attempts', '3', 'number', '发送失败重试次数', FALSE, TRUE, '{"min": 1, "max": 10}', '3'),
('email', 'retry_delay', '300', 'number', '重试延迟时间(秒)', FALSE, TRUE, '{"min": 60, "max": 3600}', '300'),
('email', 'batch_size', '100', 'number', '批量发送邮件数量', FALSE, TRUE, '{"min": 10, "max": 1000}', '100'),

-- 队列配置
('queue', 'max_concurrent_tasks', '10', 'number', '最大并发任务数', FALSE, TRUE, '{"min": 1, "max": 100}', '10'),
('queue', 'task_timeout', '3600', 'number', '任务超时时间(秒)', FALSE, TRUE, '{"min": 300, "max": 86400}', '3600'),
('queue', 'cleanup_interval', '86400', 'number', '清理间隔时间(秒)', FALSE, TRUE, '{"min": 3600, "max": 604800}', '86400'),
('queue', 'max_retries', '3', 'number', '最大重试次数', FALSE, TRUE, '{"min": 0, "max": 10}', '3'),

-- 监控配置
('monitoring', 'metrics_retention_days', '30', 'number', '监控指标保留天数', FALSE, TRUE, '{"min": 7, "max": 365}', '30'),
('monitoring', 'alert_cooldown', '300', 'number', '告警冷却时间(秒)', FALSE, TRUE, '{"min": 60, "max": 3600}', '300'),
('monitoring', 'health_check_interval', '60', 'number', '健康检查间隔(秒)', FALSE, TRUE, '{"min": 30, "max": 300}', '60'),
('monitoring', 'performance_sampling_rate', '0.1', 'number', '性能采样率', FALSE, TRUE, '{"min": 0.01, "max": 1.0}', '0.1'),

-- 安全配置
('security', 'session_timeout', '3600', 'number', '会话超时时间(秒)', FALSE, TRUE, '{"min": 900, "max": 86400}', '3600'),
('security', 'max_login_attempts', '5', 'number', '最大登录尝试次数', FALSE, TRUE, '{"min": 3, "max": 20}', '5'),
('security', 'password_min_length', '8', 'number', '密码最小长度', FALSE, TRUE, '{"min": 6, "max": 32}', '8'),
('security', 'enable_2fa', 'false', 'boolean', '启用双因子认证', FALSE, TRUE, NULL, 'false')

ON CONFLICT (category, config_key, environment) DO NOTHING;

-- =====================================================
-- 权限和约束
-- =====================================================

-- 添加更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为相关表添加更新时间触发器
CREATE TRIGGER update_system_configs_updated_at BEFORE UPDATE ON system_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_config_templates_updated_at BEFORE UPDATE ON config_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_config_categories_updated_at BEFORE UPDATE ON config_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 添加注释
COMMENT ON TABLE system_configs IS '系统配置表 - 存储系统各种配置项';
COMMENT ON TABLE config_change_history IS '配置变更历史表 - 记录所有配置变更历史';
COMMENT ON TABLE config_templates IS '配置模板表 - 存储配置模板';
COMMENT ON TABLE config_categories IS '配置分类表 - 配置分类管理';
COMMENT ON TABLE config_permissions IS '配置权限表 - 配置访问权限控制';

-- =====================================================
-- 完成提示
-- =====================================================
SELECT 'Phase 2 配置管理系统数据库表创建完成!' as message; 