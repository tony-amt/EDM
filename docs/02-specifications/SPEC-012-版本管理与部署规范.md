# SPEC-012: 版本管理与部署规范

**文档版本**: 1.0  
**创建日期**: 2025-06-27  
**最后更新**: 2025-06-27  
**状态**: 强制执行 🚨

## 🎯 目标

彻底解决版本管理混乱问题，避免反复踩坑和回滚噩梦。

## 🚨 **严重问题回顾**

### 历史踩坑记录
1. **Node.js应用启动问题** - 反复出现，每次都要手动启动
2. **QueueScheduler路径错误** - sed全局替换导致的灾难
3. **调试代码混乱** - 生产环境充斥着DEBUG日志
4. **端口映射错误** - 容器内外端口不匹配
5. **版本回滚困难** - 没有清晰的版本标记

## 📋 **强制版本管理规范**

### 1. 镜像命名规范
```bash
# 格式: {项目名}-{组件}:{环境}-{版本}-{特性标记}
edm-backend:prod-v2.1.3-stable      # 生产稳定版
edm-backend:dev-v2.1.4-hotfix       # 开发热修复版
edm-frontend:prod-v1.2.1-optimized  # 前端优化版

# 禁止使用的命名
❌ edm-backend:latest
❌ edm-backend:production-complete-fixed
❌ edm-backend:debug-cleaned
❌ edm-backend:v1.0
```

### 2. 版本标记规范
```bash
# 语义化版本控制
MAJOR.MINOR.PATCH-LABEL

# 示例
v2.1.3-stable     # 稳定版本
v2.1.4-hotfix     # 热修复版本
v2.2.0-feature    # 新功能版本
v3.0.0-breaking   # 重大变更版本
```

### 3. 构建标准流程

#### 3.1 开发环境构建
```bash
# 1. 构建镜像
docker build -t edm-backend:dev-v$(date +%Y%m%d)-$(git rev-parse --short HEAD) .

# 2. 测试验证
./scripts/test-container.sh

# 3. 标记为候选版本
docker tag edm-backend:dev-v$(date +%Y%m%d)-$(git rev-parse --short HEAD) edm-backend:dev-candidate
```

#### 3.2 生产环境部署
```bash
# 1. 从候选版本创建生产版本
docker tag edm-backend:dev-candidate edm-backend:prod-v2.1.4-stable

# 2. 备份当前生产版本
docker tag edm-backend:prod-current edm-backend:prod-backup-$(date +%Y%m%d_%H%M%S)

# 3. 部署新版本
docker tag edm-backend:prod-v2.1.4-stable edm-backend:prod-current

# 4. 验证部署
./scripts/production-health-check.sh
```

### 4. 容器启动规范

#### 4.1 标准启动命令
```bash
# 后端容器 - 强制指定启动命令
docker run -d \
  --name edm-backend-prod \
  --network edm_edm-network \
  -p 8080:3000 \
  -e NODE_ENV=production \
  -e DB_HOST=edm-postgres-prod \
  -e DB_NAME=amt_mail_system \
  -e DB_USER=postgres \
  -e DB_PASSWORD=postgres \
  -e REDIS_HOST=edm-redis-prod \
  -e REDIS_PORT=6379 \
  --entrypoint 'node' \
  edm-backend:prod-current \
  src/index.js

# 前端容器
docker run -d \
  --name edm-frontend-prod \
  -p 3000:80 \
  edm-frontend:prod-current
```

#### 4.2 容器健康检查
```bash
# 健康检查脚本
#!/bin/bash
HEALTH_CHECK_URL="http://localhost:8080/api/health"
RESPONSE=$(curl -s -w "%{http_code}" $HEALTH_CHECK_URL)
HTTP_CODE=${RESPONSE: -3}

if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ 健康检查失败: $HTTP_CODE"
    exit 1
fi
echo "✅ 健康检查通过"
```

## 🔧 **部署工具和脚本**

### 1. 容器验证脚本
```bash
# scripts/verify-container.sh
#!/bin/bash
CONTAINER_NAME=$1
echo "🔍 验证容器: $CONTAINER_NAME"

# 检查容器状态
if ! docker ps | grep -q "$CONTAINER_NAME.*Up"; then
    echo "❌ 容器未运行"
    exit 1
fi

# 检查进程
MAIN_PROCESS=$(docker exec $CONTAINER_NAME ps aux | grep -v grep | grep -c "node src/index.js")
if [ "$MAIN_PROCESS" -eq "0" ]; then
    echo "❌ 主进程未运行"
    exit 1
fi

# 检查端口
if ! docker exec $CONTAINER_NAME netstat -tlnp | grep -q ":3000"; then
    echo "❌ 端口3000未监听"
    exit 1
fi

echo "✅ 容器验证通过"
```

### 2. 回滚脚本
```bash
# scripts/rollback-production.sh
#!/bin/bash
echo "🔄 开始生产环境回滚..."

# 查找最新备份
BACKUP_IMAGE=$(docker images | grep "edm-backend:prod-backup" | head -1 | awk '{print $1":"$2}')

if [ -z "$BACKUP_IMAGE" ]; then
    echo "❌ 未找到备份镜像"
    exit 1
fi

echo "📦 使用备份镜像: $BACKUP_IMAGE"

# 停止当前容器
docker stop edm-backend-prod
docker rm edm-backend-prod

# 启动备份版本
docker run -d \
  --name edm-backend-prod \
  --network edm_edm-network \
  -p 8080:3000 \
  -e NODE_ENV=production \
  -e DB_HOST=edm-postgres-prod \
  -e DB_NAME=amt_mail_system \
  -e DB_USER=postgres \
  -e DB_PASSWORD=postgres \
  -e REDIS_HOST=edm-redis-prod \
  -e REDIS_PORT=6379 \
  --entrypoint 'node' \
  $BACKUP_IMAGE \
  src/index.js

echo "✅ 回滚完成"
```

## 📊 **版本追踪和监控**

### 1. 版本信息API
```javascript
// 在每个服务中添加版本信息端点
app.get('/api/version', (req, res) => {
  res.json({
    service: 'edm-backend',
    version: process.env.SERVICE_VERSION || 'unknown',
    buildTime: process.env.BUILD_TIME || 'unknown',
    gitCommit: process.env.GIT_COMMIT || 'unknown',
    environment: process.env.NODE_ENV || 'unknown'
  });
});
```

### 2. 部署日志
```bash
# 每次部署都记录
echo "$(date): 部署 $IMAGE_NAME 到 $ENVIRONMENT" >> /var/log/edm-deployment.log
```

## 🚨 **强制检查清单**

### 部署前检查
- [ ] 镜像命名符合规范
- [ ] 启动命令正确指定
- [ ] 环境变量完整配置
- [ ] 端口映射正确
- [ ] 健康检查通过
- [ ] 备份已创建

### 部署后验证
- [ ] 容器状态正常
- [ ] 主进程运行正常
- [ ] API接口响应正常
- [ ] 日志无错误
- [ ] 性能指标正常

## 🔧 **紧急修复流程**

### 1. 发现问题
```bash
# 立即检查容器状态
./scripts/emergency-diagnosis.sh
```

### 2. 快速回滚
```bash
# 一键回滚到上一个稳定版本
./scripts/rollback-production.sh
```

### 3. 问题修复
```bash
# 使用安全修复脚本
./scripts/safe-production-fix.sh
```

### 4. 验证修复
```bash
# 完整验证
./scripts/verify-production.sh
```

## 📈 **持续改进**

### 1. 每周版本审查
- 清理无用镜像
- 更新版本标记
- 检查部署日志

### 2. 月度灾难演练
- 模拟生产故障
- 测试回滚流程
- 优化修复脚本

### 3. 季度架构评估
- 评估版本管理效果
- 优化部署流程
- 更新最佳实践

---

## ⚠️ **警告**

**违反此规范的后果**:
- 🚨 生产环境故障
- 🔄 无法快速回滚
- 😱 反复踩同样的坑
- 💸 开发效率低下

**请严格遵守此规范！**

---

**文档状态**: ✅ 已发布  
**执行级别**: 🚨 强制执行  
**违规处理**: 立即整改 