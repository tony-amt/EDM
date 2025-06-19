// API基础URL  
export const API_URL = process.env.REACT_APP_API_BASE_URL || '/api';

// 分页默认配置
export const DEFAULT_PAGE_SIZE = 10;
export const DEFAULT_PAGE = 1;

// 联系人状态
export const CONTACT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  UNSUBSCRIBED: 'unsubscribed',
  BOUNCED: 'bounced'
};

// 活动状态
export const CAMPAIGN_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

// 任务状态
export const TASK_STATUS = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  SENDING: 'sending',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  FAILED: 'failed'
};

// 邮件变量类型
export const VARIABLE_SOURCE_TYPES = {
  CONTACT_FIELD: 'CONTACT_FIELD',
  SYSTEM: 'SYSTEM',
  CUSTOM_GENERATOR: 'CUSTOM_GENERATOR',
  USER_DEFINED: 'USER_DEFINED'
};

// 本地存储键名
export const STORAGE_KEYS = {
  TOKEN: 'token',
  USER: 'user'
};

// 路由路径
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  CONTACTS: '/contacts',
  TAGS: '/tags',
  TEMPLATES: '/templates',
  TEMPLATE_SETS: '/template-sets',
  CAMPAIGNS: '/campaigns',
  TASKS: '/tasks'
}; 