/**
 * V2.0 发信人管理功能测试 (F14)
 * 核心功能：创建、删除发信人，格式验证
 */
const request = require('supertest');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const { app } = require('../../src/index'); // 解构导入
const { User, EmailService, UserServiceMapping, Sender } = require('../../src/models');
const { setupTestDB, cleanupTestDB, createTestUser, getAuthToken } = require('../helpers/testHelper');

describe('V2.0 发信人管理功能测试', () => {
  let adminToken;
  let userToken;
  let testUser;
  let testSenderId;

  beforeAll(async () => {
    await setupTestDB();
    
    // 创建管理员用户
    const adminUser = await createTestUser({ role: 'admin' });
    adminToken = await getAuthToken(adminUser);
    
    // 创建普通用户
    testUser = await createTestUser({ role: 'read_only' });
    userToken = await getAuthToken(testUser);
  });

  afterAll(async () => {
    await cleanupTestDB();
  });

  afterEach(async () => {
    // 清理测试数据
    await Sender.destroy({ where: {}, force: true });
    await EmailService.destroy({ where: {}, force: true });
    await UserServiceMapping.destroy({ where: {}, force: true });
  });

  describe('POST /api/senders - 创建发信人', () => {
    const validSenderData = {
      name: 'testsender',
      display_name: '测试发信人'
    };

    it('应该成功创建符合格式规范的发信人', async () => {
      const response = await request(app)
        .post('/api/senders')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validSenderData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(validSenderData.name);
      expect(response.body.data.display_name).toBe(validSenderData.display_name);
      expect(response.body.data.user_id).toBe(testUser.id);
      
      testSenderId = response.body.data.id;
      
      // 验证UUID格式
      expect(testSenderId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('应该验证发信人名称格式 - 只允许字母数字点划线下划线', async () => {
      const validNames = ['test123', 'test.sender', 'test-sender', 'test_sender', 'TestSender123'];
      
      for (const name of validNames) {
        const response = await request(app)
          .post('/api/senders')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ ...validSenderData, name })
          .expect(201);
          
        expect(response.body.success).toBe(true);
        
        // 清理创建的发信人
        await Sender.destroy({ where: { id: response.body.data.id } });
      }
    });

    it('应该拒绝不符合格式的发信人名称', async () => {
      const invalidNames = ['test@sender', 'test sender', 'test+sender', 'test#sender', '测试发信人'];
      
      for (const name of invalidNames) {
        const response = await request(app)
          .post('/api/senders')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ ...validSenderData, name })
          .expect(400);
          
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('格式');
      }
    });

    it('应该检查发信人名称唯一性（同用户下）', async () => {
      // 创建第一个发信人
      await request(app)
        .post('/api/senders')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validSenderData)
        .expect(201);

      // 尝试创建同名发信人
      const response = await request(app)
        .post('/api/senders')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validSenderData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('已存在');
    });

    it('不同用户可以创建同名发信人', async () => {
      // 第一个用户创建发信人
      await request(app)
        .post('/api/senders')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validSenderData)
        .expect(201);

      // 第二个用户创建同名发信人
      const response = await request(app)
        .post('/api/senders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validSenderData)
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('未认证用户应该被拒绝', async () => {
      await request(app)
        .post('/api/senders')
        .send(validSenderData)
        .expect(401);
    });

    it('缺少必需字段应该返回400错误', async () => {
      const incompleteData = { display_name: '测试发信人' }; // 缺少name字段

      const response = await request(app)
        .post('/api/senders')
        .set('Authorization', `Bearer ${userToken}`)
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('name');
    });
  });

  describe('GET /api/senders - 获取发信人列表', () => {
    beforeEach(async () => {
      // 创建测试发信人
      const sender1 = await Sender.create({
        name: 'sender1',
        display_name: '发信人1',
        user_id: testUser.id
      });

      const sender2 = await Sender.create({
        name: 'sender2',
        display_name: '发信人2',
        user_id: testUser.id
      });

      testSenderId = sender1.id;
    });

    it('应该返回用户的发信人列表', async () => {
      const response = await request(app)
        .get('/api/senders')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(2);
      
      // 验证数据结构
      const sender = response.body.data[0];
      expect(sender).toHaveProperty('id');
      expect(sender).toHaveProperty('name');
      expect(sender).toHaveProperty('display_name');
      expect(sender).toHaveProperty('user_id');
      expect(sender.user_id).toBe(testUser.id);
    });

    it('应该支持分页查询', async () => {
      const response = await request(app)
        .get('/api/senders?page=1&limit=1')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(1);
      expect(response.body.pagination.total).toBe(2);
    });

    it('应该支持名称搜索', async () => {
      const response = await request(app)
        .get('/api/senders?search=sender1')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].name).toBe('sender1');
    });
  });

  describe('PUT /api/senders/:id - 更新发信人', () => {
    beforeEach(async () => {
      const sender = await Sender.create({
        name: 'originalsender',
        display_name: '原始发信人',
        user_id: testUser.id
      });
      testSenderId = sender.id;
    });

    it('应该成功更新发信人信息', async () => {
      const updateData = {
        name: 'updatedsender',
        display_name: '更新后的发信人'
      };

      const response = await request(app)
        .put(`/api/senders/${testSenderId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.display_name).toBe(updateData.display_name);
    });

    it('更新时应该验证名称格式', async () => {
      const response = await request(app)
        .put(`/api/senders/${testSenderId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'invalid@name' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('格式');
    });

    it('用户不能更新其他用户的发信人', async () => {
      // 创建其他用户的发信人
      const otherUser = await createTestUser();
      const otherSender = await Sender.create({
        name: 'othersender',
        display_name: '其他用户发信人',
        user_id: otherUser.id
      });

      const response = await request(app)
        .put(`/api/senders/${otherSender.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ display_name: '尝试更新' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/senders/:id - 删除发信人', () => {
    beforeEach(async () => {
      const sender = await Sender.create({
        name: 'deletesender',
        display_name: '待删除发信人',
        user_id: testUser.id
      });
      testSenderId = sender.id;
    });

    it('应该成功删除发信人', async () => {
      const response = await request(app)
        .delete(`/api/senders/${testSenderId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('删除成功');

      // 验证发信人已被删除
      const deletedSender = await Sender.findByPk(testSenderId);
      expect(deletedSender).toBeNull();
    });

    it('用户不能删除其他用户的发信人', async () => {
      const otherUser = await createTestUser();
      const otherSender = await Sender.create({
        name: 'otherdeletesender',
        display_name: '其他用户待删除发信人',
        user_id: otherUser.id
      });

      const response = await request(app)
        .delete(`/api/senders/${otherSender.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      
      // 验证发信人未被删除
      const stillExists = await Sender.findByPk(otherSender.id);
      expect(stillExists).not.toBeNull();
    });

    it('删除不存在的发信人应该返回404', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      
      const response = await request(app)
        .delete(`/api/senders/${nonExistentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('发信人名称格式验证详细测试', () => {
    const testCases = [
      // 有效格式
      { name: 'abc', valid: true, desc: '纯字母' },
      { name: '123', valid: true, desc: '纯数字' },
      { name: 'abc123', valid: true, desc: '字母数字组合' },
      { name: 'test.sender', valid: true, desc: '包含点号' },
      { name: 'test-sender', valid: true, desc: '包含横线' },
      { name: 'test_sender', valid: true, desc: '包含下划线' },
      { name: 'Test.Sender-123_ABC', valid: true, desc: '复杂有效组合' },
      
      // 无效格式
      { name: 'test@sender', valid: false, desc: '包含@符号' },
      { name: 'test sender', valid: false, desc: '包含空格' },
      { name: 'test+sender', valid: false, desc: '包含加号' },
      { name: 'test#sender', valid: false, desc: '包含井号' },
      { name: 'test%sender', valid: false, desc: '包含百分号' },
      { name: 'test&sender', valid: false, desc: '包含and符号' },
      { name: 'test*sender', valid: false, desc: '包含星号' },
      { name: 'test(sender)', valid: false, desc: '包含括号' },
      { name: 'test[sender]', valid: false, desc: '包含方括号' },
      { name: 'test{sender}', valid: false, desc: '包含花括号' },
      { name: 'test/sender', valid: false, desc: '包含斜杠' },
      { name: 'test\\sender', valid: false, desc: '包含反斜杠' },
      { name: '测试发信人', valid: false, desc: '包含中文' },
      { name: '', valid: false, desc: '空字符串' },
      { name: '.sender', valid: false, desc: '以点号开头' },
      { name: 'sender.', valid: false, desc: '以点号结尾' },
    ];

    testCases.forEach(({ name, valid, desc }) => {
      it(`${desc}: "${name}" 应该${valid ? '通过' : '失败'}`, async () => {
        const response = await request(app)
          .post('/api/senders')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ name, display_name: '测试发信人' });

        if (valid) {
          expect(response.status).toBe(201);
          expect(response.body.success).toBe(true);
          
          // 清理创建的发信人
          if (response.body.data && response.body.data.id) {
            await Sender.destroy({ where: { id: response.body.data.id } });
          }
        } else {
          expect(response.status).toBe(400);
          expect(response.body.success).toBe(false);
        }
      });
    });
  });

  // 助手函数
  async function createTestUser(overrides = {}) {
    const defaultUserData = {
      id: uuidv4(),
      username: `testuser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@example.com`,
      password_hash: await bcrypt.hash('password123', 10),
      role: 'operator',
      ...overrides
    };
    
    return await User.create(defaultUserData);
  }
}); 