import axios from 'axios';

// 获取API基准URL - 支持Docker和本地开发环境
const getApiBaseURL = () => {
  // 从环境变量获取，如果没有则使用默认值
  const envBaseURL = process.env.REACT_APP_API_BASE_URL;
  
  if (envBaseURL) {
    return envBaseURL;
  }
  
  // 默认情况下，根据当前协议和主机构建API URL
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  
  // 在Docker环境中，前端和后端在不同端口
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:3000/api`;
  }
  
  // 生产环境使用相对路径
  return '/api';
};

// 创建axios实例
const api = axios.create({
  baseURL: getApiBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 从本地存储获取token
    const token = localStorage.getItem('token');
    
    // 如果token存在，添加到请求头
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('❌ API错误:', error.message, error.config?.url);
    
    // 如果返回401错误，表示token过期或无效
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
        window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

export default api; 