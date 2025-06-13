const { setupTestEnvironment, teardownTestEnvironment } = require('./setup-docker');

describe('🚀 V2.0群发任务集成测试', () => {
  let testEnv;
  let apiClient;
  let testUser;
  let testContact;
  let testTemplate;
  let testTemplateSet;
  let testSender;
  let testEmailService;
  let createdTasks = [];

  beforeAll(async () => {
    console.log('🔧 [V2.0-Task] 设置测试环境...');
    testEnv = await setupTestEnvironment();
    apiClient = testEnv.apiClient;
    testUser = testEnv.testUser;
    console.log('✅ 测试环境就绪');
  });

  afterAll(async () => {
    console.log('🧹 [V2.0-Task] 清理测试数据...');
    
    // 清理创建的任务
    for (const task of createdTasks) {
      try {
        await apiClient.delete(`/tasks/${task.id}`);
        console.log(`✅ 已清理任务: ${task.name || task.id}`);
      } catch (error) {
        console.log(`⚠️ 清理任务失败: ${task.id}`, error.response?.status);
      }
    }
    
    await teardownTestEnvironment();
  });

  // 准备测试数据
  beforeEach(async () => {
    // 创建测试联系人
    const contactResponse = await apiClient.post('/contacts', {
      name: `测试联系人-${Date.now()}`,
      email: `test-${Date.now()}@example.com`,
      tags: ['test-tag']
    });
    testContact = contactResponse.data;

    // 创建测试模板
    const templateResponse = await apiClient.post('/templates', {
      name: `测试模板-${Date.now()}`,
      type: 'email',
      subject: '测试邮件 - {{name}}',
      body: '您好 {{name}}，这是一封测试邮件。',
      variables: ['name']
    });
    testTemplate = templateResponse.data;

    // 创建测试模板集
    const templateSetResponse = await apiClient.post('/template-sets', {
      name: `测试模板集-${Date.now()}`,
      template_ids: [testTemplate.id]
    });
    testTemplateSet = templateSetResponse.data;

    // 获取可用的发信人和发信服务
    const sendersResponse = await apiClient.get('/senders');
    testSender = sendersResponse.data.data[0];

    const servicesResponse = await apiClient.get('/email-services');
    testEmailService = servicesResponse.data.data[0];

    console.log('✅ 测试数据准备完成');
  });

  describe('🎯 V2.0任务创建测试', () => {
    test('应该能创建独立的群发任务', async () => {
      const taskData = {
        name: `V2.0测试任务-${Date.now()}`,
        description: '这是一个V2.0独立群发任务测试',
        schedule_time: new Date(Date.now() + 3600000).toISOString(),
        recipient_rule: {
          type: 'specific',
          contact_ids: [testContact.id]
        },
        template_set_id: testTemplateSet.id,
        sender_id: testSender.id,
        email_service_id: testEmailService.id
      };

      const response = await apiClient.post('/tasks', taskData);
      
      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveProperty('id');
      expect(response.data.data.name).toBe(taskData.name);
      expect(response.data.data.description).toBe(taskData.description);
      expect(response.data.data.status).toBe('draft');
      expect(response.data.data.recipient_rule.type).toBe('specific');
      expect(response.data.data.recipient_rule.contact_ids).toContain(testContact.id);
      
      createdTasks.push(response.data.data);
      console.log('✅ V2.0独立任务创建成功:', response.data.data.name);
    });

    test('应该验证必需字段', async () => {
      const incompleteTaskData = {
        name: '不完整的任务',
        // 缺少必需字段
      };

      const response = await apiClient.post('/tasks', incompleteTaskData);
      
      expect(response.status).toBe(400);
      expect(response.data.success).toBe(false);
      
      console.log('✅ 必需字段验证正常');
    });

    test('应该验证发信人权限', async () => {
      const taskData = {
        name: `权限测试任务-${Date.now()}`,
        schedule_time: new Date(Date.now() + 3600000).toISOString(),
        recipient_rule: {
          type: 'specific',
          contact_ids: [testContact.id]
        },
        template_set_id: testTemplateSet.id,
        sender_id: '00000000-0000-0000-0000-000000000000', // 不存在的发信人
        email_service_id: testEmailService.id
      };

      const response = await apiClient.post('/tasks', taskData);
      
      expect(response.status).toBe(404);
      expect(response.data.success).toBe(false);
      
      console.log('✅ 发信人权限验证正常');
    });
  });

  describe('🎯 V2.0任务管理测试', () => {
    let testTask;

    beforeEach(async () => {
      // 创建测试任务
      const taskData = {
        name: `管理测试任务-${Date.now()}`,
        description: '用于管理功能测试的任务',
        schedule_time: new Date(Date.now() + 3600000).toISOString(),
        recipient_rule: {
          type: 'specific',
          contact_ids: [testContact.id]
        },
        template_set_id: testTemplateSet.id,
        sender_id: testSender.id,
        email_service_id: testEmailService.id
      };

      const response = await apiClient.post('/tasks', taskData);
      testTask = response.data.data;
      createdTasks.push(testTask);
    });

    test('应该能获取任务列表', async () => {
      const response = await apiClient.get('/tasks');
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveProperty('items');
      expect(Array.isArray(response.data.data.items)).toBe(true);
      expect(response.data.data.items.length).toBeGreaterThan(0);
      
      // 验证我们创建的任务在列表中
      const foundTask = response.data.data.items.find(task => task.id === testTask.id);
      expect(foundTask).toBeTruthy();
      expect(foundTask.name).toBe(testTask.name);
      
      console.log('✅ 任务列表获取成功，任务数量:', response.data.data.items.length);
    });

    test('应该能获取单个任务详情', async () => {
      const response = await apiClient.get(`/tasks/${testTask.id}`);
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.id).toBe(testTask.id);
      expect(response.data.data.name).toBe(testTask.name);
      expect(response.data.data).toHaveProperty('sender');
      expect(response.data.data).toHaveProperty('email_service');
      expect(response.data.data).toHaveProperty('template_set');
      
      console.log('✅ 任务详情获取成功');
    });

    test('应该能更新任务状态', async () => {
      const response = await apiClient.patch(`/tasks/${testTask.id}/status`, {
        status: 'scheduled'
      });
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.status).toBe('scheduled');
      
      console.log('✅ 任务状态更新成功');
    });

    test('应该能获取任务统计', async () => {
      const response = await apiClient.get('/tasks/stats');
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveProperty('total_tasks');
      expect(response.data.data).toHaveProperty('by_status');
      expect(response.data.data.total_tasks).toBeGreaterThan(0);
      
      console.log('✅ 任务统计获取成功:', response.data.data);
    });
  });

  describe('🎯 V2.0 SubTask测试', () => {
    let testTask;

    beforeEach(async () => {
      // 创建并调度任务以生成SubTask
      const taskData = {
        name: `SubTask测试任务-${Date.now()}`,
        description: '用于SubTask测试的任务',
        schedule_time: new Date(Date.now() + 1000).toISOString(), // 1秒后
        recipient_rule: {
          type: 'specific',
          contact_ids: [testContact.id]
        },
        template_set_id: testTemplateSet.id,
        sender_id: testSender.id,
        email_service_id: testEmailService.id
      };

      const createResponse = await apiClient.post('/tasks', taskData);
      testTask = createResponse.data.data;
      createdTasks.push(testTask);

      // 调度任务以生成SubTask
      await apiClient.patch(`/tasks/${testTask.id}/status`, {
        status: 'scheduled'
      });

      // 等待SubTask生成
      await new Promise(resolve => setTimeout(resolve, 2000));
    });

    test('应该能获取任务的SubTask列表', async () => {
      const response = await apiClient.get(`/tasks/${testTask.id}/subtasks`);
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveProperty('items');
      expect(Array.isArray(response.data.data.items)).toBe(true);
      
      if (response.data.data.items.length > 0) {
        const subTask = response.data.data.items[0];
        expect(subTask).toHaveProperty('id');
        expect(subTask).toHaveProperty('task_id');
        expect(subTask).toHaveProperty('status');
        expect(subTask).toHaveProperty('sender_email');
        expect(subTask).toHaveProperty('recipient_email');
        expect(subTask).toHaveProperty('rendered_subject');
        expect(subTask.task_id).toBe(testTask.id);
        
        console.log('✅ SubTask列表获取成功，SubTask数量:', response.data.data.items.length);
      } else {
        console.log('⚠️ 未生成SubTask，可能需要检查生成逻辑');
      }
    });
  });

  describe('🎯 V2.0额度集成测试', () => {
    test('任务创建应该验证用户额度', async () => {
      // 先获取当前额度
      const quotaResponse = await apiClient.get('/users-v2/quota');
      expect(quotaResponse.status).toBe(200);
      
      const currentQuota = quotaResponse.data.data.remaining_quota;
      console.log('✅ 当前用户额度:', currentQuota);
      
      // 创建任务（会验证额度）
      const taskData = {
        name: `额度测试任务-${Date.now()}`,
        schedule_time: new Date(Date.now() + 3600000).toISOString(),
        recipient_rule: {
          type: 'specific',
          contact_ids: [testContact.id]
        },
        template_set_id: testTemplateSet.id,
        sender_id: testSender.id,
        email_service_id: testEmailService.id
      };

      const response = await apiClient.post('/tasks', taskData);
      
      if (currentQuota > 0) {
        expect(response.status).toBe(201);
        createdTasks.push(response.data.data);
        console.log('✅ 额度充足，任务创建成功');
      } else {
        expect(response.status).toBe(400);
        console.log('✅ 额度不足，任务创建被拒绝');
      }
    });
  });

  describe('🎯 V2.0收件人规则测试', () => {
    test('应该支持指定联系人规则', async () => {
      const taskData = {
        name: `指定联系人测试-${Date.now()}`,
        schedule_time: new Date(Date.now() + 3600000).toISOString(),
        recipient_rule: {
          type: 'specific',
          contact_ids: [testContact.id]
        },
        template_set_id: testTemplateSet.id,
        sender_id: testSender.id,
        email_service_id: testEmailService.id
      };

      const response = await apiClient.post('/tasks', taskData);
      
      expect(response.status).toBe(201);
      expect(response.data.data.recipient_rule.type).toBe('specific');
      expect(response.data.data.recipient_rule.contact_ids).toContain(testContact.id);
      
      createdTasks.push(response.data.data);
      console.log('✅ 指定联系人规则测试通过');
    });

    test('应该支持标签筛选规则', async () => {
      const taskData = {
        name: `标签筛选测试-${Date.now()}`,
        schedule_time: new Date(Date.now() + 3600000).toISOString(),
        recipient_rule: {
          type: 'tag_based',
          include_tags: ['test-tag'],
          exclude_tags: ['exclude-tag']
        },
        template_set_id: testTemplateSet.id,
        sender_id: testSender.id,
        email_service_id: testEmailService.id
      };

      const response = await apiClient.post('/tasks', taskData);
      
      expect(response.status).toBe(201);
      expect(response.data.data.recipient_rule.type).toBe('tag_based');
      expect(response.data.data.recipient_rule.include_tags).toContain('test-tag');
      
      createdTasks.push(response.data.data);
      console.log('✅ 标签筛选规则测试通过');
    });

    test('应该支持全部联系人规则', async () => {
      const taskData = {
        name: `全部联系人测试-${Date.now()}`,
        schedule_time: new Date(Date.now() + 3600000).toISOString(),
        recipient_rule: {
          type: 'all_contacts'
        },
        template_set_id: testTemplateSet.id,
        sender_id: testSender.id,
        email_service_id: testEmailService.id
      };

      const response = await apiClient.post('/tasks', taskData);
      
      expect(response.status).toBe(201);
      expect(response.data.data.recipient_rule.type).toBe('all_contacts');
      
      createdTasks.push(response.data.data);
      console.log('✅ 全部联系人规则测试通过');
    });
  });
}); 