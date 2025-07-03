/**
 * V2.0 EmailService集成测试
 * 测试发信服务管理的完整功能
 */
const request = require('supertest');
const { app } = require('../../src/index');
const { EmailService, UserServiceMapping, User } = require('../../src/models');
const { setupTestDB, cleanupTestDB, createTestUser, getAuthToken } = require('../helpers/testHelper');

describe('EmailService Routes', () => {
  let adminToken, userToken, testServiceId;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await cleanupTestDB();
  });

  beforeEach(async () => {
    // 每个测试前重新创建用户和token，确保token新鲜
    const adminUser = await createTestUser({ role: 'admin' });
    adminToken = await getAuthToken(adminUser);
    
    const normalUser = await createTestUser({ role: 'read_only' });
    userToken = await getAuthToken(normalUser);
  });

  afterEach(async () => {
    // 清理测试数据
    await EmailService.destroy({ where: {}, force: true });
    await UserServiceMapping.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true }); // 清理用户数据
  });

  describe('GET /api/email-services', () => {
    it('应该返回空的发信服务列表', async () => {
      const response = await request(app)
        .get('/api/email-services')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
      expect(response.body.pagination.total).toBe(0);
    });

    it('普通用户应该能查看发信服务列表', async () => {
      const response = await request(app)
        .get('/api/email-services')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('未认证用户应该被拒绝访问', async () => {
      await request(app)
        .get('/api/email-services')
        .expect(401);
    });
  });

  describe('POST /api/email-services', () => {
    const validServiceData = {
      name: '测试发信服务',
      provider: 'smtp',
      api_key: 'test_api_key_123',
      api_secret: 'test_api_secret_456',
      domain: 'test.com',
      daily_quota: 1000
    };

    it('管理员应该能成功创建发信服务', async () => {
      const response = await request(app)
        .post('/api/email-services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validServiceData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(validServiceData.name);
      expect(response.body.data.domain).toBe(validServiceData.domain);
      
      testServiceId = response.body.data.id;
    });

    it('普通用户不应该能创建发信服务', async () => {
      await request(app)
        .post('/api/email-services')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validServiceData)
        .expect(403);
    });

    it('缺少必需字段应该返回400错误', async () => {
      const invalidData = { ...validServiceData };
      delete invalidData.domain;

      const response = await request(app)
        .post('/api/email-services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('domain');
    });
  });

  describe('PUT /api/email-services/:id', () => {
    beforeEach(async () => {
      const service = await EmailService.create({
        name: '原始服务',
        provider: 'smtp',
        api_key: 'test_api_key',
        api_secret: 'test_api_secret',
        domain: 'original.com',
        daily_quota: 500
      });
      testServiceId = service.id;
    });

    it('管理员应该能更新发信服务', async () => {
      const updateData = {
        name: '更新后的服务',
        daily_quota: 2000
      };

      const response = await request(app)
        .put(`/api/email-services/${testServiceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.daily_quota).toBe(updateData.daily_quota);
    });

    it('普通用户不应该能更新发信服务', async () => {
      await request(app)
        .put(`/api/email-services/${testServiceId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: '尝试更新' })
        .expect(403);
    });
  });

  describe('DELETE /api/email-services/:id', () => {
    beforeEach(async () => {
      const service = await EmailService.create({
        name: '待删除服务',
        provider: 'smtp',
        api_key: 'delete_api_key',
        api_secret: 'delete_api_secret',
        domain: 'delete.com',
        daily_quota: 500
      });
      testServiceId = service.id;
    });

    it('管理员应该能删除没有关联的发信服务', async () => {
      const response = await request(app)
        .delete(`/api/email-services/${testServiceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('删除成功');
      
      // 验证服务已被删除
      const deletedService = await EmailService.findByPk(testServiceId);
      expect(deletedService).toBeNull();
    });

    it('不应该能删除有关联用户映射的发信服务', async () => {
      // 创建用户映射
      const normalUser = await createTestUser();
      await UserServiceMapping.create({
        user_id: normalUser.id,
        service_id: testServiceId,
        daily_quota: 100
      });

      const response = await request(app)
        .delete(`/api/email-services/${testServiceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('关联的用户映射');
    });
  });

  describe('POST /api/email-services/:id/test', () => {
    beforeEach(async () => {
      const service = await EmailService.create({
        name: '测试连通性服务',
        provider: 'smtp',
        api_key: 'test_connectivity_key',
        api_secret: 'test_connectivity_secret',
        domain: 'test.com',
        daily_quota: 500
      });
      testServiceId = service.id;
    });

    it('管理员应该能测试发信服务连通性', async () => {
      const response = await request(app)
        .post(`/api/email-services/${testServiceId}/test`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('连通性测试成功');
      expect(response.body.data.response_time).toBeGreaterThan(0);
    });

    it('测试不存在的服务应该返回404', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      
      await request(app)
        .post(`/api/email-services/${fakeId}/test`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });
}); 