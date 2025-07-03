# 🚀 部署配置

本目录包含项目部署相关的所有配置文件和脚本。

## 📂 目录结构

### 🐳 docker/ - Docker配置
- `docker-compose.debug.yml` - 调试环境Docker配置
- `docker-compose.prod.yml` - 生产环境Docker配置
- Dockerfile配置文件

### 🌐 nginx/ - Nginx配置
- `nginx.conf` - Nginx主配置文件
- `nginx.production.conf` - 生产环境配置
- 反向代理配置

### 🔒 ssl/ - SSL证书配置
- `setup-https.sh` - HTTPS设置脚本
- `update-nginx-ssl.sh` - SSL证书更新脚本
- 证书文件存储

### 📜 scripts/ - 部署脚本
- 自动化部署脚本
- 健康检查脚本
- 回滚脚本

### 📄 配置文件
- `deploy.sh` - 主部署脚本
- `backup.sh` - 备份脚本
- `production.env` - 生产环境变量
- `manual-deploy-steps.md` - 手动部署步骤

## 🚀 部署流程

### 1. 开发环境部署
```bash
# 使用调试配置
docker-compose -f docker-compose.yml -f deploy/docker/docker-compose.debug.yml up -d
```

### 2. 生产环境部署
```bash
# 执行主部署脚本
./deploy/deploy.sh

# 或使用生产配置
docker-compose -f docker-compose.yml -f deploy/docker/docker-compose.prod.yml up -d
```

### 3. HTTPS配置
```bash
# 设置SSL证书
./deploy/ssl/setup-https.sh

# 更新SSL证书
./deploy/ssl/update-nginx-ssl.sh
```

## 🔧 配置说明

### 环境变量
- `production.env` - 生产环境变量配置
- 包含数据库连接、API密钥等敏感信息

### 端口配置
- 前端: 3001
- 后端: 3000
- 数据库: 5432
- Redis: 6379

### 域名配置
- 主域名: tkmail.fun
- API域名: api.tkmail.fun
- 管理后台: admin.tkmail.fun

## 📋 部署检查清单

### 部署前检查
- [ ] 代码已合并到main分支
- [ ] 所有测试通过
- [ ] 环境变量已配置
- [ ] 数据库迁移已准备

### 部署后验证
- [ ] 服务健康检查通过
- [ ] 前端页面正常访问
- [ ] API接口正常响应
- [ ] 数据库连接正常

## 🛠️ 故障排除

### 常见问题
1. **容器启动失败**: 检查端口占用和环境变量
2. **SSL证书问题**: 检查域名解析和证书有效期
3. **数据库连接失败**: 检查网络和认证配置
4. **前端资源404**: 检查nginx配置和文件路径

### 日志查看
```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f frontend
docker-compose logs -f backend
``` 