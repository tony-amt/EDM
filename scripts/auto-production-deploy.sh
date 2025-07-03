#!/bin/bash

# 🚀 EDM生产环境自动部署脚本 (使用sshpass)
# 自动连接到生产服务器并部署webhook修复

set -e

# 配置
SERVER_IP="43.135.38.15"
SERVER_USER="ubuntu"
SERVER_PASS="Tony1231!"
PROJECT_DIR="/opt/edm"
BRANCH="refactor/two-stage-queue-system-20250701"

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

# 检查sshpass
if ! command -v sshpass &> /dev/null; then
    log_error "sshpass未安装，请先安装: brew install sshpass"
    exit 1
fi

echo "🚀 开始EDM生产环境自动部署"
echo "📅 部署时间: $(date)"
echo "🌐 目标服务器: $SERVER_IP"
echo "👤 用户: $SERVER_USER"
echo ""

# 创建部署脚本内容
DEPLOY_SCRIPT='#!/bin/bash

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

echo "🚀 开始EDM Webhook修复部署"
echo "📅 服务器时间: $(date)"
echo "🌐 服务器IP: $(hostname -I | awk \"{print \$1}\")"
echo "👤 用户: $(whoami)"

# 配置
PROJECT_DIR="/opt/edm"
BRANCH="refactor/two-stage-queue-system-20250701"
WEBHOOK_URL="https://tkmail.fun/webhook/engagelab"
HEALTH_URL="https://tkmail.fun/health"
BACKUP_DIR="/opt/edm-backups/webhook-fix-$(date +%Y%m%d_%H%M%S)"

# 1. 环境检查
log_info "检查部署环境..."

if [ ! -d "$PROJECT_DIR" ]; then
    log_error "项目目录不存在: $PROJECT_DIR"
    exit 1
fi

cd "$PROJECT_DIR"
log_success "切换到项目目录: $PROJECT_DIR"

# 检查Docker
if ! command -v docker &> /dev/null; then
    log_error "Docker未安装"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    log_error "Docker Compose未安装"
    exit 1
fi

log_success "Docker环境检查通过"

# 2. 创建备份
log_info "创建部署前备份..."
sudo mkdir -p "$BACKUP_DIR"

# 备份关键文件
sudo cp src/backend/src/controllers/webhook.controller.js "$BACKUP_DIR/" 2>/dev/null || log_warning "webhook.controller.js不存在"
sudo cp src/backend/src/index.js "$BACKUP_DIR/" 2>/dev/null || log_warning "index.js不存在"

log_success "备份已创建: $BACKUP_DIR"

# 3. 拉取最新代码
log_info "拉取最新代码..."
sudo git fetch origin
sudo git checkout "$BRANCH"
sudo git pull origin "$BRANCH"

COMMIT_HASH=$(git rev-parse --short HEAD)
log_success "代码更新完成，当前提交: $COMMIT_HASH"

# 4. 重建并重启服务
log_info "重建并重启后端服务..."
sudo docker-compose build backend
sudo docker-compose restart backend

# 5. 等待服务启动
log_info "等待服务启动..."
sleep 20

# 6. 健康检查
log_info "执行健康检查..."
MAX_RETRIES=10
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    log_info "健康检查尝试 $((RETRY_COUNT + 1))/$MAX_RETRIES..."
    
    if curl -s -f "$HEALTH_URL" > /tmp/health_response.json; then
        log_success "健康检查通过！"
        cat /tmp/health_response.json
        break
    else
        log_warning "健康检查失败，等待5秒后重试..."
        sleep 5
        RETRY_COUNT=$((RETRY_COUNT + 1))
    fi
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    log_error "健康检查失败，查看日志："
    sudo docker-compose logs --tail=10 backend
    exit 1
fi

# 7. 测试Webhook端点
log_info "测试Webhook端点..."

# 测试1: 基础连通性
WEBHOOK_RESPONSE=$(curl -s -w "%{http_code}" -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{\"test\": true}" \
    -o /tmp/webhook_test1.json)

echo "基础测试响应码: $WEBHOOK_RESPONSE"
if [ "$WEBHOOK_RESPONSE" -eq 200 ]; then
    log_success "Webhook端点基础测试通过"
    cat /tmp/webhook_test1.json
else
    log_error "Webhook端点基础测试失败"
    cat /tmp/webhook_test1.json
fi

# 测试2: message_status格式
log_info "测试message_status格式..."
WEBHOOK_RESPONSE2=$(curl -s -w "%{http_code}" -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{
        \"message_status\": \"delivered\",
        \"status_data\": {\"message\": \"test delivery\"},
        \"custom_args\": {\"subtask_id\": \"production-test-$(date +%s)\"},
        \"email_id\": \"test-email-$(date +%s)\",
        \"task_id\": 99999,
        \"api_user\": \"production_test\"
    }" \
    -o /tmp/webhook_test2.json)

echo "message_status测试响应码: $WEBHOOK_RESPONSE2"
if [ "$WEBHOOK_RESPONSE2" -eq 200 ]; then
    log_success "message_status格式测试通过"
    cat /tmp/webhook_test2.json
else
    log_warning "message_status格式测试异常"
    cat /tmp/webhook_test2.json
fi

# 8. 数据库验证
log_info "验证EventLog数据记录..."
EVENTLOG_COUNT=$(sudo docker-compose exec -T postgres psql -U postgres -d edm_production -t -c "
SELECT COUNT(*) FROM event_logs 
WHERE source = \"engagelab\" 
AND created_at > NOW() - INTERVAL \"5 minutes\";
" | tr -d " ")

log_info "最近5分钟的EventLog记录数: $EVENTLOG_COUNT"

if [ "$EVENTLOG_COUNT" -gt 0 ]; then
    log_success "EventLog记录正常"
    
    log_info "最新的EventLog记录:"
    sudo docker-compose exec -T postgres psql -U postgres -d edm_production -c "
    SELECT id, event_type, status, created_at 
    FROM event_logs 
    WHERE source = \"engagelab\" 
    ORDER BY created_at DESC 
    LIMIT 3;
    "
else
    log_warning "没有找到新的EventLog记录"
fi

# 9. 生产回归测试
log_info "生产回归测试..."

# 检查任务状态
ACTIVE_TASKS=$(sudo docker-compose exec -T postgres psql -U postgres -d edm_production -t -c "
SELECT COUNT(*) FROM tasks 
WHERE status IN (\"scheduled\", \"running\");
" | tr -d " ")

log_info "当前活跃任务数: $ACTIVE_TASKS"

# 检查SubTask状态分布
log_info "SubTask状态分布:"
sudo docker-compose exec -T postgres psql -U postgres -d edm_production -c "
SELECT status, COUNT(*) as count 
FROM sub_tasks 
WHERE created_at > NOW() - INTERVAL \"24 hours\"
GROUP BY status 
ORDER BY count DESC
LIMIT 5;
"

# 10. 服务状态
log_info "检查所有服务状态..."
sudo docker-compose ps

# 清理临时文件
rm -f /tmp/health_response.json /tmp/webhook_test*.json

# 部署总结
echo ""
echo "======================================================"
log_success "🎉 EDM Webhook修复部署完成!"
echo "======================================================"
echo ""
echo "📊 部署信息:"
echo "  - 分支: $BRANCH"
echo "  - 提交: $COMMIT_HASH"
echo "  - 服务器: $(hostname -I | awk \"{print \$1}\")"
echo "  - 部署时间: $(date)"
echo ""
echo "🔗 重要端点:"
echo "  - Webhook URL: $WEBHOOK_URL"
echo "  - 健康检查: $HEALTH_URL"
echo "  - 前端地址: https://tkmail.fun"
echo ""
echo "✅ 测试结果:"
echo "  - 健康检查: 通过"
echo "  - Webhook端点: 响应码 $WEBHOOK_RESPONSE"
echo "  - message_status格式: 响应码 $WEBHOOK_RESPONSE2"
echo "  - EventLog记录: $EVENTLOG_COUNT 条新记录"
echo ""
log_success "🎯 部署成功！现在可以测试EngageLab回调了！"
echo ""
echo "📋 下一步操作:"
echo "1. 在EngageLab后台确认webhook URL: $WEBHOOK_URL"
echo "2. 创建小规模测试任务验证实际回调"
echo "3. 监控EventLog表确认数据正确记录"
'

# 使用sshpass连接服务器并执行部署
log_info "连接到生产服务器 $SERVER_IP..."

sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "
    echo '$DEPLOY_SCRIPT' > /tmp/deploy_webhook.sh
    chmod +x /tmp/deploy_webhook.sh
    sudo /tmp/deploy_webhook.sh
    rm -f /tmp/deploy_webhook.sh
"

DEPLOY_RESULT=$?

if [ $DEPLOY_RESULT -eq 0 ]; then
    log_success "🎉 生产环境部署成功完成！"
    echo ""
    echo "🔗 重要信息："
    echo "  - Webhook URL: https://tkmail.fun/webhook/engagelab"
    echo "  - 健康检查: https://tkmail.fun/health"
    echo "  - 前端地址: https://tkmail.fun"
    echo ""
    echo "📋 验证步骤："
    echo "1. 访问 https://tkmail.fun 确认前端正常"
    echo "2. 在EngageLab后台配置webhook URL"
    echo "3. 创建测试任务验证message_status回调"
    echo ""
    log_success "✅ 现在可以开始测试EngageLab webhook了！"
else
    log_error "❌ 部署过程中出现错误，请检查上面的日志"
    exit 1
fi 