# EDM系统部署指南

## 1. 系统环境要求

### 1.1 服务器要求

- **操作系统**: Ubuntu 20.04 LTS / CentOS 8 / macOS 12+
- **CPU**: 2核或以上
- **内存**: 最小4GB，推荐8GB
- **存储**: 50GB可用空间
- **网络**: 可访问公网，开放必要端口

### 1.2 软件环境要求

- **Node.js**: v16.x 或更高
- **MongoDB**: v5.0 或更高
- **NPM**: v8.x 或更高
- **Docker** (可选): v20.x 或更高
- **Docker Compose** (可选): v2.x 或更高

## 2. 部署准备

### 2.1 安装基础软件

#### Node.js 安装

```bash
# 使用 nvm 安装 Node.js (推荐)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
source ~/.bashrc
nvm install 16
nvm use 16
```

#### MongoDB 安装

```bash
# Ubuntu 安装方式
wget -qO - https://www.mongodb.org/static/pgp/server-5.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-5.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

### 2.2 获取源代码

```bash
# 克隆项目仓库
git clone https://github.com/your-org/edm-system.git
cd edm-system
```

## 3. 标准部署流程

### 3.1 配置环境变量

在项目根目录创建 `.env` 文件:

```bash
# 后端服务器配置
PORT=5000
NODE_ENV=production

# 数据库配置
MONGO_URI=mongodb://localhost:27017/edm_production

# JWT密钥 (务必修改为强密钥)
JWT_SECRET=your-strong-secret-key-here
JWT_EXPIRE=30d

# 邮件服务配置 (根据实际需要配置)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-email-password
EMAIL_FROM=no-reply@your-domain.com

# 其他配置
MAX_FILE_UPLOAD=5
```

### 3.2 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装后端依赖
cd src/backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 3.3 构建前端

```bash
# 在frontend目录下
npm run build
```

### 3.4 启动服务

#### 开发环境启动

```bash
# 在项目根目录
npm run dev
```

#### 生产环境启动

```bash
# 在项目根目录
npm start

# 或使用PM2进行进程管理(推荐)
npm install -g pm2
pm2 start src/index.js --name edm-system
```

## 4. Docker 部署流程

### 4.1 使用 Docker Compose

```bash
# 在项目根目录下
docker-compose up -d
```

这将启动:
- MongoDB 数据库容器
- 后端 API 服务容器
- 前端 Nginx 服务容器

### 4.2 单独构建镜像

```bash
# 构建后端镜像
docker build -t edm-backend -f Dockerfile.backend .

# 构建前端镜像
docker build -t edm-frontend -f Dockerfile.frontend .

# 运行后端容器
docker run -d -p 5000:5000 --name edm-backend \
  -e MONGO_URI=mongodb://mongo:27017/edm \
  --network edm-network \
  edm-backend

# 运行前端容器
docker run -d -p 80:80 --name edm-frontend \
  --network edm-network \
  edm-frontend
```

## 5. 部署验证

### 5.1 健康检查

```bash
# 检查后端API
curl http://localhost:5000/api/health

# 预期输出:
# {"status":"success","message":"API服务正常运行"}
```

### 5.2 功能验证

1. 打开浏览器访问 `http://服务器IP地址`
2. 使用管理员账号登录系统
   - 默认用户名: `admin@example.com`
   - 默认密码: `admin123`
   - **注意**: 首次登录后请立即修改默认密码

3. 验证关键功能:
   - 创建新联系人
   - 创建新标签
   - 将标签应用到联系人

### 5.3 日志检查

```bash
# 查看应用日志
tail -f logs/app.log

# 查看错误日志
tail -f logs/error.log
```

## 6. 常见问题与解决方案

### 6.1 连接数据库失败

**症状**: 服务启动时报告无法连接到MongoDB

**解决方案**:
1. 确认MongoDB服务正在运行: `systemctl status mongod`
2. 检查MongoDB连接字符串是否正确
3. 确认MongoDB端口(27017)未被防火墙阻止

### 6.2 前端无法访问API

**症状**: 前端页面加载但无法获取数据

**解决方案**:
1. 检查浏览器控制台中的错误信息
2. 确认API服务正在运行
3. 检查CORS配置是否正确
4. 确认API路径配置正确

### 6.3 文件上传失败

**症状**: 无法导入联系人或上传文件

**解决方案**:
1. 检查上传目录权限: `chmod 755 uploads/`
2. 确认临时目录存在且具有写入权限
3. 检查文件大小是否超过限制
4. 检查磁盘空间是否充足

## 7. 安全建议

1. **更改默认密码**: 首次部署后立即更改默认管理员密码
2. **使用HTTPS**: 配置SSL证书并启用HTTPS
3. **启用防火墙**: 仅开放必要端口
4. **定期备份**: 设置MongoDB数据库的定期备份
5. **日志监控**: 使用ELK或类似工具监控系统日志

## 8. 性能优化

1. **配置MongoDB索引**: 确保所有查询字段都有适当的索引
2. **启用Nginx缓存**: 对静态资源配置适当的缓存策略
3. **使用Redis缓存**: 添加Redis缓存层减轻数据库压力
4. **增加Node.js内存限制**: 对于大型部署，调整Node.js内存限制

---

如需进一步帮助，请联系技术支持团队或参考完整的项目文档。 