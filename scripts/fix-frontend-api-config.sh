#!/bin/bash

# 🔧 修复前端API端口配置脚本
# 解决前端请求localhost:3000而不是正确API地址的问题

set -e

echo "🔧 修复前端API端口配置..."
echo "📅 时间: $(date)"
echo "🎯 目标: 修复API请求端口配置，确保正确访问后端"

SERVER_IP="43.135.38.15"

# 服务器端操作
ssh ubuntu@$SERVER_IP << 'ENDSSH'
set -e

cd /opt/edm

echo "🔍 当前问题分析："
echo "  ❌ 前端请求: localhost:3000/api (错误)"
echo "  ✅ 应该请求: /api (相对路径，通过nginx代理到后端)"

echo ""
echo "📝 备份并修复API配置文件..."

# 备份原文件
cp src/frontend/src/services/api.js src/frontend/src/services/api.js.backup.$(date +%Y%m%d_%H%M%S)

# 创建修复后的API配置
cat > src/frontend/src/services/api.js << 'EOFAPI'
import axios from 'axios';

// 获取API基准URL - 优先使用环境变量，生产环境使用相对路径
const getApiBaseURL = () => {
  // 从环境变量获取
  const envBaseURL = process.env.REACT_APP_API_BASE_URL;
  
  if (envBaseURL) {
    console.log('🌍 使用环境变量API地址:', envBaseURL);
    return envBaseURL;
  }
  
  // 检查当前域名
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  // 生产环境或域名访问，使用相对路径通过nginx代理
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    console.log('🌐 生产环境，使用相对路径:', '/api');
    return '/api';
  }
  
  // 本地开发环境，根据实际后端端口配置
  // 注意：这里改为8080，与生产规范一致
  const apiUrl = `${protocol}//${hostname}:8080/api`;
  console.log('🔧 开发环境，使用本地API:', apiUrl);
  return apiUrl;
};

// 创建axios实例
const api = axios.create({
  baseURL: getApiBaseURL(),
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 从本地存储获取token
    const token = localStorage.getItem('token') || localStorage.getItem('edm_token');
    
    // 如果token存在，添加到请求头
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    console.log('🔍 API请求:', config.method?.toUpperCase(), config.baseURL + config.url);
    
    return config;
  },
  (error) => {
    console.error('❌ 请求拦截器错误:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    console.log('✅ API响应:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('❌ API错误:', error.message, error.config?.url);
    
    // 如果返回401错误，表示token过期或无效
    if (error.response && error.response.status === 401) {
      console.warn('🔐 Token过期，清理本地存储');
      localStorage.removeItem('token');
      localStorage.removeItem('edm_token');
      localStorage.removeItem('user');
      
      // 如果不在登录页面，跳转到登录页面
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// 添加调试信息
console.log('🔧 API配置初始化完成');
console.log('📡 API基础地址:', api.defaults.baseURL);
console.log('🌍 当前域名:', window.location.hostname);
console.log('🔗 当前完整地址:', window.location.href);

export default api;
EOFAPI

echo "✅ API配置文件已修复"

echo ""
echo "📝 更新环境变量配置..."

# 检查并更新Dockerfile中的环境变量
if grep -q "ENV REACT_APP_API_BASE_URL=/api" src/frontend/Dockerfile; then
    echo "✅ Dockerfile环境变量已正确配置"
else
    echo "🔧 更新Dockerfile环境变量..."
    sed -i 's/ENV REACT_APP_API_BASE_URL=.*$/ENV REACT_APP_API_BASE_URL=\/api/' src/frontend/Dockerfile
fi

echo ""
echo "🏗️ 重新构建前端镜像..."
sudo docker build --no-cache -t edm-frontend:latest -f src/frontend/Dockerfile src/frontend/

echo ""
echo "🔄 重启前端容器..."
sudo docker-compose restart frontend

# 等待容器启动
echo "⏳ 等待前端容器重启..."
sleep 15

echo ""
echo "🔍 检查前端容器状态..."
sudo docker ps --filter "name=edm-frontend" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "📋 检查前端容器日志..."
sudo docker logs edm-frontend --tail 10

echo ""
echo "🧪 测试API配置修复..."
echo "测试前端页面响应..."
FRONTEND_TEST=$(curl -s -w "%{http_code}" http://localhost:3000 -o /tmp/frontend_test.html || echo "000")
echo "前端端口3000响应: $FRONTEND_TEST"

echo ""
echo "🎉 API配置修复完成！"
echo ""
echo "📋 修复总结："
echo "  ✅ 修正API地址逻辑，生产环境使用相对路径 /api"
echo "  ✅ 本地开发环境使用正确的8080端口"
echo "  ✅ 添加详细的调试日志"
echo "  ✅ 优化token处理逻辑"
echo ""
echo "🎯 现在前端应该正确请求:"
echo "  🌐 生产环境 (tkmail.fun): /api → nginx代理到后端8080"
echo "  🔧 开发环境 (localhost): localhost:8080/api → 直接访问后端"

ENDSSH

RESULT=$?

if [ $RESULT -eq 0 ]; then
    echo ""
    echo "🎉 前端API配置修复成功！"
    echo ""
    echo "📊 请现在刷新浏览器页面："
    echo "  1. 访问 https://tkmail.fun/contacts"
    echo "  2. 打开开发者工具Network面板"
    echo "  3. 查看API请求是否变成 /api/tags 而不是 localhost:3000"
    echo ""
    echo "🔍 如果还有问题，请检查浏览器控制台日志"
else
    echo "❌ 前端API配置修复失败"
    exit 1
fi

echo ""
echo "🎯 前端API配置修复完成！" 