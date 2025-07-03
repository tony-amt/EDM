const EmailReplyService = require('../services/core/emailReply.service');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');

/**
 * 邮件回复控制器
 * 处理邮件回复相关的API请求
 */
class EmailReplyController {

  /**
   * 处理收到的邮件回复 (通过webhook调用)
   * POST /api/email-reply/process
   */
  static processEmailReply = catchAsync(async (req, res) => {
    const emailData = req.body;

    logger.info('📬 收到邮件回复处理请求', {
      to: emailData.to,
      from: emailData.from,
      subject: emailData.subject
    });

    const emailReplyService = new EmailReplyService();
    const result = await emailReplyService.processEmailReply(emailData);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: '邮件回复处理成功',
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || '邮件回复处理失败'
      });
    }
  });

  /**
   * 发送回复邮件
   * POST /api/email-reply/send
   */
  static sendReply = catchAsync(async (req, res) => {
    const { conversationId, subject, body } = req.body;
    const userId = req.user.id;

    if (!conversationId || !subject || !body) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数：conversationId, subject, body'
      });
    }

    const emailReplyService = new EmailReplyService();
    const result = await emailReplyService.sendReply(conversationId, { subject, body }, userId);

    res.status(200).json({
      success: true,
      message: '回复邮件发送成功',
      data: result
    });
  });

  /**
   * 获取用户的邮件会话列表
   * GET /api/email-reply/conversations
   */
  static getConversations = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { page, limit, status, search } = req.query;

    const emailReplyService = new EmailReplyService();
    const result = await emailReplyService.getUserConversations(userId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      status: status || 'active',
      search: search || ''
    });

    res.status(200).json({
      success: true,
      message: '获取会话列表成功',
      data: result
    });
  });

  /**
   * 获取会话详情和消息列表
   * GET /api/email-reply/conversations/:id
   */
  static getConversationDetail = catchAsync(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const { page = 1, limit = 50 } = req.query;

    const { EmailConversation, EmailMessage, Contact, Sender } = require('../models/index');

    // 获取会话信息
    const conversation = await EmailConversation.findOne({
      where: {
        id: id,
        user_id: userId
      },
      include: [
        {
          model: Contact,
          as: 'contact',
          attributes: ['id', 'email', 'first_name', 'last_name']
        },
        {
          model: Sender,
          as: 'sender',
          attributes: ['id', 'name']
        }
      ]
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: '会话不存在或无权限访问'
      });
    }

    // 获取消息列表
    const messages = await EmailMessage.findAndCountAll({
      where: { conversation_id: id },
      order: [['received_at', 'DESC']],
      limit: parseInt(limit),
      offset: (page - 1) * limit
    });

    res.status(200).json({
      success: true,
      message: '获取会话详情成功',
      data: {
        conversation,
        messages: {
          list: messages.rows,
          total: messages.count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(messages.count / limit)
        }
      }
    });
  });

  /**
   * 更新会话状态
   * PUT /api/email-reply/conversations/:id/status
   */
  static updateConversationStatus = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    const { EmailConversation } = require('../models/index');

    const conversation = await EmailConversation.findOne({
      where: {
        id: id,
        user_id: userId
      }
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: '会话不存在或无权限访问'
      });
    }

    await conversation.update({ status });

    res.status(200).json({
      success: true,
      message: '会话状态更新成功',
      data: conversation
    });
  });

  /**
   * 获取邮件回复统计
   * GET /api/email-reply/stats
   */
  static getReplyStats = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { EmailConversation, EmailMessage } = require('../models/index');
    const { Op } = require('sequelize');

    // 统计会话数量
    const conversationStats = await EmailConversation.findAll({
      where: { user_id: userId },
      attributes: [
        'status',
        [require('../models/index').sequelize.fn('COUNT', require('../models/index').sequelize.col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    // 统计消息数量（按方向）
    const messageStats = await EmailMessage.findAll({
      include: [{
        model: EmailConversation,
        as: 'conversation',
        where: { user_id: userId },
        attributes: []
      }],
      attributes: [
        'direction',
        [require('../models/index').sequelize.fn('COUNT', require('../models/index').sequelize.col('EmailMessage.id')), 'count']
      ],
      group: ['direction'],
      raw: true
    });

    // 最近7天的回复趋势
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentMessages = await EmailMessage.count({
      include: [{
        model: EmailConversation,
        as: 'conversation',
        where: { user_id: userId },
        attributes: []
      }],
      where: {
        received_at: {
          [Op.gte]: sevenDaysAgo
        }
      }
    });

    res.status(200).json({
      success: true,
      message: '获取回复统计成功',
      data: {
        conversations: conversationStats,
        messages: messageStats,
        recent_messages_7days: recentMessages
      }
    });
  });
}

module.exports = EmailReplyController; 