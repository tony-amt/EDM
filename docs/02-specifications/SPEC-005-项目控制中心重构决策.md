# SPEC-005-项目控制中心重构决策

## 📖 文档信息
- **文档类型**: 项目重构决策
- **决策人**: 项目控制中心
- **决策时间**: 2025-06-09
- **状态**: 📋 待执行

## 🎯 决策背景

用户重新明确了实体模型定义，发现当前系统架构与V2.0业务需求存在严重不匹配。经过三个专业Agent的全面检查，确认需要进行大规模重构。

## 📊 检查结果汇总

### 🔧 技术组长检查结果
- **问题严重度**: 🚨 严重不匹配
- **主要问题**: Task强制依赖Campaign、缺失核心字段、命名不一致
- **重构工作量**: 4天，涉及模型、服务、路由、控制器全面重构

### 🧪 测试组长检查结果  
- **问题严重度**: 🚨 根本性不匹配
- **主要问题**: API结构完全错误、概念混乱、SubTask测试缺失
- **重构工作量**: 4天，需要全面重写测试套件

### 📋 项目负责人分析
- **业务影响**: V2.0核心功能无法正确实现
- **技术债务**: 架构设计与业务模型背离
- **重构收益**: 实现真正的V2.0独立群发任务功能

## 🎯 重构决策

### ✅ 决策1: 立即启动全面重构
**理由**: 当前架构与业务需求根本性冲突，修补式改进无法解决问题

**范围**: 
- 数据模型重构
- API接口重构  
- 业务逻辑重构
- 测试用例重构

### ✅ 决策2: 按阶段实施，确保系统稳定
**理由**: 大规模重构风险较高，需要分阶段验证

**阶段划分**:
1. 模型和数据库重构
2. API和业务逻辑重构
3. 测试重构和验证
4. 集成测试和上线

### ✅ 决策3: 暂停V2.0新功能开发
**理由**: 在模型稳定前，避免在错误架构上继续开发

**影响**: 现有V2.0功能开发暂停，专注重构

## 📋 重构实施计划

### 🗂️ 阶段1: 数据模型重构 (第1-2天)

#### 1.1 Task模型重构
```javascript
// 新的Task模型定义
Task.init({
  id: { type: DataTypes.UUID, primaryKey: true },
  name: { type: DataTypes.STRING(255), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  
  // ✅ 重命名字段  
  schedule_time: { type: DataTypes.DATE, allowNull: false }, // 原plan_time
  
  // ✅ 新增V2.0核心字段
  sender_id: { type: DataTypes.UUID, allowNull: false },
  email_service_id: { type: DataTypes.UUID, allowNull: false },
  
  // ✅ 保留的字段
  recipient_rule: { type: DataTypes.JSONB, allowNull: false },
  template_set_id: { type: DataTypes.UUID, allowNull: false },
  status: { type: DataTypes.ENUM(...), allowNull: false },
  summary_stats: { type: DataTypes.JSONB, allowNull: true },
  
  // ✅ 用户关联调整
  created_by: { type: DataTypes.UUID, allowNull: false }, // 原user_id
});

// ✅ 重构关联关系
Task.associate = (models) => {
  // ❌ 移除强制Campaign依赖
  
  // ✅ 新增V2.0关联
  Task.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
  Task.belongsTo(models.Sender, { foreignKey: 'sender_id', as: 'sender' });
  Task.belongsTo(models.EmailService, { foreignKey: 'email_service_id', as: 'emailService' });
  Task.belongsTo(models.TemplateSet, { foreignKey: 'template_set_id', as: 'templateSet' });
  
  // ✅ SubTask关联
  Task.hasMany(models.SubTask, { foreignKey: 'task_id', as: 'subTasks' });
};
```

#### 1.2 SubTask模型创建
```javascript
// 新建SubTask模型 (重命名原TaskContact)
SubTask.init({
  id: { type: DataTypes.UUID, primaryKey: true },
  task_id: { type: DataTypes.UUID, allowNull: false },
  contact_id: { type: DataTypes.UUID, allowNull: false },
  
  // ✅ 发送信息
  sender_email: { type: DataTypes.STRING(255), allowNull: false },
  recipient_email: { type: DataTypes.STRING(255), allowNull: false },
  
  // ✅ 渲染内容
  template_id: { type: DataTypes.UUID, allowNull: false },
  rendered_subject: { type: DataTypes.STRING(500), allowNull: false },
  rendered_body: { type: DataTypes.TEXT, allowNull: false },
  
  // ✅ 状态跟踪
  status: { type: DataTypes.ENUM('pending', 'sent', 'delivered', 'bounced', 'opened', 'clicked', 'failed'), defaultValue: 'pending' },
  sent_at: { type: DataTypes.DATE, allowNull: true },
  delivered_at: { type: DataTypes.DATE, allowNull: true },
  opened_at: { type: DataTypes.DATE, allowNull: true },
  clicked_at: { type: DataTypes.DATE, allowNull: true },
  error_message: { type: DataTypes.TEXT, allowNull: true },
  tracking_id: { type: DataTypes.UUID, allowNull: false },
});
```

#### 1.3 数据迁移计划
```sql
-- 阶段1: 添加新字段
ALTER TABLE tasks ADD COLUMN sender_id UUID;
ALTER TABLE tasks ADD COLUMN email_service_id UUID;  
ALTER TABLE tasks ADD COLUMN description TEXT;
ALTER TABLE tasks ADD COLUMN created_by UUID;

-- 阶段2: 字段重命名
ALTER TABLE tasks RENAME COLUMN plan_time TO schedule_time;
ALTER TABLE tasks RENAME COLUMN user_id TO created_by_old;

-- 阶段3: 约束调整
ALTER TABLE tasks ALTER COLUMN campaign_id DROP NOT NULL;
ALTER TABLE tasks ADD CONSTRAINT fk_task_sender FOREIGN KEY (sender_id) REFERENCES senders(id);
ALTER TABLE tasks ADD CONSTRAINT fk_task_email_service FOREIGN KEY (email_service_id) REFERENCES email_services(id);

-- 阶段4: 重命名SubTask表
ALTER TABLE task_contacts RENAME TO sub_tasks;
ALTER INDEX idx_task_contacts_task_id RENAME TO idx_sub_tasks_task_id;
```

### 🔧 阶段2: API和业务逻辑重构 (第3-4天)

#### 2.1 TaskService重构
```javascript
// 新的createTask方法
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

  // ✅ V2.0字段验证
  if (!name || !schedule_time || !recipient_rule || !template_set_id || !sender_id || !email_service_id) {
    throw new AppError('Missing required fields for V2.0 task creation', 400);
  }

  // ✅ 验证关联实体存在性
  await this.validateTaskDependencies(userId, { sender_id, email_service_id, template_set_id });

  // ✅ 验证用户额度
  await this.validateUserQuota(userId, recipient_rule);

  const task = await Task.create({
    name,
    description,
    schedule_time: new Date(schedule_time),
    recipient_rule,
    template_set_id,
    sender_id,
    email_service_id,
    created_by: userId,
    status: 'draft'
  });

  return this.formatTaskOutput(task);
}
```

#### 2.2 路由重构
```javascript
// 修改task.routes.js
router.post('/', [
  // ❌ 移除campaign_id验证
  // ✅ 添加V2.0字段验证
  body('name').trim().notEmpty().withMessage('Task name is required'),
  body('schedule_time').isISO8601().withMessage('Valid schedule time is required'),
  body('sender_id').isUUID().withMessage('Valid sender ID is required'),
  body('email_service_id').isUUID().withMessage('Valid email service ID is required'),
  body('template_set_id').isUUID().withMessage('Valid template set ID is required'),
  body('recipient_rule').isObject().withMessage('Recipient rule must be an object'),
], TaskController.createTask);

// ✅ 添加统计API
router.get('/stats', TaskController.getTaskStats);

// ✅ 添加SubTask相关API
router.get('/:task_id/subtasks', TaskController.getTaskSubTasks);
```

#### 2.3 SubTask相关API
```javascript
// 新建subtask.routes.js
router.get('/:id', SubTaskController.getSubTaskById);
router.patch('/:id/status', SubTaskController.updateSubTaskStatus);
router.get('/stats', SubTaskController.getSubTaskStats);
```

### 🧪 阶段3: 测试重构 (第5-6天)

#### 3.1 V2.0 Task集成测试
```javascript
describe('V2.0群发任务管理', () => {
  test('应该能创建独立的群发任务', async () => {
    const taskData = await V2TestDataFactory.createCompleteTaskData();
    
    const response = await apiClient.post('/tasks', taskData);
    
    expect(response.status).toBe(201);
    expect(response.data.sender_id).toBe(taskData.sender_id);
    expect(response.data.email_service_id).toBe(taskData.email_service_id);
    expect(response.data.schedule_time).toBeTruthy();
  });
});
```

#### 3.2 SubTask集成测试
```javascript
describe('SubTask管理', () => {
  test('任务调度应该生成SubTask', async () => {
    const task = await createTestTask();
    
    await apiClient.patch(`/tasks/${task.id}/status`, { status: 'scheduled' });
    
    const subTasks = await apiClient.get(`/tasks/${task.id}/subtasks`);
    expect(subTasks.data.length).toBeGreaterThan(0);
    expect(subTasks.data[0]).toHaveProperty('sender_email');
    expect(subTasks.data[0]).toHaveProperty('recipient_email');
  });
});
```

#### 3.3 完整闭环测试
```javascript
describe('V2.0完整闭环', () => {
  test('群发任务完整执行流程', async () => {
    // 1. 创建任务
    const task = await createV2Task();
    
    // 2. 检查额度
    const quotaBefore = await getUserQuota();
    
    // 3. 启动任务
    await apiClient.patch(`/tasks/${task.id}/status`, { status: 'scheduled' });
    
    // 4. 等待完成
    await waitForTaskCompletion(task.id);
    
    // 5. 验证结果
    const finalTask = await apiClient.get(`/tasks/${task.id}`);
    expect(finalTask.data.status).toBe('completed');
    
    const quotaAfter = await getUser Quota();
    expect(quotaAfter.remaining_quota).toBeLessThan(quotaBefore.remaining_quota);
  });
});
```

### 🔄 阶段4: 集成验证 (第7天)

#### 4.1 数据完整性验证
- 验证数据迁移正确性
- 检查关联关系完整性
- 确认索引性能

#### 4.2 API功能验证
- 全量API回归测试
- 性能测试  
- 错误处理验证

#### 4.3 业务流程验证
- 端到端业务流程测试
- 用户额度管理验证
- SubTask状态跟踪验证

## ⚠️ 风险控制措施

### 1. 数据安全
- **备份策略**: 重构前完整备份数据库
- **回滚计划**: 准备数据回滚脚本
- **分步执行**: 每个阶段完成后验证再继续

### 2. 系统稳定性
- **渐进式部署**: 先在测试环境验证
- **监控机制**: 重构期间增强监控
- **快速修复**: 问题发现后1小时内响应

### 3. 业务连续性
- **功能降级**: 保留关键功能可用
- **用户通知**: 提前通知用户维护窗口
- **应急预案**: 准备紧急回滚方案

## 📈 成功标准

### 技术指标
- [ ] 所有V2.0 API正常工作
- [ ] Task创建不再依赖Campaign
- [ ] SubTask生成和状态跟踪正常
- [ ] 数据库性能不下降

### 业务指标
- [ ] 群发任务创建成功率 > 95%
- [ ] 用户额度管理准确率 100%
- [ ] 邮件发送成功率保持现有水平
- [ ] 系统响应时间 < 2秒

### 测试指标
- [ ] 集成测试通过率 > 90%
- [ ] 代码覆盖率 > 80%
- [ ] 性能测试通过
- [ ] 安全测试通过

## 📅 执行时间表

| 阶段 | 时间 | 负责人 | 关键里程碑 |
|------|------|--------|------------|
| 阶段1 | 第1-2天 | 技术组长 | 模型重构完成、数据迁移成功 |
| 阶段2 | 第3-4天 | 技术组长 | API重构完成、基础功能验证 |
| 阶段3 | 第5-6天 | 测试组长 | 测试重构完成、集成测试通过 |
| 阶段4 | 第7天 | 项目控制中心 | 完整验证、系统上线 |

## 🎯 项目控制中心最终决定

**批准重构**: ✅ 批准按照此计划执行V2.0模型重构

**重构原因**: 当前架构无法支撑V2.0业务需求，必须重构

**预期收益**: 
1. 实现真正的独立群发任务功能
2. 支持发信人和发信服务选择
3. 完整的SubTask状态跟踪
4. 准确的用户额度管理

**下一步行动**: 立即启动阶段1数据模型重构

---

**决策人**: 项目控制中心  
**执行开始时间**: 立即  
**预计完成时间**: 7个工作日  
**风险等级**: �� 中等风险（有完整计划和回滚方案） 