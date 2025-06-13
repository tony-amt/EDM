# 数据库结构重构总结

## 📋 重构概述

本次数据库重构主要目的是简化数据结构，提高查询效率，减少关联表的复杂性。

## 🗑️ 删除的表和字段

### 1. 删除的表
- `template_set_items` - 模板集项目表（已废弃）
- `template_sets` - 模板集表（已废弃）
- `campaigns` - 营销活动表（暂时移除，后续重新设计）

### 2. 删除的字段

#### `email_templates` 表
- `text_content` - 文本内容字段（与body字段重复）
- `category` - 分类字段（业务中未使用）
- `is_public` - 公开状态字段（业务中未使用）

## ➕ 新增的字段

### 1. `contacts` 表
```sql
tags JSONB DEFAULT '[]'::jsonb -- 联系人关联的标签ID数组
```

### 2. `tags` 表
```sql
contacts JSONB DEFAULT '[]'::jsonb -- 标签关联的联系人ID数组
```

### 3. `tasks` 表
```sql
contacts JSONB DEFAULT '[]'::jsonb,     -- 任务关联的联系人ID数组
templates JSONB DEFAULT '[]'::jsonb,   -- 任务关联的模板ID数组
total_opens INTEGER DEFAULT 0,         -- 累计打开数
total_clicks INTEGER DEFAULT 0,        -- 累计点击数
total_errors INTEGER DEFAULT 0         -- 累计错误数
```

## 🔄 数据迁移策略

### 1. 联系人标签关系迁移
- 从 `contact_tags` 表迁移到 `contacts.tags` 和 `tags.contacts` 字段
- 使用迁移函数：`migrate_contact_tags()` 和 `migrate_tag_contacts()`

### 2. 任务关联关系迁移
- 从 `task_contacts` 表迁移到 `tasks.contacts` 字段
- 从 `task_templates` 表迁移到 `tasks.templates` 字段
- 使用迁移函数：`migrate_task_contacts()` 和 `migrate_task_templates()`

## 🛠️ 新增的辅助工具

### 1. ContactTagManager (`src/backend/src/utils/contactTagManager.js`)
- `setContactTags()` - 设置联系人标签
- `cleanupContactFromTags()` - 清理联系人标签关联
- `cleanupTagFromContacts()` - 清理标签联系人关联
- `getContactTagDetails()` - 获取联系人标签详情
- `getTagContactDetails()` - 获取标签联系人详情

### 2. TaskManager (`src/backend/src/utils/taskManager.js`)
- `setTaskContacts()` - 设置任务联系人
- `setTaskTemplates()` - 设置任务模板
- `generateSubTasks()` - 生成子任务
- `updateTaskStats()` - 更新任务统计
- `getTaskFullInfo()` - 获取任务完整信息

## 🔧 触发器和函数

### 1. SubTask统计触发器
```sql
CREATE TRIGGER trigger_update_task_stats
    AFTER INSERT OR UPDATE OR DELETE ON sub_tasks
    FOR EACH ROW EXECUTE FUNCTION update_task_stats();
```
- 自动更新任务的打开数、点击数、错误数统计

## 📊 性能优化

### 1. 减少JOIN查询
- 联系人标签关系：从多表JOIN改为单表JSONB查询
- 任务关联关系：从多表JOIN改为单表JSONB查询

### 2. 实时统计
- 通过触发器自动维护任务统计数据
- 避免每次查询时重新计算

## 🚀 使用示例

### 1. 设置联系人标签
```javascript
const ContactTagManager = require('../utils/contactTagManager');

// 为联系人设置标签
await ContactTagManager.setContactTags(contactId, [tagId1, tagId2]);

// 获取联系人的标签详情
const tags = await ContactTagManager.getContactTagDetails(contactId);
```

### 2. 管理任务关联
```javascript
const TaskManager = require('../utils/taskManager');

// 设置任务的联系人和模板
await TaskManager.setTaskContacts(taskId, [contactId1, contactId2]);
await TaskManager.setTaskTemplates(taskId, [templateId1, templateId2]);

// 生成子任务
await TaskManager.generateSubTasks(taskId);

// 获取任务完整信息
const taskInfo = await TaskManager.getTaskFullInfo(taskId);
```

## ⚠️ 注意事项

### 1. 数据一致性
- 使用事务确保数据一致性
- 新增的辅助函数都支持事务参数

### 2. 向后兼容
- 保留了原有的关联表（如 `contact_tags`、`task_contacts` 等）
- 可以在确认新结构稳定后再删除

### 3. 索引优化
- JSONB字段支持GIN索引，可根据查询需求添加
- 建议为常用的JSONB查询添加表达式索引

## 📝 执行步骤

1. **备份数据库**
2. **执行结构调整脚本**: `db_init_scripts/16_restructure_database.sql`
3. **执行数据迁移函数**:
   ```sql
   SELECT migrate_contact_tags();
   SELECT migrate_tag_contacts();
   SELECT migrate_task_contacts();
   SELECT migrate_task_templates();
   ```
4. **验证数据完整性**
5. **更新应用代码使用新的辅助函数**
6. **测试功能完整性**

## 🔍 验证查询

### 验证联系人标签迁移
```sql
-- 检查数据一致性
SELECT 
  c.id,
  c.tags as contact_tags,
  array_agg(ct.tag_id) as old_tags
FROM contacts c
LEFT JOIN contact_tags ct ON c.id = ct.contact_id
GROUP BY c.id, c.tags;
```

### 验证任务关联迁移
```sql
-- 检查任务联系人迁移
SELECT 
  t.id,
  t.contacts as task_contacts,
  array_agg(tc.contact_id) as old_contacts
FROM tasks t
LEFT JOIN task_contacts tc ON t.id = tc.task_id
GROUP BY t.id, t.contacts;
``` 