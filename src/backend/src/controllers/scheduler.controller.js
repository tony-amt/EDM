/**
 * V3.0 队列调度器管理控制器
 */
const QueueScheduler = require('../services/infrastructure/QueueScheduler');
const logger = require('../utils/logger');

// 创建QueueScheduler实例
const queueScheduler = new QueueScheduler();

/**
 * 获取调度器状态
 */
const getSchedulerStatus = async (req, res) => {
  try {
    const status = queueScheduler.getStatus();
    
    res.json({
      success: true,
      data: {
        ...status,
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('获取调度器状态失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 手动触发任务调度（创建SubTask队列）
 */
const triggerTaskScheduling = async (req, res) => {
  try {
    const { batch_size = 10 } = req.body;
    
    logger.info(`手动触发任务调度，批处理大小: ${batch_size}`);
    
    const result = await queueScheduler.processScheduledTasks(batch_size);
    
    res.json({
      success: true,
      message: '任务调度执行完成',
      data: result
    });
  } catch (error) {
    logger.error('手动触发任务调度失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 启动队列调度器
 */
const startScheduler = async (req, res) => {
  try {
    await queueScheduler.start();
    
    res.json({
      success: true,
      message: '队列调度器启动成功',
      data: {
        status: 'running',
        started_at: new Date()
      }
    });
  } catch (error) {
    logger.error('启动队列调度器失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 停止队列调度器
 */
const stopScheduler = async (req, res) => {
  try {
    await queueScheduler.stop();
    
    res.json({
      success: true,
      message: '队列调度器停止成功',
      data: {
        status: 'stopped',
        stopped_at: new Date()
      }
    });
  } catch (error) {
    logger.error('停止队列调度器失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 暂停任务
 */
const pauseTask = async (req, res) => {
  try {
    const { task_id } = req.params;
    
    await queueScheduler.pauseTask(task_id);
    
    res.json({
      success: true,
      message: `任务 ${task_id} 已暂停`
    });
  } catch (error) {
    logger.error('暂停任务失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 恢复任务
 */
const resumeTask = async (req, res) => {
  try {
    const { task_id } = req.params;
    
    await queueScheduler.resumeTask(task_id);
    
    res.json({
      success: true,
      message: `任务 ${task_id} 已恢复`
    });
  } catch (error) {
    logger.error('恢复任务失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 获取调度器统计信息
 */
const getSchedulerStats = async (req, res) => {
  try {
    const { Task, SubTask } = require('../models');
    const { sequelize } = require('../models');
    
    // 获取基础统计
    const taskStats = await Task.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', '*'), 'count']
      ],
      group: ['status'],
      raw: true
    });

    const subtaskStats = await SubTask.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', '*'), 'count']
      ],
      group: ['status'],
      raw: true
    });

    // 最近24小时处理统计
    const { Op } = require('sequelize');
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentTasksCount = await Task.count({
      where: {
        created_at: {
          [Op.gte]: yesterday
        }
      }
    });

    const recentSubTasksCount = await SubTask.count({
      where: {
        created_at: {
          [Op.gte]: yesterday
        }
      }
    });

    const stats = {
      tasks: {
        total: taskStats.reduce((sum, item) => sum + parseInt(item.count), 0),
        by_status: taskStats.reduce((acc, item) => {
          acc[item.status] = parseInt(item.count);
          return acc;
        }, {}),
        recent_24h: recentTasksCount
      },
      subtasks: {
        total: subtaskStats.reduce((sum, item) => sum + parseInt(item.count), 0),
        by_status: subtaskStats.reduce((acc, item) => {
          acc[item.status] = parseInt(item.count);
          return acc;
        }, {}),
        recent_24h: recentSubTasksCount
      },
      scheduler: queueScheduler.getStatus()
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('获取调度器统计失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getSchedulerStatus,
  triggerTaskScheduling,
  startScheduler,
  stopScheduler,
  pauseTask,
  resumeTask,
  getSchedulerStats
}; 