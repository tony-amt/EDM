/**
 * V2.0 SubTask管理控制器
 */
const { SubTask, Task, Contact, EmailService, Template } = require('../models');
const logger = require('../utils/logger');

/**
 * 获取SubTask列表
 */
const getSubTasks = async (req, res) => {
  try {
    const { 
      status, 
      task_id, 
      service_id,
      page = 1, 
      limit = 20 
    } = req.query;
    
    const whereCondition = {};
    if (status) whereCondition.status = status;
    if (task_id) whereCondition.task_id = task_id;
    if (service_id) whereCondition.service_id = service_id;
    
    const offset = (page - 1) * limit;
    
    const subtasks = await SubTask.findAndCountAll({
      where: whereCondition,
      include: [
        {
          model: Task,
          as: 'task',
          attributes: ['id', 'name', 'status']
        },
        {
          model: Contact,
          as: 'contact',
          attributes: ['id', 'email', 'name']
        },
        {
          model: EmailService,
          as: 'emailService',
          attributes: ['id', 'name', 'provider', 'domain']
        },
        {
          model: Template,
          as: 'template',
          attributes: ['id', 'name', 'subject']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: subtasks.rows,
      pagination: {
        total: subtasks.count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(subtasks.count / limit)
      }
    });
  } catch (error) {
    logger.error('获取SubTask列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 获取SubTask详情
 */
const getSubTaskById = async (req, res) => {
  try {
    const subtask = await SubTask.findByPk(req.params.id, {
      include: [
        {
          model: Task,
          as: 'task',
          attributes: ['id', 'name', 'status', 'created_by']
        },
        {
          model: Contact,
          as: 'contact',
          attributes: ['id', 'email', 'name']
        },
        {
          model: EmailService,
          as: 'emailService',
          attributes: ['id', 'name', 'provider', 'domain']
        },
        {
          model: Template,
          as: 'template',
          attributes: ['id', 'name', 'subject', 'body']
        }
      ]
    });
    
    if (!subtask) {
      return res.status(404).json({ success: false, error: 'SubTask不存在' });
    }

    res.json({
      success: true,
      data: subtask
    });
  } catch (error) {
    logger.error('获取SubTask详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 重新调度SubTask
 */
const rescheduleSubTask = async (req, res) => {
  try {
    const { scheduled_at, priority } = req.body;
    
    const subtask = await SubTask.findByPk(req.params.id);
    if (!subtask) {
      return res.status(404).json({ success: false, error: 'SubTask不存在' });
    }

    // 只有pending或failed的SubTask可以重新调度
    if (!['pending', 'failed'].includes(subtask.status)) {
      return res.status(400).json({ 
        success: false, 
        error: '只有pending或failed状态的SubTask可以重新调度' 
      });
    }

    const updateData = {};
    if (scheduled_at) updateData.scheduled_at = new Date(scheduled_at);
    if (priority !== undefined) updateData.priority = priority;
    
    // 如果是failed状态，重置为pending
    if (subtask.status === 'failed') {
      updateData.status = 'pending';
      updateData.error_message = null;
      updateData.retry_count = 0;
    }

    await subtask.update(updateData);

    logger.info(`SubTask ${subtask.id} 重新调度成功`);

    res.json({
      success: true,
      data: subtask
    });
  } catch (error) {
    logger.error('重新调度SubTask失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 取消SubTask
 */
const cancelSubTask = async (req, res) => {
  try {
    const subtask = await SubTask.findByPk(req.params.id);
    if (!subtask) {
      return res.status(404).json({ success: false, error: 'SubTask不存在' });
    }

    // 只有pending、allocated状态可以取消
    if (!['pending', 'allocated'].includes(subtask.status)) {
      return res.status(400).json({ 
        success: false, 
        error: '只有pending或allocated状态的SubTask可以取消' 
      });
    }

    await subtask.update({
      status: 'failed',
      error_message: 'Cancelled by user'
    });

    logger.info(`SubTask ${subtask.id} 取消成功`);

    res.json({
      success: true,
      message: 'SubTask取消成功'
    });
  } catch (error) {
    logger.error('取消SubTask失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 批量操作SubTask
 */
const bulkOperateSubTasks = async (req, res) => {
  try {
    const { subtask_ids, operation, data } = req.body;

    if (!subtask_ids || !Array.isArray(subtask_ids) || subtask_ids.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: '请提供有效的SubTask ID列表' 
      });
    }

    let updateData = {};
    let whereCondition = { 
      id: { [require('sequelize').Op.in]: subtask_ids } 
    };

    switch (operation) {
      case 'reschedule':
        if (!data.scheduled_at) {
          return res.status(400).json({ 
            success: false, 
            error: '重新调度需要提供scheduled_at' 
          });
        }
        updateData = {
          scheduled_at: new Date(data.scheduled_at),
          priority: data.priority || 0
        };
        whereCondition.status = ['pending', 'failed'];
        break;

      case 'cancel':
        updateData = {
          status: 'cancelled',
          cancelled_at: new Date()
        };
        whereCondition.status = ['pending', 'allocated'];
        break;

      case 'retry':
        updateData = {
          status: 'pending',
          error_message: null,
          retry_count: 0
        };
        whereCondition.status = 'failed';
        break;

      default:
        return res.status(400).json({ 
          success: false, 
          error: '不支持的操作类型' 
        });
    }

    const [affectedCount] = await SubTask.update(updateData, { where: whereCondition });

    logger.info(`批量操作SubTask完成: ${operation}, 影响 ${affectedCount} 条记录`);

    res.json({
      success: true,
      message: `批量操作完成，影响 ${affectedCount} 条记录`,
      affected_count: affectedCount
    });
  } catch (error) {
    logger.error('批量操作SubTask失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 获取SubTask统计信息
 */
const getSubTaskStats = async (req, res) => {
  try {
    const { task_id, date_from, date_to } = req.query;
    
    const whereCondition = {};
    if (task_id) whereCondition.task_id = task_id;
    if (date_from || date_to) {
      whereCondition.created_at = {};
      if (date_from) whereCondition.created_at[require('sequelize').Op.gte] = new Date(date_from);
      if (date_to) whereCondition.created_at[require('sequelize').Op.lte] = new Date(date_to);
    }

    const stats = await SubTask.findAll({
      where: whereCondition,
      attributes: [
        'status',
        [require('sequelize').fn('COUNT', '*'), 'count']
      ],
      group: ['status'],
      raw: true
    });

    const result = {
      total: stats.reduce((sum, item) => sum + parseInt(item.count), 0),
      by_status: stats.reduce((acc, item) => {
        acc[item.status] = parseInt(item.count);
        return acc;
      }, {})
    };

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('获取SubTask统计失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getSubTasks,
  getSubTaskById,
  rescheduleSubTask,
  cancelSubTask,
  bulkOperateSubTasks,
  getSubTaskStats
}; 