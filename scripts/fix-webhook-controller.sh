#!/bin/bash

# 修复Webhook控制器 - 使用custom_args.subtask_id关联SubTask
# 2025-07-01

set -e

echo "🔧 开始修复Webhook控制器..."

# SSH配置
SSH_CMD="sshpass -p 'Tony1231!' ssh ubuntu@43.135.38.15"

# 1. 备份原始文件
echo "📋 备份原始webhook控制器..."
$SSH_CMD "cd /opt/edm && cp src/backend/src/controllers/webhook.controller.js src/backend/src/controllers/webhook.controller.js.backup"

# 2. 创建修复后的webhook控制器
echo "🔧 创建修复后的webhook控制器..."
$SSH_CMD "cd /opt/edm && cat > src/backend/src/controllers/webhook.controller.js << 'EOF'
const logger = require('../utils/logger');
const { SubTask, Task, EventLog, sequelize } = require('../models');
const { AppError } = require('../utils/errorHandler');

class WebhookController {
  /**
   * 处理极光邮件事件回调
   * 支持的事件类型：delivered, open, click, bounce, unsubscribe, complaint
   */
  async handleMailEvent(req, res, next) {
    try {
      const eventData = req.body;
      
      // 🔧 修复：验证逻辑改为检查custom_args.subtask_id
      if (!eventData || !eventData.event || !eventData.custom_args || !eventData.custom_args.subtask_id) {
        logger.warn('无效的Webhook事件数据', { body: req.body });
        return res.status(400).json({ success: false, message: '无效的事件数据，缺少custom_args.subtask_id' });
      }
      
      const subtaskId = eventData.custom_args.subtask_id;
      
      logger.info(\`收到邮件事件: \${eventData.event}\`, { 
        subtask_id: subtaskId,
        event: eventData.event,
        timestamp: eventData.timestamp,
        custom_args: eventData.custom_args
      });
      
      // 🔧 修复：通过subtask_id查找对应的SubTask
      const subTask = await SubTask.findByPk(subtaskId);
      
      if (!subTask) {
        logger.warn('未找到对应的SubTask记录', { 
          subtask_id: subtaskId,
          event: eventData.event
        });
        
        // 仍然返回成功，避免极光API重试
        return res.status(200).json({ success: true, message: '事件已接收，但未找到对应SubTask' });
      }
      
      // 查找对应的任务
      const task = await Task.findByPk(subTask.task_id);
      if (!task) {
        logger.warn('未找到对应的Task', { task_id: subTask.task_id });
        return res.status(200).json({ success: true, message: '事件已接收，但未找到对应Task' });
      }
      
      // 记录事件日志
      await EventLog.create({
        event_type: eventData.event,
        task_id: subTask.task_id,
        subtask_id: subTask.id,
        contact_id: subTask.contact_id,
        payload: JSON.stringify(eventData),
        timestamp: eventData.timestamp ? new Date(eventData.timestamp * 1000) : new Date(),
        source: 'engagelab_webhook'
      });
      
      // 🔧 修复：更新SubTask状态
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
          // 记录点击数据
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
          logger.info(\`未处理的事件类型: \${eventData.event}\`);
      }
      
      // 如果有需要更新的数据
      if (Object.keys(updateData).length > 0) {
        await subTask.update(updateData);
        
        // 更新任务统计信息
        await this._updateTaskStats(task.id);
        
        logger.info(\`✅ 已更新SubTask状态: \${eventData.event}\`, { 
          subtask_id: subTask.id,
          task_id: task.id,
          status: updateData.status,
          contact_email: subTask.contact_email
        });
      }
      
      return res.status(200).json({ 
        success: true, 
        message: '事件已处理',
        subtask_id: subTask.id,
        task_id: task.id,
        event: eventData.event
      });
    } catch (error) {
      logger.error('❌ 处理Webhook事件失败', error);
      
      // 仍然返回200，避免极光API重试
      return res.status(200).json({ 
        success: false, 
        message: '处理事件时发生错误',
        error: error.message
      });
    }
  }
  
  /**
   * 更新任务统计信息 - 基于SubTask状态
   * @param {string} taskId - 任务ID
   * @private
   */
  async _updateTaskStats(taskId) {
    try {
      const task = await Task.findByPk(taskId);
      if (!task) return;
      
      // 🔧 修复：基于SubTask状态统计
      const counts = await SubTask.findAll({
        where: { task_id: taskId },
        attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
        group: ['status']
      });
      
      // 构建统计对象
      const stats = {
        total_subtasks: 0,
        pending: 0,
        allocated: 0,
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
        const countNum = parseInt(count, 10);
        stats.total_subtasks += countNum;
        
        switch (status) {
          case 'pending':
            stats.pending = countNum;
            break;
          case 'allocated':
            stats.allocated = countNum;
            break;
          case 'sent':
            stats.sent = countNum;
            break;
          case 'delivered':
            stats.delivered = countNum;
            break;
          case 'opened':
            stats.opened = countNum;
            break;
          case 'clicked':
            stats.clicked = countNum;
            break;
          case 'bounced':
            stats.bounced = countNum;
            break;
          case 'dropped':
            stats.dropped = countNum;
            break;
          case 'unsubscribed':
            stats.unsubscribed = countNum;
            break;
          case 'complained':
            stats.complained = countNum;
            break;
        }
      });
      
      // 计算相关比率
      if (stats.sent > 0) {
        stats.delivery_rate = parseFloat(((stats.delivered / stats.sent) * 100).toFixed(2));
      }
      
      if (stats.delivered > 0) {
        stats.open_rate = parseFloat(((stats.opened / stats.delivered) * 100).toFixed(2));
        stats.click_rate = parseFloat(((stats.clicked / stats.delivered) * 100).toFixed(2));
      }
      
      // 更新任务webhook统计信息
      await task.update({ webhook_stats: stats });
      
      logger.info(\`📊 已更新任务Webhook统计信息\`, { taskId, stats });
    } catch (error) {
      logger.error(\`❌ 更新任务统计信息失败: \${taskId}\`, error);
    }
  }
  
  /**
   * 测试Webhook
   */
  async testWebhook(req, res, next) {
    try {
      const testData = req.body || {};
      
      logger.info('🧪 收到Webhook测试请求', testData);
      
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
EOF"

# 3. 重启后端容器应用修复
echo "🔄 重启后端容器应用修复..."
$SSH_CMD "cd /opt/edm && sudo docker restart edm-backend"

# 4. 等待容器启动
echo "⏳ 等待后端容器启动..."
sleep 5

# 5. 测试webhook端点
echo "🧪 测试修复后的webhook端点..."
$SSH_CMD "cd /opt/edm && curl -X POST 'http://localhost:8080/webhook/engagelab' \
  -H 'Content-Type: application/json' \
  -d '{
    \"event\": \"delivered\",
    \"custom_args\": {
      \"subtask_id\": \"4646d0d0-b85f-4617-856e-17af54af9656\",
      \"task_id\": \"a1d9a977-356c-446a-a103-b091f64e6721\"
    },
    \"timestamp\": \"$(date +%s)\"
  }'"

echo ""
echo "✅ Webhook控制器修复完成！"
echo "🔧 主要修复："
echo "   - 验证逻辑：要求custom_args.subtask_id而不是message_id"
echo "   - 查找逻辑：通过subtask_id查找SubTask而不是TaskContact"
echo "   - 统计逻辑：基于SubTask状态统计"
echo ""
echo "📋 检查步骤："
echo "1. 查看后端日志：sudo docker logs edm-backend --tail 20"
echo "2. 测试webhook回调"
echo "3. 检查SubTask状态更新" 