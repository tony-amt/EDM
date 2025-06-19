#!/bin/bash

# 启动测试服务器脚本
# 用于 EngageLab Webhook 测试

echo "🚀 启动 EDM 系统测试服务器..."

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker 未运行，请先启动 Docker"
    exit 1
fi

# 进入项目目录
cd "$(dirname "$0")/.."

echo "📂 当前目录: $(pwd)"

# 检查 docker-compose.yml 是否存在
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ 未找到 docker-compose.yml 文件"
    exit 1
fi

# 启动数据库和 Redis
echo "🗄️ 启动数据库和 Redis..."
docker-compose up -d postgres redis

# 等待数据库启动
echo "⏳ 等待数据库启动..."
sleep 10

# 检查数据库连接
echo "🔍 检查数据库连接..."
docker-compose exec postgres pg_isready -U postgres

# 准备测试数据
echo "📝 准备测试数据..."
cd src/backend
npm run prepare-test-data 2>/dev/null || echo "⚠️ 测试数据准备可能失败，请手动检查"

# 启动后端服务器
echo "🌐 启动后端服务器..."
npm start &

BACKEND_PID=$!

echo "✅ 后端服务器已启动 (PID: $BACKEND_PID)"
echo "🎯 服务器地址: http://localhost:3000"
echo "📡 Webhook 地址: http://localhost:3000/api/tracking/webhook/engagelab"

# 等待服务器启动
echo "⏳ 等待服务器启动..."
sleep 5

# 健康检查
echo "🏥 健康检查..."
curl -f http://localhost:3000/health > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ 服务器启动成功!"
    echo ""
    echo "🧪 现在可以运行 webhook 测试:"
    echo "   node scripts/test-engagelab-webhook.js"
    echo ""
    echo "🔗 或者单独测试邮件回复:"
    echo "   node scripts/test-engagelab-webhook.js reply"
    echo ""
    echo "🛑 停止服务器: Ctrl+C 或 kill $BACKEND_PID"
else
    echo "❌ 服务器启动失败，请检查日志"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# 保持脚本运行，等待用户中断
trap "echo '🛑 停止服务器...'; kill $BACKEND_PID 2>/dev/null; exit 0" INT

echo "⌛ 服务器运行中... 按 Ctrl+C 停止"
wait $BACKEND_PID 