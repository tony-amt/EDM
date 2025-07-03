-- 数据库结构调整脚本
-- 执行前请先备份数据库

BEGIN;

-- 1. 删除已废弃的表（如果存在）
DROP TABLE IF EXISTS template_set_items CASCADE;
DROP TABLE IF EXISTS template_sets CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;

-- 删除已迁移到JSONB字段的关联表
DROP TABLE IF EXISTS contact_tags CASCADE;
DROP TABLE IF EXISTS task_contacts CASCADE;
DROP TABLE IF EXISTS task_templates CASCADE;

-- 2. 修改email_templates表
-- 删除不需要的字段
ALTER TABLE email_templates 
    DROP COLUMN IF EXISTS text_content,
    DROP COLUMN IF EXISTS category,
    DROP COLUMN IF EXISTS is_public;

-- 删除不需要的索引
DROP INDEX IF EXISTS idx_email_templates_category;
DROP INDEX IF EXISTS idx_email_templates_is_public;

-- 3. 修改contacts表，增加tags字段
ALTER TABLE contacts 
    ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

-- 添加tags字段的注释
COMMENT ON COLUMN contacts.tags IS '联系人关联的标签ID数组';

-- 4. 修改tags表，增加contacts字段
ALTER TABLE tags 
    ADD COLUMN IF NOT EXISTS contacts JSONB DEFAULT '[]'::jsonb;

-- 添加contacts字段的注释
COMMENT ON COLUMN tags.contacts IS '标签关联的联系人ID数组';

-- 5. 修改tasks表，增加新字段
ALTER TABLE tasks 
    ADD COLUMN IF NOT EXISTS contacts JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS templates JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS total_opens INTEGER DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS total_clicks INTEGER DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS total_errors INTEGER DEFAULT 0 NOT NULL;

-- 添加字段注释
COMMENT ON COLUMN tasks.contacts IS '任务关联的联系人ID数组';
COMMENT ON COLUMN tasks.templates IS '任务关联的模板ID数组';
COMMENT ON COLUMN tasks.total_opens IS '累计打开数';
COMMENT ON COLUMN tasks.total_clicks IS '累计点击数';
COMMENT ON COLUMN tasks.total_errors IS '累计错误数';

-- 6. 创建数据迁移函数：将contact_tags数据迁移到contacts.tags字段
CREATE OR REPLACE FUNCTION migrate_contact_tags() RETURNS void AS $$
DECLARE
    contact_record RECORD;
    tag_array JSONB;
BEGIN
    -- 遍历所有联系人
    FOR contact_record IN 
        SELECT c.id as contact_id, 
               COALESCE(json_agg(ct.tag_id) FILTER (WHERE ct.tag_id IS NOT NULL), '[]'::json) as tag_ids
        FROM contacts c
        LEFT JOIN contact_tags ct ON c.id = ct.contact_id
        GROUP BY c.id
    LOOP
        -- 更新联系人的tags字段
        UPDATE contacts 
        SET tags = contact_record.tag_ids::jsonb 
        WHERE id = contact_record.contact_id;
    END LOOP;
    
    RAISE NOTICE '联系人标签数据迁移完成';
END;
$$ LANGUAGE plpgsql;

-- 7. 创建数据迁移函数：将contact_tags数据迁移到tags.contacts字段
CREATE OR REPLACE FUNCTION migrate_tag_contacts() RETURNS void AS $$
DECLARE
    tag_record RECORD;
    contact_array JSONB;
BEGIN
    -- 遍历所有标签
    FOR tag_record IN 
        SELECT t.id as tag_id, 
               COALESCE(json_agg(ct.contact_id) FILTER (WHERE ct.contact_id IS NOT NULL), '[]'::json) as contact_ids
        FROM tags t
        LEFT JOIN contact_tags ct ON t.id = ct.tag_id
        GROUP BY t.id
    LOOP
        -- 更新标签的contacts字段
        UPDATE tags 
        SET contacts = tag_record.contact_ids::jsonb 
        WHERE id = tag_record.tag_id;
    END LOOP;
    
    RAISE NOTICE '标签联系人数据迁移完成';
END;
$$ LANGUAGE plpgsql;

-- 8. 创建数据迁移函数：将task_contacts数据迁移到tasks.contacts字段
CREATE OR REPLACE FUNCTION migrate_task_contacts() RETURNS void AS $$
DECLARE
    task_record RECORD;
    contact_array JSONB;
BEGIN
    -- 遍历所有任务
    FOR task_record IN 
        SELECT t.id as task_id, 
               COALESCE(json_agg(tc.contact_id) FILTER (WHERE tc.contact_id IS NOT NULL), '[]'::json) as contact_ids
        FROM tasks t
        LEFT JOIN task_contacts tc ON t.id = tc.task_id
        GROUP BY t.id
    LOOP
        -- 更新任务的contacts字段
        UPDATE tasks 
        SET contacts = task_record.contact_ids::jsonb 
        WHERE id = task_record.task_id;
    END LOOP;
    
    RAISE NOTICE '任务联系人数据迁移完成';
END;
$$ LANGUAGE plpgsql;

-- 9. 创建数据迁移函数：将task_templates数据迁移到tasks.templates字段
CREATE OR REPLACE FUNCTION migrate_task_templates() RETURNS void AS $$
DECLARE
    task_record RECORD;
    template_array JSONB;
BEGIN
    -- 遍历所有任务
    FOR task_record IN 
        SELECT t.id as task_id, 
               COALESCE(json_agg(tt.template_id) FILTER (WHERE tt.template_id IS NOT NULL), '[]'::json) as template_ids
        FROM tasks t
        LEFT JOIN task_templates tt ON t.id = tt.task_id
        GROUP BY t.id
    LOOP
        -- 更新任务的templates字段
        UPDATE tasks 
        SET templates = task_record.template_ids::jsonb 
        WHERE id = task_record.task_id;
    END LOOP;
    
    RAISE NOTICE '任务模板数据迁移完成';
END;
$$ LANGUAGE plpgsql;

-- 10. 创建SubTask汇总统计触发器函数
CREATE OR REPLACE FUNCTION update_task_stats() RETURNS TRIGGER AS $$
BEGIN
    -- 根据操作类型更新统计
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- 更新任务的汇总统计
        UPDATE tasks SET
            total_opens = (
                SELECT COALESCE(SUM(opens), 0) 
                FROM sub_tasks 
                WHERE task_id = NEW.task_id
            ),
            total_clicks = (
                SELECT COALESCE(SUM(clicks), 0) 
                FROM sub_tasks 
                WHERE task_id = NEW.task_id
            ),
            total_errors = (
                SELECT COUNT(*) 
                FROM sub_tasks 
                WHERE task_id = NEW.task_id AND status = 'failed'
            )
        WHERE id = NEW.task_id;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- 删除后重新计算统计
        UPDATE tasks SET
            total_opens = (
                SELECT COALESCE(SUM(opens), 0) 
                FROM sub_tasks 
                WHERE task_id = OLD.task_id
            ),
            total_clicks = (
                SELECT COALESCE(SUM(clicks), 0) 
                FROM sub_tasks 
                WHERE task_id = OLD.task_id
            ),
            total_errors = (
                SELECT COUNT(*) 
                FROM sub_tasks 
                WHERE task_id = OLD.task_id AND status = 'failed'
            )
        WHERE id = OLD.task_id;
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_update_task_stats ON sub_tasks;
CREATE TRIGGER trigger_update_task_stats
    AFTER INSERT OR UPDATE OR DELETE ON sub_tasks
    FOR EACH ROW EXECUTE FUNCTION update_task_stats();

COMMIT;

-- 注意：请手动执行以下数据迁移函数（在事务外执行）：
-- SELECT migrate_contact_tags();
-- SELECT migrate_tag_contacts();
-- SELECT migrate_task_contacts();
-- SELECT migrate_task_templates();

-- 数据迁移完成后，删除废弃的关联表（请在确认数据迁移成功后执行）：
-- DROP TABLE IF EXISTS contact_tags CASCADE;
-- DROP TABLE IF EXISTS task_contacts CASCADE;
-- DROP TABLE IF EXISTS task_templates CASCADE; 