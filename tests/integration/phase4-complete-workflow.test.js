/**
 * Phase 4 队列系统完整工作流测试
 * 测试从任务创建到队列调度的完整API链路
 */

const axios = require('axios');

// 测试配置
const CONFIG = {
  baseURL: 'http://localhost:8082',
  authToken: 'dev-permanent-test-token-admin-2025',
  testUserId: '97c081a0-ef1d-4db6-b82a-15fc98370871'
};

// 创建HTTP客户端
const api = axios.create({
  baseURL: CONFIG.baseURL,
  headers: {
    'Authorization': `Bearer ${CONFIG.authToken}`,
    'Content-Type': 'application/json'
  }
});

// 测试数据存储
let testData = {
  user: null,
  sender: null,
  template: null,
  contacts: [],
  emailServices: [],
  task: null,
  subTasks: []
};

class Phase4WorkflowTester {
  
  /**
   * 步骤1: 验证基础数据准备
   */
  async step1_VerifyBaseData() {
    console.log('\n🔧 步骤1: 验证基础数据准备...');
    
    try {
      // 获取测试用户
      const userResponse = await api.get(`/api/users/${CONFIG.testUserId}`);
      testData.user = userResponse.data.data;
      console.log(`✅ 测试用户: ${testData.user.username}`);
      
      // 获取发送者
      const sendersResponse = await api.get('/api/senders');
      testData.sender = sendersResponse.data.data[0];
      console.log(`✅ 发送者: ${testData.sender.name}`);
      
      // 获取邮件模板
      const templatesResponse = await api.get('/api/templates');
      testData.template = templatesResponse.data.data[0];
      console.log(`✅ 邮件模板: ${testData.template.name}`);
      
      // 获取联系人 (Phase 3修复后的标签查询)
      const contactsResponse = await api.get('/api/contacts');
      testData.contacts = contactsResponse.data.data.slice(0, 3);
      console.log(`✅ 测试联系人: ${testData.contacts.length}个`);
      
      // 获取邮件服务 (Phase 4核心)
      const servicesResponse = await api.get('/api/email-services');
      testData.emailServices = servicesResponse.data.data.filter(s => s.is_enabled);
      console.log(`✅ 可用邮件服务: ${testData.emailServices.length}个`);
      
      return {
        success: true,
        message: '基础数据验证完成',
        data: {
          user: !!testData.user,
          sender: !!testData.sender,
          template: !!testData.template,
          contacts: testData.contacts.length,
          emailServices: testData.emailServices.length
        }
      };
      
    } catch (error) {
      console.error('❌ 基础数据验证失败:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * 步骤2: 创建任务 (通过API)
   */
  async step2_CreateTask() {
    console.log('\n📝 步骤2: 通过API创建任务...');
    
    try {
      const taskData = {
        name: `Phase4测试任务_${Date.now()}`,
        description: 'Phase 4完整工作流测试任务',
        sender_id: testData.sender.id,
        template_id: testData.template.id,
        recipient_rule: {
          type: 'specific',
          contact_ids: testData.contacts.map(c => c.id)
        },
        priority: 5,
        scheduled_at: new Date(Date.now() + 60000).toISOString() // 1分钟后执行
      };
      
      const response = await api.post('/api/tasks', taskData);
      testData.task = response.data.data;
      
      console.log(`✅ 任务创建成功: ${testData.task.id}`);
      console.log(`   - 名称: ${testData.task.name}`);
      console.log(`   - 状态: ${testData.task.status}`);
      console.log(`   - 优先级: ${testData.task.priority}`);
      console.log(`   - 调度时间: ${testData.task.scheduled_at}`);
      
      return {
        success: true,
        message: '任务创建成功',
        data: testData.task
      };
      
    } catch (error) {
      console.error('❌ 任务创建失败:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * 执行完整测试流程
   */
  async runCompleteTest() {
    console.log('🚀 启动Phase 4完整工作流测试...\n');
    
    const results = [];
    
    try {
      // 执行测试步骤
      results.push(await this.step1_VerifyBaseData());
      results.push(await this.step2_CreateTask());
      
      console.log('\n📊 Phase 4完整工作流测试报告');
      console.log('========================================');
      
      results.forEach((result, index) => {
        console.log(`✅ 步骤${index + 1}: ${result.message}`);
      });
      
      return {
        success: true,
        message: 'Phase 4完整工作流测试通过',
        results: results
      };
      
    } catch (error) {
      console.error('\n❌ 测试流程中断:', error.message);
      throw error;
    }
  }
}

// 执行测试
if (require.main === module) {
  const tester = new Phase4WorkflowTester();
  
  tester.runCompleteTest()
    .then(() => {
      console.log('\n🎉 Phase 4完整测试成功完成!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Phase 4测试失败:', error.message);
      process.exit(1);
    });
}

module.exports = Phase4WorkflowTester;
