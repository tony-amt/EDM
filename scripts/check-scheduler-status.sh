#!/bin/bash

# EDM调度服务状态检查脚本
# 用于监控生产环境的定时调度服务运行状态

echo "=== EDM调度服务状态检查 ==="
echo "检查时间: $(date)"
echo ""

# 1. 检查容器运行状态
echo "1. 容器状态检查:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(edm|NAMES)"
echo ""

# 2. 检查调度器启动状态
echo "2. 调度器启动状态:"
docker logs edm-backend-debug 2>&1 | grep -E "(调度器|scheduler|队列|queue)" | tail -10
echo ""

# 3. 检查定时器运行状态
echo "3. 定时器状态:"
docker logs edm-backend-debug 2>&1 | grep -E "(定时器|timer|轮询)" | tail -5
echo ""

# 4. 检查数据库连接
echo "4. 数据库连接状态:"
DB_STATUS=$(docker exec edm-postgres-debug pg_isready -U postgres 2>&1)
if [ $? -eq 0 ]; then
    echo "✅ 数据库连接正常: $DB_STATUS"
else
    echo "❌ 数据库连接异常: $DB_STATUS"
fi
echo ""

# 5. 检查Redis连接
echo "5. Redis连接状态:"
REDIS_STATUS=$(docker exec edm-redis-debug redis-cli ping 2>&1)
if [ "$REDIS_STATUS" = "PONG" ]; then
    echo "✅ Redis连接正常: $REDIS_STATUS"
else
    echo "❌ Redis连接异常: $REDIS_STATUS"
fi
echo ""

# 6. 检查后端API健康状态
echo "6. 后端API健康检查:"
HEALTH_STATUS=$(curl -s -w "%{http_code}" http://localhost:3002/health -o /dev/null)
if [ "$HEALTH_STATUS" = "200" ]; then
    echo "✅ 后端API健康状态正常"
else
    echo "❌ 后端API健康状态异常: HTTP $HEALTH_STATUS"
fi
echo ""

# 7. 检查最近的错误日志
echo "7. 最近的错误日志:"
docker logs edm-backend-debug 2>&1 | grep -i error | tail -3
echo ""

# 8. 检查调度器相关的最新日志
echo "8. 调度器最新活动:"
docker logs edm-backend-debug 2>&1 | grep -E "(处理|发送|分配)" | tail -5
echo ""

echo "=== 检查完成 ==="

# 返回状态码
if [ "$DB_STATUS" != "" ] && [ "$REDIS_STATUS" = "PONG" ] && [ "$HEALTH_STATUS" = "200" ]; then
    echo "🎉 所有核心服务运行正常"
    exit 0
else
    echo "⚠️  发现异常，请检查上述输出"
    exit 1
fi 