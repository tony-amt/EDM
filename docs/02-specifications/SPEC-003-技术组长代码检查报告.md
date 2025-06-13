# SPEC-003-技术组长代码检查报告

## 📖 文档信息
- **文档类型**: 技术检查报告
- **检查人**: 技术组长Agent
- **检查时间**: 2025-06-09
- **状态**: 🔍 检查完成

## 🎯 检查范围

### 检查对象
- Task模型实现 (`src/backend/src/models/task.model.js`)
- TaskService业务逻辑 (`src/backend/src/services/task.service.js`)
- Task路由定义 (`src/backend/src/routes/task.routes.js`)
- Task控制器 (`src/backend/src/controllers/task.controller.js`)

## ❌ 关键问题发现

### 1. 🚨 Task模型架构不匹配

**问题**: Task模型强制依赖Campaign
```javascript
// 当前实现 - 有问题
Task.belongsTo(models.Campaign, {
  foreignKey: {
    name: 'campaign_id',
    allowNull: false,  // ❌ 强制要求campaign_id
  },
  as: 'campaign',
});
```

**影响**: 
- V2.0群发任务无法独立创建
- 与新业务模型定义冲突
- 导致API创建时必须提供campaign_id

**修复方案**: 
- 移除campaign_id的强制依赖
- 添加sender_id和email_service_id字段

### 2. 🚨 缺失核心字段

**问题**: Task模型缺少V2.0必需字段
```javascript
// 当前缺失的字段
sender_id: "UUID",           // ❌ 缺失发信人ID
email_service_id: "UUID",   // ❌ 缺失发信服务ID（当前是mail_service_id）
description: "string",      // ❌ 缺失任务描述
```

**影响**:
- 无法指定发信人
- 发信服务关联不清晰
- 任务描述信息缺失

### 3. 🚨 字段命名不一致

**问题**: 字段命名与V2.0规范不匹配
```javascript
// 当前命名 vs 期望命名
plan_time         vs  schedule_time        // ❌ 命名不一致
mail_service_id   vs  email_service_id     // ❌ 命名不一致
```

### 4. 🚨 TaskService强制要求Campaign

**问题**: createTask方法强制要求campaign_id
```javascript
// src/backend/src/services/task.service.js 行220-224
const { campaign_id, name, plan_time, recipient_rule, template_set_id, mail_service_id } = taskData;

if (!campaign_id || !name || !plan_time || !recipient_rule || !template_set_id) {
  throw new AppError('Missing required fields for task creation (campaign_id, name, plan_time, recipient_rule, template_set_id).', 400);
}
```

**影响**: 
- V2.0独立任务创建失败
- 与业务模型不匹配

### 5. 🚨 子任务模型命名混乱

**问题**: TaskContact与SubTask概念混淆
```javascript
// 当前TaskContact实际应该是SubTask
Task.hasMany(models.TaskContact, {
  foreignKey: 'task_id',
  as: 'taskContacts',
});
```

**影响**:
- 概念不清晰
- 与新模型定义不符

## ✅ 符合要求的部分

### 1. recipient_rule设计合理
```javascript
recipient_rule: {
  type: DataTypes.JSONB,
  allowNull: false,
  defaultValue: {},
  /* 支持: TAG_BASED | ALL_CONTACTS | MANUAL_LIST */
}
```

### 2. 状态管理完善
```javascript
status: {
  type: DataTypes.ENUM('draft', 'scheduled', 'sending', 'paused', 'finished', 'failed', 'cancelled'),
  allowNull: false,
  defaultValue: 'draft',
}
```

### 3. 统计数据结构良好
```javascript
summary_stats: {
  type: DataTypes.JSONB,
  allowNull: true,
  /* 包含完整的发送统计信息 */
}
```

## 🔧 重构实施建议

### 阶段1: Task模型重构 (高优先级)

```javascript
// 修改Task模型关联
Task.associate = (models) => {
  // ❌ 移除强制Campaign依赖
  // Task.belongsTo(models.Campaign, { ... });
  
  // ✅ 添加新的关联
  Task.belongsTo(models.User, {
    foreignKey: { name: 'created_by', allowNull: false },
    as: 'creator',
  });
  
  Task.belongsTo(models.Sender, {
    foreignKey: { name: 'sender_id', allowNull: false },
    as: 'sender',
  });
  
  Task.belongsTo(models.EmailService, {
    foreignKey: { name: 'email_service_id', allowNull: false },
    as: 'emailService',
  });
  
  Task.belongsTo(models.TemplateSet, {
    foreignKey: { name: 'template_set_id', allowNull: false },
    as: 'templateSet',
  });
  
  // ✅ 重命名为SubTask
  Task.hasMany(models.SubTask, {
    foreignKey: 'task_id',
    as: 'subTasks',
  });
};
```

### 阶段2: 添加缺失字段

```javascript
// 在Task.init中添加
description: {
  type: DataTypes.TEXT,
  allowNull: true,
},
sender_id: {
  type: DataTypes.UUID,
  allowNull: false,
},
email_service_id: {
  type: DataTypes.UUID, 
  allowNull: false,
},
// 重命名字段
schedule_time: { // 原plan_time
  type: DataTypes.DATE,
  allowNull: false,
},
```

### 阶段3: TaskService重构

```javascript
// 修改createTask方法
async createTask(taskData, userId) {
  const { 
    name, 
    description,
    schedule_time, 
    recipient_rule, 
    template_set_id,
    sender_id,
    email_service_id 
  } = taskData;

  // ❌ 移除campaign_id验证
  // ✅ 添加V2.0字段验证
  if (!name || !schedule_time || !recipient_rule || !template_set_id || !sender_id || !email_service_id) {
    throw new AppError('Missing required fields for V2.0 task creation', 400);
  }
  
  // ❌ 移除Campaign验证
  // ✅ 添加Sender和EmailService验证
}
```

### 阶段4: 路由和控制器调整

```javascript
// 修改task.routes.js验证规则
router.post('/', [
  // ❌ 移除campaign_id验证
  // body('campaign_id').isUUID(),
  
  // ✅ 添加V2.0字段验证
  body('name').trim().notEmpty(),
  body('schedule_time').isISO8601(),
  body('sender_id').isUUID(),
  body('email_service_id').isUUID(),
  body('template_set_id').isUUID(),
  body('recipient_rule').isObject(),
], TaskController.createTask);
```

## 📋 数据迁移计划

### 1. 数据库结构迁移
```sql
-- 添加新字段
ALTER TABLE tasks ADD COLUMN sender_id UUID;
ALTER TABLE tasks ADD COLUMN email_service_id UUID;
ALTER TABLE tasks ADD COLUMN description TEXT;

-- 重命名字段
ALTER TABLE tasks RENAME COLUMN plan_time TO schedule_time;
ALTER TABLE tasks RENAME COLUMN mail_service_id TO email_service_id_old;

-- 修改外键约束
ALTER TABLE tasks ALTER COLUMN campaign_id DROP NOT NULL;
ALTER TABLE tasks ADD CONSTRAINT fk_task_sender FOREIGN KEY (sender_id) REFERENCES senders(id);
ALTER TABLE tasks ADD CONSTRAINT fk_task_email_service FOREIGN KEY (email_service_id) REFERENCES email_services(id);
```

### 2. 重命名SubTask表
```sql
-- 重命名TaskContact为SubTask
ALTER TABLE task_contacts RENAME TO sub_tasks;
-- 更新相关索引和约束
```

## ⚠️ 风险评估

### 高风险
- **数据迁移**: 现有Task数据如何处理campaign_id依赖
- **API兼容性**: 现有API调用者可能受影响

### 中风险  
- **性能影响**: 索引重建可能影响查询性能
- **测试覆盖**: 需要完整重写测试用例

### 低风险
- **字段重命名**: 影响相对可控
- **模型关联调整**: 逻辑清晰

## 📅 建议实施时间表

### 第1天: 模型重构
- 修改Task模型定义
- 创建数据迁移脚本

### 第2天: 服务层重构  
- 重构TaskService
- 重构路由和控制器

### 第3天: 测试重构
- 更新单元测试
- 更新集成测试

### 第4天: 验证测试
- 端到端测试
- 性能测试

## 🎯 检查结论

**当前代码与V2.0模型定义存在严重不匹配**，需要进行全面重构：

1. **架构问题**: Task强制依赖Campaign，与独立群发任务定义冲突
2. **字段缺失**: 缺少sender_id、email_service_id等核心字段  
3. **命名不一致**: plan_time vs schedule_time等命名问题
4. **概念混乱**: TaskContact与SubTask概念需要澄清

**建议**: 立即启动模型重构，按照V2.0规范重新设计Task架构。

---

**检查人**: 技术组长Agent  
**审核状态**: ✅ 检查完成  
**下一步**: 等待业务主导人确认重构方案 