/**
 * 批量测试邮件发送脚本
 * 用法: node sendMultipleTestEmails.js <邮箱地址1> <邮箱地址2> ...
 */
const dotenv = require('dotenv');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const logger = require('../src/utils/logger');

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') });

// 极光API配置
const ENGAGELAB_BASE_URL = process.env.ENGAGELAB_BASE_URL || 'https://email.api.engagelab.cc/v1';
const ENGAGELAB_API_USER = process.env.ENGAGELAB_API_USER;
const ENGAGELAB_API_KEY = process.env.ENGAGELAB_API_KEY;

// 验证配置
if (!ENGAGELAB_API_USER || !ENGAGELAB_API_KEY) {
  console.error('错误: 请在.env文件中配置极光API凭证');
  console.error('需要设置 ENGAGELAB_API_USER 和 ENGAGELAB_API_KEY');
  process.exit(1);
}

// 获取收件人邮箱地址
const recipients = process.argv.slice(2);
if (recipients.length === 0) {
  console.error('错误: 请提供至少一个收件人邮箱地址');
  console.error('用法: node sendMultipleTestEmails.js <邮箱地址1> <邮箱地址2> ...');
  process.exit(1);
}

// 验证邮箱格式
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validRecipients = recipients.filter(email => emailRegex.test(email));

if (validRecipients.length === 0) {
  console.error('错误: 所有提供的邮箱地址格式都无效');
  process.exit(1);
}

if (validRecipients.length < recipients.length) {
  console.warn(`警告: 部分邮箱地址格式无效，将仅发送到有效地址`);
  console.warn(`有效地址: ${validRecipients.join(', ')}`);
}

// 创建极光API客户端
const engagelabClient = axios.create({
  baseURL: ENGAGELAB_BASE_URL,
  auth: {
    username: ENGAGELAB_API_USER,
    password: ENGAGELAB_API_KEY
  },
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * 发送测试邮件到单个收件人
 */
async function sendTestEmail(to) {
  try {
    console.log(`正在向 ${to} 发送测试邮件...`);
    
    // 生成唯一消息ID
    const messageId = uuidv4();
    
    // 构建邮件内容
    const emailData = {
      from: {
        email: process.env.EMAIL_FROM || 'noreply@example.com',
        name: process.env.EMAIL_FROM_NAME || 'A.MT邮件系统'
      },
      to: [{ email: to }],
      subject: 'A.MT邮件系统测试邮件',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
          <h2 style="color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px;">A.MT邮件系统测试</h2>
          <p>您好！</p>
          <p>这是一封来自A.MT邮件系统的测试邮件，用于验证系统发送功能是否正常。</p>
          <p>测试信息:</p>
          <ul>
            <li>收件人: ${to}</li>
            <li>消息ID: ${messageId}</li>
            <li>发送时间: ${new Date().toLocaleString()}</li>
            <li>系统环境: ${process.env.NODE_ENV || 'development'}</li>
          </ul>
          <p>如果您收到此邮件，说明系统配置正确，可以正常发送邮件。</p>
          <div style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #eee; color: #777; font-size: 12px;">
            <p>此邮件由系统自动发送，请勿回复。</p>
          </div>
        </div>
      `,
      tracking: {
        open: true,
        click: true
      },
      custom_id: messageId
    };
    
    // 发送邮件请求
    const response = await engagelabClient.post('/mail/send', emailData);
    
    console.log(`发送到 ${to} 成功!`);
    console.log(`消息ID: ${messageId}`);
    
    return {
      email: to,
      success: true,
      message_id: messageId,
      response: response.data
    };
  } catch (error) {
    console.error(`发送到 ${to} 失败:`, error.message);
    
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', JSON.stringify(error.response.data, null, 2));
    }
    
    return {
      email: to,
      success: false,
      error: error.message,
      details: error.response?.data
    };
  }
}

/**
 * 批量发送测试邮件
 */
async function sendMultipleTestEmails(emailAddresses) {
  console.log(`准备向 ${emailAddresses.length} 个收件人发送测试邮件...`);
  
  const results = [];
  
  // 限制并发，避免API限流
  for (const email of emailAddresses) {
    const result = await sendTestEmail(email);
    results.push(result);
    
    // 间隔发送，避免API限流
    if (emailAddresses.indexOf(email) < emailAddresses.length - 1) {
      console.log('等待1秒...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // 汇总结果
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log('\n===== 发送结果汇总 =====');
  console.log(`总共: ${results.length}`);
  console.log(`成功: ${successful}`);
  console.log(`失败: ${failed}`);
  
  // 详细结果
  console.log('\n详细结果:');
  results.forEach(r => {
    if (r.success) {
      console.log(`- ${r.email}: 成功 (消息ID: ${r.message_id})`);
    } else {
      console.log(`- ${r.email}: 失败 (${r.error})`);
    }
  });
  
  return {
    total: results.length,
    successful,
    failed,
    details: results
  };
}

// 执行发送
sendMultipleTestEmails(validRecipients)
  .then(results => {
    if (results.failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  })
  .catch(err => {
    console.error('执行过程中出错:', err);
    process.exit(1);
  }); 