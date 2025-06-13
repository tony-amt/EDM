const request = require('supertest');
const app = require('../../src/index');

describe('群发管理API测试', () => {
  let authToken, userId;

  beforeEach(async () => {
    // 注册并登录获取认证token
    const userData = {
      username: 'campaigntest',
      email: 'campaign@example.com',
      password: 'Test123456'
    };

    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(userData);

    authToken = registerResponse.body.data.token;
    userId = registerResponse.body.data.user.id;
  });

  describe('POST /api/campaigns', () => {
    test('应该成功创建群发任务', async () => {
      const campaignData = {
        name: '测试群发任务',
        subject: '测试邮件主题',
        content: '<h1>测试邮件内容</h1>',
        templateId: null,
        scheduledAt: new Date(Date.now() + 3600000).toISOString(), // 1小时后
        priority: 'normal',
        settings: {
          trackOpens: true,
          trackClicks: true,
          unsubscribeLink: true
        }
      };

      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send(campaignData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.campaign).toBeDefined();
      expect(response.body.data.campaign.name).toBe(campaignData.name);
      expect(response.body.data.campaign.subject).toBe(campaignData.subject);
      expect(response.body.data.campaign.status).toBe('draft');
      expect(response.body.data.campaign.userId).toBe(userId);
    });

    test('应该验证必需字段', async () => {
      const invalidInputs = [
        {
          // 缺少name
          subject: '测试主题',
          content: '测试内容'
        },
        {
          name: '测试任务',
          // 缺少subject
          content: '测试内容'
        },
        {
          name: '测试任务',
          subject: '测试主题'
          // 缺少content
        }
      ];

      for (const input of invalidInputs) {
        const response = await request(app)
          .post('/api/campaigns')
          .set('Authorization', `Bearer ${authToken}`)
          .send(input)
          .expect(400);

        expect(response.body.success).toBe(false);
      }
    });

    test('应该验证优先级枚举', async () => {
      const campaignData = {
        name: '测试群发任务',
        subject: '测试主题',
        content: '测试内容',
        priority: 'invalid_priority'
      };

      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send(campaignData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('应该验证计划发送时间', async () => {
      const campaignData = {
        name: '测试群发任务',
        subject: '测试主题',
        content: '测试内容',
        scheduledAt: new Date(Date.now() - 3600000).toISOString() // 1小时前
      };

      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send(campaignData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('计划发送时间不能早于当前时间');
    });

    test('应该拒绝未认证的请求', async () => {
      const campaignData = {
        name: '测试群发任务',
        subject: '测试主题',
        content: '测试内容'
      };

      const response = await request(app)
        .post('/api/campaigns')
        .send(campaignData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/campaigns', () => {
    let campaign1, campaign2;

    beforeEach(async () => {
      // 创建测试群发任务
      const campaignData1 = {
        name: '群发任务1',
        subject: '主题1',
        content: '内容1'
      };

      const campaignData2 = {
        name: '群发任务2',
        subject: '主题2',
        content: '内容2',
        status: 'scheduled'
      };

      const response1 = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send(campaignData1);

      const response2 = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send(campaignData2);

      campaign1 = response1.body.data.campaign;
      campaign2 = response2.body.data.campaign;
    });

    test('应该获取用户的群发任务列表', async () => {
      const response = await request(app)
        .get('/api/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.campaigns).toBeDefined();
      expect(Array.isArray(response.body.data.campaigns)).toBe(true);
      expect(response.body.data.campaigns.length).toBeGreaterThanOrEqual(2);
      
      // 验证返回的任务都属于当前用户
      response.body.data.campaigns.forEach(campaign => {
        expect(campaign.userId).toBe(userId);
      });
    });

    test('应该支持分页查询', async () => {
      const response = await request(app)
        .get('/api/campaigns?page=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.campaigns.length).toBe(1);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.currentPage).toBe(1);
      expect(response.body.data.pagination.limit).toBe(1);
      expect(response.body.data.pagination.total).toBeGreaterThanOrEqual(2);
    });

    test('应该支持状态筛选', async () => {
      const response = await request(app)
        .get('/api/campaigns?status=draft')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.campaigns.forEach(campaign => {
        expect(campaign.status).toBe('draft');
      });
    });

    test('应该支持关键词搜索', async () => {
      const response = await request(app)
        .get('/api/campaigns?search=群发任务1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.campaigns.length).toBeGreaterThan(0);
      expect(response.body.data.campaigns[0].name).toContain('群发任务1');
    });

    test('应该按创建时间排序', async () => {
      const response = await request(app)
        .get('/api/campaigns?sortBy=createdAt&sortOrder=desc')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const campaigns = response.body.data.campaigns;
      
      for (let i = 1; i < campaigns.length; i++) {
        const prev = new Date(campaigns[i - 1].createdAt);
        const curr = new Date(campaigns[i].createdAt);
        expect(prev.getTime()).toBeGreaterThanOrEqual(curr.getTime());
      }
    });
  });

  describe('GET /api/campaigns/:id', () => {
    let campaignId;

    beforeEach(async () => {
      const campaignData = {
        name: '详情测试任务',
        subject: '详情测试主题',
        content: '详情测试内容',
        settings: {
          trackOpens: true,
          trackClicks: false
        }
      };

      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send(campaignData);

      campaignId = response.body.data.campaign.id;
    });

    test('应该获取群发任务详情', async () => {
      const response = await request(app)
        .get(`/api/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.campaign).toBeDefined();
      expect(response.body.data.campaign.id).toBe(campaignId);
      expect(response.body.data.campaign.name).toBe('详情测试任务');
      expect(response.body.data.campaign.settings).toBeDefined();
    });

    test('应该拒绝访问他人的群发任务', async () => {
      // 创建另一个用户
      const otherUserData = {
        username: 'otheruser',
        email: 'other@example.com',
        password: 'Test123456'
      };

      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send(otherUserData);

      const otherAuthToken = otherUserResponse.body.data.token;

      const response = await request(app)
        .get(`/api/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${otherAuthToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('无权访问');
    });

    test('应该处理不存在的群发任务ID', async () => {
      const response = await request(app)
        .get('/api/campaigns/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('群发任务不存在');
    });
  });

  describe('PUT /api/campaigns/:id', () => {
    let campaignId;

    beforeEach(async () => {
      const campaignData = {
        name: '更新测试任务',
        subject: '更新测试主题',
        content: '更新测试内容'
      };

      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send(campaignData);

      campaignId = response.body.data.campaign.id;
    });

    test('应该成功更新草稿状态的群发任务', async () => {
      const updateData = {
        name: '已更新的任务名称',
        subject: '已更新的主题',
        content: '已更新的内容',
        priority: 'high'
      };

      const response = await request(app)
        .put(`/api/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.campaign.name).toBe(updateData.name);
      expect(response.body.data.campaign.subject).toBe(updateData.subject);
      expect(response.body.data.campaign.priority).toBe(updateData.priority);
    });

    test('应该拒绝更新已发送的群发任务', async () => {
      // 先将任务状态设为已发送
      await request(app)
        .put(`/api/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'sent' });

      const updateData = {
        name: '尝试更新已发送任务'
      };

      const response = await request(app)
        .put(`/api/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('已发送的任务不能修改');
    });

    test('应该验证更新数据的有效性', async () => {
      const invalidData = {
        priority: 'invalid_priority'
      };

      const response = await request(app)
        .put(`/api/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('应该拒绝更新他人的群发任务', async () => {
      // 创建另一个用户
      const otherUserData = {
        username: 'updateother',
        email: 'updateother@example.com',
        password: 'Test123456'
      };

      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send(otherUserData);

      const otherAuthToken = otherUserResponse.body.data.token;

      const updateData = {
        name: '尝试更新他人任务'
      };

      const response = await request(app)
        .put(`/api/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${otherAuthToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/campaigns/:id', () => {
    let campaignId;

    beforeEach(async () => {
      const campaignData = {
        name: '删除测试任务',
        subject: '删除测试主题',
        content: '删除测试内容'
      };

      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send(campaignData);

      campaignId = response.body.data.campaign.id;
    });

    test('应该成功删除草稿状态的群发任务', async () => {
      const response = await request(app)
        .delete(`/api/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('删除成功');

      // 验证任务已被删除
      const getResponse = await request(app)
        .get(`/api/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(getResponse.body.success).toBe(false);
    });

    test('应该拒绝删除正在发送的群发任务', async () => {
      // 先将任务状态设为正在发送
      await request(app)
        .put(`/api/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'sending' });

      const response = await request(app)
        .delete(`/api/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('正在发送的任务不能删除');
    });

    test('应该拒绝删除他人的群发任务', async () => {
      // 创建另一个用户
      const otherUserData = {
        username: 'deleteother',
        email: 'deleteother@example.com',
        password: 'Test123456'
      };

      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send(otherUserData);

      const otherAuthToken = otherUserResponse.body.data.token;

      const response = await request(app)
        .delete(`/api/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${otherAuthToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/campaigns/:id/start', () => {
    let campaignId;

    beforeEach(async () => {
      const campaignData = {
        name: '启动测试任务',
        subject: '启动测试主题',
        content: '启动测试内容'
      };

      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send(campaignData);

      campaignId = response.body.data.campaign.id;
    });

    test('应该成功启动群发任务', async () => {
      const response = await request(app)
        .post(`/api/campaigns/${campaignId}/start`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('群发任务已启动');

      // 验证任务状态已更新
      const getResponse = await request(app)
        .get(`/api/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.body.data.campaign.status).toBe('sending');
    });

    test('应该拒绝启动已发送的群发任务', async () => {
      // 先将任务状态设为已发送
      await request(app)
        .put(`/api/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'sent' });

      const response = await request(app)
        .post(`/api/campaigns/${campaignId}/start`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('任务状态不允许启动');
    });

    test('应该验证群发任务的完整性', async () => {
      // 创建一个不完整的任务
      const incompleteData = {
        name: '不完整任务',
        subject: '测试主题'
        // 缺少内容
      };

      const incompleteResponse = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send(incompleteData);

      if (incompleteResponse.status === 201) {
        const incompleteId = incompleteResponse.body.data.campaign.id;

        const response = await request(app)
          .post(`/api/campaigns/${incompleteId}/start`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('任务信息不完整');
      }
    });
  });

  describe('POST /api/campaigns/:id/pause', () => {
    let campaignId;

    beforeEach(async () => {
      const campaignData = {
        name: '暂停测试任务',
        subject: '暂停测试主题',
        content: '暂停测试内容'
      };

      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send(campaignData);

      campaignId = response.body.data.campaign.id;

      // 启动任务
      await request(app)
        .post(`/api/campaigns/${campaignId}/start`)
        .set('Authorization', `Bearer ${authToken}`);
    });

    test('应该成功暂停发送中的群发任务', async () => {
      const response = await request(app)
        .post(`/api/campaigns/${campaignId}/pause`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('群发任务已暂停');

      // 验证任务状态已更新
      const getResponse = await request(app)
        .get(`/api/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.body.data.campaign.status).toBe('paused');
    });

    test('应该拒绝暂停非发送状态的群发任务', async () => {
      // 创建一个草稿状态的任务
      const draftData = {
        name: '草稿任务',
        subject: '草稿主题',
        content: '草稿内容'
      };

      const draftResponse = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send(draftData);

      const draftId = draftResponse.body.data.campaign.id;

      const response = await request(app)
        .post(`/api/campaigns/${draftId}/pause`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('只能暂停发送中的任务');
    });
  });

  describe('POST /api/campaigns/:id/stop', () => {
    let campaignId;

    beforeEach(async () => {
      const campaignData = {
        name: '停止测试任务',
        subject: '停止测试主题',
        content: '停止测试内容'
      };

      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send(campaignData);

      campaignId = response.body.data.campaign.id;

      // 启动任务
      await request(app)
        .post(`/api/campaigns/${campaignId}/start`)
        .set('Authorization', `Bearer ${authToken}`);
    });

    test('应该成功停止群发任务', async () => {
      const response = await request(app)
        .post(`/api/campaigns/${campaignId}/stop`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('群发任务已停止');

      // 验证任务状态已更新
      const getResponse = await request(app)
        .get(`/api/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.body.data.campaign.status).toBe('cancelled');
    });

    test('应该提供停止原因', async () => {
      const stopData = {
        reason: '用户主动停止'
      };

      const response = await request(app)
        .post(`/api/campaigns/${campaignId}/stop`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(stopData)
        .expect(200);

      expect(response.body.success).toBe(true);

      // 验证停止原因已记录
      const getResponse = await request(app)
        .get(`/api/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.body.data.campaign.cancelReason).toBe(stopData.reason);
    });
  });

  describe('GET /api/campaigns/:id/statistics', () => {
    let campaignId;

    beforeEach(async () => {
      const campaignData = {
        name: '统计测试任务',
        subject: '统计测试主题',
        content: '统计测试内容'
      };

      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send(campaignData);

      campaignId = response.body.data.campaign.id;
    });

    test('应该获取群发任务统计信息', async () => {
      const response = await request(app)
        .get(`/api/campaigns/${campaignId}/statistics`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.statistics).toBeDefined();
      
      const stats = response.body.data.statistics;
      expect(stats.totalRecipients).toBeDefined();
      expect(stats.sentCount).toBeDefined();
      expect(stats.failedCount).toBeDefined();
      expect(stats.openCount).toBeDefined();
      expect(stats.clickCount).toBeDefined();
      expect(stats.unsubscribeCount).toBeDefined();
      expect(stats.bounceCount).toBeDefined();
      
      // 验证统计数据的数值类型
      expect(typeof stats.totalRecipients).toBe('number');
      expect(typeof stats.sentCount).toBe('number');
      expect(typeof stats.failedCount).toBe('number');
    });

    test('应该计算正确的发送率和打开率', async () => {
      const response = await request(app)
        .get(`/api/campaigns/${campaignId}/statistics`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const stats = response.body.data.statistics;
      
      if (stats.totalRecipients > 0) {
        expect(stats.deliveryRate).toBeDefined();
        expect(stats.deliveryRate).toBeGreaterThanOrEqual(0);
        expect(stats.deliveryRate).toBeLessThanOrEqual(100);
      }

      if (stats.sentCount > 0) {
        expect(stats.openRate).toBeDefined();
        expect(stats.clickRate).toBeDefined();
        expect(stats.openRate).toBeGreaterThanOrEqual(0);
        expect(stats.openRate).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('POST /api/campaigns/:id/duplicate', () => {
    let campaignId;

    beforeEach(async () => {
      const campaignData = {
        name: '复制测试任务',
        subject: '复制测试主题',
        content: '复制测试内容',
        settings: {
          trackOpens: true,
          trackClicks: false
        }
      };

      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send(campaignData);

      campaignId = response.body.data.campaign.id;
    });

    test('应该成功复制群发任务', async () => {
      const response = await request(app)
        .post(`/api/campaigns/${campaignId}/duplicate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.campaign).toBeDefined();
      
      const duplicatedCampaign = response.body.data.campaign;
      expect(duplicatedCampaign.name).toContain('复制');
      expect(duplicatedCampaign.subject).toBe('复制测试主题');
      expect(duplicatedCampaign.content).toBe('复制测试内容');
      expect(duplicatedCampaign.status).toBe('draft');
      expect(duplicatedCampaign.userId).toBe(userId);
      expect(duplicatedCampaign.id).not.toBe(campaignId);
    });

    test('应该复制群发任务的设置', async () => {
      const response = await request(app)
        .post(`/api/campaigns/${campaignId}/duplicate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      const duplicatedCampaign = response.body.data.campaign;
      expect(duplicatedCampaign.settings).toBeDefined();
      expect(duplicatedCampaign.settings.trackOpens).toBe(true);
      expect(duplicatedCampaign.settings.trackClicks).toBe(false);
    });

    test('应该重置复制任务的统计信息', async () => {
      const response = await request(app)
        .post(`/api/campaigns/${campaignId}/duplicate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      const duplicatedId = response.body.data.campaign.id;
      
      const statsResponse = await request(app)
        .get(`/api/campaigns/${duplicatedId}/statistics`)
        .set('Authorization', `Bearer ${authToken}`);

      const stats = statsResponse.body.data.statistics;
      expect(stats.sentCount).toBe(0);
      expect(stats.openCount).toBe(0);
      expect(stats.clickCount).toBe(0);
    });
  });

  describe('群发任务权限验证', () => {
    test('应该拒绝未认证用户的所有操作', async () => {
      const endpoints = [
        { method: 'get', path: '/api/campaigns' },
        { method: 'post', path: '/api/campaigns' },
        { method: 'get', path: '/api/campaigns/1' },
        { method: 'put', path: '/api/campaigns/1' },
        { method: 'delete', path: '/api/campaigns/1' },
        { method: 'post', path: '/api/campaigns/1/start' },
        { method: 'post', path: '/api/campaigns/1/pause' },
        { method: 'post', path: '/api/campaigns/1/stop' }
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path)
          .send({})
          .expect(401);

        expect(response.body.success).toBe(false);
      }
    });

    test('应该正确处理用户角色权限', async () => {
      // 测试普通用户权限
      const normalUserData = {
        username: 'normaluser',
        email: 'normal@example.com',
        password: 'Test123456'
      };

      const normalUserResponse = await request(app)
        .post('/api/auth/register')
        .send(normalUserData);

      const normalToken = normalUserResponse.body.data.token;

      // 普通用户应该能创建群发任务
      const campaignData = {
        name: '普通用户任务',
        subject: '普通用户主题',
        content: '普通用户内容'
      };

      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${normalToken}`)
        .send(campaignData)
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });
}); 