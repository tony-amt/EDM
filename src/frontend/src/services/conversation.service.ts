import apiService from './api';
import {
  Conversation,
  ConversationMessage,
  ConversationListParams,
  ConversationListResponse,
  ConversationDetailResponse,
  ConversationStatsResponse,
  CreateConversationParams,
  SendReplyParams,
  SendReplyResponse,
  BaseApiResponse
} from '../types/api';

// 向后兼容的类型导出
export type { 
  ConversationMessage as EmailMessage,
  Conversation as EmailConversation,
  Conversation,
  ConversationMessage
};

class ConversationService {
  private baseUrl = '/api/conversations';

  /**
   * 获取会话列表
   * 对应API: GET /api/conversations
   */
  async getConversations(params?: ConversationListParams): Promise<ConversationListResponse> {
    const response = await apiService.get(this.baseUrl, { params });
    return response.data;
  }

  /**
   * 获取会话详情
   * 对应API: GET /api/conversations/:id
   */
  async getConversationDetail(id: string): Promise<ConversationDetailResponse> {
    const response = await apiService.get(`${this.baseUrl}/${id}`);
    return response.data;
  }

  /**
   * 获取会话详情 (向后兼容方法)
   * 别名: getConversationDetail
   */
  async getConversationById(id: string): Promise<ConversationDetailResponse> {
    return this.getConversationDetail(id);
  }

  /**
   * 创建新会话
   * 对应API: POST /api/conversations
   */
  async createConversation(conversationData: CreateConversationParams): Promise<BaseApiResponse<Conversation>> {
    const response = await apiService.post(this.baseUrl, conversationData);
    return response.data;
  }

  /**
   * 发送回复
   * 对应API: POST /api/conversations/:id/reply
   */
  async sendReply(conversationId: string, replyData: SendReplyParams): Promise<SendReplyResponse> {
    const response = await apiService.post(`${this.baseUrl}/${conversationId}/reply`, replyData);
    return response.data;
  }

  /**
   * 发送消息 (向后兼容方法)
   * 别名: sendReply
   */
  async sendMessage(conversationId: string, messageData: SendReplyParams): Promise<SendReplyResponse> {
    return this.sendReply(conversationId, messageData);
  }

  /**
   * 标记会话为已读
   * 对应API: POST /api/conversations/:id/mark-read
   */
  async markAsRead(conversationId: string): Promise<BaseApiResponse<{ success: boolean }>> {
    const response = await apiService.post(`${this.baseUrl}/${conversationId}/mark-read`);
    return response.data;
  }

  /**
   * 标记会话为已读 (向后兼容方法)
   * 别名: markAsRead
   */
  async markConversationAsRead(conversationId: string): Promise<BaseApiResponse<{ success: boolean }>> {
    return this.markAsRead(conversationId);
  }

  /**
   * 更新会话状态
   * 对应API: PATCH /api/conversations/:id/status
   */
  async updateStatus(conversationId: string, status: 'active' | 'archived' | 'closed'): Promise<BaseApiResponse<{ success: boolean }>> {
    const response = await apiService.put(`${this.baseUrl}/${conversationId}/status`, { status });
    return response.data;
        }

  /**
   * 删除会话
   * 对应API: DELETE /api/conversations/:id
   */
  async deleteConversation(conversationId: string): Promise<BaseApiResponse<{ success: boolean }>> {
    const response = await apiService.delete(`${this.baseUrl}/${conversationId}`);
    return response.data;
  }

  /**
   * 获取会话统计信息
   * 对应API: GET /api/conversations/stats
   */
  async getStats(): Promise<ConversationStatsResponse> {
    const response = await apiService.get(`${this.baseUrl}/stats`);
    return response.data;
  }

  /**
   * 搜索会话
   * 对应API: GET /api/conversations (带搜索参数)
   */
  async searchConversations(query: string, options?: {
    limit?: number;
    status?: string;
  }): Promise<ConversationListResponse> {
    const params = {
      search: query,
      ...options
    };

    const response = await apiService.get(this.baseUrl, { params });
    return response.data;
  }

  /**
   * 高级搜索会话和消息
   * 对应API: GET /api/conversations/search-advanced
   */
  async searchConversationsAndMessages(
    searchQuery: string,
    searchFilters?: {
      status?: string;
      date_from?: string;
      date_to?: string;
      sender_email?: string;
      recipient_email?: string;
    }
  ): Promise<{
    conversations: Conversation[];
    messages: ConversationMessage[];
    total_conversations: number;
    total_messages: number;
  }> {
    const params = {
      q: searchQuery,
      ...searchFilters
    };

    const response = await apiService.get(`${this.baseUrl}/search-advanced`, { params });
    return response.data;
  }

  /**
   * 获取会话消息列表 (向后兼容方法)
   * 实际通过getConversationDetail获取，消息包含在会话详情中
   */
  async getMessages(params: {
    conversation_id: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: ConversationMessage[] }> {
    const conversationDetail = await this.getConversationDetail(params.conversation_id);
    return {
      data: conversationDetail.data.messages || []
    };
  }

  /**
   * 批量操作会话
   * 对应API: POST /api/conversations/batch
   */
  async batchOperation(conversationIds: string[], operation: 'read' | 'archive' | 'delete'): Promise<BaseApiResponse<{
    success: boolean;
    affected: number;
  }>> {
    const response = await apiService.post(`${this.baseUrl}/batch`, {
      conversation_ids: conversationIds,
      operation
    });
    return response.data;
  }

  /**
   * 获取消息详情
   * 对应API: GET /api/messages/:id
   */
  async getMessageDetail(messageId: string): Promise<BaseApiResponse<ConversationMessage>> {
    const response = await apiService.get(`/api/messages/${messageId}`);
    return response.data;
  }

  /**
   * 重发消息
   * 对应API: POST /api/messages/:id/resend
   */
  async resendMessage(messageId: string): Promise<SendReplyResponse> {
    const response = await apiService.post(`/api/messages/${messageId}/resend`);
    return response.data;
  }

  /**
   * 获取会话参与者建议
   * 对应API: GET /api/conversations/participants/suggestions
   */
  async getParticipantSuggestions(query: string): Promise<BaseApiResponse<Array<{
    email: string;
    name?: string;
    recent_conversations: number;
  }>>> {
    const response = await apiService.get(`${this.baseUrl}/participants/suggestions`, {
      params: { q: query }
    });
    return response.data;
  }

  /**
   * 导出会话数据
   * 对应API: GET /api/conversations/export
   */
  async exportConversations(params?: {
    format?: 'csv' | 'json';
    date_from?: string;
    date_to?: string;
    status?: string;
  }): Promise<Blob> {
    const response = await apiService.get(`${this.baseUrl}/export`, {
      params,
      responseType: 'blob'
    });
    return response.data;
  }

  /**
   * 实时获取会话更新
   * 对应API: GET /api/conversations/updates
   */
  async getRealtimeUpdates(lastUpdateTime?: string): Promise<{
    conversations: Conversation[];
    messages: ConversationMessage[];
    timestamp: string;
  }> {
    const params = lastUpdateTime ? { since: lastUpdateTime } : undefined;
    const response = await apiService.get(`${this.baseUrl}/updates`, { params });
    return response.data;
  }

  /**
   * 删除消息
   * 对应API: DELETE /api/messages/:id
   */
  async deleteMessage(messageId: string): Promise<BaseApiResponse<{ success: boolean }>> {
    const response = await apiService.delete(`/api/messages/${messageId}`);
    return response.data;
  }

  /**
   * 标记消息为重要
   * 对应API: POST /api/messages/:id/flag
   */
  async flagMessage(messageId: string): Promise<BaseApiResponse<{ success: boolean }>> {
    const response = await apiService.post(`/api/messages/${messageId}/flag`);
    return response.data;
  }
}

// 创建单例实例
export const conversationService = new ConversationService();

// 默认导出
export default conversationService; 