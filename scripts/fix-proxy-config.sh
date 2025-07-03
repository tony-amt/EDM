#!/bin/bash

# 修复前端代理配置
echo "🔧 修复前端代理配置..."

SERVER_IP="43.135.38.15"

ssh ubuntu@$SERVER_IP << 'ENDSSH'
set -e

cd /opt/edm

echo "🔍 当前问题分析："
echo "  ❌ 错误代理: backend:3000 (容器名不存在)"
echo "  ✅ 正确代理: edm-backend:3000 (实际容器名)"

echo ""
echo "📝 修复setupProxy.js..."

# 备份原文件
cp src/frontend/src/setupProxy.js src/frontend/src/setupProxy.js.backup.$(date +%Y%m%d_%H%M%S)

# 创建正确的代理配置
cat > src/frontend/src/setupProxy.js << 'EOFPROXY'
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  console.log('🔧 [代理配置] 启动开发代理...');
  
  // 代理API请求到后端容器
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://edm-backend:3000',
      changeOrigin: true,
      logLevel: 'debug',
      onProxyReq: (proxyReq, req, res) => {
        console.log('🚀 [代理请求]', req.method, req.url, '→', 'http://edm-backend:3000' + req.url);
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log('✅ [代理响应]', proxyRes.statusCode, req.url);
      },
      onError: (err, req, res) => {
        console.error('❌ [代理错误]', req.url, err.message);
      }
    })
  );
  
  console.log('📡 [代理配置] API代理已配置: /api → http://edm-backend:3000');
};
EOFPROXY

echo "✅ setupProxy.js已修复"

echo ""
echo "🧹 清理可能的配置冲突..."

# 检查是否有其他配置文件
echo "检查其他可能的配置文件..."
find src/frontend -name "*.env*" -type f | head -5

echo ""
echo "🔄 重新构建前端镜像..."
sudo docker build --no-cache -t edm-frontend:latest -f src/frontend/Dockerfile src/frontend/

echo ""
echo "🔄 重启前端容器..."
sudo docker-compose restart frontend

echo "⏳ 等待前端容器启动..."
sleep 15

echo ""
echo "🔍 检查容器状态..."
sudo docker ps --filter "name=edm-frontend" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "📋 检查前端日志..."
sudo docker logs edm-frontend --tail 10

echo ""
echo "🧪 测试前端和后端连接..."
echo "测试前端响应..."
FRONTEND_TEST=$(curl -s -w "%{http_code}" http://localhost:3000 || echo "000")
echo "前端端口3000响应: $FRONTEND_TEST"

echo "测试后端响应..."
BACKEND_TEST=$(curl -s -w "%{http_code}" http://localhost:8080/health || echo "000")
echo "后端端口8080响应: $BACKEND_TEST"

echo ""
echo "🎉 代理配置修复完成！"
echo ""
echo "📋 修复总结："
echo "  ✅ 修正setupProxy.js中的容器名称"
echo "  ✅ 添加代理调试日志"
echo "  ✅ 容器重新构建和启动"
echo ""
echo "🎯 现在应该："
echo "  - 前端请求 /api → 代理到 edm-backend:3000"
echo "  - 不再出现 localhost:3000 请求"

ENDSSH

echo ""
echo "🎯 代理配置修复完成！"
echo "请刷新浏览器页面并查看Network面板" 