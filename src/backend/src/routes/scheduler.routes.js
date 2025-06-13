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

module.exports = router; 