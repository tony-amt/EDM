const logger = require('../utils/logger');
const { TaskContact, Task, EventLog, sequelize } = require('../models');
const { AppError } = require('../utils/errorHandler');

class WebhookController {
  /**
   * 处理极光邮件事件回调
   * 支持的事件类型：delivered, open, click, bounce, unsubscribe, complaint
   */
  async handleMailEvent(req, res, next) {
    try {
      const eventData = req.body;
      
      // 验证事件数据
      if (!eventData || !eventData.event || !eventData.message_id) {
        logger.warn('无效的Webhook事件数据', { body: req.body });
        return res.status(400).json({ success: false, message: '无效的事件数据' });
      }
      
      logger.info(`收到邮件事件: ${eventData.event}`, { 
        message_id: eventData.message_id,
        event: eventData.event,
        timestamp: eventData.timestamp 
      });
      
      // 根据message_id查找对应的TaskContact
      let taskContact = null;
      
      // 使用tracking_id或message_id查找
      if (eventData.tracking_id) {
        taskContact = await TaskContact.findOne({ where: { id: eventData.tracking_id } });
      }
      
      if (!taskContact && eventData.message_id) {
        taskContact = await TaskContact.findOne({ where: { message_id: eventData.message_id } });
      }
      
      if (!taskContact) {
        logger.warn('未找到对应的邮件任务联系人记录', { 
          message_id: eventData.message_id,
          tracking_id: eventData.tracking_id 
        });
        
        // 仍然返回成功，避免极光API重试
        return res.status(200).json({ success: true, message: '事件已接收，但未找到对应记录' });
      }
      
      // 查找对应的任务
      const task = await Task.findByPk(taskContact.task_id);
      if (!task) {
        logger.warn('未找到对应的邮件任务', { task_id: taskContact.task_id });
        return res.status(200).json({ success: true, message: '事件已接收，但未找到对应任务' });
      }
      
      // 记录事件日志
      await EventLog.create({
        event_type: eventData.event,
        task_id: taskContact.task_id,
        task_contact_id: taskContact.id,
        contact_id: taskContact.contact_id,
        payload: JSON.stringify(eventData),
        timestamp: eventData.timestamp ? new Date(eventData.timestamp * 1000) : new Date(),
        source: 'engagelab'
      });
      
      // 更新TaskContact状态
      const updateData = {};
      const now = new Date();
      
      switch (eventData.event) {
        case 'delivered':
          updateData.status = 'delivered';
          updateData.delivered_at = now;
          break;
        case 'open':
          updateData.status = 'opened';
          updateData.opened_at = now;
          break;
        case 'click':
          updateData.status = 'clicked';
          updateData.clicked_at = now;
          // 可以记录点击的URL
          updateData.click_data = JSON.stringify({
            url: eventData.url || '',
            timestamp: now
          });
          break;
        case 'bounce':
          updateData.status = 'bounced';
          updateData.bounced_at = now;
          updateData.bounce_type = eventData.bounce_type || 'unknown';
          updateData.bounce_reason = eventData.reason || '';
          break;
        case 'dropped':
          updateData.status = 'dropped';
          updateData.dropped_at = now;
          updateData.drop_reason = eventData.reason || '';
          break;
        case 'unsubscribe':
          updateData.status = 'unsubscribed';
          updateData.unsubscribed_at = now;
          break;
        case 'complaint':
          updateData.status = 'complained';
          updateData.complained_at = now;
          break;
        default:
          // 未知事件类型，只记录日志不更新状态
          logger.info(`未处理的事件类型: ${eventData.event}`);
      }
      
      // 如果有需要更新的数据
      if (Object.keys(updateData).length > 0) {
        await taskContact.update(updateData);
        
        // 更新任务统计信息
        await this._updateTaskStats(task.id);
        
        logger.info(`已更新邮件状态: ${eventData.event}`, { 
          task_contact_id: taskContact.id,
          task_id: task.id,
          status: updateData.status
        });
      }
      
      return res.status(200).json({ 
        success: true, 
        message: '事件已处理',
        task_contact_id: taskContact.id,
        task_id: task.id
      });
    } catch (error) {
      logger.error('处理Webhook事件失败', error);
      
      // 仍然返回200，避免极光API重试
      return res.status(200).json({ 
        success: false, 
        message: '处理事件时发生错误',
        error: error.message
      });
    }
  }
  
  /**
   * 更新任务统计信息
   * @param {string} taskId - 任务ID
   * @private
   */
  async _updateTaskStats(taskId) {
    try {
      const task = await Task.findByPk(taskId);
      if (!task) return;
      
      // 获取任务的各种状态计数
      const counts = await TaskContact.findAll({
        where: { task_id: taskId },
        attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
        group: ['status']
      });
      
      // 构建统计对象
      const stats = {
        total_recipients: 0,
        pending: 0,
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        dropped: 0,
        unsubscribed: 0,
        complained: 0
      };
      
      // 填充统计数据
      counts.forEach(result => {
        const { status, count } = result.toJSON();
        switch (status) {
          case 'pending':
            stats.pending = parseInt(count, 10);
            break;
          case 'sent':
            stats.sent = parseInt(count, 10);
            break;
          case 'delivered':
            stats.delivered = parseInt(count, 10);
            break;
          case 'opened':
            stats.opened = parseInt(count, 10);
            break;
          case 'clicked':
            stats.clicked = parseInt(count, 10);
            break;
          case 'bounced':
            stats.bounced = parseInt(count, 10);
            break;
          case 'dropped':
            stats.dropped = parseInt(count, 10);
            break;
          case 'unsubscribed':
            stats.unsubscribed = parseInt(count, 10);
            break;
          case 'complained':
            stats.complained = parseInt(count, 10);
            break;
        }
      });
      
      // 计算总数
      stats.total_recipients = Object.values(stats).reduce((sum, count) => sum + count, 0) - stats.total_recipients;
      
      // 计算相关比率
      if (stats.sent > 0) {
        stats.delivery_rate = parseFloat(((stats.delivered / stats.sent) * 100).toFixed(2));
      }
      
      if (stats.delivered > 0) {
        stats.open_rate = parseFloat(((stats.opened / stats.delivered) * 100).toFixed(2));
        stats.click_rate = parseFloat(((stats.clicked / stats.delivered) * 100).toFixed(2));
      }
      
      // 更新任务统计信息
      await task.update({ summary_stats: stats });
      
      logger.info(`已更新任务统计信息`, { taskId, stats });
    } catch (error) {
      logger.error(`更新任务统计信息失败: ${taskId}`, error);
    }
  }
  
  /**
   * 测试Webhook
   */
  async testWebhook(req, res, next) {
    try {
      const testData = req.body || {};
      
      logger.info('收到Webhook测试请求', testData);
      
      return res.status(200).json({
        success: true,
        message: 'Webhook测试成功',
        received_at: new Date(),
        data: testData
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new WebhookController(); 