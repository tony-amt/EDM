const axios = require('axios');
const WebSocket = require('ws');
const FormData = require('form-data');
const fs = require('fs');

// 配置
const BASE_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';
const TOKEN = 'dev-permanent-test-token-admin-2025';

// 测试数据
const testData = {
  email_service_id: null,
  conversation_id: null,
  message_id: null
};

// API 客户端
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// 日志函数
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// 错误处理
function handleError(error, context) {
  console.error(`❌ ${context}:`, error.response?.data || error.message);
  throw error;
}

// 测试邮件服务列表
async function testEmailServices() {
  log('🔍 测试邮件服务列表...');
  try {
    const response = await api.get('/api/email-services');
    const services = response.data.data || [];
    
    if (services.length === 0) {
      log('⚠️  没有找到邮件服务，创建一个测试服务...');
      
      const createResponse = await api.post('/api/email-services', {
        name: '测试邮件服务',
        provider: 'smtp',
        api_key: 'test_api_key',
        api_secret: 'test_api_secret',
        domain: 'example.com',
        config: {
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: {
            user: 'test@example.com',
            pass: 'test123456'
          }
        }
      });
      
      testData.email_service_id = createResponse.data.data.id;
      log(`✅ 创建测试邮件服务: ${testData.email_service_id}`);
    } else {
      testData.email_service_id = services[0].id;
      log(`✅ 使用现有邮件服务: ${testData.email_service_id}`);
    }
  } catch (error) {
    handleError(error, '测试邮件服务列表');
  }
}

// 测试创建会话
async function testCreateConversation() {
  log('📝 测试创建会话...');
  try {
    const response = await api.post('/api/conversations', {
      subject: '测试会话 - 邮件回复和交互功能',
      participants: ['test@example.com', 'user@example.com'],
      email_service_id: testData.email_service_id,
      initial_message: {
        to_email: 'test@example.com',
        body: '这是一条测试消息，用于测试邮件回复和会话交互功能。',
        html_body: '<p>这是一条<strong>测试消息</strong>，用于测试邮件回复和会话交互功能。</p>'
      }
    });
    
    testData.conversation_id = response.data.data.id;
    log(`✅ 创建会话成功: ${testData.conversation_id}`);
  } catch (error) {
    handleError(error, '测试创建会话');
  }
}

// 测试发送消息
async function testSendMessage() {
  log('💬 测试发送消息...');
  try {
    const response = await api.post(`/api/conversations/${testData.conversation_id}/messages`, {
      to_email: 'user@example.com',
      subject: 'Re: 测试会话 - 邮件回复和交互功能',
      body: '这是一条回复消息，测试邮件回复功能。',
      html_body: '<p>这是一条<em>回复消息</em>，测试邮件回复功能。</p>'
    });
    
    testData.message_id = response.data.data.id;
    log(`✅ 发送消息成功: ${testData.message_id}`);
  } catch (error) {
    handleError(error, '测试发送消息');
  }
}

// 测试获取会话列表
async function testGetConversations() {
  log('📋 测试获取会话列表...');
  try {
    const response = await api.get('/api/conversations?limit=10');
    const conversations = response.data.data || [];
    
    log(`✅ 获取到 ${conversations.length} 个会话`);
    
    // 测试筛选功能
    const filteredResponse = await api.get('/api/conversations?status=active&limit=5');
    const activeConversations = filteredResponse.data.data || [];
    log(`✅ 获取到 ${activeConversations.length} 个活动会话`);
  } catch (error) {
    handleError(error, '测试获取会话列表');
  }
}

// 测试获取会话详情
async function testGetConversationDetail() {
  log('🔍 测试获取会话详情...');
  try {
    const response = await api.get(`/api/conversations/${testData.conversation_id}`);
    const conversation = response.data.data;
    
    log(`✅ 获取会话详情: ${conversation.subject}`);
    log(`   - 参与者: ${conversation.participants?.join(', ')}`);
    log(`   - 消息数量: ${conversation.message_count}`);
    log(`   - 状态: ${conversation.status}`);
  } catch (error) {
    handleError(error, '测试获取会话详情');
  }
}

// 测试获取消息列表
async function testGetMessages() {
  log('📨 测试获取消息列表...');
  try {
    const response = await api.get(`/conversations/${testData.conversation_id}/messages`);
    const messages = response.data.data || [];
    
    log(`✅ 获取到 ${messages.length} 条消息`);
    
    messages.forEach((msg, index) => {
      log(`   ${index + 1}. [${msg.direction}] ${msg.from_email} -> ${msg.to_email}`);
      log(`      主题: ${msg.subject}`);
      log(`      内容: ${msg.body.substring(0, 50)}...`);
    });
  } catch (error) {
    handleError(error, '测试获取消息列表');
  }
}

// 测试标记消息已读
async function testMarkMessageRead() {
  log('👀 测试标记消息已读...');
  try {
    const response = await api.put(`/api/conversations/${testData.conversation_id}/messages/${testData.message_id}/read`);
    log(`✅ 标记消息已读成功`);
  } catch (error) {
    handleError(error, '测试标记消息已读');
  }
}

// 测试搜索功能
async function testSearchConversations() {
  log('🔍 测试搜索会话...');
  try {
    const response = await api.get('/api/conversations/search?query=测试&search_in=both');
    const results = response.data.data || [];
    
    log(`✅ 搜索到 ${results.length} 个结果`);
    
    if (results.conversations && results.conversations.length > 0) {
      log(`   - 会话: ${results.conversations.length} 个`);
    }
    
    if (results.messages && results.messages.length > 0) {
      log(`   - 消息: ${results.messages.length} 条`);
    }
  } catch (error) {
    handleError(error, '测试搜索会话');
  }
}

// 测试WebSocket连接
async function testWebSocketConnection() {
  log('🔌 测试WebSocket连接...');
  
  return new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(`${WS_URL}/ws?token=${TOKEN}`);
      
      ws.on('open', () => {
        log('✅ WebSocket连接成功');
        
        // 订阅会话更新
        ws.send(JSON.stringify({
          type: 'subscribe_conversation',
          conversation_id: testData.conversation_id
        }));
        
        log('✅ 订阅会话更新成功');
        
        // 发送心跳
        ws.send(JSON.stringify({
          type: 'heartbeat',
          timestamp: new Date().toISOString()
        }));
        
        log('✅ 发送心跳成功');
        
        setTimeout(() => {
          ws.close();
          resolve();
        }, 2000);
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        log(`📨 收到WebSocket消息: ${message.type}`);
        
        if (message.type === 'new_message') {
          log(`   新消息: ${message.data.subject}`);
        } else if (message.type === 'notification') {
          log(`   通知: ${message.data.title} - ${message.data.message}`);
        }
      });
      
      ws.on('error', (error) => {
        log(`❌ WebSocket错误: ${error.message}`);
        reject(error);
      });
      
      ws.on('close', () => {
        log('✅ WebSocket连接关闭');
      });
      
    } catch (error) {
      handleError(error, '测试WebSocket连接');
      reject(error);
    }
  });
}

// 测试会话统计
async function testConversationStats() {
  log('📊 测试会话统计...');
  try {
    const response = await api.get('/conversations/stats');
    const stats = response.data.data;
    
    log(`✅ 会话统计:`);
    log(`   - 总数: ${stats.total}`);
    log(`   - 活动: ${stats.active}`);
    log(`   - 已归档: ${stats.archived}`);
    log(`   - 垃圾邮件: ${stats.spam}`);
    log(`   - 未读: ${stats.unread}`);
  } catch (error) {
    handleError(error, '测试会话统计');
  }
}

// 测试更新会话状态
async function testUpdateConversationStatus() {
  log('🔄 测试更新会话状态...');
  try {
    // 先归档
    await api.put(`/api/conversations/${testData.conversation_id}/status`, {
      status: 'archived'
    });
    log('✅ 会话已归档');
    
    // 再恢复
    await api.put(`/api/conversations/${testData.conversation_id}/status`, {
      status: 'active'
    });
    log('✅ 会话已恢复');
  } catch (error) {
    handleError(error, '测试更新会话状态');
  }
}

// 主测试函数
async function runTests() {
  log('🚀 开始测试邮件回复和会话交互功能...');
  
  try {
    await testEmailServices();
    await testCreateConversation();
    await testSendMessage();
    await testGetConversations();
    await testGetConversationDetail();
    await testGetMessages();
    await testMarkMessageRead();
    await testSearchConversations();
    await testConversationStats();
    await testUpdateConversationStatus();
    await testWebSocketConnection();
    
    log('🎉 所有测试完成！');
    log('📋 测试总结:');
    log(`   - 邮件服务ID: ${testData.email_service_id}`);
    log(`   - 会话ID: ${testData.conversation_id}`);
    log(`   - 消息ID: ${testData.message_id}`);
    
  } catch (error) {
    log('❌ 测试失败');
    process.exit(1);
  }
}

// 运行测试
runTests(); 