# EDM系统部署工具使用指南

## 📁 文件说明

- `PRODUCTION_DEPLOYMENT_GUIDE.md` - 完整的生产环境部署规范文档
- `../scripts/deploy-production.sh` - 自动化部署脚本
- `../scripts/check-config.sh` - 配置检查脚本

## 🚀 快速开始

### 1. 部署前检查
在每次部署前，先运行配置检查脚本：

```bash
./scripts/check-config.sh
```

这个脚本会检查：
- 必要文件是否存在
- 前端配置是否正确（无硬编码URL）
- 后端CORS配置
- Docker配置
- 环境变量完整性

### 2. 执行部署
配置检查通过后，执行部署：

```bash
# 部署所有服务到默认服务器
./scripts/deploy-production.sh

# 部署到指定服务器
./scripts/deploy-production.sh 192.168.1.100

# 只部署前端服务
./scripts/deploy-production.sh 43.135.38.15 frontend

# 只部署后端服务
./scripts/deploy-production.sh 43.135.38.15 backend
```

### 3. 回滚操作
如果部署出现问题，可以快速回滚：

```bash
ROLLBACK=1 ./scripts/deploy-production.sh 43.135.38.15
```

## 🔧 版本迭代流程

### 标准流程
1. **开发完成** - 在本地完成功能开发
2. **配置检查** - 运行 `./scripts/check-config.sh`
3. **修复问题** - 根据检查结果修复配置问题
4. **执行部署** - 运行 `./scripts/deploy-production.sh`
5. **验证功能** - 检查网站和API是否正常

### 紧急回滚
如果生产环境出现问题：
```bash
ROLLBACK=1 ./scripts/deploy-production.sh
```

## ⚠️ 重要注意事项

### 部署前必须检查
- [ ] 前端代码无硬编码 `localhost:3000`
- [ ] CORS配置包含正确的域名/IP
- [ ] 前端使用生产构建而非开发模式
- [ ] 环境变量配置完整

### 常见错误避免
1. **CORS错误** - 确保 `CORS_ORIGIN` 包含所有访问域名
2. **API访问失败** - 检查前端API配置使用相对路径 `/api`
3. **前端白屏** - 确保使用 `npm run build` 而非 `npm start`
4. **数据库连接失败** - 检查数据库健康状态

## 📊 监控和维护

### 日常检查命令
```bash
# 检查容器状态
ssh ubuntu@服务器IP 'docker ps -a'

# 检查服务日志
ssh ubuntu@服务器IP 'docker logs edm-backend-prod --tail 50'

# 检查网站访问
curl -I http://tkmail.fun/

# 检查API接口
curl -X POST http://tkmail.fun/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usernameOrEmail":"admin","password":"admin123456"}'
```

### 备份管理
部署脚本会自动创建备份，备份目录格式：
```
/opt/edm-backup-YYYYMMDD-HHMMSS/
```

手动清理旧备份：
```bash
ssh ubuntu@服务器IP 'sudo find /opt -name "edm-backup-*" -mtime +7 -exec rm -rf {} \;'
```

## 🆘 故障排除

### 部署失败
1. 检查配置文件是否正确
2. 查看部署脚本输出的错误信息
3. 检查服务器磁盘空间和内存
4. 查看Docker容器日志

### 网站无法访问
1. 检查nginx容器状态
2. 检查域名DNS解析
3. 检查服务器防火墙设置
4. 查看nginx日志

### API接口错误
1. 检查后端容器状态
2. 检查CORS配置
3. 检查数据库连接
4. 查看后端应用日志

## 📞 技术支持

如遇到问题，请按以下顺序排查：
1. 运行配置检查脚本
2. 查看详细的部署规范文档
3. 检查容器和应用日志
4. 尝试回滚到上一个版本

---

**最后更新**: 2025-06-14  
**工具版本**: v1.0 