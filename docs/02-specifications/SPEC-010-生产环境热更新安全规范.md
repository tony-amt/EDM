# SPEC-010-生产环境热更新安全规范

## 🎯 规范目标
防止生产环境热更新操作引起的服务中断和数据丢失，确保系统稳定性。

## 🚨 故障案例分析
**时间**: 2025-06-27  
**故障**: 热更新前端时错误重启后端服务，导致API全面502错误  
**影响**: 整个EDM系统无法使用，持续约30分钟  

### 故障根因
1. **操作范围扩大** - 前端更新时错误涉及后端服务
2. **缺乏影响评估** - 未评估重启后端的影响范围
3. **缺乏回滚计划** - 没有快速恢复预案
4. **监控不足** - 未及时发现服务启动异常

## ✅ 热更新安全规范

### 1. 🔒 操作权限分级
```bash
# Level 1: 安全操作 (可直接执行)
- 前端静态资源更新
- 前端容器重启
- 配置文件修改 (非关键)

# Level 2: 风险操作 (需要评估)
- 后端服务重启
- 数据库配置修改
- 网络配置调整

# Level 3: 高危操作 (禁止热更新)
- 数据库结构变更
- 核心依赖升级
- 系统级配置修改
```

### 2. 🎯 热更新适用场景
**✅ 适用场景**:
- 前端UI样式调整
- 前端文案修改
- 前端组件逻辑优化
- 非核心配置调整

**❌ 禁用场景**:
- 数据库schema变更
- API接口结构变更
- 依赖包升级
- 环境变量重大调整

### 3. 🔄 操作流程规范
#### 3.1 前置检查清单
```bash
# 系统状态检查
□ 当前服务运行正常
□ 没有正在进行的重要任务
□ 备份已完成 (如需要)
□ 回滚方案已准备

# 影响范围评估
□ 确认只影响指定服务
□ 评估用户影响范围
□ 确认可接受的停机时间
□ 通知相关人员 (如需要)
```

#### 3.2 执行规范
```bash
# 前端热更新标准流程
1. 只修改前端相关文件
2. 构建新的前端镜像
3. 停止前端容器: docker stop edm-frontend-prod
4. 启动新前端容器: docker run ...
5. 验证前端功能正常
6. 确认后端API不受影响

# 禁止操作
❌ docker restart edm-backend-prod
❌ docker-compose restart
❌ 同时重启多个服务
```

#### 3.3 验证和监控
```bash
# 功能验证
curl -I https://tkmail.fun  # 前端验证
curl -s https://tkmail.fun/api/health  # 后端验证

# 性能监控
- 响应时间 < 200ms
- 错误率 < 1%
- 内存使用正常

# 日志检查
docker logs edm-frontend-prod | tail -20
docker logs edm-backend-prod | tail -20
```

### 4. 🚑 应急处理预案
#### 4.1 服务异常检测
```bash
# 自动检测脚本
#!/bin/bash
check_service() {
    local service=$1
    local url=$2
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    if [ "$response" != "200" ]; then
        echo "🚨 $service 服务异常: HTTP $response"
        return 1
    fi
    return 0
}

check_service "前端" "https://tkmail.fun"
check_service "后端API" "https://tkmail.fun/api/health"
```

#### 4.2 快速回滚流程
```bash
# 前端回滚
docker stop edm-frontend-prod
docker run -d --name edm-frontend-prod-rollback [上一个稳定镜像]
docker rm edm-frontend-prod
docker rename edm-frontend-prod-rollback edm-frontend-prod

# 后端回滚 (紧急情况)
docker stop edm-backend-prod
docker run -d --name edm-backend-prod-rollback [上一个稳定镜像]
```

### 5. 📊 监控和告警
#### 5.1 关键指标监控
- **可用性**: 服务健康检查
- **性能**: 响应时间、吞吐量  
- **错误率**: HTTP错误码统计
- **资源**: CPU、内存、磁盘使用

#### 5.2 告警规则
```bash
# 服务不可用告警
if health_check_failed > 2_consecutive_times:
    send_alert("服务不可用")

# 性能告警  
if response_time > 5s:
    send_alert("响应时间过长")

# 错误率告警
if error_rate > 5%:
    send_alert("错误率过高")
```

## 🛠️ 工具和脚本

### 安全热更新脚本
```bash
#!/bin/bash
# scripts/safe-hot-update.sh

set -e

SERVICE_TYPE=${1:-frontend}  # frontend/backend
IMAGE_TAG=${2:-latest}

echo "🔍 执行前置检查..."
./scripts/pre-update-check.sh

if [ "$SERVICE_TYPE" = "frontend" ]; then
    echo "🚀 执行前端热更新..."
    ./scripts/update-frontend.sh "$IMAGE_TAG"
elif [ "$SERVICE_TYPE" = "backend" ]; then
    echo "⚠️  后端更新需要额外确认..."
    read -p "确认执行后端更新? (y/N): " confirm
    if [ "$confirm" = "y" ]; then
        ./scripts/update-backend.sh "$IMAGE_TAG"
    fi
fi

echo "✅ 执行后置验证..."
./scripts/post-update-verify.sh
```

### 健康检查脚本
```bash
#!/bin/bash
# scripts/health-check.sh

check_frontend() {
    curl -f -s https://tkmail.fun >/dev/null
}

check_backend() {
    curl -f -s https://tkmail.fun/api/health >/dev/null
}

echo "🔍 执行健康检查..."
if check_frontend && check_backend; then
    echo "✅ 所有服务正常"
    exit 0
else
    echo "❌ 服务异常，需要立即处理"
    exit 1
fi
```

## 📋 检查清单 (必须执行)

### 热更新前
- [ ] 确认更新类型和影响范围
- [ ] 检查当前系统状态正常
- [ ] 准备回滚方案和镜像
- [ ] 通知相关人员 (如需要)

### 热更新中  
- [ ] 严格按照操作流程执行
- [ ] 实时监控服务状态
- [ ] 记录操作日志
- [ ] 遇到异常立即停止

### 热更新后
- [ ] 验证所有功能正常
- [ ] 检查性能指标
- [ ] 监控错误日志
- [ ] 更新操作记录

## 🚫 禁止事项
1. **禁止同时重启多个服务**
2. **禁止在高峰时段进行风险操作**
3. **禁止无备份的数据操作**
4. **禁止跳过验证步骤**
5. **禁止在生产环境做实验性更新**

## 📞 应急联系
- **系统管理员**: [联系方式]
- **开发负责人**: [联系方式]  
- **运维团队**: [联系方式]

---

**记住**: 宁可多花时间做完整构建，也不要冒险做可能影响生产的热更新！ 