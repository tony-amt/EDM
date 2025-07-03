-- Phase 4数据类型修复脚本
-- 修复sub_tasks.service_id与email_services.id的数据类型不匹配问题
-- 执行时间：2025-07-03

\echo '🔧 开始修复sub_tasks.service_id数据类型不匹配问题...'

-- 1. 检查当前数据类型
\echo '📋 检查当前数据类型:'
SELECT 
    'email_services.id' as table_field,
    data_type as current_type
FROM information_schema.columns 
WHERE table_name = 'email_services' AND column_name = 'id'
UNION ALL
SELECT 
    'sub_tasks.service_id' as table_field,
    data_type as current_type
FROM information_schema.columns 
WHERE table_name = 'sub_tasks' AND column_name = 'service_id';

-- 2. 备份当前数据
\echo '💾 备份当前sub_tasks数据...'
CREATE TABLE sub_tasks_backup_20250703 AS 
SELECT * FROM sub_tasks;

-- 3. 检查是否有无效的service_id引用
\echo '🔍 检查无效的service_id引用:'
SELECT 
    st.id as subtask_id,
    st.service_id as invalid_service_id,
    st.status,
    st.recipient_email
FROM sub_tasks st
WHERE st.service_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM email_services es 
    WHERE es.id::text = st.service_id::text
  );

-- 4. 清除无效引用（如果有的话）
\echo '🧹 清除无效的service_id引用...'
UPDATE sub_tasks 
SET service_id = NULL 
WHERE service_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM email_services es 
    WHERE es.id::text = service_id::text
  );

-- 5. 删除外键约束（如果存在）
\echo '🔗 删除现有外键约束...'
DO $$ 
BEGIN
    -- 检查并删除外键约束
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'sub_tasks' 
          AND constraint_name LIKE '%service_id%'
          AND constraint_type = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE sub_tasks DROP CONSTRAINT IF EXISTS sub_tasks_service_id_fkey;
        RAISE NOTICE '✅ 外键约束已删除';
    END IF;
END $$;

-- 6. 修改数据类型
\echo '🔄 修改service_id数据类型从integer到UUID...'
ALTER TABLE sub_tasks 
ALTER COLUMN service_id TYPE UUID USING service_id::text::UUID;

-- 7. 重新创建外键约束
\echo '🔗 重新创建外键约束...'
ALTER TABLE sub_tasks 
ADD CONSTRAINT sub_tasks_service_id_fkey 
FOREIGN KEY (service_id) 
REFERENCES email_services(id) 
ON DELETE SET NULL;

-- 8. 验证修复结果
\echo '✅ 验证修复结果:'
SELECT 
    'email_services.id' as table_field,
    data_type as current_type
FROM information_schema.columns 
WHERE table_name = 'email_services' AND column_name = 'id'
UNION ALL
SELECT 
    'sub_tasks.service_id' as table_field,
    data_type as current_type
FROM information_schema.columns 
WHERE table_name = 'sub_tasks' AND column_name = 'service_id';

-- 9. 检查外键约束
\echo '🔍 检查外键约束状态:'
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'sub_tasks' 
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'service_id';

-- 10. 数据完整性验证
\echo '📊 数据完整性验证:'
SELECT 
    COUNT(*) as total_subtasks,
    COUNT(service_id) as subtasks_with_service,
    COUNT(DISTINCT service_id) as unique_services_assigned
FROM sub_tasks;

\echo '🎉 Phase 4数据类型修复完成!'
\echo '📋 备份表: sub_tasks_backup_20250703'
\echo '⚠️  请验证应用程序功能正常后再删除备份表'; 