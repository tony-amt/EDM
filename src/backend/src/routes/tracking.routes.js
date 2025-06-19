const express = require('express');
const router = express.Router();
const trackingController = require('../controllers/tracking.controller');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');
// Add any necessary middleware, e.g., for validating UUIDs if needed
// const { validateParamUUID } = require('../middleware/validators'); 

/**
 * @swagger
 * /track/open/{subTaskId}.png:
 *   get:
 *     summary: V2.0 Records an email open event using SubTask ID.
 *     description: >
 *       V2.0 tracking endpoint embedded as an image source in emails.
 *       Records open events and returns a 1x1 transparent pixel image.
 *     tags: [V2.0 Tracking]
 *     parameters:
 *       - in: path
 *         name: subTaskId
 *         required: true
 *         description: The unique SubTask ID identifying the email sent to a specific contact.
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Successfully recorded open and returned pixel image.
 *         content:
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Bad Request (missing subTaskId).
 *       500:
 *         description: Internal Server Error.
 */
router.get('/open/:subTaskId', trackingController.trackEmailOpen.bind(trackingController));
// Alternative without .png, if preferred, ensure controller sets Content-Type properly.
// router.get('/open/:taskContactId', TrackingController.trackOpen);


/**
 * @swagger
 * /track/click/{subTaskId}/{linkIdentifier}:
 *   get:
 *     summary: V2.0 Records an email link click event and redirects using SubTask ID.
 *     description: >
 *       V2.0 tracking endpoint for email links. Records click events 
 *       and redirects to the original destination URL.
 *     tags: [V2.0 Tracking]
 *     parameters:
 *       - in: path
 *         name: subTaskId
 *         required: true
 *         description: The unique SubTask ID identifying the email sent to a contact.
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: linkIdentifier
 *         required: true
 *         description: Link identifier or URL-encoded original URL.
 *         schema:
 *           type: string
 *     responses:
 *       302:
 *         description: Successfully recorded click and redirected.
 *         headers:
 *           Location:
 *             description: The original URL for redirection.
 *             schema:
 *               type: string
 *               format: url
 *       400:
 *         description: Bad Request (missing identifiers).
 *       404:
 *         description: Not Found (SubTask or link not found).
 *       500:
 *         description: Internal Server Error.
 */
router.get('/click/:subTaskId', trackingController.trackEmailClick.bind(trackingController));

// 支持URL参数的点击跟踪路由
router.get('/click/:subTaskId/:encodedUrl', (req, res) => {
  // 将编码的URL作为查询参数传递给trackEmailClick
  req.query.url = decodeURIComponent(req.params.encodedUrl);
  trackingController.trackEmailClick.bind(trackingController)(req, res);
});

/**
 * @swagger
 * /track/analytics/{taskId}:
 *   get:
 *     summary: V2.0 Get Task analytics and statistics.
 *     description: Returns detailed analytics for a Task including open/click rates.
 *     tags: [V2.0 Analytics]
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         description: The Task ID to get analytics for.
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Task analytics data.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     task_id:
 *                       type: string
 *                     statistics:
 *                       type: object
 *                     rates:
 *                       type: object
 *       404:
 *         description: Task not found.
 */
router.get('/analytics/:taskId', trackingController.getTaskAnalytics.bind(trackingController));

/**
 * @swagger
 * /track/subtask/{subTaskId}/status:
 *   get:
 *     summary: V2.0 Get SubTask tracking status.
 *     description: Returns detailed tracking status for a specific SubTask.
 *     tags: [V2.0 Analytics]
 *     parameters:
 *       - in: path
 *         name: subTaskId
 *         required: true
 *         description: The SubTask ID to get status for.
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: SubTask status data.
 *       404:
 *         description: SubTask not found.
 */
router.get('/subtask/:subTaskId/status', trackingController.getSubTaskStatus.bind(trackingController));

/**
 * EngageLab Webhook处理
 * POST /api/tracking/webhook/engagelab
 */
router.post('/webhook/engagelab', trackingController.handleEngagelabWebhook.bind(trackingController));

/**
 * V2.0 兼容路由
 */
router.get('/v2/open/:subTaskId', trackingController.trackOpen.bind(trackingController));
router.get('/v2/click/:subTaskId/:linkIdentifier', trackingController.trackClick.bind(trackingController));
router.get('/v2/analytics/:taskId', trackingController.getTaskAnalytics.bind(trackingController));
router.get('/v2/subtask/:subTaskId/status', trackingController.getSubTaskStatus.bind(trackingController));

/**
 * 接收邮件状态更新
 * POST /api/tracking/email-status
 */
router.post('/email-status', catchAsync(async (req, res) => {
  const {
    message_id,
    email,
    status,
    timestamp,
    reason,
    source = 'system'
  } = req.body;

  logger.info('📊 邮件状态更新', {
    message_id,
    email,
    status,
    source,
    reason
  });

  // TODO: 这里可以添加到数据库记录邮件状态
  // 目前先记录日志
  
  res.json({
    success: true,
    message: '邮件状态更新记录成功',
    data: {
      message_id,
      email,
      status,
      timestamp: timestamp || new Date().toISOString()
    }
  });
}));

/**
 * 获取追踪统计
 * GET /api/tracking/stats
 */
router.get('/stats', catchAsync(async (req, res) => {
  const { message_id, email, campaign_id } = req.query;

  // TODO: 从追踪服务获取统计数据
  const mockStats = {
    message_id,
    email,
    campaign_id,
    stats: {
      sent: 1,
      delivered: 1,
      opened: 0,
      clicked: 0,
      bounced: 0,
      complained: 0
    },
    last_updated: new Date().toISOString()
  };

  res.json({
    success: true,
    data: mockStats
  });
}));

module.exports = router; 