#!/bin/bash

# EDM追踪像素和Webhook验证脚本
# 用于验证邮件打开追踪、点击统计、webhook回调等功能

set -e

SERVER="43.135.38.15"
USER="ubuntu"
PASS="Tony1231!"

echo "🔍 EDM追踪系统验证开始..."
echo "时间: $(date)"
echo ""

# === 第一部分：检查追踪服务状态 ===
echo "📊 第一部分：追踪服务状态检查"
echo "=================================="

# 1. 检查tracking-service配置
echo "🎯 检查tracking-service配置..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $USER@$SERVER << 'EOF'
cd /home/ubuntu/EDM

echo "=== Tracking Service 容器状态 ==="
if docker ps | grep -q tracking-service; then
    echo "✅ tracking-service 运行正常"
    docker ps --filter "name=tracking-service" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
else
    echo "❌ tracking-service 未运行，尝试启动..."
    docker-compose up -d tracking-service
    sleep 5
    docker ps --filter "name=tracking-service" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
fi

echo ""
echo "=== Tracking Service 配置文件 ==="
if [ -f "services/tracking-service/app.js" ]; then
    echo "📄 app.js 配置片段:"
    head -30 services/tracking-service/app.js | grep -E "(PORT|track|pixel|open)" || echo "未找到相关配置"
else
    echo "❌ tracking-service配置文件不存在"
fi
EOF

# 2. 检查webhook-service配置
echo ""
echo "🔗 检查webhook-service配置..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $USER@$SERVER << 'EOF'
cd /home/ubuntu/EDM

echo "=== Webhook Service 容器状态 ==="
if docker ps | grep -q webhook-service; then
    echo "✅ webhook-service 运行正常"
    docker ps --filter "name=webhook-service" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
else
    echo "❌ webhook-service 未运行，尝试启动..."
    docker-compose up -d webhook-service
    sleep 5
    docker ps --filter "name=webhook-service" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
fi

echo ""
echo "=== Webhook Service 配置文件 ==="
if [ -f "services/webhook-service/app.js" ]; then
    echo "📄 app.js 配置片段:"
    head -30 services/webhook-service/app.js | grep -E "(PORT|webhook|engagelab|callback)" || echo "未找到相关配置"
else
    echo "❌ webhook-service配置文件不存在"
fi
EOF

# === 第二部分：检查追踪像素实现 ===
echo ""
echo "🖼️ 第二部分：追踪像素实现检查"
echo "=================================="

# 3. 检查QueueScheduler中的追踪像素生成
echo "🔍 检查追踪像素生成逻辑..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $USER@$SERVER << 'EOF'
cd /home/ubuntu/EDM

echo "=== QueueScheduler追踪像素方法 ==="
if [ -f "src/backend/src/services/infrastructure/QueueScheduler.service.js" ]; then
    grep -n -A 10 -B 2 "addClickTracking\|pixel\|tracking" src/backend/src/services/infrastructure/QueueScheduler.service.js || echo "未找到追踪像素相关方法"
else
    echo "❌ QueueScheduler文件不存在"
fi
EOF

# 4. 检查邮件模板中的追踪像素
echo ""
echo "📧 检查邮件模板追踪像素..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $USER@$SERVER << 'EOF'
cd /home/ubuntu/EDM

echo "=== 检查最近发送的邮件是否包含追踪像素 ==="
docker exec edm-backend node -e "
const { SubTask } = require('./src/models');
(async () => {
  try {
    const recentSubTasks = await SubTask.findAll({
      where: {
        status: 'sent',
        sent_at: {
          [require('sequelize').Op.gte]: new Date(Date.now() - 24*60*60*1000)
        }
      },
      order: [['sent_at', 'DESC']],
      limit: 5,
      attributes: ['id', 'rendered_body', 'recipient_email', 'sent_at']
    });
    
    console.log('🔍 最近发送的邮件追踪检查:');
    recentSubTasks.forEach(task => {
      const hasPixel = task.rendered_body && task.rendered_body.includes('tracking/pixel');
      const hasClick = task.rendered_body && task.rendered_body.includes('tracking/click');
      console.log(\`SubTask \${task.id} (\${task.recipient_email}):\`);
      console.log(\`  追踪像素: \${hasPixel ? '✅' : '❌'}\`);
      console.log(\`  点击追踪: \${hasClick ? '✅' : '❌'}\`);
      console.log(\`  发送时间: \${task.sent_at}\`);
      console.log('');
    });
  } catch (error) {
    console.error('查询失败:', error.message);
  }
  process.exit(0);
})();
" 2>/dev/null || echo "无法查询子任务数据"
EOF

# === 第三部分：测试追踪像素URL ===
echo ""
echo "🌐 第三部分：追踪像素URL测试"
echo "=================================="

# 5. 测试追踪像素访问
echo "🖼️ 测试追踪像素URL..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $USER@$SERVER << 'EOF'
cd /home/ubuntu/EDM

echo "=== 测试追踪像素接口 ==="

# 获取一个测试用的SubTask ID
TEST_SUBTASK_ID=$(docker exec edm-backend node -e "
const { SubTask } = require('./src/models');
(async () => {
  try {
    const task = await SubTask.findOne({
      where: { status: 'sent' },
      order: [['created_at', 'DESC']]
    });
    console.log(task ? task.id : 'none');
  } catch (error) {
    console.log('none');
  }
  process.exit(0);
})();
" 2>/dev/null)

if [ "$TEST_SUBTASK_ID" != "none" ] && [ -n "$TEST_SUBTASK_ID" ]; then
    echo "📧 使用测试SubTask ID: $TEST_SUBTASK_ID"
    
    # 测试追踪像素URL
    echo "测试追踪像素访问:"
    curl -I "https://tkmail.fun/tracking/pixel/$TEST_SUBTASK_ID" \
      -w "状态码: %{http_code}\n" 2>/dev/null || echo "追踪像素测试失败"
    
    echo ""
    echo "测试点击追踪URL:"
    curl -I "https://tkmail.fun/tracking/click/$TEST_SUBTASK_ID?url=https://example.com" \
      -w "状态码: %{http_code}\n" 2>/dev/null || echo "点击追踪测试失败"
else
    echo "❌ 未找到可用的测试SubTask"
fi
EOF

# === 第四部分：检查EngageLab webhook ===
echo ""
echo "🔗 第四部分：EngageLab Webhook检查"
echo "=================================="

# 6. 检查EngageLab配置
echo "📡 检查EngageLab邮件服务webhook配置..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $USER@$SERVER << 'EOF'
cd /home/ubuntu/EDM

echo "=== EngageLab邮件服务配置 ==="
docker exec edm-backend node -e "
const { EmailService } = require('./src/models');
(async () => {
  try {
    const services = await EmailService.findAll({
      where: { name: { [require('sequelize').Op.iLike]: '%engagelab%' } }
    });
    
    console.log('🔍 EngageLab服务配置:');
    services.forEach(service => {
      console.log(\`服务名: \${service.name}\`);
      console.log(\`域名: \${service.domain}\`);
      console.log(\`状态: \${service.is_enabled ? '启用' : '禁用'}\`);
      console.log(\`额度: \${service.used_quota}/\${service.daily_quota}\`);
      console.log(\`Webhook URL: \${service.webhook_url || '未配置'}\`);
      console.log('');
    });
  } catch (error) {
    console.error('查询失败:', error.message);
  }
  process.exit(0);
})();
" 2>/dev/null || echo "无法查询EngageLab配置"
EOF

# 7. 检查webhook日志
echo ""
echo "📜 检查最近的webhook日志..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $USER@$SERVER << 'EOF'
cd /home/ubuntu/EDM

echo "=== Webhook Service 最近日志 ==="
docker logs webhook-service --tail 100 --since "1h" 2>/dev/null | \
  grep -E "(engagelab|webhook|callback|POST|GET)" | \
  tail -20 || echo "无webhook相关日志"

echo ""
echo "=== Backend Service Webhook 日志 ==="
docker logs edm-backend --tail 100 --since "1h" 2>/dev/null | \
  grep -E "(webhook|callback|engagelab)" | \
  tail -10 || echo "无webhook相关日志"
EOF

# === 第五部分：检查邮件统计数据 ===
echo ""
echo "📊 第五部分：邮件统计数据检查"
echo "=================================="

# 8. 检查邮件打开统计
echo "📈 检查邮件打开和点击统计..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $USER@$SERVER << 'EOF'
cd /home/ubuntu/EDM

echo "=== 最近24小时邮件统计 ==="
docker exec edm-backend node -e "
const { Task, SubTask, EmailLog } = require('./src/models');
(async () => {
  try {
    const yesterday = new Date(Date.now() - 24*60*60*1000);
    
    // 检查任务统计
    const recentTasks = await Task.findAll({
      where: {
        created_at: { [require('sequelize').Op.gte]: yesterday }
      },
      attributes: ['id', 'name', 'sent_count', 'open_count', 'click_count', 'total_recipients'],
      order: [['created_at', 'DESC']],
      limit: 5
    });
    
    console.log('📧 最近任务统计:');
    recentTasks.forEach(task => {
      const openRate = task.sent_count > 0 ? (task.open_count / task.sent_count * 100).toFixed(2) : 0;
      const clickRate = task.sent_count > 0 ? (task.click_count / task.sent_count * 100).toFixed(2) : 0;
      console.log(\`任务: \${task.name}\`);
      console.log(\`  已发送: \${task.sent_count}/\${task.total_recipients}\`);
      console.log(\`  打开数: \${task.open_count} (打开率: \${openRate}%)\`);
      console.log(\`  点击数: \${task.click_count} (点击率: \${clickRate}%)\`);
      console.log('');
    });
    
    // 检查邮件日志
    console.log('📜 最近邮件事件日志:');
    const emailLogs = await EmailLog.findAll({
      where: {
        created_at: { [require('sequelize').Op.gte]: yesterday },
        event_type: { [require('sequelize').Op.in]: ['open', 'click', 'bounce', 'spam'] }
      },
      attributes: ['event_type', 'subtask_id', 'ip_address', 'user_agent', 'created_at'],
      order: [['created_at', 'DESC']],
      limit: 20
    });
    
    emailLogs.forEach(log => {
      console.log(\`\${log.event_type.toUpperCase()}: SubTask \${log.subtask_id} - \${log.created_at}\`);
    });
    
  } catch (error) {
    console.error('查询失败:', error.message);
  }
  process.exit(0);
})();
" 2>/dev/null || echo "无法查询邮件统计数据"
EOF

# === 第六部分：生成验证报告 ===
echo ""
echo "📋 第六部分：追踪验证报告"
echo "=================================="

echo "📊 生成追踪系统验证报告..."

# 创建验证报告
cat << 'EOF' > tracking_verification_report.md
# EDM追踪系统验证报告

## 📊 验证摘要
- **验证时间**: $(date)
- **验证范围**: 追踪像素、点击追踪、webhook回调、统计数据

## 🔍 追踪服务状态
### tracking-service
- [ ] 服务运行状态
- [ ] 端口映射配置
- [ ] 追踪像素URL测试

### webhook-service  
- [ ] 服务运行状态
- [ ] EngageLab webhook配置
- [ ] 回调日志记录

## 📧 邮件追踪实现
### 追踪像素
- [ ] 邮件中包含追踪像素
- [ ] 像素URL格式正确
- [ ] 访问返回状态正常

### 点击追踪
- [ ] 邮件中包含点击追踪
- [ ] 重定向链接正常
- [ ] 点击事件记录

## 📈 统计数据
### 任务统计
- [ ] 打开数统计正确
- [ ] 点击数统计正确
- [ ] 统计更新及时

### 邮件日志
- [ ] 事件记录完整
- [ ] 时间戳准确
- [ ] 用户信息记录

## 🔗 EngageLab集成
### Webhook配置
- [ ] webhook URL配置
- [ ] 事件类型设置
- [ ] 回调数据处理

### 事件处理
- [ ] 打开事件处理
- [ ] 点击事件处理
- [ ] 退信事件处理

## 🎯 验证结论
- **追踪像素**: ✅/❌
- **点击追踪**: ✅/❌  
- **Webhook回调**: ✅/❌
- **统计更新**: ✅/❌

## 📋 建议操作
1. [ ] 登录种子邮箱查看邮件
2. [ ] 进行邮件打开操作
3. [ ] 点击邮件中的链接
4. [ ] 检查统计数据更新
5. [ ] 进行邮件回复操作

EOF

echo "✅ 追踪系统验证完成！"
echo ""
echo "📄 验证报告已生成: tracking_verification_report.md"
echo ""
echo "🎯 接下来需要您："
echo "1. 🔍 检查验证报告中的各项状态"
echo "2. 📧 登录种子邮箱进行实际操作测试"
echo "3. 📊 验证追踪数据是否正确更新"
echo "4. 🔄 如有问题，进行相应配置调整"
echo ""
echo "📧 种子邮箱操作指南:"
echo "   - 登录邮箱查看是否收到测试邮件"
echo "   - 打开邮件（触发追踪像素）"
echo "   - 点击邮件中的链接（触发点击追踪）"
echo "   - 回复邮件（测试双向通信）"
echo "" 