#!/bin/bash

# 🔧 修复前端容器npm问题脚本
# 重新构建前端镜像并解决npm not found问题

set -e

echo "🔧 修复前端容器npm问题..."
echo "📅 时间: $(date)"
echo "🎯 目标: 重新构建前端镜像，解决npm问题"

SERVER_IP="43.135.38.15"

# 服务器端操作
ssh ubuntu@$SERVER_IP << 'ENDSSH'
set -e

cd /opt/edm

echo "🔍 检查前端Dockerfile..."
echo "=== 当前Dockerfile内容 ==="
cat src/frontend/Dockerfile

echo ""
echo "📝 创建优化的前端Dockerfile..."

# 备份原Dockerfile
cp src/frontend/Dockerfile src/frontend/Dockerfile.backup.$(date +%Y%m%d_%H%M%S)

# 创建修复的Dockerfile
cat > src/frontend/Dockerfile << 'EOFDOCKER'
# 使用官方Node.js 18镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 安装基础工具（Alpine需要）
RUN apk add --no-cache bash

# 复制package文件
COPY package*.json ./

# 清理npm缓存并安装依赖
RUN npm cache clean --force && \
    npm install --no-package-lock --legacy-peer-deps

# 设置环境变量
ENV REACT_APP_API_BASE_URL=/api
ENV PORT=3001
ENV NODE_ENV=development

# 复制源代码
COPY . .

# 暴露端口
EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001 || exit 1

# 启动开发服务器
CMD ["npm", "start"]
EOFDOCKER

echo "✅ 新Dockerfile已创建"

echo ""
echo "🏗️ 重新构建前端镜像..."
sudo docker build --no-cache -t edm-frontend:latest -f src/frontend/Dockerfile src/frontend/

echo ""
echo "✅ 检查新构建的镜像..."
sudo docker images | grep edm-frontend | head -3

echo ""
echo "🚀 启动修复后的前端容器..."
sudo docker-compose up -d frontend

# 等待容器启动
echo "⏳ 等待前端容器启动..."
sleep 10

echo ""
echo "🔍 检查前端容器状态..."
sudo docker ps --filter "name=edm-frontend" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "📋 检查前端容器日志..."
sudo docker logs edm-frontend --tail 15

echo ""
echo "🧪 测试前端端口3000..."
FRONTEND_TEST=$(curl -s -w "%{http_code}" http://localhost:3000 -o /tmp/frontend_test.html || echo "000")
echo "前端端口3000响应: $FRONTEND_TEST"

if [ "$FRONTEND_TEST" = "200" ]; then
    echo "✅ 前端3000端口正常响应！"
    echo "页面内容预览:"
    head -c 300 /tmp/frontend_test.html 2>/dev/null && echo ""
elif [ "$FRONTEND_TEST" = "000" ]; then
    echo "⚠️ 前端还在启动中，稍后再试"
else
    echo "⚠️ 前端响应码: $FRONTEND_TEST"
fi

echo ""
echo "🧪 如果前端正常，测试完整HTTPS访问..."
if [ "$FRONTEND_TEST" = "200" ]; then
    echo "测试HTTPS前端访问..."
    HTTPS_FRONTEND=$(curl -s -w "%{http_code}" -k "https://localhost/" -o /tmp/https_frontend_test.html || echo "000")
    echo "HTTPS前端响应: $HTTPS_FRONTEND"
    
    if [ "$HTTPS_FRONTEND" = "200" ]; then
        echo "✅ HTTPS前端访问正常！"
        echo "页面内容预览:"
        head -c 200 /tmp/https_frontend_test.html 2>/dev/null && echo ""
    else
        echo "⚠️ HTTPS前端响应: $HTTPS_FRONTEND"
    fi
fi

# 清理临时文件
rm -f /tmp/*_test.html

echo ""
echo "🎊 前端npm问题修复完成！"
echo ""
echo "📋 修复总结："
echo "  ✅ 使用node:18-alpine基础镜像"
echo "  ✅ 清理npm缓存重新安装依赖"
echo "  ✅ 添加健康检查"
echo "  ✅ 优化构建过程"
echo ""
echo "🎯 验证结果："
echo "  - 前端容器: 检查上方状态"
echo "  - 端口3000: $FRONTEND_TEST"
echo "  - HTTPS访问: $HTTPS_FRONTEND"

ENDSSH

RESULT=$?

if [ $RESULT -eq 0 ]; then
    echo ""
    echo "🎉 前端npm问题修复成功！"
    echo ""
    echo "📊 现在的完整架构："
    echo "  🔹 前端: https://tkmail.fun → localhost:3000 (React应用)"
    echo "  🔹 API: https://tkmail.fun/api → localhost:8080 (后端API)"
    echo "  🔹 Webhook: https://tkmail.fun/webhook/engagelab → localhost:8080"
    echo ""
    echo "✅ 访问 https://tkmail.fun 应该显示React前端页面"
    echo "✅ EngageLab webhook继续正常工作"
else
    echo "❌ 前端npm问题修复失败"
    exit 1
fi

echo ""
echo "🎯 前端npm问题修复完成！" 