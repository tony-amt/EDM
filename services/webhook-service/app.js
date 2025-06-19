const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8083;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'default-webhook-secret';
const BACKEND_URL = process.env.BACKEND_URL || 'http://backend:8080';

// 中间件
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.raw({ type: 'application/json' }));

/**
 * 验证EngageLab webhook签名
 */
function verifySignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * 记录webhook事件
 */
async function logWebhookEvent(eventType, data, status = 'success', error = null) {
  try {
    const logData = {
      event_type: eventType,
      webhook_data: data,
      status,
      error_message: error?.message,
      timestamp: new Date().toISOString()
    };
    
    console.log('📩 Webhook事件记录:', JSON.stringify(logData, null, 2));
    
    // 发送到主后端记录
    if (BACKEND_URL) {
      await axios.post(`${BACKEND_URL}/api/webhooks/log`, logData);
    }
  } catch (logError) {
    console.error('记录webhook事件失败:', logError.message);
  }
}

/**
 * 处理邮件状态更新
 */
async function handleEmailStatusUpdate(eventData) {
  try {
    const { message_id, status, timestamp, email, reason } = eventData;
    
    // 发送到主后端处理
    const response = await axios.post(`${BACKEND_URL}/api/tracking/email-status`, {
      message_id,
      status,
      timestamp,
      email,
      reason,
      source: 'engagelab'
    });
    
    console.log('✅ 邮件状态更新成功:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ 处理邮件状态更新失败:', error.message);
    throw error;
  }
}

/**
 * 处理邮件回复
 */
async function handleEmailReply(replyData) {
  try {
    const {
      from_email,
      from_name,
      to_email,
      to_name,
      subject,
      content_text,
      content_html,
      message_id,
      in_reply_to,
      references,
      received_at
    } = replyData;
    
    // 发送到主后端处理
    const response = await axios.post(`${BACKEND_URL}/api/conversations/inbound`, {
      from_email,
      from_name,
      to_email,
      to_name,
      subject,
      content_text,
      content_html,
      message_id,
      in_reply_to,
      references,
      received_at: received_at || new Date().toISOString(),
      source: 'engagelab'
    });
    
    console.log('✅ 邮件回复处理成功:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ 处理邮件回复失败:', error.message);
    throw error;
  }
}

/**
 * EngageLab webhook端点
 */
app.post('/webhook/engagelab', async (req, res) => {
  try {
    const signature = req.headers['x-engagelab-signature'];
    const payload = JSON.stringify(req.body);
    
    // 验证签名（可选，根据EngageLab配置）
    if (signature && WEBHOOK_SECRET !== 'default-webhook-secret') {
      if (!verifySignature(payload, signature, WEBHOOK_SECRET)) {
        console.error('❌ Webhook签名验证失败');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }
    
    const { event, data } = req.body;
    console.log(`📨 收到EngageLab webhook事件: ${event}`);
    
    let result = null;
    
    switch (event) {
      case 'email.delivered':
      case 'email.bounced':
      case 'email.opened':
      case 'email.clicked':
      case 'email.unsubscribed':
      case 'email.complained':
        result = await handleEmailStatusUpdate(data);
        break;
        
      case 'email.replied':
      case 'email.inbound':
        result = await handleEmailReply(data);
        break;
        
      default:
        console.log(`⚠️ 未处理的事件类型: ${event}`);
        break;
    }
    
    await logWebhookEvent(event, data, 'success');
    
    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      event,
      timestamp: new Date().toISOString(),
      result
    });
    
  } catch (error) {
    console.error('❌ Webhook处理失败:', error);
    
    await logWebhookEvent(req.body?.event || 'unknown', req.body, 'error', error);
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * 健康检查端点
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'webhook-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * 获取webhook配置信息
 */
app.get('/webhook/config', (req, res) => {
  res.json({
    endpoints: {
      engagelab: '/webhook/engagelab'
    },
    supported_events: [
      'email.delivered',
      'email.bounced', 
      'email.opened',
      'email.clicked',
      'email.unsubscribed',
      'email.complained',
      'email.replied',
      'email.inbound'
    ],
    production_url: 'https://tkmail.fun/webhook/engagelab',
    test_url: 'http://localhost:8083/webhook/engagelab'
  });
});

/**
 * 启动服务
 */
app.listen(PORT, () => {
  console.log(`🚀 EngageLab Webhook服务启动成功`);
  console.log(`📡 监听端口: ${PORT}`);
  console.log(`🔗 EngageLab webhook URL: http://localhost:${PORT}/webhook/engagelab`);
  console.log(`🔗 生产环境 webhook URL: https://tkmail.fun/webhook/engagelab`);
  console.log(`🔧 后端API地址: ${BACKEND_URL}`);
  console.log(`🔑 Webhook密钥: ${WEBHOOK_SECRET === 'default-webhook-secret' ? '使用默认密钥' : '已配置自定义密钥'}`);
});

module.exports = app; 