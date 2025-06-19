#!/usr/bin/env node

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// 测试配置
const TEST_CONFIG = {
  BASE_URL: process.env.TEST_BASE_URL || 'http://localhost',
  BACKEND_PORT: process.env.BACKEND_PORT || '8080',
  WEBHOOK_PORT: process.env.WEBHOOK_PORT || '8083',
  TRACKING_PORT: process.env.TRACKING_PORT || '8081',
  IMAGE_PORT: process.env.IMAGE_PORT || '8082',
  
  // 测试用户信息
  TEST_USER: {
    usernameOrEmail: 'admin',
    password: 'admin123456'
  },
  
  // 测试邮箱
  TEST_EMAIL: process.env.TEST_EMAIL || 'test@glodamarket.fun'
};

// 创建API客户端
const createApiClient = (port) => {
  return axios.create({
    baseURL: `${TEST_CONFIG.BASE_URL}:${port}`,
    timeout: 30000,
    validateStatus: () => true // 不抛出HTTP错误
  });
};

const backendApi = createApiClient(TEST_CONFIG.BACKEND_PORT);
const webhookApi = createApiClient(TEST_CONFIG.WEBHOOK_PORT);
const trackingApi = createApiClient(TEST_CONFIG.TRACKING_PORT);
const imageApi = createApiClient(TEST_CONFIG.IMAGE_PORT);

let authToken = null;
let testResults = [];

/**
 * 记录测试结果
 */
function logTest(testName, success, details = '') {
  const result = {
    test: testName,
    success,
    details,
    timestamp: new Date().toISOString()
  };
  
  testResults.push(result);
  
  const status = success ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} ${testName}`);
  if (details) {
    console.log(`   ${details}`);
  }
}

/**
 * 测试1: 后端健康检查
 */
async function testBackendHealth() {
  try {
    const response = await backendApi.get('/health');
    const success = response.status === 200 && response.data.status === 'ok';
    logTest('后端服务健康检查', success, 
      success ? `服务正常，数据库状态: ${response.data.database}` : `状态码: ${response.status}`);
    return success;
  } catch (error) {
    logTest('后端服务健康检查', false, `连接失败: ${error.message}`);
    return false;
  }
}

/**
 * 测试2: 用户登录认证
 */
async function testUserAuth() {
  try {
    const response = await backendApi.post('/api/auth/login', TEST_CONFIG.TEST_USER);
    const success = response.status === 200 && response.data.token;
    
    if (success) {
      authToken = response.data.token;
      // 设置后续请求的认证头
      backendApi.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
      logTest('用户登录认证', true, `Token获取成功，用户: ${response.data.data.email}`);
    } else {
      logTest('用户登录认证', false, `登录失败: ${response.data.error || '未知错误'}`);
    }
    
    return success;
  } catch (error) {
    logTest('用户登录认证', false, `请求失败: ${error.message}`);
    return false;
  }
}

/**
 * 测试3: 会话管理功能
 */
async function testConversationManagement() {
  try {
    // 测试获取会话列表
    const listResponse = await backendApi.get('/api/conversations');
    if (listResponse.status !== 200) {
      logTest('会话管理-列表获取', false, `状态码: ${listResponse.status}`);
      return false;
    }

    // 测试创建新会话
    const createData = {
      subject: 'Integration Test Conversation',
      participants: [TEST_CONFIG.TEST_EMAIL, 'recipient@example.com'],
      email_service_id: 1,
      initial_message: {
        body: 'This is a test conversation',
        to_email: 'recipient@example.com'
      }
    };

    const createResponse = await backendApi.post('/api/conversations', createData);
    const createSuccess = createResponse.status === 201;
    
    let conversationId = null;
    if (createSuccess) {
      conversationId = createResponse.data.data.id;
    }

    logTest('会话管理-创建会话', createSuccess, 
      createSuccess ? `会话ID: ${conversationId}` : `错误: ${createResponse.data.error || '未知错误'}`);

    // 如果创建成功，测试获取会话详情
    if (createSuccess && conversationId) {
      const detailResponse = await backendApi.get(`/api/conversations/${conversationId}`);
      const detailSuccess = detailResponse.status === 200;
      logTest('会话管理-获取详情', detailSuccess, 
        detailSuccess ? `消息数量: ${detailResponse.data.data.messages?.length || 0}` : `状态码: ${detailResponse.status}`);
      
      return detailSuccess;
    }
    
    return createSuccess;
  } catch (error) {
    logTest('会话管理功能', false, `请求异常: ${error.message}`);
    return false;
  }
}

/**
 * 测试4: Webhook服务
 */
async function testWebhookService() {
  try {
    // 测试健康检查
    const healthResponse = await webhookApi.get('/health');
    if (healthResponse.status !== 200) {
      logTest('Webhook服务-健康检查', false, `状态码: ${healthResponse.status}`);
      return false;
    }

    // 测试webhook配置获取
    const configResponse = await webhookApi.get('/webhook/config');
    const configSuccess = configResponse.status === 200 && configResponse.data.endpoints;
    logTest('Webhook服务-配置获取', configSuccess, 
      configSuccess ? `支持事件: ${configResponse.data.supported_events.length}个` : `状态码: ${configResponse.status}`);

    // 测试EngageLab webhook端点
    const testWebhookData = {
      event: 'email.delivered',
      data: {
        message_id: `test_${Date.now()}`,
        email: TEST_CONFIG.TEST_EMAIL,
        status: 'delivered',
        timestamp: new Date().toISOString()
      }
    };

    const webhookResponse = await webhookApi.post('/webhook/engagelab', testWebhookData);
    const webhookSuccess = webhookResponse.status === 200;
    logTest('Webhook服务-EngageLab端点', webhookSuccess, 
      webhookSuccess ? '模拟webhook处理成功' : `状态码: ${webhookResponse.status}`);

    return configSuccess && webhookSuccess;
  } catch (error) {
    logTest('Webhook服务', false, `连接失败: ${error.message}`);
    return false;
  }
}

/**
 * 测试5: 追踪服务
 */
async function testTrackingService() {
  try {
    // 测试健康检查
    const healthResponse = await trackingApi.get('/health');
    if (healthResponse.status !== 200) {
      logTest('追踪服务-健康检查', false, `状态码: ${healthResponse.status}`);
      return false;
    }

    const testMessageId = `test_msg_${Date.now()}`;

    // 测试邮件状态更新
    const statusData = {
      message_id: testMessageId,
      email: TEST_CONFIG.TEST_EMAIL,
      status: 'delivered',
      timestamp: new Date().toISOString(),
      source: 'test'
    };

    const statusResponse = await trackingApi.post('/track/email-status', statusData);
    const statusSuccess = statusResponse.status === 200;
    logTest('追踪服务-状态更新', statusSuccess, 
      statusSuccess ? '状态更新记录成功' : `状态码: ${statusResponse.status}`);

    // 测试像素追踪
    const pixelResponse = await trackingApi.get(`/track/pixel?mid=${testMessageId}&email=${encodeURIComponent(TEST_CONFIG.TEST_EMAIL)}`);
    const pixelSuccess = pixelResponse.status === 200 && pixelResponse.headers['content-type']?.includes('image/png');
    logTest('追踪服务-像素追踪', pixelSuccess, 
      pixelSuccess ? '1x1像素图片返回正常' : `状态码: ${pixelResponse.status}`);

    // 测试统计查询
    const statsResponse = await trackingApi.get(`/track/stats?mid=${testMessageId}`);
    const statsSuccess = statsResponse.status === 200;
    logTest('追踪服务-统计查询', statsSuccess, 
      statsSuccess ? `事件总数: ${statsResponse.data.total_events || 0}` : `状态码: ${statsResponse.status}`);

    return statusSuccess && pixelSuccess && statsSuccess;
  } catch (error) {
    logTest('追踪服务', false, `连接失败: ${error.message}`);
    return false;
  }
}

/**
 * 测试6: 图片处理服务
 */
async function testImageService() {
  try {
    // 测试健康检查
    const healthResponse = await imageApi.get('/health');
    if (healthResponse.status !== 200) {
      logTest('图片服务-健康检查', false, `状态码: ${healthResponse.status}`);
      return false;
    }

    // 创建测试图片
    const testImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    );

    // 测试图片上传
    const formData = new FormData();
    formData.append('image', testImageBuffer, 'test.png');

    const uploadResponse = await imageApi.post('/upload', formData, {
      headers: formData.getHeaders()
    });
    const uploadSuccess = uploadResponse.status === 200 && uploadResponse.data.success;
    
    let uploadedFilename = null;
    if (uploadSuccess) {
      uploadedFilename = uploadResponse.data.data.filename;
    }

    logTest('图片服务-文件上传', uploadSuccess, 
      uploadSuccess ? `文件名: ${uploadedFilename}` : `状态码: ${uploadResponse.status}`);

    // 测试图片列表
    const listResponse = await imageApi.get('/list');
    const listSuccess = listResponse.status === 200;
    logTest('图片服务-文件列表', listSuccess, 
      listSuccess ? `文件数量: ${listResponse.data.total || 0}` : `状态码: ${listResponse.status}`);

    // 如果上传成功，测试删除
    if (uploadSuccess && uploadedFilename) {
      const deleteResponse = await imageApi.delete(`/delete/${uploadedFilename}`);
      const deleteSuccess = deleteResponse.status === 200;
      logTest('图片服务-文件删除', deleteSuccess, 
        deleteSuccess ? '测试文件删除成功' : `状态码: ${deleteResponse.status}`);
    }

    return uploadSuccess && listSuccess;
  } catch (error) {
    logTest('图片服务', false, `连接失败: ${error.message}`);
    return false;
  }
}

/**
 * 测试7: 端到端邮件流程模拟
 */
async function testEmailFlow() {
  try {
    // 1. 模拟入站邮件处理
    const inboundEmailData = {
      from_email: 'sender@example.com',
      from_name: 'Test Sender',
      to_email: TEST_CONFIG.TEST_EMAIL,
      to_name: 'Test Recipient',
      subject: 'Integration Test Reply',
      content_text: 'This is a test reply email',
      content_html: '<p>This is a test reply email</p>',
      message_id: `test_reply_${Date.now()}`,
      received_at: new Date().toISOString(),
      source: 'integration_test'
    };

    const inboundResponse = await backendApi.post('/api/webhooks/conversations/inbound', inboundEmailData);
    const inboundSuccess = inboundResponse.status === 200;
    logTest('邮件流程-入站处理', inboundSuccess, 
      inboundSuccess ? '入站邮件处理成功' : `状态码: ${inboundResponse.status}`);

    // 2. 验证会话是否创建/更新
    const conversationsResponse = await backendApi.get('/api/conversations?search=Integration Test');
    const conversationsSuccess = conversationsResponse.status === 200;
    logTest('邮件流程-会话更新', conversationsSuccess, 
      conversationsSuccess ? `找到相关会话数: ${conversationsResponse.data.conversations?.length || 0}` : `状态码: ${conversationsResponse.status}`);

    return inboundSuccess && conversationsSuccess;
  } catch (error) {
    logTest('邮件流程测试', false, `流程异常: ${error.message}`);
    return false;
  }
}

/**
 * 主测试函数
 */
async function runIntegrationTests() {
  console.log('🚀 开始EDM系统集成测试...');
  console.log('=====================================');
  console.log(`测试环境: ${TEST_CONFIG.BASE_URL}`);
  console.log(`后端端口: ${TEST_CONFIG.BACKEND_PORT}`);
  console.log(`测试邮箱: ${TEST_CONFIG.TEST_EMAIL}`);
  console.log('=====================================\n');

  const tests = [
    { name: '后端服务', func: testBackendHealth, critical: true },
    { name: '用户认证', func: testUserAuth, critical: true },
    { name: '会话管理', func: testConversationManagement, critical: false },
    { name: 'Webhook服务', func: testWebhookService, critical: false },
    { name: '追踪服务', func: testTrackingService, critical: false },
    { name: '图片服务', func: testImageService, critical: false },
    { name: '邮件流程', func: testEmailFlow, critical: false }
  ];

  let criticalFailures = 0;
  let totalFailures = 0;

  for (const test of tests) {
    console.log(`\n📋 测试组: ${test.name}`);
    console.log('-------------------------------------');
    
    const success = await test.func();
    
    if (!success) {
      totalFailures++;
      if (test.critical) {
        criticalFailures++;
        console.log(`⚠️  关键测试失败，可能影响后续测试`);
      }
    }
  }

  // 生成测试报告
  console.log('\n📊 测试结果汇总');
  console.log('=====================================');
  
  const totalTests = testResults.length;
  const passedTests = testResults.filter(r => r.success).length;
  const failedTests = totalTests - passedTests;

  console.log(`总测试数: ${totalTests}`);
  console.log(`通过: ${passedTests} ✅`);
  console.log(`失败: ${failedTests} ❌`);
  console.log(`成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (criticalFailures > 0) {
    console.log(`\n🚨 关键测试失败: ${criticalFailures} 个`);
    console.log('建议修复关键问题后再进行生产部署');
  } else if (totalFailures > 0) {
    console.log(`\n⚠️  非关键测试失败: ${totalFailures} 个`);
    console.log('可以继续生产部署，但建议修复失败的功能');
  } else {
    console.log('\n🎉 所有测试通过！系统可以进行生产部署');
  }

  // 保存详细结果
  const reportFile = path.join(__dirname, '../test-results.json');
  fs.writeFileSync(reportFile, JSON.stringify({
    summary: {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      success_rate: ((passedTests / totalTests) * 100).toFixed(1),
      critical_failures: criticalFailures
    },
    details: testResults,
    timestamp: new Date().toISOString()
  }, null, 2));

  console.log(`\n📄 详细报告已保存: ${reportFile}`);
  
  // 返回退出码
  process.exit(criticalFailures > 0 ? 1 : 0);
}

// 启动测试
if (require.main === module) {
  runIntegrationTests().catch(error => {
    console.error('测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = {
  runIntegrationTests,
  TEST_CONFIG
}; 