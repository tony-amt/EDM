const { Task, SubTask, Contact, Template, EmailService, UserQuotaLog, SystemConfig } = require('../models');
const logger = require('../utils/logger');
const { Op } = require('sequelize');
const { Sequelize } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

/**
 * 增强版队列调度器
 * 功能：
 * 1. 扩展的变量渲染支持
 * 2. 系统参数配置管理
 * 3. 优化的批量队列调度
 */
class EnhancedQueueScheduler {
  constructor() {
    this.taskQueues = new Map();
    this.serviceTimers = new Map();
    this.scheduledTaskTimer = null;
    this.isRunning = false;
    this.userRoundRobin = new Map(); // 用户轮询状态

    // 默认系统参数
    this.defaultConfig = {
      queue_batch_size: 10,           // 每批处理邮件数量
      queue_interval_seconds: 5,      // 队列处理间隔（秒）
      scheduled_check_interval: 30,   // 定时任务检查间隔（秒）
      max_retry_attempts: 3           // 最大重试次数
    };
  }

  /**
   * 获取系统配置参数
   */
  async getSystemConfig(key, defaultValue) {
    try {
      const config = await SystemConfig.findOne({ where: { config_key: key } });
      return config ? JSON.parse(config.config_value) : defaultValue;
    } catch (error) {
      logger.warn(`获取系统配置失败 ${key}:`, error.message);
      return defaultValue;
    }
  }

  /**
   * 设置系统配置参数
   */
  async setSystemConfig(key, value, description = '') {
    try {
      await SystemConfig.upsert({
        config_key: key,
        config_value: JSON.stringify(value),
        description: description,
        updated_at: new Date()
      });
      logger.info(`系统配置已更新: ${key} = ${value}`);
    } catch (error) {
      logger.error(`设置系统配置失败 ${key}:`, error);
    }
  }

  /**
   * 增强的模板渲染函数 - 支持更多变量
   */
  renderTemplate(template, contact, subTaskId = null) {
    if (!template) return '';

    let renderedContent = template
      // 基础字段
      .replace(/\{\{name\}\}/g, contact.name || contact.username || contact.first_name || 'friends')
      .replace(/\{\{email\}\}/g, contact.email || '')
      .replace(/\{\{username\}\}/g, contact.username || '')
      .replace(/\{\{first_name\}\}/g, contact.first_name || '')
      .replace(/\{\{last_name\}\}/g, contact.last_name || '')
      .replace(/\{\{full_name\}\}/g, `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.name || contact.username || 'friends')

      // 联系信息
      .replace(/\{\{phone\}\}/g, contact.phone || '')
      .replace(/\{\{company\}\}/g, contact.company || '')
      .replace(/\{\{position\}\}/g, contact.position || '')

      // 社交媒体
      .replace(/\{\{tiktok_id\}\}/g, contact.tiktok_unique_id || '')
      .replace(/\{\{instagram_id\}\}/g, contact.instagram_id || '')
      .replace(/\{\{youtube_id\}\}/g, contact.youtube_id || '')

      // 自定义字段
      .replace(/\{\{custom_field_1\}\}/g, contact.custom_field_1 || '')
      .replace(/\{\{custom_field_2\}\}/g, contact.custom_field_2 || '')
      .replace(/\{\{custom_field_3\}\}/g, contact.custom_field_3 || '')
      .replace(/\{\{custom_field_4\}\}/g, contact.custom_field_4 || '')
      .replace(/\{\{custom_field_5\}\}/g, contact.custom_field_5 || '');

    // 仅在邮件正文中添加追踪功能（不在主题中）
    if (subTaskId) {
      const config = require('../../config');
      const baseUrl = config.server?.baseUrl || 'https://tkmail.fun';

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
    const linkRegex = /<a\s+([^>]*\s+)?href\s*=\s*["']([^"']+)["']([^>]*)>/gi;

    return htmlContent.replace(linkRegex, (match, beforeHref, originalUrl, afterHref) => {
      if (originalUrl.includes('/api/tracking/click/')) return match;
      if (originalUrl.startsWith('mailto:') || originalUrl.startsWith('#')) return match;

      const trackingUrl = `${baseUrl}/api/tracking/click/${subTaskId}?url=${encodeURIComponent(originalUrl)}`;
      const beforeHrefClean = beforeHref || '';
      const afterHrefClean = afterHref || '';

      return `<a ${beforeHrefClean}href="${trackingUrl}"${afterHrefClean}>`;
    });
  }

  /**
   * 启动增强队列调度器
   */
  async start() {
    if (this.isRunning) {
      logger.warn('队列调度器已在运行中');
      return;
    }

    this.isRunning = true;
    logger.info('🚀 启动增强版队列调度器');

    try {
      // 初始化系统配置
      await this.initializeSystemConfig();

      // 加载现有队列
      await this.loadExistingQueues();

      // 启动发信服务轮询
      await this.startServicePolling();

      // 启动定时任务检查
      this.startScheduledTaskTimer();

      logger.info('✅ 增强版队列调度器启动完成');

    } catch (error) {
      logger.error('启动队列调度器失败:', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * 初始化系统配置
   */
  async initializeSystemConfig() {
    const configs = [
      {
        key: 'queue_batch_size',
        value: 10,
        description: '每批处理的邮件数量'
      },
      {
        key: 'queue_interval_seconds',
        value: 5,
        description: '队列处理间隔（秒）'
      },
      {
        key: 'scheduled_check_interval',
        value: 30,
        description: '定时任务检查间隔（秒）'
      },
      {
        key: 'max_retry_attempts',
        value: 3,
        description: '邮件发送最大重试次数'
      }
    ];

    for (const config of configs) {
      const existing = await SystemConfig.findOne({ where: { config_key: config.key } });
      if (!existing) {
        await this.setSystemConfig(config.key, config.value, config.description);
      }
    }

    logger.info('✅ 系统配置初始化完成');
  }

  /**
   * 优化的批量队列处理
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

      // 2. 获取批量配置
      const batchSize = await this.getSystemConfig('queue_batch_size', this.defaultConfig.queue_batch_size);

      // 3. 批量获取待发送的SubTask
      const subTasks = await this.getNextSubTaskBatch(serviceId, batchSize);

      if (subTasks.length === 0) {
        return; // 没有待发送的任务
      }

      // 4. 批量处理
      logger.info(`📦 开始批量处理 ${subTasks.length} 个邮件任务 via ${service.name}`);

      let successCount = 0;
      let failureCount = 0;

      for (const subTask of subTasks) {
        try {
          const sendResult = await this.allocateAndSendSubTask(subTask, service);
          if (sendResult.success) {
            successCount++;
          } else {
            failureCount++;
            logger.warn(`❌ SubTask ${subTask.id} 发送失败: ${sendResult.error}`);
          }
        } catch (error) {
          failureCount++;
          logger.error(`❌ SubTask ${subTask.id} 处理异常:`, error);
        }
      }

      logger.info(`📊 批量处理完成: 成功 ${successCount}，失败 ${failureCount}`);

    } catch (error) {
      logger.error(`处理发信服务队列失败 ${serviceId}:`, error);
    }
  }

  /**
   * 获取下一批待发送的SubTask（支持批量和公平轮询）
   */
  async getNextSubTaskBatch(serviceId, batchSize) {
    const activeQueues = Array.from(this.taskQueues.values())
      .filter(queue => queue.status === 'active' && queue.subTasks.length > queue.currentIndex);

    if (activeQueues.length === 0) {
      return [];
    }

    // 按用户分组进行公平轮询
    const userQueues = new Map();
    activeQueues.forEach(queue => {
      if (!userQueues.has(queue.userId)) {
        userQueues.set(queue.userId, []);
      }
      userQueues.get(queue.userId).push(queue);
    });

    const selectedSubTaskIds = [];
    const userIds = Array.from(userQueues.keys());
    let currentUserIndex = 0;

    // 轮询式选择SubTask，确保用户间公平
    while (selectedSubTaskIds.length < batchSize && userIds.length > 0) {
      const userId = userIds[currentUserIndex % userIds.length];
      const queues = userQueues.get(userId);

      // 从该用户的队列中选择下一个SubTask
      let selected = false;
      for (const queue of queues) {
        if (queue.currentIndex < queue.subTasks.length) {
          selectedSubTaskIds.push(queue.subTasks[queue.currentIndex]);
          queue.currentIndex++;
          selected = true;
          break;
        }
      }

      // 如果该用户没有更多任务，从列表中移除
      if (!selected) {
        userIds.splice(currentUserIndex % userIds.length, 1);
        if (userIds.length === 0) break;
      } else {
        currentUserIndex++;
      }
    }

    // 获取SubTask详细信息
    if (selectedSubTaskIds.length > 0) {
      const subTasks = await SubTask.findAll({
        where: {
          id: { [Op.in]: selectedSubTaskIds },
          status: 'pending'
        },
        include: [
          {
            model: Contact,
            as: 'contact',
            attributes: ['id', 'name', 'username', 'first_name', 'last_name', 'email', 'phone', 'company', 'position', 'tiktok_unique_id', 'instagram_id', 'youtube_id', 'custom_field_1', 'custom_field_2', 'custom_field_3', 'custom_field_4', 'custom_field_5']
          },
          {
            model: Template,
            as: 'template',
            attributes: ['id', 'subject', 'body']
          }
        ]
      });

      return subTasks;
    }

    return [];
  }

  /**
   * 启动单个发信服务的定时器（使用系统配置）
   */
  async startServiceTimer(service) {
    const intervalSeconds = await this.getSystemConfig('queue_interval_seconds', this.defaultConfig.queue_interval_seconds);
    const intervalMs = intervalSeconds * 1000;

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
    logger.info(`发信服务 ${service.name} 定时器启动，间隔: ${intervalSeconds}秒`);
  }

  /**
   * 启动定时任务检查器（使用系统配置）
   */
  async startScheduledTaskTimer() {
    const intervalSeconds = await this.getSystemConfig('scheduled_check_interval', this.defaultConfig.scheduled_check_interval);

    this.scheduledTaskTimer = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(this.scheduledTaskTimer);
        return;
      }

      try {
        await this.processScheduledTasks();
      } catch (error) {
        logger.error('定时任务处理失败:', error);
      }
    }, intervalSeconds * 1000);

    logger.info(`scheduled任务检查定时器启动，间隔: ${intervalSeconds}秒`);
  }

  /**
   * 创建SubTask队列时使用增强的模板渲染
   */
  async createSubTaskQueue(task, contacts, transaction) {
    const template = await Template.findByPk(task.template_id);
    if (!template) {
      throw new Error(`模板 ${task.template_id} 不存在`);
    }

    const subTasks = [];
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      const subTask = await SubTask.create({
        id: uuidv4(),
        task_id: task.id,
        contact_id: contact.id,
        template_id: task.template_id,
        sender_email: task.sender_email,
        recipient_email: contact.email,
        rendered_subject: this.renderTemplate(template.subject, contact), // 主题不添加追踪
        rendered_body: this.renderTemplate(template.body, contact), // 正文先不添加追踪
        status: 'pending',
        priority: task.priority || 0,
        scheduled_at: task.scheduled_at || new Date(),
        tracking_id: uuidv4(),
        tracking_data: {}
      }, { transaction });

      subTasks.push(subTask);
    }

    logger.info(`✅ 创建了 ${subTasks.length} 个SubTask`);
    return subTasks;
  }

  // ... 其他现有方法保持不变，但使用增强的渲染函数

  /**
   * 发送邮件时重新渲染模板（包含追踪）
   */
  async allocateAndSendSubTask(subTask, service) {
    try {
      // 重新渲染模板，这次为正文添加追踪功能
      if (subTask.template) {
        const renderedBody = this.renderTemplate(subTask.template.body, subTask.contact, subTask.id);
        await subTask.update({
          rendered_body: renderedBody,
          service_id: service.id,
          status: 'allocated'
        });
      }

      // 发送邮件
      const sendResult = await this.sendEmail(subTask, service);
      return sendResult;

    } catch (error) {
      logger.error(`分配SubTask失败 ${subTask.id}:`, error);
      return { success: false, error: error.message };
    }
  }

  // ... 继续包含其他所有现有方法

  /**
   * 获取系统配置API（供管理员使用）
   */
  async getConfigAPI() {
    const configs = await SystemConfig.findAll({
      where: {
        config_key: {
          [Op.in]: ['queue_batch_size', 'queue_interval_seconds', 'scheduled_check_interval', 'max_retry_attempts']
        }
      }
    });

    const result = {};
    configs.forEach(config => {
      result[config.config_key] = {
        value: JSON.parse(config.config_value),
        description: config.description,
        updated_at: config.updated_at
      };
    });

    return result;
  }

  /**
   * 更新系统配置API（供管理员使用）
   */
  async updateConfigAPI(configs) {
    const allowedKeys = ['queue_batch_size', 'queue_interval_seconds', 'scheduled_check_interval', 'max_retry_attempts'];

    for (const [key, value] of Object.entries(configs)) {
      if (allowedKeys.includes(key)) {
        await this.setSystemConfig(key, value);
      }
    }

    // 重启定时器以应用新配置
    await this.restartTimers();

    return { success: true, message: '配置已更新并应用' };
  }

  /**
   * 重启定时器以应用新配置
   */
  async restartTimers() {
    // 清除现有定时器
    this.serviceTimers.forEach(timer => clearInterval(timer));
    this.serviceTimers.clear();

    if (this.scheduledTaskTimer) {
      clearInterval(this.scheduledTaskTimer);
    }

    // 重新启动
    await this.startServicePolling();
    await this.startScheduledTaskTimer();

    logger.info('⚡ 定时器已重启，新配置已生效');
  }
}

module.exports = EnhancedQueueScheduler; 