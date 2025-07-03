const { User, Sender, Contact, EmailConversation, EmailMessage, SubTask, Task } = require('../../models/index');
const logger = require('../../utils/logger');
const { Op } = require('sequelize');

/**
 * 邮件回复处理服务
 * 负责处理收到的邮件回复，识别用户，管理会话
 */
class EmailReplyService {

  /**
   * 处理收到的邮件回复
   * @param {Object} emailData 邮件数据
   * @param {string} emailData.to 收件人地址 (sender@domain格式)
   * @param {string} emailData.from 发件人地址
   * @param {string} emailData.subject 邮件主题
   * @param {string} emailData.body 邮件内容
   * @param {Date} emailData.received_at 接收时间
   * @param {Object} emailData.headers 邮件头信息
   */
  async processEmailReply(emailData) {
    try {
      logger.info('📬 处理邮件回复', {
        to: emailData.to,
        from: emailData.from,
        subject: emailData.subject
      });

      // 1. 识别用户和发送者
      const userInfo = await this.identifyUserFromSenderEmail(emailData.to);
      if (!userInfo) {
        logger.warn('⚠️ 无法识别用户，丢弃邮件回复', { to: emailData.to });
        return { success: false, message: '无法识别用户' };
      }

      // 2. 查找或创建联系人
      const contact = await this.findOrCreateContact(emailData.from, userInfo.user.id);

      // 3. 查找或创建邮件会话
      const conversation = await this.findOrCreateConversation(
        userInfo.user.id,
        contact.id,
        userInfo.sender.id,
        emailData.to
      );

      // 4. 创建邮件消息记录
      const message = await this.createEmailMessage(conversation.id, emailData, 'received');

      // 5. 更新会话状态
      await this.updateConversationStatus(conversation.id, message);

      logger.info('✅ 邮件回复处理完成', {
        userId: userInfo.user.id,
        contactId: contact.id,
        conversationId: conversation.id,
        messageId: message.id
      });

      return {
        success: true,
        data: {
          user: userInfo.user,
          contact,
          conversation,
          message
        }
      };

    } catch (error) {
      logger.error('❌ 邮件回复处理失败', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 通过sender@domain格式识别用户
   * @param {string} senderEmail sender@domain格式的邮件地址
   * @returns {Object|null} 用户和发送者信息
   */
  async identifyUserFromSenderEmail(senderEmail) {
    try {
      const [senderName, domain] = senderEmail.split('@');

      if (!senderName || !domain) {
        return null;
      }

      // 查找sender
      const sender = await Sender.findOne({
        where: { name: senderName },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'email', 'username', 'first_name', 'last_name']
          }
        ]
      });

      if (!sender || !sender.user) {
        logger.warn('⚠️ 未找到对应的Sender或User', { senderName, domain });
        return null;
      }

      // 验证domain是否匹配（可选，根据业务需求）
      // 这里暂时跳过domain验证，因为一个sender可能对应多个domain

      return {
        user: sender.user,
        sender: sender,
        senderName,
        domain
      };

    } catch (error) {
      logger.error('❌ 用户识别失败', error);
      return null;
    }
  }

  /**
   * 查找或创建联系人
   * @param {string} emailAddress 联系人邮件地址
   * @param {string} userId 用户ID
   * @returns {Object} 联系人对象
   */
  async findOrCreateContact(emailAddress, userId) {
    try {
      let contact = await Contact.findOne({
        where: {
          email: emailAddress,
          user_id: userId
        }
      });

      if (!contact) {
        // 从邮件地址解析姓名
        const [localPart] = emailAddress.split('@');
        const displayName = localPart.replace(/[._-]/g, ' ');

        contact = await Contact.create({
          email: emailAddress,
          first_name: displayName,
          last_name: '',
          user_id: userId,
          status: 'active',
          source: 'email_reply',
          tags: ['email_reply_contact']
        });

        logger.info('📝 创建新联系人', {
          contactId: contact.id,
          email: emailAddress,
          userId
        });
      }

      return contact;

    } catch (error) {
      logger.error('❌ 联系人创建失败', error);
      throw error;
    }
  }

  /**
   * 查找或创建邮件会话
   * @param {string} userId 用户ID
   * @param {string} contactId 联系人ID
   * @param {string} senderId 发送者ID
   * @param {string} senderEmail 发送者邮件地址
   * @returns {Object} 会话对象
   */
  async findOrCreateConversation(userId, contactId, senderId, senderEmail) {
    try {
      let conversation = await EmailConversation.findOne({
        where: {
          user_id: userId,
          contact_id: contactId,
          sender_email: senderEmail,
          status: { [Op.in]: ['active', 'paused'] }
        },
        order: [['updated_at', 'DESC']]
      });

      if (!conversation) {
        conversation = await EmailConversation.create({
          user_id: userId,
          contact_id: contactId,
          sender_id: senderId,
          sender_email: senderEmail,
          subject: '邮件回复会话',
          status: 'active',
          total_messages: 0,
          last_message_at: new Date(),
          metadata: {
            created_from: 'email_reply',
            auto_created: true
          }
        });

        logger.info('🗨️ 创建新邮件会话', {
          conversationId: conversation.id,
          userId,
          contactId,
          senderEmail
        });
      }

      return conversation;

    } catch (error) {
      logger.error('❌ 会话创建失败', error);
      throw error;
    }
  }

  /**
   * 创建邮件消息记录
   * @param {string} conversationId 会话ID
   * @param {Object} emailData 邮件数据
   * @param {string} direction 方向: 'sent' | 'received'
   * @returns {Object} 消息对象
   */
  async createEmailMessage(conversationId, emailData, direction = 'received') {
    try {
      const message = await EmailMessage.create({
        conversation_id: conversationId,
        direction: direction,
        subject: emailData.subject,
        body_text: emailData.body,
        body_html: emailData.html || emailData.body,
        from_email: emailData.from,
        to_email: emailData.to,
        message_id: emailData.messageId || emailData.message_id,
        status: 'received',
        received_at: emailData.received_at || new Date(),
        metadata: {
          headers: emailData.headers,
          raw_email: emailData.raw,
          processed_at: new Date().toISOString()
        }
      });

      logger.info('📧 创建邮件消息', {
        messageId: message.id,
        conversationId,
        direction,
        subject: emailData.subject
      });

      return message;

    } catch (error) {
      logger.error('❌ 邮件消息创建失败', error);
      throw error;
    }
  }

  /**
   * 更新会话状态
   * @param {string} conversationId 会话ID
   * @param {Object} message 最新消息
   */
  async updateConversationStatus(conversationId, message) {
    try {
      const conversation = await EmailConversation.findByPk(conversationId);
      if (!conversation) return;

      await conversation.update({
        total_messages: conversation.total_messages + 1,
        last_message_at: message.received_at || new Date(),
        last_message_subject: message.subject,
        updated_at: new Date()
      });

      logger.info('🔄 更新会话状态', {
        conversationId,
        totalMessages: conversation.total_messages + 1
      });

    } catch (error) {
      logger.error('❌ 会话状态更新失败', error);
    }
  }

  /**
   * 发送回复邮件（使用相同的发信地址）
   * @param {string} conversationId 会话ID
   * @param {Object} replyData 回复数据
   * @param {string} replyData.subject 回复主题
   * @param {string} replyData.body 回复内容
   * @param {string} userId 用户ID
   */
  async sendReply(conversationId, replyData, userId) {
    try {
      const conversation = await EmailConversation.findByPk(conversationId, {
        include: [
          { model: Contact, as: 'contact' },
          { model: Sender, as: 'sender' }
        ]
      });

      if (!conversation) {
        throw new Error('会话不存在');
      }

      if (conversation.user_id !== userId) {
        throw new Error('无权限操作此会话');
      }

      // 使用会话中相同的发信地址发送回复
      const mailOptions = {
        from: conversation.sender_email,
        to: conversation.contact.email,
        subject: replyData.subject,
        html: replyData.body,
        text: replyData.body.replace(/<[^>]*>/g, ''),
        customArgs: {
          conversation_id: conversationId,
          user_id: userId,
          type: 'reply'
        }
      };

      // 这里需要调用邮件发送服务
      // const sendResult = await MailService.sendMail(mailOptions);

      // 创建发送消息记录
      const message = await this.createEmailMessage(conversationId, {
        from: conversation.sender_email,
        to: conversation.contact.email,
        subject: replyData.subject,
        body: replyData.body,
        received_at: new Date()
      }, 'sent');

      // 更新会话状态
      await this.updateConversationStatus(conversationId, message);

      logger.info('📤 发送回复邮件', {
        conversationId,
        messageId: message.id,
        from: conversation.sender_email,
        to: conversation.contact.email
      });

      return {
        success: true,
        message: message,
        conversation: conversation
      };

    } catch (error) {
      logger.error('❌ 发送回复失败', error);
      throw error;
    }
  }

  /**
   * 获取用户的邮件会话列表
   * @param {string} userId 用户ID
   * @param {Object} options 查询选项
   * @returns {Object} 会话列表
   */
  async getUserConversations(userId, options = {}) {
    const {
      page = 1,
      limit = 20,
      status = 'active',
      search = ''
    } = options;

    const where = { user_id: userId };

    if (status !== 'all') {
      where.status = status;
    }

    if (search) {
      where[Op.or] = [
        { subject: { [Op.iLike]: `%${search}%` } },
        { '$contact.email$': { [Op.iLike]: `%${search}%` } }
      ];
    }

    const conversations = await EmailConversation.findAndCountAll({
      where,
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
      ],
      order: [['last_message_at', 'DESC']],
      limit: parseInt(limit),
      offset: (page - 1) * limit
    });

    return {
      conversations: conversations.rows,
      total: conversations.count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(conversations.count / limit)
    };
  }
}

module.exports = EmailReplyService; 