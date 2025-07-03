# EDM项目AI开发上下文
生成时间: Thu Jun 26 18:11:00 CST 2025

## 🎯 后端开发上下文

### 📋 后端开发规范
---
description: 
globs: *.controller.js,*.model.js,*.service.js,*.routes.js,*.middleware.js,src/backend/src/**/*
alwaysApply: false
---
# EDM后端开发规则

## 🎯 后端技术栈
- **运行时**: Node.js 18+
- **框架**: Express.js
- **数据库**: PostgreSQL + Sequelize ORM
- **缓存**: Redis
- **认证**: JWT + bcrypt
- **邮件服务**: Nodemailer + 多服务商支持
- **容器化**: Docker + Docker Compose

## 📁 后端实际目录结构
```
src/backend/src/
├── controllers/        # 控制器层 (.controller.js)
├── models/            # 数据模型 (.model.js)
├── routes/            # 路由定义 (.routes.js)
├── services/          # 业务逻辑层 (.service.js)
│   ├── core/         # 核心业务服务
│   └── third-party/  # 第三方服务集成
├── middlewares/       # 中间件 (.middleware.js)
├── utils/             # 工具函数 (.js)
├── config/            # 配置文件 (.js)
└── scripts/           # 脚本文件 (.js)
```

## 🛠️ 后端开发规范
- **文件命名**: 
  - 控制器: `*.controller.js` (如: `user.controller.js`)
  - 模型: `*.model.js` (如: `user.model.js`)
  - 服务: `*.service.js` (如: `user.service.js`)
  - 路由: `*.routes.js` (如: `user.routes.js`)
  - 中间件: `*.middleware.js` (如: `auth.middleware.js`)
- **API路径**: RESTful风格 (`/api/v1/users`)
- **错误处理**: 统一错误处理中间件
- **数据验证**: 使用Joi或express-validator
- **日志记录**: 使用winston，结构化日志
- **异步处理**: 使用async/await，避免回调地狱

## 🗃️ 数据库规范
- **表命名**: 复数形式，snake_case (如: `email_campaigns`)
- **字段命名**: snake_case (如: `created_at`)
- **主键**: 统一使用`id`，自增整数
- **时间戳**: 必须有`created_at`和`updated_at`
- **软删除**: 使用`deleted_at`字段
- **索引**: 查询频繁的字段必须有索引

## 🔌 API设计规范
```javascript
// 标准控制器结构 (*.controller.js)
const controllerName = {
  // GET /api/v1/resource
  async list(req, res, next) {
    try {
      const result = await Service.list(req.query);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
  
  // POST /api/v1/resource
  async create(req, res, next) {
    try {
      const result = await Service.create(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
};

module.exports = controllerName;
```

## 📊 数据模型示例
```javascript
// Sequelize模型定义 (*.model.js)
const { DataTypes } = require('sequelize');

const Model = (sequelize) => {
  return sequelize.define('ModelName', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255]
      }
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      defaultValue: 'active'
    }
  }, {
    tableName: 'model_names',
    timestamps: true,
    paranoid: true // 软删除
  });
};

module.exports = Model;
```

## 🔐 安全规范
- **输入验证**: 所有用户输入必须验证和过滤
- **SQL注入**: 使用参数化查询，禁止字符串拼接
- **XSS防护**: 输出转义，Content-Security-Policy
- **认证授权**: JWT Token验证，权限控制
- **敏感信息**: 使用环境变量，禁止硬编码
- **日志安全**: 不记录敏感信息

## 📋 后端检查清单
- [ ] API遵循RESTful规范
- [ ] 数据验证和错误处理
- [ ] 数据库事务处理
- [ ] 认证和权限控制
- [ ] 日志记录和监控
- [ ] 单元测试覆盖
- [ ] API文档更新

## 🚀 后端命令
```bash
cd src/backend
npm run dev             # 启动开发服务器
npm run test            # 运行测试
npm run migrate         # 数据库迁移
npm run seed            # 数据库种子数据
npm run lint            # 代码检查
```

## 🔍 常见问题排查
- **数据库连接失败**: 检查`config/config.js`和环境变量
- **Redis连接失败**: 确认Redis服务状态和配置
- **邮件发送失败**: 检查邮件服务配置和网络连接
- **JWT Token失效**: 检查Token生成和验证逻辑
- **API响应慢**: 检查数据库查询和索引优化

## 📂 实际文件示例
- **控制器**: `controllers/user.controller.js`
- **模型**: `models/user.model.js`
- **服务**: `services/core/contact.service.js`
- **路由**: `routes/auth.routes.js`
- **中间件**: `middlewares/auth.middleware.js`
- **工具**: `utils/appError.js`
- **配置**: `config/config.js`

### 📂 现有控制器文件列表
```
src/backend/src/controllers/tag.controller.js
src/backend/src/controllers/template.controller.js
src/backend/src/controllers/upload.controller.js
src/backend/src/controllers/webhook.controller.js
src/backend/src/controllers/scheduler.controller.js
```

### 📖 控制器代码示例 (auth.controller.js)
```javascript
const db = require('../models');
const { User } = db;
const jwt = require('jsonwebtoken');
const { Op } = db.Sequelize;
const logger = require('../utils/logger');
const config = require('../config');

/**
 * 用户注册
 */
exports.register = async (req, res) => {
  try {
    const { username, email, password, name, role } = req.body;

    // 基本字段验证
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: { message: '用户名、邮箱和密码不能为空' }
      });
    }

    // 检查用户名和邮箱是否已存在
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { username },
          { email }
        ]
      }
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: { message: '用户名或邮箱已存在' }
      });
    }

    // 创建新用户
    const user = await User.create({
      username,
      email,
      password_hash: password,
      role: role || 'operator',
    });
    
    // Exclude password_hash from the response if user object is returned
    const userResponse = { ...user.toJSON() };
    delete userResponse.password_hash;
```

### 🛤️ 现有路由文件
```
src/backend/src/routes/webhooks.routes.js
src/backend/src/routes/emailConversation.routes.js
src/backend/src/routes/apiAccount.routes.js
src/backend/src/routes/quota.routes.js
src/backend/src/routes/emailService.routes.js
```

### 🔧 常用命令
```bash
# 开发环境启动
npm run dev

# 代码验证
./scripts/ai-code-validator.sh

# 健康检查
./scripts/check-scheduler-status.sh
```

### 📝 最近变更记录
最近的变更文档：
- docs/08-changes/CHANGE-007-生产环境问题修复总结.md
- docs/08-changes/多级标签系统实施报告.md
- docs/08-changes/系统优化和清理报告.md

### 📚 相关文档
- [后端开发规范](docs/02-specifications/)
- [API设计文档](docs/03-design/)
- [数据库设计](docs/03-design/)

