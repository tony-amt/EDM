#!/bin/bash

# 彻底重建前端 - 清理所有缓存
echo "🔧 彻底重建前端，清理所有缓存..."

SERVER_IP="43.135.38.15"

ssh ubuntu@$SERVER_IP << 'ENDSSH'
set -e

cd /opt/edm

echo "🧹 清理前端构建缓存..."
rm -rf src/frontend/node_modules/.cache 2>/dev/null || true
rm -rf src/frontend/build 2>/dev/null || true

echo "📝 确保API配置正确..."
cat > src/frontend/src/services/api.js << 'EOFAPI'
import axios from 'axios';

// 获取API基准URL - 彻底修复版本
const getApiBaseURL = () => {
  // 优先从环境变量获取
  const envBaseURL = process.env.REACT_APP_API_BASE_URL;
  
  if (envBaseURL) {
    console.log('🌍 [API配置] 使用环境变量:', envBaseURL);
    return envBaseURL;
  }
  
  // 检查当前访问的域名
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  console.log('🔍 [API配置] 当前域名:', hostname);
  console.log('🔍 [API配置] 完整地址:', window.location.href);
  
  // 生产环境：域名访问时使用相对路径
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    console.log('🌐 [API配置] 生产环境，使用相对路径: /api');
    return '/api';
  }
  
  // 开发环境：localhost访问时使用8080端口
  const apiUrl = `${protocol}//${hostname}:8080/api`;
  console.log('🔧 [API配置] 开发环境，使用API地址:', apiUrl);
  return apiUrl;
};

// 立即执行并显示配置
const finalApiBaseURL = getApiBaseURL();
console.log('📡 [API配置] 最终API地址:', finalApiBaseURL);

// 创建axios实例
const api = axios.create({
  baseURL: finalApiBaseURL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token') || localStorage.getItem('edm_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    console.log('🚀 [API请求]', config.method?.toUpperCase(), config.url);
    console.log('📍 [API请求] 完整地址:', config.baseURL + config.url);
    
    return config;
  },
  (error) => {
    console.error('❌ [API请求] 拦截器错误:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    console.log('✅ [API响应]', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('❌ [API错误]', error.message);
    console.error('❌ [API错误] 请求地址:', error.config?.url);
    console.error('❌ [API错误] 完整地址:', error.config?.baseURL + error.config?.url);
    
    if (error.response && error.response.status === 401) {
      console.warn('🔐 [AUTH] Token过期，清理本地存储');
      localStorage.removeItem('token');
      localStorage.removeItem('edm_token');
      localStorage.removeItem('user');
      
      if (window.location.pathname !== '/login') {
        console.log('🔄 [AUTH] 重定向到登录页面');
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// 启动时显示配置信息
console.log('🎯 [API配置] 初始化完成');
console.log('📍 [API配置] 基础地址:', api.defaults.baseURL);
console.log('🌍 [环境信息] 域名:', window.location.hostname);
console.log('🔗 [环境信息] 完整URL:', window.location.href);

export default api;
EOFAPI

echo "🏗️ 创建优化的Dockerfile..."
cat > src/frontend/Dockerfile << 'EOFDOCKER'
# 使用Node.js 18 Alpine镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apk add --no-cache bash curl

# 复制package文件
COPY package*.json ./

# 清理npm缓存并安装依赖
RUN npm cache clean --force && \
    rm -rf node_modules && \
    npm install --no-package-lock --legacy-peer-deps

# 设置环境变量
ENV REACT_APP_API_BASE_URL=/api
ENV PORT=3001
ENV NODE_ENV=development
ENV GENERATE_SOURCEMAP=false
ENV FAST_REFRESH=false

# 复制源代码
COPY . .

# 暴露端口
EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001 || exit 1

# 启动命令 - 清理缓存后启动
CMD ["sh", "-c", "rm -rf node_modules/.cache && npm start"]
EOFDOCKER

echo "🚀 完全重新构建前端镜像..."
sudo docker build --no-cache --pull -t edm-frontend:latest -f src/frontend/Dockerfile src/frontend/

echo "🏃 启动新的前端容器..."
sudo docker-compose up -d frontend

echo "⏳ 等待前端容器完全启动..."
sleep 20

echo "🔍 检查前端容器状态..."
sudo docker ps --filter "name=edm-frontend" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo "📋 检查前端容器日志..."
sudo docker logs edm-frontend --tail 15

echo "🧪 测试前端响应..."
sleep 5
FRONTEND_TEST=$(curl -s -w "%{http_code}" http://localhost:3000 || echo "000")
echo "前端端口3000响应: $FRONTEND_TEST"

if [ "$FRONTEND_TEST" = "200" ]; then
    echo "✅ 前端容器启动成功！"
    echo ""
    echo "🎯 重要提醒："
    echo "  1. 请使用 Cmd+Shift+R 强制刷新浏览器"
    echo "  2. 清空浏览器缓存和数据"
    echo "  3. 关闭浏览器重新打开"
    echo "  4. 查看浏览器控制台的API配置日志"
    echo ""
    echo "📊 现在的API配置："
    echo "  域名 tkmail.fun → 使用 /api"
    echo "  localhost → 使用 localhost:8080/api"
else
    echo "⚠️ 前端还在启动中，请稍等..."
fi

echo ""
echo "🎉 前端彻底重建完成！"

ENDSSH

echo "🎯 彻底重建完成！请强制刷新浏览器并清空缓存！"