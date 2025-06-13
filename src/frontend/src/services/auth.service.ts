import api from './api';

export interface LoginCredentials {
  usernameOrEmail: string;
  password: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  data?: User;
  token: string;
}

const authService = {
  // 用户登录
  login: async (credentials: LoginCredentials) => {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.data || response.data.user));
    }
    return response.data;
  },

  // 用户登出
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  // 获取当前用户信息
  getCurrentUser: async () => {
    const response = await api.get<{ success: boolean; user: User }>('/auth/me');
    return response.data;
  },

  // 修改密码
  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    const response = await api.put<{ success: boolean; message: string }>('/auth/password', data);
    return response.data;
  },

  // 获取当前用户
  getStoredUser: (): User | null => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      return JSON.parse(userStr);
    }
    return null;
  },

  // 检查是否已登录
  isLoggedIn: (): boolean => {
    return !!localStorage.getItem('token');
  }
};

export default authService; 