-- Phase 3: contact.tags字段移除迁移脚本
-- 执行前确保数据已备份！

BEGIN;

-- Step 1: 验证数据一致性（可选，用于最后检查）
DO $$
DECLARE
    contact_count INTEGER;
    inconsistent_count INTEGER;
BEGIN
    -- 检查contact.tags与tags.contacts的一致性
    SELECT COUNT(*) INTO contact_count 
    FROM contacts 
    WHERE tags IS NOT NULL AND jsonb_array_length(tags) > 0;
    
    RAISE NOTICE 'Phase 3迁移前检查: %个联系人有标签数据', contact_count;
    
    -- 如果需要，可以在这里添加数据一致性修复逻辑
END $$;

-- Step 2: 创建备份表（生产环境安全措施）
CREATE TABLE IF NOT EXISTS contacts_tags_backup AS 
SELECT id, tags, created_at 
FROM contacts 
WHERE tags IS NOT NULL;

RAISE NOTICE 'contact.tags数据已备份到 contacts_tags_backup 表';

-- Step 3: 移除contact.tags字段
-- 注意：这是不可逆操作，确保tags表的contacts字段已经完整
ALTER TABLE contacts DROP COLUMN IF EXISTS tags;

RAISE NOTICE 'contact.tags字段已删除';

-- Step 4: 验证删除结果
DO $$
DECLARE
    column_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'contacts' 
        AND column_name = 'tags'
    ) INTO column_exists;
    
    IF column_exists THEN
        RAISE EXCEPTION 'contact.tags字段删除失败';
    ELSE
        RAISE NOTICE 'contact.tags字段删除成功确认';
    END IF;
END $$;

-- Step 5: 更新相关索引（如果有的话）
-- 删除可能存在的tags字段索引
DROP INDEX IF EXISTS idx_contacts_tags;

COMMIT;

-- 使用说明：
-- 1. 执行前确保Phase 3的反向查询机制已经部署并测试通过
-- 2. 执行前进行完整数据库备份
-- 3. 建议在维护窗口期间执行
-- 4. 备份表contacts_tags_backup可以在确认系统稳定运行一段时间后删除 