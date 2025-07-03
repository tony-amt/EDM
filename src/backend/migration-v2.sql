-- V2.0 EDM系统数据库架构迁移脚本
-- 将V1.0架构升级到V2.0架构

-- 1. 修改tasks表，移除email_service_id，添加V2.0字段
ALTER TABLE tasks DROP COLUMN IF EXISTS email_service_id;

-- 添加V2.0调度字段
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0;

-- 添加V2.0统计字段
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS total_subtasks INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS allocated_subtasks INTEGER NOT NULL DEFAULT 0;  
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pending_subtasks INTEGER NOT NULL DEFAULT 0;

-- 添加V2.0索引
CREATE INDEX IF NOT EXISTS tasks_scheduled_at ON tasks (scheduled_at);
CREATE INDEX IF NOT EXISTS tasks_priority ON tasks (priority);
CREATE INDEX IF NOT EXISTS tasks_status ON tasks (status);
CREATE INDEX IF NOT EXISTS tasks_created_by ON tasks (created_by);

-- 2. 修改sub_tasks表，添加V2.0核心字段
ALTER TABLE sub_tasks ADD COLUMN IF NOT EXISTS service_id UUID;
ALTER TABLE sub_tasks ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE sub_tasks ADD COLUMN IF NOT EXISTS allocated_quota INTEGER;
ALTER TABLE sub_tasks ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0;

-- 修改sub_tasks状态枚举，添加allocated状态
DO $$
BEGIN
    -- 检查枚举类型是否存在allocated值
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'allocated' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_sub_tasks_status')
    ) THEN
        ALTER TYPE enum_sub_tasks_status ADD VALUE 'allocated' AFTER 'pending';
    END IF;
    
    -- 检查枚举类型是否存在sending值
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'sending' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_sub_tasks_status')
    ) THEN
        ALTER TYPE enum_sub_tasks_status ADD VALUE 'sending' AFTER 'allocated';
    END IF;
END$$;

-- 添加外键约束
DO $$
BEGIN
    -- 添加service_id外键约束
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'sub_tasks_service_id_fkey'
    ) THEN
        ALTER TABLE sub_tasks 
        ADD CONSTRAINT sub_tasks_service_id_fkey 
        FOREIGN KEY (service_id) REFERENCES email_services(id) ON UPDATE CASCADE;
    END IF;
END$$;

-- 添加V2.0索引
CREATE INDEX IF NOT EXISTS sub_tasks_service_id ON sub_tasks (service_id);
CREATE INDEX IF NOT EXISTS sub_tasks_scheduled_at ON sub_tasks (scheduled_at);
CREATE INDEX IF NOT EXISTS sub_tasks_priority ON sub_tasks (priority);

-- 3. 更新summary_stats结构为V2.0格式
UPDATE tasks SET summary_stats = jsonb_build_object(
    'total_recipients', 0,
    'pending', 0,
    'allocated', 0,
    'sending', 0,
    'sent', 0,
    'delivered', 0,
    'bounced', 0,
    'opened', 0,
    'clicked', 0,
    'failed', 0
) WHERE summary_stats IS NULL OR summary_stats = '{}'::jsonb;

-- 4. 添加字段注释
COMMENT ON COLUMN tasks.scheduled_at IS 'V2.0调度器使用的调度时间';
COMMENT ON COLUMN tasks.priority IS 'V2.0任务优先级，数字越大优先级越高';
COMMENT ON COLUMN tasks.total_subtasks IS 'V2.0总SubTask数量';
COMMENT ON COLUMN tasks.allocated_subtasks IS 'V2.0已分配发信服务的SubTask数量';
COMMENT ON COLUMN tasks.pending_subtasks IS 'V2.0待分配发信服务的SubTask数量';

COMMENT ON COLUMN sub_tasks.service_id IS 'V2.0按需分配的发信服务ID';
COMMENT ON COLUMN sub_tasks.scheduled_at IS 'V2.0调度时间';
COMMENT ON COLUMN sub_tasks.allocated_quota IS 'V2.0分配的额度';
COMMENT ON COLUMN sub_tasks.priority IS 'V2.0优先级，数字越大优先级越高';

-- 5. 数据完整性检查
DO $$
DECLARE
    task_count INTEGER;
    subtask_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO task_count FROM tasks;
    SELECT COUNT(*) INTO subtask_count FROM sub_tasks;
    
    RAISE NOTICE 'V2.0迁移完成统计:';
    RAISE NOTICE '- Tasks表记录数: %', task_count;
    RAISE NOTICE '- SubTasks表记录数: %', subtask_count;
    RAISE NOTICE '- 所有V2.0字段已添加';
    RAISE NOTICE '- 所有V2.0索引已创建';
    RAISE NOTICE '- 数据库架构升级到V2.0完成！';
END$$; 