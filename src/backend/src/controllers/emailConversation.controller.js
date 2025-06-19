const emailConversationService = require('../services/core/emailConversation.service');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

  /**
   * 获取会话列表
   * GET /api/conversations
   */
const getConversations = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      status,
      search
    } = req.query;

  const result = await emailConversationService.getConversations(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      search
    });

    res.status(200).json({
      success: true,
      data: result
    });
  });

/**
 * 创建新会话
 * POST /api/conversations
 */
const createConversation = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const {
    subject,
    participants,
    email_service_id,
    initial_message
  } = req.body;

  const result = await emailConversationService.createConversation({
    subject,
    participants,
    email_service_id,
    initial_message,
    user_id: userId
  });

  res.status(201).json({
    success: true,
    message: '会话创建成功',
    data: result
  });
});

  /**
   * 获取会话详情
   * GET /api/conversations/:id
   */
const getConversationDetail = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const conversationId = req.params.id;
    const {
      page = 1,
      limit = 50
    } = req.query;

  const result = await emailConversationService.getConversationDetail(
      conversationId,
      userId,
      {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    );

    res.status(200).json({
      success: true,
      data: result
    });
  });

  /**
   * 发送回复
   * POST /api/conversations/:id/reply
   */
const sendReply = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const conversationId = req.params.id;
    const {
      subject,
      content_text,
      content_html
    } = req.body;

    if (!content_text && !content_html) {
      throw new AppError('邮件内容不能为空', 400);
    }

  const message = await emailConversationService.sendReply(
      conversationId,
      {
        subject,
        content_text,
        content_html
      },
      userId
    );

    res.status(201).json({
      success: true,
      message: '回复发送成功',
      data: message
    });
  });

  /**
   * 更新会话状态
   * PATCH /api/conversations/:id/status
   */
const updateConversationStatus = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const conversationId = req.params.id;
    const { status } = req.body;

    if (!['active', 'closed', 'archived'].includes(status)) {
      throw new AppError('无效的会话状态', 400);
    }

    const { EmailConversation } = require('../models');
    
    const [updatedRows] = await EmailConversation.update(
      { status },
      {
        where: {
          id: conversationId,
          user_id: userId
        }
      }
    );

    if (updatedRows === 0) {
      throw new AppError('会话不存在', 404);
    }

    res.status(200).json({
      success: true,
      message: '会话状态更新成功'
    });
  });

  /**
   * 标记会话为已读
   * POST /api/conversations/:id/mark-read
   */
const markAsRead = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const conversationId = req.params.id;

    const { EmailConversation, EmailMessage } = require('../models');
    
    // 验证会话所有权
    const conversation = await EmailConversation.findOne({
      where: {
        id: conversationId,
        user_id: userId
      }
    });

    if (!conversation) {
      throw new AppError('会话不存在', 404);
    }

    // 标记所有未读消息为已读
  const { Op } = require('sequelize');
    await EmailMessage.update({
      status: 'read',
      read_at: new Date()
    }, {
      where: {
        conversation_id: conversationId,
        direction: 'inbound',
      status: { [Op.ne]: 'read' }
      }
    });

    // 更新会话未读计数
    await EmailConversation.update({
      unread_count: 0
    }, {
      where: { id: conversationId }
    });

    res.status(200).json({
      success: true,
      message: '已标记为已读'
    });
  });

  /**
   * 获取会话统计
   * GET /api/conversations/stats
   */
const getConversationStats = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { EmailConversation } = require('../models');
    const { sequelize } = require('../models');

    const stats = await EmailConversation.findAll({
      where: { user_id: userId },
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('unread_count')), 'total_unread']
      ],
      group: ['status'],
      raw: true
    });

    const result = {
      total: 0,
      active: 0,
      closed: 0,
      archived: 0,
      total_unread: 0
    };

    stats.forEach(stat => {
      result[stat.status] = parseInt(stat.count);
      result.total += parseInt(stat.count);
      result.total_unread += parseInt(stat.total_unread) || 0;
    });

    res.status(200).json({
      success: true,
      data: result
    });
  });

module.exports = {
  getConversations,
  createConversation,
  getConversationDetail,
  sendReply,
  updateConversationStatus,
  markAsRead,
  getConversationStats
}; 