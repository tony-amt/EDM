#!/bin/bash

# 快速修复前端API配置
echo "🔧 快速修复前端API配置..."

SERVER_IP="43.135.38.15"

# 创建修复后的API配置文件
cat > /tmp/api.js << 'EOFAPI'
import axios from 'axios';

// 获取API基准URL - 修复版本
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
  
  // 本地开发环境，使用8080端口
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
    const token = localStorage.getItem('token') || localStorage.getItem('edm_token');
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
    
    if (error.response && error.response.status === 401) {
      console.warn('🔐 Token过期，清理本地存储');
      localStorage.removeItem('token');
      localStorage.removeItem('edm_token');
      localStorage.removeItem('user');
      
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// 调试信息
console.log('🔧 API配置初始化完成');
console.log('📡 API基础地址:', api.defaults.baseURL);
console.log('🌍 当前域名:', window.location.hostname);

export default api;
EOFAPI

# 上传并替换配置文件
echo "📝 上传修复的API配置..."
scp /tmp/api.js ubuntu@$SERVER_IP:/opt/edm/src/frontend/src/services/api.js

# 在服务器上重新构建和重启
ssh ubuntu@$SERVER_IP << 'ENDSSH'
cd /opt/edm

echo "🏗️ 重新构建前端镜像..."
sudo docker build --no-cache -t edm-frontend:latest -f src/frontend/Dockerfile src/frontend/

echo "🔄 重启前端容器..."
sudo docker-compose restart frontend

echo "⏳ 等待容器启动..."
sleep 10

echo "✅ 检查容器状态..."
sudo docker ps --filter "name=edm-frontend"

echo "📋 检查容器日志..."
sudo docker logs edm-frontend --tail 5
ENDSSH

# 清理临时文件
rm -f /tmp/api.js

echo "🎉 快速修复完成！"
echo "请刷新浏览器页面查看效果" 