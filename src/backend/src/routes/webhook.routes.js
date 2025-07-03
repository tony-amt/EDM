const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhook.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const WebhookService = require('../services/core/webhook.service');
const logger = require('../utils/logger');
const { EventLog } = require('../models/index');
const catchAsync = require('../utils/catchAsync');
const { Op } = require('sequelize');

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

/**
 * 统一webhook处理入口
 * POST /api/webhooks/process
 */
router.post('/process', catchAsync(async (req, res) => {
  const webhookData = req.body;

  logger.info('📥 收到webhook请求', {
    event_type: webhookData.event_type,
    source: webhookData.source,
    message_id: webhookData.message_id
  });

  const result = await WebhookService.processWebhook(webhookData);

  res.status(200).json(result);
}));

/**
 * 获取webhook日志列表
 * GET /api/webhooks/logs
 */
router.get('/logs', catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 50,
    event_type,
    source,
    message_id,
    user_id,
    task_id,
    start_date,
    end_date
  } = req.query;

  const where = {};

  if (event_type) where.event_type = event_type;
  if (source) where.source = source;
  if (message_id) where.message_id = message_id;
  if (user_id) where.user_id = user_id;
  if (task_id) where.task_id = task_id;

  if (start_date || end_date) {
    where.timestamp = {};
    if (start_date) where.timestamp[Op.gte] = new Date(start_date);
    if (end_date) where.timestamp[Op.lte] = new Date(end_date);
  }

  const offset = (page - 1) * limit;

  const result = await EventLog.findAndCountAll({
    where,
    order: [['timestamp', 'DESC']],
    limit: parseInt(limit),
    offset
  });

  res.json({
    success: true,
    data: {
      logs: result.rows,
      total: result.count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(result.count / limit)
    }
  });
}));

/**
 * 获取单个webhook日志详情
 * GET /api/webhooks/logs/:id
 */
router.get('/logs/:id', catchAsync(async (req, res) => {
  const { id } = req.params;

  const log = await EventLog.findByPk(id);

  if (!log) {
    return res.status(404).json({
      success: false,
      message: 'Webhook日志不存在'
    });
  }

  res.json({
    success: true,
    data: log
  });
}));

module.exports = router; 