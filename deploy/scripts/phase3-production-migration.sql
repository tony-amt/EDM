-- Phase 3: 联系人标签JSONB优化 - 生产数据迁移脚本
-- 执行时间：2025-07-03
-- 目标：温和迁移contacts.tags字段到tags.contacts反向存储

-- ================================================
-- 阶段1: 数据一致性检查 (只读操作)
-- ================================================

-- 1.1 检查现有数据状况
DO $migration_check$
BEGIN
    RAISE NOTICE '=== Phase 3 生产迁移前数据检查 ===';
    
    -- 检查联系人总数
    RAISE NOTICE '联系人总数: %', (SELECT COUNT(*) FROM contacts);
    
    -- 检查有标签的联系人数量
    RAISE NOTICE '有标签的联系人数: %', (
        SELECT COUNT(*) FROM contacts 
        WHERE tags IS NOT NULL AND jsonb_array_length(tags) > 0
    );
    
    -- 检查标签总数
    RAISE NOTICE '标签总数: %', (SELECT COUNT(*) FROM tags);
    
    -- 检查tags表中已有contacts字段的数量
    RAISE NOTICE '已有contacts字段的标签数: %', (
        SELECT COUNT(*) FROM tags 
        WHERE contacts IS NOT NULL AND jsonb_array_length(contacts) > 0
    );
END $migration_check$;

-- ================================================
-- 阶段2: 备份现有数据 (安全措施)
-- ================================================

-- 2.1 创建备份表
CREATE TABLE IF NOT EXISTS contacts_backup_phase3 AS 
SELECT * FROM contacts WHERE tags IS NOT NULL;

CREATE TABLE IF NOT EXISTS tags_backup_phase3 AS 
SELECT * FROM tags;

-- ================================================
-- 阶段3: 数据迁移核心逻辑 (分批执行)
-- ================================================

-- 3.1 为tags表添加contacts字段 (如果不存在)
ALTER TABLE tags ADD COLUMN IF NOT EXISTS contacts JSONB DEFAULT '[]'::jsonb;

-- 3.2 分批迁移数据
DO $batch_migration$
DECLARE
    contact_record RECORD;
    tag_id UUID;
    batch_count INTEGER := 0;
    total_contacts INTEGER;
BEGIN
    -- 获取需要迁移的联系人总数
    SELECT COUNT(*) INTO total_contacts 
    FROM contacts 
    WHERE tags IS NOT NULL AND jsonb_array_length(tags) > 0;
    
    RAISE NOTICE '开始迁移 % 个有标签的联系人...', total_contacts;
    
    -- 遍历每个有标签的联系人
    FOR contact_record IN 
        SELECT id, tags, email
        FROM contacts 
        WHERE tags IS NOT NULL AND jsonb_array_length(tags) > 0
        ORDER BY created_at
    LOOP
        -- 为该联系人的每个标签更新contacts字段
        FOR tag_id IN 
            SELECT (jsonb_array_elements_text(contact_record.tags))::UUID
        LOOP
            -- 检查标签是否存在
            IF EXISTS (SELECT 1 FROM tags WHERE id = tag_id) THEN
                -- 更新标签的contacts字段，添加当前联系人ID
                UPDATE tags SET 
                    contacts = CASE 
                        WHEN contacts @> jsonb_build_array(contact_record.id) THEN contacts
                        ELSE contacts || jsonb_build_array(contact_record.id)
                    END
                WHERE id = tag_id;
            END IF;
        END LOOP;
        
        batch_count := batch_count + 1;
        
        -- 每100个联系人提交一次
        IF batch_count % 100 = 0 THEN
            RAISE NOTICE '已处理 % / % 个联系人', batch_count, total_contacts;
        END IF;
    END LOOP;
    
    RAISE NOTICE '数据迁移完成，共处理 % 个联系人', batch_count;
END $batch_migration$;

-- ================================================
-- 阶段4: 创建索引优化查询性能
-- ================================================

-- 4.1 为tags.contacts字段创建GIN索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tags_contacts_gin 
ON tags USING GIN (contacts);

-- 显示最终状态
SELECT 
    'Phase 3 迁移完成' as status,
    COUNT(*) as total_tags_with_contacts
FROM tags 
WHERE jsonb_array_length(contacts) > 0;
