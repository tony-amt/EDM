// 统一API类型定义 - 前后端接口契约
// 这个文件应该与后端数据模型保持严格一致

export interface BaseApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginationParams {
  page?: number;
  page_size?: number;
  limit?: number;
}

export interface PaginationResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  pages?: number;
}

// 会话消息 - 与后端EmailMessage模型严格对应
export interface ConversationMessage {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  from_email: string;
  from_name?: string;
  to_email: string;
  to_name?: string;
  subject: string;
  content_text?: string;    // 注意：不是body
  content_html?: string;    // 注意：不是html_body
  status: 'draft' | 'sent' | 'delivered' | 'read' | 'failed';
  sent_at: string;
  delivered_at?: string;
  read_at?: string;
  engagelab_email_id?: string;
  engagelab_message_id?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

// 会话 - 与后端EmailConversation模型严格对应
export interface Conversation {
  id: string;
  conversation_key: string;
  sender_email: string;
  recipient_email: string;
  subject: string;
  status: 'active' | 'archived' | 'closed';
  message_count: number;
  unread_count: number;
  last_message_at: string;
  created_at: string;
  updated_at: string;
  messages?: ConversationMessage[];
  user?: {
    id: string;
    username: string;
    email: string;
  };
  last_message?: {
    content_text: string;
    direction: 'inbound' | 'outbound';
  };
}

// API请求参数类型
export interface ConversationListParams extends PaginationParams {
  search?: string;
  status?: 'active' | 'archived' | 'closed' | string;  // 允许字符串类型以兼容现有代码
  start_date?: string;
  end_date?: string;
}

export interface CreateConversationParams {
  sender_email: string;
  recipient_email: string;
  subject: string;
  content_text: string;
  content_html?: string;
}

export interface SendReplyParams {
  to_email: string;
  subject: string;
  content_text: string;
  content_html?: string;
  from_email: string;
}

// API响应类型
export interface ConversationListResponse extends PaginationResponse<Conversation> {}

export interface ConversationDetailResponse extends BaseApiResponse<Conversation> {}

export interface ConversationStatsResponse extends BaseApiResponse<{
  total: number;
  active: number;
  archived: number;
  closed: number;
  unread: number;
}> {}

export interface SendReplyResponse extends BaseApiResponse<ConversationMessage> {}

// 向后兼容的类型别名
export type EmailMessage = ConversationMessage;
export type EmailConversation = Conversation; 