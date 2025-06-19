# EngageLab Webhook 测试指南

## 🎯 目标
本指南帮助您快速测试 EngageLab 邮件回复 webhook 功能，验证邮件会话系统的完整性。

## 📋 准备工作

### 1. 环境要求
- Docker 已安装并运行
- Node.js 环境
- 项目已正确配置

### 2. 启动测试环境
```bash
# 一键启动测试服务器
./scripts/start-test-server.sh
```

或者手动启动：
```bash
# 启动数据库
docker-compose up -d postgres redis

# 准备测试数据
cd src/backend && node ../scripts/prepare-test-data.js

# 启动后端服务器
npm start
```

## 🧪 执行测试

### 1. 全量测试（推荐）
```bash
# 测试所有事件类型
node scripts/test-engagelab-webhook.js
```

### 2. 单独测试邮件回复
```bash
# 仅测试邮件回复事件
node scripts/test-engagelab-webhook.js reply
```

### 3. 单独测试入站邮件
```bash
# 仅测试入站邮件事件
node scripts/test-engagelab-webhook.js inbound
```

### 4. 其他单独测试
```bash
# 邮件送达
node scripts/test-engagelab-webhook.js delivered

# 邮件打开
node scripts/test-engagelab-webhook.js opened

# 邮件退回
node scripts/test-engagelab-webhook.js bounced
```

## 📡 Webhook 路径定义

### 接收路径
```
POST http://localhost:3000/api/tracking/webhook/engagelab
```

### 支持的事件类型
1. **delivered** - 邮件送达
2. **opened** - 邮件打开  
3. **clicked** - 链接点击
4. **bounced** - 邮件退回
5. **reply** - 邮件回复 🔥
6. **inbound** - 入站邮件 🔥

## 📊 验证结果

### 成功指标
- [x] Webhook 请求返回 200 状态码
- [x] 邮件回复事件创建或更新会话记录
- [x] 入站邮件事件创建新会话
- [x] 数据库中正确记录邮件消息
- [x] 会话统计信息正确更新

### 检查数据库
```sql
-- 检查会话表
SELECT * FROM email_conversations ORDER BY created_at DESC LIMIT 5;

-- 检查消息表
SELECT * FROM email_messages ORDER BY sent_at DESC LIMIT 10;

-- 检查会话统计
SELECT status, COUNT(*) as count FROM email_conversations GROUP BY status;
```

## 🐛 常见问题排查

### 1. 服务器启动失败
```bash
# 检查端口占用
lsof -i :3000

# 检查Docker服务
docker ps
```

### 2. 数据库连接失败
```bash
# 检查数据库状态
docker-compose exec postgres pg_isready

# 查看数据库日志
docker-compose logs postgres
```

### 3. Webhook 请求失败
- 检查路由是否正确注册
- 验证请求头格式
- 查看后端服务器日志

### 4. 测试数据创建失败
```bash
# 手动创建测试数据
cd src/backend
node ../scripts/prepare-test-data.js
```

## 📈 性能测试

### 批量测试
```bash
# 连续发送10个邮件回复事件
for i in {1..10}; do
  node scripts/test-engagelab-webhook.js reply
  sleep 1
done
```

### 并发测试
```bash
# 并发发送5个不同类型的事件
node scripts/test-engagelab-webhook.js delivered &
node scripts/test-engagelab-webhook.js opened &
node scripts/test-engagelab-webhook.js reply &
node scripts/test-engagelab-webhook.js inbound &
node scripts/test-engagelab-webhook.js bounced &
wait
```

## 🔍 调试技巧

### 1. 查看详细日志
```bash
# 启动服务器时显示详细日志
DEBUG=* npm start
```

### 2. 使用cURL测试
```bash
curl -X POST http://localhost:3000/api/tracking/webhook/engagelab \
  -H "Content-Type: application/json" \
  -H "X-WebHook-Timestamp: $(date +%s)" \
  -H "X-WebHook-AppKey: test-app-key-123" \
  -H "X-WebHook-Signature: test-signature" \
  -d '{
    "event_type": "reply",
    "from_email": "test@example.com",
    "subject": "Test Reply",
    "content_text": "This is a test reply"
  }'
```

### 3. 监控实时日志
```bash
# 另开终端监控日志
tail -f src/backend/logs/app.log
```

## 🎉 测试完成后

### 清理测试数据
```sql
-- 清理测试会话
DELETE FROM email_conversations WHERE sender_email LIKE '%@example.com';

-- 清理测试消息  
DELETE FROM email_messages WHERE from_email LIKE '%@example.com';
```

### 停止服务
```bash
# 停止后端服务器
# Ctrl+C 或 kill <PID>

# 停止Docker服务
docker-compose down
```

---

## 📚 相关文档
- [邮件会话API文档](../design/API-002-群发调度与发信服务管理接口设计.md)
- [数据库设计文档](../design/DATABASE-002-群发调度与发信服务管理数据库设计.md)
- [系统架构文档](../design/ARCHITECTURE-002-群发调度与发信服务管理系统架构设计.md)

## 📞 技术支持
如遇问题，请检查：
1. 系统日志文件
2. 数据库连接状态
3. Docker容器状态
4. 网络端口占用情况 