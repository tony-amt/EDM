#!/usr/bin/env node

/**
 * EDM系统完整回归测试
 * 验证7个修复项的功能完整性
 */

const axios = require('axios');
const fs = require('fs');

console.log('🧪 EDM系统完整回归测试开始...\n');

const API_BASE = 'http://localhost:3000/api';
const FRONTEND_BASE = 'http://localhost:3001';

let authToken = '';
let testResults = [];

// 测试结果记录
function recordTest(name, passed, details = '') {
  testResults.push({ name, passed, details });
  const status = passed ? '✅' : '❌';
  console.log(`${status} ${name}`);
  if (details) console.log(`   ${details}`);
}

// 等待服务启动
async function waitForService(url, serviceName, maxAttempts = 30) {
  console.log(`⏳ 等待${serviceName}启动...`);
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await axios.get(url, { timeout: 3000 });
      if (response.status === 200) {
        console.log(`✅ ${serviceName}启动成功！`);
        return true;
      }
    } catch (error) {
      // 忽略错误，继续等待
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    process.stdout.write('.');
  }
  
  console.log(`\n❌ ${serviceName}启动超时`);
  return false;
}

// 1. 测试后端服务健康检查
async function testBackendHealth() {
  try {
    const response = await axios.get(`${API_BASE.replace('/api', '')}/health`);
    const isHealthy = response.status === 200 && response.data.status === 'OK';
    recordTest('1. 后端服务健康检查', isHealthy, 
      isHealthy ? `数据库: ${response.data.database}, 路由: ${response.data.routes}` : '服务不健康');
    return isHealthy;
  } catch (error) {
    recordTest('1. 后端服务健康检查', false, '服务无法访问');
    return false;
  }
}

// 2. 测试用户认证
async function testAuthentication() {
  try {
    // 注册测试用户
    const registerResponse = await axios.post(`${API_BASE}/auth/register`, {
      username: `testuser_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,
      password: '123456',
      role: 'admin'
    });
    
    if (registerResponse.status !== 201) {
      recordTest('2. 用户认证 - 注册', false, '注册失败');
      return false;
    }
    
    // 登录测试
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      usernameOrEmail: registerResponse.data.data.username,
      password: '123456'
    });
    
    if (loginResponse.status === 200 && loginResponse.data.token) {
      authToken = loginResponse.data.token;
      recordTest('2. 用户认证 - 登录', true, '获取到认证token');
      return true;
    } else {
      recordTest('2. 用户认证 - 登录', false, '登录失败');
      return false;
    }
  } catch (error) {
    recordTest('2. 用户认证', false, `认证失败: ${error.message}`);
    return false;
  }
}

// 3. 测试标签管理API
async function testTagsAPI() {
  try {
    const headers = { Authorization: `Bearer ${authToken}` };
    
    // 获取标签列表
    const getResponse = await axios.get(`${API_BASE}/tags`, { headers });
    
    // 创建新标签
    const createResponse = await axios.post(`${API_BASE}/tags`, {
      name: `测试标签_${Date.now()}`,
      description: '回归测试创建的标签'
    }, { headers });
    
    const success = getResponse.status === 200 && createResponse.status === 201;
    recordTest('3. 标签管理API', success, 
      success ? `获取到${getResponse.data.data.length}个标签，创建标签成功` : '标签API异常');
    return success;
  } catch (error) {
    recordTest('3. 标签管理API', false, `API调用失败: ${error.message}`);
    return false;
  }
}

// 4. 测试联系人管理API
async function testContactsAPI() {
  try {
    const headers = { Authorization: `Bearer ${authToken}` };
    
    // 获取联系人列表
    const getResponse = await axios.get(`${API_BASE}/contacts`, { headers });
    
    // 创建新联系人
    const createResponse = await axios.post(`${API_BASE}/contacts`, {
      email: `test_${Date.now()}@example.com`,
      name: '测试联系人',
      status: 'active',
      source: 'manual'
    }, { headers });
    
    const success = getResponse.status === 200 && createResponse.status === 201;
    recordTest('4. 联系人管理API', success, 
      success ? `获取到${getResponse.data.data.length}个联系人，创建联系人成功` : '联系人API异常');
    return success;
  } catch (error) {
    recordTest('4. 联系人管理API', false, `API调用失败: ${error.message}`);
    return false;
  }
}

// 5. 测试模板管理API
async function testTemplatesAPI() {
  try {
    const headers = { Authorization: `Bearer ${authToken}` };
    
    // 获取模板列表
    const getResponse = await axios.get(`${API_BASE}/templates`, { headers });
    
    // 创建新模板
    const createResponse = await axios.post(`${API_BASE}/templates`, {
      name: `测试模板_${Date.now()}`,
      subject: '测试邮件主题',
      body: '<h1>测试邮件内容</h1><p>这是一个测试模板。</p>'
    }, { headers });
    
    const success = getResponse.status === 200 && createResponse.status === 201;
    recordTest('5. 模板管理API', success, 
      success ? `获取到${getResponse.data.data.length}个模板，创建模板成功` : '模板API异常');
    return success;
  } catch (error) {
    recordTest('5. 模板管理API', false, `API调用失败: ${error.message}`);
    return false;
  }
}

// 6. 测试活动管理API
async function testCampaignsAPI() {
  try {
    const headers = { Authorization: `Bearer ${authToken}` };
    
    // 获取活动列表
    const getResponse = await axios.get(`${API_BASE}/campaigns`, { headers });
    
    // 创建新活动
    const createResponse = await axios.post(`${API_BASE}/campaigns`, {
      name: `测试活动_${Date.now()}`,
      description: '回归测试创建的活动',
      status: 'draft'
    }, { headers });
    
    const success = getResponse.status === 200 && createResponse.status === 201;
    recordTest('6. 活动管理API', success, 
      success ? `获取到${getResponse.data.data.length}个活动，创建活动成功` : '活动API异常');
    return success;
  } catch (error) {
    recordTest('6. 活动管理API', false, `API调用失败: ${error.message}`);
    return false;
  }
}

// 7. 测试任务管理API
async function testTasksAPI() {
  try {
    const headers = { Authorization: `Bearer ${authToken}` };
    
    // 获取任务列表
    const getResponse = await axios.get(`${API_BASE}/tasks`, { headers });
    
    const success = getResponse.status === 200;
    recordTest('7. 任务管理API', success, 
      success ? `获取到${getResponse.data.data.length}个任务` : '任务API异常');
    return success;
  } catch (error) {
    recordTest('7. 任务管理API', false, `API调用失败: ${error.message}`);
    return false;
  }
}

// 8. 测试前端页面可访问性
async function testFrontendPages() {
  try {
    const response = await axios.get(FRONTEND_BASE, { timeout: 5000 });
    const isAccessible = response.status === 200 && response.data.includes('DOCTYPE html');
    recordTest('8. 前端页面可访问性', isAccessible, 
      isAccessible ? '前端页面正常加载' : '前端页面无法访问');
    return isAccessible;
  } catch (error) {
    recordTest('8. 前端页面可访问性', false, `前端无法访问: ${error.message}`);
    return false;
  }
}

// 9. 测试路由配置正确性
function testRouteConfiguration() {
  const appPath = 'src/frontend/src/App.tsx';
  if (!fs.existsSync(appPath)) {
    recordTest('9. 路由配置正确性', false, 'App.tsx文件不存在');
    return false;
  }
  
  const content = fs.readFileSync(appPath, 'utf8');
  const hasCorrectRoutes = content.includes('contacts/edit/:id') && 
                          content.includes('campaigns/edit/:id') &&
                          content.includes('tasks/edit/:id') &&
                          content.includes('templates/edit/:id');
  
  recordTest('9. 路由配置正确性', hasCorrectRoutes, 
    hasCorrectRoutes ? '所有编辑路由格式正确' : '路由配置存在问题');
  return hasCorrectRoutes;
}

// 10. 测试组件功能完整性
function testComponentCompleteness() {
  const components = [
    'src/frontend/src/components/contacts/ContactForm.tsx',
    'src/frontend/src/components/contacts/ContactImport.tsx',
    'src/frontend/src/pages/templates/components/TemplateForm.tsx'
  ];
  
  let allExist = true;
  let details = [];
  
  for (const component of components) {
    if (fs.existsSync(component)) {
      details.push(`✓ ${component.split('/').pop()}`);
    } else {
      details.push(`✗ ${component.split('/').pop()}`);
      allExist = false;
    }
  }
  
  recordTest('10. 组件功能完整性', allExist, details.join(', '));
  return allExist;
}

// 主测试函数
async function runRegressionTest() {
  console.log('🚀 开始完整回归测试...\n');
  
  // 等待服务启动
  const backendReady = await waitForService(`${API_BASE.replace('/api', '')}/health`, '后端服务');
  if (!backendReady) {
    console.log('\n❌ 后端服务未启动，测试终止');
    return;
  }
  
  const frontendReady = await waitForService(FRONTEND_BASE, '前端服务');
  
  console.log('\n📋 执行测试项目...\n');
  
  // 执行所有测试
  const tests = [
    testBackendHealth,
    testAuthentication,
    testTagsAPI,
    testContactsAPI,
    testTemplatesAPI,
    testCampaignsAPI,
    testTasksAPI,
    frontendReady ? testFrontendPages : () => recordTest('8. 前端页面可访问性', false, '前端服务未启动'),
    testRouteConfiguration,
    testComponentCompleteness
  ];
  
  for (const test of tests) {
    try {
      await test();
    } catch (error) {
      console.log(`❌ 测试执行异常: ${error.message}`);
    }
    await new Promise(resolve => setTimeout(resolve, 500)); // 间隔500ms
  }
  
  // 生成测试报告
  console.log('\n📊 回归测试报告');
  console.log('='.repeat(50));
  
  const passedTests = testResults.filter(t => t.passed).length;
  const totalTests = testResults.length;
  const passRate = ((passedTests / totalTests) * 100).toFixed(1);
  
  console.log(`总测试项: ${totalTests}`);
  console.log(`通过测试: ${passedTests}`);
  console.log(`失败测试: ${totalTests - passedTests}`);
  console.log(`通过率: ${passRate}%`);
  
  if (passRate >= 90) {
    console.log('\n🎉 回归测试通过！系统可以交付使用。');
  } else if (passRate >= 70) {
    console.log('\n⚠️ 回归测试部分通过，建议修复失败项后再次测试。');
  } else {
    console.log('\n❌ 回归测试失败，需要修复关键问题。');
  }
  
  console.log('\n📝 详细测试结果:');
  testResults.forEach((result, index) => {
    const status = result.passed ? '✅' : '❌';
    console.log(`${index + 1}. ${status} ${result.name}`);
    if (result.details) {
      console.log(`   ${result.details}`);
    }
  });
  
  // 保存测试报告
  const reportPath = `regression-test-report-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: { total: totalTests, passed: passedTests, failed: totalTests - passedTests, passRate },
    results: testResults
  }, null, 2));
  
  console.log(`\n📄 测试报告已保存: ${reportPath}`);
}

// 运行测试
runRegressionTest().catch(error => {
  console.error('回归测试执行失败:', error);
  process.exit(1);
}); 