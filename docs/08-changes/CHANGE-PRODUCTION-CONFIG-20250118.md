# 生产配置文件升级记录

**变更编号**: CHANGE-PRODUCTION-CONFIG-20250118  
**变更时间**: 2025-01-18  
**变更类型**: 功能扩展  
**影响范围**: 生产环境部署配置  

## 📋 变更概述

基于现有的 `docker-compose.prod.yml` 生产配置进行功能扩展，新增会话管理、图片处理、追踪像素和EngageLab webhook功能支持。

## 🎯 变更原因

- 用户需要会话管理功能
- 需要图片上传和处理能力
- 需要邮件追踪像素功能
- 需要EngageLab webhook回调处理
- 避免多套生产配置造成混乱

## 🔧 具体变更内容

### 1. Docker Compose配置变更

#### 后端服务升级
```yaml
# 新增环境变量
PUBLIC_DOMAIN: tkmail.fun
TRACKING_BASE_URL: https://tkmail.fun
WEBHOOK_BASE_URL: https://tkmail.fun
IMAGE_UPLOAD_PATH: /app/public/uploads/images
IMAGE_MAX_SIZE: 10485760  # 10MB
IMAGE_ALLOWED_TYPES: "jpg,jpeg,png,gif,webp"

# 新增数据卷
- ./data/uploads:/app/public/uploads
- ./logs:/app/logs
```

#### 前端服务升级
```yaml
# 新增环境变量
REACT_APP_API_BASE_URL: /api
REACT_APP_TRACKING_BASE_URL: https://tkmail.fun
REACT_APP_IMAGE_BASE_URL: https://tkmail.fun/uploads
```

#### 新增服务

**图片处理服务**
- 容器名: `edm-image-service`
- 端口: `8082:8082`
- 功能: 图片上传、缩略图生成、格式转换

**追踪像素服务**
- 容器名: `edm-tracking-service`
- 端口: `8081:8081`
- 功能: 邮件打开跟踪、点击统计

**Webhook服务**
- 容器名: `edm-webhook-service`
- 端口: `8083:8083`
- 功能: EngageLab回调处理

### 2. Nginx配置升级

#### 服务代理配置
```nginx
# 新增上游服务
upstream image-service { server image-service:8082; }
upstream tracking-service { server tracking-service:8081; }
upstream webhook-service { server webhook-service:8083; }
```

#### 路由配置
```nginx
# EngageLab Webhook
location /webhook/ { proxy_pass http://webhook-service/; }

# 追踪像素
location /track/ { proxy_pass http://tracking-service/; }

# 图片上传API
location /image-api/ { proxy_pass http://image-service/; }

# 静态文件访问
location /uploads/ { alias /var/www/uploads/; }
```

### 3. 端口分配规划

| 服务 | 内部端口 | 外部端口 | 说明 |
|------|----------|----------|------|
| PostgreSQL | 5432 | 5432 | 数据库 |
| Redis | 6379 | 6379 | 缓存 |
| Backend | 8080 | 8080 | API服务 |
| Frontend | 80 | - | React应用 |
| Nginx | 80/443 | 80/443 | 反向代理 |
| Image Service | 8082 | 8082 | 图片处理 |
| Tracking Service | 8081 | 8081 | 追踪像素 |
| Webhook Service | 8083 | 8083 | Webhook处理 |

## 🗑️ 清理操作

删除了重复的生产配置文件：
- ❌ `docker-compose.production.yml` (重复配置)
- ✅ `docker-compose.prod.yml` (保留使用)

## 📂 文件结构影响

### 新增目录结构
```
├── services/
│   ├── image-service/       # 图片处理服务
│   ├── tracking-service/    # 追踪像素服务
│   └── webhook-service/     # Webhook服务
└── data/
    └── uploads/             # 上传文件存储
```

### 配置文件变更
- `docker-compose.prod.yml` - 主要变更文件
- `nginx/nginx.conf` - 路由配置更新

## 🧪 测试要求

### 部署前测试
1. **配置验证**
   ```bash
   docker compose -f docker-compose.prod.yml config
   ```

2. **端口冲突检查**
   ```bash
   netstat -tlnp | grep -E "(8080|8081|8082|8083)"
   ```

### 部署后验证
1. **服务健康检查**
   ```bash
   docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
   ```

2. **功能测试**
   - 网站访问: `curl -I http://tkmail.fun/`
   - API测试: `curl -X POST http://tkmail.fun/api/auth/login`
   - 会话功能: 检查会话列表和详情页面
   - 图片上传: 测试图片上传和访问
   - 追踪像素: 验证 `/track/` 端点
   - Webhook: 验证 `/webhook/engagelab` 端点

## ⚠️ 注意事项

1. **数据持久化**: 新增 `./data/uploads` 目录需要确保权限正确
2. **环境变量**: 生产环境需要配置 `WEBHOOK_SECRET` 环境变量
3. **依赖服务**: 图片服务和追踪服务需要先构建对应的Docker镜像
4. **服务启动顺序**: webhook-service 依赖 backend 服务先启动

## 🔄 回滚方案

如果部署出现问题，回滚步骤：

1. **停止新服务**
   ```bash
   docker compose -f docker-compose.prod.yml down
   ```

2. **恢复简化配置**
   ```bash
   git checkout HEAD~ -- docker-compose.prod.yml nginx/nginx.conf
   ```

3. **重新部署**
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

## 📞 联系方式

如遇到部署问题，请检查：
1. 容器日志: `docker logs 容器名`
2. 端口占用: `netstat -tlnp`
3. 配置文件语法: `docker compose config`

---

**变更负责人**: Tony  
**审核状态**: ✅ 已完成  
**部署状态**: 🟡 阶段一完成，待扩展

## 🔄 实施计划

### 阶段一：基础配置升级（✅ 已完成）
- [x] 删除重复的生产配置文件
- [x] 升级现有的 `docker-compose.prod.yml`
- [x] 添加图片和追踪相关环境变量
- [x] 更新Nginx配置支持新路由
- [x] 创建配置验证脚本

### 阶段二：微服务实现（🟡 计划中）
- [ ] 创建 `services/` 目录结构
- [ ] 实现图片处理服务
- [ ] 实现追踪像素服务
- [ ] 实现EngageLab webhook服务
- [ ] 启用Docker Compose中的注释服务

### 阶段三：功能集成测试（⏳ 待开始）
- [ ] 端到端功能测试
- [ ] 生产环境部署验证
- [ ] EngageLab webhook回调测试 