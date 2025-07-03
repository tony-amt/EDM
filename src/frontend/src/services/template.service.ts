import api from './api';
import { Tag } from './contact.service';

export interface Template {
  _id: string;
  name: string;
  subject: string;
  content: string;
  html: string;
  tags: Tag[];
  category: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateStats {
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
}

export interface TemplateResponse {
  success: boolean;
  data: Template;
}

export interface TemplatesResponse {
  success: boolean;
  data: Template[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface TemplatePreviewData {
  subject: string;
  html: string;
}

export interface QueryParams {
  page?: number;
  limit?: number;
  search?: string;
  tags?: string;
  category?: string;
  isActive?: boolean;
}

const templateService = {
  // 获取模板列表
  getTemplates: async (params: QueryParams = {}) => {
    const response = await api.get<TemplatesResponse>('/templates', { params });
    return response.data;
  },

  // 获取单个模板
  getTemplate: async (id: string) => {
    const response = await api.get<TemplateResponse>(`/templates/${id}`);
    return response.data;
  },

  // 创建模板
  createTemplate: async (templateData: Partial<Template>) => {
    const response = await api.post<TemplateResponse>('/templates', templateData);
    return response.data;
  },

  // 更新模板
  updateTemplate: async (id: string, templateData: Partial<Template>) => {
    const response = await api.put<TemplateResponse>(`/templates/${id}`, templateData);
    return response.data;
  },

  // 删除模板
  deleteTemplate: async (id: string) => {
    const response = await api.delete(`/templates/${id}`);
    return response.data;
  },

  // 复制模板
  duplicateTemplate: async (id: string, newName: string) => {
    const response = await api.post<TemplateResponse>(`/templates/${id}/duplicate`, { name: newName });
    return response.data;
  },

  // 预览模板
  previewTemplate: async (id: string, contactId?: string) => {
    const params = contactId ? { contactId } : {};
    const response = await api.get<TemplatePreviewData>(`/templates/${id}/preview`, { params });
    return response.data;
  },

  // 获取模板类别列表
  getCategories: async () => {
    const response = await api.get<{ data: string[] }>('/templates/categories');
    return response.data;
  },

  // 获取模板统计信息
  getTemplateStats: async (id: string) => {
    const response = await api.get<{ data: TemplateStats }>(`/templates/${id}/stats`);
    return response.data;
  }
};

export default templateService; 