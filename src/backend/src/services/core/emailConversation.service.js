const { EmailConversation, EmailMessage, User, Sender, EmailService } = require('../../models');
const { sequelize } = require('../../models');
const { Op } = require('sequelize');
const logger = require('../../utils/logger');
const { AppError } = require('../../utils/errorHandler');

class EmailConversationService {
  /**
   * 创建新会话
   */
  async createConversation(conversationData) {
    const transaction = await sequelize.transaction();
    
    try {
      const {
        subject,
        participants,
        email_service_id,
        initial_message,
        user_id
      } = conversationData;

      // 生成会话key
      const senderEmail = participants[0]; // 第一个参与者作为发送者
      const recipientEmail = participants[1] || participants[0]; // 第二个参与者作为接收者
      const conversationKey = `${senderEmail}:${recipientEmail}`;

      // 创建会话
      const conversation = await EmailConversation.create({
        conversation_key: conversationKey,
        user_id,
        sender_email: senderEmail,
        recipient_email: recipientEmail,
        subject,
        status: 'active',
        email_service_id,
        last_message_at: new Date(),
        message_count: 0,
        unread_count: 0
      }, { transaction });

      // 如果有初始消息，创建消息记录
      if (initial_message) {
        const message = await EmailMessage.create({
          conversation_id: conversation.id,
          direction: 'outbound',
          from_email: senderEmail,
          to_email: initial_message.to_email || recipientEmail,
          subject,
          body: initial_message.body,
          html_body: initial_message.html_body,
          status: 'sent',
          sent_at: new Date(),
          message_id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }, { transaction });

        // 更新会话统计
        await conversation.update({
          message_count: 1,
          last_message_at: new Date()
        }, { transaction });
      }

      await transaction.commit();

      // 重新获取完整的会话信息
      const result = await EmailConversation.findByPk(conversation.id, {
        include: [{
          model: EmailMessage,
          as: 'messages',
          order: [['sent_at', 'ASC']]
        }]
      });

      logger.info(`✅ 创建会话成功: ${conversation.id}`);
      return result;

    } catch (error) {
      await transaction.rollback();
      logger.error(`创建会话失败:`, error);
      throw error;
    }
  }

  /**
   * 处理入站邮件（回复）
   */
  async handleInboundEmail(emailData) {
    const transaction = await sequelize.transaction();
    
    try {
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
        custom_args,
        received_at
      } = emailData;

      // 1. 根据发信人邮箱匹配用户账号
      const user = await this.findUserByEmail(to_email);
      if (!user) {
        logger.warn(`未找到匹配的用户账号: ${to_email}`);
        return null;
      }

      // 2. 查找或创建会话
      const conversation = await this.findOrCreateConversation({
        user_id: user.id,
        sender_email: to_email,
        sender_name: to_name,
        recipient_email: from_email,
        recipient_name: from_name,
        subject: this.cleanSubject(subject)
      }, transaction);

      // 3. 创建入站消息记录
      const message = await EmailMessage.create({
        conversation_id: conversation.id,
        direction: 'inbound',
        message_id,
        in_reply_to,
        references,
        from_email,
        from_name,
        to_email,
        to_name,
        subject,
        content_text,
        content_html,
        status: 'read',
        sent_at: received_at,
        delivered_at: received_at,
        read_at: received_at
      }, { transaction });

      // 4. 更新会话统计
      await this.updateConversationStats(conversation.id, transaction);

      await transaction.commit();

      logger.info(`✅ 邮件回复处理完成`, {
        conversation_id: conversation.id,
        message_id: message.id,
        from: from_email,
        to: to_email
      });

      return {
        conversation,
        message
      };

    } catch (error) {
      await transaction.rollback();
      logger.error(`处理入站邮件失败:`, error);
      throw error;
    }
  }

  /**
   * 根据邮箱地址查找用户
   */
  async findUserByEmail(email) {
    // 首先直接通过User表的email字段查找
    const user = await User.findOne({
      where: { email }
    });

    if (user) {
      return user;
    }

    // 如果User表没找到，尝试通过EmailService的域名匹配
    const domain = email.split('@')[1];
    const emailService = await EmailService.findOne({
      where: {
        domain: domain
      }
    });

    if (emailService) {
      // 返回第一个管理员用户作为默认用户
      const adminUser = await User.findOne({
        where: { role: 'admin' }
      });
      return adminUser;
    }

    return null;
  }

  /**
   * 查找或创建会话
   */
  async findOrCreateConversation(conversationData, transaction) {
    const conversationKey = `${conversationData.sender_email}:${conversationData.recipient_email}`;
    
    let conversation = await EmailConversation.findOne({
      where: { conversation_key: conversationKey },
      transaction
    });

    if (!conversation) {
      // 获取发信服务信息（通过域名匹配）
      const domain = conversationData.sender_email.split('@')[1];
      const emailService = await EmailService.findOne({
        where: {
          domain: domain
        }
      });

      conversation = await EmailConversation.create({
        ...conversationData,
        conversation_key: conversationKey,
        email_service_id: emailService?.id,
        api_user: emailService?.api_user,
        status: 'active',
        last_message_at: new Date(),
        message_count: 0,
        unread_count: 0
      }, { transaction });
    }

    return conversation;
  }

  /**
   * 更新会话统计
   */
  async updateConversationStats(conversationId, transaction) {
    const stats = await EmailMessage.findOne({
      where: { conversation_id: conversationId },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_messages'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status != 'read' THEN 1 END")), 'unread_messages'],
        [sequelize.fn('MAX', sequelize.col('sent_at')), 'last_message_time']
      ],
      transaction,
      raw: true
    });

    await EmailConversation.update({
      message_count: parseInt(stats.total_messages) || 0,
      unread_count: parseInt(stats.unread_messages) || 0,
      last_message_at: stats.last_message_time || new Date()
    }, {
      where: { id: conversationId },
      transaction
    });
  }

  /**
   * 清理邮件主题（移除Re:, Fwd:等前缀）
   */
  cleanSubject(subject) {
    if (!subject) return '';
    return subject.replace(/^(Re:|Fwd:|回复:|转发:)\s*/i, '').trim();
  }

  /**
   * 发送回复邮件
   */
  async sendReply(conversationId, replyData, userId) {
    const transaction = await sequelize.transaction();
    
    try {
      // 1. 获取会话信息
      const conversation = await EmailConversation.findOne({
        where: { 
          id: conversationId,
          user_id: userId 
        },
        include: [{
          model: EmailService,
          as: 'emailService'
        }]
      });

      if (!conversation) {
        throw new AppError('会话不存在', 404);
      }

      // 2. 创建出站消息记录
      const message = await EmailMessage.create({
        conversation_id: conversationId,
        direction: 'outbound',
        from_email: conversation.sender_email,
        from_name: conversation.sender_name,
        to_email: conversation.recipient_email,
        to_name: conversation.recipient_name,
        subject: replyData.subject || `Re: ${conversation.subject}`,
        content_text: replyData.content_text,
        content_html: replyData.content_html,
        status: 'pending'
      }, { transaction });

      // 3. 使用邮件服务发送邮件
      const MailService = require('../third-party/mail.service');
      
      const mailService = new MailService({
        api_key: conversation.emailService.api_key,
        api_secret: conversation.emailService.api_secret,
        domain: conversation.emailService.domain,
        name: conversation.emailService.name
      });

      const mailOptions = mailService.buildMailOptions({
        from: conversation.sender_email,
        to: [conversation.recipient_email],
        subject: message.subject,
        html: message.content_html || message.content_text,
          text: message.content_text,
        openTracking: true,
        clickTracking: true,
        customArgs: {
          conversation_id: conversationId,
          message_id: message.id,
          is_reply: true
        },
        requestId: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      });

      const sendResult = await mailService.sendMail(mailOptions);

      // 4. 更新消息状态
      await message.update({
        status: 'sent',
        sent_at: new Date(),
        engagelab_email_id: sendResult.email_id || sendResult.id,
        engagelab_message_id: sendResult.message_id || sendResult.messageId
      }, { transaction });

      // 5. 更新会话统计
      await this.updateConversationStats(conversationId, transaction);

      await transaction.commit();

      logger.info(`✅ 回复邮件发送成功`, {
        conversation_id: conversationId,
        message_id: message.id,
        to: conversation.recipient_email
      });

      return message;

    } catch (error) {
      await transaction.rollback();
      logger.error(`发送回复邮件失败:`, error);
      throw error;
    }
  }

  /**
   * 获取用户的会话列表
   */
  async getConversations(userId, options = {}) {
    const {
      page = 1,
      limit = 20,
      status = 'active',
      search = ''
    } = options;

    const offset = (page - 1) * limit;
    const where = { user_id: userId };

    if (status) {
      where.status = status;
    }

    if (search) {
      where[Op.or] = [
        { recipient_email: { [Op.iLike]: `%${search}%` } },
        { recipient_name: { [Op.iLike]: `%${search}%` } },
        { subject: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows } = await EmailConversation.findAndCountAll({
      where,
      include: [{
        model: EmailMessage,
        as: 'messages',
        limit: 1,
        order: [['sent_at', 'DESC']],
        attributes: ['id', 'content_text', 'content_html', 'sent_at', 'direction']
      }],
      order: [['last_message_at', 'DESC']],
      limit,
      offset
    });

    return {
      conversations: rows,
      pagination: {
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit)
      }
    };
  }

  /**
   * 获取会话详情和消息列表
   */
  async getConversationDetail(conversationId, userId, options = {}) {
    const {
      page = 1,
      limit = 50
    } = options;

    const conversation = await EmailConversation.findOne({
      where: { 
        id: conversationId,
        user_id: userId 
      }
    });

    if (!conversation) {
      throw new AppError('会话不存在', 404);
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await EmailMessage.findAndCountAll({
      where: { conversation_id: conversationId },
      order: [['sent_at', 'ASC']],
      limit,
      offset
    });

    // 标记消息为已读
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
    await this.updateConversationStats(conversationId);

    return {
      conversation,
      messages: rows,
      pagination: {
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit)
      }
    };
  }
}

module.exports = new EmailConversationService(); 