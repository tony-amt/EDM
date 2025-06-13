import api from './api';

export interface UserInfo {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  remaining_quota: number;
  created_at: string;
  updated_at: string;
  total_campaigns?: number;
  completed_campaigns?: number;
}

export interface UpdateUserData {
  role?: 'admin' | 'user';
  email?: string;
}

export interface AllocateQuotaData {
  amount: number;
  reason?: string;
}

export interface DashboardData {
  user: UserInfo;
  stats: {
    total_campaigns: number;
    completed_campaigns: number;
    sending_campaigns: number;
    failed_campaigns: number;
  };
  recent_quota_logs: any[];
  recent_campaigns: any[];
}

export interface UserApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

class UserManagementService {
  private basePath = '/users';

  /**
   * 获取用户列表（管理员）
   */
  async getList(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<UserApiResponse<{
    users: UserInfo[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }>> {
    try {
      const response = await api.get(this.basePath, { params });
      return response.data;
    } catch (error: any) {
      console.error('获取用户列表失败:', error);
      return {
        success: false,
        message: error.response?.data?.message || '获取用户列表失败'
      };
    }
  }

  /**
   * 更新用户信息（管理员）
   */
  async update(id: string, data: UpdateUserData): Promise<UserApiResponse<UserInfo>> {
    try {
      const response = await api.put(`${this.basePath}/${id}`, data);
      return response.data;
    } catch (error: any) {
      console.error('更新用户信息失败:', error);
      return {
        success: false,
        message: error.response?.data?.message || '更新用户信息失败'
      };
    }
  }

  /**
   * 分配用户额度（管理员）
   */
  async allocateQuota(id: string, data: AllocateQuotaData): Promise<UserApiResponse> {
    try {
      const response = await api.post(`${this.basePath}/${id}/quota`, data);
      return response.data;
    } catch (error: any) {
      console.error('分配用户额度失败:', error);
      return {
        success: false,
        message: error.response?.data?.message || '分配用户额度失败'
      };
    }
  }

  /**
   * 获取用户Dashboard
   */
  async getDashboard(): Promise<UserApiResponse<DashboardData>> {
    try {
      const response = await api.get(`${this.basePath}/dashboard`);
      return response.data;
    } catch (error: any) {
      console.error('获取用户Dashboard失败:', error);
      return {
        success: false,
        message: error.response?.data?.message || '获取用户Dashboard失败'
      };
    }
  }
}

export default new UserManagementService(); 