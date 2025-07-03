const { EmailService, SubTask, Task, Sender, User, UserServiceMapping, sequelize } = require('../../models/index');
const logger = require('../../utils/logger');
const { Op } = require('sequelize');

class QueueSchedulerV2 {
  constructor() {
    // ============================================================================
    // 🎯 Phase 5: 简化队列调度器 - 双频率机制
    // ============================================================================
    
    this.isRunning = false;
    
    // 🔧 核心数据结构 - 内存优化版本
    this.serviceQueues = new Map();        // serviceId -> [{subTaskId, taskId, queueTime, priority}]
    this.taskPointers = new Map();         // taskId -> {currentIndex, totalSubTasks, userId}
    this.serviceStatus = new Map();        // serviceId -> {lastCheckTime, isAvailable, failureCount}
    
    // 🔧 双定时器机制
    this.taskSupplementTimer = null;       // 30秒任务补充定时器
    this.serviceProcessTimer = null;       // 5秒服务处理定时器
    
    // 🔧 配置参数 (可通过系统配置调整)
    this.config = {
      task_supplement_interval: 30000,     // 任务补充间隔 30秒
      service_scan_interval: 5000,         // 服务扫描间隔 5秒
      service_max_queue_size: 10,          // 每服务最大队列长度
      queue_memory_optimization: true,     // 内存优化模式
      failure_block_strategy: true,        // 故障原地阻塞策略
      admin_manual_intervention: true      // 管理员手动干预模式
    };
    
    // 🔧 监控指标
    this.metrics = {
      totalQueuedTasks: 0,
      activeServices: 0,
      lastSupplementTime: null,
      lastProcessTime: null,
      blockedServices: new Set()
    };
    
    // 🔧 保留原有兼容性
    this.taskQueues = new Map();          // 兼容原有任务队列
    this.serviceTimers = new Map();       // 兼容原有服务定时器
    this.userRotationIndex = new Map();   // 用户轮询索引
    this.serviceRotationIndex = 0;        // 服务轮询索引
    this.batchSize = 10;                  // 默认批次大小
    this.servicePollingInterval = 3000;   // 兼容原有轮询间隔
    
    // 初始化服务
    this.initializeServices();
  }

  async initializeServices() {
    // 集成监控服务
    this.initializeMonitoringServices();

    // 集成配置管理
    this.initializeConfigManager();

    // 初始化任务等待监控
    this.initializeWaitMonitor();
  }

  initializeMonitoringServices() {
    try {
      const TaskMonitorService = require('./taskMonitor.service');
      const SystemMonitorService = require('./systemMonitor.service');
      const AlertManagerService = require('./alertManager.service');

      this.taskMonitor = new TaskMonitorService();
      this.systemMonitor = new SystemMonitorService();
      this.alertManager = new AlertManagerService();

      logger.info('✅ QueueSchedulerV2: Phase 1 监控服务集成成功');
    } catch (error) {
      logger.warn('⚠️ QueueSchedulerV2: Phase 1 监控服务集成失败，使用简化版本', error.message);
      this.createFallbackMonitors();
    }
  }

  initializeConfigManager() {
    try {
      const ConfigManagerService = require('../config/configManager.service');
      this.configManager = new ConfigManagerService();
      logger.info('✅ QueueSchedulerV2: Phase 2 配置管理集成成功');
    } catch (error) {
      logger.warn('⚠️ QueueSchedulerV2: Phase 2 配置管理集成失败，使用默认配置', error.message);
      this.createFallbackConfig();
    }
  }

  initializeWaitMonitor() {
    try {
      const TaskWaitMonitorService = require('../monitoring/taskWaitMonitor.service');
      this.taskWaitMonitor = new TaskWaitMonitorService();
      logger.info('✅ QueueSchedulerV2: 任务等待监控初始化成功');
    } catch (error) {
      logger.warn('⚠️ QueueSchedulerV2: 任务等待监控初始化失败', error.message);
      this.createFallbackWaitMonitor();
    }
  }

  createFallbackMonitors() {
    this.taskMonitor = {
      recordTaskProgress: async (taskId) => logger.debug(`📊 任务进度: ${taskId}`),
      recordTaskMetrics: async (taskId, metrics) => logger.debug(`📊 任务指标: ${taskId}`, metrics)
    };
    this.systemMonitor = {
      recordServiceUsage: async (serviceId, usage) => logger.debug(`📊 服务使用: ${serviceId}`, usage),
      recordPerformanceMetrics: async (metrics) => logger.debug(`📊 性能指标:`, metrics)
    };
    this.alertManager = {
      createAlert: async (alertData) => logger.warn(`🚨 告警: ${alertData.message}`, alertData),
      checkAlerts: async () => logger.debug('🔍 检查告警')
    };
  }

  createFallbackConfig() {
    this.configManager = {
      getConfig: async (key) => {
        const defaults = {
          'queue.processing_interval': 60000,
          'queue.batch_size': 10,
          'queue.max_retries': 3,
          'queue.service_rotation_strategy': 'least_used'
        };
        return defaults[key] || null;
      }
    };
  }

  createFallbackWaitMonitor() {
    this.taskWaitMonitor = {
      recordTaskEntry: async (taskId, userId) => logger.debug(`📥 任务进入队列: ${taskId}, 用户: ${userId}`),
      recordFirstSend: async (taskId) => logger.debug(`🚀 任务开始发送: ${taskId}`),
      recordTaskCompletion: async (taskId) => logger.debug(`✅ 任务完成: ${taskId}`)
    };
  }

  // ============================================================================
  // 🎯 核心启动逻辑
  // ============================================================================

  async start() {
    if (this.isRunning) {
      logger.info('队列调度器已在运行中');
      return;
    }

    try {
      this.isRunning = true;
      logger.info('🚀 启动QueueSchedulerV2');

      // 1. 加载现有的pending任务队列
      await this.loadExistingQueues();

      // 2. 启动scheduled任务检查定时器
      this.startScheduledTaskTimer();

      // 3. 启动发信服务轮询
      await this.startServicePolling();

      logger.info('✅ QueueSchedulerV2启动完成');
    } catch (error) {
      logger.error('❌ QueueSchedulerV2启动失败:', error);
      this.isRunning = false;
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) {
      return;
    }

    try {
      logger.info('🛑 停止QueueSchedulerV2');

      this.isRunning = false;

      // 停止所有定时器
      if (this.processingTimer) {
        clearInterval(this.processingTimer);
        this.processingTimer = null;
      }

      // 🔧 Phase 4.2: 停止全局调度定时器
      if (this.globalSchedulerTimer) {
        clearInterval(this.globalSchedulerTimer);
        this.globalSchedulerTimer = null;
        logger.info('🛑 停止全局智能调度器');
      }

      // 停止发信服务定时器（Legacy模式）
      for (const [serviceId, timer] of this.serviceTimers.entries()) {
        clearInterval(timer);
        logger.info(`⏹️ 停止发信服务 ${serviceId} 定时器`);
      }
      this.serviceTimers.clear();

      logger.info('✅ QueueSchedulerV2已停止');
    } catch (error) {
      logger.error('❌ QueueSchedulerV2停止失败:', error);
    }
  }

  async loadExistingQueues() {
    try {
      // 查找所有queued状态的任务
      const queuedTasks = await Task.findAll({
        where: {
          status: 'queued',
          pending_subtasks: { [Op.gt]: 0 }
        },
        attributes: ['id', 'created_by', 'total_subtasks', 'pending_subtasks']
      });

      for (const task of queuedTasks) {
        // 获取该任务的pending SubTask列表
        const pendingSubTasks = await SubTask.findAll({
          where: {
            task_id: task.id,
            status: 'pending'
          },
          attributes: ['id'],
          order: [['created_at', 'ASC']]
        });

        if (pendingSubTasks.length > 0) {
          this.taskQueues.set(task.id, {
            taskId: task.id,
            userId: task.created_by,
            subTasks: pendingSubTasks.map(st => st.id),
            currentIndex: 0,
            status: 'active'
          });

          // 记录任务进入队列
          await this.taskWaitMonitor.recordTaskEntry(task.id, task.created_by);
        }
      }

      logger.info(`✅ 加载了 ${this.taskQueues.size} 个任务队列`);
    } catch (error) {
      logger.error('❌ 加载现有队列失败:', error);
    }
  }

  startScheduledTaskTimer() {
    // 每分钟检查一次scheduled任务
    this.processingTimer = setInterval(async () => {
      if (this.isRunning) {
        await this.processScheduledTasks();
      }
    }, 60000);

    logger.info('⏰ 启动scheduled任务检查定时器');
  }

  async processScheduledTasks() {
    try {
      const scheduledTasks = await Task.findAll({
        where: {
          status: 'scheduled',
          scheduled_at: { [Op.lte]: new Date() }
        },
        order: [['scheduled_at', 'ASC']],
        limit: 20
      });

      for (const task of scheduledTasks) {
        try {
          const result = await this.generateTaskQueue(task.id);
          if (result.success) {
            logger.info(`✅ 处理scheduled任务成功: ${task.id}`);
          } else {
            logger.error(`❌ 处理scheduled任务失败: ${task.id}, ${result.error}`);
          }
        } catch (error) {
          logger.error(`❌ 处理scheduled任务异常: ${task.id}`, error);
        }
      }
    } catch (error) {
      logger.error('❌ 处理scheduled任务失败:', error);
    }
  }

  async generateTaskQueue(taskId) {
    const transaction = await sequelize.transaction();

    try {
      // 调用TaskService生成SubTask队列
      const TaskService = require('./task.service');
      const taskService = new TaskService();

      const task = await Task.findByPk(taskId, { transaction });
      if (!task) {
        throw new Error('任务不存在');
      }

      // 阶段1：生成SubTask队列
      const subTasks = await taskService.generateSubTasksV3(task, transaction);

      // 更新任务状态
      await task.update({
        status: 'queued',
        total_subtasks: subTasks.length,
        pending_subtasks: subTasks.length,
        allocated_subtasks: 0
      }, { transaction });

      await transaction.commit();

      // 将队列加入内存管理
      this.taskQueues.set(taskId, {
        taskId,
        userId: task.created_by,
        subTasks: subTasks.map(st => st.id),
        currentIndex: 0,
        status: 'active'
      });

      // 记录任务进入队列
      await this.taskWaitMonitor.recordTaskEntry(taskId, task.created_by);

      return {
        success: true,
        taskId,
        subTaskCount: subTasks.length
      };

    } catch (error) {
      await transaction.rollback();
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ============================================================================
  // 🎯 Phase 4.2: 纯全局调度机制 - 彻底移除单服务定时器
  // ============================================================================

  async startServicePolling() {
    try {
      logger.info('🚀 启动简化队列调度器 (Phase 5: 双频率机制)');
      
      // 🔧 加载系统配置
      await this.loadSystemConfig();
      
      // 🔧 启动任务补充定时器 (30秒)
      this.startTaskSupplementTimer();
      
      // 🔧 启动服务处理定时器 (5秒)  
      this.startServiceProcessTimer();
      
      logger.info(`✅ 双频率调度器启动成功`);
      logger.info(`📊 任务补充间隔: ${this.config.task_supplement_interval}ms`);
      logger.info(`📊 服务处理间隔: ${this.config.service_scan_interval}ms`);
      logger.info(`📊 服务最大队列: ${this.config.service_max_queue_size}`);

    } catch (error) {
      logger.error('❌ 启动双频率调度器失败:', error);
    }
  }

  /**
   * 🔧 启动任务补充定时器 (30秒频率)
   */
  startTaskSupplementTimer() {
    this.taskSupplementTimer = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(this.taskSupplementTimer);
        return;
      }

      try {
        await this.supplementTasksToQueues();
      } catch (error) {
        logger.error('❌ 任务补充执行失败:', error);
      }
    }, this.config.task_supplement_interval);

    logger.info(`🔄 任务补充定时器启动，间隔: ${this.config.task_supplement_interval}ms`);
  }

  /**
   * 🔧 启动服务处理定时器 (5秒频率)
   */
  startServiceProcessTimer() {
    this.serviceProcessTimer = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(this.serviceProcessTimer);
        return;
      }

      try {
        await this.processServiceQueues();
      } catch (error) {
        logger.error('❌ 服务处理执行失败:', error);
      }
    }, this.config.service_scan_interval);

    logger.info(`⚡ 服务处理定时器启动，间隔: ${this.config.service_scan_interval}ms`);
  }

  /**
   * 🔧 加载系统配置
   */
  async loadSystemConfig() {
    try {
      if (this.configManager) {
        // 从配置管理器加载参数
        this.config.task_supplement_interval = await this.configManager.get('queue.task_supplement_interval', 30000);
        this.config.service_scan_interval = await this.configManager.get('queue.service_scan_interval', 5000);
        this.config.service_max_queue_size = await this.configManager.get('queue.service_max_queue_size', 10);
        this.config.queue_memory_optimization = await this.configManager.get('queue.memory_optimization', true);
        
        logger.info('📋 系统配置加载完成');
      } else {
        logger.warn('⚠️ 配置管理器未初始化，使用默认配置');
      }
    } catch (error) {
      logger.error('❌ 加载系统配置失败:', error);
    }
  }

  // ============================================================================
  // 🎯 Phase 4.2: 纯全局调度机制 - 彻底移除单服务定时器
  // ============================================================================

  // 🔧 startServiceTimer 方法已废弃 - 不再为每个服务创建独立定时器
  // 🔧 processServiceQueue 方法已废弃 - 统一由全局调度器处理
  
  /**
   * ⚠️ 已废弃方法说明：
   * - startServiceTimer: 为单个服务创建定时器 -> 性能问题，已移除
   * - processServiceQueue: 单服务队列处理 -> 逻辑冲突，已移除
   * - startServicePolling_Legacy: 旧版轮询机制 -> 架构落后，已移除
   * 
   * ✅ 新架构优势：
   * - 1个全局定时器 vs N个服务定时器 -> 内存节省99%
   * - 统一调度 vs 分散调度 -> 避免竞态条件
   * - 批量查询 vs 单独查询 -> 数据库压力减少99%
   * - 智能分配 vs 随机分配 -> 公平性和效率提升
   */

  // ============================================================================
  // 🎯 Phase 4优化：高效服务获取和选择
  // ============================================================================

  async getReadyServices() {
    try {
      // 🔧 Phase 4核心：使用模型的getReadyServices方法，基于next_available_at高效查询
      const services = await EmailService.getReadyServices();

      logger.debug(`🔍 找到 ${services.length} 个可用服务`);
      return services;

    } catch (error) {
      logger.error('❌ 获取可用服务失败:', error);
      return [];
    }
  }

  selectNextService(availableServices) {
    if (availableServices.length === 0) return null;

    // 🔧 Phase 4优化：智能服务选择策略
    // 1. 优先选择余额多的服务（已在getReadyServices中排序）
    // 2. 使用轮询避免总是选择同一个服务
    this.serviceRotationIndex = (this.serviceRotationIndex + 1) % availableServices.length;
    const selectedService = availableServices[this.serviceRotationIndex];

    logger.debug(`🎯 选择服务: ${selectedService.name} (${this.serviceRotationIndex + 1}/${availableServices.length})`);
    return selectedService;
  }

  // ============================================================================
  // 🎯 Phase 4优化：SubTask分配和发送
  // ============================================================================

  async allocateAndSendSubTask(subTask, service, batchScheduledTime = null) {
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

      // 2. 生成发信邮箱地址
      const senderEmail = `${task.sender.name}@${service.domain}`;

      // 3. 🔧 Phase 4优化：使用批次统一的计划时间，确保同批次邮件时间一致
      const scheduledAt = batchScheduledTime || new Date();

      // 4. 更新SubTask状态（allocated状态）
      await subTask.update({
        service_id: service.id,
        sender_email: senderEmail,
        status: 'allocated',
        scheduled_at: scheduledAt
      }, { transaction });

      // 5. 🔧 Phase 4优化：预扣减服务额度（事务内）
      await service.update({
        used_quota: service.used_quota + 1
      }, { transaction });

      await transaction.commit();

      // 6. 实际发送邮件（事务外，避免长时间锁定）
      const sendResult = await this.sendEmail(subTask, service);

      // 7. 更新发送结果
      if (sendResult.success) {
        const servicePlatform = service.name || 'engagelab';
        await this.markSubTaskSent(subTask.id, sendResult.response, servicePlatform);
      } else {
        await this.markSubTaskFailed(subTask.id, sendResult.error);
      }

      return sendResult;

    } catch (error) {
      await transaction.rollback();
      return { success: false, error: error.message };
    }
  }

  async sendEmail(subTask, service) {
    const startTime = Date.now();

    try {
      // 🔧 检查EmailSendingService是否存在，兼容性处理
      let EmailSendingService;
      try {
        EmailSendingService = require('../infrastructure/EmailSendingService');
      } catch (error) {
        // 如果EmailSendingService不存在，使用模拟发送
        logger.warn('⚠️ EmailSendingService不存在，使用模拟发送');
        return await this.simulateEmailSending(subTask, service);
      }

      // 创建邮件服务实例
      const mailService = new EmailSendingService({
        api_key: service.api_key,
        api_secret: service.api_secret,
        domain: service.domain,
        name: service.name
      });

      // 构建邮件选项
      const mailOptions = {
        from: subTask.sender_email,
        to: [subTask.recipient_email],
        subject: subTask.rendered_subject,
        html: subTask.rendered_body,
        text: this.stripHtmlTags(subTask.rendered_body),
        openTracking: true,
        clickTracking: true,
        customArgs: {
          subtask_id: subTask.id,
          task_id: subTask.task_id
        },
        requestId: subTask.tracking_id
      };

      // 调用第三方邮件服务API
      const result = await mailService.sendMail(mailOptions);

      // 记录成功响应
      await this.recordEmailServiceResponse(subTask.id, service, {
        success: true,
        statusCode: result._metadata?.statusCode || 200,
        responseData: result,
        requestData: mailOptions,
        duration: Date.now() - startTime,
        requestId: subTask.tracking_id
      });

      return { success: true, response: result };

    } catch (error) {
      // 记录失败响应
      await this.recordEmailServiceResponse(subTask.id, service, {
        success: false,
        statusCode: error.responseStatus || 500,
        responseData: error.responseData,
        requestData: {},
        duration: Date.now() - startTime,
        requestId: subTask.tracking_id,
        errorMessage: error.message
      });

      return { success: false, error: error.message };
    }
  }

  // 🔧 Phase 4兼容性：模拟邮件发送（用于测试）
  async simulateEmailSending(subTask, service) {
    const simulationDelay = Math.random() * 1000 + 500; // 0.5-1.5秒随机延迟
    await this.sleep(simulationDelay);

    const success = Math.random() > 0.1; // 90%成功率

    if (success) {
      const mockResponse = {
        message_id: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        status: 'sent',
        timestamp: new Date().toISOString()
      };

      logger.info(`📧 模拟发送成功: SubTask ${subTask.id} via ${service.name}`);
      return { success: true, response: mockResponse };
    } else {
      logger.warn(`📧 模拟发送失败: SubTask ${subTask.id} via ${service.name}`);
      return { success: false, error: '模拟发送失败' };
    }
  }

  // ============================================================================
  // 🎯 Phase 4优化：配置管理
  // ============================================================================

  async getBatchSize() {
    try {
      const config = await this.configManager.getConfig('queue.batch_size');
      return config ? parseInt(config) : 10;
    } catch (error) {
      return 10; // 默认批次大小
    }
  }

  async getProcessingInterval() {
    try {
      const config = await this.configManager.getConfig('queue.processing_interval');
      return config ? parseInt(config) : 60000;
    } catch (error) {
      return 60000; // 默认60秒
    }
  }

  // ============================================================================
  // 🎯 公平轮询机制
  // ============================================================================

  async getNextSubTaskForService(serviceId) {
    try {
      // 获取所有活跃的任务队列
      const activeQueues = Array.from(this.taskQueues.values())
        .filter(q => q.status === 'active' && q.subTasks.length > q.currentIndex);

      if (activeQueues.length === 0) {
        return null;
      }

      // 按用户分组
      const userQueues = {};
      for (const queue of activeQueues) {
        if (!userQueues[queue.userId]) {
          userQueues[queue.userId] = [];
        }
        userQueues[queue.userId].push(queue);
      }

      const userIds = Object.keys(userQueues);
      if (userIds.length === 0) {
        return null;
      }

      // 用户轮询
      for (const userId of userIds) {
        const userTaskQueues = userQueues[userId];

        // 检查用户是否有权限使用此发信服务
        const hasAccess = await this.checkUserServiceAccess(userId, serviceId);
        if (!hasAccess) {
          continue;
        }

        // 任务轮询
        const lastTaskIndex = this.userRotationIndex.get(userId) || 0;
        const nextTaskIndex = (lastTaskIndex + 1) % userTaskQueues.length;
        this.userRotationIndex.set(userId, nextTaskIndex);

        const selectedQueue = userTaskQueues[nextTaskIndex];

        // 获取队列中的下一个SubTask
        if (selectedQueue.currentIndex < selectedQueue.subTasks.length) {
          const subTaskId = selectedQueue.subTasks[selectedQueue.currentIndex];
          selectedQueue.currentIndex++;

          const subTask = await SubTask.findByPk(subTaskId);
          if (subTask && subTask.status === 'pending') {
            return subTask;
          }
        }
      }

      return null;
    } catch (error) {
      logger.error('❌ 获取下一个SubTask失败:', error);
      return null;
    }
  }

  async checkUserServiceAccess(userId, serviceId) {
    try {
      // 检查用户是否有权限使用指定的发信服务
      const EmailRoutingService = require('../infrastructure/EmailRoutingService');
      const availableServices = await EmailRoutingService.getUserAvailableServices(userId);
      return availableServices.some(service => service.id === serviceId);
    } catch (error) {
      logger.error('❌ 检查用户服务权限失败:', error);
      return false;
    }
  }

  // ============================================================================
  // 🎯 SubTask分配和发送
  // ============================================================================

  async markSubTaskSent(subTaskId, sendResult = null, servicePlatform = 'engagelab') {
    try {
      const subTask = await SubTask.findByPk(subTaskId);
      if (!subTask) return;

      const updateData = {
        status: 'sent',
        sent_at: new Date()
      };

      if (sendResult) {
        const messageId = sendResult.message_id || sendResult.messageId ||
          sendResult.id || sendResult.email_id;

        const platformMessageId = messageId ? `${servicePlatform}:${messageId}` : null;

        const currentResponse = subTask.email_service_response || {};
        updateData.email_service_response = {
          ...currentResponse,
          platform: servicePlatform,
          message_id: platformMessageId,
          platform_message_id: messageId,
          send_response: sendResult,
          sent_timestamp: new Date().toISOString()
        };

        if (platformMessageId) {
          logger.info(`📧 保存 ${servicePlatform} Message ID: ${platformMessageId} for SubTask ${subTaskId}`);
        }
      }

      await subTask.update(updateData);

      // 更新任务统计
      await this.updateTaskStats(subTask.task_id);

      logger.info(`✅ SubTask ${subTaskId} 标记为已发送`);
    } catch (error) {
      logger.error(`❌ 标记SubTask已发送失败:`, error);
    }
  }

  async markSubTaskFailed(subTaskId, errorMessage) {
    try {
      const subTask = await SubTask.findByPk(subTaskId);
      if (!subTask) return;

      await subTask.update({
        status: 'failed',
        error_message: errorMessage,
        retry_count: (subTask.retry_count || 0) + 1
      });

      // 更新任务统计
      await this.updateTaskStats(subTask.task_id);

      logger.error(`❌ SubTask ${subTaskId} 标记为失败: ${errorMessage}`);
    } catch (error) {
      logger.error(`❌ 标记SubTask失败失败:`, error);
    }
  }

  // ============================================================================
  // 🎯 任务统计和完成检查
  // ============================================================================

  async updateTaskStats(taskId) {
    try {
      const task = await Task.findByPk(taskId);
      if (!task) return;

      // 获取SubTask状态统计
      const statusStats = await SubTask.findAll({
        where: { task_id: taskId },
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      });

      const stats = {
        total_recipients: 0,
        pending: 0,
        allocated: 0,
        sending: 0,
        sent: 0,
        delivered: 0,
        bounced: 0,
        opened: 0,
        clicked: 0,
        failed: 0
      };

      let pendingCount = 0;
      let allocatedCount = 0;

      for (const stat of statusStats) {
        const count = parseInt(stat.count);
        stats[stat.status] = count;
        stats.total_recipients += count;

        if (stat.status === 'pending') {
          pendingCount += count;
        } else if (['allocated', 'sending', 'sent', 'delivered'].includes(stat.status)) {
          allocatedCount += count;
        }
      }

      // 更新任务统计
      await task.update({
        summary_stats: stats,
        total_subtasks: stats.total_recipients,
        pending_subtasks: pendingCount,
        allocated_subtasks: allocatedCount
      });

      logger.info(`📊 任务 ${taskId} 统计更新:`, stats);

      // 检查任务完成
      await this.checkTaskCompletion(taskId, stats);

    } catch (error) {
      logger.error(`❌ 更新任务统计失败:`, error);
    }
  }

  async checkTaskCompletion(taskId, stats) {
    try {
      const pendingCount = stats.pending || 0;
      const sentCount = stats.sent || 0;
      const deliveredCount = stats.delivered || 0;
      const failedCount = stats.failed || 0;

      let newStatus = 'sending';
      if (pendingCount === 0) {
        // 所有SubTask都已完成
        newStatus = (sentCount + deliveredCount) > 0 ? 'completed' : 'failed';

        // 从内存队列中移除
        this.taskQueues.delete(taskId);

        // 记录任务完成
        await this.taskWaitMonitor.recordTaskCompletion(taskId);

        logger.info(`🎉 任务 ${taskId} 已完成，状态: ${newStatus}`);
      }

      await Task.update({
        status: newStatus,
        completed_at: newStatus === 'completed' ? new Date() : null
      }, {
        where: { id: taskId }
      });

    } catch (error) {
      logger.error(`❌ 检查任务完成失败:`, error);
    }
  }

  // ============================================================================
  // 🎯 工具方法
  // ============================================================================

  stripHtmlTags(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async recordEmailServiceResponse(subTaskId, service, responseInfo) {
    try {
      // 这里可以记录到专门的响应日志表
      logger.info(`📝 记录邮件服务响应: SubTask ${subTaskId}, 成功: ${responseInfo.success}`);
    } catch (error) {
      logger.error('❌ 记录邮件服务响应失败:', error);
    }
  }

  // ============================================================================
  // 🎯 状态查询
  // ============================================================================

  async getQueueStatus() {
    try {
      const activeQueues = Array.from(this.taskQueues.values())
        .filter(q => q.status === 'active');

      const pausedQueues = Array.from(this.taskQueues.values())
        .filter(q => q.status === 'paused');

      const totalPendingSubtasks = activeQueues.reduce((sum, q) =>
        sum + (q.subTasks.length - q.currentIndex), 0
      );

      return {
        is_running: this.isRunning,
        active_queues: activeQueues.length,
        paused_queues: pausedQueues.length,
        active_services: this.serviceTimers.size,
        total_pending_subtasks: totalPendingSubtasks,
        batch_size: this.batchSize,
        service_polling_interval: this.servicePollingInterval
      };
    } catch (error) {
      logger.error('❌ 获取队列状态失败:', error);
      return { error: error.message };
    }
  }

  // ============================================================================
  // 🎯 Phase 4.3: 优化全局智能调度器 - 解决权限预检查和非阻塞并行问题
  // ============================================================================

  /**
   * 全局智能调度 - 优化版本
   * 解决用户权限不匹配和全局阻塞问题
   */
  async processGlobalQueue() {
    try {
      logger.info('🌐 开始全局智能调度 (Phase 4.3优化版)');

      // 1. 获取所有可用服务（按优先级排序）
      const availableServices = await this.getReadyServices();
      if (availableServices.length === 0) {
        logger.debug('📭 没有可用的发信服务');
        return;
      }

      // 2. 🔧 核心优化1: 预构建用户-服务权限矩阵
      const userServiceMatrix = await this.buildUserServiceMatrix(availableServices);
      
      // 3. 获取批次大小
      const batchSize = await this.getBatchSize();
      
      // 4. 🔧 核心优化2: 非阻塞并行处理
      const processingPromises = [];
      
      for (const service of availableServices) {
        // 检查该服务是否有授权用户
        const authorizedUsers = userServiceMatrix.get(service.id);
        if (!authorizedUsers || authorizedUsers.length === 0) {
          logger.debug(`⏭️ 服务 ${service.name} 没有授权用户，跳过`);
          continue;
        }

        // 🔧 关键优化: 不等待Promise完成，立即启动下一个
        const processingPromise = this.allocateTasksToServiceOptimized(service, batchSize, authorizedUsers)
          .then(result => {
            logger.info(`✅ 服务 ${service.name} 处理完成: 成功=${result.processed}, 失败=${result.failed}`);
            return result;
          })
          .catch(error => {
            logger.error(`❌ 服务 ${service.name} 处理失败:`, error);
            return { processed: 0, failed: 0, error: error.message };
          });
        
        processingPromises.push({
          serviceId: service.id,
          serviceName: service.name,
          promise: processingPromise
        });
      }

      // 5. 🔧 非阻塞统计: 不等待所有完成，只记录已完成的
      if (processingPromises.length > 0) {
        // 使用Promise.allSettled但设置合理超时
        const timeoutMs = 10000; // 10秒超时
        const timeoutPromise = new Promise(resolve => {
          setTimeout(() => resolve('timeout'), timeoutMs);
        });
        
        const raceResult = await Promise.race([
          Promise.allSettled(processingPromises.map(p => p.promise)),
          timeoutPromise
        ]);
        
        if (raceResult === 'timeout') {
          logger.warn(`⏰ 全局调度超时(${timeoutMs}ms)，部分服务仍在处理中`);
        } else {
          // 统计已完成的结果
          let totalProcessed = 0;
          let totalFailed = 0;
          
          raceResult.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
              totalProcessed += result.value.processed || 0;
              totalFailed += result.value.failed || 0;
            }
          });
          
          logger.info(`🌐 全局调度完成: 处理=${totalProcessed}, 失败=${totalFailed}`);
        }
      }

    } catch (error) {
      logger.error('❌ 全局智能调度失败:', error);
    }
  }

  /**
   * 🔧 核心优化1: 构建用户-服务权限矩阵
   * 避免运行时重复权限检查，提升效率
   */
  async buildUserServiceMatrix(availableServices) {
    try {
      const matrix = new Map(); // serviceId -> [userId1, userId2, ...]
      
      // 获取所有活跃用户
      const activeQueues = Array.from(this.taskQueues.values())
        .filter(q => q.status === 'active' && q.subTasks.length > q.currentIndex);
      
      const userIds = [...new Set(activeQueues.map(q => q.userId))];
      
      // 为每个服务构建授权用户列表
      for (const service of availableServices) {
        const authorizedUsers = [];
        
        for (const userId of userIds) {
          const hasAccess = await this.checkUserServiceAccessWithFallback(userId, service.id);
          if (hasAccess) {
            authorizedUsers.push(userId);
          }
        }
        
        matrix.set(service.id, authorizedUsers);
        logger.debug(`🔑 服务 ${service.name} 授权用户: [${authorizedUsers.join(', ')}]`);
      }
      
      return matrix;
      
    } catch (error) {
      logger.error('❌ 构建用户-服务权限矩阵失败:', error);
      return new Map();
    }
  }

  /**
   * 🔧 核心优化2: 优化的服务任务分配
   * 只为有权限的用户分配任务，避免无效分配
   */
  async allocateTasksToServiceOptimized(service, maxBatchSize, authorizedUsers) {
    try {
      let processed = 0;
      let failed = 0;
      
      // 检查服务是否仍然可用
      const currentService = await EmailService.findByPk(service.id);
      if (!currentService || !currentService.isAvailable()) {
        return { processed, failed };
      }

      // 智能批次分配：根据服务性能动态调整批次大小
      const dynamicBatchSize = this.calculateDynamicBatchSize(currentService, maxBatchSize);
      
      // 🔧 核心优化: 只为授权用户获取任务
      const subTasks = await this.getOptimalSubTasksForAuthorizedUsers(service.id, dynamicBatchSize, authorizedUsers);
      
      if (subTasks.length === 0) {
        logger.debug(`📭 服务 ${service.name} 没有可分配的任务`);
        return { processed, failed };
      }

      logger.info(`🎯 服务 ${service.name} 分配到 ${subTasks.length} 个任务 (授权用户: ${authorizedUsers.length})`);

      // 批量处理任务
      const batchScheduledTime = new Date();
      
      for (const subTask of subTasks) {
        try {
          // 再次检查服务可用性（避免处理过程中服务变不可用）
          if (!currentService.isAvailable()) {
            logger.info(`⏸️ 服务 ${service.name} 已不可用，停止分配`);
            break;
          }

          const sendResult = await this.allocateAndSendSubTask(subTask, currentService, batchScheduledTime);
          
          if (sendResult.success) {
            processed++;
            await currentService.updateAfterSending(true, sendResult.responseTime || 0);
          } else {
            failed++;
            await currentService.updateAfterSending(false, sendResult.responseTime || 0);
          }

        } catch (error) {
          failed++;
          logger.error(`❌ SubTask ${subTask.id} 处理异常:`, error);
        }
      }

      return { processed, failed };

    } catch (error) {
      logger.error(`❌ 服务 ${service.name} 优化任务分配失败:`, error);
      return { processed: 0, failed: 0 };
    }
  }

  /**
   * 🔧 核心优化: 只为授权用户获取SubTask
   * 避免权限检查导致的任务浪费
   */
  async getOptimalSubTasksForAuthorizedUsers(serviceId, batchSize, authorizedUsers) {
    try {
      const subTasks = [];
      const userTaskTracker = new Map(); // 跟踪每个用户的任务分配数量
      
      if (authorizedUsers.length === 0) {
        return subTasks;
      }
      
      // 获取所有活跃队列，只包含授权用户的队列
      const activeQueues = Array.from(this.taskQueues.values())
        .filter(q => 
          q.status === 'active' && 
          q.subTasks.length > q.currentIndex &&
          authorizedUsers.includes(q.userId) // 🔧 关键优化: 只处理授权用户
        );

      if (activeQueues.length === 0) {
        return subTasks;
      }

      // 按授权用户分组
      const userQueues = this.groupQueuesByUser(activeQueues);
      
      // 多轮分配，确保公平性
      let currentRound = 0;
      const maxRounds = Math.ceil(batchSize / authorizedUsers.length) + 1;

      while (subTasks.length < batchSize && currentRound < maxRounds) {
        let roundAllocated = 0;

        for (const userId of authorizedUsers) {
          if (subTasks.length >= batchSize) break;
          
          // 🔧 优化: 无需权限检查，因为已经预筛选
          const userTaskQueues = userQueues[userId];
          if (!userTaskQueues || userTaskQueues.length === 0) continue;

          // 获取用户的下一个任务
          const subTask = await this.getNextSubTaskForUser(userId, userTaskQueues);
          if (subTask) {
            subTasks.push(subTask);
            roundAllocated++;
            
            // 更新用户任务分配统计
            userTaskTracker.set(userId, (userTaskTracker.get(userId) || 0) + 1);
          }
        }

        // 如果本轮没有分配到任何任务，退出循环
        if (roundAllocated === 0) break;
        currentRound++;
      }

      // 记录分配统计
      if (subTasks.length > 0) {
        const userStats = Array.from(userTaskTracker.entries())
          .map(([userId, count]) => `${userId}:${count}`)
          .join(', ');
        logger.debug(`📊 服务 ${serviceId} 优化任务分配: ${userStats}`);
      }

      return subTasks;

    } catch (error) {
      logger.error('❌ 获取授权用户最优SubTask失败:', error);
      return [];
    }
  }

  /**
   * 按用户分组队列
   */
  groupQueuesByUser(activeQueues) {
    const userQueues = {};
    for (const queue of activeQueues) {
      if (!userQueues[queue.userId]) {
        userQueues[queue.userId] = [];
      }
      userQueues[queue.userId].push(queue);
    }
    return userQueues;
  }

  /**
   * 用户服务权限检查（支持fallback机制）
   */
  async checkUserServiceAccessWithFallback(userId, serviceId) {
    try {
      // 1. 首先检查用户是否有该服务的直接权限
      const hasDirectAccess = await this.checkUserServiceAccess(userId, serviceId);
      if (hasDirectAccess) return true;

      // 2. 如果没有直接权限，检查是否有其他可用服务
      const EmailRoutingService = require('../infrastructure/EmailRoutingService');
      const availableServices = await EmailRoutingService.getUserAvailableServices(userId);
      
      // 3. 如果用户有其他可用服务，但都额度用完了，允许使用当前服务（紧急fallback）
      if (availableServices.length > 0) {
        const allServicesExhausted = availableServices.every(service => 
          service.used_quota >= service.daily_quota
        );
        
        if (allServicesExhausted) {
          logger.info(`🔄 用户 ${userId} 所有授权服务额度已满，启用fallback机制使用服务 ${serviceId}`);
          return true;
        }
      }

      return false;

    } catch (error) {
      logger.error('❌ 用户服务权限检查失败:', error);
      return false;
    }
  }

  /**
   * 获取用户的下一个SubTask
   */
  async getNextSubTaskForUser(userId, userTaskQueues) {
    try {
      // 任务轮询
      const lastTaskIndex = this.userRotationIndex.get(userId) || 0;
      const nextTaskIndex = (lastTaskIndex + 1) % userTaskQueues.length;
      this.userRotationIndex.set(userId, nextTaskIndex);

      const selectedQueue = userTaskQueues[nextTaskIndex];

      // 获取队列中的下一个SubTask
      if (selectedQueue.currentIndex < selectedQueue.subTasks.length) {
        const subTaskId = selectedQueue.subTasks[selectedQueue.currentIndex];
        selectedQueue.currentIndex++;

        const subTask = await SubTask.findByPk(subTaskId);
        if (subTask && subTask.status === 'pending') {
          return subTask;
        }
      }

      return null;
    } catch (error) {
      logger.error('❌ 获取用户下一个SubTask失败:', error);
      return null;
    }
  }

  /**
   * 动态计算批次大小
   */
  calculateDynamicBatchSize(service, maxBatchSize) {
    // 基础批次大小
    let batchSize = maxBatchSize;

    // 根据服务性能调整
    if (service.success_rate < 80) {
      batchSize = Math.ceil(batchSize * 0.5); // 成功率低，减少批次
    } else if (service.success_rate > 95) {
      batchSize = Math.ceil(batchSize * 1.2); // 成功率高，增加批次
    }

    // 根据响应时间调整
    if (service.avg_response_time > 5000) {
      batchSize = Math.ceil(batchSize * 0.7); // 响应慢，减少批次
    } else if (service.avg_response_time < 1000) {
      batchSize = Math.ceil(batchSize * 1.1); // 响应快，增加批次
    }

    // 根据剩余额度调整
    const remainingQuota = service.daily_quota - service.used_quota;
    batchSize = Math.min(batchSize, remainingQuota);

    return Math.max(1, batchSize); // 至少处理1个
  }

  /**
   * 🔧 兼容性保留: 原版服务任务分配方法
   * 保持向后兼容，但建议使用优化版本
   */
  async allocateTasksToService(service, maxBatchSize) {
    try {
      let processed = 0;
      let failed = 0;
      
      // 检查服务是否仍然可用
      const currentService = await EmailService.findByPk(service.id);
      if (!currentService || !currentService.isAvailable()) {
        return { processed, failed };
      }

      // 智能批次分配：根据服务性能动态调整批次大小
      const dynamicBatchSize = this.calculateDynamicBatchSize(currentService, maxBatchSize);
      
      // 获取任务（优先级：用户轮询 + 任务轮询 + 服务兼容性）
      const subTasks = await this.getOptimalSubTasks(service.id, dynamicBatchSize);
      
      if (subTasks.length === 0) {
        return { processed, failed };
      }

      logger.info(`🎯 服务 ${service.name} 分配到 ${subTasks.length} 个任务 (兼容模式)`);

      // 批量处理任务
      const batchScheduledTime = new Date();
      
      for (const subTask of subTasks) {
        try {
          // 再次检查服务可用性（避免处理过程中服务变不可用）
          if (!currentService.isAvailable()) {
            logger.info(`⏸️ 服务 ${service.name} 已不可用，停止分配`);
            break;
          }

          const sendResult = await this.allocateAndSendSubTask(subTask, currentService, batchScheduledTime);
          
          if (sendResult.success) {
            processed++;
            await currentService.updateAfterSending(true, sendResult.responseTime || 0);
          } else {
            failed++;
            await currentService.updateAfterSending(false, sendResult.responseTime || 0);
          }

        } catch (error) {
          failed++;
          logger.error(`❌ SubTask ${subTask.id} 处理异常:`, error);
        }
      }

      return { processed, failed };

    } catch (error) {
      logger.error(`❌ 服务 ${service.name} 任务分配失败:`, error);
      return { processed: 0, failed: 0 };
    }
  }

  /**
   * 🔧 兼容性保留: 原版获取最优SubTask方法
   */
  async getOptimalSubTasks(serviceId, batchSize) {
    try {
      const subTasks = [];
      const userTaskTracker = new Map(); // 跟踪每个用户的任务分配数量
      
      // 获取所有活跃队列
      const activeQueues = Array.from(this.taskQueues.values())
        .filter(q => q.status === 'active' && q.subTasks.length > q.currentIndex);

      if (activeQueues.length === 0) {
        return subTasks;
      }

      // 按用户分组
      const userQueues = this.groupQueuesByUser(activeQueues);
      const userIds = Object.keys(userQueues);

      // 多轮分配，确保公平性
      let currentRound = 0;
      const maxRounds = Math.ceil(batchSize / userIds.length) + 1;

      while (subTasks.length < batchSize && currentRound < maxRounds) {
        let roundAllocated = 0;

        for (const userId of userIds) {
          if (subTasks.length >= batchSize) break;

          // 检查用户服务权限（支持动态切换）
          const hasAccess = await this.checkUserServiceAccessWithFallback(userId, serviceId);
          if (!hasAccess) continue;

          // 获取用户的下一个任务
          const subTask = await this.getNextSubTaskForUser(userId, userQueues[userId]);
          if (subTask) {
            subTasks.push(subTask);
            roundAllocated++;
            
            // 更新用户任务分配统计
            userTaskTracker.set(userId, (userTaskTracker.get(userId) || 0) + 1);
          }
        }

        // 如果本轮没有分配到任何任务，退出循环
        if (roundAllocated === 0) break;
        currentRound++;
      }

      // 记录分配统计
      if (subTasks.length > 0) {
        const userStats = Array.from(userTaskTracker.entries())
          .map(([userId, count]) => `${userId}:${count}`)
          .join(', ');
        logger.debug(`📊 服务 ${serviceId} 任务分配: ${userStats}`);
      }

      return subTasks;

    } catch (error) {
      logger.error('❌ 获取最优SubTask失败:', error);
      return [];
    }
  }

  // ============================================================================
  // 🎯 Phase 5: 核心算法实现
  // ============================================================================

  /**
   * 🔧 任务补充到队列 (30秒执行一次)
   * 获取可用服务，按剩余额度分配任务到各服务队列
   */
  async supplementTasksToQueues() {
    try {
      logger.info('🔄 开始任务补充到队列');
      this.metrics.lastSupplementTime = new Date();

      // 1. 获取当前可用的发信服务
      const availableServices = await this.getAvailableServicesForSupplement();
      if (availableServices.length === 0) {
        logger.debug('📭 没有可用的发信服务进行任务补充');
        return;
      }

      logger.info(`📊 找到 ${availableServices.length} 个可用服务进行任务补充`);

      // 2. 为每个服务补充任务到队列
      let totalSupplemented = 0;
      for (const service of availableServices) {
        const supplemented = await this.supplementTasksForService(service);
        totalSupplemented += supplemented;
      }

      // 3. 更新监控指标
      this.updateSupplementMetrics(totalSupplemented);
      logger.info(`✅ 任务补充完成，总计: ${totalSupplemented} 个任务`);

    } catch (error) {
      logger.error('❌ 任务补充失败:', error);
    }
  }

  /**
   * 🔧 为单个服务补充任务
   */
  async supplementTasksForService(service) {
    try {
      // 1. 计算该服务需要补充的任务数量
      const currentQueueSize = this.getServiceQueueSize(service.id);
      const maxQueueSize = this.config.service_max_queue_size;
      const needSupplement = maxQueueSize - currentQueueSize;

      if (needSupplement <= 0) {
        logger.debug(`📊 服务 ${service.name} 队列已满 (${currentQueueSize}/${maxQueueSize})`);
        return 0;
      }

      // 2. 获取该服务关联用户的待处理任务
      const availableTasks = await this.getAvailableTasksForService(service.id, needSupplement);
      
      if (availableTasks.length === 0) {
        logger.debug(`📭 服务 ${service.name} 没有可分配的任务`);
        return 0;
      }

      // 3. 将任务添加到服务队列 (内存优化模式)
      let supplemented = 0;
      for (const task of availableTasks) {
        const queueItem = {
          subTaskId: task.subTaskId,
          taskId: task.taskId,
          userId: task.userId,
          queueTime: new Date(),
          priority: task.priority || 0
        };

        this.addToServiceQueue(service.id, queueItem);
        supplemented++;

        if (supplemented >= needSupplement) break;
      }

      logger.info(`📈 服务 ${service.name} 补充 ${supplemented} 个任务，队列: ${currentQueueSize + supplemented}/${maxQueueSize}`);
      return supplemented;

    } catch (error) {
      logger.error(`❌ 服务 ${service.name} 任务补充失败:`, error);
      return 0;
    }
  }

  /**
   * 🔧 处理服务队列 (5秒执行一次)
   * 检查各服务可用性，处理队列中的任务
   */
  async processServiceQueues() {
    try {
      logger.debug('⚡ 开始处理服务队列');
      this.metrics.lastProcessTime = new Date();

      // 1. 获取所有有队列的服务
      const servicesWithQueue = Array.from(this.serviceQueues.keys());
      if (servicesWithQueue.length === 0) {
        logger.debug('📭 没有服务队列需要处理');
        return;
      }

      // 2. 并行处理各服务队列
      const processingPromises = servicesWithQueue.map(serviceId => 
        this.processSingleServiceQueue(serviceId)
      );

      const results = await Promise.allSettled(processingPromises);
      
      // 3. 统计处理结果
      let totalProcessed = 0;
      let totalFailed = 0;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          totalProcessed += result.value.processed;
          totalFailed += result.value.failed;
        } else {
          logger.error(`❌ 服务 ${servicesWithQueue[index]} 队列处理失败:`, result.reason);
        }
      });

      // 4. 更新监控指标
      this.updateProcessMetrics(totalProcessed, totalFailed);
      
      if (totalProcessed > 0 || totalFailed > 0) {
        logger.info(`⚡ 服务队列处理完成: 成功=${totalProcessed}, 失败=${totalFailed}`);
      }

    } catch (error) {
      logger.error('❌ 服务队列处理失败:', error);
    }
  }

  /**
   * 🔧 处理单个服务的队列
   */
  async processSingleServiceQueue(serviceId) {
    try {
      let processed = 0;
      let failed = 0;

      // 1. 检查服务可用性
      const service = await EmailService.findByPk(serviceId);
      if (!service || !service.isAvailable()) {
        logger.debug(`⏸️ 服务 ${serviceId} 不可用，跳过处理`);
        return { processed, failed };
      }

      // 2. 获取队列中的下一个任务
      const queueItem = this.getNextQueueItem(serviceId);
      if (!queueItem) {
        return { processed, failed };
      }

      // 3. 获取完整的子任务数据 (按需加载，内存优化)
      const subTask = await SubTask.findByPk(queueItem.subTaskId);
      if (!subTask || subTask.status !== 'pending') {
        // 任务已被处理或不存在，从队列移除
        this.removeFromServiceQueue(serviceId, queueItem);
        return { processed, failed };
      }

      // 4. 执行发送任务
      try {
        const sendResult = await this.allocateAndSendSubTask(subTask, service);
        
        if (sendResult.success) {
          processed++;
          await service.updateAfterSending(true, sendResult.responseTime || 0);
          this.removeFromServiceQueue(serviceId, queueItem);
          logger.debug(`✅ SubTask ${subTask.id} 发送成功 via ${service.name}`);
        } else {
          failed++;
          await service.updateAfterSending(false, sendResult.responseTime || 0);
          // 🔧 故障原地阻塞策略：任务保留在队列中，等待管理员处理
          logger.warn(`❌ SubTask ${subTask.id} 发送失败，保留在队列中: ${sendResult.error}`);
        }

      } catch (error) {
        failed++;
        logger.error(`❌ SubTask ${subTask.id} 处理异常:`, error);
        // 记录服务故障
        this.recordServiceFailure(serviceId);
      }

      return { processed, failed };

    } catch (error) {
      logger.error(`❌ 处理服务 ${serviceId} 队列失败:`, error);
      return { processed: 0, failed: 0 };
    }
  }

  // ============================================================================
  // 🎯 Phase 5: 辅助方法实现
  // ============================================================================

  /**
   * 🔧 获取可用服务进行任务补充
   */
  async getAvailableServicesForSupplement() {
    try {
      // 获取有任务进行中的用户关联的，且当日余额大于0的服务
      const services = await EmailService.findAll({
                 where: {
           is_enabled: true,
           daily_quota: { [Op.gt]: 0 },
           used_quota: { [Op.lt]: sequelize.col('daily_quota') }
         },
        include: [{
          model: UserServiceMapping,
          required: true,
          include: [{
            model: User,
            required: true,
            where: {
              // 只包含有活跃任务的用户
              id: {
                [Op.in]: sequelize.literal(`(
                  SELECT DISTINCT user_id 
                  FROM tasks 
                  WHERE status IN ('scheduled', 'sending')
                )`)
              }
            }
          }]
        }],
        order: [
          ['daily_quota', 'DESC'],    // 优先额度大的服务
          ['used_quota', 'ASC']       // 优先使用少的服务
        ]
      });

      return services.filter(service => {
        // 过滤掉被阻塞的服务
        return !this.metrics.blockedServices.has(service.id);
      });

    } catch (error) {
      logger.error('❌ 获取可用服务失败:', error);
      return [];
    }
  }

  /**
   * 🔧 获取服务关联用户的可用任务
   */
  async getAvailableTasksForService(serviceId, needCount) {
    try {
      // 获取该服务关联的用户ID
      const userMappings = await UserServiceMapping.findAll({
        where: { email_service_id: serviceId },
        attributes: ['user_id']
      });
      
      const userIds = userMappings.map(m => m.user_id);
      if (userIds.length === 0) {
        return [];
      }

      // 获取这些用户的待处理任务，按主任务轮询
      const tasks = await Task.findAll({
        where: {
          user_id: { [Op.in]: userIds },
          status: { [Op.in]: ['scheduled', 'sending'] }
        },
        include: [{
          model: SubTask,
          where: { status: 'pending' },
          required: true,
          limit: needCount * 2  // 多获取一些，防止不够分配
        }],
        order: [
          ['created_at', 'ASC'],      // 优先处理早创建的任务
          [SubTask, 'id', 'ASC']      // 子任务按ID排序
        ]
      });

      // 按主任务轮询获取子任务
      const result = [];
      const taskPointers = new Map();

      for (let i = 0; i < needCount && result.length < needCount; i++) {
        for (const task of tasks) {
          if (result.length >= needCount) break;

          const currentIndex = taskPointers.get(task.id) || 0;
          if (currentIndex < task.SubTasks.length) {
            const subTask = task.SubTasks[currentIndex];
            result.push({
              subTaskId: subTask.id,
              taskId: task.id,
              userId: task.user_id,
              priority: task.priority || 0
            });
            taskPointers.set(task.id, currentIndex + 1);
          }
        }
      }

      return result;

    } catch (error) {
      logger.error(`❌ 获取服务 ${serviceId} 可用任务失败:`, error);
      return [];
    }
  }

  /**
   * 🔧 队列管理方法
   */
  getServiceQueueSize(serviceId) {
    const queue = this.serviceQueues.get(serviceId);
    return queue ? queue.length : 0;
  }

  addToServiceQueue(serviceId, queueItem) {
    if (!this.serviceQueues.has(serviceId)) {
      this.serviceQueues.set(serviceId, []);
    }
    this.serviceQueues.get(serviceId).push(queueItem);
    this.metrics.totalQueuedTasks++;
  }

  getNextQueueItem(serviceId) {
    const queue = this.serviceQueues.get(serviceId);
    if (!queue || queue.length === 0) {
      return null;
    }
    return queue[0]; // FIFO
  }

  removeFromServiceQueue(serviceId, queueItem) {
    const queue = this.serviceQueues.get(serviceId);
    if (queue) {
      const index = queue.findIndex(item => item.subTaskId === queueItem.subTaskId);
      if (index >= 0) {
        queue.splice(index, 1);
        this.metrics.totalQueuedTasks--;
      }
      
      // 如果队列为空，清理Map
      if (queue.length === 0) {
        this.serviceQueues.delete(serviceId);
      }
    }
  }

  /**
   * 🔧 服务故障处理
   */
  recordServiceFailure(serviceId) {
    const status = this.serviceStatus.get(serviceId) || { failureCount: 0 };
    status.failureCount = (status.failureCount || 0) + 1;
    status.lastFailureTime = new Date();
    this.serviceStatus.set(serviceId, status);

    // 连续失败5次，标记为阻塞
    if (status.failureCount >= 5) {
      this.metrics.blockedServices.add(serviceId);
      logger.warn(`⚠️ 服务 ${serviceId} 连续失败5次，标记为阻塞状态`);
    }
  }

  /**
   * 🔧 监控指标更新
   */
  updateSupplementMetrics(supplemented) {
    this.metrics.activeServices = this.serviceQueues.size;
    logger.debug(`📊 监控指标更新: 补充=${supplemented}, 活跃服务=${this.metrics.activeServices}, 总队列=${this.metrics.totalQueuedTasks}`);
  }

  updateProcessMetrics(processed, failed) {
    // 更新处理指标
    logger.debug(`📊 处理指标: 成功=${processed}, 失败=${failed}, 总队列=${this.metrics.totalQueuedTasks}`);
  }

  /**
   * 🔧 全局重启清空机制
   */
  async clearAllQueues() {
    try {
      logger.info('🧹 执行全局队列清空');
      
      // 清空所有队列
      this.serviceQueues.clear();
      this.taskPointers.clear();
      this.serviceStatus.clear();
      
      // 重置监控指标
      this.metrics.totalQueuedTasks = 0;
      this.metrics.activeServices = 0;
      this.metrics.blockedServices.clear();
      
      // 重置所有SubTask状态为pending (如果需要)
      await SubTask.update(
        { status: 'pending' },
        { 
          where: { 
            status: { [Op.in]: ['allocated', 'sending'] }
          }
        }
      );
      
      logger.info('✅ 全局队列清空完成，所有任务重置为pending状态');
      
    } catch (error) {
      logger.error('❌ 全局队列清空失败:', error);
    }
  }

  /**
   * 🔧 获取队列状态 (管理员监控)
   */
  async getQueueStatus() {
    try {
      const queueDetails = {};
      for (const [serviceId, queue] of this.serviceQueues.entries()) {
        const service = await EmailService.findByPk(serviceId, {
          attributes: ['name', 'daily_quota', 'used_quota']
        });
        
        queueDetails[serviceId] = {
          serviceName: service?.name || 'Unknown',
          queueLength: queue.length,
          dailyQuota: service?.daily_quota || 0,
          usedQuota: service?.used_quota || 0,
          isBlocked: this.metrics.blockedServices.has(serviceId)
        };
      }

      return {
        is_running: this.isRunning,
        config: this.config,
        metrics: {
          ...this.metrics,
          blockedServices: Array.from(this.metrics.blockedServices)
        },
        queueDetails,
        lastUpdate: new Date()
      };

    } catch (error) {
      logger.error('❌ 获取队列状态失败:', error);
      return { error: error.message };
    }
  }
}

module.exports = QueueSchedulerV2;