import api from './api';

export interface Sender {
  id: string;
  name: string;
  display_name?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSenderData {
  name: string;
  display_name?: string;
}

export interface SenderApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

class SenderService {
  private basePath = '/senders';

  /**
   * 获取发信人列表
   */
  async getList(): Promise<SenderApiResponse<Sender[]>> {
    try {
      const response = await api.get(this.basePath);
      return response.data;
    } catch (error: any) {
      console.error('获取发信人列表失败:', error);
      return {
        success: false,
        message: error.response?.data?.message || '获取发信人列表失败'
      };
    }
  }

  /**
   * 创建发信人
   */
  async create(data: CreateSenderData): Promise<SenderApiResponse<Sender>> {
    try {
      const response = await api.post(this.basePath, data);
      return response.data;
    } catch (error: any) {
      console.error('创建发信人失败:', error);
      return {
        success: false,
        message: error.response?.data?.message || '创建发信人失败'
      };
    }
  }

  /**
   * 删除发信人
   */
  async delete(id: string): Promise<SenderApiResponse> {
    try {
      const response = await api.delete(`${this.basePath}/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('删除发信人失败:', error);
      return {
        success: false,
        message: error.response?.data?.message || '删除发信人失败'
      };
    }
  }
}

export default new SenderService(); 