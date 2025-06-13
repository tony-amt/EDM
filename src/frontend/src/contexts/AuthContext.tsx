import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { message } from 'antd';
import jwt_decode from 'jwt-decode';
import api from '../services/api';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  [key: string]: any;
}

interface LoginCredentials {
  usernameOrEmail: string;
  password: string;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  name?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  register: (userData: RegisterData) => Promise<boolean>;
  logout: () => void;
}

interface AuthProviderProps {
  children: ReactNode;
}

// 创建认证上下文
const AuthContext = createContext<AuthContextType | null>(null);

// 认证提供者组件
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // 状态管理
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState<boolean>(true);

  // 加载用户信息
  useEffect(() => {
    const loadUser = async () => {
      if (token) {
        try {
          // 设置API请求头中的token
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          // 检查token是否有效
          const decoded = (jwt_decode as any)(token) as {exp: number};
          const currentTime = Date.now() / 1000;
          
          if (decoded.exp < currentTime) {
            // Token已过期，注销用户
            logout();
            message.error('登录已过期，请重新登录');
          } else {
            // 获取用户信息
            const response = await api.get<{data: User}>('/auth/me');
            setUser(response.data.data);
          }
        } catch (error) {
          console.error('加载用户信息失败', error);
          logout();
          message.error('登录状态验证失败，请重新登录');
        }
      }
      setLoading(false);
    };
    
    loadUser();
  }, [token]);

  // 登录方法
  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    try {
      setLoading(true);
      const response = await api.post<{token: string, user: User}>('/auth/login', credentials);
      const { token: newToken, user: userData } = response.data;
      
      // 保存token到本地存储
      localStorage.setItem('token', newToken);
      
      // 更新状态
      setToken(newToken);
      setUser(userData);
      
      // 设置API请求头中的token
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
      message.success('登录成功');
      return true;
    } catch (error: any) {
      console.error('登录失败', error);
      const errorMsg = error.response?.data?.message || '登录失败，请检查账号和密码';
      message.error(errorMsg);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // 注册方法
  const register = async (userData: RegisterData): Promise<boolean> => {
    try {
      setLoading(true);
      await api.post('/auth/register', userData);
      message.success('注册成功，请登录');
      return true;
    } catch (error: any) {
      console.error('注册失败', error);
      const errorMsg = error.response?.data?.message || '注册失败，请稍后再试';
      message.error(errorMsg);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // 注销方法
  const logout = (): void => {
    // 清除本地存储中的token
    localStorage.removeItem('token');
    
    // 清除API请求头中的token
    delete api.defaults.headers.common['Authorization'];
    
    // 清除状态
    setToken(null);
    setUser(null);
  };

  // 导出的上下文值
  const value: AuthContextType = {
    user,
    token,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// 自定义Hook，用于在组件中使用认证上下文
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth必须在AuthProvider内部使用');
  }
  return context;
};

export default AuthContext; 