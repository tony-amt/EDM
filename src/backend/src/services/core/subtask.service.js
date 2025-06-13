const { SubTask, Task, Contact, Template, sequelize } = require('../../models');
const AppError = require('../../utils/appError');
const { Op } = require('sequelize');

/**
 * V2.0 群发子任务服务
 * 管理单个邮件发送的最小单元
 */
class SubTaskService {

  /**
   * 根据TaskID获取SubTask列表
   */
  async getSubTasksByTaskId(taskId, options = {}) {
    const { page = 1, limit = 20, status } = options;
    
    const whereClause = { task_id: taskId };
    
    if (status) {
      whereClause.status = status;
    }

    const { count, rows } = await SubTask.findAndCountAll({
      where: whereClause,
      include: [
        { 
          model: Contact, 
          as: 'contact',
          attributes: ['id', 'name', 'email']
        },
        { 
          model: Template, 
          as: 'template',
          attributes: ['id', 'name', 'subject']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: limit,
      offset: (page - 1) * limit
    });

    return {
      items: rows.map(subTask => this.formatSubTaskOutput(subTask)),
      total: count,
      page,
      limit,
      pages: Math.ceil(count / limit)
    };
  }

  /**
   * 获取单个SubTask详情
   */
  async getSubTaskById(subTaskId) {
    const subTask = await SubTask.findByPk(subTaskId, {
      include: [
        { 
          model: Task, 
          as: 'task',
          attributes: ['id', 'name', 'status']
        },
        { 
          model: Contact, 
          as: 'contact',
          attributes: ['id', 'name', 'email']
        },
        { 
          model: Template, 
          as: 'template',
          attributes: ['id', 'name', 'subject']
        }
      ]
    });

    if (!subTask) {
      throw new AppError('SubTask not found', 404);
    }

    return this.formatSubTaskOutput(subTask, true);
  }

  /**
   * 更新SubTask状态
   */
  async updateSubTaskStatus(subTaskId, statusData) {
    const subTask = await SubTask.findByPk(subTaskId);

    if (!subTask) {
      throw new AppError('SubTask not found', 404);
    }

    const { status, error_message, email_service_response } = statusData;

    // 状态转换验证
    const validTransitions = {
      'pending': ['sent', 'failed'],
      'sent': ['delivered', 'bounced', 'failed'],
      'delivered': ['opened', 'clicked'],
      'opened': ['clicked'],
      'bounced': [],
      'clicked': [],
      'failed': ['pending'] // 允许重试
    };

    if (!validTransitions[subTask.status].includes(status)) {
      throw new AppError(`Cannot transition from ${subTask.status} to ${status}`, 400);
    }

    const updateData = { status };

    // 根据状态设置时间戳
    switch (status) {
      case 'sent':
        updateData.sent_at = new Date();
        break;
      case 'delivered':
        updateData.delivered_at = new Date();
        break;
      case 'opened':
        updateData.opened_at = new Date();
        break;
      case 'clicked':
        updateData.clicked_at = new Date();
        break;
      case 'failed':
        updateData.error_message = error_message;
        updateData.retry_count = subTask.retry_count + 1;
        // 设置重试时间（指数退避）
        const retryDelay = Math.pow(2, subTask.retry_count) * 60 * 1000; // 分钟
        updateData.next_retry_at = new Date(Date.now() + retryDelay);
        break;
    }

    if (email_service_response) {
      updateData.email_service_response = email_service_response;
    }

    await subTask.update(updateData);

    // 更新任务统计
    await this.updateTaskStats(subTask.task_id);

    return this.formatSubTaskOutput(subTask);
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
      sent: 0,
      delivered: 0,
      bounced: 0,
      opened: 0,
      clicked: 0,
      failed: 0
    };

    statusStats.forEach(stat => {
      stats[stat.status] = parseInt(stat.count);
      stats.total_recipients += parseInt(stat.count);
    });

    await task.update({ summary_stats: stats });
  }

  /**
   * 获取待重试的SubTask列表
   */
  async getRetryableSubTasks() {
    return await SubTask.findAll({
      where: {
        status: 'failed',
        retry_count: { [Op.lt]: 3 }, // 最多重试3次
        next_retry_at: { [Op.lte]: new Date() }
      },
      include: [
        { 
          model: Task, 
          as: 'task',
          where: { status: 'sending' } // 只有正在发送的任务才重试
        }
      ]
    });
  }

  /**
   * 批量更新SubTask状态
   */
  async batchUpdateSubTaskStatus(subTaskIds, statusData) {
    const transaction = await sequelize.transaction();
    
    try {
      const results = [];
      
      for (const subTaskId of subTaskIds) {
        const result = await this.updateSubTaskStatus(subTaskId, statusData);
        results.push(result);
      }
      
      await transaction.commit();
      return results;
      
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  /**
   * 获取SubTask统计信息
   */
  async getSubTaskStats(filters = {}) {
    const { task_id, date_from, date_to } = filters;
    
    const whereClause = {};
    
    if (task_id) {
      whereClause.task_id = task_id;
    }
    
    if (date_from || date_to) {
      whereClause.created_at = {};
      if (date_from) {
        whereClause.created_at[Op.gte] = new Date(date_from);
      }
      if (date_to) {
        whereClause.created_at[Op.lte] = new Date(date_to);
      }
    }

    const totalSubTasks = await SubTask.count({ where: whereClause });
    
    const statusStats = await SubTask.findAll({
      where: whereClause,
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    const stats = {
      total_subtasks: totalSubTasks,
      by_status: {}
    };

    statusStats.forEach(stat => {
      stats.by_status[stat.status] = parseInt(stat.count);
    });

    // 计算成功率
    const sent = stats.by_status.sent || 0;
    const delivered = stats.by_status.delivered || 0;
    const failed = stats.by_status.failed || 0;
    const bounced = stats.by_status.bounced || 0;

    stats.success_rate = totalSubTasks > 0 ? 
      ((sent + delivered) / totalSubTasks * 100).toFixed(2) : 0;
    
    stats.failure_rate = totalSubTasks > 0 ? 
      ((failed + bounced) / totalSubTasks * 100).toFixed(2) : 0;

    return stats;
  }

  /**
   * 获取热力图数据（按小时分布）
   */
  async getSubTaskHeatmapData(taskId, date) {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const subTasks = await SubTask.findAll({
      where: {
        task_id: taskId,
        sent_at: {
          [Op.between]: [startDate, endDate]
        }
      },
      attributes: [
        [sequelize.fn('EXTRACT', sequelize.literal('HOUR FROM sent_at')), 'hour'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: [sequelize.fn('EXTRACT', sequelize.literal('HOUR FROM sent_at'))],
      raw: true
    });

    // 初始化24小时数据
    const heatmapData = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: 0
    }));

    // 填充实际数据
    subTasks.forEach(item => {
      const hour = parseInt(item.hour);
      heatmapData[hour].count = parseInt(item.count);
    });

    return heatmapData;
  }

  /**
   * 格式化SubTask输出
   */
  formatSubTaskOutput(subTask, detailed = false) {
    const output = {
      id: subTask.id,
      task_id: subTask.task_id,
      status: subTask.status,
      sender_email: subTask.sender_email,
      recipient_email: subTask.recipient_email,
      rendered_subject: subTask.rendered_subject,
      sent_at: subTask.sent_at,
      delivered_at: subTask.delivered_at,
      opened_at: subTask.opened_at,
      clicked_at: subTask.clicked_at,
      retry_count: subTask.retry_count,
      created_at: subTask.created_at,
      updated_at: subTask.updated_at
    };

    if (subTask.contact) {
      output.contact = {
        id: subTask.contact.id,
        name: subTask.contact.name,
        email: subTask.contact.email
      };
    }

    if (subTask.template) {
      output.template = {
        id: subTask.template.id,
        name: subTask.template.name,
        subject: subTask.template.subject
      };
    }

    if (detailed) {
      output.rendered_body = subTask.rendered_body;
      output.error_message = subTask.error_message;
      output.email_service_response = subTask.email_service_response;
      output.next_retry_at = subTask.next_retry_at;
      output.tracking_id = subTask.tracking_id;
      
      if (subTask.task) {
        output.task = {
          id: subTask.task.id,
          name: subTask.task.name,
          status: subTask.task.status
        };
      }
    }

    return output;
  }
}

module.exports = new SubTaskService(); 