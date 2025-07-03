# EDM项目nginx架构问题分析与解决方案

**变更编号**: CHANGE-NGINX-ARCHITECTURE-FIX-20250701  
**变更时间**: 2025-07-01  
**变更类型**: 架构修复  
**影响等级**: 高 (HTTPS功能恢复)

## 🎯 问题背景

用户发现EDM项目的nginx容器名称为`gloda_nginx_proxy`，对此产生疑问：
1. 为什么nginx容器叫gloda_nginx_proxy而不是edm相关的名称？
2. 这个项目跟gloda有什么关系？  
3. git main分支上是否也是这样配置的？

## 🔍 问题分析

### 1. **项目身份关系**
经过代码分析，发现：
- **EDM项目是为"Gloda Market"公司开发的邮件营销系统**
- 配置中大量使用gloda相关邮箱：`tony@glodamarket.fun`、`api-glodamarket.fun`
- 测试数据使用：`gloda2024@gmail.com`、`Gloda Market`公司信息
- 发信服务：`极光触发glodamarket.fun`、`极光触发glodamarket.store`

**结论**：EDM是项目技术名称，Gloda Market是客户公司名称。

### 2. **服务器架构混乱**
服务器上同时运行两个独立项目：

```bash
# EDM项目容器 (正确命名)
edm-backend          # 端口3001 ✅
edm-postgres         # 端口5432 ✅
edm-redis           # 端口6379 ✅

# Gloda Channel项目容器  
gloda_channel_backend    # 端口7004
gloda_channel_frontend   # 端口7005
gloda_channel_mysql      # 端口7002
gloda_channel_redis      # 端口7003

# 共享nginx代理 (问题根源)
gloda_nginx_proxy        # 端口7001 ❌
```

### 3. **nginx架构问题**
- **系统nginx**：运行在80/443端口，负责tkmail.fun域名
- **gloda_nginx_proxy**：容器nginx，运行在7001端口，负责Gloda Channel项目
- **错误假设**：我们的脚本误认为gloda_nginx_proxy是EDM的nginx

### 4. **核心问题：端口代理错误**
系统nginx配置错误：
```nginx
# ❌ 错误配置
location / {
    proxy_pass http://localhost:3000;  # 没有服务
}
location /api/ {
    proxy_pass http://localhost:8080/api/;  # 没有服务  
}
```

实际EDM后端运行在：
- 宿主机端口：3001  
- 容器内端口：3000
- 容器IP：172.18.0.4

## 🔧 解决方案

### 1. **修复系统nginx配置**
创建正确的代理配置：
```nginx
# ✅ 正确配置
location / {
    proxy_pass http://localhost:3001;  # EDM后端
}
location /api/ {
    proxy_pass http://localhost:3001/api/;  # EDM API
}
location /webhook/ {
    proxy_pass http://localhost:3001/webhook/;  # EngageLab回调
}
```

### 2. **架构清晰化**
```
🌐 域名访问: tkmail.fun
├── 系统nginx (80/443) → EDM项目  
└── 容器nginx (7001) → Gloda Channel项目

📡 代理关系:
├── https://tkmail.fun → localhost:3001 (EDM)
└── http://服务器IP:7001 → Gloda Channel
```

## 🎉 修复结果

### 修复前问题
- ❌ HTTPS访问返回502 Bad Gateway
- ❌ nginx代理到错误端口（3000/8080）
- ❌ EngageLab webhook无法访问
- ❌ 架构混乱，职责不清

### 修复后状态  
- ✅ HTTPS访问正常 (HTTP/2 200)
- ✅ nginx正确代理到3001端口
- ✅ webhook路径正常响应
- ✅ 架构清晰，职责分离

## 🧪 验证结果

```bash
# HTTPS健康检查
curl -I https://tkmail.fun/health
# HTTP/2 200 ✅

# HTTPS Webhook测试
curl -I https://tkmail.fun/webhook/engagelab  
# HTTP/2 200 ✅

# 容器状态检查
docker ps --filter "name=edm-"
# edm-backend    Up 2 hours ✅
# edm-postgres   Up 2 hours (healthy) ✅
# edm-redis      Up 2 hours (healthy) ✅
```

## 📋 配置变更详情

### 系统nginx配置 (/etc/nginx/sites-enabled/tkmail.fun)
**变更前**:
```nginx
location / {
    proxy_pass http://localhost:3000;  # ❌ 无服务
}
location /api/ { 
    proxy_pass http://localhost:8080/api/;  # ❌ 无服务
}
```

**变更后**:
```nginx
location / {
    proxy_pass http://localhost:3001;  # ✅ EDM后端
}
location /api/ {
    proxy_pass http://localhost:3001/api/;  # ✅ EDM API
}
location /webhook/ {
    proxy_pass http://localhost:3001/webhook/;  # ✅ 新增webhook
}
```

### 安全配置增强
- 添加CORS头配置
- 增强SSL安全设置
- 添加安全响应头
- 配置超时参数

## 🎯 答案总结

### Q1: 为什么nginx容器叫gloda_nginx_proxy？
**A**: 服务器上运行两个项目，`gloda_nginx_proxy`是Gloda Channel项目的nginx容器，不是EDM项目的。EDM使用系统nginx处理域名访问。

### Q2: 项目跟gloda有什么关系？  
**A**: EDM是为"Gloda Market"公司开发的邮件营销系统，所以配置中使用gloda相关的邮箱和域名。

### Q3: git main分支上也是这样吗？
**A**: git项目配置是正确的（使用edm-前缀），问题在于服务器部署架构混乱，没有严格按照项目配置部署。

## 🔮 后续建议

1. **标准化部署**：建议使用docker-compose.prod.yml进行标准化部署
2. **分离项目**：考虑将EDM和Gloda项目部署到不同服务器  
3. **监控配置**：添加nginx和容器健康监控
4. **文档更新**：更新部署文档，明确架构关系

## 📊 影响评估

- **用户影响**：✅ HTTPS访问恢复，EngageLab集成正常
- **系统稳定性**：✅ 提升，架构清晰
- **维护性**：✅ 提升，问题定位更容易
- **安全性**：✅ 提升，SSL配置优化

---

**变更状态**: ✅ 完成  
**验证状态**: ✅ 通过  
**回滚方案**: 如需回滚，恢复原nginx配置文件备份

**联系人**: AI Assistant  
**审核人**: Tony (项目负责人) 