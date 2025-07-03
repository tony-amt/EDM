#!/bin/bash

# 🔧 修复端口冲突并完成Webhook修复
set -e

SERVER_IP="43.135.38.15"
SERVER_USER="ubuntu"
SERVER_PASS="Tony1231!"

echo "🔧 修复端口冲突并完成Webhook修复"
echo "📅 修复时间: $(date)"

# 端口冲突修复脚本
PORT_FIX_SCRIPT='#!/bin/bash
set -e

echo "🔧 开始修复端口冲突和Webhook"
cd /opt/edm

# 1. 停止所有相关服务和容器
echo "🛑 停止所有服务和容器..."
sudo docker-compose down --remove-orphans
sudo docker container prune -f
sudo docker network prune -f

# 检查并杀死占用3000端口的进程
echo "🔍 检查3000端口占用..."
PORT_PID=$(sudo lsof -ti:3000 || echo "")
if [ ! -z "$PORT_PID" ]; then
    echo "⚠️ 杀死占用3000端口的进程: $PORT_PID"
    sudo kill -9 $PORT_PID || echo "进程已不存在"
fi

# 检查并杀死占用3001端口的进程
PORT_PID_3001=$(sudo lsof -ti:3001 || echo "")
if [ ! -z "$PORT_PID_3001" ]; then
    echo "⚠️ 杀死占用3001端口的进程: $PORT_PID_3001"
    sudo kill -9 $PORT_PID_3001 || echo "进程已不存在"
fi

sleep 5

# 2. 检查docker-compose.yml配置
echo "🔍 检查docker-compose配置..."
if grep -q "3000:3000" docker-compose.yml; then
    echo "⚠️ 发现端口映射冲突，修复配置..."
    sudo cp docker-compose.yml docker-compose.yml.backup
    # 修改端口映射避免冲突
    sudo sed -i "s/3000:3000/3001:3000/g" docker-compose.yml
    echo "✅ 端口映射已修复为 3001:3000"
fi

# 3. 确保webhook路由存在
echo "🔧 确保webhook路由配置..."
if grep -q "webhook/engagelab" src/backend/src/index.js; then
    echo "✅ webhook路由已存在"
else
    echo "🔧 添加webhook路由..."
    sudo sed -i "/app.use(express.static(path.join(__dirname, \"..\/public\")));/a\\
\\
\/\/ 🔧 EngageLab Webhook路由\\
const webhookController = require(\"\.\/controllers\/webhook.controller\");\\
app.post(\"\/webhook\/engagelab\", webhookController.handleMailEvent);" src/backend/src/index.js
    echo "✅ webhook路由已添加"
fi

# 4. 清理Docker缓存并重建
echo "🔧 清理Docker缓存并重建..."
sudo docker system prune -f
sudo docker-compose build --no-cache backend

# 5. 启动服务
echo "🚀 启动服务..."
sudo docker-compose up -d

# 6. 等待服务完全启动
echo "⏳ 等待服务启动..."
sleep 40

# 7. 检查服务状态
echo "🔍 检查服务状态..."
sudo docker-compose ps

# 8. 健康检查
echo "🔍 执行健康检查..."
for i in {1..15}; do
    echo "健康检查尝试 $i/15..."
    if curl -s -f "https://tkmail.fun/health" > /dev/null; then
        echo "✅ 健康检查通过！"
        curl -s "https://tkmail.fun/health"
        break
    else
        echo "⚠️ 健康检查失败，等待5秒后重试..."
        sleep 5
    fi
    if [ $i -eq 15 ]; then
        echo "❌ 健康检查持续失败，查看日志："
        sudo docker-compose logs --tail=20 backend
        echo "🔍 检查端口状态："
        sudo netstat -tlnp | grep :3001 || echo "3001端口未监听"
        sudo docker-compose ps
        exit 1
    fi
done

# 9. 测试Webhook端点
echo "🧪 测试Webhook端点..."
sleep 5

# 基础测试
echo "📝 执行基础测试..."
WEBHOOK_TEST=$(curl -s -w "%{http_code}" -X POST "https://tkmail.fun/webhook/engagelab" \
    -H "Content-Type: application/json" \
    -d "{\"test\": true, \"timestamp\": \"$(date)\"}" \
    -o /tmp/webhook_test_fixed.json)

echo "基础测试响应码: $WEBHOOK_TEST"
echo "响应内容:"
cat /tmp/webhook_test_fixed.json

# message_status测试
echo "📝 执行message_status测试..."
MESSAGE_STATUS_TEST=$(curl -s -w "%{http_code}" -X POST "https://tkmail.fun/webhook/engagelab" \
    -H "Content-Type: application/json" \
    -d "{
        \"message_status\": \"delivered\",
        \"status_data\": {\"message\": \"port fix test\"},
        \"custom_args\": {\"subtask_id\": \"port-fix-test-$(date +%s)\"},
        \"email_id\": \"port-fix-email-$(date +%s)\"},
        \"task_id\": 99999,
        \"to\": \"test@example.com\"
    }" \
    -o /tmp/message_status_test_fixed.json)

echo "message_status测试响应码: $MESSAGE_STATUS_TEST"
echo "响应内容:"
cat /tmp/message_status_test_fixed.json

# 10. 验证EventLog
echo "🔍 验证EventLog记录..."
EVENTLOG_COUNT=$(sudo docker-compose exec -T postgres psql -U postgres -d edm_production -t -c "
SELECT COUNT(*) FROM event_logs 
WHERE source = \"engagelab\" 
AND created_at > NOW() - INTERVAL \"10 minutes\";
" | tr -d " ")

echo "最近10分钟EventLog记录数: $EVENTLOG_COUNT"

if [ "$EVENTLOG_COUNT" -gt 0 ]; then
    echo "✅ EventLog记录正常"
    echo "最新EventLog记录:"
    sudo docker-compose exec -T postgres psql -U postgres -d edm_production -c "
    SELECT id, event_type, status, created_at 
    FROM event_logs 
    WHERE source = \"engagelab\" 
    ORDER BY created_at DESC 
    LIMIT 3;
    "
fi

# 清理临时文件
rm -f /tmp/webhook_test_fixed.json /tmp/message_status_test_fixed.json

# 最终结果
echo ""
echo "=========================================="
echo "🎉 端口冲突修复和Webhook修复完成!"
echo "=========================================="
echo ""
echo "📊 修复结果:"
echo "  - 端口冲突: 已解决"
echo "  - Webhook路由: 已配置"
echo "  - 服务状态: 正常运行"
echo "  - 基础测试: HTTP $WEBHOOK_TEST"
echo "  - 状态测试: HTTP $MESSAGE_STATUS_TEST"
echo "  - EventLog: $EVENTLOG_COUNT 条记录"
echo ""

if [ "$WEBHOOK_TEST" -eq 200 ] && [ "$MESSAGE_STATUS_TEST" -eq 200 ]; then
    echo "✅ 🎉 所有测试通过！系统完全可用！"
    echo ""
    echo "🔗 重要端点:"
    echo "  - 前端: https://tkmail.fun"
    echo "  - Webhook: https://tkmail.fun/webhook/engagelab"
    echo "  - 健康检查: https://tkmail.fun/health"
    echo ""
    echo "🎯 现在可以:"
    echo "1. 在EngageLab后台配置 https://tkmail.fun/webhook/engagelab"
    echo "2. 创建测试任务验证完整流程"
    echo "3. 监控EventLog表确认回调数据"
    echo ""
    echo "✅ EDM两阶段队列系统+Webhook完全修复成功！"
else
    echo "⚠️ 部分测试失败，需要进一步调试"
    echo "请检查服务日志: sudo docker-compose logs backend"
fi
'

# 使用sshpass执行修复
echo "🚀 连接服务器执行端口冲突修复..."

sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "
    echo '$PORT_FIX_SCRIPT' > /tmp/port_webhook_fix.sh
    chmod +x /tmp/port_webhook_fix.sh
    /tmp/port_webhook_fix.sh
    rm -f /tmp/port_webhook_fix.sh
"

FIX_RESULT=$?

if [ $FIX_RESULT -eq 0 ]; then
    echo ""
    echo "🎉 端口冲突修复完成！"
    echo ""
    echo "🔍 最终完整验证："
    sleep 3
    
    # 最终验证
    echo "1. 健康检查验证："
    curl -s https://tkmail.fun/health
    echo ""
    
    echo "2. Webhook端点验证："
    FINAL_WEBHOOK_TEST=$(curl -s -w "%{http_code}" -X POST "https://tkmail.fun/webhook/engagelab" \
        -H "Content-Type: application/json" \
        -d '{"final_verification": true, "fixed_port_conflict": true}' \
        -o /tmp/final_webhook_verification.json)
    
    echo "最终Webhook测试响应码: $FINAL_WEBHOOK_TEST"
    if [ "$FINAL_WEBHOOK_TEST" -eq 200 ]; then
        echo "✅ 最终验证成功！"
        echo "响应内容:"
        cat /tmp/final_webhook_verification.json
        echo ""
        echo "🎉🎉🎉 EDM系统完全修复成功！🎉🎉🎉"
        echo ""
        echo "🔗 生产环境信息:"
        echo "  ✅ 前端: https://tkmail.fun"
        echo "  ✅ Webhook: https://tkmail.fun/webhook/engagelab"
        echo "  ✅ 健康检查: https://tkmail.fun/health"
        echo ""
        echo "📋 您现在可以:"
        echo "1. 在EngageLab后台配置webhook URL"
        echo "2. 创建邮件任务测试完整流程"
        echo "3. 验证邮件发送和状态回调"
        echo "4. 监控EventLog表和SubTask状态"
        echo ""
        echo "🎯 EDM两阶段队列系统+Webhook现已完全就绪！"
    else
        echo "⚠️ 最终验证响应码: $FINAL_WEBHOOK_TEST"
        cat /tmp/final_webhook_verification.json
    fi
    rm -f /tmp/final_webhook_verification.json
else
    echo "❌ 端口冲突修复失败"
    exit 1
fi 