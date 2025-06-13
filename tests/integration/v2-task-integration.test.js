const { setupTestEnvironment, teardownTestEnvironment } = require('./setup-docker');

describe('🚀 V2.0-Task闭环集成测试', () => {
  let testEnv;
  let apiClient;
  let adminApiClient;
  let testUser;
  let createdTasks = [];
  let createdContacts = [];
  let createdTemplates = [];

  beforeAll(async () => {
    console.log('🔧 [V2.0-Task闭环] 设置测试环境...');
    testEnv = await setupTestEnvironment();
    apiClient = testEnv.apiClient;
    adminApiClient = testEnv.adminApiClient;
    testUser = testEnv.testUser;
    console.log('✅ 测试环境就绪');
  });

  afterAll(async () => {
    console.log('🧹 [V2.0-Task闭环] 清理测试数据...');
    
    // 清理创建的任务
    for (const task of createdTasks) {
      try {
        await apiClient.delete(`/tasks/${task.id}`);
        console.log(`✅ 已清理任务: ${task.name || task.id}`);
      } catch (error) {
        console.log(`⚠️ 清理任务失败: ${task.name || task.id}`);
      }
    }
    
    // 清理创建的联系人
    for (const contact of createdContacts) {
      try {
        await apiClient.delete(`/contacts/${contact.id}`);
        console.log(`✅ 已清理联系人: ${contact.name || contact.id}`);
      } catch (error) {
        console.log(`⚠️ 清理联系人失败: ${contact.name || contact.id}`);
      }
    }
    
    // 清理创建的模板
    for (const template of createdTemplates) {
      try {
        await apiClient.delete(`/templates/${template.id}`);
        console.log(`✅ 已清理模板: ${template.name || template.id}`);
      } catch (error) {
        console.log(`⚠️ 清理模板失败: ${template.name || template.id}`);
      }
    }
    
    await teardownTestEnvironment();
    console.log('✅ 测试环境清理完成');
  });

  describe('TC-INT-TASK-001: Task基础功能', () => {
    test('应该能创建测试联系人', async () => {
      const contactData = {
        name: `测试联系人-${Date.now()}`,
        email: `test-${Date.now()}@example.com`,
        status: 'active'
      };

      const response = await apiClient.post('/contacts', contactData);
      
      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data.name).toBe(contactData.name);
      expect(response.data.email).toBe(contactData.email);
      
      createdContacts.push(response.data);
      console.log('✅ 联系人创建成功:', response.data.name);
    });

    test('应该能创建测试模板', async () => {
      const templateData = {
        name: `测试模板-${Date.now()}`,
        subject: '测试邮件主题',
        body: '<div>测试邮件内容 {{name}}</div>'
      };

      const response = await apiClient.post('/templates', templateData);
      
      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data.name).toBe(templateData.name);
      expect(response.data.subject).toBe(templateData.subject);
      
      createdTemplates.push(response.data);
      console.log('✅ 模板创建成功:', response.data.name);
    });

    test('应该能创建基础任务', async () => {
      // 确保有联系人和模板
      expect(createdContacts.length).toBeGreaterThan(0);
      expect(createdTemplates.length).toBeGreaterThan(0);

      const taskData = {
        name: `V2.0测试任务-${Date.now()}`,
        description: '这是一个V2.0集成测试任务',
        type: 'one_time',
        status: 'draft',
        schedule_time: new Date(Date.now() + 3600000).toISOString(), // 1小时后
        recipient_type: 'specific',
        recipients: [createdContacts[0].id],
        template_id: createdTemplates[0].id
      };

      const response = await apiClient.post('/tasks', taskData);
      
      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data.name).toBe(taskData.name);
      expect(response.data.type).toBe('one_time');
      expect(response.data.status).toBe('draft');
      
      createdTasks.push(response.data);
      console.log('✅ 任务创建成功:', response.data.name);
    });

    test('应该能查询任务列表', async () => {
      const response = await apiClient.get('/tasks');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('items');
      expect(Array.isArray(response.data.items)).toBe(true);
      
      // 验证刚创建的任务在列表中
      const foundTask = response.data.items.find(task => task.id === createdTasks[0].id);
      expect(foundTask).toBeTruthy();
      
      console.log('✅ 任务列表查询成功，任务数量:', response.data.items.length);
    });

    test('应该能查询单个任务详情', async () => {
      const taskId = createdTasks[0].id;
      const response = await apiClient.get(`/tasks/${taskId}`);
      
      expect(response.status).toBe(200);
      expect(response.data.id).toBe(taskId);
      expect(response.data.name).toContain('V2.0测试任务');
      
      console.log('✅ 任务详情查询成功:', response.data.name);
    });

    test('应该能更新任务状态', async () => {
      const taskId = createdTasks[0].id;
      const response = await apiClient.patch(`/tasks/${taskId}/status`, {
        status: 'scheduled'
      });
      
      expect(response.status).toBe(200);
      expect(response.data.status).toBe('scheduled');
      
      console.log('✅ 任务状态更新成功: draft → scheduled');
    });
  });

  describe('TC-INT-TASK-002: Task与V2.0功能集成', () => {
    test('应该能查看用户额度状态', async () => {
      const response = await apiClient.get('/users-v2/quota');
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveProperty('remaining_quota');
      expect(response.data.data).toHaveProperty('daily_quota');
      
      console.log('✅ 用户额度查询成功，剩余额度:', response.data.data.remaining_quota);
    });

    test('管理员应该能为用户分配额度', async () => {
      const userId = testUser.id;
      const allocateAmount = 500;
      
      const response = await adminApiClient.post(`/users-v2/${userId}/quota`, {
        amount: allocateAmount,
        reason: 'Task集成测试额度分配'
      });
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.allocated_amount).toBe(allocateAmount);
      
      // 验证额度确实增加了
      const quotaResponse = await apiClient.get('/users-v2/quota');
      expect(quotaResponse.data.data.remaining_quota).toBeGreaterThanOrEqual(allocateAmount);
      
      console.log('✅ 额度分配成功，分配数量:', allocateAmount);
    });

    test('应该能查看发信服务列表', async () => {
      const response = await apiClient.get('/email-services');
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.data)).toBe(true);
      
      console.log('✅ 发信服务查询成功，服务数量:', response.data.data.length);
    });

    test('应该能查看发信人列表', async () => {
      const response = await apiClient.get('/senders');
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.data)).toBe(true);
      
      console.log('✅ 发信人查询成功，发信人数量:', response.data.data.length);
    });
  });

  describe('TC-INT-TASK-003: Task执行流程模拟', () => {
    test('应该能获取任务统计信息', async () => {
      const response = await apiClient.get('/tasks/stats');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('total');
      expect(response.data).toHaveProperty('by_status');
      expect(typeof response.data.total).toBe('number');
      
      console.log('✅ 任务统计查询成功，总任务数:', response.data.total);
    });

    test('应该能查看用户Dashboard集成信息', async () => {
      const response = await apiClient.get('/users-v2/dashboard');
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveProperty('user');
      expect(response.data.data).toHaveProperty('stats');
      expect(response.data.data).toHaveProperty('recent_quota_logs');
      
      const userData = response.data.data.user;
      expect(userData).toHaveProperty('remaining_quota');
      expect(userData.remaining_quota).toBeGreaterThanOrEqual(0);
      
      console.log('✅ 用户Dashboard查询成功');
      console.log('   - 用户名:', userData.username);
      console.log('   - 剩余额度:', userData.remaining_quota);
      console.log('   - 总任务数:', response.data.data.stats.total_campaigns);
    });
  });

  describe('TC-INT-TASK-004: 数据完整性验证', () => {
    test('Task、联系人、模板数据应该保持一致', async () => {
      const taskId = createdTasks[0].id;
      const contactId = createdContacts[0].id;
      const templateId = createdTemplates[0].id;
      
      // 获取任务详情
      const taskResponse = await apiClient.get(`/tasks/${taskId}`);
      expect(taskResponse.status).toBe(200);
      
      // 验证任务中的关联数据
      expect(taskResponse.data.recipients).toContain(contactId);
      expect(taskResponse.data.template_id).toBe(templateId);
      
      // 获取联系人详情
      const contactResponse = await apiClient.get(`/contacts/${contactId}`);
      expect(contactResponse.status).toBe(200);
      expect(contactResponse.data.id).toBe(contactId);
      
      // 获取模板详情
      const templateResponse = await apiClient.get(`/templates/${templateId}`);
      expect(templateResponse.status).toBe(200);
      expect(templateResponse.data.id).toBe(templateId);
      
      console.log('✅ 数据关联完整性验证通过');
    });

    test('V2.0功能数据应该正确关联', async () => {
      // 验证用户额度日志记录
      const dashboardResponse = await apiClient.get('/users-v2/dashboard');
      expect(dashboardResponse.status).toBe(200);
      
      const quotaLogs = dashboardResponse.data.data.recent_quota_logs;
      expect(Array.isArray(quotaLogs)).toBe(true);
      
      // 如果有额度日志，验证其结构
      if (quotaLogs.length > 0) {
        const log = quotaLogs[0];
        expect(log).toHaveProperty('operation_type');
        expect(log).toHaveProperty('amount');
        expect(log).toHaveProperty('balance_after');
        expect(log).toHaveProperty('created_at');
      }
      
      console.log('✅ V2.0功能数据关联验证通过');
      console.log('   - 额度日志数量:', quotaLogs.length);
    });
  });
}); 