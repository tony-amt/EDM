# EDM系统 - 后端服务

## ⚠️ 重要提醒

**请使用项目根目录的统一启动方式，不要在此目录单独启动后端服务！**

所有开发和部署都必须通过Docker Compose进行：

```bash
# 回到项目根目录
cd ../../

# 使用统一启动脚本
./start-edm-system.sh
```

## 🏗️ 技术栈

- Node.js 18
- Express.js
- PostgreSQL 14 (通过Docker)
- Sequelize ORM
- JWT认证

## 📁 目录结构

```
src/backend/
  ├── src/
  │   ├── config/         # 配置文件
  │   ├── controllers/    # 控制器
  │   ├── middlewares/    # 中间件
  │   ├── models/         # 数据模型
  │   ├── routes/         # 路由
  │   ├── services/       # 服务层
  │   ├── utils/          # 工具函数
  │   └── index.js        # 入口文件
  ├── tests/              # 后端测试
  ├── Dockerfile          # Docker配置
  └── package.json        # 依赖配置
```

## 🔌 API接口

### 认证相关
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户信息

### 联系人管理
- `GET /api/contacts` - 获取联系人列表
- `POST /api/contacts` - 创建联系人
- `PUT /api/contacts/:id` - 更新联系人
- `DELETE /api/contacts/:id` - 删除联系人

### 标签管理
- `GET /api/tags` - 获取标签列表
- `POST /api/tags` - 创建标签
- `PUT /api/tags/:id` - 更新标签
- `DELETE /api/tags/:id` - 删除标签

### 模板管理
- `GET /api/templates` - 获取模板列表
- `POST /api/templates` - 创建模板
- `PUT /api/templates/:id` - 更新模板
- `DELETE /api/templates/:id` - 删除模板

## 🧪 开发调试

如需查看后端日志：

```bash
# 在项目根目录执行
docker-compose logs -f backend
```

如需进入后端容器调试：

```bash
# 在项目根目录执行
docker-compose exec backend bash
```

## 📋 注意事项

- 所有环境变量在 `docker-compose.yml` 中统一管理
- 数据库连接自动通过Docker网络建立
- 不要在此目录单独安装依赖或启动服务
- 后端健康检查地址：http://localhost:3000/health

---

**请遵循项目统一规范，使用Docker方式开发和部署！** 