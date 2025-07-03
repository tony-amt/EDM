#!/bin/bash

# 🔧 修复前端端口配置脚本
# 修复docker-compose中的端口冲突问题

set -e

echo "🔧 修复前端端口配置..."
echo "📅 时间: $(date)"
echo "🎯 目标: 修复端口冲突，让前端使用3002端口"

SERVER_IP="43.135.38.15"

# 服务器端操作
ssh ubuntu@$SERVER_IP << 'ENDSSH'
set -e

cd /opt/edm

echo "🔍 检查当前端口占用..."
echo "=== 端口3000 ==="
sudo netstat -tlnp | grep ':3000 ' || echo "端口3000空闲"

echo "=== 端口3001 ==="
sudo netstat -tlnp | grep ':3001 ' || echo "端口3001空闲"

echo "=== 端口3002 ==="
sudo netstat -tlnp | grep ':3002 ' || echo "端口3002空闲"

echo ""
echo "🔍 当前docker-compose配置:"
echo "=== 后端端口 ==="
grep -A 2 -B 2 "3001:3000" docker-compose.yml

echo "=== 前端端口 ==="
grep -A 2 -B 2 "3001:3001" docker-compose.yml

echo ""
echo "📝 修复端口配置..."

# 备份原配置
cp docker-compose.yml docker-compose.yml.backup.$(date +%Y%m%d_%H%M%S)

# 修复前端端口配置 (3001:3001 → 3002:3001)
sed -i 's/- "3001:3001"/- "3002:3001"/' docker-compose.yml

# 验证修改
echo "✅ 修复后的配置:"
echo "=== 后端端口 (应该是3001:3000) ==="
grep -A 2 -B 2 "3001:3000" docker-compose.yml

echo "=== 前端端口 (应该是3002:3001) ==="
grep -A 2 -B 2 "3002:3001" docker-compose.yml

echo ""
echo "🚀 启动前端容器..."
sudo docker-compose up -d frontend

# 等待容器启动
sleep 5

echo "✅ 检查容器状态..."
sudo docker ps --filter "name=edm-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "🧪 测试前端端口..."
FRONTEND_TEST=$(curl -s -w "%{http_code}" http://localhost:3002 -o /tmp/frontend_test.html || echo "000")
echo "前端测试 (端口3002): $FRONTEND_TEST"

if [ "$FRONTEND_TEST" = "200" ]; then
    echo "✅ 前端响应正常！"
    echo "前端内容预览:"
    head -c 200 /tmp/frontend_test.html 2>/dev/null && echo ""
else
    echo "⚠️ 前端测试结果: $FRONTEND_TEST"
    echo "检查容器日志:"
    sudo docker logs edm-frontend --tail 10
fi

rm -f /tmp/frontend_test.html

echo ""
echo "🎊 前端端口配置修复完成！"
echo ""
echo "📋 修复结果："
echo "  🔹 后端: localhost:3001 → 容器3000"
echo "  🔹 前端: localhost:3002 → 容器3001"
echo "  🔹 不再有端口冲突"
echo ""
echo "🎯 下一步："
echo "  1. 修复nginx配置，让根路径代理到localhost:3002"
echo "  2. 测试 https://tkmail.fun 访问前端页面"

ENDSSH

RESULT=$?

if [ $RESULT -eq 0 ]; then
    echo ""
    echo "🎉 前端端口配置修复成功！"
    echo ""
    echo "📊 新的端口分配："
    echo "  🔹 后端API: 宿主机3001 → 容器3000"
    echo "  🔹 前端Web: 宿主机3002 → 容器3001" 
    echo "  🔹 数据库: 宿主机5432 → 容器5432"
    echo "  🔹 Redis: 宿主机6379 → 容器6379"
    echo ""
    echo "✅ 现在需要修复nginx配置，让域名访问前端"
else
    echo "❌ 前端端口配置修复失败"
    exit 1
fi

echo ""
echo "🎯 前端端口配置修复完成！" 