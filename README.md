# EDM邮件营销系统

一个功能完整的邮件直销(EDM)系统，支持邮件发送、追踪、统计等功能。

## 🚀 功能特性

- ✅ **邮件发送**：支持批量邮件发送，多发信服务轮询
- ✅ **联系人管理**：支持标签分组、导入导出
- ✅ **模板管理**：富文本邮件模板编辑
- ✅ **任务调度**：智能任务队列和调度系统
- ✅ **邮件追踪**：打开追踪、点击追踪、送达统计
- ✅ **数据统计**：详细的发送报告和分析
- ✅ **多用户支持**：用户权限管理
- ✅ **API集成**：完整的RESTful API

## 🛠 技术栈

### 后端
- **Node.js** + **Express.js**
- **PostgreSQL** 数据库
- **Redis** 缓存
- **Sequelize** ORM
- **Docker** 容器化

### 前端
- **React** + **TypeScript**
- **Ant Design** UI组件库
- **React Router** 路由管理

### 邮件服务
- **EngageLab** 邮件API
- 支持多发信服务配置

## 📦 快速开始

### 开发环境

1. **克隆项目**
```bash
git clone <repository-url>
cd EDM
```

2. **启动服务**
```bash
docker-compose up -d
```

3. **访问系统**
- 前端界面：http://localhost:3001
- 后端API：http://localhost:3000

### 默认账号
- 用户名：admin
- 密码：admin123456

## 🌐 部署说明

### 生产环境部署

1. **服务器要求**
   - CPU：2核以上
   - 内存：4GB以上
   - 存储：40GB以上
   - 系统：Ubuntu 20.04+

2. **域名配置**
   ```
   edm.yourdomain.com      → 管理界面
   api.yourdomain.com      → API服务
   track.yourdomain.com    → 追踪服务
   ```

3. **一键部署**
   ```bash
   ./deploy/deploy.sh
   ```

## 📊 系统架构

```
┌─────────────────┐    ┌─────────────────┐
│   前端 (React)   │    │  后端 (Node.js)  │
│                │    │                │
│  ┌───────────┐  │    │  ┌───────────┐  │
│  │ 用户界面   │  │◄──►│  │ API服务   │  │
│  │ 管理后台   │  │    │  │ 任务调度   │  │
│  └───────────┘  │    │  │ 邮件发送   │  │
└─────────────────┘    │  └───────────┘  │
                      │                │
                      │  ┌───────────┐  │
                      │  │ PostgreSQL│  │
                      │  │ Redis     │  │
                      │  └───────────┘  │
                      └─────────────────┘
```

## 🔧 配置说明

### 环境变量
```bash
# 数据库配置
DATABASE_URL=postgresql://user:password@localhost:5432/amt_mail_system

# Redis配置
REDIS_URL=redis://localhost:6379

# 邮件服务配置
ENGAGELAB_API_USER=your_api_user
ENGAGELAB_API_KEY=your_api_key

# 追踪配置
TRACKING_BASE_URL=https://track.yourdomain.com
```

## 📝 API文档

### 认证
```bash
# 登录
POST /api/auth/login
{
  "usernameOrEmail": "admin",
  "password": "admin123456"
}

# 获取用户信息
GET /api/auth/me
Authorization: Bearer <token>
```

### 邮件追踪
```bash
# 邮件打开追踪
GET /api/tracking/open/:subTaskId

# 邮件点击追踪
GET /api/tracking/click/:subTaskId?url=<original_url>

# Webhook处理
POST /api/tracking/webhook/engagelab
```

## 🔒 安全特性

- JWT身份认证
- 密码加密存储
- SQL注入防护
- XSS攻击防护
- CORS跨域配置
- 请求频率限制

## 📈 监控和日志

- 系统健康检查：`GET /health`
- 详细的操作日志
- 邮件发送状态追踪
- 性能监控指标

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 📞 支持

如有问题，请创建 [Issue](../../issues) 或联系开发团队。

---

**版本**: v1.0.0  
**最后更新**: 2025-06-13 