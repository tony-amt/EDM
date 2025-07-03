const axios = require('axios');
const { setupDB, teardownDB, getToken, API_URL } = require('./setup');

let token;
let testCampaignId;
let testTagId;
let testTemplateId;

describe('Campaign API测试', () => {
  beforeAll(async () => {
    await setupDB();
    // 获取认证令牌
    token = await getToken();
    
    // 创建测试标签
    const tagResponse = await axios.post(
      `${API_URL}/tags`,
      {
        name: '测试活动标签',
        color: '#FF5500'
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    testTagId = tagResponse.data.id;
    
    // 创建测试模板
    const templateResponse = await axios.post(
      `${API_URL}/templates`,
      {
        name: '测试活动模板',
        subject: '测试邮件主题',
        body: '<div>测试邮件内容</div>'
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    testTemplateId = templateResponse.data.id;
  });

  afterAll(async () => {
    // 清理测试数据
    try {
      if (testTagId) {
        await axios.delete(`${API_URL}/tags/${testTagId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      if (testTemplateId) {
        await axios.delete(`${API_URL}/templates/${testTemplateId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (error) {
      console.error('清理测试数据失败', error);
    }
    
    await teardownDB();
  });

  // 测试创建活动
  test('创建活动', async () => {
    const response = await axios.post(
      `${API_URL}/campaigns`,
      {
        name: '测试营销活动',
        description: '这是一个测试营销活动',
        status: 'draft',
        target_tags: [testTagId],
        template_id: testTemplateId
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    expect(response.status).toBe(201);
    expect(response.data).toHaveProperty('id');
    expect(response.data.name).toBe('测试营销活动');
    expect(response.data.status).toBe('draft');
    expect(response.data.target_tags).toContain(testTagId);
    expect(response.data.template_id).toBe(testTemplateId);

    // 保存ID用于后续测试
    testCampaignId = response.data.id;
  });

  // 测试获取活动列表
  test('获取活动列表', async () => {
    const response = await axios.get(
      `${API_URL}/campaigns`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('items');
    expect(Array.isArray(response.data.items)).toBe(true);
    expect(response.data.items.length).toBeGreaterThan(0);
    
    // 验证刚创建的活动在列表中
    const foundCampaign = response.data.items.find(campaign => campaign.id === testCampaignId);
    expect(foundCampaign).toBeTruthy();
    expect(foundCampaign.name).toBe('测试营销活动');
  });

  // 测试获取单个活动
  test('获取单个活动', async () => {
    const response = await axios.get(
      `${API_URL}/campaigns/${testCampaignId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    expect(response.status).toBe(200);
    expect(response.data.id).toBe(testCampaignId);
    expect(response.data.name).toBe('测试营销活动');
    expect(response.data.target_tags).toContain(testTagId);
    expect(response.data.template_id).toBe(testTemplateId);
  });

  // 测试更新活动
  test('更新活动', async () => {
    const response = await axios.put(
      `${API_URL}/campaigns/${testCampaignId}`,
      {
        name: '更新后的活动名称',
        description: '更新后的活动描述',
        status: 'active'
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    expect(response.status).toBe(200);
    expect(response.data.id).toBe(testCampaignId);
    expect(response.data.name).toBe('更新后的活动名称');
    expect(response.data.description).toBe('更新后的活动描述');
    expect(response.data.status).toBe('active');
  });

  // 测试活动状态更新
  test('更新活动状态', async () => {
    const response = await axios.patch(
      `${API_URL}/campaigns/${testCampaignId}/status`,
      {
        status: 'paused'
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    expect(response.status).toBe(200);
    expect(response.data.id).toBe(testCampaignId);
    expect(response.data.status).toBe('paused');
  });

  // 测试获取活动统计
  test('获取活动统计', async () => {
    const response = await axios.get(
      `${API_URL}/campaigns/${testCampaignId}/stats`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('total_sent');
    expect(response.data).toHaveProperty('opened');
    expect(response.data).toHaveProperty('clicked');
    expect(response.data).toHaveProperty('bounced');
  });

  // 测试删除活动
  test('删除活动', async () => {
    const response = await axios.delete(
      `${API_URL}/campaigns/${testCampaignId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('message');

    // 验证活动已删除
    try {
      await axios.get(`${API_URL}/campaigns/${testCampaignId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // 如果获取成功，则测试失败
      fail('活动应该已被删除');
    } catch (error) {
      expect(error.response.status).toBe(404);
    }
  });
}); 