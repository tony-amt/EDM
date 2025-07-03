#!/bin/bash

# 🔧 EDM完全自动化Webhook修复脚本
# 自动修复所有webhook相关问题

set -e

# 配置
SERVER_IP="43.135.38.15"
SERVER_USER="ubuntu"
SERVER_PASS="Tony1231!"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo "🔧 开始完全自动化Webhook修复"
echo "📅 修复时间: $(date)"
echo ""

# 完整修复脚本
COMPLETE_FIX_SCRIPT='#!/bin/bash

set -e

# 颜色定义
RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
BLUE="\033[0;34m"
NC="\033[0m"

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo "🔧 开始服务器端修复"
cd /opt/edm

# 1. 创建备份
BACKUP_DIR="/opt/edm-backups/auto-webhook-fix-$(date +%Y%m%d_%H%M%S)"
sudo mkdir -p "$BACKUP_DIR"
sudo cp src/backend/src/index.js "$BACKUP_DIR/" 2>/dev/null || true
sudo cp src/backend/src/controllers/webhook.controller.js "$BACKUP_DIR/" 2>/dev/null || true
echo "✅ 备份创建完成: $BACKUP_DIR"

# 2. 检查并添加webhook路由到index.js
echo "🔧 检查index.js中的webhook路由..."
if grep -q "webhook/engagelab" src/backend/src/index.js; then
    echo "✅ webhook路由已存在"
else
    echo "🔧 添加webhook路由到index.js..."
    # 在static文件服务后添加webhook路由
    sudo sed -i "/app.use(express.static(path.join(__dirname, \"..\/public\")));/a\\
\\
\/\/ 🔧 EngageLab Webhook路由\\
const webhookController = require(\"\.\/controllers\/webhook.controller\");\\
app.post(\"\/webhook\/engagelab\", webhookController.handleMailEvent);" src/backend/src/index.js
    echo "✅ webhook路由已添加"
fi

# 3. 验证路由添加结果
if grep -q "webhook/engagelab" src/backend/src/index.js; then
    echo "✅ webhook路由配置确认存在"
else
    echo "❌ webhook路由配置添加失败"
    exit 1
fi

# 4. 重建并重启服务
echo "🔧 重建并重启后端服务..."
sudo docker-compose build --no-cache backend
sudo docker-compose stop backend
sudo docker-compose up -d backend

# 5. 等待服务启动
echo "⏳ 等待服务启动..."
sleep 30

# 6. 健康检查
echo "🔍 执行健康检查..."
for i in {1..10}; do
    echo "健康检查尝试 $i/10..."
    if curl -s -f "https://tkmail.fun/health" > /dev/null; then
        echo "✅ 健康检查通过！"
        break
    else
        echo "⚠️ 健康检查失败，等待5秒后重试..."
        sleep 5
    fi
    if [ $i -eq 10 ]; then
        echo "❌ 健康检查持续失败"
        sudo docker-compose logs --tail=10 backend
        exit 1
    fi
done

# 7. 测试Webhook端点
echo "🧪 测试Webhook端点..."
sleep 5

# 基础测试
WEBHOOK_TEST=$(curl -s -w "%{http_code}" -X POST "https://tkmail.fun/webhook/engagelab" \
    -H "Content-Type: application/json" \
    -d "{\"test\": true}" \
    -o /tmp/webhook_test.json)

echo "基础测试响应码: $WEBHOOK_TEST"
echo "响应内容:"
cat /tmp/webhook_test.json

# message_status测试
MESSAGE_STATUS_TEST=$(curl -s -w "%{http_code}" -X POST "https://tkmail.fun/webhook/engagelab" \
    -H "Content-Type: application/json" \
    -d "{
        \"message_status\": \"delivered\",
        \"status_data\": {\"message\": \"test\"},
        \"custom_args\": {\"subtask_id\": \"test-123\"},
        \"email_id\": \"test-email-123\",
        \"task_id\": 99999,
        \"to\": \"test@example.com\"
    }" \
    -o /tmp/message_status_test.json)

echo "message_status测试响应码: $MESSAGE_STATUS_TEST"
echo "响应内容:"
cat /tmp/message_status_test.json

# 8. 验证EventLog
echo "🔍 验证EventLog记录..."
EVENTLOG_COUNT=$(sudo docker-compose exec -T postgres psql -U postgres -d edm_production -t -c "
SELECT COUNT(*) FROM event_logs 
WHERE source = \"engagelab\" 
AND created_at > NOW() - INTERVAL \"10 minutes\";
" | tr -d " ")

echo "最近10分钟EventLog记录数: $EVENTLOG_COUNT"

# 清理
rm -f /tmp/webhook_test.json /tmp/message_status_test.json

# 结果总结
echo ""
echo "========================================"
echo "🎉 Webhook修复完成!"
echo "========================================"
echo "备份: $BACKUP_DIR"
echo "基础测试: HTTP $WEBHOOK_TEST"
echo "状态测试: HTTP $MESSAGE_STATUS_TEST"
echo "EventLog: $EVENTLOG_COUNT 条记录"
echo ""

if [ "$WEBHOOK_TEST" -eq 200 ] && [ "$MESSAGE_STATUS_TEST" -eq 200 ]; then
    echo "✅ 所有测试通过！Webhook完全可用！"
    echo "🔗 Webhook URL: https://tkmail.fun/webhook/engagelab"
    echo "🎯 现在可以在EngageLab配置此URL！"
else
    echo "⚠️ 部分测试失败，需要进一步调试"
fi
'

# 使用sshpass执行修复
echo "🚀 连接服务器执行修复..."

sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "
    echo '$COMPLETE_FIX_SCRIPT' > /tmp/webhook_fix.sh
    chmod +x /tmp/webhook_fix.sh
    /tmp/webhook_fix.sh
    rm -f /tmp/webhook_fix.sh
"

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 自动化修复完成！"
    echo ""
    echo "🔍 最终验证测试："
    FINAL_TEST=$(curl -s -w "%{http_code}" -X POST "https://tkmail.fun/webhook/engagelab" \
        -H "Content-Type: application/json" \
        -d '{"final_test": true}' \
        -o /tmp/final_test.json)
    
    echo "最终测试响应码: $FINAL_TEST"
    if [ "$FINAL_TEST" -eq 200 ]; then
        echo "✅ 最终验证成功！"
        echo "响应内容:"
        cat /tmp/final_test.json
        echo ""
        echo "🎉🎉🎉 EDM Webhook系统完全修复成功！🎉🎉🎉"
        echo ""
        echo "📍 重要信息："
        echo "- Webhook URL: https://tkmail.fun/webhook/engagelab"
        echo "- 前端地址: https://tkmail.fun"
        echo "- 现在可以在EngageLab后台配置webhook了！"
    else
        echo "⚠️ 最终验证失败，响应码: $FINAL_TEST"
        cat /tmp/final_test.json
    fi
    rm -f /tmp/final_test.json
else
    echo "❌ 自动化修复失败"
    exit 1
fi 