# API测试规范文档

## 🎯 目的
避免API字段名不一致导致的测试失败，建立统一的API测试标准。

## 📋 核心API字段规范

### 1. 认证API (`/api/auth`)

#### 登录API
- **路径**: `POST /api/auth/login`
- **必需字段**: 
  - `usernameOrEmail` (不是 `username` 或 `email`)
  - `password`
- **示例**:
```json
{
  "usernameOrEmail": "admin",
  "password": "admin123"
}
```

#### 注册API
- **路径**: `POST /api/auth/register`
- **必需字段**:
  - `username`
  - `email`
  - `password`
  - `role` (可选: admin, operator, read_only)

### 2. 用户管理API (`/api/users`)

#### 用户额度分配
- **路径**: `POST /api/users/:id/quota`
- **必需字段**:
  - `amount` (正整数)
  - `reason` (可选字符串)
- **权限**: 仅管理员
- **示例**:
```json
{
  "amount": 1000,
  "reason": "初始额度分配"
}
```

#### 获取用户额度
- **路径**: `GET /api/users/:id/quota`
- **权限**: 仅管理员

### 3. 发信服务API (`/api/email-services`)

#### 创建发信服务
- **路径**: `POST /api/email-services`
- **必需字段**:
  - `name` (唯一)
  - `provider` (如: smtp, engagelab)
  - `api_key`
  - `api_secret`
  - `domain` (唯一)
- **可选字段**:
  - `daily_quota` (默认: 1000)
  - `sending_rate` (默认: 60)
- **权限**: 仅管理员

### 4. 任务管理API (`/api/tasks`)

#### 任务表字段映射
- **实际字段**: `template_set_id` (不是 `template_id`)
- **实际字段**: `sender_id` (必需)
- **实际字段**: `created_by` (用户ID)
- **实际字段**: `schedule_time` (不是 `scheduled_at`)

### 5. 子任务表字段要求
- **必需字段**:
  - `sender_email` (发信人邮箱)
  - `recipient_email` (收件人邮箱)
  - `template_id` (模板ID)
  - `rendered_subject` (渲染后主题)
  - `rendered_body` (渲染后内容)
  - `tracking_id` (跟踪ID)

## 🔧 测试脚本规范

### 1. 环境变量设置
```bash
# 获取认证Token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usernameOrEmail": "admin", "password": "admin123"}' | \
  jq -r '.token')
```

### 2. 错误处理规范
- 每个API调用后检查返回状态
- 记录失败原因和正确的字段名
- 提供修复建议

### 3. 数据库操作规范
- 仅在API无法满足需求时使用直接数据库操作
- 记录所有数据库操作的原因
- 标记为"模拟数据"

## 📊 常见错误及解决方案

### 错误1: 登录字段错误
- **错误**: 使用 `username` 或 `email`
- **正确**: 使用 `usernameOrEmail`

### 错误2: 发信服务字段错误
- **错误**: 使用 `type`, `host`, `port`
- **正确**: 使用 `provider`, `api_key`, `api_secret`, `domain`

### 错误3: 任务字段错误
- **错误**: 使用 `template_id`
- **正确**: 使用 `template_set_id`

## 🚨 强制执行规则

1. **测试前必读**: 每次测试前必须查阅此规范
2. **字段验证**: 使用API前先验证字段名
3. **错误记录**: 发现新的字段不一致立即更新此文档
4. **代码审查**: 所有测试脚本必须符合此规范

## 📝 更新日志

- 2025-06-10: 初始版本，记录登录、用户额度、发信服务API规范
- 待更新: 模板、联系人、任务等其他API规范

---

**重要提醒**: 此文档是避免重复错误的关键，每次API测试都必须参考！ 