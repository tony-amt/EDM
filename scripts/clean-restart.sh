#!/bin/bash

echo "🔧 EDM系统彻底清理和重启脚本"
echo "================================"

# 1. 停止所有相关进程
echo "1. 停止所有Node.js进程..."
pkill -f "node.*3000" 
pkill -f "node.*3001"
pkill -f "react-scripts"
pkill -f "webpack"
pkill -f "serve"

sleep 3

# 2. 检查端口占用
echo "2. 检查端口占用状态..."
PORTS=(3000 3001)
for port in "${PORTS[@]}"; do
    PID=$(lsof -ti:$port)
    if [ ! -z "$PID" ]; then
        echo "⚠️  端口 $port 仍被进程 $PID 占用，强制终止..."
        kill -9 $PID
        sleep 1
    fi
done

# 3. 清理前端缓存
echo "3. 清理前端缓存..."
cd src/frontend
rm -rf build
rm -rf node_modules/.cache
rm -rf .eslintcache

# 4. 启动后端
echo "4. 启动后端服务 (端口3000)..."
cd ../../
nohup npm run dev:backend > logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "后端进程PID: $BACKEND_PID"

# 5. 等待后端启动
echo "5. 等待后端启动..."
for i in {1..30}; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo "✅ 后端服务启动成功"
        break
    fi
    echo "等待后端启动... ($i/30)"
    sleep 2
done

# 6. 启动前端
echo "6. 启动前端服务 (端口3001)..."
cd src/frontend
nohup PORT=3001 npm start > ../../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "前端进程PID: $FRONTEND_PID"

# 7. 等待前端启动
echo "7. 等待前端启动..."
for i in {1..60}; do
    RESPONSE=$(curl -s http://localhost:3001)
    if echo "$RESPONSE" | grep -q "<!DOCTYPE html>" && echo "$RESPONSE" | grep -q "root"; then
        echo "✅ 前端React应用启动成功"
        break
    fi
    echo "等待前端启动... ($i/60)"
    sleep 3
done

# 8. 验证服务状态
echo "8. 验证服务状态..."
echo "后端健康检查:"
curl -s http://localhost:3000/health

echo ""
echo "前端页面检查:"
FRONTEND_RESPONSE=$(curl -s http://localhost:3001 | head -5)
if echo "$FRONTEND_RESPONSE" | grep -q "EDM系统"; then
    echo "✅ 前端React应用正常"
else
    echo "❌ 前端可能不是React应用"
    echo "前端响应: $FRONTEND_RESPONSE"
fi

# 9. 保存进程信息
echo "9. 保存进程信息..."
mkdir -p logs
echo "BACKEND_PID=$BACKEND_PID" > logs/pids.env
echo "FRONTEND_PID=$FRONTEND_PID" >> logs/pids.env

echo ""
echo "🎉 启动完成！"
echo "后端: http://localhost:3000"
echo "前端: http://localhost:3001"
echo "进程信息已保存到 logs/pids.env" 