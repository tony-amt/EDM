const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 8080;
const BACKEND_URL = process.env.BACKEND_URL || 'http://backend:3000';

// 中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'webhook-service',
    timestamp: new Date().toISOString()
  });
});

/**
 * EngageLab官方webhook接收入口
 * 接收webhook数据并转发到后端统一处理
 */
app.post('/webhook', async (req, res) => {
  try {
    const webhookData = req.body;

    console.log('🔔 收到EngageLab Webhook:', {
      event_type: webhookData.event_type || webhookData.event,
      message_id: webhookData.message_id,
      to: webhookData.to,
      timestamp: new Date().toISOString()
    });

    // 标准化webhook数据格式
    const standardizedData = {
      source: 'engagelab',
      event_type: webhookData.event_type || webhookData.event || 'unknown',
      message_id: webhookData.message_id,
      email_id: webhookData.email_id,
      to_email: webhookData.to,
      from_email: webhookData.from,
      sender_email: webhookData.sender,
      subject: webhookData.subject,
      event_timestamp: webhookData.timestamp ? new Date(webhookData.timestamp * 1000) : new Date(),
      provider_event_id: webhookData.event_id,
      bounce_reason: webhookData.reason,
      bounce_type: webhookData.bounce_type,
      body: webhookData.body || webhookData.text_body || webhookData.html_body,
      custom_args: webhookData.custom_args || {},
      raw_data: webhookData
    };

    // 特殊处理邮件回复事件
    if (standardizedData.event_type === 'reply' || standardizedData.event_type === 'inbound') {
      console.log('📧 检测到邮件回复事件，转发到邮件回复处理器');

      // 先转发到统一webhook处理
      const webhookResponse = await axios.post(`${BACKEND_URL}/api/webhook/process`, standardizedData, {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' }
      });

      // 再转发到邮件回复专用处理器
      const replyData = {
        to: standardizedData.sender_email,
        from: standardizedData.from_email,
        subject: standardizedData.subject,
        body: standardizedData.body,
        received_at: standardizedData.event_timestamp,
        headers: webhookData.headers || {},
        message_id: standardizedData.message_id
      };

      await axios.post(`${BACKEND_URL}/api/email-reply/process`, replyData, {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' }
      });

      console.log('✅ 邮件回复事件处理完成');

      return res.status(200).json({
        success: true,
        message: 'Email reply processed successfully'
      });
    }

    // 转发到后端处理
    const response = await axios.post(`${BACKEND_URL}/api/webhook/process`, standardizedData, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Webhook转发成功:', response.data);

    // 按EngageLab要求返回200状态码
    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully'
    });

  } catch (error) {
    console.error('❌ Webhook处理失败:', error.message);

    // 返回5XX状态码会触发EngageLab重试
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed',
      error: error.message
    });
  }
});

/**
 * EngageLab官方webhook路径 (与EngageLab配置保持一致)
 */
app.post('/webhook/engagelab', (req, res) => {
  // 重定向到统一webhook处理路径
  req.url = '/webhook';
  app._router.handle(req, res);
});

/**
 * 兼容旧版webhook路径
 */
app.post('/api/webhook/engagelab', (req, res) => {
  // 重定向到新的webhook处理路径
  req.url = '/webhook';
  app._router.handle(req, res);
});

/**
 * 错误处理中间件
 */
app.use((error, req, res, next) => {
  console.error('Webhook服务错误:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: error.message
  });
});

/**
 * 404处理
 */
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Webhook服务启动成功`);
  console.log(`📡 监听端口: ${PORT}`);
  console.log(`🔗 后端地址: ${BACKEND_URL}`);
  console.log(`📥 Webhook入口: http://localhost:${PORT}/webhook`);
}); 