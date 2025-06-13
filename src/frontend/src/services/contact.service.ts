import api from './api';

export interface Contact {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  company?: string;
  position?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  tikTokId?: string;
  insId?: string;
  youtubeId?: string;
  customField1?: string;
  customField2?: string;
  customField3?: string;
  customField4?: string;
  customField5?: string;
  tags: Tag[];
  source?: 'manual' | 'import' | 'api';
  status: 'active' | 'inactive' | 'bounced' | 'unsubscribed' | 'complained' | 'pending';
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  lastContacted?: string | null;
  lastOpened?: string | null;
  lastClicked?: string | null;
  lastReplied?: string | null;
  statistics?: {
    sent: number;
    opened: number;
    clicked: number;
    replied: number;
    bounced: number;
  };
  socialStats?: {
    followers: number;
    posts: number;
    likes: number;
    lastUpdated: string | null;
  };
  notes?: string;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
  description?: string;
  parentId?: string;
  count?: number;
  createdById?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContactsResponse {
  success?: boolean;
  data: Contact[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ContactResponse {
  success?: boolean;
  data?: Contact;
  id?: string;
  email?: string;
  name?: string;
  phone?: string;
  company?: string;
  position?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  tikTokId?: string;
  insId?: string;
  youtubeId?: string;
  status?: string;
  source?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  customField1?: string;
  customField2?: string;
  customField3?: string;
  customField4?: string;
  customField5?: string;
  tags?: Tag[];
}

export interface QueryParams {
  page?: number;
  limit?: number;
  search?: string;
  tags?: string;
  status?: string;
}

const contactService = {
  // 获取联系人列表
  getContacts: async (params: QueryParams = {}) => {
    const response = await api.get<ContactsResponse>('/contacts', { params });
    return response.data;
  },

  // 获取单个联系人
  getContact: async (id: string) => {
    const response = await api.get<ContactResponse>(`/contacts/${id}`);
    return response.data;
  },

  // 创建联系人
  createContact: async (contactData: Partial<Contact>) => {
    const response = await api.post<ContactResponse>('/contacts', contactData);
    return response.data;
  },

  // 更新联系人
  updateContact: async (id: string, contactData: Partial<Contact>) => {
    const response = await api.put<ContactResponse>(`/contacts/${id}`, contactData);
    return response.data;
  },

  // 删除联系人
  deleteContact: async (id: string) => {
    const response = await api.delete(`/contacts/${id}`);
    return response.data;
  },

  // 批量删除联系人
  batchDeleteContacts: async (ids: string[]) => {
    const response = await api.post('/contacts/bulk-delete', { ids });
    return response.data;
  },

  // 批量应用标签
  batchApplyTags: async (data: { contactIds: string[]; tagIds: string[]; action: 'add' | 'remove' }) => {
    const endpoint = data.action === 'add' ? '/contacts/bulk-add-tags' : '/contacts/bulk-remove-tags';
    const response = await api.post(endpoint, {
      contactIds: data.contactIds,
      tagIds: data.tagIds
    });
    return response.data;
  },

  // 导出联系人
  exportContacts: async (params: QueryParams = {}) => {
    window.open(`/api/contacts/export?${new URLSearchParams(params as Record<string, string>).toString()}`, '_blank');
  },

  // 导入联系人
  importContacts: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/contacts/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  }
};

export default contactService; 