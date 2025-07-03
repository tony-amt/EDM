#!/bin/bash

# EDM前端开发环境快速部署脚本
# 支持热更新，无需完整构建

echo "🚀 EDM前端开发环境快速部署"
echo "==============================="

PRODUCTION_SERVER="43.135.38.15"
SERVER_USER="ubuntu"
SERVER_PASS="Tony1231!"

# 1. 同步代码到生产服务器
echo "📤 同步前端代码到生产服务器..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude 'build' \
  --exclude '.git' \
  -e "sshpass -p '$SERVER_PASS' ssh -o StrictHostKeyChecking=no" \
  ./src/frontend/ $SERVER_USER@$PRODUCTION_SERVER:/tmp/frontend-dev/

# 2. 在生产服务器部署开发环境
echo "🔧 在生产服务器部署开发环境..."
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no $SERVER_USER@$PRODUCTION_SERVER << 'EOF'

echo "🛑 停止现有前端容器（如果存在）..."
docker stop edm-frontend-dev 2>/dev/null || true
docker rm edm-frontend-dev 2>/dev/null || true

echo "🏗️ 构建开发环境镜像..."
cd /tmp/frontend-dev
docker build -f Dockerfile.dev -t edm-frontend:dev .

echo "🚀 启动开发环境容器..."
docker run -d \
  --name edm-frontend-dev \
  --network edm_edm-network \
  -p 3002:3000 \
  -v /tmp/frontend-dev/src:/app/src \
  --restart unless-stopped \
  edm-frontend:dev

echo "⏳ 等待服务启动..."
sleep 10

echo "🌐 测试服务状态..."
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3002 || echo '000')
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ 开发环境部署成功！"
    echo "🔗 访问地址: http://43.135.38.15:3002"
else
    echo "❌ 服务启动异常，检查日志："
    docker logs edm-frontend-dev --tail 20
fi

EOF

echo "✅ 部署完成！"
echo "🔗 开发环境访问地址: http://43.135.38.15:3002"
echo "💡 提示: 修改src目录下的文件会自动热更新" 