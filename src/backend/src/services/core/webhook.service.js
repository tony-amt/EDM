const { EventLog, SubTask, Task, Contact, User, Sender, EmailConversation, EmailMessage, sequelize } = require('../../models/index');
const { AppError, handleServiceError } = require('../../utils/errorHandler');
const logger = require('../../utils/logger');

class WebhookService {
  /**
   * 统一处理所有webhook事件
   * @param {Object} webhookData - 原始webhook数据
   * @returns {Object} 处理结果
   */
  async processWebhook(webhookData) {
    let transaction;
    try {
      transaction = await sequelize.transaction();

      // 🔧 修复：正确解析EngageLab事件类型
      const eventType = this.determineEventType(webhookData);

      // 🔧 修复：正确解析时间戳（EngageLab使用itime字段）
      let timestamp;
      if (webhookData.itime) {
        // EngageLab使用Unix timestamp（毫秒）
        timestamp = new Date(webhookData.itime);
      } else if (webhookData.timestamp) {
        timestamp = new Date(webhookData.timestamp * 1000);
      } else {
        timestamp = new Date();
      }

      // 验证时间戳有效性
      if (isNaN(timestamp.getTime())) {
        logger.warn('时间戳解析失败，使用当前时间', {
          originalTimestamp: webhookData.itime || webhookData.timestamp
        });
        timestamp = new Date();
      }

      // 🔧 修复：正确提取message_id和email地址
      const messageId = this.extractMessageId(webhookData);
      const emailAddress = this.extractEmailAddress(webhookData);

      // 1. 记录原始webhook日志
      const eventLog = await EventLog.create({
        event_type: eventType,
        timestamp: timestamp,
        payload: webhookData,
        source: webhookData.source || 'engagelab',
        message_id: messageId,
        email_address: emailAddress,
        provider_event_id: webhookData.status?.status_data?.task_id || webhookData.response?.response_data?.task_id,
        metadata: {
          raw_webhook: webhookData,
          processed_at: new Date()
        }
      }, { transaction });

      logger.info(`📝 Webhook事件已记录`, {
        id: eventLog.id,
        event_type: eventLog.event_type,
        source: eventLog.source,
        message_id: eventLog.message_id
      });

      // 2. 解析关联信息
      const associations = await this.parseAssociations(webhookData, transaction);

      // 3. 更新关联信息到EventLog
      await eventLog.update({
        sub_task_id: associations.subTaskId,
        task_id: associations.taskId,
        user_id: associations.userId,
        contact_id: associations.contactId,
        conversation_id: associations.conversationId
      }, { transaction });

      // 4. 根据事件类型处理业务逻辑 - 修复：基于EngageLab官方文档
      let result = null;

      if (webhookData.status && webhookData.status.message_status) {
        // EngageLab状态事件：target, sent, delivered, invalid_email, soft_bounce
        result = await this.handleStatusEvent(webhookData, associations, transaction);
      } else if (webhookData.response && webhookData.response.event) {
        // EngageLab用户行为事件：open, click, unsubscribe, report_spam, route
        result = await this.handleResponseEvent(webhookData, associations, transaction);
      } else {
        // 兼容旧格式或未知格式
        switch (eventType) {
          case 'delivered':
          case 'bounced':
          case 'spam_report':
          case 'unsubscribe':
            result = await this.handleEmailStatusEvent(webhookData, associations, transaction);
            break;
          case 'opened':
          case 'clicked':
            result = await this.handleEmailStatusEvent(webhookData, associations, transaction);
            break;
          case 'reply':
          case 'inbound':
            result = await this.handleEmailReply(webhookData, associations, transaction);
            break;
          default:
            logger.info(`ℹ️ 未处理的webhook事件类型: ${eventType}`);
            result = { message: `Event type ${eventType} recorded but not processed` };
        }
      }

      // 5. 更新处理状态
      await eventLog.update({
        metadata: {
          ...eventLog.metadata,
          processing_result: result,
          processed_at: new Date()
        }
      }, { transaction });

      await transaction.commit();

      logger.info(`✅ Webhook事件处理完成`, {
        id: eventLog.id,
        event_type: eventType,
        result
      });

      return {
        success: true,
        eventLogId: eventLog.id,
        message: 'Webhook processed successfully',
        result
      };

    } catch (error) {
      if (transaction) await transaction.rollback();

      logger.error(`❌ Webhook处理失败: ${error.message}`, {
        webhookData,
        error: error.stack
      });

      // 记录失败的webhook
      try {
        await EventLog.create({
          event_type: this.determineEventType(webhookData),
          timestamp: new Date(),
          payload: webhookData,
          source: webhookData.source || 'engagelab',
          message_id: this.extractMessageId(webhookData),
          email_address: this.extractEmailAddress(webhookData),
          metadata: {
            error: error.message,
            failed_at: new Date()
          }
        });
      } catch (logError) {
        logger.error(`记录失败webhook时出错: ${logError.message}`);
      }

      throw error;
    }
  }

  /**
   * 🔧 新增：确定EngageLab事件类型
   */
  determineEventType(webhookData) {
    // 状态事件 (delivered, invalid_email等)
    if (webhookData.status && webhookData.status.message_status) {
      const messageStatus = webhookData.status.message_status;
      switch (messageStatus) {
        case 'target':
          return 'target';
        case 'sent':
          return 'sent';
        case 'delivered':
          return 'delivered';
        case 'invalid_email':
          return 'bounced';
        case 'soft_bounce':
          return 'bounced';
        default:
          return messageStatus;
      }
    }

    // 用户行为事件 (open, click等)
    if (webhookData.response && webhookData.response.event) {
      const event = webhookData.response.event;
      switch (event) {
        case 'open':
          return 'opened';
        case 'click':
          return 'clicked';
        case 'unsubscribe':
          return 'unsubscribe';
        case 'report_spam':
          return 'spam_report';
        case 'route':
          return 'reply';
        default:
          return event;
      }
    }

    // 兼容旧格式
    return webhookData.event_type || webhookData.event || webhookData.message_status || 'unknown';
  }

  /**
   * 🔧 新增：提取message_id
   */
  extractMessageId(webhookData) {
    // 直接message_id字段
    if (webhookData.message_id) {
      return webhookData.message_id;
    }

    // 状态事件中的email_id
    if (webhookData.status?.status_data?.email_id) {
      return webhookData.status.status_data.email_id;
    }

    // 用户行为事件中的email_id
    if (webhookData.response?.response_data?.email_id) {
      return webhookData.response.response_data.email_id;
    }

    return null;
  }

  /**
   * 🔧 新增：提取email地址
   */
  extractEmailAddress(webhookData) {
    // 直接to字段
    if (webhookData.to) {
      return webhookData.to;
    }

    // 兼容其他字段
    return webhookData.to_email || webhookData.email || null;
  }

  /**
   * 解析webhook数据中的关联信息 - 修复：支持EngageLab官方格式
   * @param {Object} webhookData - webhook数据
   * @param {Object} transaction - 数据库事务
   * @returns {Object} 解析出的关联信息
   */
  async parseAssociations(webhookData, transaction) {
    const result = {
      subTaskId: null,
      taskId: null,
      userId: null,
      contactId: null,
      conversationId: null
    };

    try {
      // 🔧 修复：方法1 - 通过custom_args.subtask_id查找（最可靠）
      if (webhookData.custom_args && webhookData.custom_args.subtask_id) {
        const subTask = await SubTask.findByPk(webhookData.custom_args.subtask_id, {
          include: [
            { model: Task, as: 'task' },
            { model: Contact, as: 'contact' }
          ],
          transaction
        });

        if (subTask) {
          result.subTaskId = subTask.id;
          result.taskId = subTask.task_id;
          result.contactId = subTask.contact_id;
          result.userId = subTask.task?.user_id;
          logger.info(`✅ 通过custom_args.subtask_id找到SubTask: ${subTask.id}`);
          return result;
        }
      }

      // 🔧 修复：方法2 - 通过message_id查找（EngageLab格式）
      const messageIds = this.extractAllMessageIds(webhookData);
      for (const messageId of messageIds) {
        if (messageId) {
          const subTask = await SubTask.findOne({
            where: {
              email_service_response: {
                [sequelize.Op.like]: `%${messageId}%`
              }
            },
            include: [
              { model: Task, as: 'task' },
              { model: Contact, as: 'contact' }
            ],
            transaction
          });

          if (subTask) {
            result.subTaskId = subTask.id;
            result.taskId = subTask.task_id;
            result.contactId = subTask.contact_id;
            result.userId = subTask.task?.user_id;
            logger.info(`✅ 通过message_id找到SubTask: ${subTask.id}, messageId: ${messageId}`);
            return result;
          }
        }
      }

      // 🔧 修复：方法3 - 通过收件人邮箱查找（兜底方案）
      const emailAddress = this.extractEmailAddress(webhookData);
      if (emailAddress) {
        const subTask = await SubTask.findOne({
          where: {
            recipient_email: emailAddress,
            status: ['sent', 'delivered', 'opened', 'clicked'] // 只查找已发送的
          },
          order: [['sent_at', 'DESC']], // 最近发送的
          include: [
            { model: Task, as: 'task' },
            { model: Contact, as: 'contact' }
          ],
          transaction
        });

        if (subTask) {
          result.subTaskId = subTask.id;
          result.taskId = subTask.task_id;
          result.contactId = subTask.contact_id;
          result.userId = subTask.task?.user_id;
          logger.info(`✅ 通过收件人邮箱找到SubTask: ${subTask.id}, email: ${emailAddress}`);
          return result;
        }
      }

      // 🔧 修复：方法4 - 处理回复事件的特殊逻辑
      if (webhookData.response?.event === 'route') {
        const responseData = webhookData.response.response_data || {};

        // 通过发信邮箱查找用户
        if (responseData.x_mx_rcptto) {
          const user = await this.findUserBySenderEmail(responseData.x_mx_rcptto, transaction);
          if (user) {
            result.userId = user.id;
          }
        }

        // 查找或创建会话
        if (result.userId && responseData.from) {
          const conversation = await this.findOrCreateConversation({
            userId: result.userId,
            contactEmail: responseData.from,
            senderEmail: responseData.x_mx_rcptto,
            subject: responseData.subject
          }, transaction);

          if (conversation) {
            result.conversationId = conversation.id;
          }
        }
      }

      logger.warn(`❌ 未找到关联的SubTask`, {
        custom_args: webhookData.custom_args,
        message_ids: messageIds,
        email_address: emailAddress,
        webhook_type: webhookData.status ? 'status' : (webhookData.response ? 'response' : 'unknown')
      });

      return result;
    } catch (error) {
      logger.error(`解析关联信息失败: ${error.message}`, { webhookData });
      return result;
    }
  }

  /**
   * 🔧 新增：提取所有可能的message_id
   */
  extractAllMessageIds(webhookData) {
    const messageIds = [];

    // 直接message_id字段
    if (webhookData.message_id) {
      messageIds.push(webhookData.message_id);
    }

    // 状态事件中的email_id
    if (webhookData.status?.status_data?.email_id) {
      messageIds.push(webhookData.status.status_data.email_id);
    }

    // 用户行为事件中的email_id
    if (webhookData.response?.response_data?.email_id) {
      messageIds.push(webhookData.response.response_data.email_id);
    }

    // 去重并过滤空值
    return [...new Set(messageIds.filter(id => id))];
  }

  /**
   * 处理邮件状态事件
   * @param {Object} webhookData - webhook数据
   * @param {Object} associations - 关联信息
   * @param {Object} transaction - 数据库事务
   */
  async handleEmailStatusEvent(webhookData, associations, transaction) {
    if (!associations.subTaskId) {
      logger.warn(`无法找到关联的SubTask，跳过状态更新`, {
        message_id: webhookData.message_id,
        event_type: webhookData.event_type
      });
      return { message: 'SubTask not found, status update skipped' };
    }

    const subTask = await SubTask.findByPk(associations.subTaskId, { transaction });
    if (!subTask) {
      throw new AppError('SubTask not found', 404);
    }

    const updateData = {};
    const now = new Date();

    switch (webhookData.event_type) {
      case 'delivered':
        updateData.status = 'delivered';
        updateData.delivered_at = now;
        break;
      case 'opened':
        updateData.status = 'opened';
        updateData.opened_at = now;
        break;
      case 'clicked':
        updateData.status = 'clicked';
        updateData.clicked_at = now;
        break;
      case 'bounced':
        updateData.status = 'bounced';
        updateData.bounced_at = now;
        updateData.bounce_reason = webhookData.bounce_reason || '';
        break;
      case 'spam_report':
        updateData.status = 'spam';
        updateData.complained_at = now;
        break;
      case 'unsubscribe':
        updateData.status = 'unsubscribed';
        updateData.unsubscribed_at = now;
        break;
    }

    if (Object.keys(updateData).length > 0) {
      await subTask.update(updateData, { transaction });

      // 更新任务统计
      if (associations.taskId) {
        await this.updateTaskStats(associations.taskId, transaction);
      }
    }

    return {
      message: `SubTask status updated to ${updateData.status}`,
      subTaskId: associations.subTaskId,
      taskId: associations.taskId
    };
  }

  /**
   * 处理邮件回复事件
   * @param {Object} webhookData - webhook数据
   * @param {Object} associations - 关联信息
   * @param {Object} transaction - 数据库事务
   */
  async handleEmailReply(webhookData, associations, transaction) {
    if (!associations.userId) {
      logger.warn(`无法识别用户，跳过回复处理`, {
        sender_email: webhookData.sender_email,
        from_email: webhookData.from_email
      });
      return { message: 'User not identified, reply processing skipped' };
    }

    // 创建回复消息记录
    const replyMessage = await EmailMessage.create({
      conversation_id: associations.conversationId,
      direction: 'inbound',
      from_email: webhookData.from_email,
      to_email: webhookData.sender_email,
      subject: webhookData.subject,
      body: webhookData.body || '',
      received_at: new Date()
    }, { transaction });

    // 更新会话最后回复时间
    if (associations.conversationId) {
      const conversation = await EmailConversation.findByPk(associations.conversationId, { transaction });
      if (conversation) {
        await conversation.update({
          last_message_at: new Date(),
          message_count: conversation.message_count + 1
        }, { transaction });
      }
    }

    return {
      message: 'Email reply processed',
      messageId: replyMessage.id,
      conversationId: associations.conversationId,
      userId: associations.userId
    };
  }

  /**
   * 通过sender邮箱格式识别用户
   * @param {string} senderEmail - sender@domain格式的邮箱
   * @param {Object} transaction - 数据库事务
   */
  async findUserBySenderEmail(senderEmail, transaction) {
    try {
      if (!senderEmail || !senderEmail.includes('@')) {
        return null;
      }

      const [senderName] = senderEmail.split('@');

      const sender = await Sender.findOne({
        where: { name: senderName },
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'username']
        }],
        transaction
      });

      return sender?.user || null;
    } catch (error) {
      logger.error(`查找用户失败: ${error.message}`, { senderEmail });
      return null;
    }
  }

  /**
   * 查找或创建邮件会话
   * @param {Object} params - 参数
   * @param {Object} transaction - 数据库事务
   */
  async findOrCreateConversation(params, transaction) {
    const { userId, contactEmail, senderEmail, subject } = params;

    try {
      let conversation = await EmailConversation.findOne({
        where: {
          user_id: userId,
          contact_email: contactEmail
        },
        transaction
      });

      if (!conversation) {
        conversation = await EmailConversation.create({
          user_id: userId,
          contact_email: contactEmail,
          sender_email: senderEmail,
          subject: subject || 'Email Reply',
          message_count: 0,
          last_message_at: new Date()
        }, { transaction });
      }

      return conversation;
    } catch (error) {
      logger.error(`查找或创建会话失败: ${error.message}`, params);
      return null;
    }
  }

  /**
   * 更新任务统计信息
   * @param {string} taskId - 任务ID
   * @param {Object} transaction - 数据库事务
   */
  async updateTaskStats(taskId, transaction) {
    try {
      const task = await Task.findByPk(taskId, { transaction });
      if (!task) return;

      // 重新计算统计数据
      const statusCounts = await SubTask.findAll({
        where: { task_id: taskId },
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['status'],
        transaction
      });

      const stats = {
        total_recipients: 0,
        pending: 0,
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        failed: 0,
        spam: 0,
        unsubscribed: 0
      };

      statusCounts.forEach(item => {
        const status = item.getDataValue('status');
        const count = parseInt(item.getDataValue('count'), 10);
        if (stats.hasOwnProperty(status)) {
          stats[status] = count;
        }
        stats.total_recipients += count;
      });

      await task.update({
        summary_stats: stats
      }, { transaction });

      logger.info(`任务统计已更新`, { taskId, stats });
    } catch (error) {
      logger.error(`更新任务统计失败: ${error.message}`, { taskId });
    }
  }

  /**
   * 🔧 新增：处理EngageLab状态事件
   */
  async handleStatusEvent(webhookData, associations, transaction) {
    try {
      const messageStatus = webhookData.status.message_status;
      const statusData = webhookData.status.status_data || {};
      const errorDetail = webhookData.status.error_detail || null;

      logger.info(`📬 处理EngageLab状态事件: ${messageStatus}`, {
        subTaskId: associations.subTaskId,
        messageStatus,
        statusData
      });

      if (!associations.subTaskId) {
        return { action: 'no_subtask', message_status: messageStatus };
      }

      const subTask = await SubTask.findByPk(associations.subTaskId, { transaction });
      if (!subTask) {
        return { action: 'subtask_not_found', message_status: messageStatus };
      }

      // 根据状态更新SubTask
      const updateData = { updated_at: new Date() };
      let actionTaken = 'status_updated';

      switch (messageStatus) {
        case 'target':
          // 邮件请求成功，通常不需要更新SubTask状态
          actionTaken = 'target_confirmed';
          break;

        case 'sent':
          // 邮件从EngageLab成功投出，通常SubTask已经是sent状态
          actionTaken = 'sent_confirmed';
          break;

        case 'delivered':
          updateData.status = 'delivered';
          updateData.delivered_at = new Date(webhookData.itime);
          actionTaken = 'marked_delivered';
          break;

        case 'invalid_email':
          updateData.status = 'bounced';
          updateData.bounced_at = new Date(webhookData.itime);
          updateData.bounce_type = 'hard';
          updateData.bounce_reason = errorDetail ?
            `${errorDetail.message} (${errorDetail.sub_stat})` :
            'Invalid email address';
          actionTaken = 'marked_bounced';

          // 标记联系人邮箱无效
          if (associations.contactId) {
            await this.markContactEmailInvalid(associations.contactId, updateData.bounce_reason, transaction);
          }
          break;

        case 'soft_bounce':
          updateData.status = 'bounced';
          updateData.bounced_at = new Date(webhookData.itime);
          updateData.bounce_type = 'soft';
          updateData.bounce_reason = errorDetail ?
            `${errorDetail.message} (${errorDetail.sub_stat})` :
            'Temporary delivery failure';
          actionTaken = 'marked_soft_bounced';
          break;

        default:
          logger.info(`未处理的状态事件: ${messageStatus}`, { subTaskId: associations.subTaskId });
          actionTaken = 'logged_only';
          return { action: actionTaken, message_status: messageStatus };
      }

      // 更新SubTask（如果有需要更新的字段）
      if (Object.keys(updateData).length > 1) {
        await subTask.update(updateData, { transaction });
        logger.info(`✅ SubTask状态已更新`, {
          subTaskId: subTask.id,
          oldStatus: subTask.status,
          newStatus: updateData.status,
          actionTaken
        });

        // 更新任务统计
        if (associations.taskId) {
          await this.updateTaskStats(associations.taskId, transaction);
        }
      }

      return {
        action: actionTaken,
        message_status: messageStatus,
        sub_task_status: updateData.status || subTask.status
      };

    } catch (error) {
      logger.error(`处理EngageLab状态事件失败: ${error.message}`, {
        webhookData,
        error: error.stack
      });
      throw error;
    }
  }

  /**
   * 🔧 新增：处理EngageLab用户行为事件
   */
  async handleResponseEvent(webhookData, associations, transaction) {
    try {
      const responseEvent = webhookData.response.event;
      const responseData = webhookData.response.response_data || {};

      logger.info(`👥 处理EngageLab用户行为事件: ${responseEvent}`, {
        subTaskId: associations.subTaskId,
        responseEvent,
        responseData
      });

      if (!associations.subTaskId) {
        return { action: 'no_subtask', response_event: responseEvent };
      }

      const subTask = await SubTask.findByPk(associations.subTaskId, { transaction });
      if (!subTask) {
        return { action: 'subtask_not_found', response_event: responseEvent };
      }

      // 根据用户行为更新SubTask
      const updateData = { updated_at: new Date() };
      let actionTaken = 'user_action_recorded';

      switch (responseEvent) {
        case 'open':
          // 如果当前状态还是sent，更新为opened
          if (subTask.status === 'sent' || subTask.status === 'delivered') {
            updateData.status = 'opened';
            updateData.opened_at = new Date(webhookData.itime);
            actionTaken = 'marked_opened';
          } else {
            actionTaken = 'open_recorded';
          }
          break;

        case 'click':
          // 点击是比打开更强的信号，更新状态
          if (['sent', 'delivered', 'opened'].includes(subTask.status)) {
            updateData.status = 'clicked';
            updateData.clicked_at = new Date(webhookData.itime);
            updateData.click_data = JSON.stringify({
              url: responseData.url || '',
              ip: responseData.ip || '',
              explorer_name: responseData.explorer_name || '',
              os_name: responseData.os_name || '',
              timestamp: new Date(webhookData.itime)
            });
            actionTaken = 'marked_clicked';
          } else {
            actionTaken = 'click_recorded';
          }
          break;

        case 'unsubscribe':
          updateData.status = 'unsubscribed';
          updateData.unsubscribed_at = new Date(webhookData.itime);
          actionTaken = 'marked_unsubscribed';

          // 标记联系人为退订
          if (associations.contactId) {
            await this.markContactAsUnsubscribed(associations.contactId, `engagelab_${responseEvent}`, transaction);
          }
          break;

        case 'report_spam':
          updateData.status = 'complained';
          updateData.complained_at = new Date(webhookData.itime);
          actionTaken = 'marked_complained';

          // 标记联系人为垃圾邮件举报者
          if (associations.contactId) {
            await this.markContactAsSpamReporter(associations.contactId, `engagelab_${responseEvent}`, transaction);
          }
          break;

        case 'route':
          // 邮件回复事件，记录但不改变发送状态
          actionTaken = 'route_recorded';
          logger.info(`📧 邮件回复事件: SubTask ${associations.subTaskId}`, {
            subject: responseData.subject,
            from: responseData.from,
            from_name: responseData.from_name
          });

          // 处理邮件回复
          if (associations.userId) {
            await this.handleEmailReply(webhookData, associations, transaction);
          }
          break;

        default:
          logger.info(`未处理的用户行为事件: ${responseEvent}`, { subTaskId: associations.subTaskId });
          actionTaken = 'logged_only';
          return { action: actionTaken, response_event: responseEvent };
      }

      // 更新SubTask（如果有需要更新的字段）
      if (Object.keys(updateData).length > 1) {
        await subTask.update(updateData, { transaction });
        logger.info(`✅ SubTask状态已更新`, {
          subTaskId: subTask.id,
          oldStatus: subTask.status,
          newStatus: updateData.status,
          actionTaken
        });

        // 更新任务统计
        if (associations.taskId) {
          await this.updateTaskStats(associations.taskId, transaction);
        }
      }

      return {
        action: actionTaken,
        response_event: responseEvent,
        sub_task_status: updateData.status || subTask.status
      };

    } catch (error) {
      logger.error(`处理EngageLab用户行为事件失败: ${error.message}`, {
        webhookData,
        error: error.stack
      });
      throw error;
    }
  }

  /**
   * 🔧 新增：标记联系人邮箱无效
   */
  async markContactEmailInvalid(contactId, reason, transaction) {
    try {
      const contact = await Contact.findByPk(contactId, { transaction });
      if (contact) {
        await contact.update({
          email_status: 'invalid',
          email_invalid_reason: reason,
          updated_at: new Date()
        }, { transaction });

        logger.info(`📧 联系人邮箱已标记为无效: ${contact.email}`, {
          contactId,
          reason
        });
      }
    } catch (error) {
      logger.error(`标记联系人邮箱无效失败: ${error.message}`, { contactId, reason });
    }
  }

  /**
   * 🔧 新增：标记联系人为退订
   */
  async markContactAsUnsubscribed(contactId, source, transaction) {
    try {
      const contact = await Contact.findByPk(contactId, { transaction });
      if (contact) {
        await contact.update({
          email_status: 'unsubscribed',
          unsubscribed_at: new Date(),
          unsubscribed_source: source,
          updated_at: new Date()
        }, { transaction });

        logger.info(`📧 联系人已标记为退订: ${contact.email}`, {
          contactId,
          source
        });
      }
    } catch (error) {
      logger.error(`标记联系人退订失败: ${error.message}`, { contactId, source });
    }
  }

  /**
   * 🔧 新增：标记联系人为垃圾邮件举报者
   */
  async markContactAsSpamReporter(contactId, source, transaction) {
    try {
      const contact = await Contact.findByPk(contactId, { transaction });
      if (contact) {
        await contact.update({
          email_status: 'complained',
          complained_at: new Date(),
          complained_source: source,
          updated_at: new Date()
        }, { transaction });

        logger.info(`📧 联系人已标记为垃圾邮件举报者: ${contact.email}`, {
          contactId,
          source
        });
      }
    } catch (error) {
      logger.error(`标记联系人垃圾邮件举报失败: ${error.message}`, { contactId, source });
    }
  }
}

module.exports = new WebhookService(); 