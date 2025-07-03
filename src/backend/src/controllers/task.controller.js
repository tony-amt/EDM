const TaskService = require('../services/core/task.service');
const SubTaskService = require('../services/core/subtask.service');
const { Task } = require('../models/index');
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

    // 🔧 修复：如果任务状态是scheduled，立即触发子任务分配调度
    if (task.status === 'scheduled') {
      try {
        await TaskService.generateSubTasksV3(task);
        await TaskService.allocateSubTasks(task);
        console.log(`✅ 任务 ${task.id} 创建后自动调度完成`);
      } catch (scheduleError) {
        console.error(`❌ 任务 ${task.id} 自动调度失败:`, scheduleError);
        // 不阻断任务创建，但记录错误
      }
    }

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

    // 🔧 修复：转换为前端期望的格式
    const stats = {
      total_contacts: subTaskStats.total_subtasks || 0,
      sent: subTaskStats.by_status?.sent || 0,
      delivered: subTaskStats.by_status?.delivered || 0,
      opened: subTaskStats.by_status?.opened || 0,
      clicked: subTaskStats.by_status?.clicked || 0,
      bounced: subTaskStats.by_status?.bounced || 0,
      failed: subTaskStats.by_status?.failed || 0,
      pending: subTaskStats.by_status?.pending || 0,
      allocated: subTaskStats.by_status?.allocated || 0
    };

    // 计算转化率
    stats.delivery_rate = stats.sent > 0 ?
      parseFloat(((stats.delivered / stats.sent) * 100).toFixed(2)) : 0;

    stats.open_rate = stats.delivered > 0 ?
      parseFloat(((stats.opened / stats.delivered) * 100).toFixed(2)) : 0;

    stats.click_rate = stats.opened > 0 ?
      parseFloat(((stats.clicked / stats.opened) * 100).toFixed(2)) : 0;

    res.status(200).json({
      success: true,
      message: 'Task real-time stats retrieved successfully',
      data: stats
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
   * V2.1: 增强的暂停任务功能
   * POST /api/tasks/:id/pause
   * 支持暂停原因、预定恢复时间等
   */
  pauseTask = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const taskId = req.params.id;
    const { reason = '手动暂停', resume_at, notify_admin = false } = req.body;

    const task = await TaskService.getTaskById(taskId, userId);

    if (!['scheduled', 'sending'].includes(task.status)) {
      throw new AppError('只有scheduled或sending状态的任务可以暂停', 400);
    }

    // 记录暂停详细信息
    const pauseInfo = {
      paused_at: new Date(),
      pause_reason: reason,
      paused_by: userId,
      resume_at: resume_at ? new Date(resume_at) : null
    };

    // 更新任务状态和暂停信息
    const pausedTask = await TaskService.updateTaskStatus(taskId, userId, 'paused', {
      pause_info: pauseInfo,
      error_message: reason
    });

    // 通知调度器暂停任务队列
    const QueueScheduler = require('../services/infrastructure/QueueScheduler');
    const scheduler = new QueueScheduler();
    await scheduler.pauseTaskQueue(taskId, reason);

    // 如果设置了预定恢复时间，创建恢复任务
    if (resume_at) {
      await this.scheduleTaskResume(taskId, new Date(resume_at), reason);
    }

    res.status(200).json({
      success: true,
      message: '任务已暂停',
      data: {
        task: pausedTask,
        pause_info: pauseInfo,
        scheduled_resume: resume_at || null
      }
    });
  });

  /**
   * V2.1: 增强的恢复任务功能
   * POST /api/tasks/:id/resume
   */
  resumeTask = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const taskId = req.params.id;
    const { reason = '手动恢复' } = req.body;

    const task = await TaskService.getTaskById(taskId, userId);

    if (task.status !== 'paused') {
      throw new AppError('只有paused状态的任务可以恢复', 400);
    }

    // 记录恢复信息
    const resumeInfo = {
      resumed_at: new Date(),
      resume_reason: reason,
      resumed_by: userId
    };

    // 恢复到sending状态，让调度器继续处理
    const resumedTask = await TaskService.updateTaskStatus(taskId, userId, 'sending', {
      resume_info: resumeInfo,
      error_message: null
    });

    // 通知调度器恢复任务队列
    const QueueScheduler = require('../services/infrastructure/QueueScheduler');
    const scheduler = new QueueScheduler();
    await scheduler.resumeTaskQueue(taskId);

    res.status(200).json({
      success: true,
      message: '任务已恢复',
      data: {
        task: resumedTask,
        resume_info: resumeInfo
      }
    });
  });

  /**
   * V2.1: 批量暂停任务
   * POST /api/tasks/batch-pause
   */
  batchPauseTasks = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { task_ids, reason = '批量暂停', resume_at } = req.body;

    if (!task_ids || !Array.isArray(task_ids) || task_ids.length === 0) {
      throw new AppError('请提供要暂停的任务ID列表', 400);
    }

    if (task_ids.length > 50) {
      throw new AppError('单次批量操作最多支持50个任务', 400);
    }

    const results = {
      total: task_ids.length,
      successful: [],
      failed: [],
      skipped: []
    };

    const QueueScheduler = require('../services/infrastructure/QueueScheduler');
    const scheduler = new QueueScheduler();

    for (const taskId of task_ids) {
      try {
        // 验证任务权限
        const task = await TaskService.getTaskById(taskId, userId);

        if (!['scheduled', 'sending'].includes(task.status)) {
          results.skipped.push({
            task_id: taskId,
            reason: `任务状态为${task.status}，无法暂停`
          });
          continue;
        }

        // 暂停任务
        const pauseInfo = {
          paused_at: new Date(),
          pause_reason: reason,
          paused_by: userId,
          resume_at: resume_at ? new Date(resume_at) : null
        };

        await TaskService.updateTaskStatus(taskId, userId, 'paused', {
          pause_info: pauseInfo,
          error_message: reason
        });

        await scheduler.pauseTaskQueue(taskId, reason);

        results.successful.push({
          task_id: taskId,
          task_name: task.name,
          paused_at: pauseInfo.paused_at
        });

      } catch (error) {
        results.failed.push({
          task_id: taskId,
          error: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `批量暂停完成: 成功${results.successful.length}个，失败${results.failed.length}个，跳过${results.skipped.length}个`,
      data: results
    });
  });

  /**
   * V2.1: 批量恢复任务
   * POST /api/tasks/batch-resume
   */
  batchResumeTasks = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { task_ids, reason = '批量恢复' } = req.body;

    if (!task_ids || !Array.isArray(task_ids) || task_ids.length === 0) {
      throw new AppError('请提供要恢复的任务ID列表', 400);
    }

    if (task_ids.length > 50) {
      throw new AppError('单次批量操作最多支持50个任务', 400);
    }

    const results = {
      total: task_ids.length,
      successful: [],
      failed: [],
      skipped: []
    };

    const QueueScheduler = require('../services/infrastructure/QueueScheduler');
    const scheduler = new QueueScheduler();

    for (const taskId of task_ids) {
      try {
        // 验证任务权限
        const task = await TaskService.getTaskById(taskId, userId);

        if (task.status !== 'paused') {
          results.skipped.push({
            task_id: taskId,
            reason: `任务状态为${task.status}，无法恢复`
          });
          continue;
        }

        // 恢复任务
        const resumeInfo = {
          resumed_at: new Date(),
          resume_reason: reason,
          resumed_by: userId
        };

        await TaskService.updateTaskStatus(taskId, userId, 'sending', {
          resume_info: resumeInfo,
          error_message: null
        });

        await scheduler.resumeTaskQueue(taskId);

        results.successful.push({
          task_id: taskId,
          task_name: task.name,
          resumed_at: resumeInfo.resumed_at
        });

      } catch (error) {
        results.failed.push({
          task_id: taskId,
          error: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `批量恢复完成: 成功${results.successful.length}个，失败${results.failed.length}个，跳过${results.skipped.length}个`,
      data: results
    });
  });

  /**
   * V2.1: 条件暂停任务检查
   * POST /api/tasks/:id/check-pause-conditions
   * 基于发送效果自动暂停任务
   */
  checkPauseConditions = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const taskId = req.params.id;
    const {
      bounce_rate_threshold = 0.1,    // 退信率阈值 10%
      failure_rate_threshold = 0.2,   // 失败率阈值 20%
      min_sent_count = 100             // 最小发送量
    } = req.body;

    const task = await TaskService.getTaskById(taskId, userId);

    if (!['sending'].includes(task.status)) {
      throw new AppError('只有sending状态的任务可以进行条件检查', 400);
    }

    // 获取任务统计
    const stats = task.summary_stats || {};
    const sentCount = stats.sent || 0;
    const bouncedCount = stats.bounced || 0;
    const failedCount = stats.failed || 0;

    let shouldPause = false;
    let pauseReason = '';

    if (sentCount >= min_sent_count) {
      const bounceRate = sentCount > 0 ? bouncedCount / sentCount : 0;
      const failureRate = sentCount > 0 ? failedCount / sentCount : 0;

      if (bounceRate >= bounce_rate_threshold) {
        shouldPause = true;
        pauseReason = `退信率过高: ${(bounceRate * 100).toFixed(2)}% (阈值: ${(bounce_rate_threshold * 100)}%)`;
      } else if (failureRate >= failure_rate_threshold) {
        shouldPause = true;
        pauseReason = `失败率过高: ${(failureRate * 100).toFixed(2)}% (阈值: ${(failure_rate_threshold * 100)}%)`;
      }
    }

    let pausedTask = null;
    if (shouldPause) {
      // 自动暂停任务
      const pauseInfo = {
        paused_at: new Date(),
        pause_reason: `自动暂停: ${pauseReason}`,
        paused_by: 'system',
        auto_pause: true
      };

      pausedTask = await TaskService.updateTaskStatus(taskId, userId, 'paused', {
        pause_info: pauseInfo,
        error_message: pauseReason
      });

      const QueueScheduler = require('../services/infrastructure/QueueScheduler');
      const scheduler = new QueueScheduler();
      await scheduler.pauseTaskQueue(taskId, pauseReason);
    }

    res.status(200).json({
      success: true,
      message: shouldPause ? '任务已自动暂停' : '任务状态正常',
      data: {
        should_pause: shouldPause,
        pause_reason: pauseReason,
        statistics: {
          sent_count: sentCount,
          bounced_count: bouncedCount,
          failed_count: failedCount,
          bounce_rate: sentCount > 0 ? (bouncedCount / sentCount * 100).toFixed(2) + '%' : '0%',
          failure_rate: sentCount > 0 ? (failedCount / sentCount * 100).toFixed(2) + '%' : '0%'
        },
        thresholds: {
          bounce_rate_threshold: (bounce_rate_threshold * 100) + '%',
          failure_rate_threshold: (failure_rate_threshold * 100) + '%',
          min_sent_count
        },
        task: pausedTask
      }
    });
  });

  /**
   * V2.1: 定时恢复任务的内部方法
   */
  async scheduleTaskResume(taskId, resumeTime, reason) {
    // 这里可以集成定时任务系统，比如使用node-cron或Bull队列
    // 目前先记录信息，后续可以通过定时检查来实现
    console.log(`📅 计划在 ${resumeTime.toISOString()} 恢复任务 ${taskId}，原因: ${reason}`);

    // TODO: 可以集成定时任务框架实现真正的定时恢复
    // 或者在QueueScheduler中添加定时恢复检查逻辑
  }

  /**
   * V2.1: 获取任务暂停/恢复历史
   * GET /api/tasks/:id/pause-history
   */
  getTaskPauseHistory = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const taskId = req.params.id;

    // 验证任务权限
    await TaskService.getTaskById(taskId, userId);

    // 获取任务的暂停/恢复历史（从任务的元数据中获取）
    const task = await Task.findByPk(taskId, {
      attributes: ['id', 'name', 'status', 'pause_info', 'resume_info', 'created_at']
    });

    const history = [];

    if (task.pause_info) {
      history.push({
        action: 'pause',
        timestamp: task.pause_info.paused_at,
        reason: task.pause_info.pause_reason,
        operator: task.pause_info.paused_by,
        details: task.pause_info
      });
    }

    if (task.resume_info) {
      history.push({
        action: 'resume',
        timestamp: task.resume_info.resumed_at,
        reason: task.resume_info.resume_reason,
        operator: task.resume_info.resumed_by,
        details: task.resume_info
      });
    }

    // 按时间排序
    history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.status(200).json({
      success: true,
      data: {
        task_id: taskId,
        task_name: task.name,
        current_status: task.status,
        history
      }
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

  /**
   * V2.0: 获取任务模板信息
   * GET /api/tasks/:id/templates
   */
  getTaskTemplates = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const taskId = req.params.id;

    // 验证任务是否属于用户
    const task = await Task.findOne({
      where: { id: taskId, created_by: userId },
      attributes: ['id', 'name', 'templates']
    });

    if (!task) {
      throw new AppError('任务不存在或无权访问', 404);
    }

    // 获取模板详细信息
    const templateIds = task.templates || [];
    if (templateIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    const { Template } = require('../models/index');
    const templates = await Template.findAll({
      where: {
        id: templateIds,
        user_id: userId
      },
      attributes: ['id', 'name', 'subject', 'body', 'created_at']
    });

    res.status(200).json({
      success: true,
      data: templates
    });
  });
}

module.exports = new TaskController(); 