# EDM邮件系统关键问题修复方案

**修复日期**: 2025-07-01  
**修复范围**: 后端服务稳定性、发送间隔控制、追踪功能  
**问题级别**: 🚨 严重 - 影响生产环境正常使用

## 🔍 问题诊断结果

### 1. 后端服务稳定性问题 ⚠️
**现象**: 
- 后端服务频繁收到SIGTERM信号并重启
- 导致QueueScheduler无法正常启动和运行
- mailServiceManager启动失败

**影响**: 
- 邮件发送绕过正常队列机制
- 发送间隔控制失效

### 2. 发送间隔控制失效 ❌
**现象**:
- 邮件发送间隔只有毫秒级（0.001-0.193秒）
- 应该是秒级间隔（53秒/55秒基于service.sending_rate）
- 导致"同一批次集中发信"问题

**根本原因**:
- QueueScheduler未正常启动
- 发送逻辑可能绕过了队列控制

### 3. 追踪和Webhook功能失效 ❌
**现象**:
- email_tracking表为空，导致"打开=0"
- webhook记录缺失，导致"送达=0" 
- 追踪像素功能没有正常工作

### 4. 重复发送问题澄清 ✅
**真实情况**: 
- 不是系统bug，而是两个任务使用相同联系人
- 4个联系人在任务66666和77777中都被发送（共8次）
- 这是正常的业务逻辑

## 🔧 修复方案

### 方案1: 修复后端服务稳定性
```bash
# 1. 检查并修复后端启动问题
cd /opt/edm
docker logs edm-backend-prod --tail=100 | grep -E "error|Error|SIGTERM|exit"

# 2. 检查资源限制和内存使用
docker stats edm-backend-prod --no-stream

# 3. 如果是内存问题，调整Docker配置
# 编辑 docker-compose.yml 增加内存限制

# 4. 重启服务并监控
docker restart edm-backend-prod
sleep 10
docker logs edm-backend-prod --tail=20
```

### 方案2: 修复发送间隔控制
```javascript
// 1. 确保QueueScheduler正常启动
// 检查 src/backend/src/services/infrastructure/QueueScheduler.js
// 确保 startServiceTimer 方法正确设置间隔

// 2. 检查SystemConfig配置
// 确保发送间隔配置正确加载

// 3. 验证processServiceQueue逻辑
// 确保每次只处理一个SubTask
```

### 方案3: 修复追踪功能
```sql
-- 1. 检查email_tracking表结构
SELECT * FROM email_tracking LIMIT 1;

-- 2. 检查追踪像素生成逻辑
-- 确保tracking_id正确关联

-- 3. 修复webhook处理逻辑
-- 确保engagelab回调正确记录到追踪表
```

## 🚀 立即执行步骤

### 第一步: 稳定后端服务
1. 重启后端服务
2. 监控启动日志
3. 确保所有组件正常加载

### 第二步: 验证QueueScheduler
1. 检查定时器启动日志
2. 验证发送间隔配置
3. 测试单个邮件发送

### 第三步: 修复追踪功能
1. 检查tracking_id生成
2. 修复追踪像素链接
3. 测试webhook回调

## 📋 验证清单

- [ ] 后端服务稳定运行超过5分钟
- [ ] QueueScheduler定时器正常启动
- [ ] 发送间隔恢复到秒级（53s/55s）
- [ ] email_tracking表开始有记录
- [ ] webhook回调正常工作
- [ ] 测试邮件的打开和送达状态正常

## 🔄 回滚计划

如果修复失败，立即回滚：
1. 恢复之前的QueueScheduler备份
2. 重启所有相关服务
3. 通知相关人员暂停邮件发送

---

**修复负责人**: EDM技术团队  
**监控周期**: 修复后24小时内持续监控  
**完成标准**: 所有验证清单项目✅通过 