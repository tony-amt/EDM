const { EventLog, SubTask, Task, TemplateSet, sequelize } = require('../../models');
const { AppError, handleServiceError } = require('../../utils/errorHandler');
const { URL } = require('url');

class TrackingService {
  /**
   * V2.0: 记录邮件打开事件 - 使用SubTask模型
   */
  async recordOpenEvent(subTaskId, eventData) {
    const { ip_address, user_agent } = eventData;
    let transaction;
    try {
      transaction = await sequelize.transaction();

      const subTask = await SubTask.findByPk(subTaskId, {
        include: [{ model: Task, as: 'task' }],
        transaction
      });

      if (!subTask || !subTask.task) {
        console.warn(`Open event: SubTask or associated Task not found for ID: ${subTaskId}. Silently failing.`);
        // It's common to fail silently for open tracking pixels to not break image rendering in emails.
        if (transaction) await transaction.commit();
        return;
      }

      // V2.0: 记录事件日志
      await EventLog.create({
        event_type: 'open',
        task_id: subTask.task_id,
        task_contact_id: subTask.id, // 使用SubTask ID
        contact_id: subTask.contact_id,
        payload: JSON.stringify({
          ip_address,
          user_agent,
          timestamp: new Date()
        }),
        timestamp: new Date(),
        source: 'v2.0_tracking'
      }, { transaction });

      // V2.0: 更新SubTask状态
      const isFirstOpen = subTask.status !== 'opened' && subTask.status !== 'clicked';
      
      subTask.status = 'opened';
      subTask.opened_at = new Date();
      subTask.tracking_data = {
        ...subTask.tracking_data,
        open_count: (subTask.tracking_data?.open_count || 0) + 1,
        last_opened_at: new Date(),
        user_agent,
        ip_address
      };
      
      await subTask.save({ transaction });

      // V2.0: 更新Task统计数据
      if (isFirstOpen) {
        await this.updateTaskStats(subTask.task_id, 'opened', transaction);
      }

      await transaction.commit();
      console.log(`V2.0 Open event recorded for SubTask: ${subTaskId}`);
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error(`Error recording open event for SubTask ${subTaskId}:`, error);
    }
  }

  /**
   * V2.0: 记录点击事件并返回目标URL - 使用SubTask模型
   */
  async recordClickEventAndGetUrl(subTaskId, linkIdentifier, eventData) {
    const { ip_address, user_agent } = eventData;
    let transaction;
    try {
      transaction = await sequelize.transaction();

      const subTask = await SubTask.findByPk(subTaskId, {
        include: [
          {
            model: Task,
            as: 'task',
            include: [{ model: TemplateSet, as: 'templateSet' }]
          }
        ],
        transaction
      });

      if (!subTask || !subTask.task) {
        throw new AppError('Tracking link is invalid or has expired (SubTask not found).', 404);
      }

      // V2.0: 从SubTask的rendered_body中解析链接
      let actualTargetUrl = '';
      let foundLink = false;

      // 优先从SubTask的渲染内容中查找链接
      if (subTask.rendered_body) {
        const linkRegex = new RegExp(`data-link-id="${linkIdentifier}"[^>]*href="([^"]*)"`, 'i');
        const match = subTask.rendered_body.match(linkRegex);
        if (match && match[1]) {
          actualTargetUrl = match[1];
          foundLink = true;
        }
      }

      // 如果没找到，尝试从模板中查找
      if (!foundLink && subTask.task.templateSet) {
        // TODO: 从TemplateSet中查找链接映射
        // 暂时使用简化逻辑
        if (linkIdentifier.startsWith('http://') || linkIdentifier.startsWith('https://')) {
          try {
            new URL(linkIdentifier);
            actualTargetUrl = linkIdentifier;
            foundLink = true;
          } catch (e) { /* not a valid URL */ }
        }
      }

      if (!foundLink || !actualTargetUrl) {
        console.error(`Click event: Could not resolve linkIdentifier '${linkIdentifier}' for SubTask ${subTaskId}`);
        throw new AppError('The link you followed is invalid or no longer active.', 404);
      }

      // V2.0: 记录点击事件
      await EventLog.create({
        event_type: 'click',
        task_id: subTask.task_id,
        task_contact_id: subTask.id,
        contact_id: subTask.contact_id,
        payload: JSON.stringify({
          ip_address,
          user_agent,
          link_url: actualTargetUrl,
          link_identifier: linkIdentifier,
          timestamp: new Date()
        }),
        timestamp: new Date(),
        source: 'v2.0_tracking'
      }, { transaction });

      // V2.0: 更新SubTask状态
      const isFirstClick = subTask.status !== 'clicked';
      
      subTask.status = 'clicked';
      subTask.clicked_at = new Date();
      subTask.tracking_data = {
        ...subTask.tracking_data,
        click_count: (subTask.tracking_data?.click_count || 0) + 1,
        last_clicked_at: new Date(),
        clicked_links: [
          ...(subTask.tracking_data?.clicked_links || []),
          { url: actualTargetUrl, timestamp: new Date() }
        ]
      };
      
      await subTask.save({ transaction });

      // V2.0: 更新Task统计数据
      if (isFirstClick) {
        await this.updateTaskStats(subTask.task_id, 'clicked', transaction);
      }

      await transaction.commit();
      console.log(`V2.0 Click event recorded for SubTask: ${subTaskId}, URL: ${actualTargetUrl}`);
      return actualTargetUrl;

    } catch (error) {
      if (transaction) await transaction.rollback();
      handleServiceError(error, 'Error recording click event and retrieving URL');
    }
  }

  /**
   * V2.0: 更新Task级别的统计数据
   */
  async updateTaskStats(taskId, eventType, transaction) {
    try {
      const task = await Task.findByPk(taskId, { transaction });
      if (!task) return;

      const currentStats = task.summary_stats || {
        total_recipients: 0,
        pending: 0,
        sent: 0,
        delivered: 0,
        bounced: 0,
        opened: 0,
        clicked: 0,
        failed: 0
      };

      // 根据事件类型更新统计
      if (eventType === 'opened') {
        currentStats.opened = (currentStats.opened || 0) + 1;
      } else if (eventType === 'clicked') {
        currentStats.clicked = (currentStats.clicked || 0) + 1;
      }

      await task.update({ summary_stats: currentStats }, { transaction });
      console.log(`Task ${taskId} stats updated: ${eventType} +1`);
    } catch (error) {
      console.error(`Error updating task stats for ${taskId}:`, error);
    }
  }

  /**
   * V2.0: 获取Task的详细统计数据
   */
  async getTaskAnalytics(taskId) {
    try {
      const task = await Task.findByPk(taskId, {
        include: [{ model: SubTask, as: 'subTasks' }]
      });

      if (!task) {
        throw new AppError('Task not found', 404);
      }

      // 实时计算统计数据
      const subTasks = task.subTasks || [];
      const stats = {
        total_recipients: subTasks.length,
        pending: subTasks.filter(st => st.status === 'pending').length,
        sent: subTasks.filter(st => ['sent', 'delivered', 'opened', 'clicked'].includes(st.status)).length,
        delivered: subTasks.filter(st => ['delivered', 'opened', 'clicked'].includes(st.status)).length,
        opened: subTasks.filter(st => ['opened', 'clicked'].includes(st.status)).length,
        clicked: subTasks.filter(st => st.status === 'clicked').length,
        failed: subTasks.filter(st => st.status === 'failed').length,
        bounced: subTasks.filter(st => st.status === 'bounced').length
      };

      // 计算比率
      const rates = {
        open_rate: stats.sent > 0 ? (stats.opened / stats.sent * 100).toFixed(2) : 0,
        click_rate: stats.sent > 0 ? (stats.clicked / stats.sent * 100).toFixed(2) : 0,
        delivery_rate: stats.sent > 0 ? (stats.delivered / stats.sent * 100).toFixed(2) : 0
      };

      return {
        task_id: taskId,
        statistics: stats,
        rates: rates,
        last_updated: new Date()
      };
    } catch (error) {
      handleServiceError(error, 'Error getting task analytics');
    }
  }
}

module.exports = new TrackingService(); 