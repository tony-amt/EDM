#!/usr/bin/env node

/**
 * EngageLab Webhook 本地测试脚本
 * 用于模拟 EngageLab 平台向我们的系统发送各种事件回调
 */

const axios = require('axios');
const crypto = require('crypto');

// 配置
const WEBHOOK_URL = 'http://localhost:3000/api/tracking/webhook/engagelab';
const APP_KEY = 'test-app-key-123'; // 测试用的APP KEY
const WEBHOOK_SECRET = 'test-webhook-secret'; // 测试用的签名密钥

/**
 * 生成EngageLab签名
 */
function generateSignature(timestamp, appKey, secret) {
  const signatureString = timestamp + appKey + secret;
  return crypto.createHash('md5').update(signatureString).digest('hex');
}

/**
 * 发送webhook请求
 */
async function sendWebhookRequest(eventData) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = generateSignature(timestamp, APP_KEY, WEBHOOK_SECRET);
  
  const headers = {
    'Content-Type': 'application/json',
    'X-WebHook-Timestamp': timestamp,
    'X-WebHook-AppKey': APP_KEY,
    'X-WebHook-Signature': signature
  };

  try {
    console.log(`\n🔥 发送事件: ${eventData.event_type}`);
    console.log('📦 事件数据:', JSON.stringify(eventData, null, 2));
    console.log('🔐 请求头:', headers);
    
    const response = await axios.post(WEBHOOK_URL, eventData, { headers });
    
    console.log('✅ 响应状态:', response.status);
    console.log('📝 响应数据:', response.data);
    
    return response.data;
  } catch (error) {
    console.error('❌ 请求失败:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 测试用例 1: 邮件送达事件
 */
async function testEmailDelivered() {
  const eventData = {
    event_type: 'delivered',
    email_id: 'test_email_123456789',
    timestamp: Math.floor(Date.now() / 1000),
    custom_args: {
      subtask_id: 'subtask_001',
      task_id: 'task_001',
      user_id: 'user_001'
    },
    recipient: 'test@example.com',
    subject: '测试邮件送达事件'
  };
  
  await sendWebhookRequest(eventData);
}

/**
 * 测试用例 2: 邮件打开事件
 */
async function testEmailOpened() {
  const eventData = {
    event_type: 'opened',
    email_id: 'test_email_123456789',
    timestamp: Math.floor(Date.now() / 1000),
    custom_args: {
      subtask_id: 'subtask_001',
      task_id: 'task_001',
      user_id: 'user_001'
    },
    recipient: 'test@example.com',
    subject: '测试邮件打开事件'
  };
  
  await sendWebhookRequest(eventData);
}

/**
 * 测试用例 3: 邮件回复事件 (重点测试)
 */
async function testEmailReply() {
  const eventData = {
    event_type: 'reply',
    email_id: 'test_email_123456789',
    timestamp: Math.floor(Date.now() / 1000),
    from_email: 'customer@example.com',
    from_name: '客户张三',
    to_email: 'service@yourdomain.com',
    to_name: '客服团队',
    subject: 'Re: 关于产品咨询',
    content_text: '您好，我想了解更多关于这个产品的信息。谢谢！',
    content_html: '<p>您好，我想了解更多关于这个产品的信息。谢谢！</p>',
    message_id: 'reply_msg_' + Date.now(),
    in_reply_to: 'original_msg_123456',
    references: 'original_msg_123456',
    custom_args: {
      subtask_id: 'subtask_001',
      task_id: 'task_001',
      campaign_id: 'campaign_001'
    }
  };
  
  await sendWebhookRequest(eventData);
}

/**
 * 测试用例 4: 入站邮件事件
 */
async function testInboundEmail() {
  const eventData = {
    event_type: 'inbound',
    email_id: 'inbound_email_' + Date.now(),
    timestamp: Math.floor(Date.now() / 1000),
    from_email: 'newcustomer@example.com',
    from_name: '新客户李四',
    to_email: 'support@yourdomain.com',
    to_name: '技术支持',
    subject: '新用户咨询',
    content_text: '您好，我是新用户，想咨询一下如何使用你们的产品。',
    content_html: '<p>您好，我是新用户，想咨询一下如何使用你们的产品。</p>',
    message_id: 'inbound_msg_' + Date.now(),
    custom_args: {
      source: 'direct_email',
      priority: 'high'
    }
  };
  
  await sendWebhookRequest(eventData);
}

/**
 * 测试用例 5: 邮件退回事件
 */
async function testEmailBounced() {
  const eventData = {
    event_type: 'bounced',
    email_id: 'test_email_123456789',
    timestamp: Math.floor(Date.now() / 1000),
    custom_args: {
      subtask_id: 'subtask_002',
      task_id: 'task_001',
      user_id: 'user_002'
    },
    recipient: 'invalid@example.com',
    reason: 'User unknown',
    bounce_type: 'hard',
    subject: '测试邮件退回事件'
  };
  
  await sendWebhookRequest(eventData);
}

/**
 * 批量测试所有事件类型
 */
async function runAllTests() {
  console.log('🚀 开始 EngageLab Webhook 本地测试');
  console.log('🎯 目标URL:', WEBHOOK_URL);
  console.log('=' * 50);
  
  const tests = [
    { name: '邮件送达事件', fn: testEmailDelivered },
    { name: '邮件打开事件', fn: testEmailOpened },
    { name: '邮件回复事件', fn: testEmailReply },
    { name: '入站邮件事件', fn: testInboundEmail },
    { name: '邮件退回事件', fn: testEmailBounced }
  ];
  
  for (const test of tests) {
    try {
      console.log(`\n🧪 测试: ${test.name}`);
      await test.fn();
      console.log(`✅ ${test.name} - 通过`);
      
      // 间隔一秒避免请求过快
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`❌ ${test.name} - 失败:`, error.message);
    }
  }
  
  console.log('\n🎉 所有测试完成！');
}

/**
 * 单独测试特定事件类型
 */
async function runSingleTest(eventType) {
  const testMap = {
    'delivered': testEmailDelivered,
    'opened': testEmailOpened,
    'reply': testEmailReply,
    'inbound': testInboundEmail,
    'bounced': testEmailBounced
  };
  
  const testFn = testMap[eventType];
  if (!testFn) {
    console.error(`❌ 未知的事件类型: ${eventType}`);
    console.log('支持的事件类型:', Object.keys(testMap).join(', '));
    return;
  }
  
  console.log(`🧪 单独测试: ${eventType}`);
  try {
    await testFn();
    console.log(`✅ ${eventType} 测试通过`);
  } catch (error) {
    console.error(`❌ ${eventType} 测试失败:`, error.message);
  }
}

// 命令行参数处理
const args = process.argv.slice(2);
if (args.length === 0) {
  // 运行所有测试
  runAllTests();
} else {
  // 运行指定的测试
  const eventType = args[0];
  runSingleTest(eventType);
}

// 导出测试函数供其他脚本使用
module.exports = {
  sendWebhookRequest,
  testEmailDelivered,
  testEmailOpened,
  testEmailReply,
  testInboundEmail,
  testEmailBounced,
  runAllTests,
  runSingleTest
}; 