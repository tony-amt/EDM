const logger = require('../utils/logger');
const { SubTask, Task, EventLog, Contact, sequelize } = require('../models/index');
const { AppError } = require('../utils/errorHandler');
const { Op } = require('sequelize');

class WebhookController {
  /**
   * 🔧 重构：处理EngageLab webhook（支持两种格式）
   * 格式1：message_status (delivered, invalid_email, soft_bounce)
   * 格式2：event (open, click, unsubscribe, report_spam, route)
   */
  async handleMailEvent(req, res, next) {
    const startTime = Date.now();
    let eventLogId = null;

    try {
      const webhookData = req.body;

      // 🔧 修复：正确解析时间戳（支持engagelab的itime字段）
      let timestamp;
      if (webhookData.itime) {
        // engagelab使用Unix timestamp（毫秒）
        timestamp = new Date(webhookData.itime);
      } else if (webhookData.timestamp) {
        // 兼容其他格式
        timestamp = new Date(webhookData.timestamp * 1000); // 假设是秒
      } else {
        // 兜底使用当前时间
        timestamp = new Date();
      }

      // 验证时间戳有效性
      if (isNaN(timestamp.getTime())) {
        logger.warn('时间戳解析失败，使用当前时间', {
          originalTimestamp: webhookData.itime || webhookData.timestamp
        });
        timestamp = new Date();
      }

      logger.info(`🔔 收到EngageLab Webhook`, {
        body: webhookData,
        headers: {
          'content-type': req.headers['content-type'],
          'user-agent': req.headers['user-agent'],
          'x-webhook-timestamp': req.headers['x-webhook-timestamp']
        },
        timestamp: timestamp.toISOString()
      });

      // 🔧 1. 先保存原始webhook到event_log
      const eventLog = await EventLog.create({
        event_type: this.determineEventType(webhookData),
        timestamp: timestamp, // 使用解析后的时间戳
        payload: webhookData,
        source: 'engagelab',
        message_id: webhookData.message_id || webhookData.status?.status_data?.email_id,
        email_address: webhookData.to || webhookData.to_email,
        provider_event_id: webhookData.status?.status_data?.task_id || webhookData.task_id || null,
        metadata: {
          raw_webhook: webhookData,
          received_at: new Date().toISOString(), // 接收时间
          event_timestamp: timestamp.toISOString(), // 事件发生时间
          processing_start: startTime
        }
      });

      eventLogId = eventLog.id;
      logger.info(`📝 Webhook事件已记录到EventLog`, { eventLogId, event_type: eventLog.event_type });

      // 🔧 2. 解析关联的SubTask
      const subTask = await this.findSubTaskByWebhook(webhookData);
      if (!subTask) {
        logger.warn(`⚠️ 未找到关联的SubTask`, {
          webhookData,
          searchKeys: {
            custom_args: webhookData.custom_args,
            message_id: webhookData.message_id,
            email_id: webhookData.status?.status_data?.email_id,
            to: webhookData.to
          }
        });

        // 更新event_log状态
        await eventLog.update({
          metadata: {
            ...eventLog.metadata,
            warning: 'SubTask not found',
            processed_at: new Date().toISOString()
          }
        });

        return res.status(200).json({
          success: true,
          message: 'Webhook已记录，但未找到关联SubTask',
          event_log_id: eventLogId
        });
      }

      // 🔧 3. 更新EventLog关联信息
      await eventLog.update({
        task_id: subTask.task_id,
        contact_id: subTask.contact_id,
        metadata: {
          ...eventLog.metadata,
          sub_task_id: subTask.id,
          task_id: subTask.task_id,
          contact_id: subTask.contact_id
        }
      });

      // 🔧 4. 根据webhook类型处理业务逻辑 - 修复：基于engagelab官方文档
      let result = null;

      if (webhookData.status && webhookData.status.message_status) {
        // engagelab状态事件：target, sent, delivered, invalid_email, soft_bounce
        result = await this.handleStatusEvent(webhookData, subTask, timestamp);
      } else if (webhookData.response && webhookData.response.event) {
        // engagelab用户行为事件：open, click, unsubscribe, report_spam, route
        result = await this.handleResponseEvent(webhookData, subTask, timestamp);
      } else if (webhookData.message_status) {
        // 兼容旧格式：状态返回
        result = await this.handleMessageStatus(webhookData, subTask, timestamp);
      } else if (webhookData.event) {
        // 兼容旧格式：用户回应
        result = await this.handleUserEvent(webhookData, subTask, timestamp);
      } else {
        logger.warn(`⚠️ 未知的webhook格式`, { webhookData });
        result = { message: 'Unknown webhook format', action: 'recorded_only' };
      }

      // 🔧 5. 更新EventLog处理结果
      await eventLog.update({
        metadata: {
          ...eventLog.metadata,
          processing_result: result,
          processed_at: new Date().toISOString(),
          processing_duration: Date.now() - startTime
        }
      });

      logger.info(`✅ Webhook处理完成`, {
        eventLogId,
        subTaskId: subTask.id,
        result,
        duration: Date.now() - startTime
      });

      return res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
        event_log_id: eventLogId,
        sub_task_id: subTask.id,
        result
      });

    } catch (error) {
      logger.error(`❌ Webhook处理失败`, {
        error: error.message,
        stack: error.stack,
        eventLogId,
        webhookData: req.body,
        duration: Date.now() - startTime
      });

      // 🔧 记录失败状态
      if (eventLogId) {
        try {
          await EventLog.findByPk(eventLogId).then(log => {
            if (log) {
              return log.update({
                metadata: {
                  ...log.metadata,
                  error: error.message,
                  failed_at: new Date().toISOString()
                }
              });
            }
          });
        } catch (logError) {
          logger.error(`更新EventLog失败状态时出错: ${logError.message}`);
        }
      }

      // 返回200避免EngageLab重试
      return res.status(200).json({
        success: false,
        message: `Webhook处理失败: ${error.message}`,
        event_log_id: eventLogId
      });
    }
  }

  /**
   * 🔧 确定事件类型 - 修复：基于engagelab官方文档
   */
  determineEventType(webhookData) {
    // 🔧 修复：支持status事件（发送状态）
    if (webhookData.status && webhookData.status.message_status) {
      const messageStatus = webhookData.status.message_status;
      // 映射engagelab状态事件到数据库支持的类型
      switch (messageStatus) {
        case 'target':
          return 'target'; // 邮件请求成功
        case 'sent':
          return 'sent'; // 邮件从EngageLab成功投出
        case 'delivered':
          return 'delivered'; // 邮件投递成功
        case 'invalid_email':
          return 'bounced'; // 映射到bounced
        case 'soft_bounce':
          return 'bounced'; // 映射到bounced
        default:
          return messageStatus;
      }
    }

    // 🔧 修复：支持response事件（用户行为）
    if (webhookData.response && webhookData.response.event) {
      const event = webhookData.response.event;
      // 映射engagelab用户行为事件到数据库支持的类型
      switch (event) {
        case 'open':
          return 'opened'; // 映射到opened
        case 'click':
          return 'clicked'; // 映射到clicked
        case 'unsubscribe':
          return 'unsubscribe';
        case 'report_spam':
          return 'spam_report'; // 映射到spam_report
        case 'route':
          return 'reply'; // 映射到reply
        default:
          return event;
      }
    }

    // 🔧 兼容旧格式
    if (webhookData.event_type) {
      return webhookData.event_type;
    }

    if (webhookData.event) {
      return webhookData.event;
    }

    if (webhookData.message_status) {
      return webhookData.message_status;
    }

    return 'unknown';
  }

  /**
   * 🔧 通过webhook数据查找SubTask - 修复：基于engagelab官方文档
   */
  async findSubTaskByWebhook(webhookData) {
    try {
      // 方法1：通过custom_args.subtask_id查找（最可靠）
      if (webhookData.custom_args && webhookData.custom_args.subtask_id) {
        const subTask = await SubTask.findByPk(webhookData.custom_args.subtask_id, {
          include: [{ model: Task, as: 'task' }]
        });
        if (subTask) {
          logger.info(`✅ 通过custom_args.subtask_id找到SubTask: ${subTask.id}`);
          return subTask;
        }
      }

      // 方法2：通过message_id查找（engagelab格式）
      if (webhookData.message_id) {
        const subTask = await SubTask.findOne({
          where: {
            email_service_response: {
              [Op.like]: `%${webhookData.message_id}%`
            }
          },
          include: [{ model: Task, as: 'task' }]
        });
        if (subTask) {
          logger.info(`✅ 通过message_id找到SubTask: ${subTask.id}`);
          return subTask;
        }
      }

      // 方法3：通过status.status_data.email_id查找（状态事件）
      if (webhookData.status && webhookData.status.status_data && webhookData.status.status_data.email_id) {
        const emailId = webhookData.status.status_data.email_id;
        const subTask = await SubTask.findOne({
          where: {
            email_service_response: {
              [Op.like]: `%${emailId}%`
            }
          },
          include: [{ model: Task, as: 'task' }]
        });
        if (subTask) {
          logger.info(`✅ 通过status.status_data.email_id找到SubTask: ${subTask.id}`);
          return subTask;
        }
      }

      // 方法4：通过response.response_data.email_id查找（用户行为事件）
      if (webhookData.response && webhookData.response.response_data && webhookData.response.response_data.email_id) {
        const emailId = webhookData.response.response_data.email_id;
        const subTask = await SubTask.findOne({
          where: {
            email_service_response: {
              [Op.like]: `%${emailId}%`
            }
          },
          include: [{ model: Task, as: 'task' }]
        });
        if (subTask) {
          logger.info(`✅ 通过response.response_data.email_id找到SubTask: ${subTask.id}`);
          return subTask;
        }
      }

      // 方法5：通过收件人邮箱查找（兜底方案）
      if (webhookData.to) {
        const subTask = await SubTask.findOne({
          where: {
            recipient_email: webhookData.to,
            status: ['sent', 'delivered'] // 只查找已发送的
          },
          order: [['sent_at', 'DESC']], // 最近发送的
          include: [{ model: Task, as: 'task' }]
        });
        if (subTask) {
          logger.info(`✅ 通过收件人邮箱找到SubTask: ${subTask.id}`);
          return subTask;
        }
      }

      logger.warn(`❌ 未找到关联的SubTask`, {
        custom_args: webhookData.custom_args,
        message_id: webhookData.message_id,
        status_email_id: webhookData.status?.status_data?.email_id,
        response_email_id: webhookData.response?.response_data?.email_id,
        to: webhookData.to
      });
      return null;

    } catch (error) {
      logger.error(`查找SubTask时出错: ${error.message}`, { webhookData });
      return null;
    }
  }

  /**
   * 🔧 处理邮件状态变更（delivery状态）- 修复：支持engagelab报文格式
   */
  async handleMessageStatus(webhookData, subTask, timestamp) {
    try {
      // 🔧 修复：正确提取状态信息
      let messageStatus, statusData = {};

      if (webhookData.status && webhookData.status.message_status) {
        // engagelab格式
        messageStatus = webhookData.status.message_status;
        statusData = webhookData.status.status_data || {};
      } else if (webhookData.message_status) {
        // 旧格式
        messageStatus = webhookData.message_status;
      } else {
        logger.warn('未找到message_status信息', { webhookData });
        return { action: 'ignored', reason: 'no_message_status' };
      }

      logger.info(`📬 处理邮件状态: ${messageStatus}`, {
        subTaskId: subTask.id,
        messageStatus,
        statusData,
        timestamp: timestamp.toISOString()
      });

      // 根据状态更新SubTask
      const updateData = { updated_at: new Date() };
      let actionTaken = 'status_updated';

      switch (messageStatus) {
        case 'delivered':
          updateData.status = 'delivered';
          updateData.delivered_at = timestamp;
          actionTaken = 'marked_delivered';
          break;

        case 'invalid_email':
        case 'hard_bounce':
          updateData.status = 'bounced';
          updateData.bounced_at = timestamp;
          updateData.bounce_type = 'hard';
          updateData.bounce_reason = statusData.message || 'Invalid email address';
          actionTaken = 'marked_bounced';
          // 标记联系人邮箱无效
          await this.markContactEmailInvalid(subTask.contact_id, updateData.bounce_reason);
          break;

        case 'soft_bounce':
          updateData.status = 'bounced';
          updateData.bounced_at = timestamp;
          updateData.bounce_type = 'soft';
          updateData.bounce_reason = statusData.message || 'Temporary delivery failure';
          actionTaken = 'marked_soft_bounced';
          break;

        case 'spam_report':
          updateData.status = 'complained';
          updateData.complained_at = timestamp;
          actionTaken = 'marked_complained';
          // 标记联系人为垃圾邮件举报者
          await this.markContactAsSpamReporter(subTask.contact_id, `webhook_${messageStatus}`);
          break;

        case 'unsubscribe':
          updateData.status = 'unsubscribed';
          updateData.unsubscribed_at = timestamp;
          actionTaken = 'marked_unsubscribed';
          // 标记联系人为退订
          await this.markContactAsUnsubscribed(subTask.contact_id, `webhook_${messageStatus}`);
          break;

        default:
          logger.info(`未处理的邮件状态: ${messageStatus}`, { subTaskId: subTask.id });
          actionTaken = 'logged_only';
          return { action: actionTaken, message_status: messageStatus };
      }

      // 更新SubTask
      await subTask.update(updateData);
      logger.info(`✅ SubTask状态已更新`, {
        subTaskId: subTask.id,
        oldStatus: subTask.status,
        newStatus: updateData.status,
        actionTaken
      });

      // 更新任务统计
      await this.updateTaskStatistics(subTask.task_id);

      return {
        action: actionTaken,
        message_status: messageStatus,
        sub_task_status: updateData.status,
        timestamp: timestamp.toISOString()
      };

    } catch (error) {
      logger.error(`处理邮件状态失败: ${error.message}`, {
        subTaskId: subTask.id,
        webhookData,
        error: error.stack
      });
      throw error;
    }
  }

  /**
   * 🔧 标记联系人邮箱无效
   */
  async markContactEmailInvalid(contactId, reason) {
    try {
      const contact = await Contact.findByPk(contactId);
      if (contact) {
        await contact.update({
          email_status: 'invalid',
          email_invalid_reason: reason,
          updated_at: new Date()
        });
        logger.info(`📧 联系人邮箱标记为无效`, { contactId, reason });
      }
    } catch (error) {
      logger.error(`标记联系人邮箱无效失败: ${error.message}`, { contactId });
    }
  }

  /**
   * 🔧 处理event类型webhook（用户回应）
   */
  async handleUserEvent(webhookData, subTask, timestamp) {
    const { event, response_data } = webhookData;
    let updateData = {};
    let logMessage = '';

    switch (event) {
      case 'open':
        // EngageLab的打开事件，记录但以我们自己的tracking为主
        updateData = {
          tracking_data: sequelize.literal(`
            COALESCE(tracking_data, '{}')::jsonb || 
            jsonb_build_object(
              'engagelab_opens', 
              COALESCE((tracking_data->>'engagelab_opens')::int, 0) + 1,
              'last_engagelab_open_at', '${timestamp.toISOString()}',
              'engagelab_open_data', '${JSON.stringify(response_data || {})}'
            )
          `)
        };
        logMessage = `👁️ EngageLab打开事件: ${subTask.recipient_email} (以我们tracking为主)`;
        break;

      case 'click':
        // EngageLab的点击事件，记录但以我们自己的tracking为主
        updateData = {
          tracking_data: sequelize.literal(`
            COALESCE(tracking_data, '{}')::jsonb || 
            jsonb_build_object(
              'engagelab_clicks', 
              COALESCE((tracking_data->>'engagelab_clicks')::int, 0) + 1,
              'last_engagelab_click_at', '${timestamp.toISOString()}',
              'engagelab_click_data', '${JSON.stringify(response_data || {})}'
            )
          `)
        };
        logMessage = `🔗 EngageLab点击事件: ${subTask.recipient_email} (以我们tracking为主)`;
        break;

      case 'unsubscribe':
        // 退订事件，需要给联系人打标
        updateData = {
          tracking_data: sequelize.literal(`
            COALESCE(tracking_data, '{}')::jsonb || 
            jsonb_build_object(
              'unsubscribed_at', '${timestamp.toISOString()}',
              'unsubscribe_source', 'engagelab',
              'unsubscribe_data', '${JSON.stringify(response_data || {})}'
            )
          `)
        };

        // TODO: 给联系人打退订标签，减少打扰
        await this.markContactAsUnsubscribed(subTask.contact_id, 'engagelab_unsubscribe');

        logMessage = `❌ 用户退订: ${subTask.recipient_email} - 已标记联系人`;
        break;

      case 'report_spam':
        // 垃圾邮件举报，需要给联系人打标
        updateData = {
          tracking_data: sequelize.literal(`
            COALESCE(tracking_data, '{}')::jsonb || 
            jsonb_build_object(
              'spam_reported_at', '${timestamp.toISOString()}',
              'spam_report_source', 'engagelab',
              'spam_report_data', '${JSON.stringify(response_data || {})}'
            )
          `)
        };

        // TODO: 给联系人打垃圾邮件标签，避免投诉升级
        await this.markContactAsSpamReporter(subTask.contact_id, 'engagelab_spam_report');

        logMessage = `🚫 垃圾邮件举报: ${subTask.recipient_email} - 已标记联系人`;
        break;

      case 'route':
        // 回信事件，需要对接邮件会话模块
        logMessage = `📨 收到回信: ${response_data?.from_email || subTask.recipient_email}`;

        // TODO: 对接邮件会话模块
        await this.handleEmailReply(webhookData, subTask, timestamp);

        return {
          message: logMessage,
          action: 'email_reply_processed',
          reply_data: response_data
        };

      default:
        logMessage = `ℹ️ 未处理的event类型: ${event}`;
        return { message: logMessage, action: 'unknown_event' };
    }

    // 更新SubTask
    await subTask.update(updateData);

    logger.info(logMessage);
    return {
      message: logMessage,
      action: 'event_recorded',
      event_type: event
    };
  }

  /**
   * 🔧 标记联系人为已退订
   */
  async markContactAsUnsubscribed(contactId, source) {
    try {
      const contact = await Contact.findByPk(contactId);
      if (contact) {
        // 添加退订标签
        // TODO: const currentTags = await ContactTagService.getContactTags(contact.id, userId);
        const unsubscribeTag = `unsubscribed_${source}`;

        if (!currentTags.includes(unsubscribeTag)) {
          await contact.update({
            tags: [...currentTags, unsubscribeTag],
            metadata: {
              ...contact.metadata,
              unsubscribed_at: new Date().toISOString(),
              unsubscribe_source: source
            }
          });
          logger.info(`📝 联系人 ${contactId} 已标记为退订`);
        }
      }
    } catch (error) {
      logger.error(`标记联系人退订失败: ${error.message}`, { contactId, source });
    }
  }

  /**
   * 🔧 标记联系人为垃圾邮件举报者
   */
  async markContactAsSpamReporter(contactId, source) {
    try {
      const contact = await Contact.findByPk(contactId);
      if (contact) {
        // 添加垃圾邮件标签
        // TODO: const currentTags = await ContactTagService.getContactTags(contact.id, userId);
        const spamTag = `spam_reporter_${source}`;

        if (!currentTags.includes(spamTag)) {
          await contact.update({
            tags: [...currentTags, spamTag],
            metadata: {
              ...contact.metadata,
              spam_reported_at: new Date().toISOString(),
              spam_report_source: source
            }
          });
          logger.info(`📝 联系人 ${contactId} 已标记为垃圾邮件举报者`);
        }
      }
    } catch (error) {
      logger.error(`标记联系人垃圾邮件举报失败: ${error.message}`, { contactId, source });
    }
  }

  /**
   * 🔧 处理邮件回复（对接会话模块）
   */
  async handleEmailReply(webhookData, subTask, timestamp) {
    try {
      // TODO: 实现邮件会话模块对接
      logger.info(`📨 处理邮件回复`, {
        subTaskId: subTask.id,
        from: webhookData.response_data?.from_email,
        subject: webhookData.response_data?.subject,
        timestamp
      });

      // 这里需要创建EmailConversation和EmailMessage记录
      // 暂时只记录日志

    } catch (error) {
      logger.error(`处理邮件回复失败: ${error.message}`, { webhookData, subTaskId: subTask.id });
    }
  }

  /**
   * 🔧 更新任务统计
   */
  async updateTaskStatistics(taskId) {
    try {
      const QueueScheduler = require('../services/infrastructure/QueueScheduler');
      const scheduler = new QueueScheduler();
      await scheduler.updateTaskStats(taskId);
    } catch (error) {
      logger.error(`更新任务统计失败: ${error.message}`, { taskId });
    }
  }

  /**
   * 测试Webhook接口
   */
  async testWebhook(req, res, next) {
    try {
      const testData = req.body;

      logger.info('收到Webhook测试请求', {
        data: testData,
        timestamp: new Date()
      });

      res.status(200).json({
        success: true,
        message: 'Webhook测试成功',
        received_data: testData,
        server_time: new Date()
      });
    } catch (error) {
      logger.error('Webhook测试失败', error);
      res.status(500).json({
        success: false,
        message: '测试失败',
        error: error.message
      });
    }
  }

  /**
   * 🔧 处理EngageLab状态事件 - 新增：基于官方文档
   */
  async handleStatusEvent(webhookData, subTask, timestamp) {
    try {
      const messageStatus = webhookData.status.message_status;
      const statusData = webhookData.status.status_data || {};
      const errorDetail = webhookData.status.error_detail || null;

      logger.info(`📬 处理EngageLab状态事件: ${messageStatus}`, {
        subTaskId: subTask.id,
        messageStatus,
        statusData,
        errorDetail,
        timestamp: timestamp.toISOString()
      });

      // 根据状态更新SubTask
      const updateData = { updated_at: new Date() };
      let actionTaken = 'status_updated';

      switch (messageStatus) {
        case 'target':
          // 邮件请求成功，通常不需要更新SubTask状态
          actionTaken = 'target_confirmed';
          logger.info(`🎯 邮件请求成功: SubTask ${subTask.id}`);
          break;

        case 'sent':
          // 邮件从EngageLab成功投出，通常SubTask已经是sent状态
          actionTaken = 'sent_confirmed';
          logger.info(`📤 邮件投出确认: SubTask ${subTask.id}`);
          break;

        case 'delivered':
          updateData.status = 'delivered';
          updateData.delivered_at = timestamp;
          actionTaken = 'marked_delivered';
          break;

        case 'invalid_email':
          updateData.status = 'bounced';
          updateData.bounced_at = timestamp;
          updateData.bounce_type = 'hard';
          updateData.bounce_reason = errorDetail ?
            `${errorDetail.message} (${errorDetail.sub_stat})` :
            'Invalid email address';
          actionTaken = 'marked_bounced';
          // 标记联系人邮箱无效
          await this.markContactEmailInvalid(subTask.contact_id, updateData.bounce_reason);
          break;

        case 'soft_bounce':
          updateData.status = 'bounced';
          updateData.bounced_at = timestamp;
          updateData.bounce_type = 'soft';
          updateData.bounce_reason = errorDetail ?
            `${errorDetail.message} (${errorDetail.sub_stat})` :
            'Temporary delivery failure';
          actionTaken = 'marked_soft_bounced';
          break;

        default:
          logger.info(`未处理的状态事件: ${messageStatus}`, { subTaskId: subTask.id });
          actionTaken = 'logged_only';
          return { action: actionTaken, message_status: messageStatus };
      }

      // 更新SubTask（如果有需要更新的字段）
      if (Object.keys(updateData).length > 1) { // 除了updated_at还有其他字段
        await subTask.update(updateData);
        logger.info(`✅ SubTask状态已更新`, {
          subTaskId: subTask.id,
          oldStatus: subTask.status,
          newStatus: updateData.status,
          actionTaken
        });

        // 更新任务统计
        await this.updateTaskStatistics(subTask.task_id);
      }

      return {
        action: actionTaken,
        message_status: messageStatus,
        sub_task_status: updateData.status || subTask.status,
        timestamp: timestamp.toISOString()
      };

    } catch (error) {
      logger.error(`处理EngageLab状态事件失败: ${error.message}`, {
        subTaskId: subTask.id,
        webhookData,
        error: error.stack
      });
      throw error;
    }
  }

  /**
   * 🔧 处理EngageLab用户行为事件 - 新增：基于官方文档
   */
  async handleResponseEvent(webhookData, subTask, timestamp) {
    try {
      const responseEvent = webhookData.response.event;
      const responseData = webhookData.response.response_data || {};

      logger.info(`👥 处理EngageLab用户行为事件: ${responseEvent}`, {
        subTaskId: subTask.id,
        responseEvent,
        responseData,
        timestamp: timestamp.toISOString()
      });

      // 根据用户行为更新SubTask
      const updateData = { updated_at: new Date() };
      let actionTaken = 'user_action_recorded';

      switch (responseEvent) {
        case 'open':
          // 如果当前状态还是sent，更新为opened
          if (subTask.status === 'sent' || subTask.status === 'delivered') {
            updateData.status = 'opened';
            updateData.opened_at = timestamp;
            actionTaken = 'marked_opened';
          } else {
            actionTaken = 'open_recorded';
          }
          break;

        case 'click':
          // 点击是比打开更强的信号，更新状态
          if (['sent', 'delivered', 'opened'].includes(subTask.status)) {
            updateData.status = 'clicked';
            updateData.clicked_at = timestamp;
            updateData.click_data = JSON.stringify({
              url: responseData.url || '',
              ip: responseData.ip || '',
              explorer_name: responseData.explorer_name || '',
              os_name: responseData.os_name || '',
              timestamp: timestamp
            });
            actionTaken = 'marked_clicked';
          } else {
            actionTaken = 'click_recorded';
          }
          break;

        case 'unsubscribe':
          updateData.status = 'unsubscribed';
          updateData.unsubscribed_at = timestamp;
          actionTaken = 'marked_unsubscribed';
          // 标记联系人为退订
          await this.markContactAsUnsubscribed(subTask.contact_id, `engagelab_${responseEvent}`);
          break;

        case 'report_spam':
          updateData.status = 'complained';
          updateData.complained_at = timestamp;
          actionTaken = 'marked_complained';
          // 标记联系人为垃圾邮件举报者
          await this.markContactAsSpamReporter(subTask.contact_id, `engagelab_${responseEvent}`);
          break;

        case 'route':
          // 邮件回复事件，记录但不改变发送状态
          actionTaken = 'route_recorded';
          logger.info(`📧 邮件回复事件: SubTask ${subTask.id}`, {
            subject: responseData.subject,
            from: responseData.from,
            from_name: responseData.from_name
          });
          break;

        default:
          logger.info(`未处理的用户行为事件: ${responseEvent}`, { subTaskId: subTask.id });
          actionTaken = 'logged_only';
          return { action: actionTaken, response_event: responseEvent };
      }

      // 更新SubTask（如果有需要更新的字段）
      if (Object.keys(updateData).length > 1) { // 除了updated_at还有其他字段
        await subTask.update(updateData);
        logger.info(`✅ SubTask状态已更新`, {
          subTaskId: subTask.id,
          oldStatus: subTask.status,
          newStatus: updateData.status,
          actionTaken
        });

        // 更新任务统计
        await this.updateTaskStatistics(subTask.task_id);
      }

      return {
        action: actionTaken,
        response_event: responseEvent,
        sub_task_status: updateData.status || subTask.status,
        timestamp: timestamp.toISOString()
      };

    } catch (error) {
      logger.error(`处理EngageLab用户行为事件失败: ${error.message}`, {
        subTaskId: subTask.id,
        webhookData,
        error: error.stack
      });
      throw error;
    }
  }
}

module.exports = new WebhookController(); 