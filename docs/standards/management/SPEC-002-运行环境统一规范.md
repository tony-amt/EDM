# EDM系统运行环境统一规范

## 🎯 核心原则

**本项目统一采用Docker Compose作为唯一官方运行方式，禁止其他启动方式！**

## 📋 统一运行标准

### 1. 唯一运行方式
- **生产环境**：Docker Compose
- **开发环境**：Docker Compose 
- **测试环境**：Docker Compose
- **UAT环境**：Docker Compose

### 2. 统一端口配置
```yaml
服务端口分配：
- 前端服务：3001
- 后端API：3000
- PostgreSQL：5432
- pgAdmin：5050
- Redis：6379 (暂时禁用)
```

### 3. 统一数据库
- **数据库类型**：PostgreSQL 14
- **连接配置**：从`config/ports.json`统一读取
- **初始化脚本**：`db_init_scripts/`目录

## 🚀 标准启动流程

### 启动命令
```bash
# 1. 停止所有进程，清理环境
sudo lsof -ti:3000,3001,5432 | xargs kill -9 2>/dev/null || true

# 2. 启动所有服务（唯一方式）
docker-compose up -d

# 3. 查看服务状态
docker-compose ps

# 4. 查看日志
docker-compose logs -f
```

### 停止命令
```bash
# 停止所有服务
docker-compose down

# 完全清理（包括数据卷）
docker-compose down -v
```

## 🔧 环境验证标准

### 服务健康检查
```bash
# 后端健康检查
curl http://localhost:3000/health

# 前端访问检查
curl http://localhost:3001

# 数据库连接检查
docker-compose exec postgres psql -U postgres -d amt_mail_system -c "SELECT version();"
```

### 预期响应
- 后端：返回JSON健康状态
- 前端：返回React应用页面
- 数据库：返回版本信息

## ⚠️ Docker容器间API调用重要注意事项

### 前后端通信规范
**🚨 关键问题：Docker容器间不能使用相对路径！**

在Docker环境中，前端和后端运行在不同的容器中：
- 前端容器：端口3001
- 后端容器：端口3000
- 它们之间无法通过相对路径`/api`通信

### 正确的API配置方式

#### ❌ 错误配置（相对路径）
```javascript
// 这样在Docker环境中会失败
const api = axios.create({
  baseURL: '/api'  // ❌ 相对路径在容器间不工作
});
```

#### ✅ 正确配置（完整URL）
```javascript
// 正确的配置方式
const getApiBaseURL = () => {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  // Docker环境：使用完整URL指向后端容器端口
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:3000/api`;
  }
  
  // 生产环境可能使用代理或相对路径
  return process.env.REACT_APP_API_BASE_URL || '/api';
};
```

### 常见问题和解决方案

#### 问题1：API调用失败
- **现象**：前端登录按钮点击无响应，Network面板无API请求
- **原因**：相对路径`/api`指向前端容器3001端口，而非后端3000端口
- **解决**：使用完整URL `http://localhost:3000/api`

#### 问题2：参数字段不匹配
- **现象**：API返回"参数错误"或"字段缺失"
- **原因**：前后端字段名不一致（如`username` vs `usernameOrEmail`）
- **解决**：统一字段命名或在前端进行字段转换

#### 问题3：前端显示静态HTML
- **现象**：页面修改不生效，显示的是后端返回的HTML
- **原因**：前端容器未正确启动React开发服务器
- **解决**：确保`docker-compose logs frontend`显示webpack编译成功

### Docker环境调试检查清单

- [ ] 前端容器显示"webpack compiled successfully"
- [ ] 前端API配置使用完整URL而非相对路径
- [ ] 前后端字段命名保持一致
- [ ] 浏览器Network面板能看到API请求
- [ ] API请求指向正确的3000端口

## 📁 配置文件统一管理

### 主配置文件
- `config/ports.json` - 端口配置
- `docker-compose.yml` - 服务定义
- `.env.example` - 环境变量模板

### 禁用文件列表
以下文件/脚本被禁用，不得使用：
- ❌ `run_local_all.sh`
- ❌ `start-services.js` 
- ❌ `dev-server.js`
- ❌ 任何本地npm启动方式

## 🧪 测试环境统一

### E2E测试环境
```bash
# 测试前环境准备
docker-compose up -d
sleep 30  # 等待服务启动

# 执行测试
npm run test:e2e-playwright-all

# 测试后清理
docker-compose down
```

## 🐛 故障排除

### 常见问题解决
1. **端口占用**：使用 `sudo lsof -ti:PORT | xargs kill -9`
2. **容器无法启动**：检查Docker Desktop是否运行
3. **数据库连接失败**：等待healthcheck通过
4. **前端无法访问**：检查容器日志是否有构建错误

## 📊 监控和日志

### 服务监控
```bash
# 实时查看所有服务状态
watch docker-compose ps

# 查看特定服务日志
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

## 🚨 强制执行

### 违规处理
- 发现使用非Docker方式运行的代码提交将被拒绝
- UAT测试必须在Docker环境下进行
- 所有部署必须基于docker-compose.yml

### 变更管理
- 任何端口变更必须同时更新所有相关配置文件
- 环境变量变更必须在docker-compose.yml中体现
- 新增服务必须添加到docker-compose.yml中

## 📝 检查清单

### 开发前检查
- [ ] Docker Desktop已启动
- [ ] 端口3000,3001,5432未被占用
- [ ] `config/ports.json`配置正确

### 部署前检查  
- [ ] docker-compose.yml配置验证
- [ ] 环境变量设置正确
- [ ] 数据库初始化脚本准备完毕

### UAT测试前检查
- [ ] 使用`docker-compose up -d`启动
- [ ] 所有服务健康检查通过
- [ ] 端口访问验证通过

---

**记住：统一！统一！统一！只有一种正确的运行方式！** 