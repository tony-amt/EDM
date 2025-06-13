# A.MT邮件系统验收测试指南

本文档提供了如何在本地环境中验收并测试系统所有功能的步骤指南。

## 前置条件

- Node.js 16.x 或更高版本
- PostgreSQL 14.x 或更高版本
- npm 或 yarn

## 1. 环境准备

### 1.1 安装数据库

如果尚未安装PostgreSQL，请根据您的操作系统安装：

**macOS**:
```bash
brew install postgresql
brew services start postgresql
```

**Ubuntu/Debian**:
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 1.2 创建数据库

```bash
# 登录PostgreSQL
psql -U postgres

# 在PostgreSQL命令行中执行
CREATE DATABASE amt_mail_system;
\q
```

### 1.3 克隆和设置项目

```bash
# 克隆项目
git clone https://github.com/your-repo/amt-mail-system.git
cd amt-mail-system

# 安装依赖
cd src/backend
npm install
```

### 1.4 配置环境变量

复制示例环境变量文件并根据您的环境进行修改：

```bash
cp .env.example .env
```

编辑 `.env` 文件，设置数据库连接和极光API凭证。

## 2. 启动系统

我们提供了简便的启动脚本，它会自动进行必要的检查和设置：

```bash
./run_local.sh
```

如果您想手动启动各个组件：

```bash
# 启动API服务器
npm run dev

# 在另一个终端窗口启动邮件工作进程
npm run worker:mail
```

## 3. 验收测试流程

### 3.1 自动化端到端测试

运行自动化端到端测试，验证所有关键功能点：

```bash
npm run test:endpoints
```

此命令将测试：
- 健康检查API
- 用户认证
- 图片上传
- Webhook回调
- 模板管理
- 数据库事务
- 备份脚本
- 图片清理脚本

### 3.2 手动测试关键功能

#### 3.2.1 发送测试邮件

发送单个测试邮件：
```bash
npm run send-test-email your-email@example.com
```

批量发送测试邮件：
```bash
npm run send-multiple-test-emails email1@example.com email2@example.com
```

#### 3.2.2 测试图片上传

使用API客户端（如Postman）向以下端点发送POST请求：
```
POST http://localhost:3000/api/upload/image
```

请求头：
```
Authorization: Bearer <你的JWT令牌>
Content-Type: multipart/form-data
```

参数：
- `image`: 一个图像文件

#### 3.2.3 测试Webhook回调

使用API客户端发送POST请求模拟邮件状态回调：
```
POST http://localhost:3000/api/webhook/mail
```

请求体：
```json
{
  "event": "delivered",
  "message_id": "test-message-id",
  "email": "test@example.com",
  "timestamp": 1625097600
}
```

### 3.3 测试备份和维护功能

#### 执行完整备份
```bash
npm run backup:full
```

#### 模拟图片清理
```bash
npm run cleanup:images:dry
```

## 4. API接口测试

### 4.1 认证API

登录：
```
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "adminpassword"
}
```

获取当前用户：
```
GET http://localhost:3000/api/auth/me
Authorization: Bearer <你的JWT令牌>
```

### 4.2 联系人API

创建联系人：
```
POST http://localhost:3000/api/contacts
Authorization: Bearer <你的JWT令牌>
Content-Type: application/json

{
  "email": "contact@example.com",
  "name": "Test Contact",
  "company": "Test Company"
}
```

### 4.3 模板API

创建模板：
```
POST http://localhost:3000/api/templates
Authorization: Bearer <你的JWT令牌>
Content-Type: application/json

{
  "name": "Test Template",
  "subject": "Test Email Subject",
  "body": "<p>This is a <strong>test</strong> email with a {{name}} placeholder.</p>"
}
```

### 4.4 任务API

创建发送任务：
```
POST http://localhost:3000/api/tasks
Authorization: Bearer <你的JWT令牌>
Content-Type: application/json

{
  "name": "Test Task",
  "description": "Test description",
  "template_id": "<模板ID>",
  "scheduled_at": "2023-12-31T12:00:00Z",
  "status": "draft",
  "contacts": ["<联系人ID>"]
}
```

## 5. 系统健康检查

访问健康检查端点：
```
GET http://localhost:3000/api/health
```

## 6. 验收标准

系统应满足以下所有条件才能通过验收：

1. 所有端到端测试通过
2. 图片上传功能正常，支持优化和转换
3. 邮件发送功能正常，能发送到指定邮箱
4. Webhook回调正确处理各类事件
5. 备份和维护脚本执行无错误
6. 管理员可以登录并操作系统
7. 所有API接口按预期工作
8. 系统健康检查通过

---

如有问题，请联系系统管理员或开发团队。 