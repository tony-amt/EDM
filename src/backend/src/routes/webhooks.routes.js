const express = require('express');
const router = express.Router();
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');
const emailConversationService = require('../services/core/emailConversation.service');

/**
 * 记录webhook事件日志
 * POST /api/webhooks/log
 */
router.post('/log', catchAsync(async (req, res) => {
  const {
    event_type,
    webhook_data,
    status,
    error_message,
    timestamp
  } = req.body;

  logger.info('📩 Webhook事件记录', {
    event_type,
    status,
    error_message,
    timestamp,
    data: webhook_data
  });

  res.json({
    success: true,
    message: 'Webhook事件记录成功'
  });
}));

/**
 * 处理入站邮件（回复）
 * POST /api/conversations/inbound
 */
router.post('/conversations/inbound', catchAsync(async (req, res) => {
  const {
    from_email,
    from_name,
    to_email,
    to_name,
    subject,
    content_text,
    content_html,
    message_id,
    in_reply_to,
    references,
    received_at,
    source = 'webhook'
  } = req.body;

  logger.info('📧 处理入站邮件', {
    from: from_email,
    to: to_email,
    subject: subject,
    message_id,
    source
  });

  // 调用邮件会话服务处理入站邮件
  const result = await emailConversationService.handleInboundEmail({
    from_email,
    from_name,
    to_email,
    to_name,
    subject,
    content_text,
    content_html,
    message_id,
    in_reply_to,
    references,
    received_at: received_at ? new Date(received_at) : new Date()
  });

  res.json({
    success: true,
    message: '入站邮件处理成功',
    data: result
  });
}));

module.exports = router; 