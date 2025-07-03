import axios, { InternalAxiosRequestConfig } from 'axios';
import { message } from 'antd';

// 创建axios实例
const instance = axios.create({
  timeout: 10000, // 请求超时10秒
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
instance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 获取token
    const token = localStorage.getItem('token');
    // 如果有token则添加到请求头
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
instance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      // 处理响应错误
      const { status } = error.response;
      
      if (status === 401) {
        // 未授权，可能是token过期
        message.error('登录已过期，请重新登录');
        localStorage.removeItem('token');
        window.location.href = '/login';
      } else if (status === 403) {
        // 禁止访问
        message.error('没有权限访问该资源');
      } else if (status === 404) {
        // 资源不存在
        message.error('请求的资源不存在');
      } else if (status === 500) {
        // 服务器错误
        message.error('服务器错误，请稍后再试');
      } else {
        // 其他错误
        message.error(error.response.data.message || '请求失败');
      }
    } else if (error.request) {
      // 请求发出后没有收到响应
      message.error('网络连接失败，请检查网络');
    } else {
      // 请求配置错误
      message.error('请求错误');
    }
    return Promise.reject(error);
  }
);

export default instance; 