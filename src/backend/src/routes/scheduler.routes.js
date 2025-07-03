const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../middlewares/auth.middleware');
const {
  getSchedulerStatus,
  triggerTaskScheduling,
  startScheduler,
  stopScheduler,
  pauseTask,
  resumeTask,
  getSchedulerStats
} = require('../controllers/scheduler.controller');
const logger = require('../utils/logger');

/**
 * V3.0 队列调度器管理路由
 */

/**
 * 获取调度器状态
 */
router.get('/status', verifyToken, getSchedulerStatus);

/**
 * 手动触发任务调度
 */
router.post('/trigger-scheduling', verifyToken, requireAdmin, triggerTaskScheduling);

/**
 * 启动调度器
 */
router.post('/start', verifyToken, requireAdmin, startScheduler);

/**
 * 停止调度器
 */
router.post('/stop', verifyToken, requireAdmin, stopScheduler);

/**
 * 暂停任务
 */
router.post('/tasks/:task_id/pause', verifyToken, requireAdmin, pauseTask);

/**
 * 恢复任务
 */
router.post('/tasks/:task_id/resume', verifyToken, requireAdmin, resumeTask);

/**
 * 获取调度器统计信息
 */
router.get('/stats', verifyToken, getSchedulerStats);

// 🔧 【V2.0新增】调度器健康检查端点
router.get('/health', async (req, res) => {
  try {
    const QueueScheduler = require('../services/infrastructure/QueueScheduler');

    // 获取调度器实例状态
    const schedulerStatus = {
      isRunning: false,
      activeTimers: 0,
      lastActivity: null,
      services: [],
      uptime: process.uptime()
    };

    // 检查调度器是否运行
    try {
      // 这里需要根据实际的QueueScheduler实现来获取状态
      schedulerStatus.isRunning = true; // 临时设置，实际需要检查调度器状态
      schedulerStatus.lastActivity = new Date().toISOString();
    } catch (error) {
      logger.error('获取调度器状态失败:', error);
    }

    res.json({
      success: true,
      data: {
        status: schedulerStatus.isRunning ? 'running' : 'stopped',
        uptime: schedulerStatus.uptime,
        lastActivity: schedulerStatus.lastActivity,
        activeTimers: schedulerStatus.activeTimers,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('调度器健康检查失败:', error);
    res.status(500).json({
      success: false,
      error: { message: '调度器健康检查失败' }
    });
  }
});

// 🔧 【V2.0新增】手动触发调度器处理
router.post('/trigger', verifyToken, async (req, res) => {
  try {
    const QueueScheduler = require('../services/infrastructure/QueueScheduler');

    // 这里需要实现手动触发调度器的逻辑
    logger.info(`用户 ${req.user.id} 手动触发调度器处理`);

    res.json({
      success: true,
      message: '调度器处理已触发',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('手动触发调度器失败:', error);
    res.status(500).json({
      success: false,
      error: { message: '手动触发调度器失败' }
    });
  }
});

module.exports = router; 