const { 
  Task, 
  SubTask,
  User, 
  Contact, 
  Sender,
  EmailService,
  TemplateSet,
  TemplateSetItem,
  Template,
  sequelize 
} = require('../../models');
const AppError = require('../../utils/appError');
const { Op } = require('sequelize');

/**
 * V2.0 群发任务服务
 * 核心功能：独立的群发任务创建和管理，不依赖Campaign
 */
class TaskService {

  /**
   * V2.0: 创建群发任务（独立任务，不依赖Campaign）
   */
  async createTask(taskData, userId) {
    const transaction = await sequelize.transaction();
    
    try {
      const { 
        name, 
        description, 
        priority = 0, // 默认为0，整数类型
        recipient_rule, 
        sender_id, 
        template_ids, 
        schedule_time,
        status = 'draft' // 默认为draft，但允许传入其他状态
      } = taskData;

      // 🔧 验证必需字段
      if (!name || !sender_id || !template_ids || !Array.isArray(template_ids) || template_ids.length === 0) {
        throw new AppError('Missing required fields: name, sender_id, template_ids', 400);
      }

      // 🔧 验证依赖实体
      await this.validateTaskDependenciesV3(userId, { sender_id, template_ids });

      // 获取联系人快照并验证用户额度
      const contactSnapshot = await this.getTaskContactsSnapshot(recipient_rule, userId);
      const recipientCount = contactSnapshot.length;
      await this.validateUserQuota(userId, recipientCount);

      // 🔧 更新：创建任务（移除template_set_id，schedule_time可选，保存联系人快照）
      const taskCreateData = {
        name,
        description,
        priority: parseInt(priority) || 0, // 确保是整数
        recipient_rule,
        sender_id,
        created_by: userId,
        status: status, // 使用传入的状态
        total_subtasks: 0,
        allocated_subtasks: 0,
        pending_subtasks: 0,
        contacts: contactSnapshot.map(contact => contact.id), // 保存联系人ID数组
        templates: template_ids, // 保存模板ID数组
        summary_stats: {
          total_recipients: recipientCount,
          pending: recipientCount,
          allocated: 0,
          sending: 0,
          sent: 0,
          delivered: 0,
          bounced: 0,
          opened: 0,
          clicked: 0,
          failed: 0
        }
      };

      // 只有提供了schedule_time才设置时间字段
      if (schedule_time) {
        taskCreateData.schedule_time = new Date(schedule_time);
        taskCreateData.scheduled_at = new Date(schedule_time);
      }

      const task = await Task.create(taskCreateData, { transaction });

      await transaction.commit();
      return this.formatTaskOutputV3(task);
      
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  /**
   * 🔧 新版：验证任务依赖实体（支持多模板）
   */
  async validateTaskDependenciesV3(userId, { sender_id, template_ids }) {
    // 验证发信人存在且属于用户
    const sender = await Sender.findOne({
      where: { 
        id: sender_id,
        user_id: userId 
      }
    });
    if (!sender) {
      throw new AppError('Sender not found or not accessible', 404);
    }

    // 🔧 验证所有模板存在且属于用户
    const Template = sequelize.models.Template;
    const templates = await Template.findAll({
      where: { 
        id: { [Op.in]: template_ids },
        user_id: userId 
      }
    });
    
    if (templates.length !== template_ids.length) {
      const foundIds = templates.map(t => t.id);
      const missingIds = template_ids.filter(id => !foundIds.includes(id));
      throw new AppError(`Templates not found or not accessible: ${missingIds.join(', ')}`, 404);
    }

    return { sender, templates };
  }

  /**
   * 🔧 新增：获取任务联系人快照（静态快照，创建后不变）
   */
  async getTaskContactsSnapshot(recipient_rule, userId) {
    const { type, contact_ids, include_tags, exclude_tags } = recipient_rule;

    switch (type) {
      case 'specific':
        if (!contact_ids || contact_ids.length === 0) {
          throw new AppError('Contact IDs required for specific recipient type', 400);
        }
        return await Contact.findAll({ 
          where: { 
            id: { [Op.in]: contact_ids },
            user_id: userId 
          },
          attributes: ['id', 'email', 'name', 'tags']
        });

      case 'tag_based':
        // 使用JSONB字段查询标签关联的联系人
        const whereClause = { user_id: userId };
        
        if (include_tags && include_tags.length > 0) {
          whereClause.tags = {
            [Op.contains]: include_tags // JSONB数组包含指定标签ID
          };
        }

        // 如果有排除标签，使用NOT操作
        if (exclude_tags && exclude_tags.length > 0) {
          if (whereClause.tags) {
            // 既有包含又有排除的复杂查询
            whereClause[Op.and] = [
              { tags: { [Op.contains]: include_tags } },
              { tags: { [Op.not]: { [Op.overlap]: exclude_tags } } }
            ];
            delete whereClause.tags;
          } else {
            // 只有排除标签
            whereClause.tags = {
              [Op.not]: { [Op.overlap]: exclude_tags }
            };
          }
        }

        return await Contact.findAll({
          where: whereClause,
          attributes: ['id', 'email', 'name', 'tags']
        });

      case 'all_contacts':
        return await Contact.findAll({ 
          where: { user_id: userId },
          attributes: ['id', 'email', 'name', 'tags']
        });

      default:
        throw new AppError('Invalid recipient rule type', 400);
    }
  }

  /**
   * 🔧 更新：计算收件人数量（支持标签关联表）
   */
  async calculateRecipientCount(recipient_rule) {
    const { type, contact_ids, include_tags, exclude_tags } = recipient_rule;

    switch (type) {
      case 'specific':
        if (!contact_ids || contact_ids.length === 0) {
          throw new AppError('Contact IDs required for specific recipient type', 400);
        }
        return await Contact.count({ 
          where: { id: { [Op.in]: contact_ids } }
        });

      case 'tag_based':
        // 🔧 修复：使用正确的标签关联查询
        const includeClause = [];
        
        if (include_tags && include_tags.length > 0) {
          includeClause.push({
            model: sequelize.models.Tag,
            as: 'tags',
            where: { name: { [Op.in]: include_tags } },
            through: { attributes: [] }
          });
        }

        const queryOptions = {
          distinct: true, // 确保不重复计算
          include: includeClause
        };

        // 如果有排除标签，使用子查询
        if (exclude_tags && exclude_tags.length > 0) {
          const excludeContactIds = await Contact.findAll({
            include: [{
              model: sequelize.models.Tag,
              as: 'tags',
              where: { name: { [Op.in]: exclude_tags } },
              through: { attributes: [] }
            }],
            attributes: ['id'],
            raw: true
          });
          
          const excludeIds = excludeContactIds.map(c => c.id);
          if (excludeIds.length > 0) {
            queryOptions.where = { id: { [Op.notIn]: excludeIds } };
          }
        }

        return await Contact.count(queryOptions);

      case 'all_contacts':
        return await Contact.count();

      default:
        throw new AppError('Invalid recipient rule type', 400);
    }
  }

  /**
   * V2.0: 验证用户额度
   */
  async validateUserQuota(userId, requiredQuota) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.remaining_quota < requiredQuota) {
      throw new AppError(`Insufficient quota. Required: ${requiredQuota}, Available: ${user.remaining_quota}`, 400);
    }

    return true;
  }

  /**
   * 🔧 V3.0更新：获取任务列表（使用JSONB字段）
   */
  async getTasks(userId, options = {}) {
    const { page = 1, limit = 20, status, search } = options;
    
    const whereClause = { created_by: userId };
    
    if (status) {
      whereClause.status = status;
    }
    
    if (search) {
      whereClause.name = { [Op.iLike]: `%${search}%` };
    }

    const { count, rows } = await Task.findAndCountAll({
      where: whereClause,
      include: [
        { 
          model: Sender, 
          as: 'sender',
          attributes: ['id', 'name']
        }
        // V3.0: 不再使用Template关联，模板信息存储在task.templates JSONB字段中
      ],
      order: [['created_at', 'DESC']],
      limit: limit,
      offset: (page - 1) * limit
    });

    return {
      items: rows.map(task => this.formatTaskOutputV3(task)),
      total: count,
      page,
      limit,
      pages: Math.ceil(count / limit)
    };
  }

  /**
   * 🔧 V3.0更新：获取单个任务详情（使用JSONB字段）
   */
  async getTaskById(taskId, userId) {
    const task = await Task.findOne({
      where: { 
        id: taskId,
        created_by: userId 
      },
      include: [
        { 
          model: Sender, 
          as: 'sender',
          attributes: ['id', 'name']
        },
        // V3.0: 不再使用Template关联，模板信息存储在task.templates JSONB字段中
        { 
          model: SubTask, 
          as: 'subTasks',
          attributes: ['id', 'status', 'sent_at', 'delivered_at', 'opened_at', 'clicked_at']
        }
      ]
    });

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    return this.formatTaskOutputV3(task, true);
  }

  /**
   * V2.0: 更新任务状态
   */
  async updateTaskStatus(taskId, userId, status, additionalData = {}) {
    const task = await Task.findOne({
      where: { 
        id: taskId,
        created_by: userId 
      }
    });

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // 状态转换验证
    const validTransitions = {
      'draft': ['scheduled', 'cancelled'],
      'scheduled': ['sending', 'cancelled', 'paused', 'draft'],
      'sending': ['paused', 'completed', 'failed'],
      'paused': ['scheduled', 'cancelled', 'sending', 'closed'],
      'completed': [],
      'failed': ['scheduled'],
      'cancelled': [],
      'closed': []
    };

    if (!validTransitions[task.status].includes(status)) {
      throw new AppError(`Cannot transition from ${task.status} to ${status}`, 400);
    }

    // 构建更新数据
    const updateData = { 
      status,
      ...additionalData,
      actual_start_time: status === 'sending' ? new Date() : task.actual_start_time,
      actual_finish_time: ['completed', 'failed', 'cancelled', 'closed'].includes(status) ? new Date() : null,
      completed_at: ['completed', 'closed'].includes(status) ? new Date() : task.completed_at
    };

    await task.update(updateData);

    // 如果设置为scheduled，触发SubTask生成
    if (status === 'scheduled') {
      await this.generateSubTasksV3(task);
    }

    // 如果设置为sending，触发SubTask分配
    if (status === 'sending') {
      await this.allocateSubTasks(task);
    }

    return this.formatTaskOutputV3(task);
  }

  /**
   * 🔧 新增：分配SubTask到邮件服务
   */
  async allocateSubTasks(task) {
    const QueueScheduler = require('../infrastructure/QueueScheduler');
    const EmailRoutingService = require('../infrastructure/EmailRoutingService');
    
    try {
      // 获取pending状态的子任务
      const pendingSubTasks = await SubTask.findAll({
        where: {
          task_id: task.id,
          status: 'pending',
          service_id: null
        }
      });

      if (pendingSubTasks.length === 0) {
        return { allocatedCount: 0, pendingCount: 0 };
      }

      // 获取可用的邮件服务
      const availableServices = await EmailRoutingService.getUserAvailableServices(task.created_by);
      
      if (availableServices.length === 0) {
        throw new AppError('没有可用的邮件服务', 400);
      }

      // 使用队列调度器分配服务
      const scheduler = new QueueScheduler();
      const transaction = await sequelize.transaction();
      
      try {
        const result = await scheduler.allocateServicesToSubTasks(
          pendingSubTasks,
          task.created_by,
          availableServices,
          transaction
        );

        // 更新任务统计
        await task.update({
          allocated_subtasks: result.allocatedCount,
          pending_subtasks: result.pendingCount
        }, { transaction });

        await transaction.commit();
        
        console.log(`✅ 任务 ${task.id} 分配完成: 成功=${result.allocatedCount}, 待处理=${result.pendingCount}`);
        return result;
        
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
      
    } catch (error) {
      console.error(`任务 ${task.id} 子任务分配失败:`, error);
      throw error;
    }
  }

  /**
   * 🔧 新版：生成SubTask（支持多模板）
   */
  async generateSubTasksV3(task, existingTransaction = null) {
    const transaction = existingTransaction || await sequelize.transaction();
    
    try {
      // 获取收件人列表
      const contacts = await this.getTaskContacts(task);
      
      // 🔧 V3.0修复：从JSONB字段获取模板ID，然后查询模板
      const templateIds = task.templates || [];
      if (!templateIds || templateIds.length === 0) {
        throw new AppError('Task has no associated templates', 400);
      }
      
      // 查询模板详情
      const templates = await sequelize.models.Template.findAll({
        where: {
          id: templateIds
        },
        attributes: ['id', 'name', 'subject', 'body']
      });
      
      if (!templates || templates.length === 0) {
        throw new AppError('Task templates not found', 400);
      }
      
      // 获取发信人信息
      const sender = await Sender.findByPk(task.sender_id);
      if (!sender) {
        throw new AppError('Sender not found', 404);
      }
      
      // 为每个联系人创建SubTask
      const subTasks = [];
      for (const contact of contacts) {
        // 🔧 随机选择一个模板（可以根据权重选择）
        const randomIndex = Math.floor(Math.random() * templates.length);
        const selectedTemplate = templates[randomIndex];
        
        const subTask = {
          task_id: task.id,
          contact_id: contact.id,
          sender_email: `${sender.name}@example.com`, // 简化，实际应该从邮件服务获取
          recipient_email: contact.email,
          template_id: selectedTemplate.id,
          rendered_subject: this.renderTemplate(selectedTemplate.subject, contact),
          rendered_body: '', // 稍后填充，需要SubTask ID
          status: 'pending'
        };
        
        subTasks.push(subTask);
      }
      
      const createdSubTasks = await SubTask.bulkCreate(subTasks, { 
        transaction,
        returning: true
      });
      
      // 为每个SubTask生成包含跟踪功能的邮件内容
      for (let i = 0; i < createdSubTasks.length; i++) {
        const subTask = createdSubTasks[i];
        const contact = contacts[i];
        const randomIndex = Math.floor(Math.random() * templates.length);
        const selectedTemplate = templates[randomIndex];
        
        // 生成包含跟踪的邮件内容
        const renderedBody = this.renderTemplate(selectedTemplate.body, contact, subTask.id);
        
        await subTask.update({ rendered_body: renderedBody }, { transaction });
      }
      
      // 更新任务统计
      await task.update({
        total_subtasks: subTasks.length,
        pending_subtasks: subTasks.length,
        summary_stats: {
          ...task.summary_stats,
          total_recipients: subTasks.length,
          pending: subTasks.length,
          allocated: 0,
          sending: 0,
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          bounced: 0,
          failed: 0
        }
      }, { transaction });
      
      if (!existingTransaction) {
        await transaction.commit();
      }
      
      return createdSubTasks;
      
    } catch (error) {
      if (!existingTransaction && transaction && !transaction.finished) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  /**
   * V2.0: 生成SubTask（旧版本，保留兼容性）
   */
  async generateSubTasks(task, existingTransaction = null) {
    const transaction = existingTransaction || await sequelize.transaction();
    
    try {
      // 获取收件人列表
      const contacts = await this.getTaskContacts(task);
      
      // 获取模板集中的模板
      const templateSet = await TemplateSet.findByPk(task.template_set_id, {
        include: [{
          model: TemplateSetItem,
          as: 'items',
          include: [{
            model: Template,
            as: 'template'
          }]
        }]
      });
      
      // 获取发信人和发信服务信息
      const sender = await Sender.findByPk(task.sender_id);
      const emailService = await EmailService.findByPk(task.email_service_id);
      
      const senderEmail = `${sender.name}@${emailService.domain}`;
      
      // 为每个联系人创建SubTask
      const subTasks = [];
      for (const contact of contacts) {
        // 简化：使用模板集中的第一个模板
        const template = templateSet.items[0].template;
        
        const subTask = {
          task_id: task.id,
          contact_id: contact.id,
          sender_email: senderEmail,
          recipient_email: contact.email,
          template_id: template.id,
          rendered_subject: this.renderTemplate(template.subject, contact),
          rendered_body: '', // 稍后填充，需要SubTask ID
          status: 'pending'
        };
        
        subTasks.push(subTask);
      }
      
      const createdSubTasks = await SubTask.bulkCreate(subTasks, { 
        transaction,
        returning: true // 返回创建的记录
      });
      
      // V2.0: 为每个SubTask生成包含跟踪功能的邮件内容
      for (let i = 0; i < createdSubTasks.length; i++) {
        const subTask = createdSubTasks[i];
        const contact = contacts[i];
        const template = templateSet.items[0].template;
        
        // 生成包含跟踪像素和链接的邮件内容
        const renderedBody = this.renderTemplate(template.body, contact, subTask.id);
        
        await subTask.update({ rendered_body: renderedBody }, { transaction });
      }
      
      // 更新任务统计
      await task.update({
        summary_stats: {
          ...task.summary_stats,
          total_recipients: subTasks.length,
          pending: subTasks.length
        }
      }, { transaction });
      
      // 只有在没有传入外部transaction时才提交
      if (!existingTransaction) {
        await transaction.commit();
      }
      
    } catch (error) {
      // 只有在没有传入外部transaction时才回滚
      if (!existingTransaction && transaction && !transaction.finished) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  /**
   * 🔧 更新：获取任务的联系人列表（支持标签关联表）
   */
  async getTaskContacts(task) {
    // 🔧 修改：使用保存的联系人快照，而不是动态查询
    if (task.contact_snapshot && Array.isArray(task.contact_snapshot)) {
      return task.contact_snapshot;
    }
    
    // 兼容旧任务：如果没有快照，使用原有逻辑
    const { type, contact_ids, include_tags, exclude_tags } = task.recipient_rule;

    switch (type) {
      case 'specific':
        return await Contact.findAll({ 
          where: { id: { [Op.in]: contact_ids } },
          attributes: ['id', 'email', 'name']
        });

      case 'tag_based':
        const includeClause = [];
        
        if (include_tags && include_tags.length > 0) {
          includeClause.push({
            model: sequelize.models.Tag,
            as: 'tags',
            where: { name: { [Op.in]: include_tags } },
            through: { attributes: [] }
          });
        }

        const queryOptions = {
          distinct: true,
          include: includeClause,
          attributes: ['id', 'email', 'name']
        };

        // 如果有排除标签，使用子查询
        if (exclude_tags && exclude_tags.length > 0) {
          const excludeContactIds = await Contact.findAll({
            include: [{
              model: sequelize.models.Tag,
              as: 'tags',
              where: { name: { [Op.in]: exclude_tags } },
              through: { attributes: [] }
            }],
            attributes: ['id'],
            raw: true
          });
          
          const excludeIds = excludeContactIds.map(c => c.id);
          if (excludeIds.length > 0) {
            queryOptions.where = { id: { [Op.notIn]: excludeIds } };
          }
        }

        return await Contact.findAll(queryOptions);

      case 'all_contacts':
        return await Contact.findAll({ 
          attributes: ['id', 'email', 'name']
        });

      default:
        throw new AppError('Invalid recipient rule type', 400);
    }
  }

  /**
   * V2.0: 增强模板渲染 - 支持跟踪像素和链接
   */
  renderTemplate(template, contact, subTaskId = null) {
    let rendered = template;
    
    // 替换联系人变量
    rendered = rendered.replace(/\{\{name\}\}/g, contact.name || '');
    rendered = rendered.replace(/\{\{email\}\}/g, contact.email || '');
    
    // 处理自定义字段 (暂时跳过，Contact模型中没有custom_fields)
    // if (contact.custom_fields) {
    //   Object.keys(contact.custom_fields).forEach(key => {
    //     const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    //     rendered = rendered.replace(regex, contact.custom_fields[key] || '');
    //   });
    // }

    // 转换图片URL为邮件图片代理URL
    rendered = this.convertImageUrls(rendered);

    // V2.0: 如果提供了subTaskId，插入跟踪功能
    if (subTaskId) {
      // 1. 在邮件末尾插入跟踪像素
      const trackingPixel = `<img src="${process.env.APP_URL || 'http://tkmail.fun'}/api/tracking/open/${subTaskId}" width="1" height="1" style="display:none;" alt="" />`;
      
      // 如果是HTML邮件，在</body>前插入跟踪像素
      if (rendered.includes('</body>')) {
        rendered = rendered.replace('</body>', `${trackingPixel}</body>`);
      } else {
        // 如果不是完整HTML，在末尾添加
        rendered += `<br/>${trackingPixel}`;
      }

      // 2. 处理邮件中的链接，添加点击跟踪
      rendered = this.addClickTracking(rendered, subTaskId);
    }
    
    return rendered;
  }

  /**
   * 转换图片URL为邮件图片代理URL
   */
  convertImageUrls(htmlContent) {
    const baseUrl = process.env.APP_URL || 'http://tkmail.fun';
    
    // 匹配所有的img标签
    const imgRegex = /<img\s+([^>]*?)src\s*=\s*["']([^"']*?)["']([^>]*?)>/gi;
    
    return htmlContent.replace(imgRegex, (match, beforeSrc, originalSrc, afterSrc) => {
      // 如果已经是完整URL，不需要转换
      if (originalSrc.startsWith('http://') || originalSrc.startsWith('https://') || originalSrc.startsWith('data:')) {
        return match;
      }
      
      // 如果是相对路径的上传图片，转换为邮件图片代理URL
      if (originalSrc.startsWith('/uploads/') || originalSrc.includes('uploads/')) {
        const filename = originalSrc.split('/').pop();
        const proxyUrl = `${baseUrl}/api/upload/email-image/${filename}`;
        return `<img ${beforeSrc}src="${proxyUrl}"${afterSrc}>`;
      }
      
      // 如果是其他相对路径，转换为完整URL
      if (originalSrc.startsWith('/')) {
        const fullUrl = `${baseUrl}${originalSrc}`;
        return `<img ${beforeSrc}src="${fullUrl}"${afterSrc}>`;
      }
      
      return match;
    });
  }

  /**
   * V2.0: 为邮件中的链接添加点击跟踪
   */
  addClickTracking(htmlContent, subTaskId) {
    // 匹配所有的链接
    const linkRegex = /<a\s+([^>]*?)href\s*=\s*["']([^"']*?)["']([^>]*?)>/gi;
    
    return htmlContent.replace(linkRegex, (match, beforeHref, originalUrl, afterHref) => {
      // 跳过已经是跟踪链接的URL
      if (originalUrl.includes('/tracking/click/') || originalUrl.includes('mailto:') || originalUrl.includes('tel:')) {
        return match;
      }

      // 为原始URL生成跟踪链接
      const trackingUrl = `${process.env.APP_URL || 'http://tkmail.fun'}/api/tracking/click/${subTaskId}/${encodeURIComponent(originalUrl)}`;
      
      // 在原始链接上添加data属性，方便后续解析
      return `<a ${beforeHref}href="${trackingUrl}" data-original-url="${originalUrl}"${afterHref}>`;
    });
  }

  /**
   * V2.0: 获取任务统计
   */
  async getTaskStats(userId) {
    const totalTasks = await Task.count({ where: { created_by: userId } });
    
    const statusStats = await Task.findAll({
      where: { created_by: userId },
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    const stats = {
      total_tasks: totalTasks,
      by_status: {}
    };

    statusStats.forEach(stat => {
      stats.by_status[stat.status] = parseInt(stat.count);
    });

    return stats;
  }

  /**
   * V2.0: 删除任务
   */
  async deleteTask(taskId, userId) {
    const task = await Task.findOne({
      where: { 
        id: taskId,
        created_by: userId 
      }
    });

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // 只有draft状态的任务可以删除
    if (task.status !== 'draft') {
      throw new AppError('Only draft tasks can be deleted', 400);
    }

    await task.destroy();
    return { message: 'Task deleted successfully' };
  }

  /**
   * V2.0: 格式化输出
   */
  formatTaskOutput(task, detailed = false) {
    const output = {
      id: task.id,
      name: task.name,
      description: task.description,
      schedule_time: task.schedule_time,
      status: task.status,
      recipient_rule: task.recipient_rule,
      summary_stats: task.summary_stats,
      created_at: task.created_at,
      updated_at: task.updated_at
    };

    if (task.sender) {
      output.sender = {
        id: task.sender.id,
        name: task.sender.name
      };
    }

    if (task.emailService) {
      output.email_service = {
        id: task.emailService.id,
        name: task.emailService.name,
        provider: task.emailService.provider
      };
    }

    if (task.templateSet) {
      output.template_set = {
        id: task.templateSet.id,
        name: task.templateSet.name
      };
    }

    if (detailed && task.subTasks) {
      output.sub_tasks_summary = {
        total: task.subTasks.length,
        by_status: {}
      };
      
      task.subTasks.forEach(subTask => {
        output.sub_tasks_summary.by_status[subTask.status] = 
          (output.sub_tasks_summary.by_status[subTask.status] || 0) + 1;
      });
    }

    return output;
  }

  formatTaskOutputV2(task, detailed = false) {
    const output = {
      id: task.id,
      name: task.name,
      description: task.description,
      schedule_time: task.schedule_time,
      scheduled_at: task.scheduled_at, // V2.0字段
      priority: task.priority, // V2.0字段
      status: task.status,
      recipient_rule: task.recipient_rule,
      summary_stats: task.summary_stats,
      total_subtasks: task.total_subtasks, // V2.0统计
      allocated_subtasks: task.allocated_subtasks,
      pending_subtasks: task.pending_subtasks,
      created_at: task.created_at,
      updated_at: task.updated_at
    };

    if (task.sender) {
      output.sender = {
        id: task.sender.id,
        name: task.sender.name
      };
    }

    if (task.templateSet) {
      output.template_set = {
        id: task.templateSet.id,
        name: task.templateSet.name
      };
    }

    // 详细模式包含SubTask信息
    if (detailed && task.subTasks) {
      output.sub_tasks = task.subTasks.map(subTask => ({
        id: subTask.id,
        status: subTask.status,
        sent_at: subTask.sent_at,
        delivered_at: subTask.delivered_at,
        opened_at: subTask.opened_at,
        clicked_at: subTask.clicked_at
      }));
    }

    return output;
  }

  /**
   * 🔧 新版：任务输出格式化（支持多模板）
   */
  formatTaskOutputV3(task, detailed = false) {
    if (!task) return null;

    const output = {
      id: task.id,
      name: task.name,
      description: task.description,
      status: task.status,
      schedule_time: task.schedule_time,
      scheduled_at: task.scheduled_at,
      priority: task.priority,
      recipient_rule: task.recipient_rule,
      summary_stats: task.summary_stats,
      total_subtasks: task.total_subtasks,
      allocated_subtasks: task.allocated_subtasks,
      pending_subtasks: task.pending_subtasks,
      pause_reason: task.pause_reason,
      completed_at: task.completed_at,
      actual_start_time: task.actual_start_time,
      actual_finish_time: task.actual_finish_time,
      created_at: task.createdAt,
      updated_at: task.updatedAt
    };

    // 包含发信人信息
    if (task.sender) {
      output.sender = {
        id: task.sender.id,
        name: task.sender.name
      };
      output.sender_id = task.sender.id; // 🔧 添加sender_id字段
    }

    // 🔧 修复：正确处理templates JSONB字段
    if (task.templates && Array.isArray(task.templates) && task.templates.length > 0) {
      // 如果templates是关联的模板对象数组（从include查询得到）
      if (typeof task.templates[0] === 'object' && task.templates[0].id) {
        output.templates = task.templates.map(template => ({
          id: template.id,
          name: template.name,
          subject: template.subject,
          weight: 1 // V3.0不再使用TaskTemplate关联表，统一使用默认权重
        }));
        output.template_ids = task.templates.map(template => template.id);
      } else {
        // 如果templates是JSONB字段（只包含ID数组）
        output.templates = task.templates.map(templateId => ({
          weight: 1 // 默认权重
        }));
        output.template_ids = task.templates;
      }
    } else {
      output.templates = [];
      output.template_ids = [];
    }

    // 详细模式包含SubTask信息
    if (detailed && task.subTasks) {
      output.sub_tasks = task.subTasks.map(subTask => ({
        id: subTask.id,
        status: subTask.status,
        sent_at: subTask.sent_at,
        delivered_at: subTask.delivered_at,
        opened_at: subTask.opened_at,
        clicked_at: subTask.clicked_at
      }));
    }

    return output;
  }

  /**
   * V2.0: 更新任务
   */
  async updateTask(taskId, updateData, userId) {
    const task = await Task.findOne({
      where: { 
        id: taskId,
        created_by: userId 
      },
      include: [{
        model: sequelize.models.Sender,
        as: 'sender',
        attributes: ['id', 'name']
      }]
    });

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // 只有草稿状态的任务可以编辑基本信息
    if (task.status !== 'draft' && !updateData.status) {
      throw new AppError('Only draft tasks can be updated', 400);
    }

    const transaction = await sequelize.transaction();
    
    try {
      // 更新基本字段
      const updateFields = {};
      if (updateData.name !== undefined) updateFields.name = updateData.name;
      if (updateData.description !== undefined) updateFields.description = updateData.description;
      if (updateData.recipient_rule !== undefined) updateFields.recipient_rule = updateData.recipient_rule;
      
      // 🔧 修复：正确处理时间字段和状态更新
      if (updateData.schedule_time !== undefined) {
        // 确保时间格式正确
        const scheduleTime = new Date(updateData.schedule_time);
        if (isNaN(scheduleTime.getTime())) {
          throw new AppError('Invalid schedule_time format', 400);
        }
        
        // 检查时间不能早于当前时间
        const now = new Date();
        if (scheduleTime <= now) {
          throw new AppError('计划时间不能早于当前时间，请重新设置', 400);
        }
        
        updateFields.schedule_time = scheduleTime;
        updateFields.scheduled_at = scheduleTime; // 同时更新scheduled_at字段
      }
      
      // 🔧 新增：处理状态更新
      if (updateData.status !== undefined) {
        // 验证状态转换的合法性
        if (task.status === 'draft' && updateData.status === 'scheduled') {
          // 草稿 -> 调度：需要有计划时间
          if (!updateData.schedule_time && !task.schedule_time) {
            throw new AppError('Schedule time is required for scheduling task', 400);
          }
          updateFields.status = 'scheduled';
        } else if (['scheduled', 'sending', 'paused'].includes(updateData.status)) {
          updateFields.status = updateData.status;
        } else {
          throw new AppError(`Invalid status transition from ${task.status} to ${updateData.status}`, 400);
        }
      }

      await task.update(updateFields, { transaction });

      // 🔧 处理模板关联更新（V3.0使用JSONB字段）
      if (updateData.template_ids && Array.isArray(updateData.template_ids)) {
        // 验证模板是否属于用户
        await this.validateTaskDependenciesV3(userId, { 
          sender_id: task.sender_id, 
          template_ids: updateData.template_ids 
        });

        // 更新templates JSONB字段
        updateFields.templates = updateData.template_ids;
      }

      await transaction.commit();

      // 重新获取更新后的任务
      const updatedTask = await this.getTaskById(taskId, userId);
      return this.formatTaskOutputV3(updatedTask);

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = new TaskService(); 