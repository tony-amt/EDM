/**
 * 队列调度器 - 实现多用户多任务的公平轮询发送机制
 * 
 * 核心设计思想：
 * 1. 任务创建时预生成所有SubTask队列（按联系人ID排序）
 * 2. 发信服务按自己的时间间隔轮询不同的任务队列
 * 3. 多用户多任务之间公平轮询
 * 4. 严格的额度控制和服务可用性检查
 */

const { Task, SubTask, Contact, Template, EmailService, User, Sender } = require('../../models');
const { sequelize, Sequelize } = require('../../models');
const { Op } = Sequelize;
const EmailRoutingService = require('./EmailRoutingService');
const QuotaService = require('./QuotaService');
const logger = require('../../utils/logger');

class QueueScheduler {
  constructor() {
    this.taskQueues = new Map(); // 任务队列映射 taskId -> queue
    this.userTaskRotation = new Map(); // 用户任务轮询索引 userId -> taskIndex
    this.serviceTimers = new Map(); // 发信服务定时器 serviceId -> timer
    this.isRunning = false;
  }

  /**
   * 处理scheduled状态的任务
   */
  async processScheduledTasks(batchSize = 20) {
    try {
      const scheduledTasks = await Task.findAll({
        where: {
          status: 'scheduled',
          scheduled_at: {
            [Op.lte]: new Date()
          }
        },
        include: [
          { model: User, as: 'user', attributes: ['id', 'remaining_quota'] }
        ],
        order: [['scheduled_at', 'ASC']],
        limit: batchSize
      });

      let processed = 0;
      let failed = 0;

      for (const task of scheduledTasks) {
        try {
          const result = await this.generateTaskQueue(task.id);
          if (result.success) {
            processed++;
          } else {
            await task.update({
              status: 'failed',
              error_message: result.error
            });
            failed++;
          }
        } catch (error) {
          logger.error(`处理任务 ${task.id} 失败:`, error);
          
          await task.update({
            status: 'failed',
            error_message: error.message
          });
          
          failed++;
        }
      }

      return { processed, failed, total: scheduledTasks.length };
    } catch (error) {
      logger.error('处理scheduled任务失败:', error);
      throw error;
    }
  }

  /**
   * 暂停任务
   */
  async pauseTask(taskId) {
    await this.pauseTaskQueue(taskId, '手动暂停');
  }

  /**
   * 恢复任务
   */
  async resumeTask(taskId) {
    await this.resumeTaskQueue(taskId);
  }

  /**
   * 启动队列调度器
   */
  async start() {
    if (this.isRunning) {
      logger.info('队列调度器已在运行中');
      return;
    }

    this.isRunning = true;
    logger.info('🚀 启动队列调度器');

    try {
      // 1. 加载现有的pending任务队列
      await this.loadExistingQueues();

      // 2. 启动发信服务轮询
      await this.startServicePolling();

      logger.info('✅ 队列调度器启动完成');
    } catch (error) {
      logger.error('队列调度器启动失败:', error);
      this.isRunning = false;
    }
  }

  /**
   * 停止队列调度器
   */
  async stop() {
    this.isRunning = false;
    
    // 停止所有发信服务定时器
    for (const [serviceId, timer] of this.serviceTimers) {
      clearInterval(timer);
      logger.info(`停止发信服务 ${serviceId} 的轮询定时器`);
    }
    
    this.serviceTimers.clear();
    logger.info('🛑 队列调度器已停止');
  }

  /**
   * 任务创建时：预生成SubTask队列
   * @param {string} taskId - 任务ID
   * @returns {Promise<Object>} 生成结果
   */
  async generateTaskQueue(taskId) {
    const transaction = await sequelize.transaction();
    
    try {
      logger.info(`开始为任务 ${taskId} 生成队列`);

      // 1. 获取任务详情
      const task = await Task.findByPk(taskId, {
        include: [
          { model: User, as: 'user', attributes: ['id', 'remaining_quota'] }
        ],
        transaction
      });

      if (!task) {
        throw new Error(`任务 ${taskId} 不存在`);
      }

      // 2. 获取目标联系人
      const contacts = await this.getTaskContacts(task, transaction);
      const estimatedCount = contacts.length;

      if (estimatedCount === 0) {
        await transaction.rollback();
        return {
          success: false,
          error: '没有找到目标联系人'
        };
      }

      // 3. 检查用户额度
      const quotaCheck = await QuotaService.checkUserQuota(task.created_by, estimatedCount);
      if (!quotaCheck.success) {
        await transaction.rollback();
        return {
          success: false,
          error: '当前邮件发信额度不足',
          required: estimatedCount,
          available: quotaCheck.current_quota
        };
      }

      // 4. 检查发信服务可用性
      const availableServices = await EmailRoutingService.getUserAvailableServices(task.created_by);
      const totalServiceQuota = availableServices.reduce((sum, s) => sum + s.available_quota, 0);
      
      if (availableServices.length === 0) {
        await transaction.rollback();
        return {
          success: false,
          error: '当前没有可用的发信服务'
        };
      }

      if (totalServiceQuota === 0) {
        await transaction.rollback();
        return {
          success: false,
          error: '当前发信服务额度已用完'
        };
      }

      // 5. 预扣减用户额度
      const deductResult = await QuotaService.deductUserQuota(
        task.created_by, 
        estimatedCount, 
        taskId, 
        '任务队列生成'
      );

      if (!deductResult.success) {
        await transaction.rollback();
        return {
          success: false,
          error: '额度扣减失败'
        };
      }

      // 6. 生成SubTask队列（按联系人ID排序）
      const subTasks = await this.createSubTaskQueue(task, contacts, transaction);

      // 7. 更新任务状态
      await task.update({
        status: 'queued',
        total_subtasks: subTasks.length,
        pending_subtasks: subTasks.length,
        allocated_subtasks: 0
      }, { transaction });

      await transaction.commit();

      // 8. 将队列加入内存管理
      this.taskQueues.set(taskId, {
        taskId,
        userId: task.created_by,
        subTasks: subTasks.map(st => st.id),
        currentIndex: 0,
        status: 'active'
      });

      logger.info(`✅ 任务 ${taskId} 队列生成完成: ${subTasks.length} 个SubTask`);

      return {
        success: true,
        taskId,
        subTaskCount: subTasks.length,
        estimatedQuota: estimatedCount
      };

    } catch (error) {
      await transaction.rollback();
      logger.error(`任务队列生成失败 ${taskId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取任务联系人（使用新的JSONB字段）
   */
  async getTaskContacts(task, transaction) {
    // 优先使用task.contacts字段
    if (task.contacts && task.contacts.length > 0) {
      return await Contact.findAll({
        where: { id: { [Op.in]: task.contacts } },
        attributes: ['id', 'email', 'name'],
        order: [['id', 'ASC']], // 按ID排序确保队列顺序一致
        transaction
      });
    }

    // 兼容旧的recipient_rule方式
    const { recipient_rule } = task;
    if (!recipient_rule) return [];

    const { type, contact_ids, include_tags, exclude_tags } = recipient_rule;

    switch (type) {
      case 'specific':
        if (!contact_ids || contact_ids.length === 0) return [];
        return await Contact.findAll({
          where: { id: { [Op.in]: contact_ids } },
          attributes: ['id', 'email', 'name'],
          order: [['id', 'ASC']],
          transaction
        });

      case 'tag_based':
        let whereClause = {};
        if (include_tags && include_tags.length > 0) {
          whereClause.tags = { [Op.overlap]: include_tags };
        }
        if (exclude_tags && exclude_tags.length > 0) {
          if (whereClause.tags) {
            whereClause[Op.and] = [
              { tags: whereClause.tags },
              { [Op.not]: { tags: { [Op.overlap]: exclude_tags } } }
            ];
            delete whereClause.tags;
          } else {
            whereClause[Op.not] = { tags: { [Op.overlap]: exclude_tags } };
          }
        }
        return await Contact.findAll({
          where: whereClause,
          attributes: ['id', 'email', 'name'],
          order: [['id', 'ASC']],
          transaction
        });

      case 'all_contacts':
        return await Contact.findAll({
          attributes: ['id', 'email', 'name'],
          order: [['id', 'ASC']],
          transaction
        });

      default:
        return [];
    }
  }

  /**
   * 创建SubTask队列
   */
  async createSubTaskQueue(task, contacts, transaction) {
    if (!task.templates || task.templates.length === 0) {
      throw new Error('任务没有关联的模板');
    }

    // 获取模板详情
    const templates = await Template.findAll({
      where: { id: { [Op.in]: task.templates } },
      attributes: ['id', 'name', 'subject', 'body'],
      transaction
    });

    if (templates.length === 0) {
      throw new Error('任务关联的模板不存在');
    }

    // 为每个联系人创建SubTask
    const subTasksData = [];
    
    for (const contact of contacts) {
      // 随机选择模板
      const template = templates[Math.floor(Math.random() * templates.length)];
      
      subTasksData.push({
        task_id: task.id,
        contact_id: contact.id,
        template_id: template.id,
        recipient_email: contact.email,
        rendered_subject: this.renderTemplate(template.subject, contact), // 先不添加追踪
        rendered_body: this.renderTemplate(template.body, contact), // 先不添加追踪
        status: 'pending',
        priority: task.priority || 0,
        sender_email: '', // 轮询时分配
        service_id: null, // 轮询时分配
        scheduled_at: null,
        allocated_quota: 1
      });
    }

    // 批量创建SubTask
    const createdSubTasks = await SubTask.bulkCreate(subTasksData, {
      transaction,
      returning: true
    });

    // 创建完成后，更新渲染内容以包含追踪功能
    for (let i = 0; i < createdSubTasks.length; i++) {
      const subTask = createdSubTasks[i];
      const contact = contacts[i];
      const template = templates.find(t => t.id === subTask.template_id);
      
      if (template) {
        // 重新渲染，这次包含subTaskId用于追踪
        const renderedSubject = this.renderTemplate(template.subject, contact, subTask.id);
        const renderedBody = this.renderTemplate(template.body, contact, subTask.id);
        
        // 更新SubTask的渲染内容
        await subTask.update({
          rendered_subject: renderedSubject,
          rendered_body: renderedBody
        }, { transaction });
      }
    }

    return createdSubTasks;
  }

  /**
   * 模板渲染
   */
  renderTemplate(template, contact, subTaskId = null) {
    if (!template) return '';
    
    let renderedContent = template
      .replace(/\{\{name\}\}/g, contact.name || 'friends')
      .replace(/\{\{email\}\}/g, contact.email || '');

    // 如果有subTaskId，添加追踪功能
    if (subTaskId) {
      const config = require('../../config');
      const baseUrl = config.server.baseUrl || 'http://localhost:3000';
      
      // 1. 添加打开追踪像素（在邮件末尾）
      const trackingPixel = `<img src="${baseUrl}/api/tracking/open/${subTaskId}" width="1" height="1" style="display:none;" alt="" />`;
      
      // 2. 处理链接追踪 - 将所有链接替换为追踪链接
      renderedContent = this.addClickTracking(renderedContent, subTaskId, baseUrl);
      
      // 3. 在邮件末尾添加追踪像素
      if (renderedContent.includes('</body>')) {
        renderedContent = renderedContent.replace('</body>', `${trackingPixel}</body>`);
      } else {
        renderedContent += trackingPixel;
      }
    }

    return renderedContent;
  }

  /**
   * 添加点击追踪到邮件内容中的所有链接
   */
  addClickTracking(htmlContent, subTaskId, baseUrl) {
    // 匹配所有的 <a href="..."> 标签
    const linkRegex = /<a\s+([^>]*\s+)?href\s*=\s*["']([^"']+)["']([^>]*)>/gi;
    
    return htmlContent.replace(linkRegex, (match, beforeHref, originalUrl, afterHref) => {
      // 跳过已经是追踪链接的URL
      if (originalUrl.includes('/api/tracking/click/')) {
        return match;
      }
      
      // 跳过邮件地址和锚点链接
      if (originalUrl.startsWith('mailto:') || originalUrl.startsWith('#')) {
        return match;
      }
      
      // 构建追踪URL
      const trackingUrl = `${baseUrl}/api/tracking/click/${subTaskId}?url=${encodeURIComponent(originalUrl)}`;
      
      // 重构链接
      const beforeHrefClean = beforeHref || '';
      const afterHrefClean = afterHref || '';
      
      return `<a ${beforeHrefClean}href="${trackingUrl}"${afterHrefClean}>`;
    });
  }

  /**
   * 加载现有的pending任务队列
   */
  async loadExistingQueues() {
    try {
      const pendingTasks = await Task.findAll({
        where: {
          status: ['queued', 'sending', 'paused']
        },
        include: [
          {
            model: SubTask,
            as: 'subTasks',
            where: { status: 'pending' },
            attributes: ['id'],
            required: false
          }
        ]
      });

      for (const task of pendingTasks) {
        if (task.subTasks && task.subTasks.length > 0) {
          this.taskQueues.set(task.id, {
            taskId: task.id,
            userId: task.created_by,
            subTasks: task.subTasks.map(st => st.id),
            currentIndex: 0,
            status: task.status === 'paused' ? 'paused' : 'active'
          });
        }
      }

      logger.info(`加载了 ${this.taskQueues.size} 个现有任务队列`);
    } catch (error) {
      logger.error('加载现有队列失败:', error);
    }
  }

  /**
   * 启动发信服务轮询
   */
  async startServicePolling() {
    try {
      const services = await EmailService.findAll({
        where: {
          is_enabled: true,
          is_frozen: false
        },
        attributes: ['id', 'name', 'sending_rate', 'daily_quota', 'used_quota']
      });

      for (const service of services) {
        if (service.used_quota < service.daily_quota) {
          this.startServiceTimer(service);
        }
      }

      logger.info(`启动了 ${services.length} 个发信服务的轮询定时器`);
    } catch (error) {
      logger.error('启动发信服务轮询失败:', error);
    }
  }

  /**
   * 启动单个发信服务的定时器
   */
  startServiceTimer(service) {
    const intervalMs = (service.sending_rate || 60) * 1000; // 转换为毫秒
    
    const timer = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(timer);
        return;
      }

      try {
        await this.processServiceQueue(service.id);
      } catch (error) {
        logger.error(`发信服务 ${service.id} 轮询处理失败:`, error);
      }
    }, intervalMs);

    this.serviceTimers.set(service.id, timer);
    logger.info(`发信服务 ${service.name} 定时器启动，间隔: ${service.sending_rate}秒`);
  }

  /**
   * 处理发信服务队列（核心轮询逻辑）
   */
  async processServiceQueue(serviceId) {
    try {
      // 1. 检查服务可用性
      const service = await EmailService.findByPk(serviceId);
      if (!service || !service.is_enabled || service.is_frozen || 
          service.used_quota >= service.daily_quota) {
        logger.warn(`发信服务 ${serviceId} 不可用，暂停轮询`);
        this.pauseServiceTimer(serviceId);
        return;
      }

      // 2. 获取下一个待发送的SubTask（多用户轮询）
      const nextSubTask = await this.getNextSubTaskForService(serviceId);
      
      if (!nextSubTask) {
        // 没有待发送的SubTask，继续轮询
        return;
      }

      // 3. 分配发信服务并发送
      const sendResult = await this.allocateAndSendSubTask(nextSubTask, service);
      
      if (sendResult.success) {
        logger.info(`✅ SubTask ${nextSubTask.id} 发送成功 via ${service.name}`);
      } else {
        logger.warn(`❌ SubTask ${nextSubTask.id} 发送失败: ${sendResult.error}`);
      }

    } catch (error) {
      logger.error(`处理发信服务队列失败 ${serviceId}:`, error);
    }
  }

  /**
   * 获取下一个待发送的SubTask（多用户公平轮询）
   */
  async getNextSubTaskForService(serviceId) {
    // 获取所有活跃的任务队列，按用户分组
    const activeQueues = Array.from(this.taskQueues.values())
      .filter(queue => queue.status === 'active' && queue.subTasks.length > queue.currentIndex);

    if (activeQueues.length === 0) {
      return null;
    }

    // 按用户分组
    const userQueues = new Map();
    activeQueues.forEach(queue => {
      if (!userQueues.has(queue.userId)) {
        userQueues.set(queue.userId, []);
      }
      userQueues.get(queue.userId).push(queue);
    });

    // 轮询用户
    const userIds = Array.from(userQueues.keys());
    if (userIds.length === 0) return null;

    for (const userId of userIds) {
      const userTaskQueues = userQueues.get(userId);
      
      // 轮询该用户的任务
      const lastTaskIndex = this.userTaskRotation.get(userId) || 0;
      const nextTaskIndex = (lastTaskIndex + 1) % userTaskQueues.length;
      this.userTaskRotation.set(userId, nextTaskIndex);

      const selectedQueue = userTaskQueues[nextTaskIndex];
      
      // 检查该用户是否有权限使用此发信服务
      const hasAccess = await this.checkUserServiceAccess(userId, serviceId);
      if (!hasAccess) {
        continue;
      }

      // 获取队列中的下一个SubTask
      if (selectedQueue.currentIndex < selectedQueue.subTasks.length) {
        const subTaskId = selectedQueue.subTasks[selectedQueue.currentIndex];
        selectedQueue.currentIndex++;

        const subTask = await SubTask.findByPk(subTaskId, {
          where: { status: 'pending' }
        });

        if (subTask) {
          return subTask;
        }
      }
    }

    return null;
  }

  /**
   * 检查用户是否有权限使用发信服务
   */
  async checkUserServiceAccess(userId, serviceId) {
    const availableServices = await EmailRoutingService.getUserAvailableServices(userId);
    return availableServices.some(service => service.id === serviceId);
  }

  /**
   * 分配发信服务并发送SubTask
   */
  async allocateAndSendSubTask(subTask, service) {
    const transaction = await sequelize.transaction();
    
    try {
      // 1. 获取任务和发信人信息
      const task = await Task.findByPk(subTask.task_id, {
        include: [{ model: Sender, as: 'sender' }],
        transaction
      });

      if (!task || !task.sender) {
        throw new Error('任务或发信人不存在');
      }

      // 2. 生成发信邮箱
      const senderEmail = `${task.sender.name}@${service.domain}`;

      // 3. 更新SubTask状态
      await subTask.update({
        service_id: service.id,
        sender_email: senderEmail,
        status: 'allocated',
        scheduled_at: new Date()
      }, { transaction });

      // 4. 预扣减服务额度
      await service.update({
        used_quota: service.used_quota + 1
      }, { transaction });

      await transaction.commit();

      // 5. 实际发送邮件
      const sendResult = await this.sendEmail(subTask, service);

      // 6. 更新发送结果
      if (sendResult.success) {
        await this.markSubTaskSent(subTask.id);
      } else {
        await this.markSubTaskFailed(subTask.id, sendResult.error);
      }

      return sendResult;

    } catch (error) {
      await transaction.rollback();
      return { success: false, error: error.message };
    }
  }

  /**
   * 发送邮件（调用真实邮件服务）
   */
  async sendEmail(subTask, service) {
    const startTime = Date.now();
    let responseData = null;
    let success = false;
    let statusCode = null;
    let errorMessage = null;

    try {
      const MailService = require('../third-party/mail.service');
      
      const mailService = new MailService({
        api_key: service.api_key,
        api_secret: service.api_secret,
        domain: service.domain,
        name: service.name
      });

      const mailOptions = mailService.buildMailOptions({
        from: subTask.sender_email,
        to: [subTask.recipient_email],
        subject: subTask.rendered_subject,
        html: subTask.rendered_body,
        text: subTask.rendered_body.replace(/<[^>]*>/g, ''),
        openTracking: true,
        clickTracking: true,
        customArgs: {
          subtask_id: subTask.id,
          task_id: subTask.task_id
        },
        requestId: subTask.tracking_id
      });

      const result = await mailService.sendMail(mailOptions);
      
      success = true;
      responseData = result;
      statusCode = result._metadata?.statusCode || 200;
      
      // 记录成功的邮件发送响应
      await this.recordEmailServiceResponse(subTask.id, service, {
        success: true,
        statusCode,
        responseData: result,
        requestData: mailOptions,
        duration: Date.now() - startTime,
        requestId: subTask.tracking_id
      });
      
      return { success: true, response: result };

    } catch (error) {
      success = false;
      errorMessage = error.message;
      statusCode = error.responseStatus || 500;
      responseData = error.responseData;

      // 记录失败的邮件发送响应
      await this.recordEmailServiceResponse(subTask.id, service, {
        success: false,
        statusCode,
        responseData,
        requestData: mailOptions || {},
        duration: Date.now() - startTime,
        requestId: subTask.tracking_id,
        errorMessage
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * 记录邮件服务响应到数据库
   */
  async recordEmailServiceResponse(subTaskId, service, responseInfo) {
    try {
      const { EmailServiceResponse } = require('../../models');
      
      await EmailServiceResponse.create({
        sub_task_id: subTaskId,
        request_id: responseInfo.requestId,
        service_name: service.name,
        domain: service.domain,
        success: responseInfo.success,
        status_code: responseInfo.statusCode,
        duration: responseInfo.duration,
        request_data: responseInfo.requestData,
        response_data: responseInfo.responseData,
        error_message: responseInfo.errorMessage,
        api_call: 'sendMail',
        timestamp: new Date()
      });

      logger.info(`📝 记录邮件服务响应: SubTask ${subTaskId}, 成功: ${responseInfo.success}`);
    } catch (error) {
      logger.error(`❌ 记录邮件服务响应失败: ${error.message}`);
    }
  }

  /**
   * 标记SubTask为已发送
   */
  async markSubTaskSent(subTaskId) {
    await SubTask.update({
      status: 'sent',
      sent_at: new Date()
    }, {
      where: { id: subTaskId }
    });

    // 检查任务是否完成
    const subTask = await SubTask.findByPk(subTaskId);
    if (subTask) {
      await this.checkTaskCompletion(subTask.task_id);
    }
  }

  /**
   * 标记SubTask为失败
   */
  async markSubTaskFailed(subTaskId, errorMessage) {
    await SubTask.update({
      status: 'failed',
      error_message: errorMessage
    }, {
      where: { id: subTaskId }
    });

    const subTask = await SubTask.findByPk(subTaskId);
    if (subTask) {
      await this.checkTaskCompletion(subTask.task_id);
    }
  }

  /**
   * 检查任务是否完成
   */
  async checkTaskCompletion(taskId) {
    const stats = await SubTask.findAll({
      where: { task_id: taskId },
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    const statusCounts = {};
    let totalCount = 0;
    stats.forEach(stat => {
      statusCounts[stat.status] = parseInt(stat.count);
      totalCount += parseInt(stat.count);
    });

    const pendingCount = statusCounts.pending || 0;
    const sentCount = statusCounts.sent || 0;
    const failedCount = statusCounts.failed || 0;

    let newStatus = 'sending';
    if (pendingCount === 0) {
      // 所有SubTask都已完成
      newStatus = sentCount > 0 ? 'completed' : 'failed';
      
      // 从队列中移除
      this.taskQueues.delete(taskId);
    }

    await Task.update({
      status: newStatus,
      completed_at: newStatus === 'completed' ? new Date() : null
    }, {
      where: { id: taskId }
    });
  }

  /**
   * 暂停发信服务定时器
   */
  pauseServiceTimer(serviceId) {
    const timer = this.serviceTimers.get(serviceId);
    if (timer) {
      clearInterval(timer);
      this.serviceTimers.delete(serviceId);
      logger.info(`发信服务 ${serviceId} 定时器已暂停`);
    }
  }

  /**
   * 暂停任务队列
   */
  async pauseTaskQueue(taskId, reason = '手动暂停') {
    const queue = this.taskQueues.get(taskId);
    if (queue) {
      queue.status = 'paused';
      
      await Task.update({
        status: 'paused',
        error_message: reason
      }, {
        where: { id: taskId }
      });

      logger.info(`任务队列 ${taskId} 已暂停: ${reason}`);
    }
  }

  /**
   * 恢复任务队列
   */
  async resumeTaskQueue(taskId) {
    const queue = this.taskQueues.get(taskId);
    if (queue && queue.status === 'paused') {
      queue.status = 'active';
      
      await Task.update({
        status: 'sending',
        error_message: null
      }, {
        where: { id: taskId }
      });

      logger.info(`任务队列 ${taskId} 已恢复`);
    }
  }

  /**
   * 获取调度器状态
   */
  getStatus() {
    const activeQueues = Array.from(this.taskQueues.values())
      .filter(q => q.status === 'active');
    
    const pausedQueues = Array.from(this.taskQueues.values())
      .filter(q => q.status === 'paused');

    return {
      is_running: this.isRunning,
      active_queues: activeQueues.length,
      paused_queues: pausedQueues.length,
      active_services: this.serviceTimers.size,
      total_pending_subtasks: activeQueues.reduce((sum, q) => 
        sum + (q.subTasks.length - q.currentIndex), 0
      )
    };
  }
}

module.exports = QueueScheduler; 