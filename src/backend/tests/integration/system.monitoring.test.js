/**
 * V2.0 系统监控中心功能测试 (F23)
 * 核心功能：状态概览、统计数据、系统健康检查
 */
const request = require('supertest');
const { app } = require('../../src/index');
const { Task, SubTask, EmailService, User, UserServiceMapping, ServiceStatusLog, EventLog } = require('../../src/models');
const { setupTestDB, cleanupTestDB, createTestUser, getAuthToken } = require('../helpers/testHelper');

describe('V2.0 系统监控中心功能测试', () => {
  let adminToken;
  let userToken;
  let testUser;
  let testEmailService;

  beforeAll(async () => {
    await setupTestDB();
    
    // 创建管理员用户
    const adminUser = await createTestUser({ role: 'admin' });
    adminToken = await getAuthToken(adminUser);
    
    // 创建普通用户
    testUser = await createTestUser({ role: 'read_only', remaining_quota: 1000 });
    userToken = await getAuthToken(testUser);
  });

  afterAll(async () => {
    await cleanupTestDB();
  });

  beforeEach(async () => {
    // 创建测试发信服务
    testEmailService = await EmailService.create({
      name: '监控测试服务',
      provider: 'smtp',
      api_endpoint: 'smtp.monitor.com',
      domain: 'monitor.com',
      auth_config: { username: 'test', password: 'test' },
      daily_quota: 1000,
      used_quota: 150,
      status: 'active',
      is_enabled: true,
      is_frozen: false,
      last_health_check: new Date(),
      consecutive_failures: 0
    });

    await UserServiceMapping.create({
      user_id: testUser.id,
      service_id: testEmailService.id,
      daily_quota: 500,
      priority: 1
    });
  });

  afterEach(async () => {
    // 清理测试数据
    await SubTask.destroy({ where: {}, force: true });
    await Task.destroy({ where: {}, force: true });
    await UserServiceMapping.destroy({ where: {}, force: true });
    await EmailService.destroy({ where: {}, force: true });
  });

  describe('GET /api/monitor/dashboard - 系统概览仪表盘', () => {
    beforeEach(async () => {
      // 创建测试任务和子任务
      const task = await Task.create({
        name: '监控测试任务',
        user_id: testUser.id,
        status: 'sending',
        total_subtasks: 10,
        allocated_subtasks: 8,
        pending_subtasks: 2
      });

      // 创建各种状态的SubTask
      const subtaskData = [
        { status: 'pending', service_id: null },
        { status: 'pending', service_id: null },
        { status: 'allocated', service_id: testEmailService.id },
        { status: 'allocated', service_id: testEmailService.id },
        { status: 'sending', service_id: testEmailService.id },
        { status: 'sending', service_id: testEmailService.id },
        { status: 'sent', service_id: testEmailService.id },
        { status: 'delivered', service_id: testEmailService.id },
        { status: 'bounced', service_id: testEmailService.id },
        { status: 'failed', service_id: testEmailService.id }
      ].map((data, index) => ({
        ...data,
        task_id: task.id,
        contact_id: testUser.id, // 临时使用用户ID
        template_id: testUser.id, // 临时使用用户ID
        sender_email: 'test@monitor.com',
        recipient_email: `test${index}@example.com`,
        rendered_subject: '测试主题',
        rendered_body: '测试内容'
      }));

      await SubTask.bulkCreate(subtaskData);
    });

    it('管理员应该能获取完整系统概览', async () => {
      const response = await request(app)
        .get('/api/monitor/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data).toHaveProperty('services');
      expect(response.body.data).toHaveProperty('tasks');
      expect(response.body.data).toHaveProperty('performance');

      // 验证汇总数据结构
      const summary = response.body.data.summary;
      expect(summary).toHaveProperty('total_tasks');
      expect(summary).toHaveProperty('active_tasks');
      expect(summary).toHaveProperty('total_subtasks');
      expect(summary).toHaveProperty('pending_subtasks');
      expect(summary).toHaveProperty('allocated_subtasks');
      expect(summary).toHaveProperty('sent_subtasks');
      expect(summary).toHaveProperty('failed_subtasks');

      // 验证服务状态数据
      const services = response.body.data.services;
      expect(services).toHaveProperty('total_services');
      expect(services).toHaveProperty('active_services');
      expect(services).toHaveProperty('frozen_services');
      expect(services).toHaveProperty('services_health');
    });

    it('普通用户应该只能获取自己的数据概览', async () => {
      const response = await request(app)
        .get('/api/monitor/dashboard')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user_summary');
      expect(response.body.data).toHaveProperty('user_tasks');
      expect(response.body.data).toHaveProperty('user_quota');

      // 普通用户不应该看到系统级别的数据
      expect(response.body.data).not.toHaveProperty('services');
      expect(response.body.data).not.toHaveProperty('system_performance');
    });

    it('未认证用户应该被拒绝', async () => {
      await request(app)
        .get('/api/monitor/dashboard')
        .expect(401);
    });
  });

  describe('GET /api/monitor/services - 发信服务监控', () => {
    it('管理员应该能获取所有服务的详细状态', async () => {
      const response = await request(app)
        .get('/api/monitor/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      if (response.body.data.length > 0) {
        const service = response.body.data[0];
        expect(service).toHaveProperty('id');
        expect(service).toHaveProperty('name');
        expect(service).toHaveProperty('status');
        expect(service).toHaveProperty('daily_quota');
        expect(service).toHaveProperty('used_quota');
        expect(service).toHaveProperty('usage_percentage');
        expect(service).toHaveProperty('health_status');
        expect(service).toHaveProperty('last_health_check');
        expect(service).toHaveProperty('consecutive_failures');
      }
    });

    it('应该计算服务使用率', async () => {
      const response = await request(app)
        .get('/api/monitor/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const service = response.body.data.find(s => s.id === testEmailService.id);
      expect(service).toBeDefined();
      expect(service.usage_percentage).toBe(15); // 150/1000 = 15%
    });

    it('普通用户不应该能访问服务监控', async () => {
      await request(app)
        .get('/api/monitor/services')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('GET /api/monitor/tasks - 任务监控', () => {
    beforeEach(async () => {
      await Task.bulkCreate([
        {
          name: '任务1',
          user_id: testUser.id,
          status: 'sending',
          total_subtasks: 100,
          allocated_subtasks: 80,
          pending_subtasks: 20,
          created_at: new Date(Date.now() - 3600000) // 1小时前
        },
        {
          name: '任务2',
          user_id: testUser.id,
          status: 'completed',
          total_subtasks: 50,
          allocated_subtasks: 50,
          pending_subtasks: 0,
          created_at: new Date(Date.now() - 7200000) // 2小时前
        }
      ]);
    });

    it('管理员应该能获取所有任务监控数据', async () => {
      const response = await request(app)
        .get('/api/monitor/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);

      const task = response.body.data[0];
      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('name');
      expect(task).toHaveProperty('status');
      expect(task).toHaveProperty('progress');
      expect(task).toHaveProperty('created_at');
      expect(task).toHaveProperty('user_info');
    });

    it('应该计算任务进度', async () => {
      const response = await request(app)
        .get('/api/monitor/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const sendingTask = response.body.data.find(t => t.status === 'sending');
      expect(sendingTask).toBeDefined();
      expect(sendingTask.progress).toBe(80); // 80/100 = 80%
    });

    it('应该支持按状态筛选任务', async () => {
      const response = await request(app)
        .get('/api/monitor/tasks?status=sending')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(task => {
        expect(task.status).toBe('sending');
      });
    });

    it('普通用户应该只能查看自己的任务', async () => {
      const response = await request(app)
        .get('/api/monitor/tasks')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(task => {
        expect(task.user_id || task.user_info?.id).toBe(testUser.id);
      });
    });
  });

  describe('GET /api/monitor/stats - 系统统计数据', () => {
    it('管理员应该能获取系统级统计数据', async () => {
      const response = await request(app)
        .get('/api/monitor/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('today');
      expect(response.body.data).toHaveProperty('this_week');
      expect(response.body.data).toHaveProperty('this_month');

      // 验证今日统计数据结构
      const today = response.body.data.today;
      expect(today).toHaveProperty('tasks_created');
      expect(today).toHaveProperty('emails_sent');
      expect(today).toHaveProperty('emails_delivered');
      expect(today).toHaveProperty('emails_bounced');
      expect(today).toHaveProperty('emails_opened');
      expect(today).toHaveProperty('emails_clicked');
    });

    it('应该支持时间范围查询', async () => {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 7天前

      const response = await request(app)
        .get(`/api/monitor/stats?start_date=${startDate.toISOString()}&end_date=${endDate.toISOString()}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('custom_range');
    });

    it('普通用户不应该能访问系统统计', async () => {
      await request(app)
        .get('/api/monitor/stats')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('GET /api/monitor/health - 系统健康检查', () => {
    it('应该返回系统健康状态', async () => {
      const response = await request(app)
        .get('/api/monitor/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('components');

      // 验证组件健康状态
      const components = response.body.data.components;
      expect(components).toHaveProperty('database');
      expect(components).toHaveProperty('redis');
      expect(components).toHaveProperty('email_services');
      expect(components).toHaveProperty('scheduler');

      // 验证每个组件的状态结构
      expect(components.database).toHaveProperty('status');
      expect(components.database).toHaveProperty('response_time');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(components.database.status);
    });

    it('普通用户也应该能访问健康检查', async () => {
      const response = await request(app)
        .get('/api/monitor/health')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      // 普通用户获取的是简化版本
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('timestamp');
    });

    it('未认证用户应该能访问基本健康状态', async () => {
      const response = await request(app)
        .get('/api/monitor/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.data.status);
    });
  });

  describe('POST /api/monitor/services/:id/health-check - 手动健康检查', () => {
    it('管理员应该能触发服务健康检查', async () => {
      const response = await request(app)
        .post(`/api/monitor/services/${testEmailService.id}/health-check`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('service_id');
      expect(response.body.data).toHaveProperty('health_status');
      expect(response.body.data).toHaveProperty('check_time');
      expect(response.body.data).toHaveProperty('response_time');

      // 验证数据库中的健康检查记录已更新
      const updatedService = await EmailService.findByPk(testEmailService.id);
      expect(updatedService.last_health_check).toBeDefined();
    });

    it('普通用户不应该能触发健康检查', async () => {
      await request(app)
        .post(`/api/monitor/services/${testEmailService.id}/health-check`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('检查不存在的服务应该返回404', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      
      const response = await request(app)
        .post(`/api/monitor/services/${nonExistentId}/health-check`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });
}); 