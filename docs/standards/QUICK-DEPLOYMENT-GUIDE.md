# 🚀 生产环境快速操作手册

> **适用于**: tkmail.fun EDM系统  
> **服务器**: 43.135.38.15 (ubuntu用户)  
> **最后更新**: 2025-06-14

---

## 🔧 **常用操作命令**

### **连接服务器**
```bash
ssh ubuntu@43.135.38.15
cd /opt/edm
```

### **查看服务状态**
```bash
# 查看所有容器状态
sudo docker compose -f docker-compose.prod.yml ps

# 查看特定服务状态
sudo docker compose -f docker-compose.prod.yml ps frontend
sudo docker compose -f docker-compose.prod.yml ps backend
```

### **查看服务日志**
```bash
# 查看前端日志
sudo docker logs edm-frontend-prod --tail 50

# 查看后端日志
sudo docker logs edm-backend-prod --tail 50

# 查看数据库日志
sudo docker logs edm-postgres-prod --tail 30

# 实时跟踪日志
sudo docker logs -f edm-backend-prod
```

---

## 🔄 **部署和更新操作**

### **更新代码**
```bash
# 拉取最新代码
git pull

# 查看当前分支和状态
git status
git log --oneline -5
```

### **重新构建服务**
```bash
# 重新构建前端
sudo docker compose -f docker-compose.prod.yml build --no-cache frontend
sudo docker compose -f docker-compose.prod.yml up -d frontend

# 重新构建后端
sudo docker compose -f docker-compose.prod.yml build --no-cache backend
sudo docker compose -f docker-compose.prod.yml up -d backend

# 重新构建所有服务
sudo docker compose -f docker-compose.prod.yml build --no-cache
sudo docker compose -f docker-compose.prod.yml up -d
```

### **重启服务**
```bash
# 重启单个服务
sudo docker compose -f docker-compose.prod.yml restart frontend
sudo docker compose -f docker-compose.prod.yml restart backend

# 重启所有服务
sudo docker compose -f docker-compose.prod.yml restart
```

---

## 🛠️ **故障排查**

### **检查服务健康状态**
```bash
# 检查容器运行状态
sudo docker compose -f docker-compose.prod.yml ps

# 检查容器资源使用
sudo docker stats

# 检查系统资源
htop
df -h
free -h
```

### **网络连接测试**
```bash
# 测试API接口
curl -X POST https://api.tkmail.fun/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usernameOrEmail":"admin","password":"admin123456"}'

# 测试前端页面
curl -I https://tkmail.fun

# 测试数据库连接
sudo docker exec edm-postgres-prod pg_isready -U postgres
```

### **查看错误日志**
```bash
# 查看系统日志
sudo journalctl -u docker -f

# 查看Nginx日志
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# 查看容器详细信息
sudo docker inspect edm-frontend-prod
sudo docker inspect edm-backend-prod
```

---

## 🔧 **配置修改**

### **修改环境变量**
```bash
# 编辑生产环境配置
sudo nano docker-compose.prod.yml

# 查看当前配置
grep -A 10 -B 5 "REACT_APP_API_BASE_URL" docker-compose.prod.yml
```

### **修改Nginx配置**
```bash
# 编辑Nginx配置
sudo nano /etc/nginx/sites-available/tkmail.fun

# 测试配置
sudo nginx -t

# 重新加载配置
sudo systemctl reload nginx
```

---

## 📊 **监控和维护**

### **查看系统状态**
```bash
# 系统负载
uptime

# 磁盘使用
df -h

# 内存使用
free -h

# 网络连接
netstat -tulpn | grep :80
netstat -tulpn | grep :443
```

### **数据库维护**
```bash
# 连接数据库
sudo docker exec -it edm-postgres-prod psql -U postgres -d amt_mail_system

# 查看数据库大小
sudo docker exec edm-postgres-prod psql -U postgres -d amt_mail_system -c "
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"

# 备份数据库
sudo docker exec edm-postgres-prod pg_dump -U postgres amt_mail_system > backup_$(date +%Y%m%d_%H%M%S).sql
```

---

## 🚨 **应急操作**

### **快速回滚**
```bash
# 停止有问题的服务
sudo docker compose -f docker-compose.prod.yml stop frontend

# 回滚到上一个镜像
sudo docker tag edm-frontend:previous edm-frontend:latest
sudo docker compose -f docker-compose.prod.yml up -d frontend

# 或者重新构建上一个版本
git checkout HEAD~1
sudo docker compose -f docker-compose.prod.yml build --no-cache frontend
sudo docker compose -f docker-compose.prod.yml up -d frontend
git checkout main
```

### **紧急重启**
```bash
# 强制重启所有服务
sudo docker compose -f docker-compose.prod.yml down
sudo docker compose -f docker-compose.prod.yml up -d

# 清理无用的Docker资源
sudo docker system prune -f
sudo docker volume prune -f
```

### **服务器重启**
```bash
# 重启服务器（谨慎操作）
sudo reboot

# 重启后检查服务自启动
sudo systemctl status docker
sudo systemctl status nginx
```

---

## 🔍 **常见问题解决**

### **前端无法访问**
```bash
# 1. 检查前端容器状态
sudo docker compose -f docker-compose.prod.yml ps frontend

# 2. 查看前端日志
sudo docker logs edm-frontend-prod --tail 50

# 3. 重启前端服务
sudo docker compose -f docker-compose.prod.yml restart frontend

# 4. 检查Nginx配置
sudo nginx -t
sudo systemctl status nginx
```

### **API接口报错**
```bash
# 1. 检查后端容器状态
sudo docker compose -f docker-compose.prod.yml ps backend

# 2. 查看后端日志
sudo docker logs edm-backend-prod --tail 50

# 3. 检查数据库连接
sudo docker exec edm-postgres-prod pg_isready -U postgres

# 4. 重启后端服务
sudo docker compose -f docker-compose.prod.yml restart backend
```

### **数据库连接失败**
```bash
# 1. 检查数据库容器状态
sudo docker compose -f docker-compose.prod.yml ps postgres

# 2. 查看数据库日志
sudo docker logs edm-postgres-prod --tail 30

# 3. 检查数据库进程
sudo docker exec edm-postgres-prod ps aux | grep postgres

# 4. 重启数据库（谨慎操作）
sudo docker compose -f docker-compose.prod.yml restart postgres
```

---

## 📋 **快速检查清单**

### **日常检查**
- [ ] 所有容器运行正常
- [ ] 前端页面可以访问
- [ ] API接口响应正常
- [ ] 数据库连接正常
- [ ] 磁盘空间充足 (< 80%)
- [ ] 内存使用正常 (< 80%)
- [ ] 无异常错误日志

### **部署后检查**
- [ ] 新版本部署成功
- [ ] 登录功能正常
- [ ] 核心功能验证
- [ ] 性能指标正常
- [ ] 无新增错误日志
- [ ] 用户反馈正常

---

## 📞 **紧急联系**

```
技术负责人: [联系方式]
运维负责人: [联系方式]
项目经理: [联系方式]
```

---

## 🔗 **相关链接**

- **生产环境**: https://tkmail.fun
- **API文档**: https://api.tkmail.fun/docs
- **监控面板**: [监控系统地址]
- **代码仓库**: https://github.com/tony-amt/EDM

---

**⚠️ 注意事项**:
1. 所有生产环境操作都要谨慎
2. 重要操作前先备份
3. 操作后及时验证结果
4. 遇到问题及时上报 