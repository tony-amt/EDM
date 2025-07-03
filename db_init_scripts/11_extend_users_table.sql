-- 扩展users表，添加角色和额度管理字段

-- 添加角色字段
ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user';

-- 添加剩余额度字段
ALTER TABLE users ADD COLUMN remaining_quota INTEGER DEFAULT 0;

-- 添加约束
ALTER TABLE users ADD CONSTRAINT chk_user_role 
CHECK (role IN ('admin', 'user'));

ALTER TABLE users ADD CONSTRAINT chk_remaining_quota_positive 
CHECK (remaining_quota >= 0);

-- 添加索引
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_remaining_quota ON users(remaining_quota);

-- 添加注释
COMMENT ON COLUMN users.role IS '用户角色：admin/user';
COMMENT ON COLUMN users.remaining_quota IS '剩余发信额度';

-- 设置默认管理员用户（如果存在admin用户，设置为管理员角色）
UPDATE users SET role = 'admin', remaining_quota = 10000 
WHERE username = 'admin'; 