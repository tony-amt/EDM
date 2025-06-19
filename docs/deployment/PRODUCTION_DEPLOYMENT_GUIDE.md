# EDM系统生产环境部署规范

## 📋 目录
- [部署架构](#部署架构)
- [环境要求](#环境要求)
- [部署流程](#部署流程)
- [配置规范](#配置规范)
- [常见问题](#常见问题)
- [监控检查](#监控检查)
- [版本迭代](#版本迭代)

## 🏗️ 部署架构

### 服务组件
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Nginx (80)    │───▶│  Frontend (80)  │    │  Backend (8080) │
│   反向代理       │    │  React静态文件   │    │  Node.js API    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                       ┌─────────────────┐    ┌─────────────────┐
                       │  Redis (6379)   │    │ PostgreSQL      │
                       │  缓存服务        │    │ (5432)          │
                       └─────────────────┘    └─────────────────┘
```

### 端口映射
- **80/443**: Nginx (对外访问)
- **5432**: PostgreSQL (数据库)
- **6379**: Redis (缓存)
- **内部**: Frontend (80), Backend (8080)

## 🔧 环境要求

### 服务器配置
- **操作系统**: Ubuntu 20.04+ 
- **内存**: 最低4GB，推荐8GB+
- **存储**: 最低20GB，推荐50GB+
- **Docker**: 20.10+
- **Docker Compose**: 2.0+

### 域名配置
- **生产域名**: tkmail.fun
- **DNS解析**: A记录指向服务器IP
- **SSL证书**: 可选，建议配置

## 🚀 部署流程

### 1. 服务器准备
```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. 代码部署
```bash
# 创建项目目录
sudo mkdir -p /opt/edm
sudo chown -R ubuntu:ubuntu /opt/edm

# 上传代码到 /opt/edm/
# 确保包含以下关键文件：
# - docker-compose.prod.yml
# - nginx/nginx.conf
# - src/frontend/ (包含修复后的配置)
# - src/backend/
```

### 3. 环境配置检查
```bash
# 检查关键配置文件
cat /opt/edm/docker-compose.prod.yml | grep -E "(CORS_ORIGIN|NODE_ENV|REACT_APP)"
cat /opt/edm/src/frontend/src/config/constants.ts | head -5
cat /opt/edm/nginx/nginx.conf | grep -E "(proxy_pass|listen)"
```

### 4. 启动服务
```bash
cd /opt/edm

# 停止旧服务（如果存在）
sudo docker compose -f docker-compose.prod.yml down

# 构建并启动
sudo docker compose -f docker-compose.prod.yml build --no-cache
sudo docker compose -f docker-compose.prod.yml up -d

# 检查服务状态
docker ps -a
```

## ⚙️ 配置规范

### 前端配置要点

#### 1. API配置统一
```typescript
// src/frontend/src/config/constants.ts
export const API_URL = process.env.REACT_APP_API_BASE_URL || '/api';

// src/frontend/src/services/api.ts
const getApiUrl = () => {
  if (process.env.REACT_APP_API_BASE_URL) {
    return process.env.REACT_APP_API_BASE_URL;
  }
  return '/api';
};
```

#### 2. Dockerfile生产构建
```dockerfile
# 多阶段构建：构建阶段
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci

# 设置构建环境变量
ENV REACT_APP_API_BASE_URL=/api
ENV NODE_ENV=production

COPY . .
RUN npm run build

# 生产阶段：nginx静态文件服务
FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### 3. 前端nginx配置
```nginx
# src/frontend/nginx.conf
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 后端配置要点

#### 1. CORS配置
```yaml
# docker-compose.prod.yml
environment:
  CORS_ORIGIN: "http://tkmail.fun,https://tkmail.fun,http://43.135.38.15"
  NODE_ENV: production
  PORT: 8080
```

#### 2. 数据库配置
```yaml
postgres:
  environment:
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
    POSTGRES_DB: amt_mail_system
  volumes:
    - ./data/postgres:/var/lib/postgresql/data
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres -d amt_mail_system"]
```

### Nginx反向代理配置

```nginx
# nginx/nginx.conf
server {
    listen 80;
    server_name tkmail.fun;

    # 前端静态文件
    location / {
        proxy_pass http://frontend:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 后端API
    location /api/ {
        proxy_pass http://backend:8080/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_buffering off;
    }
}
```

## ❌ 常见问题与解决方案

### 1. CORS错误
**症状**: 前端显示"网络连接失败"，控制台显示CORS错误
**原因**: 后端CORS配置缺少域名/IP
**解决**: 
```yaml
environment:
  CORS_ORIGIN: "http://域名,https://域名,http://服务器IP"
```

### 2. 前端访问localhost:3000
**症状**: 前端尝试访问localhost:3000而不是相对路径
**原因**: 前端配置文件硬编码了开发环境URL
**解决**: 检查并修复以下文件
- `src/frontend/src/config/constants.ts`
- `src/frontend/src/config/index.ts`
- `src/frontend/src/services/api.ts`

### 3. 前端开发模式运行
**症状**: 前端使用npm start而不是生产构建
**原因**: Dockerfile使用开发模式
**解决**: 使用多阶段构建，生产阶段用nginx提供静态文件

### 4. 数据库连接失败
**症状**: 后端无法连接数据库
**解决**: 
```bash
# 检查数据库健康状态
docker exec edm-postgres-prod pg_isready -U postgres -d amt_mail_system

# 重建数据库（如果数据损坏）
sudo rm -rf data/postgres/*
docker compose -f docker-compose.prod.yml up -d postgres
```

### 5. 端口冲突
**症状**: 容器启动失败，端口被占用
**解决**:
```bash
# 检查端口占用
sudo netstat -tlnp | grep :80
sudo systemctl stop nginx  # 停止系统nginx
sudo systemctl disable nginx
```

## 📊 监控检查

### 部署后验证清单

#### 1. 容器状态检查
```bash
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
# 所有容器应显示 "Up" 状态
```

#### 2. 服务健康检查
```bash
# 网站访问
curl -I http://tkmail.fun/

# API测试
curl -X POST http://tkmail.fun/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usernameOrEmail":"admin","password":"admin123456"}'

# 数据库连接
docker exec edm-postgres-prod psql -U postgres -d amt_mail_system -c "SELECT 1;"
```

#### 3. 日志检查
```bash
# 检查各服务日志
docker logs edm-nginx-prod --tail 20
docker logs edm-frontend-prod --tail 20  
docker logs edm-backend-prod --tail 20
docker logs edm-postgres-prod --tail 20
```

## 🔄 版本迭代流程

### 1. 代码更新
```bash
# 备份当前版本
sudo cp -r /opt/edm /opt/edm-backup-$(date +%Y%m%d)

# 上传新代码
scp -r ./src ubuntu@服务器IP:/tmp/
ssh ubuntu@服务器IP 'sudo cp -r /tmp/src/* /opt/edm/src/'
```

### 2. 配置检查
```bash
# 检查关键配置是否正确
grep -r "localhost:3000" /opt/edm/src/frontend/src/ || echo "✅ 无硬编码URL"
grep "CORS_ORIGIN" /opt/edm/docker-compose.prod.yml
```

### 3. 滚动更新
```bash
cd /opt/edm

# 仅重建有变更的服务
sudo docker compose -f docker-compose.prod.yml build --no-cache frontend
sudo docker compose -f docker-compose.prod.yml up -d frontend

# 或重建后端
sudo docker compose -f docker-compose.prod.yml build --no-cache backend  
sudo docker compose -f docker-compose.prod.yml up -d backend
```

### 4. 回滚方案
```bash
# 如果部署失败，快速回滚
sudo docker compose -f docker-compose.prod.yml down
sudo rm -rf /opt/edm/src
sudo cp -r /opt/edm-backup-$(date +%Y%m%d)/src /opt/edm/
sudo docker compose -f docker-compose.prod.yml up -d
```

## 🔐 安全注意事项

### 1. 环境变量管理
- 敏感信息使用环境变量
- 定期更换JWT密钥
- 数据库密码使用强密码

### 2. 文件权限
```bash
# 设置正确的文件权限
sudo chown -R ubuntu:ubuntu /opt/edm
chmod 600 /opt/edm/docker-compose.prod.yml
```

### 3. 防火墙配置
```bash
# 只开放必要端口
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

## 📝 部署检查清单

### 部署前检查
- [ ] 服务器资源充足（内存、磁盘）
- [ ] Docker和Docker Compose版本正确
- [ ] 域名DNS解析正确
- [ ] 代码配置文件无硬编码URL
- [ ] 环境变量配置正确

### 部署中检查  
- [ ] 所有容器成功启动
- [ ] 数据库健康检查通过
- [ ] 网络连接正常
- [ ] 日志无错误信息

### 部署后验证
- [ ] 网站首页正常访问
- [ ] 登录功能正常
- [ ] API接口响应正常
- [ ] 前端页面无CORS错误
- [ ] 数据库连接正常

---

## 📞 故障联系

如遇到部署问题，请按以下顺序排查：
1. 检查容器状态和日志
2. 验证配置文件
3. 测试网络连接
4. 查看本文档常见问题部分
5. 如需支持，请提供详细的错误日志

**最后更新**: 2025-06-14
**文档版本**: v1.0 