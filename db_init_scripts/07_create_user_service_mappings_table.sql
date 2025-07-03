-- 创建用户服务关联表
-- 管理用户可以使用哪些发信服务

CREATE TABLE user_service_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES email_services(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- 确保用户和服务的组合唯一
    UNIQUE(user_id, service_id)
);

-- 添加索引
CREATE INDEX idx_user_service_mappings_user_id ON user_service_mappings(user_id);
CREATE INDEX idx_user_service_mappings_service_id ON user_service_mappings(service_id);
CREATE INDEX idx_user_service_mappings_active ON user_service_mappings(is_active);

-- 添加注释
COMMENT ON TABLE user_service_mappings IS '用户发信服务关联表';
COMMENT ON COLUMN user_service_mappings.id IS '关联唯一标识';
COMMENT ON COLUMN user_service_mappings.user_id IS '用户ID';
COMMENT ON COLUMN user_service_mappings.service_id IS '发信服务ID';
COMMENT ON COLUMN user_service_mappings.is_active IS '是否激活';
COMMENT ON COLUMN user_service_mappings.created_at IS '创建时间';
COMMENT ON COLUMN user_service_mappings.updated_at IS '更新时间'; 