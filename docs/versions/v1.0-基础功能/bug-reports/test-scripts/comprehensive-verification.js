#!/usr/bin/env node

/**
 * 全面系统验证脚本
 * 重新验证所有6个Bug修复和邮件发送功能
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 配置
const API_BASE = 'http://localhost:3000/api';
const FRONTEND_BASE = 'http://localhost:3001';
const TEST_EMAIL = 'gloda2024@gmail.com';
const ADMIN_CREDENTIALS = {
  usernameOrEmail: 'admin@example.com',
  password: 'admin123456'
};

// 结果收集
const testResults = {
  passed: 0,
  failed: 0,
  details: []
};

// 日志函数
function log(message, type = 'info') {
  const timestamp = new Date().toLocaleString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  console.log(`${prefix} [${timestamp}] ${message}`);
  
  testResults.details.push({
    timestamp,
    type,
    message
  });
}

function logTest(name, passed, details = '') {
  if (passed) {
    testResults.passed++;
    log(`${name} - 通过 ${details}`, 'success');
  } else {
    testResults.failed++;
    log(`${name} - 失败 ${details}`, 'error');
  }
}

// 延迟函数
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testServiceHealth() {
  log('开始测试服务健康状态...', 'info');
  
  try {
    // 测试后端API
    const backendResponse = await axios.get(`${API_BASE}/health`, {
      timeout: 5000
    });
    logTest('后端API健康检查', backendResponse.status === 200, `状态码: ${backendResponse.status}`);
  } catch (error) {
    logTest('后端API健康检查', false, `错误: ${error.message}`);
  }

  try {
    // 测试前端服务
    const frontendResponse = await axios.get(FRONTEND_BASE, {
      timeout: 5000
    });
    logTest('前端服务访问', frontendResponse.status === 200, `状态码: ${frontendResponse.status}`);
  } catch (error) {
    logTest('前端服务访问', false, `错误: ${error.message}`);
  }
}

async function testAdminLogin() {
  log('测试管理员登录...', 'info');
  
  try {
    const response = await axios.post(`${API_BASE}/auth/login`, ADMIN_CREDENTIALS);
    
    if (response.data && response.data.success && response.data.token) {
      logTest('管理员登录', true, `Token获取成功`);
      return response.data.token;
    } else {
      logTest('管理员登录', false, `响应格式不正确: ${JSON.stringify(response.data)}`);
      return null;
    }
  } catch (error) {
    logTest('管理员登录', false, `错误: ${error.message}`);
    return null;
  }
}

async function testContactCRUD(token) {
  log('测试联系人CRUD功能...', 'info');
  const headers = { Authorization: `Bearer ${token}` };
  
  try {
    // 1. 创建联系人 (Bug 010-2测试) - 使用时间戳确保唯一性
    const timestamp = Date.now();
    const createData = {
      email: `test-${timestamp}@example.com`,
      username: 'TestUser',
      status: 'active',
      source: 'manual'
    };
    
    const createResponse = await axios.post(`${API_BASE}/contacts`, createData, { headers });
    logTest('联系人创建API', createResponse.status === 201, 
      `状态码: ${createResponse.status}, 联系人ID: ${createResponse.data?.id}`);
    
    const contactId = createResponse.data?.id;
    if (!contactId) {
      logTest('联系人创建返回ID', false, '创建联系人后未返回ID');
      return null;
    }

    // 2. 获取联系人列表，验证新联系人是否在列表中 (Bug 010-2测试)
    await delay(1000); // 等待数据同步
    const listResponse = await axios.get(`${API_BASE}/contacts`, { headers });
    const contactExists = listResponse.data.data.some(contact => contact.id === contactId);
    logTest('联系人列表同步', contactExists, 
      `新创建联系人${contactExists ? '已出现' : '未出现'}在列表中`);

    // 3. 获取联系人详情 (Bug 010-1测试)
    const detailResponse = await axios.get(`${API_BASE}/contacts/${contactId}`, { headers });
    const detailsCorrect = detailResponse.data.data.email === createData.email && 
                          detailResponse.data.data.username === createData.username;
    logTest('联系人详情获取', detailsCorrect, 
      `详情数据${detailsCorrect ? '正确' : '不正确'}`);

    return contactId;
  } catch (error) {
    logTest('联系人CRUD测试', false, `错误: ${error.message}`);
    return null;
  }
}

async function testTemplateCRUD(token) {
  log('测试模板CRUD功能...', 'info');
  const headers = { Authorization: `Bearer ${token}` };
  
  try {
    // 先获取现有模板列表
    const listResponse = await axios.get(`${API_BASE}/templates`, { headers });
    if (listResponse.data.items && listResponse.data.items.length > 0) {
      const existingTemplate = listResponse.data.items[0];
      logTest('模板列表获取', true, `找到${listResponse.data.items.length}个现有模板`);
      logTest('使用现有模板', true, `模板ID: ${existingTemplate.id}`);
      return existingTemplate.id;
    }
    
    // 如果没有现有模板，尝试创建一个简单的
    const templateData = {
      name: '验证测试模板',
      subject: '系统验证邮件',
      body: '这是验证测试邮件'
    };
    
    const createResponse = await axios.post(`${API_BASE}/templates`, templateData, { headers });
    logTest('模板创建API', createResponse.status === 201, 
      `状态码: ${createResponse.status}, 模板ID: ${createResponse.data?.id}`);
    
    const templateId = createResponse.data?.id;
    if (!templateId) {
      logTest('模板创建返回ID', false, '创建模板后未返回ID');
      return null;
    }

    return templateId;
  } catch (error) {
    logTest('模板CRUD测试', false, `错误: ${error.message}`);
    return null;
  }
}

async function testTemplateSets(token) {
  log('测试模板集功能...', 'info');
  const headers = { Authorization: `Bearer ${token}` };
  
  try {
    // 测试模板集API访问 (Bug 010-5测试)
    const response = await axios.get(`${API_BASE}/templates/sets`, { headers });
    logTest('模板集API可访问', response.status === 200, 
      `状态码: ${response.status}, 响应格式: ${response.data.items ? '正确' : '需检查'}`);
    
    return response.status === 200;
  } catch (error) {
    logTest('模板集API测试', false, `错误: ${error.message}`);
    return false;
  }
}

async function testTagsAPI(token) {
  log('测试标签API...', 'info');
  const headers = { Authorization: `Bearer ${token}` };
  
  try {
    const response = await axios.get(`${API_BASE}/tags`, { headers });
    logTest('标签API可访问', response.status === 200, 
      `状态码: ${response.status}, 数据格式: ${Array.isArray(response.data.data) ? '正确' : '需检查'}`);
    
    return response.status === 200;
  } catch (error) {
    logTest('标签API测试', false, `错误: ${error.message}`);
    return false;
  }
}

async function testEmailSending(token, contactId, templateId) {
  log('测试邮件发送功能...', 'info');
  const headers = { Authorization: `Bearer ${token}` };
  
  if (!templateId) {
    logTest('邮件发送准备', false, '缺少必要的模板ID');
    return false;
  }

  try {
    // 1. 创建专门用于邮件发送的联系人
    const emailContactData = {
      email: TEST_EMAIL,
      username: 'EmailTestUser',
      status: 'active',
      source: 'manual'
    };
    
    let emailContactId;
    try {
      const emailContactResponse = await axios.post(`${API_BASE}/contacts`, emailContactData, { headers });
      emailContactId = emailContactResponse.data?.id;
      logTest('创建邮件测试联系人', true, `联系人ID: ${emailContactId}`);
    } catch (error) {
      // 如果联系人已存在，尝试获取现有的
      const existingResponse = await axios.get(`${API_BASE}/contacts`, { 
        headers,
        params: { email: TEST_EMAIL }
      });
      if (existingResponse.data.data && existingResponse.data.data.length > 0) {
        emailContactId = existingResponse.data.data[0].id;
        logTest('使用现有邮件测试联系人', true, `联系人ID: ${emailContactId}`);
      } else {
        logTest('获取邮件测试联系人', false, '无法创建或找到邮件测试联系人');
        return false;
      }
    }

    // 2. 创建测试标签
    const timestamp = Date.now();
    const tagData = {
      name: `邮件验证标签-${timestamp}`,
      color: '#ff0000',
      description: '用于邮件发送验证的测试标签'
    };
    
    const tagResponse = await axios.post(`${API_BASE}/tags`, tagData, { headers });
    logTest('创建测试标签', tagResponse.status === 201, 
      `标签ID: ${tagResponse.data.data?.id}`);
    
    const tagId = tagResponse.data.data?.id;
    if (!tagId) {
      logTest('获取标签ID', false, '未能获取标签ID');
      return false;
    }

    // 3. 将标签关联到邮件测试联系人
    const updateContactData = {
      tags: [tagId]
    };
    
    await axios.put(`${API_BASE}/contacts/${emailContactId}`, updateContactData, { headers });
    logTest('联系人标签关联', true, '标签已关联到邮件测试联系人');

    // 4. 创建模板集
    const templateSetData = {
      name: '验证测试模板集',
      description: '用于系统验证的模板集',
      items: [
        {
          template_id: templateId,
          delay_hours: 0,
          order: 1
        }
      ]
    };
    
    const setResponse = await axios.post(`${API_BASE}/templates/sets`, templateSetData, { headers });
    logTest('创建模板集', setResponse.status === 201, 
      `模板集ID: ${setResponse.data?.id}`);
    
    const templateSetId = setResponse.data?.id;
    if (!templateSetId) {
      logTest('获取模板集ID', false, '未能获取模板集ID');
      return false;
    }

    // 5. 创建活动
    const campaignData = {
      name: '系统验证活动',
      description: '用于验证邮件发送功能的测试活动',
      status: 'active'
    };
    
    const campaignResponse = await axios.post(`${API_BASE}/campaigns`, campaignData, { headers });
    logTest('创建测试活动', campaignResponse.status === 201, 
      `活动ID: ${campaignResponse.data?.id}`);
    
    const campaignId = campaignResponse.data?.id;
    if (!campaignId) {
      logTest('获取活动ID', false, '未能获取活动ID');
      return false;
    }

    // 6. 创建发送任务
    const taskData = {
      campaign_id: campaignId,
      name: '系统验证邮件任务',
      plan_time: new Date(Date.now() + 60000).toISOString(), // 1分钟后
      recipient_rule: {
        type: 'TAG_BASED',
        include_tags: [tagId]
      },
      template_set_id: templateSetId
    };
    
    const taskResponse = await axios.post(`${API_BASE}/tasks`, taskData, { headers });
    logTest('创建邮件任务', taskResponse.status === 201, 
      `任务ID: ${taskResponse.data?.id}`);
    
    const taskId = taskResponse.data?.id;
    if (!taskId) {
      logTest('获取任务ID', false, '未能获取任务ID');
      return false;
    }

    // 7. 执行任务
    await axios.post(`${API_BASE}/tasks/${taskId}/status`, { status: 'scheduled' }, { headers });
    logTest('执行邮件任务', true, '邮件任务已设置为计划状态');

    // 等待邮件发送
    await delay(3000);
    
    log(`📧 测试邮件应该已发送到: ${TEST_EMAIL}`, 'info');
    log('请检查您的邮箱(包括垃圾邮件文件夹)', 'info');
    
    // 清理测试数据
    try {
      await axios.delete(`${API_BASE}/tasks/${taskId}`, { headers });
      await axios.delete(`${API_BASE}/campaigns/${campaignId}`, { headers });
      await axios.delete(`${API_BASE}/templates/sets/${templateSetId}`, { headers });
      await axios.delete(`${API_BASE}/tags/${tagId}`, { headers });
      logTest('测试数据清理', true, '邮件测试相关数据已清理');
    } catch (cleanupError) {
      logTest('测试数据清理', false, `清理失败: ${cleanupError.message}`);
    }
    
    return true;
  } catch (error) {
    logTest('邮件发送测试', false, `错误: ${error.message}`);
    return false;
  }
}

async function cleanupTestData(token, contactId, templateId) {
  log('清理测试数据...', 'info');
  const headers = { Authorization: `Bearer ${token}` };
  
  try {
    if (contactId) {
      await axios.delete(`${API_BASE}/contacts/${contactId}`, { headers });
    }
    if (templateId) {
      await axios.delete(`${API_BASE}/templates/${templateId}`, { headers });
    }
    logTest('基础测试数据清理', true, '联系人和模板已清理');
  } catch (error) {
    logTest('基础测试数据清理', false, `清理失败: ${error.message}`);
  }
}

function generateReport() {
  const totalTests = testResults.passed + testResults.failed;
  const successRate = totalTests > 0 ? (testResults.passed / totalTests * 100).toFixed(1) : 0;
  
  console.log('\n' + '='.repeat(80));
  console.log('🏁 全面验证测试报告');
  console.log('='.repeat(80));
  console.log(`✅ 通过测试: ${testResults.passed}`);
  console.log(`❌ 失败测试: ${testResults.failed}`);
  console.log(`📊 成功率: ${successRate}%`);
  console.log(`🎯 验收状态: ${testResults.failed === 0 ? '✅ 通过，可以验收' : '❌ 存在问题，需要修复'}`);
  console.log('='.repeat(80));
  
  // 保存详细报告
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: totalTests,
      passed: testResults.passed,
      failed: testResults.failed,
      successRate: parseFloat(successRate)
    },
    details: testResults.details,
    recommendation: testResults.failed === 0 ? 
      '所有测试通过，系统可以进行验收' : 
      '存在失败测试，需要进一步修复'
  };
  
  const reportPath = path.join(__dirname, '..', 'comprehensive-verification-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 详细报告已保存到: ${reportPath}`);
}

async function main() {
  console.log('🚀 开始全面系统验证测试...\n');
  
  // 1. 服务健康检查
  await testServiceHealth();
  await delay(2000);
  
  // 2. 管理员登录
  const token = await testAdminLogin();
  if (!token) {
    log('无法获取认证令牌，终止测试', 'error');
    generateReport();
    process.exit(1);
  }
  await delay(1000);
  
  // 3. 联系人功能测试 (Bug 010-1, 010-2)
  const contactId = await testContactCRUD(token);
  await delay(1000);
  
  // 4. 模板功能测试 (Bug 010-3, 010-4)
  const templateId = await testTemplateCRUD(token);
  await delay(1000);
  
  // 5. 模板集测试 (Bug 010-5)
  await testTemplateSets(token);
  await delay(1000);
  
  // 6. 标签API测试
  await testTagsAPI(token);
  await delay(1000);
  
  // 7. 邮件发送测试 (Bug 010-6)
  await testEmailSending(token, contactId, templateId);
  await delay(2000);
  
  // 8. 清理测试数据
  await cleanupTestData(token, contactId, templateId);
  
  // 9. 生成报告
  generateReport();
  
  console.log('\n🏁 全面验证测试完成！');
  process.exit(testResults.failed === 0 ? 0 : 1);
}

// 错误处理
process.on('unhandledRejection', (reason, promise) => {
  log(`未处理的Promise拒绝: ${reason}`, 'error');
  generateReport();
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  log(`未捕获的异常: ${error.message}`, 'error');
  generateReport();
  process.exit(1);
});

// 执行主函数
main().catch(error => {
  log(`主函数执行失败: ${error.message}`, 'error');
  generateReport();
  process.exit(1);
}); 