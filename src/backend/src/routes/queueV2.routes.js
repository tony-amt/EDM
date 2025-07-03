const express = require('express');
const router = express.Router();

// 导入控制器和中间件
const QueueV2Controller = require('../controllers/queueV2.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

// 🎯 队列调度器管理路由

/**
 * @route GET /api/queue-v2/health
 * @desc 基本健康检查（无需认证）
 * @access Public
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Queue V2 API is working',
    timestamp: new Date().toISOString()
  });
});

/**
 * @route GET /api/queue-v2/health-detailed
 * @desc 获取队列调度器详细健康状态
 * @access Private
 */
router.get('/health-detailed', authMiddleware, QueueV2Controller.getHealthStatus);

/**
 * @route POST /api/queue-v2/start
 * @desc 启动队列调度器
 * @access Private
 */
router.post('/start', authMiddleware, QueueV2Controller.startScheduler);

/**
 * @route POST /api/queue-v2/stop
 * @desc 停止队列调度器
 * @access Private
 */
router.post('/stop', authMiddleware, QueueV2Controller.stopScheduler);

/**
 * @route GET /api/queue-v2/status
 * @desc 获取队列状态
 * @access Private
 */
router.get('/status', authMiddleware, QueueV2Controller.getQueueStatus);

/**
 * @route GET /api/queue-v2/services/stats
 * @desc 获取服务状态统计
 * @access Private
 */
router.get('/services/stats', authMiddleware, QueueV2Controller.getServiceStats);

/**
 * @route GET /api/queue-v2/services/ready
 * @desc 获取可用服务列表
 * @access Private
 */
router.get('/services/ready', authMiddleware, QueueV2Controller.getReadyServices);

/**
 * @route POST /api/queue-v2/trigger
 * @desc 手动触发队列处理
 * @access Private
 */
router.post('/trigger', authMiddleware, QueueV2Controller.triggerProcessing);

/**
 * @route GET /api/queue-v2/debug/services
 * @desc 调试EmailService的可用性检查
 * @access Private
 */
router.get('/debug/services', authMiddleware, QueueV2Controller.debugEmailServices);

module.exports = router; 