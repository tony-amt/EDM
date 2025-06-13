import api from './api';
import { Tag } from './contact.service';

// 重新导出Tag类型，便于其他文件直接从tag.service导入
export type { Tag };
// 提供TagType作为Tag的类型别名，与组件中的使用一致
export type TagType = Tag;

export interface TagResponse {
  success: boolean;
  data: Tag;
}

export interface TagsResponse {
  success: boolean;
  data: Tag[];
}

export interface TagTreeResponse {
  success: boolean;
  data: TagTreeNode[];
}

export interface TagTreeNode extends Tag {
  children?: TagTreeNode[];
  contact_count?: number;
  total_contact_count?: number;
}

export interface TagRule {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'not' | 'gt' | 'lt';
  value: any;
}

export interface AutoTagData {
  name: string;
  color?: string;
  rules: TagRule[];
  ruleLogic: 'and' | 'or';
}

export interface SplitTestData {
  testName: string;
  groupCount: number;
  splitRatio: number[];
  groupNames: string[];
}

export interface SplitTestResponse {
  success: boolean;
  data: {
    testName: string;
    parentTag: {
      id: string;
      name: string;
    };
    totalContacts: number;
    groups: Array<{
      id: string;
      name: string;
      groupName: string;
      contactCount: number;
      ratio: number;
      contacts: any[];
    }>;
    summary: {
      groupCount: number;
      totalContacts: number;
      averageGroupSize: number;
    };
  };
}

export interface ContactTagsResponse {
  success: boolean;
  data: {
    contactId: string;
    email: string;
    directTags: Array<{
      id: string;
      name: string;
      parent_id?: string;
      parent?: {
        id: string;
        name: string;
      };
    }>;
    inheritedTags: Array<{
      id: string;
      name: string;
      reason: string;
    }>;
    allTags: Array<{
      id: string;
      name: string;
      parent_id?: string;
      isDirect: boolean;
    }>;
  };
}

const tagService = {
  // 获取所有标签
  getTags: async (params: { parentId?: string; search?: string } = {}) => {
    const response = await api.get<TagsResponse>('/tags', { params });
    return response.data;
  },

  // 获取标签树结构
  getTagTree: async () => {
    const response = await api.get<TagTreeResponse>('/tags/tree');
    return response.data;
  },

  // 获取单个标签
  getTag: async (id: string) => {
    const response = await api.get<TagResponse>(`/tags/${id}`);
    return response.data;
  },

  // 创建标签
  createTag: async (tagData: Partial<Tag> & { parentId?: string }) => {
    const response = await api.post<TagResponse>('/tags', tagData);
    return response.data;
  },

  // 更新标签
  updateTag: async (id: string, tagData: Partial<Tag> & { parentId?: string }) => {
    const response = await api.put<TagResponse>(`/tags/${id}`, tagData);
    return response.data;
  },

  // 删除标签
  deleteTag: async (id: string) => {
    const response = await api.delete(`/tags/${id}`);
    return response.data;
  },

  // 获取标签关联的联系人
  getTagContacts: async (id: string) => {
    const response = await api.get(`/tags/${id}/contacts`);
    return response.data;
  },

  // 为联系人添加标签（支持自动继承）
  addTagToContact: async (tagId: string, contactId: string, autoInherit: boolean = true) => {
    const response = await api.post(`/tags/${tagId}/contacts/${contactId}`, { autoInherit });
    return response.data;
  },

  // 从联系人移除标签（智能删除）
  removeTagFromContact: async (tagId: string, contactId: string, removeParent: boolean = false) => {
    const response = await api.delete(`/tags/${tagId}/contacts/${contactId}`, { 
      data: { removeParent } 
    });
    return response.data;
  },

  // 批量为联系人添加标签
  bulkAddTags: async (contactIds: string[], tagIds: string[]) => {
    const response = await api.post('/tags/bulk-add', { contactIds, tagIds });
    return response.data;
  },

  // 批量从联系人移除标签
  bulkRemoveTags: async (contactIds: string[], tagIds: string[]) => {
    const response = await api.post('/tags/bulk-remove', { contactIds, tagIds });
    return response.data;
  },

  // 移动标签到新的父级
  moveTag: async (id: string, parentId?: string) => {
    const response = await api.put(`/tags/${id}/move`, { parentId });
    return response.data;
  },

  // 创建A/B测试分组
  createSplitTest: async (tagId: string, splitData: SplitTestData) => {
    const response = await api.post<SplitTestResponse>(`/tags/${tagId}/split-test`, splitData);
    return response.data;
  },

  // 获取联系人的标签详情（区分直接标签和继承标签）
  getContactTags: async (contactId: string) => {
    const response = await api.get<ContactTagsResponse>(`/contacts/${contactId}/tags`);
    return response.data;
  },

  // 创建自动标签规则
  createAutoTagRule: async (tagData: AutoTagData) => {
    const response = await api.post<TagResponse>('/tags/auto-rule', tagData);
    return response.data;
  },

  // 应用所有自动标签规则
  applyAutoTagRules: async () => {
    const response = await api.post('/tags/apply-rules');
    return response.data;
  }
};

export default tagService; 