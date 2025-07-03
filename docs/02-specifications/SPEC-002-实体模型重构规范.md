# SPEC-002-实体模型重构规范

## 📖 文档信息
- **文档类型**: 业务规范
- **版本**: V2.0
- **创建时间**: 2025-06-09
- **负责人**: 项目控制中心
- **状态**: 🔄 重构中

## 🎯 重构背景

### 问题识别
经过集成测试发现，当前系统的实体模型定义存在混乱：
1. V1.0的campaign和V2.0的群发任务概念冲突
2. task和subTask的职责边界不清晰
3. API设计与业务需求不匹配

### 重构目标
- 统一实体模型定义
- 明确V2.0版本的业务边界
- 重构代码实现以匹配正确的业务模型

## 📋 统一实体模型定义

### 🎬 营销活动（campaign）
**定义**: 表示一个系列的任务，每个任务会单独设定发送计划和内容

**业务场景**: 
- 对同一批人群T0发送打招呼邮件
- T3发送跟进营销邮件
- 涉及任务间调度策略

**V2.0版本状态**: ⏸️ **暂不实现**
- 原因: 涉及复杂的任务调度策略
- 计划: 后续版本实现

### 📧 群发任务（task）
**定义**: V2.0版本的核心功能，独立的邮件群发任务

**核心组成要素**:
- 📝 邮件模版（templateSet）
- 👤 发信人（sender）  
- 📮 收信人/联系人（contact）或联系人标签（contactTag）
- 🔧 发信服务（emailService）

**业务特征**:
- ✅ 独立存在，不依赖campaign
- ✅ 一次性或定时群发
- ✅ 支持联系人筛选规则
- ✅ 支持发信服务选择

**数据结构**:
```javascript
{
  id: "UUID",
  name: "任务名称",
  description: "任务描述",
  status: "draft|scheduled|sending|completed|failed|cancelled",
  schedule_time: "ISO8601时间",
  recipient_rule: {
    type: "specific|tag_based|all_contacts",
    contact_ids: ["UUID"],
    include_tags: ["标签名"],
    exclude_tags: ["标签名"]
  },
  template_set_id: "UUID",
  sender_id: "UUID", 
  email_service_id: "UUID",
  created_by: "UUID",
  created_at: "ISO8601时间",
  updated_at: "ISO8601时间"
}
```

### 📬 群发子任务（subTask）
**定义**: 单轮邮件发送的最小单元

**核心组成要素**:
- 📧 发信邮箱地址（发信人@发信服务域名）
- 📮 收信邮箱地址（contact的email字段）
- 📝 邮件内容（template + 变量填充）

**业务特征**:
- ✅ 属于某个群发任务（task）
- ✅ 记录单个邮件的发送状态
- ✅ 支持发送跟踪和统计

**数据结构**:
```javascript
{
  id: "UUID", 
  task_id: "UUID",
  contact_id: "UUID",
  sender_email: "sender@domain.com",
  recipient_email: "recipient@domain.com", 
  template_id: "UUID",
  rendered_subject: "渲染后的主题",
  rendered_body: "渲染后的内容",
  status: "pending|sent|delivered|bounced|opened|clicked|failed",
  sent_at: "ISO8601时间",
  delivered_at: "ISO8601时间", 
  opened_at: "ISO8601时间",
  clicked_at: "ISO8601时间",
  error_message: "错误信息",
  tracking_id: "UUID"
}
```

## 🔄 重构实施计划

### 阶段1: 数据库模型重构
- [ ] 重新设计task表结构（移除campaign_id依赖）
- [ ] 重命名subtask表为sub_task
- [ ] 添加必要的新字段（sender_id, email_service_id等）
- [ ] 创建数据迁移脚本

### 阶段2: API重构  
- [ ] 重构task创建API（简化字段要求）
- [ ] 更新task查询API（移除campaign_id要求）
- [ ] 重构subTask相关API
- [ ] 添加task统计API

### 阶段3: 业务逻辑重构
- [ ] 重构TaskService实现
- [ ] 重构SubTaskService实现  
- [ ] 更新任务调度逻辑
- [ ] 重构额度扣减逻辑

### 阶段4: 测试重构
- [ ] 重构集成测试用例
- [ ] 更新API测试数据
- [ ] 重构闭环测试流程

## 📊 API设计调整

### 群发任务API (V2.0)
```
POST /api/tasks - 创建群发任务
GET /api/tasks - 查询群发任务列表  
GET /api/tasks/{id} - 查询单个群发任务
PUT /api/tasks/{id} - 更新群发任务
DELETE /api/tasks/{id} - 删除群发任务
PATCH /api/tasks/{id}/status - 更新任务状态
GET /api/tasks/stats - 任务统计信息
```

### 群发子任务API (V2.0)
```
GET /api/tasks/{task_id}/subtasks - 查询任务的子任务列表
GET /api/subtasks/{id} - 查询单个子任务详情
PATCH /api/subtasks/{id}/status - 更新子任务状态  
GET /api/subtasks/stats - 子任务统计信息
```

## 🎯 V2.0版本边界明确

### ✅ 本版本实现
- 群发任务（task）的完整CRUD
- 群发子任务（subTask）的管理和跟踪
- 用户额度管理
- 发信服务管理
- 发信人管理

### ⏸️ 本版本不实现  
- 营销活动（campaign）的系列任务管理
- 任务间的调度策略
- 复杂的营销自动化流程

## 📝 重构检查清单

### 数据模型检查
- [ ] task表结构符合新定义
- [ ] subTask表结构符合新定义
- [ ] 外键关系正确设置
- [ ] 索引优化完成

### API接口检查  
- [ ] API路径符合RESTful规范
- [ ] 请求/响应格式标准化
- [ ] 错误处理机制完善
- [ ] 权限控制正确实现

### 业务逻辑检查
- [ ] 任务创建逻辑正确
- [ ] 收信人筛选逻辑正确  
- [ ] 发信服务选择逻辑正确
- [ ] 额度扣减逻辑正确

### 测试覆盖检查
- [ ] 单元测试覆盖核心逻辑
- [ ] 集成测试覆盖API接口
- [ ] 闭环测试覆盖业务流程
- [ ] 性能测试覆盖关键路径

## 📋 后续版本规划

### V3.0 营销活动管理
- 实现campaign的系列任务管理
- 任务间调度策略
- 营销自动化流程

### V4.0 高级功能
- A/B测试支持
- 高级统计分析
- 机器学习推荐

---

**重构负责人**: 项目控制中心  
**技术审核**: 技术组长Agent  
**测试审核**: 测试组长Agent  
**最终确认**: 业务主导人 