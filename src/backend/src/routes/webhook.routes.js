const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhook.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

/**
 * @api {post} /api/webhook/mail 接收邮件事件回调
 * @apiName WebhookMail
 * @apiGroup Webhook
 * @apiDescription 接收邮件服务提供商的事件回调（如：发送、打开、点击等）
 * 
 * @apiSuccess {Boolean} success 处理成功标志
 * @apiSuccess {String} message 处理结果信息
 * 
 * @apiError (400) BadRequest 无效的事件数据
 */
router.post('/mail', webhookController.handleMailEvent);

/**
 * @api {post} /api/webhook/test 测试Webhook接口
 * @apiName TestWebhook
 * @apiGroup Webhook
 * @apiDescription 测试Webhook功能是否正常
 * 
 * @apiHeader {String} Authorization 用户认证token
 * 
 * @apiSuccess {Boolean} success 测试成功标志
 * @apiSuccess {String} message 测试结果信息
 * @apiSuccess {Object} data 接收到的测试数据
 * 
 * @apiError (401) Unauthorized 用户未登录
 */
router.post('/test', verifyToken, webhookController.testWebhook);

/**
 * @api {get} /api/webhook/status Webhook状态检查
 * @apiName WebhookStatus
 * @apiGroup Webhook
 * @apiDescription 检查Webhook是否正常工作
 * 
 * @apiHeader {String} Authorization 用户认证token
 * 
 * @apiSuccess {Boolean} success 状态检查成功标志
 * @apiSuccess {String} status Webhook状态
 */
router.get('/status', verifyToken, (req, res) => {
  res.status(200).json({
    success: true,
    status: 'active',
    message: 'Webhook服务正在运行'
  });
});

module.exports = router; 