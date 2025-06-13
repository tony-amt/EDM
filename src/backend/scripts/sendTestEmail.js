/**
 * 测试邮件发送脚本
 * 用法: node sendTestEmail.js <邮箱地址>
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
const recipient = process.argv[2];
if (!recipient) {
  console.error('错误: 请提供收件人邮箱地址');
  console.error('用法: node sendTestEmail.js <邮箱地址>');
  process.exit(1);
}

// 验证邮箱格式
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(recipient)) {
  console.error('错误: 无效的邮箱地址格式');
  process.exit(1);
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
 * 发送测试邮件
 */
async function sendTestEmail(to) {
  try {
    console.log(`正在向 ${to} 发送测试邮件...`);
    
    // 生成唯一消息ID
    const messageId = uuidv4();
    
    // 构建邮件内容
    const emailData = {
      from: 'A.MT邮件系统 <tony@glodamarket.fun>',
      to: [to],
      body: {
        subject: 'A.MT邮件系统测试邮件',
        content: {
          html: 'test',
          text: 'test'
        }
      }
    };
    
    // 输出请求报文
    console.log('=== 请求header ===');
    console.log(JSON.stringify(engagelabClient.defaults.headers, null, 2));
    console.log('=== 请求body ===');
    console.log(JSON.stringify(emailData, null, 2));
    
    // 发送邮件请求
    const response = await engagelabClient.post('/mail/send', emailData);
    
    console.log('发送成功!');
    console.log('响应数据:', JSON.stringify(response.data, null, 2));
    console.log(`消息ID: ${messageId}`);
    
    return {
      success: true,
      message_id: messageId,
      response: response.data
    };
  } catch (error) {
    console.error('发送邮件失败:', error.message);
    
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', JSON.stringify(error.response.data, null, 2));
    }
    
    return {
      success: false,
      error: error.message,
      details: error.response?.data
    };
  }
}

// 执行发送
sendTestEmail(recipient)
  .then(result => {
    if (result.success) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('执行过程中出错:', err);
    process.exit(1);
  }); 