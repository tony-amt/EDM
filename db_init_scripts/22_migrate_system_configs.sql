-- 配置管理系统数据迁移脚本
-- Phase 2: 配置管理系统
-- 处理旧system_configs表与新表结构的兼容性

-- 1. 备份现有数据（如果存在）
DO $$
BEGIN
    -- 检查是否存在旧的system_configs表数据
    IF EXISTS (SELECT 1 FROM system_configs LIMIT 1) THEN
        -- 创建备份表
        CREATE TABLE IF NOT EXISTS system_configs_backup AS 
        SELECT * FROM system_configs;
        
        RAISE NOTICE '已备份现有system_configs数据到system_configs_backup表';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE '备份过程中出现问题: %', SQLERRM;
END $$;

-- 2. 验证新表结构是否正确
DO $$
DECLARE
    column_count INTEGER;
BEGIN
    -- 检查新表结构的关键字段
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns 
    WHERE table_name = 'system_configs' 
    AND column_name IN ('id', 'category', 'config_key', 'config_value', 'data_type', 'is_editable');
    
    IF column_count < 6 THEN
        RAISE EXCEPTION '新system_configs表结构不完整，缺少必要字段';
    END IF;
    
    RAISE NOTICE '新system_configs表结构验证通过';
END $$;

-- 3. 数据迁移验证
DO $$
DECLARE
    old_count INTEGER := 0;
    new_count INTEGER := 0;
BEGIN
    -- 统计数据量
    SELECT COUNT(*) INTO new_count FROM system_configs;
    
    -- 如果存在备份表，统计备份数据量
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_configs_backup') THEN
        SELECT COUNT(*) INTO old_count FROM system_configs_backup;
        RAISE NOTICE '备份表数据量: %, 新表数据量: %', old_count, new_count;
    END IF;
    
    -- 验证关键配置项是否存在
    IF NOT EXISTS (SELECT 1 FROM system_configs WHERE category = 'queue') THEN
        RAISE NOTICE '警告: 缺少queue分类的配置项';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM system_configs WHERE category = 'monitoring') THEN
        RAISE NOTICE '警告: 缺少monitoring分类的配置项';
    END IF;
    
    RAISE NOTICE '数据迁移验证完成';
END $$;

-- 4. 创建数据完整性检查函数
CREATE OR REPLACE FUNCTION check_config_integrity()
RETURNS TABLE(
    category_name VARCHAR,
    config_count BIGINT,
    missing_fields TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sc.category::VARCHAR as category_name,
        COUNT(*)::BIGINT as config_count,
        ARRAY_AGG(
            CASE 
                WHEN sc.config_value IS NULL OR sc.config_value = '' THEN 'config_value'
                WHEN sc.description IS NULL OR sc.description = '' THEN 'description'
                ELSE NULL
            END
        ) FILTER (WHERE 
            sc.config_value IS NULL OR sc.config_value = '' OR
            sc.description IS NULL OR sc.description = ''
        ) as missing_fields
    FROM system_configs sc
    GROUP BY sc.category
    ORDER BY sc.category;
END;
$$ LANGUAGE plpgsql;

-- 5. 运行完整性检查
SELECT * FROM check_config_integrity();

-- 6. 创建配置管理相关的视图
CREATE OR REPLACE VIEW v_editable_configs AS
SELECT 
    id,
    category,
    config_key,
    config_value,
    data_type,
    description,
    validation_rules,
    default_value,
    environment,
    updated_at,
    updated_by
FROM system_configs 
WHERE is_editable = true 
AND environment IN ('all', 'production')
ORDER BY category, config_key;

-- 7. 创建配置历史汇总视图
CREATE OR REPLACE VIEW v_config_change_summary AS
SELECT 
    sc.category,
    sc.config_key,
    sc.description,
    COUNT(cch.id) as change_count,
    MAX(cch.created_at) as last_changed,
    STRING_AGG(DISTINCT u.username, ', ') as changed_by_users
FROM system_configs sc
LEFT JOIN config_change_history cch ON sc.id = cch.config_id
LEFT JOIN users u ON cch.created_by = u.id
GROUP BY sc.id, sc.category, sc.config_key, sc.description
ORDER BY last_changed DESC NULLS LAST;

-- 8. 插入迁移记录
INSERT INTO config_change_history (
    id,
    config_id,
    change_type,
    old_value,
    new_value,
    change_reason,
    change_source,
    created_by
) 
SELECT 
    gen_random_uuid(),
    sc.id,
    'migration',
    'legacy_system',
    'new_config_system',
    'Phase 2: 配置管理系统迁移',
    'system_migration',
    (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
FROM system_configs sc
WHERE NOT EXISTS (
    SELECT 1 FROM config_change_history cch 
    WHERE cch.config_id = sc.id AND cch.change_type = 'migration'
);

-- 9. 创建配置监控触发器
CREATE OR REPLACE FUNCTION log_config_change()
RETURNS TRIGGER AS $$
BEGIN
    -- 记录配置变更到日志
    RAISE NOTICE '配置变更: %.% 从 "%" 变更为 "%"', 
        NEW.category, NEW.config_key, OLD.config_value, NEW.config_value;
    
    -- 如果是关键配置，发送通知
    IF NEW.category IN ('queue', 'monitoring', 'email') THEN
        RAISE NOTICE '关键配置变更通知: %.%', NEW.category, NEW.config_key;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS tr_system_config_change ON system_configs;
CREATE TRIGGER tr_system_config_change
    AFTER UPDATE OF config_value ON system_configs
    FOR EACH ROW
    WHEN (OLD.config_value IS DISTINCT FROM NEW.config_value)
    EXECUTE FUNCTION log_config_change();

-- 10. 最终验证和报告
DO $$
DECLARE
    total_configs INTEGER;
    total_categories INTEGER;
    total_changes INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_configs FROM system_configs;
    SELECT COUNT(DISTINCT category) INTO total_categories FROM system_configs;
    SELECT COUNT(*) INTO total_changes FROM config_change_history;
    
    RAISE NOTICE '=== 配置管理系统迁移完成 ===';
    RAISE NOTICE '总配置项数: %', total_configs;
    RAISE NOTICE '配置分类数: %', total_categories;
    RAISE NOTICE '变更历史记录数: %', total_changes;
    RAISE NOTICE '迁移时间: %', NOW();
    RAISE NOTICE '================================';
END $$;

-- 11. 清理函数（可选，用于清理备份表）
CREATE OR REPLACE FUNCTION cleanup_config_migration()
RETURNS VOID AS $$
BEGIN
    -- 谨慎使用：删除备份表
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_configs_backup') THEN
        DROP TABLE system_configs_backup;
        RAISE NOTICE '已清理备份表 system_configs_backup';
    END IF;
    
    -- 删除检查函数
    DROP FUNCTION IF EXISTS check_config_integrity();
    RAISE NOTICE '已清理迁移相关函数';
END;
$$ LANGUAGE plpgsql;

-- 注释：执行 SELECT cleanup_config_migration(); 来清理迁移相关的临时对象 