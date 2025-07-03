import api from './api';
import { User } from './auth.service';

export interface UserResponse {
  success: boolean;
  data: User;
}

export interface UsersResponse {
  success: boolean;
  data: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'user' | 'readonly';
}

export interface UpdateUserData {
  email?: string;
  name?: string;
  role?: 'admin' | 'user' | 'readonly';
  isActive?: boolean;
}

const userService = {
  // 获取用户列表
  getUsers: async (params: { page?: number; limit?: number; search?: string; role?: string; isActive?: boolean } = {}) => {
    const response = await api.get<UsersResponse>('/users', { params });
    return response.data;
  },

  // 获取单个用户
  getUser: async (id: string) => {
    const response = await api.get<UserResponse>(`/users/${id}`);
    return response.data;
  },

  // 创建用户
  createUser: async (userData: CreateUserData) => {
    const response = await api.post<UserResponse>('/users', userData);
    return response.data;
  },

  // 更新用户
  updateUser: async (id: string, userData: UpdateUserData) => {
    const response = await api.put<UserResponse>(`/users/${id}`, userData);
    return response.data;
  },

  // 重置用户密码
  resetPassword: async (id: string, newPassword: string) => {
    const response = await api.put<{ success: boolean; message: string }>(`/users/${id}/reset-password`, { newPassword });
    return response.data;
  },

  // 删除用户
  deleteUser: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/users/${id}`);
    return response.data;
  }
};

export default userService; 