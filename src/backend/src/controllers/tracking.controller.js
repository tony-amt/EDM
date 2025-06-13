const TrackingService = require('../services/core/tracking.service');
const { AppError } = require('../utils/errorHandler');
const path = require('path');
const { SubTask, sequelize } = require('../models');
const logger = require('../utils/logger');

class TrackingController {
  /**
   * V2.0: 跟踪邮件打开事件 - 使用SubTask ID
   */
  async trackOpen(req, res, next) {
    try {
      const { subTaskId } = req.params; // V2.0: 改为subTaskId
      if (!subTaskId) {
        console.warn('V2.0 TrackOpen: subTaskId missing');
        return res.status(400).send('Missing tracking identifier.');
      }

      const ip_address = req.ip || req.socket.remoteAddress;
      const user_agent = req.headers['user-agent'] || '';

      // V2.0: 使用SubTask ID记录打开事件
      await TrackingService.recordOpenEvent(subTaskId, { ip_address, user_agent });

      // 返回1x1透明像素
      const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
      res.set('Content-Type', 'image/png');
      res.set('Content-Length', pixel.length);
      res.send(pixel);

    } catch (error) {
      console.error('Error in V2.0 trackOpen controller:', error);
      if (!res.headersSent) {
        res.status(500).send('Error processing request.');
      }
    }
  }

  /**
   * V2.0: 跟踪链接点击事件 - 使用SubTask ID
   */
  async trackClick(req, res, next) {
    try {
      const { subTaskId, linkIdentifier } = req.params; // V2.0: 改为subTaskId
      if (!subTaskId || !linkIdentifier) {
        return next(new AppError('Missing SubTask ID or link identifier.', 400));
      }

      const ip_address = req.ip || req.socket.remoteAddress;
      const user_agent = req.headers['user-agent'] || '';

      // V2.0: 使用SubTask ID记录点击事件
      const originalUrl = await TrackingService.recordClickEventAndGetUrl(
        subTaskId, 
        decodeURIComponent(linkIdentifier),
        { ip_address, user_agent }
      );

      // 重定向到原始URL
      res.redirect(302, originalUrl);

    } catch (error) {
      if (!(error instanceof AppError)) {
        console.error('Unexpected error in V2.0 trackClick controller:', error);
      }
      next(error);
    }
  }

  /**
   * V2.0: 获取Task统计分析数据
   */
  async getTaskAnalytics(req, res, next) {
    try {
      const { taskId } = req.params;
      if (!taskId) {
        return next(new AppError('Task ID is required', 400));
      }

      const analytics = await TrackingService.getTaskAnalytics(taskId);
      res.json({
        success: true,
        data: analytics
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * V2.0: 获取SubTask详细状态
   */
  async getSubTaskStatus(req, res, next) {
    try {
      const { subTaskId } = req.params;
      if (!subTaskId) {
        return next(new AppError('SubTask ID is required', 400));
      }

      const { SubTask } = require('../models');
      const subTask = await SubTask.findByPk(subTaskId);
      
      if (!subTask) {
        return next(new AppError('SubTask not found', 404));
      }

      res.json({
        success: true,
        data: {
          id: subTask.id,
          status: subTask.status,
          sent_at: subTask.sent_at,
          delivered_at: subTask.delivered_at,
          opened_at: subTask.opened_at,
          clicked_at: subTask.clicked_at,
          tracking_data: subTask.tracking_data
        }
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * 邮件打开追踪 - 透明像素图片
   * @route GET /api/tracking/open/:subTaskId
   */
  async trackEmailOpen(req, res) {
    try {
      const { subTaskId } = req.params;
      const userAgent = req.get('User-Agent') || '';
      const ip = req.ip || req.connection.remoteAddress;
      const timestamp = new Date();

      logger.info(`📧 邮件打开追踪: SubTask ${subTaskId}`, {
        subTaskId,
        ip,
        userAgent,
        timestamp: timestamp.toISOString()
      });

      // 更新SubTask的打开状态
      const [updatedRows] = await SubTask.update({
        opened_at: timestamp,
        open_count: sequelize.literal('COALESCE(open_count, 0) + 1'),
        tracking_data: sequelize.literal(`
          COALESCE(tracking_data, '{}')::jsonb || 
          jsonb_build_object(
            'opens', 
            COALESCE((tracking_data->>'opens')::int, 0) + 1,
            'last_open_at', '${timestamp.toISOString()}',
            'open_ips', 
            COALESCE(tracking_data->'open_ips', '[]'::jsonb) || 
            jsonb_build_array('${ip}'),
            'open_user_agents',
            COALESCE(tracking_data->'open_user_agents', '[]'::jsonb) || 
            jsonb_build_array('${userAgent}')
          )
        `)
      }, {
        where: { id: subTaskId }
      });

      if (updatedRows > 0) {
        logger.info(`✅ 邮件打开追踪记录成功: SubTask ${subTaskId}`);
      }

      // 返回1x1透明PNG图片
      const transparentPixel = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'base64'
      );

      res.set({
        'Content-Type': 'image/png',
        'Content-Length': transparentPixel.length,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      res.send(transparentPixel);

    } catch (error) {
      logger.error(`❌ 邮件打开追踪失败: ${error.message}`, {
        subTaskId: req.params.subTaskId,
        error: error.message,
        stack: error.stack
      });

      // 即使出错也要返回透明图片，避免邮件显示异常
      const transparentPixel = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'base64'
      );

      res.set({
        'Content-Type': 'image/png',
        'Content-Length': transparentPixel.length
      });

      res.send(transparentPixel);
    }
  }

  /**
   * 邮件点击追踪 - 链接重定向
   * @route GET /api/tracking/click/:subTaskId
   */
  async trackEmailClick(req, res) {
    try {
      const { subTaskId } = req.params;
      const { url } = req.query; // 原始URL
      const userAgent = req.get('User-Agent') || '';
      const ip = req.ip || req.connection.remoteAddress;
      const timestamp = new Date();

      logger.info(`🔗 邮件点击追踪: SubTask ${subTaskId}`, {
        subTaskId,
        url,
        ip,
        userAgent,
        timestamp: timestamp.toISOString()
      });

      // 更新SubTask的点击状态
      const [updatedRows] = await SubTask.update({
        clicked_at: timestamp,
        click_count: sequelize.literal('COALESCE(click_count, 0) + 1'),
        tracking_data: sequelize.literal(`
          COALESCE(tracking_data, '{}')::jsonb || 
          jsonb_build_object(
            'clicks', 
            COALESCE((tracking_data->>'clicks')::int, 0) + 1,
            'last_click_at', '${timestamp.toISOString()}',
            'clicked_urls',
            COALESCE(tracking_data->'clicked_urls', '[]'::jsonb) || 
            jsonb_build_array('${url || ''}'),
            'click_ips', 
            COALESCE(tracking_data->'click_ips', '[]'::jsonb) || 
            jsonb_build_array('${ip}'),
            'click_user_agents',
            COALESCE(tracking_data->'click_user_agents', '[]'::jsonb) || 
            jsonb_build_array('${userAgent}')
          )
        `)
      }, {
        where: { id: subTaskId }
      });

      if (updatedRows > 0) {
        logger.info(`✅ 邮件点击追踪记录成功: SubTask ${subTaskId}`);
      }

      // 重定向到原始URL
      if (url) {
        res.redirect(302, url);
      } else {
        res.status(400).json({
          success: false,
          message: '缺少重定向URL参数'
        });
      }

    } catch (error) {
      logger.error(`❌ 邮件点击追踪失败: ${error.message}`, {
        subTaskId: req.params.subTaskId,
        url: req.query.url,
        error: error.message,
        stack: error.stack
      });

      // 出错时仍然重定向，避免用户体验受影响
      if (req.query.url) {
        res.redirect(302, req.query.url);
      } else {
        res.status(500).json({
          success: false,
          message: '追踪失败，但会继续重定向'
        });
      }
    }
  }

  /**
   * EngageLab Webhook处理
   * @route POST /api/tracking/webhook/engagelab
   */
  async handleEngagelabWebhook(req, res) {
    try {
      const webhookData = req.body;
      const timestamp = new Date();

      logger.info(`🔔 收到EngageLab Webhook`, {
        webhookData,
        timestamp: timestamp.toISOString()
      });

      // 处理不同类型的事件
      const { event_type, custom_args, email_id, timestamp: eventTimestamp } = webhookData;
      
      if (!custom_args || !custom_args.subtask_id) {
        logger.warn(`⚠️ Webhook缺少subtask_id`, { webhookData });
        return res.status(200).json({ success: true, message: 'Webhook received but no subtask_id' });
      }

      const subTaskId = custom_args.subtask_id;
      const eventTime = eventTimestamp ? new Date(eventTimestamp * 1000) : timestamp;

      let updateData = {};
      let logMessage = '';

      switch (event_type) {
        case 'delivered':
          updateData = {
            delivered_at: eventTime,
            tracking_data: sequelize.literal(`
              COALESCE(tracking_data, '{}')::jsonb || 
              jsonb_build_object(
                'delivered_at', '${eventTime.toISOString()}',
                'email_id', '${email_id || ''}',
                'webhook_delivered', true
              )
            `)
          };
          logMessage = `📬 邮件送达确认: SubTask ${subTaskId}`;
          break;

        case 'opened':
          updateData = {
            opened_at: eventTime,
            open_count: sequelize.literal('COALESCE(open_count, 0) + 1'),
            tracking_data: sequelize.literal(`
              COALESCE(tracking_data, '{}')::jsonb || 
              jsonb_build_object(
                'webhook_opens', 
                COALESCE((tracking_data->>'webhook_opens')::int, 0) + 1,
                'last_webhook_open_at', '${eventTime.toISOString()}',
                'email_id', '${email_id || ''}'
              )
            `)
          };
          logMessage = `📧 Webhook邮件打开: SubTask ${subTaskId}`;
          break;

        case 'clicked':
          updateData = {
            clicked_at: eventTime,
            click_count: sequelize.literal('COALESCE(click_count, 0) + 1'),
            tracking_data: sequelize.literal(`
              COALESCE(tracking_data, '{}')::jsonb || 
              jsonb_build_object(
                'webhook_clicks', 
                COALESCE((tracking_data->>'webhook_clicks')::int, 0) + 1,
                'last_webhook_click_at', '${eventTime.toISOString()}',
                'email_id', '${email_id || ''}'
              )
            `)
          };
          logMessage = `🔗 Webhook邮件点击: SubTask ${subTaskId}`;
          break;

        case 'bounced':
          updateData = {
            bounced_at: eventTime,
            status: 'failed',
            error_message: `邮件退回: ${webhookData.reason || '未知原因'}`,
            tracking_data: sequelize.literal(`
              COALESCE(tracking_data, '{}')::jsonb || 
              jsonb_build_object(
                'bounced_at', '${eventTime.toISOString()}',
                'bounce_reason', '${webhookData.reason || ''}',
                'email_id', '${email_id || ''}'
              )
            `)
          };
          logMessage = `📤 邮件退回: SubTask ${subTaskId}, 原因: ${webhookData.reason || '未知'}`;
          break;

        default:
          logger.info(`ℹ️ 未处理的Webhook事件类型: ${event_type}`, { webhookData });
          return res.status(200).json({ success: true, message: `Event type ${event_type} noted` });
      }

      // 更新SubTask
      const [updatedRows] = await SubTask.update(updateData, {
        where: { id: subTaskId }
      });

      if (updatedRows > 0) {
        logger.info(`✅ ${logMessage}`);
      } else {
        logger.warn(`⚠️ SubTask ${subTaskId} 未找到或未更新`);
      }

      res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
        event_type,
        subtask_id: subTaskId
      });

    } catch (error) {
      logger.error(`❌ 处理EngageLab Webhook失败: ${error.message}`, {
        webhookData: req.body,
        error: error.message,
        stack: error.stack
      });

      // Webhook处理失败也要返回200，避免重复发送
      res.status(200).json({
        success: false,
        message: 'Webhook processing failed but acknowledged',
        error: error.message
      });
    }
  }
}

module.exports = new TrackingController(); 