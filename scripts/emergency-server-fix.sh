#!/bin/bash

# EDM服务器紧急修复脚本
# 用于处理服务器Docker服务异常

echo "🚨 EDM服务器紧急修复脚本"
echo "=========================="

PRODUCTION_SERVER="43.135.38.15"
SERVER_USER="ubuntu"
SERVER_PASS="Tony1231!"

echo "🔍 正在诊断服务器状态..."

# 使用短超时连接
timeout 15 sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 $SERVER_USER@$PRODUCTION_SERVER << 'EOF'

echo "✅ SSH连接成功"

# 检查系统状态
echo "📊 系统资源状态:"
echo "负载: $(uptime | awk '{print $10,$11,$12}')"
echo "内存: $(free -h | grep Mem | awk '{print "使用"$3"/"$2" ("$5"剩余)"}')"
echo "磁盘: $(df -h / | tail -1 | awk '{print "使用"$5" ("$4"剩余)"}')"

# 检查Docker状态
echo -e "\n🐳 Docker服务状态:"
if systemctl is-active --quiet docker; then
    echo "✅ Docker服务正在运行"
else
    echo "❌ Docker服务未运行，尝试启动..."
    sudo systemctl start docker
    sleep 3
    if systemctl is-active --quiet docker; then
        echo "✅ Docker服务启动成功"
    else
        echo "❌ Docker服务启动失败"
        exit 1
    fi
fi

# 检查容器状态
echo -e "\n📋 容器状态检查:"
RUNNING_CONTAINERS=$(docker ps --format "{{.Names}}" | wc -l)
echo "运行中的容器数量: $RUNNING_CONTAINERS"

if [ "$RUNNING_CONTAINERS" -eq 0 ]; then
    echo "⚠️  没有运行中的容器，检查已停止的容器..."
    docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    echo -e "\n🚀 尝试重启核心服务..."
    
    # 重启EDM服务
    echo "重启EDM前端生产环境..."
    docker start edm-frontend-prod 2>/dev/null || echo "EDM前端容器不存在"
    
    echo "重启EDM后端..."
    docker start edm-backend-prod 2>/dev/null || docker start $(docker ps -a --format "{{.Names}}" | grep backend | head -1) 2>/dev/null || echo "EDM后端容器不存在"
    
    echo "重启EDM数据库..."
    docker start edm-postgres-prod 2>/dev/null || docker start $(docker ps -a --format "{{.Names}}" | grep postgres | head -1) 2>/dev/null || echo "EDM数据库容器不存在"
    
    echo "重启EDM Redis..."
    docker start edm-redis-prod 2>/dev/null || docker start $(docker ps -a --format "{{.Names}}" | grep redis | head -1) 2>/dev/null || echo "EDM Redis容器不存在"
else
    echo "✅ 有容器在运行，检查具体状态..."
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
fi

# 检查端口监听
echo -e "\n🌐 端口监听状态:"
netstat -tlnp | grep -E ":80|:443|:3001|:3002|:5000" | head -10

# 检查最近的系统日志
echo -e "\n📋 最近系统日志:"
journalctl -n 5 --no-pager -u docker

echo -e "\n✅ 诊断完成"

EOF

if [ $? -eq 0 ]; then
    echo "🎉 修复脚本执行完成"
    echo "⏳ 等待30秒让服务启动..."
    sleep 30
    
    echo "🌐 测试服务可用性..."
    HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' http://43.135.38.15:3001 || echo '000')
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ 生产环境恢复正常！"
        echo "🔗 访问地址: http://43.135.38.15:3001"
    else
        echo "❌ 生产环境仍然异常 (HTTP $HTTP_CODE)"
        echo "🔧 可能需要手动修复"
    fi
else
    echo "❌ 修复脚本执行失败"
    echo "💡 建议检查云服务器控制台或联系云服务商"
fi 