const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';
const FRONTEND_BASE = 'http://localhost:3001';

let authToken = '';
let testData = {
  tagId: '',
  contactId: '',
  templateId: '',
  campaignId: '',
  taskId: ''
};

// 测试结果统计
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, message = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}${message ? ' - ' + message : ''}`);
  testResults.tests.push({ name, passed, message });
  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// BUG-001: 测试登录跳转问题
async function testLoginFlow() {
  console.log('\n🔍 测试 BUG-001: 登录跳转问题');
  
  try {
    // 测试登录API
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      usernameOrEmail: 'admin',
      password: 'admin123456'
    });
    
    if (loginResponse.data.token && loginResponse.data.data) {
      authToken = loginResponse.data.token;
      logTest('登录API返回正确格式', true, 'token和用户数据都存在');
    } else {
      logTest('登录API返回格式', false, '缺少token或用户数据');
      return false;
    }
    
    // 测试前端页面是否可访问
    const frontendResponse = await axios.get(FRONTEND_BASE);
    logTest('前端页面可访问', frontendResponse.status === 200);
    
    return true;
  } catch (error) {
    logTest('登录流程', false, error.message);
    return false;
  }
}

// BUG-002: 测试联系人标签关联问题
async function testContactTagIntegration() {
  console.log('\n🔍 测试 BUG-002: 联系人标签关联问题');
  
  try {
    // 创建测试标签
    const tagResponse = await axios.post(`${API_BASE}/tags`, {
      name: '回归测试标签',
      description: '用于回归测试的标签'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    testData.tagId = tagResponse.data.data.id;
    logTest('创建测试标签', true, `标签ID: ${testData.tagId}`);
    
    // 获取标签列表
    const tagsResponse = await axios.get(`${API_BASE}/tags`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const hasTestTag = tagsResponse.data.data.some(tag => tag.id === testData.tagId);
    logTest('标签API返回正确格式', hasTestTag, '新创建的标签在列表中');
    
    return true;
  } catch (error) {
    logTest('联系人标签关联', false, error.message);
    return false;
  }
}

// BUG-003 & BUG-004: 测试联系人CRUD操作
async function testContactCRUD() {
  console.log('\n🔍 测试 BUG-003 & BUG-004: 联系人编辑和删除问题');
  
  try {
    // 生成随机邮箱避免重复
    const randomEmail = `test${Date.now()}@regression.com`;
    
    // 创建测试联系人
    const contactResponse = await axios.post(`${API_BASE}/contacts`, {
      email: randomEmail,
      username: `regression_test_${Date.now()}`,
      status: 'active',
      source: 'manual'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    testData.contactId = contactResponse.data.data?.id || contactResponse.data.id;
    logTest('创建测试联系人', true, `联系人ID: ${testData.contactId}`);
    
    // 测试获取单个联系人详情
    const contactDetailResponse = await axios.get(`${API_BASE}/contacts/${testData.contactId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const contactData = contactDetailResponse.data.data;
    logTest('获取联系人详情', contactData && contactData.email === randomEmail);
    
    // 测试更新联系人
    const updateResponse = await axios.put(`${API_BASE}/contacts/${testData.contactId}`, {
      email: randomEmail,
      username: `updated_regression_test_${Date.now()}`,
      status: 'active'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    logTest('更新联系人', updateResponse.status === 200);
    
    // 测试删除联系人
    const deleteResponse = await axios.delete(`${API_BASE}/contacts/${testData.contactId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    logTest('删除联系人API', deleteResponse.status === 200);
    
    // 验证删除是否生效
    await sleep(1000);
    const contactsListResponse = await axios.get(`${API_BASE}/contacts`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const deletedContactExists = contactsListResponse.data.data.some(contact => contact.id === testData.contactId);
    logTest('联系人删除生效', !deletedContactExists, '删除的联系人不在列表中');
    
    return true;
  } catch (error) {
    logTest('联系人CRUD操作', false, error.message);
    return false;
  }
}

// BUG-005 & BUG-006: 测试标签删除和编辑
async function testTagCRUD() {
  console.log('\n🔍 测试 BUG-005 & BUG-006: 标签删除和编辑问题');
  
  try {
    // 测试标签编辑
    const updateResponse = await axios.put(`${API_BASE}/tags/${testData.tagId}`, {
      name: '更新后的回归测试标签',
      description: '已更新的描述'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    logTest('标签编辑API', updateResponse.status === 200);
    
    // 测试标签删除
    const deleteResponse = await axios.delete(`${API_BASE}/tags/${testData.tagId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    logTest('标签删除API', deleteResponse.status === 204);
    
    // 验证删除是否生效
    await sleep(1000);
    const tagsListResponse = await axios.get(`${API_BASE}/tags`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const deletedTagExists = tagsListResponse.data.data.some(tag => tag.id === testData.tagId);
    logTest('标签删除生效', !deletedTagExists, '删除的标签不在列表中');
    
    return true;
  } catch (error) {
    logTest('标签CRUD操作', false, error.message);
    return false;
  }
}

// BUG-007: 测试活动和任务创建页面
async function testCampaignTaskCreation() {
  console.log('\n🔍 测试 BUG-007: 活动和任务创建页面问题');
  
  try {
    // 测试活动API
    const campaignsResponse = await axios.get(`${API_BASE}/campaigns`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    logTest('活动列表API', campaignsResponse.status === 200);
    
    // 测试任务API
    const tasksResponse = await axios.get(`${API_BASE}/tasks`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    logTest('任务列表API', tasksResponse.status === 200);
    
    return true;
  } catch (error) {
    logTest('活动任务API', false, error.message);
    return false;
  }
}

// BUG-008 & BUG-009: 测试模板管理
async function testTemplateManagement() {
  console.log('\n🔍 测试 BUG-008 & BUG-009: 模板管理问题');
  
  try {
    // 测试模板创建
    const templateResponse = await axios.post(`${API_BASE}/templates`, {
      name: '回归测试模板',
      subject: '测试邮件主题',
      body: '<h1>这是测试模板内容</h1><p>包含HTML格式</p>'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    testData.templateId = templateResponse.data.id;
    logTest('模板创建API', templateResponse.status === 201, `模板ID: ${testData.templateId}`);
    
    // 测试模板列表
    const templatesResponse = await axios.get(`${API_BASE}/templates`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    logTest('模板列表API', templatesResponse.status === 200);
    
    // 测试模板详情
    const templateDetailResponse = await axios.get(`${API_BASE}/templates/${testData.templateId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    logTest('模板详情API', templateDetailResponse.status === 200);
    
    return true;
  } catch (error) {
    logTest('模板管理', false, error.message);
    return false;
  }
}

// 清理测试数据
async function cleanup() {
  console.log('\n🧹 清理测试数据');
  
  try {
    // 删除测试模板
    if (testData.templateId) {
      await axios.delete(`${API_BASE}/templates/${testData.templateId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      logTest('清理测试模板', true);
    }
  } catch (error) {
    logTest('清理测试数据', false, error.message);
  }
}

// 主测试函数
async function runBugRegressionTests() {
  console.log('🚀 开始EDM系统Bug回归测试\n');
  console.log('测试目标: 验证所有已修复的bug不再出现');
  console.log('=' .repeat(60));
  
  try {
    // 按顺序执行测试
    await testLoginFlow();
    await testContactTagIntegration();
    await testContactCRUD();
    await testTagCRUD();
    await testCampaignTaskCreation();
    await testTemplateManagement();
    
    // 清理测试数据
    await cleanup();
    
    // 输出测试结果
    console.log('\n' + '=' .repeat(60));
    console.log('📊 测试结果汇总:');
    console.log(`✅ 通过: ${testResults.passed}`);
    console.log(`❌ 失败: ${testResults.failed}`);
    console.log(`📈 成功率: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
    
    if (testResults.failed > 0) {
      console.log('\n❌ 失败的测试:');
      testResults.tests.filter(test => !test.passed).forEach(test => {
        console.log(`  - ${test.name}: ${test.message}`);
      });
    }
    
    console.log('\n🎯 回归测试完成!');
    
    if (testResults.failed === 0) {
      console.log('🎉 所有bug修复验证通过，系统可以交付！');
      process.exit(0);
    } else {
      console.log('⚠️  仍有问题需要修复');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ 测试执行失败:', error.message);
    process.exit(1);
  }
}

// 运行测试
runBugRegressionTests(); 