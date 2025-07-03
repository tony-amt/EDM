#!/bin/bash

# 🎯 EDM最终Webhook修复部署脚本
# 确保后端代码同步并重启服务

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

echo "🎯 最终EDM Webhook修复部署"
echo "📅 部署时间: $(date)"
echo ""

# 最终部署脚本
FINAL_DEPLOY_SCRIPT='#!/bin/bash

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

echo "🎯 开始最终Webhook修复部署"
echo "📅 服务器时间: $(date)"

# 配置
PROJECT_DIR="/opt/edm"
BRANCH="refactor/two-stage-queue-system-20250701"
BACKUP_DIR="/opt/edm-backups/final-webhook-$(date +%Y%m%d_%H%M%S)"

# 1. 环境检查
log_info "检查部署环境..."
cd "$PROJECT_DIR"

# 2. 创建备份
log_info "创建最终备份..."
sudo mkdir -p "$BACKUP_DIR"
sudo cp -r src/backend/src/controllers/webhook.controller.js "$BACKUP_DIR/" 2>/dev/null || true
sudo cp -r src/backend/src/index.js "$BACKUP_DIR/" 2>/dev/null || true

# 3. 修复Git权限问题并拉取代码
log_info "修复Git权限并拉取最新代码..."
sudo git config --global --add safe.directory /opt/edm
sudo git fetch origin
sudo git checkout "$BRANCH"
sudo git reset --hard origin/"$BRANCH"

COMMIT_HASH=$(git rev-parse --short HEAD)
log_success "代码同步完成，提交hash: $COMMIT_HASH"

# 4. 验证关键文件存在
log_info "验证关键文件..."
if [ ! -f "src/backend/src/controllers/webhook.controller.js" ]; then
    log_error "webhook.controller.js文件不存在"
    exit 1
fi

if [ ! -f "src/backend/src/index.js" ]; then
    log_error "index.js文件不存在"
    exit 1
fi

# 检查webhook路由配置
if grep -q "app.post(\"/webhook/engagelab\"" src/backend/src/index.js; then
    log_success "webhook路由配置已找到"
else
    log_error "webhook路由配置未找到"
    exit 1
fi

# 5. 重建和重启后端服务
log_info "重建后端服务..."
sudo docker-compose build --no-cache backend

log_info "重启后端服务..."
sudo docker-compose stop backend
sudo docker-compose up -d backend

# 6. 等待服务启动
log_info "等待服务启动..."
sleep 30

# 7. 验证服务状态
log_info "验证服务状态..."
if sudo docker-compose ps backend | grep -q "Up"; then
    log_success "后端服务运行正常"
else
    log_error "后端服务启动失败"
    sudo docker-compose logs --tail=20 backend
    exit 1
fi

# 8. 健康检查
log_info "执行健康检查..."
MAX_RETRIES=12
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    log_info "健康检查尝试 $((RETRY_COUNT + 1))/$MAX_RETRIES..."
    
    if curl -s -f "https://tkmail.fun/health" > /tmp/health_check.json; then
        log_success "健康检查通过！"
        cat /tmp/health_check.json
        break
    else
        log_warning "健康检查失败，等待5秒后重试..."
        sleep 5
        RETRY_COUNT=$((RETRY_COUNT + 1))
    fi
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    log_error "健康检查持续失败，查看服务日志："
    sudo docker-compose logs --tail=20 backend
    exit 1
fi

# 9. 测试Webhook端点
log_info "测试Webhook端点..."
sleep 5

# 测试1: 基础POST请求
WEBHOOK_TEST1=$(curl -s -w "%{http_code}" -X POST "https://tkmail.fun/webhook/engagelab" \
    -H "Content-Type: application/json" \
    -d "{\"test\": true, \"timestamp\": \"$(date)\"}" \
    -o /tmp/webhook_test1.json)

echo "基础POST测试响应码: $WEBHOOK_TEST1"
echo "响应内容:"
cat /tmp/webhook_test1.json

# 测试2: message_status格式
log_info "测试message_status格式..."
WEBHOOK_TEST2=$(curl -s -w "%{http_code}" -X POST "https://tkmail.fun/webhook/engagelab" \
    -H "Content-Type: application/json" \
    -d "{
        \"message_status\": \"delivered\",
        \"status_data\": {\"message\": \"final test delivery\"},
        \"custom_args\": {\"subtask_id\": \"final-test-$(date +%s)\"},
        \"email_id\": \"final-test-email-$(date +%s)\",
        \"task_id\": 99999,
        \"api_user\": \"final_test\",
        \"to\": \"test@example.com\",
        \"timestamp\": \"$(date)\"
    }" \
    -o /tmp/webhook_test2.json)

echo "message_status测试响应码: $WEBHOOK_TEST2"
echo "响应内容:"
cat /tmp/webhook_test2.json

# 测试3: event格式
log_info "测试event格式..."
WEBHOOK_TEST3=$(curl -s -w "%{http_code}" -X POST "https://tkmail.fun/webhook/engagelab" \
    -H "Content-Type: application/json" \
    -d "{
        \"event\": \"open\",
        \"response_data\": {\"ip\": \"127.0.0.1\", \"user_agent\": \"test\"},
        \"custom_args\": {\"subtask_id\": \"final-event-test-$(date +%s)\"},
        \"email_id\": \"final-event-email-$(date +%s)\",
        \"task_id\": 99999,
        \"api_user\": \"final_event_test\",
        \"to\": \"test@example.com\",
        \"timestamp\": \"$(date)\"
    }" \
    -o /tmp/webhook_test3.json)

echo "event格式测试响应码: $WEBHOOK_TEST3"
echo "响应内容:"
cat /tmp/webhook_test3.json

# 10. 验证EventLog记录
log_info "验证EventLog数据记录..."
EVENTLOG_COUNT=$(sudo docker-compose exec -T postgres psql -U postgres -d edm_production -t -c "
SELECT COUNT(*) FROM event_logs 
WHERE source = \"engagelab\" 
AND created_at > NOW() - INTERVAL \"10 minutes\";
" | tr -d " ")

log_info "最近10分钟的EventLog记录数: $EVENTLOG_COUNT"

if [ "$EVENTLOG_COUNT" -gt 0 ]; then
    log_success "EventLog记录正常"
    
    log_info "最新的EventLog记录:"
    sudo docker-compose exec -T postgres psql -U postgres -d edm_production -c "
    SELECT id, event_type, status, message_id, created_at 
    FROM event_logs 
    WHERE source = \"engagelab\" 
    ORDER BY created_at DESC 
    LIMIT 5;
    "
else
    log_warning "没有找到新的EventLog记录"
fi

# 11. 检查服务日志（查看是否有错误）
log_info "检查最近的服务日志..."
echo "=== 最近的后端日志 ==="
sudo docker-compose logs --tail=10 backend

# 清理临时文件
rm -f /tmp/health_check.json /tmp/webhook_test*.json

# 最终部署总结
echo ""
echo "======================================================="
log_success "🎯 最终Webhook修复部署完成!"
echo "======================================================="
echo ""
echo "📊 部署详情:"
echo "  - 分支: $BRANCH"
echo "  - 提交: $COMMIT_HASH"
echo "  - 备份: $BACKUP_DIR"
echo "  - 部署时间: $(date)"
echo ""
echo "🔗 重要端点:"
echo "  - Webhook URL: https://tkmail.fun/webhook/engagelab"
echo "  - 健康检查: https://tkmail.fun/health"
echo "  - 前端地址: https://tkmail.fun"
echo ""
echo "✅ 测试结果:"
echo "  - 基础POST: HTTP $WEBHOOK_TEST1"
echo "  - message_status: HTTP $WEBHOOK_TEST2"
echo "  - event格式: HTTP $WEBHOOK_TEST3"
echo "  - EventLog记录: $EVENTLOG_COUNT 条新记录"
echo ""

if [ "$WEBHOOK_TEST1" -eq 200 ] && [ "$WEBHOOK_TEST2" -eq 200 ] && [ "$WEBHOOK_TEST3" -eq 200 ]; then
    log_success "🎉 所有测试通过！Webhook现在完全可用！"
    echo ""
    echo "🎯 下一步操作："
    echo "1. 在EngageLab后台配置webhook URL: https://tkmail.fun/webhook/engagelab"
    echo "2. 创建真实任务测试EngageLab回调"
    echo "3. 监控EventLog表和SubTask状态更新"
    echo "4. 验证联系人标签和统计数据更新"
    echo ""
    log_success "✅ EDM Webhook系统现已完全就绪！"
else
    log_warning "⚠️ 部分测试失败，需要进一步调试:"
    echo "  - 检查后端服务日志"
    echo "  - 验证路由配置"
    echo "  - 确认控制器方法"
fi
'

# 使用sshpass执行最终部署
log_info "连接到生产服务器执行最终部署..."

sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "
    echo '$FINAL_DEPLOY_SCRIPT' > /tmp/final_webhook_deploy.sh
    chmod +x /tmp/final_webhook_deploy.sh
    sudo /tmp/final_webhook_deploy.sh
    rm -f /tmp/final_webhook_deploy.sh
"

FINAL_RESULT=$?

if [ $FINAL_RESULT -eq 0 ]; then
    log_success "🎉 最终部署成功完成！"
    
    echo ""
    echo "🎯 最终验证测试："
    sleep 3
    
    VERIFICATION_TEST=$(curl -s -w "%{http_code}" -X POST "https://tkmail.fun/webhook/engagelab" \
        -H "Content-Type: application/json" \
        -d '{"final_verification": true, "timestamp": "'$(date)'"}' \
        -o /tmp/final_verification.json)
    
    echo "最终验证响应码: $VERIFICATION_TEST"
    if [ "$VERIFICATION_TEST" -eq 200 ]; then
        log_success "✅ 最终验证成功！Webhook完全可用！"
        echo "验证响应:"
        cat /tmp/final_verification.json
        rm -f /tmp/final_verification.json
        
        echo ""
        echo "🎉🎉🎉 EDM两阶段队列系统+Webhook修复完成！🎉🎉🎉"
        echo ""
        echo "🔗 生产环境信息:"
        echo "  - 前端: https://tkmail.fun"
        echo "  - Webhook: https://tkmail.fun/webhook/engagelab" 
        echo "  - 健康检查: https://tkmail.fun/health"
        echo ""
        echo "📋 可以进行的操作:"
        echo "1. 登录EDM系统创建测试任务"
        echo "2. 在EngageLab配置webhook回调"
        echo "3. 监控EventLog表验证回调数据"
        echo "4. 检查SubTask状态自动更新"
        echo ""
        log_success "🎯 系统现已完全就绪，可以开始正常使用！"
    else
        log_warning "⚠️ 最终验证异常，响应码: $VERIFICATION_TEST"
        cat /tmp/final_verification.json
        rm -f /tmp/final_verification.json
    fi
else
    log_error "❌ 最终部署失败"
    exit 1
fi 