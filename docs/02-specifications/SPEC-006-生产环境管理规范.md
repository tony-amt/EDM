# SPEC-006 生产环境管理规范

## 📋 概述

本文档规定了EDM系统生产环境的管理规范，确保系统稳定运行和安全部署。

## 🏗️ 服务器环境规范

### 基础信息
- **服务器地址**：43.135.38.15
- **域名**：tkmail.fun
- **操作系统**：Ubuntu 20.04+
- **用户账号**：ubuntu
- **项目目录**：/opt/edm（推荐）

### 端口分配规范
```bash
# EDM系统端口段：8000-8099
80/443    - 主nginx（反向代理）
8001      - EDM前端容器内部端口
8002      - EDM后端容器内部端口  
8003      - EDM数据库（PostgreSQL）
8004      - EDM Redis
8005      - 图片服务
8006      - 追踪服务
8007      - Webhook服务

# 其他项目端口段：7000-7099（gloda_channel等）
# 避免端口冲突
```

## 🐳 容器管理规范

### 命名规范
```bash
# 格式：{项目名}-{服务类型}-{环境}
edm-frontend-prod     # 前端服务
edm-backend-prod      # 后端服务
edm-postgres-prod     # 数据库服务
edm-redis-prod        # 缓存服务
edm-nginx-prod        # 反向代理
```

### 网络配置
```bash
# 项目独立网络
edm_edm-network       # EDM系统专用网络

# 网络隔离策略
- 每个项目使用独立网络
- 避免容器间意外通信
- 通过nginx进行统一入口管理
```

### 镜像版本管理
```bash
# 版本标签规范
edm-frontend:v1.0     # 稳定版本
edm-frontend:v1.1     # 功能更新
edm-frontend:latest   # 最新版本（谨慎使用）

# 版本记录
- v1.0: 初始生产版本
- v1.1: 修复API配置问题
```

## 📁 目录结构规范

### 推荐目录结构
```bash
/opt/edm/
├── docker-compose.yml         # 生产环境编排
├── .env.production            # 生产环境变量
├── nginx/
│   ├── nginx.conf            # nginx配置
│   └── ssl/                  # SSL证书
├── data/
│   ├── postgres/             # 数据库数据
│   ├── redis/                # Redis数据
│   └── uploads/              # 上传文件
├── logs/
│   ├── nginx/                # nginx日志
│   ├── backend/              # 后端日志
│   └── system/               # 系统日志
├── backups/
│   ├── database/             # 数据库备份
│   └── files/                # 文件备份
└── scripts/
    ├── deploy.sh             # 部署脚本
    ├── backup.sh             # 备份脚本
    ├── health-check.sh       # 健康检查
    └── rollback.sh           # 回滚脚本
```

## 🚀 部署流程规范

### 部署前检查清单
- [ ] 代码已通过测试
- [ ] 构建文件已生成
- [ ] 配置文件已更新
- [ ] 数据库迁移已准备
- [ ] 备份已完成

### 部署步骤
```bash
# 1. 备份当前版本
./scripts/backup.sh

# 2. 构建新镜像
docker build -t edm-frontend:v1.x .

# 3. 停止旧容器
docker stop edm-frontend-prod

# 4. 启动新容器
docker run -d --name edm-frontend-prod \
  --network edm_edm-network \
  --restart unless-stopped \
  edm-frontend:v1.x

# 5. 健康检查
./scripts/health-check.sh

# 6. 验证功能
curl -I https://tkmail.fun/api/health
```

### 回滚策略
```bash
# 快速回滚到上一版本
./scripts/rollback.sh

# 手动回滚
docker stop edm-frontend-prod
docker rm edm-frontend-prod
docker run -d --name edm-frontend-prod \
  --network edm_edm-network \
  --restart unless-stopped \
  edm-frontend:v1.0
```

## 🔧 配置管理

### 环境变量管理
```bash
# 生产环境配置文件：.env.production
NODE_ENV=production
API_BASE_URL=/api
DATABASE_URL=postgresql://user:pass@postgres:5432/db
REDIS_URL=redis://redis:6379
JWT_SECRET=<生产环境密钥>
```

### 敏感信息保护
- 使用环境变量存储敏感信息
- 定期轮换密钥和密码
- 限制配置文件访问权限
- 不在代码中硬编码敏感信息

## 📊 监控与日志

### 健康检查
```bash
# 自动健康检查（每5分钟）
*/5 * * * * /opt/edm/scripts/health-check.sh

# 检查项目
- 容器运行状态
- API响应时间
- 数据库连接
- 磁盘空间使用
- 内存使用情况
```

### 日志管理
```bash
# 日志轮转配置
/opt/edm/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 ubuntu ubuntu
}
```

### 告警机制
```bash
# 关键指标告警
- 服务不可用 > 1分钟
- API响应时间 > 5秒
- 错误率 > 5%
- 磁盘使用 > 85%
- 内存使用 > 90%
```

## 🔒 安全规范

### 访问控制
```bash
# 服务器访问
- 仅允许密钥认证
- 禁用root直接登录
- 配置防火墙规则
- 定期更新系统补丁

# 应用安全
- HTTPS强制跳转
- 安全请求头配置
- API访问限流
- 输入验证和过滤
```

### 数据保护
```bash
# 数据备份策略
- 每日自动备份数据库
- 每周备份完整系统
- 备份文件加密存储
- 定期测试恢复流程
```

## 🛠️ 维护操作

### 日常维护
```bash
# 每日检查
- 服务运行状态
- 日志错误信息
- 磁盘空间使用
- 系统资源消耗

# 每周维护
- 清理过期日志
- 更新系统补丁
- 检查备份完整性
- 性能指标分析
```

### 应急处理
```bash
# 服务异常处理流程
1. 确认问题范围和影响
2. 查看相关日志和监控
3. 尝试快速修复或重启服务
4. 如无法快速修复则回滚
5. 记录问题和解决方案
6. 后续分析根本原因
```

## 📋 操作检查清单

### 部署检查清单
- [ ] 备份已完成
- [ ] 新版本已测试
- [ ] 配置文件已更新
- [ ] 依赖服务正常
- [ ] 部署脚本已准备
- [ ] 回滚方案已确认

### 上线后验证
- [ ] 服务启动正常
- [ ] API接口可访问
- [ ] 前端页面加载正常
- [ ] 数据库连接正常
- [ ] 关键功能测试通过
- [ ] 性能指标正常

## 🔗 相关文档
- [部署指南](../standards/deployment/deployment-guide.md)
- [监控配置](../standards/monitoring/monitoring-setup.md)
- [应急预案](../standards/emergency/emergency-response.md)

---
**文档版本**：v1.0  
**创建日期**：2025-01-13  
**最后更新**：2025-01-13  
**维护人员**：系统管理员 