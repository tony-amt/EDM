import api from './api';

export interface EmailService {
  id: string;
  name: string;
  provider: string;
  domain: string;
  api_key: string;
  api_secret?: string;
  daily_quota: number;
  used_quota: number;
  sending_rate: number;
  quota_reset_time: string;
  is_enabled: boolean;
  is_frozen: boolean;
  frozen_until?: string;
  consecutive_failures: number;
  last_reset_at?: string;
  last_sent_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateEmailServiceData {
  name: string;
  provider: string;
  domain: string;
  api_key: string;
  api_secret: string;
  daily_quota: number;
  sending_rate: number;
  quota_reset_time?: string;
}

export interface UpdateEmailServiceData {
  name?: string;
  provider?: string;
  domain?: string;
  api_key?: string;
  api_secret?: string;
  daily_quota?: number;
  sending_rate?: number;
  quota_reset_time?: string;
}

export interface EmailServiceApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

class EmailServiceService {
  private basePath = '/email-services';

  /**
   * 获取发信服务列表
   */
  async getList(): Promise<EmailServiceApiResponse<EmailService[]>> {
    try {
      const response = await api.get(this.basePath);
      return response.data;
    } catch (error: any) {
      console.error('获取发信服务列表失败:', error);
      return {
        success: false,
        message: error.response?.data?.message || '获取发信服务列表失败'
      };
    }
  }

  /**
   * 创建发信服务
   */
  async create(data: CreateEmailServiceData): Promise<EmailServiceApiResponse<EmailService>> {
    try {
      const response = await api.post(this.basePath, data);
      return response.data;
    } catch (error: any) {
      console.error('创建发信服务失败:', error);
      return {
        success: false,
        message: error.response?.data?.message || '创建发信服务失败'
      };
    }
  }

  /**
   * 更新发信服务
   */
  async update(id: string, data: UpdateEmailServiceData): Promise<EmailServiceApiResponse<EmailService>> {
    try {
      const response = await api.put(`${this.basePath}/${id}`, data);
      return response.data;
    } catch (error: any) {
      console.error('更新发信服务失败:', error);
      return {
        success: false,
        message: error.response?.data?.message || '更新发信服务失败'
      };
    }
  }

  /**
   * 启用/禁用服务
   */
  async toggleStatus(id: string): Promise<EmailServiceApiResponse> {
    try {
      const response = await api.post(`${this.basePath}/${id}/toggle`);
      return response.data;
    } catch (error: any) {
      console.error('切换服务状态失败:', error);
      return {
        success: false,
        message: error.response?.data?.message || '切换服务状态失败'
      };
    }
  }

  /**
   * 手动解冻服务
   */
  async unfreeze(id: string): Promise<EmailServiceApiResponse> {
    try {
      const response = await api.post(`${this.basePath}/${id}/unfreeze`);
      return response.data;
    } catch (error: any) {
      console.error('解冻服务失败:', error);
      return {
        success: false,
        message: error.response?.data?.message || '解冻服务失败'
      };
    }
  }
}

export default new EmailServiceService(); 