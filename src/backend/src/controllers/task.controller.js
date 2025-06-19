const TaskService = require('../services/core/task.service');
const SubTaskService = require('../services/core/subtask.service');
const { Task } = require('../models');
const { AppError } = require('../utils/errorHandler');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');

const sendSuccess = (res, data, statusCode = 200) => {
  res.status(statusCode).json(data);
};

const handleError = (err, next) => {
  if (err instanceof AppError) return next(err);
  console.error('Unexpected error in TaskController:', err); // Basic logging
  return next(new AppError(err.message || 'An unexpected error occurred in task operations.', 500));
};

/**
 * V2.0 群发任务控制器
 * 提供独立群发任务的API接口，不依赖Campaign
 */
class TaskController {

  /**
   * V2.0: 创建群发任务
   * POST /api/tasks
   */
  createTask = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const taskData = req.body;

    const task = await TaskService.createTask(taskData, userId);

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: task
    });
  });

  /**
   * V2.0: 获取任务列表
   * GET /api/tasks
   */
  getTasks = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      status: req.query.status,
      search: req.query.search
    };

    const result = await TaskService.getTasks(userId, options);

    res.status(200).json({
      success: true,
      message: 'Tasks retrieved successfully',
      data: result
    });
  });

  /**
   * V2.0: 获取单个任务详情
   * GET /api/tasks/:id
   */
  getTaskById = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const taskId = req.params.id;

    const task = await TaskService.getTaskById(taskId, userId);

    res.status(200).json({
      success: true,
      message: 'Task retrieved successfully',
      data: task
    });
  });

  /**
   * V2.0: 更新任务状态
   * PATCH /api/tasks/:id/status
   */
  updateTaskStatus = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const taskId = req.params.id;
    const { status, pause_reason } = req.body;

    // 构建更新数据
    const updateData = { status };
    if (status === 'paused' && pause_reason) {
      updateData.pause_reason = pause_reason;
    }
    if (status === 'completed') {
      updateData.completed_at = new Date();
    }

    const task = await TaskService.updateTaskStatus(taskId, userId, status, updateData);

    res.status(200).json({
      success: true,
      message: `Task status updated to ${status}`,
      data: task
    });
  });

  /**
   * V2.0: 删除任务
   * DELETE /api/tasks/:id
   */
  deleteTask = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const taskId = req.params.id;

    const result = await TaskService.deleteTask(taskId, userId);

    res.status(200).json({
      success: true,
      message: 'Task deleted successfully',
      data: result
    });
  });

  /**
   * V2.0: 获取任务统计
   * GET /api/tasks/stats
   */
  getTaskStats = catchAsync(async (req, res) => {
    const userId = req.user.id;

    const stats = await TaskService.getTaskStats(userId);

    res.status(200).json({
      success: true,
      message: 'Task statistics retrieved successfully',
      data: stats
    });
  });

  /**
   * V2.0: 获取任务的SubTask列表
   * GET /api/tasks/:id/subtasks
   */
  getTaskSubTasks = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const taskId = req.params.id;
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      status: req.query.status
    };

    // 验证任务是否属于用户
    await TaskService.getTaskById(taskId, userId);

    const result = await SubTaskService.getSubTasksByTaskId(taskId, options);

    res.status(200).json({
      success: true,
      message: 'SubTasks retrieved successfully',
      data: result
    });
  });

  /**
   * V2.0: 获取任务详细分析报告
   * GET /api/tasks/:id/analytics
   */
  getTaskAnalytics = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const taskId = req.params.id;

    // 验证任务是否属于用户
    await TaskService.getTaskById(taskId, userId);

    // 引入TrackingService获取详细分析
    const TrackingService = require('../services/core/tracking.service');
    const analytics = await TrackingService.getTaskAnalytics(taskId);

    res.status(200).json({
      success: true,
      message: 'Task analytics retrieved successfully',
      data: analytics
    });
  });

  /**
   * V2.0: 获取任务实时统计
   * GET /api/tasks/:id/stats
   */
  getTaskRealTimeStats = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const taskId = req.params.id;

    // 验证任务是否属于用户
    const task = await TaskService.getTaskById(taskId, userId);

    // 获取SubTask统计
    const subTaskStats = await SubTaskService.getSubTaskStats({ task_id: taskId });

    res.status(200).json({
      success: true,
      message: 'Task real-time stats retrieved successfully',
      data: {
        task_id: taskId,
        task_name: task.name,
        task_status: task.status,
        summary_stats: task.summary_stats,
        detailed_stats: subTaskStats,
        last_updated: new Date()
      }
    });
  });

  /**
   * V2.0: 获取SubTask热力图数据
   * GET /api/tasks/:id/heatmap
   */
  getTaskHeatmap = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const taskId = req.params.id;
    const { date } = req.query;

    // 验证任务是否属于用户
    await TaskService.getTaskById(taskId, userId);

    const heatmapData = await SubTaskService.getSubTaskHeatmapData(taskId, date);

    res.status(200).json({
      success: true,
      message: 'Task heatmap data retrieved successfully',
      data: heatmapData
    });
  });

  /**
   * V2.0: 批量更新SubTask状态
   * PATCH /api/tasks/:id/subtasks/batch-status
   */
  batchUpdateSubTaskStatus = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const taskId = req.params.id;
    const { subtask_ids, status_data } = req.body;

    // 验证任务是否属于用户
    await TaskService.getTaskById(taskId, userId);

    const result = await SubTaskService.batchUpdateSubTaskStatus(subtask_ids, status_data);

    res.status(200).json({
      success: true,
      message: 'SubTask statuses updated successfully',
      data: result
    });
  });

  /**
   * V2.0: 立即调度任务
   * POST /api/tasks/:id/schedule-now
   */
  scheduleTaskNow = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const taskId = req.params.id;

    // 验证任务是否属于用户
    const task = await TaskService.getTaskById(taskId, userId);

    if (task.status !== 'draft') {
      throw new AppError('只有草稿状态的任务可以立即调度', 400);
    }

    // 更新任务为立即调度
    const updatedTask = await TaskService.updateTaskStatus(taskId, userId, 'scheduled', {
      scheduled_at: new Date()
    });

    res.status(200).json({
      success: true,
      message: '任务已立即调度，等待处理',
      data: updatedTask
    });
  });

  /**
   * V2.0: 复制任务
   * POST /api/tasks/:id/copy
   */
  copyTask = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const taskId = req.params.id;
    const { name } = req.body;

    // 验证任务是否属于用户
    const originalTask = await TaskService.getTaskById(taskId, userId);

    // 创建任务副本
    const taskCopy = {
      ...originalTask.toJSON(),
      name: name || `${originalTask.name} - 副本`,
      status: 'draft',
      scheduled_at: null,
      total_subtasks: 0,
      allocated_subtasks: 0,
      pending_subtasks: 0,
      id: undefined, // 清除ID让数据库生成新的
      created_at: undefined,
      updated_at: undefined
    };

    const newTask = await TaskService.createTask(taskCopy, userId);

    res.status(201).json({
      success: true,
      message: '任务复制成功',
      data: newTask
    });
  });

  /**
   * V2.0: 暂停/恢复任务
   * POST /api/tasks/:id/pause
   * POST /api/tasks/:id/resume
   */
  pauseTask = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const taskId = req.params.id;

    const task = await TaskService.getTaskById(taskId, userId);

    if (!['scheduled', 'sending'].includes(task.status)) {
      throw new AppError('只有scheduled或sending状态的任务可以暂停', 400);
    }

    const pausedTask = await TaskService.updateTaskStatus(taskId, userId, 'paused');

    res.status(200).json({
      success: true,
      message: '任务已暂停',
      data: pausedTask
    });
  });

  resumeTask = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const taskId = req.params.id;

    const task = await TaskService.getTaskById(taskId, userId);

    if (task.status !== 'paused') {
      throw new AppError('只有paused状态的任务可以恢复', 400);
    }

    // 恢复到sending状态，让调度器继续处理
    const resumedTask = await TaskService.updateTaskStatus(taskId, userId, 'sending');

    res.status(200).json({
      success: true,
      message: '任务已恢复',
      data: resumedTask
    });
  });

  async updateTask(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed.', 400, errors.array());
      }
      const taskId = req.params.id;
      const updateData = req.body;
      const userId = req.user.id;

      // Specific validations for PUT /tasks/{id}
      // TC_TSK_2.4.5 (plan_time past) - service handles

      const updatedTask = await TaskService.updateTask(taskId, updateData, userId);
      
      res.status(200).json({
        success: true,
        message: 'Task updated successfully',
        data: updatedTask
      });
    } catch (err) {
      handleError(err, next);
    }
  }

  async getTaskRecipients(req, res, next) { // TC_TSK_2.7
    try {
      const { task_id } = req.params;
      const filters = req.query;
      const userId = req.user.id;
      const recipients = await TaskService.getTaskRecipients(task_id, filters, userId);
      sendSuccess(res, recipients);
    } catch (err) {
      handleError(err, next);
    }
  }

  async getTaskReport(req, res, next) { // TC_TSK_2.8
    try {
      const { task_id } = req.params;
      const userId = req.user.id;
      const report = await TaskService.getTaskReport(task_id, userId);
      sendSuccess(res, report);
    } catch (err) {
      handleError(err, next);
    }
  }

  /**
   * V2.0: 手动检查并更新任务状态
   * POST /api/tasks/:id/check-status
   */
  checkTaskStatus = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const taskId = req.params.id;

    // 验证任务是否属于用户
    const task = await TaskService.getTaskById(taskId, userId);

    // 获取QueueScheduler实例并手动触发状态检查
    const QueueScheduler = require('../services/infrastructure/QueueScheduler');
    const scheduler = new QueueScheduler();
    
    await scheduler.checkAndUpdateTaskStatus(taskId);

    // 重新获取更新后的任务状态
    const updatedTask = await TaskService.getTaskById(taskId, userId);

    res.status(200).json({
      success: true,
      message: '任务状态检查完成',
      data: {
        original_status: task.status,
        current_status: updatedTask.status,
        updated: task.status !== updatedTask.status
      }
    });
  });

  /**
   * V2.0: 手动更新任务统计数据
   * POST /api/tasks/:id/update-stats
   */
  updateTaskStats = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const taskId = req.params.id;

    // 验证任务是否属于用户
    await TaskService.getTaskById(taskId, userId);

    // 获取QueueScheduler实例并更新统计
    const QueueScheduler = require('../services/infrastructure/QueueScheduler');
    const scheduler = new QueueScheduler();
    
    await scheduler.updateTaskStats(taskId);

    // 重新获取更新后的任务
    const updatedTask = await TaskService.getTaskById(taskId, userId);

    res.status(200).json({
      success: true,
      message: '任务统计数据更新成功',
      data: updatedTask
    });
  });

  /**
   * V2.0: 批量更新所有任务统计数据
   * POST /api/tasks/batch-update-stats
   */
  batchUpdateTaskStats = catchAsync(async (req, res) => {
    const userId = req.user.id;

    // 获取用户的所有任务
    const tasks = await Task.findAll({
      where: { created_by: userId },
      attributes: ['id', 'name']
    });

    const QueueScheduler = require('../services/infrastructure/QueueScheduler');
    const scheduler = new QueueScheduler();
    
    let updated = 0;
    let failed = 0;

    for (const task of tasks) {
      try {
        await scheduler.updateTaskStats(task.id);
        updated++;
      } catch (error) {
        logger.error(`更新任务 ${task.id} 统计失败:`, error);
        failed++;
      }
    }

    res.status(200).json({
      success: true,
      message: '批量更新任务统计完成',
      data: {
        total: tasks.length,
        updated,
        failed
      }
    });
  });
}

module.exports = new TaskController(); 