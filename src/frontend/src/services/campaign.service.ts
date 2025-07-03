import api from './api';

export interface Campaign {
  id: string;
  name: string;
  description: string;
  status: string;
  target_tags: string[];
  template_id: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignsResponse {
  success?: boolean;
  items: Campaign[];
  current_page: number;
  total_items: number;
  total_pages: number;
}

export interface CampaignResponse {
  success?: boolean;
  data?: Campaign;
}

export interface QueryParams {
  page?: number;
  limit?: number;
  name?: string;
  status?: string;
}

const campaignService = {
  // 获取活动列表
  getCampaigns: async (params: QueryParams = {}) => {
    const response = await api.get<CampaignsResponse>('/campaigns', { params });
    return response.data;
  },

  // 获取单个活动详情
  getCampaign: async (id: string) => {
    const response = await api.get<CampaignResponse>(`/campaigns/${id}`);
    return response.data;
  },

  // 创建活动
  createCampaign: async (campaignData: Partial<Campaign>) => {
    const response = await api.post<CampaignResponse>('/campaigns', campaignData);
    return response.data;
  },

  // 更新活动
  updateCampaign: async (id: string, campaignData: Partial<Campaign>) => {
    const response = await api.put<CampaignResponse>(`/campaigns/${id}`, campaignData);
    return response.data;
  },

  // 删除活动
  deleteCampaign: async (id: string) => {
    const response = await api.delete(`/campaigns/${id}`);
    return response.data;
  }
};

export default campaignService; 