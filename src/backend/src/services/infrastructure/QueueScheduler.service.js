/**
 * 队列调度器 - 实现多用户多任务的公平轮询发送机制
 * 
 * 核心设计思想：
 * 1. 任务创建时预生成所有SubTask队列（按联系人ID排序）
 * 2. 发信服务按自己的时间间隔轮询不同的任务队列
 * 3. 多用户多任务之间公平轮询
 * 4. 严格的额度控制和服务可用性检查
 */

const { Task, SubTask, Contact, Template, EmailService, User, Sender } = require('../../models/index');
const { sequelize, Sequelize } = require('../../models/index');
const { Op } = Sequelize;
const EmailRoutingService = require('./EmailRoutingService');
const QuotaService = require('./QuotaService');
const logger = require('../../utils/logger');

class QueueScheduler {
  constructor() {
    this.taskQueues = new Map(); // 任务队列映射 taskId -> queue
    this.userTaskRotation = new Map(); // 用户任务轮询索引 userId -> taskIndex
    this.serviceTimers = new Map(); // 发信服务定时器 serviceId -> timer
    this.unfreezeTimers = new Map(); // 🔧 发信服务解冻定时器 serviceId -> timer
    this.scheduledTaskTimer = null; // 新增：scheduled任务检查定时器
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

      // 3. 启动scheduled任务检查定时器
      this.startScheduledTaskTimer();

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

    // 🔧 停止所有解冻定时器
    for (const [serviceId, timer] of this.unfreezeTimers) {
      clearTimeout(timer);
      logger.info(`停止发信服务 ${serviceId} 的解冻定时器`);
    }

    // 停止scheduled任务检查定时器
    if (this.scheduledTaskTimer) {
      clearInterval(this.scheduledTaskTimer);
      this.scheduledTaskTimer = null;
      logger.info('停止scheduled任务检查定时器');
    }

    this.serviceTimers.clear();
    this.unfreezeTimers.clear(); // 🔧 清理解冻定时器Map
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

      // 6. 阶段1：生成SubTask队列（调用TaskService）
      const TaskService = require('../core/task.service');
      const subTasks = await TaskService.generateSubTasksV3(task, transaction);

      // 8. 更新任务状态
      await task.update({
        status: 'queued',
        total_subtasks: subTasks.length,
        pending_subtasks: subTasks.length,     // 🔧 修复：所有SubTask都是pending状态
        allocated_subtasks: 0                  // 🔧 修复：没有预分配
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
   * 🔧 安全修复：确保user_id过滤，防止用户权限泄露
   */
  async getTaskContacts(task, transaction) {
    // 🔧 安全检查：获取任务创建者的user_id
    const taskCreatorId = task.created_by || task.user_id;
    if (!taskCreatorId) {
      throw new Error('无法确定任务创建者，安全检查失败');
    }

    // 优先使用task.contacts字段
    if (task.contacts && task.contacts.length > 0) {
      return await Contact.findAll({
        where: {
          id: { [Op.in]: task.contacts },
          user_id: taskCreatorId  // 🔧 安全修复：添加user_id过滤
        },
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
          where: {
            id: { [Op.in]: contact_ids },
            user_id: taskCreatorId  // 🔧 安全修复：添加user_id过滤
          },
          attributes: ['id', 'email', 'name'],
          order: [['id', 'ASC']],
          transaction
        });

      case 'tag_based':
        let whereClause = { user_id: taskCreatorId };  // 🔧 安全修复：添加user_id过滤
        if (include_tags && include_tags.length > 0) {
          whereClause.tags = { [Op.or]: include_tags.map(tagId => ({ [Op.contains]: [tagId] })) };
        }
        if (exclude_tags && exclude_tags.length > 0) {
          if (whereClause.tags) {
            whereClause[Op.and] = [
              { tags: whereClause.tags },
              { [Op.not]: { tags: { [Op.or]: exclude_tags.map(tagId => ({ [Op.contains]: [tagId] })) } } }
            ];
            delete whereClause.tags;
          } else {
            whereClause[Op.not] = { tags: { [Op.or]: exclude_tags.map(tagId => ({ [Op.contains]: [tagId] })) } };
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
          where: { user_id: taskCreatorId },  // 🔧 安全修复：添加user_id过滤
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
  /**
   * 🔧 新增：阶段2 - 分配发信服务和调度SubTask
   * 职责：将pending状态的SubTask分配给可用的发信服务
   */
  async allocateSubTasks(taskId, transaction = null) {
    const tx = transaction || await sequelize.transaction();
    const config = require('../../config');

    try {
      // 1. 获取pending状态的SubTask
      const pendingSubTasks = await SubTask.findAll({
        where: {
          task_id: taskId,
          status: 'pending'
        },
        include: [
          { model: Task, as: 'task', attributes: ['id', 'sender_id'] }
        ],
        transaction: tx,
        order: [['created_at', 'ASC']]
      });

      if (pendingSubTasks.length === 0) {
        logger.info(`任务 ${taskId} 没有pending状态的SubTask需要分配`);
        return { allocated: 0, total: 0 };
      }

      // 2. 获取可用发信服务
      const availableServices = await this.getAvailableEmailServices(tx);

      if (availableServices.length === 0) {
        throw new Error('没有可用的发信服务');
      }

      // 3. 获取Sender信息
      const senderId = pendingSubTasks[0].task.sender_id;
      const sender = await Sender.findByPk(senderId, { transaction: tx });

      if (!sender) {
        throw new Error(`Sender ${senderId} 不存在`);
      }

      // 4. 轮询分配发信服务
      let serviceIndex = 0;
      let allocatedCount = 0;

      for (const subTask of pendingSubTasks) {
        const service = availableServices[serviceIndex % availableServices.length];
        const senderEmail = `${sender.name}@${service.domain}`;

        // 更新SubTask分配信息
        await subTask.update({
          service_id: service.id,
          sender_email: senderEmail,
          status: 'allocated',
          scheduled_at: new Date()
        }, { transaction: tx });

        allocatedCount++;
        serviceIndex++;

        // 更新服务使用额度（预扣）
        await service.update({
          used_quota: service.used_quota + 1
        }, { transaction: tx });
      }

      logger.info(`✅ 阶段2完成：任务 ${taskId} 分配了 ${allocatedCount} 个SubTask到 ${availableServices.length} 个发信服务`);

      return {
        allocated: allocatedCount,
        total: pendingSubTasks.length,
        services: availableServices.length
      };

    } catch (error) {
      logger.error(`❌ 阶段2失败：任务 ${taskId} SubTask分配失败:`, error.message);
      throw error;
    }
  }

  /**
   * 🔧 新增：获取可用发信服务（轮询策略）
   */
  async getAvailableEmailServices(transaction = null) {
    const config = require('../../config');

    // 🔧 实时冻结状态检查：考虑frozen_until时间
    const now = new Date();
    const availableServices = await EmailService.findAll({
      where: {
        is_enabled: true,
        [Op.where]: sequelize.literal('used_quota < daily_quota'),
        // 🔧 全局原子性冻结检查：未冻结 OR 冻结时间已过期
        [Op.or]: [
          { is_frozen: false },  // 未冻结
          {
            is_frozen: true,
            frozen_until: { [Op.lt]: now }  // 冻结时间已过期
          },
          { frozen_until: null }  // 没有设置冻结时间
        ]
      },
      order: [
        // 根据配置选择排序策略
        config.email.serviceRotationStrategy === 'least_used'
          ? ['used_quota', 'ASC']    // 优先使用余额多的
          : ['id', 'ASC']            // 简单轮询
      ],
      attributes: ['id', 'name', 'domain', 'used_quota', 'daily_quota', 'sending_rate', 'is_frozen', 'frozen_until'],
      transaction
    });

    // 🔧 自动解冻过期的服务
    for (const service of availableServices) {
      if (service.is_frozen && service.frozen_until && now >= service.frozen_until) {
        try {
          await service.update({
            is_frozen: false,
            frozen_until: null
          }, { transaction });
          logger.info(`🔓 自动解冻过期服务: ${service.name}`);
        } catch (error) {
          logger.error(`❌ 自动解冻服务失败 ${service.name}: ${error.message}`);
        }
      }
    }

    return availableServices;
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
          await this.startServiceTimer(service);
        }
      }

      logger.info(`✅ 启动了 ${services.length} 个发信服务的轮询定时器`);
    } catch (error) {
      logger.error('启动发信服务轮询失败:', error);
    }
  }

  /**
   * 启动单个发信服务的定时器
   */
  async startServiceTimer(service) {
    // 🔧 关键修复：使用固定的短轮询间隔，而不是sending_rate
    // sending_rate用于控制冻结时间，轮询间隔应该足够频繁以及时检测到解冻
    const POLL_INTERVAL_SECONDS = 5;  // 固定5秒轮询间隔
    const intervalMs = POLL_INTERVAL_SECONDS * 1000;

    const timer = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(timer);
        return;
      }

      try {
        // 🔧 检查服务是否被冻结或达到额度限制
        const currentService = await EmailService.findByPk(service.id);
        if (!currentService || !currentService.is_enabled) {
          logger.warn(`⏸️ 发信服务 ${service.name} 已禁用，暂停处理`);
          return;
        }

        if (currentService.is_frozen) {
          logger.debug(`❄️ 发信服务 ${service.name} 已冻结，排队等待解冻`);
          return;
        }

        if (currentService.used_quota >= currentService.daily_quota) {
          logger.warn(`📊 发信服务 ${service.name} 额度已满，排队等待重置`);
          return;
        }

        await this.processServiceQueue(service.id);
      } catch (error) {
        logger.error(`发信服务 ${service.id} 轮询处理失败:`, error);
      }
    }, intervalMs);

    this.serviceTimers.set(service.id, timer);
    logger.info(`✅ 发信服务 ${service.name} 定时器启动，轮询间隔: ${POLL_INTERVAL_SECONDS}秒 (发送间隔: ${service.sending_rate}秒)`);
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

      // 2. 🔧 修复：原子性获取下一个SubTask（已包含服务分配）
      const nextSubTask = await this.getNextSubTaskForService(serviceId);

      if (!nextSubTask) {
        // 没有待发送的SubTask，继续轮询
        return;
      }

      // 3. 为当前SubTask设置处理时间
      const currentTime = new Date();

      logger.info(`🔄 开始处理SubTask: ${nextSubTask.id}, 服务: ${service.name}, 处理时间: ${currentTime.toISOString()}`);

      // 4. 🔧 修复：直接发送邮件（SubTask已经原子性分配了服务和状态）
      try {
        // SubTask已经是allocated状态，只需设置发信邮箱
        const transaction = await sequelize.transaction();

        try {
          // 获取任务和发信人信息
          const task = await Task.findByPk(nextSubTask.task_id, {
            include: [{ model: Sender, as: 'sender' }],
            transaction
          });

          if (!task || !task.sender) {
            throw new Error('任务或发信人不存在');
          }

          // 生成发信邮箱
          const senderEmail = `${task.sender.name}@${service.domain}`;

          // 只更新发信邮箱和计划时间（状态已经是allocated）
          await nextSubTask.update({
            sender_email: senderEmail,
            scheduled_at: currentTime
          }, { transaction });

          // 预扣减服务额度
          await service.update({
            used_quota: service.used_quota + 1
          }, { transaction });

          await transaction.commit();

          // 实际发送邮件
          const sendResult = await this.sendEmail(nextSubTask, service);

          if (sendResult.success) {
            logger.info(`✅ SubTask ${nextSubTask.id} 发送成功 via ${service.name} (原子性控制)`);

            // 🔧 修复：发送成功后更新SubTask状态为sent
            const servicePlatform = service.name || 'engagelab';
            await this.markSubTaskSent(nextSubTask.id, sendResult.response, servicePlatform);

            // 🔧 关键：发送成功后立即冻结服务，实现真正的全局原子性
            await this.freezeEmailService(serviceId);

          } else {
            logger.warn(`❌ SubTask ${nextSubTask.id} 发送失败: ${sendResult.error}`);

            // 发送失败，标记失败状态
            await this.markSubTaskFailed(nextSubTask.id, sendResult.error);
          }

        } catch (error) {
          await transaction.rollback();
          throw error;
        }

      } catch (error) {
        logger.error(`❌ SubTask ${nextSubTask.id} 处理异常: ${error.message}`);

        // 发送失败，将SubTask状态恢复为pending
        await nextSubTask.update({
          status: 'pending',
          service_id: null,
          sender_email: null
        });
      }

    } catch (error) {
      logger.error(`处理发信服务队列失败 ${serviceId}:`, error);
    }
  }

  /**
   * 🔧 修复：原子性获取并占用下一个SubTask
   */
  async getNextSubTaskForService(serviceId) {
    const transaction = await sequelize.transaction();

    try {
      // 获取所有活跃的任务队列，按用户分组
      const activeQueues = Array.from(this.taskQueues.values())
        .filter(queue => queue.status === 'active' && queue.subTasks.length > queue.currentIndex);

      if (activeQueues.length === 0) {
        await transaction.rollback();
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
      if (userIds.length === 0) {
        await transaction.rollback();
        return null;
      }

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

        // 🔧 关键修复：原子性查找并占用pending状态的SubTask
        // 使用UPDATE...WHERE来确保只有一个服务能够获取到特定的SubTask
        const [updatedRows] = await SubTask.update(
          {
            status: 'allocated',
            service_id: serviceId,
            updated_at: new Date()
          },
          {
            where: {
              task_id: selectedQueue.taskId,
              status: 'pending'
            },
            order: [['created_at', 'ASC']],
            limit: 1,
            transaction,
            returning: true
          }
        );

        if (updatedRows > 0) {
          // 成功获取到SubTask，重新查询完整对象
          const subTask = await SubTask.findOne({
            where: {
              task_id: selectedQueue.taskId,
              status: 'allocated',
              service_id: serviceId
            },
            order: [['updated_at', 'DESC']],
            transaction
          });

          if (subTask) {
            await transaction.commit();
            logger.info(`🎯 服务 ${serviceId} 原子性获取SubTask: ${subTask.id}`);
            return subTask;
          }
        }
      }

      await transaction.rollback();
      return null;

    } catch (error) {
      await transaction.rollback();
      logger.error(`获取SubTask失败 ${serviceId}:`, error);
      return null;
    }
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

      // 2. 生成发信邮箱
      const senderEmail = `${task.sender.name}@${service.domain}`;

      // 🚀 修复：使用批次统一的计划时间，确保同批次邮件时间一致
      const scheduledAt = batchScheduledTime || new Date();

      // 3. 更新SubTask状态
      await subTask.update({
        service_id: service.id,
        sender_email: senderEmail,
        status: 'allocated',
        scheduled_at: scheduledAt
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
        // 传递服务平台信息（目前主要是engagelab，未来支持其他平台）
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
          subtask_id: subTask.id,  // 🔧 与webhook接收保持一致
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
      const { EmailServiceResponse } = require('../../models/index');

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
   * 标记SubTask为已发送 (支持多平台)
   */
  async markSubTaskSent(subTaskId, sendResult = null, servicePlatform = 'engagelab') {
    const subTask = await SubTask.findByPk(subTaskId);
    if (!subTask) return;

    const updateData = {
      status: 'sent',
      sent_at: new Date()
    };

    // 如果有发送结果，保存到email_service_response字段
    if (sendResult) {
      // 支持多种平台的message_id格式
      const messageId = sendResult.message_id ||
        sendResult.messageId ||
        sendResult.id ||
        sendResult.email_id ||
        sendResult.response?.message_id;

      // 生成平台特定的消息ID格式: platform:message_id
      const platformMessageId = messageId ? `${servicePlatform}:${messageId}` : null;

      // 更新email_service_response字段
      const currentResponse = subTask.email_service_response || {};
      updateData.email_service_response = {
        ...currentResponse,
        platform: servicePlatform,
        message_id: platformMessageId,          // 统一格式: platform:id
        platform_message_id: messageId,        // 原始平台ID
        send_response: sendResult,
        sent_timestamp: new Date().toISOString(),
        // 兼容旧字段
        engagelab_message_id: servicePlatform === 'engagelab' ? messageId : undefined
      };

      if (platformMessageId) {
        logger.info(`📧 保存${servicePlatform} Message ID: ${platformMessageId} for SubTask ${subTaskId}`);
      } else {
        logger.warn(`⚠️ ${servicePlatform}响应中未找到message_id, SubTask: ${subTaskId}`, sendResult);
      }
    }

    await subTask.update(updateData);

    // 更新任务统计
    await this.updateTaskStats(subTask.task_id);

    logger.info(`✅ SubTask ${subTaskId} 标记为已发送`);
  }

  /**
   * 标记SubTask为失败
   */
  async markSubTaskFailed(subTaskId, errorMessage) {
    const subTask = await SubTask.findByPk(subTaskId);
    if (!subTask) return;

    await subTask.update({
      status: 'failed',
      error_message: errorMessage,
      retry_count: subTask.retry_count + 1
    });

    // 更新任务统计
    await this.updateTaskStats(subTask.task_id);

    logger.error(`❌ SubTask ${subTaskId} 标记为失败: ${errorMessage}`);
  }

  /**
   * 更新任务统计信息
   */
  async updateTaskStats(taskId) {
    const task = await Task.findByPk(taskId);
    if (!task) return;

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

    statusStats.forEach(stat => {
      const count = parseInt(stat.count);
      stats[stat.status] = count;
      stats.total_recipients += count;

      if (stat.status === 'pending') {
        pendingCount += count;
      } else if (['allocated', 'sending', 'sent', 'delivered'].includes(stat.status)) {
        allocatedCount += count;
      }
    });

    // 更新任务的统计字段
    await task.update({
      summary_stats: stats,
      total_subtasks: stats.total_recipients,
      pending_subtasks: pendingCount,
      allocated_subtasks: allocatedCount
    });

    logger.info(`📊 任务 ${taskId} 统计更新: ${JSON.stringify(stats)}`);

    // 检查任务是否完成
    await this.checkTaskCompletion(taskId, stats);
  }

  /**
   * 🔧 修复：检查任务完成状态 - 正确统计所有状态
   */
  async checkTaskCompletion(taskId, stats = null) {
    if (!stats) {
      // 如果没有传入统计数据，重新获取
      const statusStats = await SubTask.findAll({
        where: { task_id: taskId },
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      });

      stats = {
        pending: 0,
        allocated: 0,
        sending: 0,
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        failed: 0,
        total_recipients: 0
      };

      statusStats.forEach(stat => {
        const count = parseInt(stat.count);
        stats[stat.status] = count;
        stats.total_recipients += count;
      });
    }

    // 🔧 修复：计算未完成的SubTask数量（包括pending、allocated、sending）
    const unfinishedCount = (stats.pending || 0) + (stats.allocated || 0) + (stats.sending || 0);
    const sentCount = stats.sent || 0;
    const deliveredCount = stats.delivered || 0;
    const openedCount = stats.opened || 0;
    const clickedCount = stats.clicked || 0;
    const bouncedCount = stats.bounced || 0;
    const failedCount = stats.failed || 0;

    // 🔧 修复：只有当所有SubTask都完成时才标记任务完成
    let newStatus = 'sending';
    if (unfinishedCount === 0) {
      // 所有SubTask都已完成（成功或失败）
      const successCount = sentCount + deliveredCount + openedCount + clickedCount;
      newStatus = successCount > 0 ? 'completed' : 'failed';

      // 从队列中移除
      this.taskQueues.delete(taskId);

      logger.info(`🎉 任务 ${taskId} 已完成`, {
        status: newStatus,
        stats: {
          total: stats.total_recipients,
          success: successCount,
          bounced: bouncedCount,
          failed: failedCount
        }
      });
    } else {
      logger.debug(`任务 ${taskId} 仍在进行中`, {
        unfinished: unfinishedCount,
        pending: stats.pending,
        allocated: stats.allocated,
        sending: stats.sending
      });
    }

    await Task.update({
      status: newStatus,
      completed_at: newStatus === 'completed' ? new Date() : null
    }, {
      where: { id: taskId }
    });

    return { newStatus, unfinishedCount, stats };
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
   * 🔧 冻结发信服务（全局原子性控制）
   */
  async freezeEmailService(serviceId) {
    try {
      const { EmailService } = require('../../models/index');
      const service = await EmailService.findByPk(serviceId);

      if (!service) {
        logger.warn(`⚠️ 发信服务 ${serviceId} 不存在，无法冻结`);
        return;
      }

      // 🔧 修正：sending_rate直接表示每多少秒发送一封邮件
      const intervalSeconds = service.sending_rate > 0
        ? service.sending_rate  // 直接使用sending_rate作为间隔秒数
        : 60;  // 默认60秒间隔

      const frozenUntil = new Date(Date.now() + intervalSeconds * 1000);

      // 更新服务冻结状态
      await service.update({
        is_frozen: true,
        frozen_until: frozenUntil
      });

      logger.info(`❄️ 发信服务 ${service.name} 已冻结，解冻时间: ${frozenUntil.toISOString()} (间隔: ${intervalSeconds}秒)`);

      // 启动解冻定时器
      this.scheduleServiceUnfreeze(serviceId, intervalSeconds * 1000);

    } catch (error) {
      logger.error(`❌ 冻结发信服务 ${serviceId} 失败: ${error.message}`);
    }
  }

  /**
   * 🔧 安排发信服务解冻
   */
  scheduleServiceUnfreeze(serviceId, delayMs) {
    // 清除可能存在的旧解冻定时器
    if (this.unfreezeTimers && this.unfreezeTimers.has(serviceId)) {
      clearTimeout(this.unfreezeTimers.get(serviceId));
    }

    // 初始化解冻定时器Map
    if (!this.unfreezeTimers) {
      this.unfreezeTimers = new Map();
    }

    // 设置解冻定时器
    const unfreezeTimer = setTimeout(async () => {
      await this.unfreezeEmailService(serviceId);
      this.unfreezeTimers.delete(serviceId);
    }, delayMs);

    this.unfreezeTimers.set(serviceId, unfreezeTimer);
    logger.info(`⏰ 已安排发信服务 ${serviceId} 在 ${Math.floor(delayMs / 1000)} 秒后解冻`);
  }

  /**
   * 🔧 解冻发信服务
   */
  async unfreezeEmailService(serviceId) {
    try {
      const { EmailService } = require('../../models/index');
      const service = await EmailService.findByPk(serviceId);

      if (!service) {
        logger.warn(`⚠️ 发信服务 ${serviceId} 不存在，无法解冻`);
        return;
      }

      // 检查是否到了解冻时间
      const now = new Date();
      if (service.frozen_until && now < service.frozen_until) {
        logger.warn(`⏰ 发信服务 ${service.name} 尚未到解冻时间: ${service.frozen_until.toISOString()}`);
        return;
      }

      // 解冻服务
      await service.update({
        is_frozen: false,
        frozen_until: null
      });

      logger.info(`🔓 发信服务 ${service.name} 已解冻，可以继续处理邮件`);

      // 如果服务已解冻且有余额，重启轮询定时器
      if (service.is_enabled && service.used_quota < service.daily_quota) {
        this.startServiceTimer(service);
      }

    } catch (error) {
      logger.error(`❌ 解冻发信服务 ${serviceId} 失败: ${error.message}`);
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

  /**
   * 启动scheduled任务检查定时器
   */
  startScheduledTaskTimer() {
    // 每30秒检查一次scheduled任务
    const intervalMs = 30 * 1000;

    this.scheduledTaskTimer = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(this.scheduledTaskTimer);
        return;
      }

      try {
        const result = await this.processScheduledTasks();
        if (result.processed > 0) {
          logger.info(`自动处理了 ${result.processed} 个scheduled任务`);
        }
      } catch (error) {
        logger.error('scheduled任务自动检查失败:', error);
      }
    }, intervalMs);

    logger.info('scheduled任务检查定时器启动，间隔: 30秒');
  }
}

module.exports = QueueScheduler; 