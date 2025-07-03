import api from './api';

export interface Task {
  id: string;
  name: string;
  description: string;
  status: string;
  type: string;
  schedule_time: string;
  campaign_id: string;
  campaign_name: string;
  pause_reason?: string;
  created_at: string;
  updated_at: string;
  // 统计数据
  total_subtasks?: number;
  pending_subtasks?: number;
  allocated_subtasks?: number;
  summary_stats?: {
    total_recipients: number;
    pending: number;
    allocated: number;
    sending: number;
    sent: number;
    delivered: number;
    bounced: number;
    opened: number;
    clicked: number;
    failed: number;
  };
}

export interface TasksResponse {
  success?: boolean;
  data: {
    items: Task[];
    page: number;
    total: number;
    limit: number;
    pages: number;
  };
}

export interface TaskResponse {
  success?: boolean;
  data?: Task;
}

export interface QueryParams {
  page?: number;
  limit?: number;
  name?: string;
  status?: string;
  campaign_id?: string;
}

const taskService = {
  // 获取任务列表
  getTasks: async (params: QueryParams = {}) => {
    const response = await api.get<TasksResponse>('/tasks', { params });
    return response.data;
  },

  // 获取单个任务详情
  getTask: async (id: string) => {
    const response = await api.get<TaskResponse>(`/tasks/${id}`);
    return response.data;
  },

  // 创建任务
  createTask: async (taskData: Partial<Task>) => {
    const response = await api.post<TaskResponse>('/tasks', taskData);
    return response.data;
  },

  // 更新任务
  updateTask: async (id: string, taskData: Partial<Task>) => {
    const response = await api.put<TaskResponse>(`/tasks/${id}`, taskData);
    return response.data;
  },

  // 更新任务状态
  updateTaskStatus: async (id: string, status: string, pause_reason?: string) => {
    const response = await api.patch<TaskResponse>(`/tasks/${id}/status`, {
      status,
      pause_reason
    });
    return response.data;
  },

  // 删除任务
  deleteTask: async (id: string) => {
    const response = await api.delete(`/tasks/${id}`);
    return response.data;
  },

  // 获取任务统计
  getTaskStats: async (id: string) => {
    const response = await api.get(`/tasks/${id}/stats`);
    return response.data;
  },

  // 获取任务的子任务列表
  getSubTasks: async (id: string) => {
    const response = await api.get(`/tasks/${id}/subtasks`);
    return response.data;
  },

  // 获取任务的模板信息
  getTaskTemplates: async (id: string) => {
    const response = await api.get(`/tasks/${id}/templates`);
    return response.data;
  }
};

export default taskService; 