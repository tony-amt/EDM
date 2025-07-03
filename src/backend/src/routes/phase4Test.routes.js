const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { Task, SubTask, EmailService, Contact, Template, Sender, sequelize } = require('../models/index');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

/**
 * 🎯 Phase 4测试路由集合
 * 测试两阶段队列系统的完整功能
 */

/**
 * @route GET /api/test/phase4/status
 * @desc 获取Phase 4队列系统状态
 */
router.get('/status', protect, async (req, res) => {
  try {
    const QueueSchedulerV2 = require('../services/core/queueSchedulerV2.service');

    // 检查调度器状态
    let schedulerStatus = null;
    try {
      if (global.queueSchedulerV2Instance) {
        schedulerStatus = await global.queueSchedulerV2Instance.getQueueStatus();
      } else {
        schedulerStatus = { status: 'not_started', message: '调度器未启动' };
      }
    } catch (error) {
      schedulerStatus = { status: 'error', message: error.message };
    }

    // 获取发信服务状态
    const emailServices = await EmailService.findAll({
      attributes: ['id', 'name', 'is_enabled', 'used_quota', 'daily_quota',
        'next_available_at', 'last_sent_at', 'total_sent', 'success_rate'],
      order: [['name', 'ASC']]
    });

    const servicesStatus = emailServices.map(service => ({
      id: service.id,
      name: service.name,
      is_enabled: service.is_enabled,
      quota_usage: `${service.used_quota}/${service.daily_quota}`,
      quota_percentage: Math.round((service.used_quota / service.daily_quota) * 100),
      is_available: service.isAvailable ? service.isAvailable() : 'unknown',
      next_available_at: service.next_available_at,
      last_sent_at: service.last_sent_at,
      total_sent: service.total_sent,
      success_rate: service.success_rate
    }));

    // 获取任务队列状态
    const queuedTasks = await Task.findAll({
      where: {
        status: { [Op.in]: ['pending', 'running', 'sending'] },
        pending_subtasks: { [Op.gt]: 0 }
      },
      attributes: ['id', 'name', 'status', 'total_subtasks', 'pending_subtasks', 'allocated_subtasks'],
      order: [['created_at', 'DESC']],
      limit: 10
    });

    // 获取SubTask状态统计
    const subTaskStats = await SubTask.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    const statusCounts = {};
    subTaskStats.forEach(stat => {
      statusCounts[stat.status] = parseInt(stat.count);
    });

    res.json({
      success: true,
      data: {
        phase: 'Phase 4 - 两阶段队列系统',
        scheduler_status: schedulerStatus,
        email_services: servicesStatus,
        available_services: servicesStatus.filter(s => s.is_available === true).length,
        queued_tasks: queuedTasks.length,
        active_tasks: queuedTasks,
        subtask_stats: statusCounts,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('❌ Phase 4状态查询失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/test/phase4/create-test-task
 * @desc 创建Phase 4测试任务
 */
router.post('/create-test-task', protect, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.user.id;

    // 1. 获取测试数据
    const contacts = await Contact.findAll({
      where: { user_id: userId },
      limit: 5,
      attributes: ['id', 'email', 'name']
    });

    if (contacts.length === 0) {
      throw new Error('没有找到测试联系人');
    }

    const templates = await Template.findAll({
      where: { user_id: userId },
      limit: 2,
      attributes: ['id', 'name', 'subject', 'body']
    });

    if (templates.length === 0) {
      throw new Error('没有找到邮件模板');
    }

    const sender = await Sender.findOne({
      where: { user_id: userId },
      attributes: ['id', 'name', 'email']
    });

    if (!sender) {
      throw new Error('没有找到发信人');
    }

    // 2. 创建测试任务
    const task = await Task.create({
      name: `Phase 4测试任务 - ${new Date().toLocaleString()}`,
      description: 'Phase 4两阶段队列系统测试',
      status: 'scheduled',
      priority: 1,
      recipient_rule: {
        type: 'specific',
        contact_ids: contacts.map(c => c.id)
      },
      sender_id: sender.id,
      created_by: userId,
      contacts: contacts.map(c => c.id),
      templates: templates.map(t => t.id),
      scheduled_at: new Date(), // 立即调度
      summary_stats: {
        total_recipients: contacts.length,
        pending: contacts.length,
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

    await transaction.commit();

    logger.info(`✅ 创建Phase 4测试任务: ${task.id}, 联系人: ${contacts.length}, 模板: ${templates.length}`);

    res.json({
      success: true,
      message: 'Phase 4测试任务创建成功',
      data: {
        task_id: task.id,
        task_name: task.name,
        contacts_count: contacts.length,
        templates_count: templates.length,
        sender: sender.name,
        status: task.status,
        scheduled_at: task.scheduled_at
      }
    });

  } catch (error) {
    await transaction.rollback();
    logger.error('❌ 创建Phase 4测试任务失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/test/phase4/trigger-scheduler
 * @desc 手动触发队列调度器处理
 */
router.post('/trigger-scheduler', protect, async (req, res) => {
  try {
    const QueueSchedulerV2 = require('../services/core/queueSchedulerV2.service');

    // 确保调度器已启动
    if (!global.queueSchedulerV2Instance) {
      global.queueSchedulerV2Instance = new QueueSchedulerV2();
      await global.queueSchedulerV2Instance.start();
    }

    const scheduler = global.queueSchedulerV2Instance;

    // 手动触发scheduled任务处理
    await scheduler.processScheduledTasks();

    // 获取最新状态
    const status = await scheduler.getQueueStatus();

    res.json({
      success: true,
      message: '队列调度器手动触发完成',
      data: {
        scheduler_status: status,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('❌ 手动触发队列调度器失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/test/phase4/task-details/:taskId
 * @desc 获取任务详细信息和SubTask状态
 */
router.get('/task-details/:taskId', protect, async (req, res) => {
  try {
    const { taskId } = req.params;

    // 获取任务信息
    const task = await Task.findByPk(taskId, {
      include: [
        { model: Sender, as: 'sender', attributes: ['id', 'name', 'email'] }
      ]
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }

    // 获取SubTask列表
    const subTasks = await SubTask.findAll({
      where: { task_id: taskId },
      include: [
        { model: Contact, as: 'contact', attributes: ['id', 'email', 'name'] },
        { model: Template, as: 'template', attributes: ['id', 'name', 'subject'] },
        { model: EmailService, as: 'emailService', attributes: ['id', 'name', 'domain'] }
      ],
      order: [['created_at', 'ASC']]
    });

    // 统计SubTask状态
    const statusStats = {};
    subTasks.forEach(subTask => {
      statusStats[subTask.status] = (statusStats[subTask.status] || 0) + 1;
    });

    // 获取发送性能数据
    const sentSubTasks = subTasks.filter(st => st.status === 'sent' && st.sent_at);
    const avgResponseTime = sentSubTasks.length > 0
      ? sentSubTasks.reduce((sum, st) => {
        const responseTime = st.sent_at - st.scheduled_at;
        return sum + responseTime;
      }, 0) / sentSubTasks.length
      : 0;

    res.json({
      success: true,
      data: {
        task: {
          id: task.id,
          name: task.name,
          status: task.status,
          total_subtasks: task.total_subtasks,
          pending_subtasks: task.pending_subtasks,
          allocated_subtasks: task.allocated_subtasks,
          created_at: task.created_at,
          scheduled_at: task.scheduled_at,
          completed_at: task.completed_at,
          sender: task.sender,
          summary_stats: task.summary_stats
        },
        subtasks: subTasks.map(st => ({
          id: st.id,
          status: st.status,
          recipient_email: st.recipient_email,
          sender_email: st.sender_email,
          scheduled_at: st.scheduled_at,
          sent_at: st.sent_at,
          contact: st.contact,
          template: st.template,
          email_service: st.emailService,
          error_message: st.error_message,
          tracking_id: st.tracking_id
        })),
        statistics: {
          status_counts: statusStats,
          avg_response_time_ms: Math.round(avgResponseTime),
          total_count: subTasks.length,
          success_rate: subTasks.length > 0
            ? Math.round((statusStats.sent || 0) / subTasks.length * 100)
            : 0
        }
      }
    });

  } catch (error) {
    logger.error('❌ 获取任务详情失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/test/phase4/service-performance
 * @desc 获取发信服务性能统计
 */
router.get('/service-performance', protect, async (req, res) => {
  try {
    const { hours = 24 } = req.query;

    // 获取发信服务统计
    const serviceStats = await EmailService.getServiceStats(null, parseInt(hours));

    // 获取最近发送的SubTask统计
    const recentSubTasks = await SubTask.findAll({
      where: {
        sent_at: {
          [Op.gte]: new Date(Date.now() - hours * 60 * 60 * 1000)
        }
      },
      include: [
        { model: EmailService, as: 'emailService', attributes: ['id', 'name'] }
      ],
      attributes: ['id', 'status', 'sent_at', 'scheduled_at', 'service_id'],
      raw: true
    });

    // 按服务分组统计性能
    const performanceByService = {};
    recentSubTasks.forEach(subTask => {
      const serviceId = subTask.service_id;
      if (!performanceByService[serviceId]) {
        performanceByService[serviceId] = {
          service_name: subTask['emailService.name'] || 'Unknown',
          total_sent: 0,
          avg_response_time: 0,
          response_times: []
        };
      }

      const perf = performanceByService[serviceId];
      perf.total_sent++;

      if (subTask.sent_at && subTask.scheduled_at) {
        const responseTime = new Date(subTask.sent_at) - new Date(subTask.scheduled_at);
        perf.response_times.push(responseTime);
      }
    });

    // 计算平均响应时间
    Object.keys(performanceByService).forEach(serviceId => {
      const perf = performanceByService[serviceId];
      if (perf.response_times.length > 0) {
        perf.avg_response_time = Math.round(
          perf.response_times.reduce((sum, time) => sum + time, 0) / perf.response_times.length
        );
      }
      delete perf.response_times; // 移除原始数据
    });

    res.json({
      success: true,
      data: {
        time_range_hours: parseInt(hours),
        service_stats: serviceStats,
        performance_stats: performanceByService,
        total_services: serviceStats.length,
        active_services: serviceStats.filter(s => s.is_available).length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('❌ 获取发信服务性能失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 