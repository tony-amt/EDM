#!/bin/bash

# 容器验证脚本 - 确保容器正确启动和运行
# 使用方法: ./scripts/verify-container.sh [容器名称]

set -e

CONTAINER_NAME=${1:-"edm-backend-prod"}
echo "🔍 验证容器: $CONTAINER_NAME"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查函数
check_step() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $1${NC}"
    else
        echo -e "${RED}❌ $1${NC}"
        exit 1
    fi
}

echo "📋 开始容器验证流程..."

# 1. 检查容器是否存在
echo "🔍 检查容器是否存在..."
docker ps -a | grep -q "$CONTAINER_NAME"
check_step "容器存在检查"

# 2. 检查容器状态
echo "🔍 检查容器运行状态..."
docker ps | grep -q "$CONTAINER_NAME.*Up"
check_step "容器运行状态"

# 3. 检查主进程
echo "🔍 检查Node.js主进程..."
MAIN_PROCESS=$(docker exec $CONTAINER_NAME ps aux | grep -v grep | grep -c "node src/index.js" || echo "0")
if [ "$MAIN_PROCESS" -eq "0" ]; then
    echo -e "${RED}❌ Node.js主进程未运行${NC}"
    echo "当前进程列表:"
    docker exec $CONTAINER_NAME ps aux
    exit 1
fi
check_step "Node.js主进程运行检查"

# 4. 检查端口监听
echo "🔍 检查端口3000监听状态..."
docker exec $CONTAINER_NAME netstat -tlnp | grep -q ":3000"
check_step "端口3000监听检查"

# 5. 检查容器日志（最近10行）
echo "🔍 检查容器日志..."
echo -e "${YELLOW}最近日志:${NC}"
docker logs --tail 10 $CONTAINER_NAME

# 6. 检查内存使用
echo "🔍 检查资源使用情况..."
MEMORY_USAGE=$(docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" $CONTAINER_NAME)
echo -e "${YELLOW}资源使用:${NC}"
echo "$MEMORY_USAGE"

# 7. 健康检查（如果容器有健康检查）
echo "🔍 Docker健康检查状态..."
HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' $CONTAINER_NAME 2>/dev/null || echo "no-healthcheck")
if [ "$HEALTH_STATUS" != "no-healthcheck" ]; then
    echo "健康检查状态: $HEALTH_STATUS"
    if [ "$HEALTH_STATUS" != "healthy" ] && [ "$HEALTH_STATUS" != "starting" ]; then
        echo -e "${YELLOW}⚠️  健康检查状态异常${NC}"
    fi
fi

# 8. API健康检查（如果可以访问）
echo "🔍 API健康检查..."
CONTAINER_IP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $CONTAINER_NAME)
if [ ! -z "$CONTAINER_IP" ]; then
    # 尝试访问健康检查端点
    HTTP_CODE=$(curl -s -w "%{http_code}" -o /dev/null "http://$CONTAINER_IP:3000/api/health" --connect-timeout 5 || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        check_step "API健康检查"
    else
        echo -e "${YELLOW}⚠️  API健康检查失败 (HTTP: $HTTP_CODE)${NC}"
        echo "容器IP: $CONTAINER_IP"
        echo "尝试通过localhost检查..."
        HTTP_CODE_LOCAL=$(curl -s -w "%{http_code}" -o /dev/null "http://localhost:8080/api/health" --connect-timeout 5 || echo "000")
        echo "localhost检查结果: $HTTP_CODE_LOCAL"
    fi
fi

# 9. 环境变量检查
echo "🔍 检查关键环境变量..."
ENV_VARS=$(docker exec $CONTAINER_NAME env | grep -E "(NODE_ENV|DB_HOST|DB_NAME|REDIS_HOST)" || echo "")
if [ ! -z "$ENV_VARS" ]; then
    echo -e "${YELLOW}环境变量:${NC}"
    echo "$ENV_VARS"
else
    echo -e "${YELLOW}⚠️  未找到关键环境变量${NC}"
fi

echo ""
echo -e "${GREEN}🎉 容器验证完成！${NC}"
echo -e "${GREEN}✅ 容器 $CONTAINER_NAME 运行正常${NC}"

# 输出验证摘要
echo ""
echo "📊 验证摘要:"
echo "  - 容器名称: $CONTAINER_NAME"
echo "  - 主进程: node src/index.js (运行中)"
echo "  - 端口监听: 3000 ✓"
echo "  - 容器IP: $CONTAINER_IP"
echo "  - 验证时间: $(date)" 