const request = require('supertest');
const app = require('../../src/backend/src/index');

describe('用户管理集成测试', () => {
  let adminToken;
  let createdUserId;
  let emailServiceId;

  beforeAll(async () => {
    // 管理员登录获取token
    const adminResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: 'admin123456'
      });
    
    adminToken = adminResponse.body.token;
    
    // 创建一个邮件服务用于后续关联
    const serviceResponse = await request(app)
      .post('/api/email-services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: '测试邮件服务',
        provider: 'engagelab',
        domain: 'test.example.com',
        api_key: 'test_api_user',
        api_secret: 'test_api_key',
        daily_quota: 1000,
        sending_rate: 60,
        quota_reset_time: '00:00:00'
      });
    
    emailServiceId = serviceResponse.body.data.id;
  });

  afterAll(async () => {
    // 清理测试数据
    if (createdUserId) {
      await request(app)
        .delete(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
    
    if (emailServiceId) {
      await request(app)
        .delete(`/api/email-services/${emailServiceId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
  });

  describe('1. 创建用户', () => {
    it('应该成功创建用户', async () => {
      const userData = {
        username: 'testuser001',
        email: 'testuser001@example.com',
        password: 'TestPassword123!',
        role: 'user',
        initialQuota: 500
      };

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.username).toBe(userData.username);
      expect(response.body.data.email).toBe(userData.email);
      expect(response.body.data.role).toBe(userData.role);
      
      createdUserId = response.body.data.id;
    });

    it('邮箱为可选字段，用户名必填', async () => {
      // 测试没有邮箱的用户创建
      const userDataWithoutEmail = {
        username: 'testuser002',
        password: 'TestPassword123!',
        role: 'user',
        initialQuota: 500
      };

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(userDataWithoutEmail);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(null);
      
      // 清理
      await request(app)
        .delete(`/api/users/${response.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // 测试没有用户名的情况
      const userDataWithoutUsername = {
        email: 'testuser003@example.com',
        password: 'TestPassword123!',
        role: 'user',
        initialQuota: 500
      };

      const response2 = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(userDataWithoutUsername);

      expect(response2.status).toBe(400);
    });
  });

  describe('2. 编辑用户（修改密码）', () => {
    it('应该成功更新用户信息和密码', async () => {
      const updateData = {
        username: 'testuser001_updated',
        email: 'updated@example.com',
        password: 'NewPassword123!',
        role: 'user'
      };

      const response = await request(app)
        .put(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.username).toBe(updateData.username);
      expect(response.body.data.email).toBe(updateData.email);

      // 验证密码已更新 - 尝试用新密码登录
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: updateData.username,
          password: updateData.password
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);
    });
  });

  describe('3. 额度管理 - 增加额度', () => {
    it('应该成功增加用户额度', async () => {
      const quotaData = {
        operation: 'add',
        amount: 200,
        reason: '测试增加额度'
      };

      const response = await request(app)
        .patch(`/api/users/${createdUserId}/quota`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(quotaData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.remainingQuota).toBe(700); // 500 + 200
    });
  });

  describe('4. 额度管理 - 降低额度', () => {
    it('应该成功减少用户额度', async () => {
      const quotaData = {
        operation: 'subtract',
        amount: 100,
        reason: '测试减少额度'
      };

      const response = await request(app)
        .patch(`/api/users/${createdUserId}/quota`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(quotaData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.remainingQuota).toBe(600); // 700 - 100
    });
  });

  describe('5. 服务关联 - 关联可用的发信服务', () => {
    it('应该成功关联用户与邮件服务', async () => {
      const associationData = {
        serviceIds: [emailServiceId]
      };

      const response = await request(app)
        .put(`/api/users/${createdUserId}/services`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(associationData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // 验证关联结果
      const userResponse = await request(app)
        .get(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(userResponse.body.data.serviceIds).toContain(emailServiceId);
    });

    it('应该能够获取用户的服务关联信息', async () => {
      const response = await request(app)
        .get(`/api/users/${createdUserId}/services`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.services).toHaveLength(1);
      expect(response.body.data.services[0].id).toBe(emailServiceId);
    });
  });

  describe('6. 禁用用户', () => {
    it('应该成功禁用用户', async () => {
      const response = await request(app)
        .patch(`/api/users/${createdUserId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'inactive'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('inactive');

      // 验证禁用的用户无法登录
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser001_updated',
          password: 'NewPassword123!'
        });

      expect(loginResponse.status).toBe(403);
      expect(loginResponse.body.message).toContain('账户已被禁用');
    });

    it('应该能够重新启用用户', async () => {
      const response = await request(app)
        .patch(`/api/users/${createdUserId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'active'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('active');

      // 验证重新启用的用户可以登录
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser001_updated',
          password: 'NewPassword123!'
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);
    });
  });

  describe('7. 验证数据完整性', () => {
    it('用户信息应该正确保存到数据库', async () => {
      const response = await request(app)
        .get(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const userData = response.body.data;
      expect(userData.id).toBe(createdUserId);
      expect(userData.username).toBe('testuser001_updated');
      expect(userData.email).toBe('updated@example.com');
      expect(userData.role).toBe('user');
      expect(userData.status).toBe('active');
      expect(userData.remainingQuota).toBe(600);
      expect(userData.serviceIds).toContain(emailServiceId);
      expect(userData).toHaveProperty('createdAt');
      expect(userData).toHaveProperty('updatedAt');
    });

    it('用户额度历史记录应该正确记录', async () => {
      const response = await request(app)
        .get(`/api/users/${createdUserId}/quota-history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      
      // 应该包含增加和减少额度的记录
      const addRecord = response.body.data.find(r => r.operation === 'add');
      const subtractRecord = response.body.data.find(r => r.operation === 'subtract');
      
      expect(addRecord).toBeDefined();
      expect(addRecord.amount).toBe(200);
      expect(subtractRecord).toBeDefined();
      expect(subtractRecord.amount).toBe(100);
    });
  });

  describe('8. 错误处理测试', () => {
    it('应该正确处理重复用户名', async () => {
      const duplicateUserData = {
        username: 'testuser001_updated', // 与已存在用户重复
        password: 'TestPassword123!',
        role: 'user'
      };

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(duplicateUserData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('用户名已存在');
    });

    it('应该正确处理无效的额度操作', async () => {
      const invalidQuotaData = {
        operation: 'subtract',
        amount: 1000, // 超过当前额度
        reason: '测试无效减少额度'
      };

      const response = await request(app)
        .patch(`/api/users/${createdUserId}/quota`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidQuotaData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('额度不足');
    });

    it('应该正确处理不存在的服务关联', async () => {
      const nonExistentServiceId = '00000000-0000-0000-0000-000000000000';
      const associationData = {
        serviceIds: [nonExistentServiceId]
      };

      const response = await request(app)
        .put(`/api/users/${createdUserId}/services`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(associationData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('服务不存在');
    });
  });
}); 