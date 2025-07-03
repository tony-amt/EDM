-- 创建发信人表
-- 支持用户创建和删除发信人名称，用于组成发信地址

CREATE TABLE senders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(64) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 添加索引
CREATE INDEX idx_senders_user_id ON senders(user_id);
CREATE INDEX idx_senders_name ON senders(name);

-- 添加注释
COMMENT ON TABLE senders IS '发信人管理表';
COMMENT ON COLUMN senders.id IS '发信人唯一标识';
COMMENT ON COLUMN senders.name IS '发信人名称，用于组成发信地址，全系统唯一';
COMMENT ON COLUMN senders.user_id IS '创建用户ID';
COMMENT ON COLUMN senders.created_at IS '创建时间';
COMMENT ON COLUMN senders.updated_at IS '更新时间';

-- 添加约束：发信人名称格式验证（只能包含字母数字.-_，长度1-64字符）
ALTER TABLE senders ADD CONSTRAINT chk_sender_name_format 
CHECK (name ~ '^[a-zA-Z0-9._-]{1,64}$'); 