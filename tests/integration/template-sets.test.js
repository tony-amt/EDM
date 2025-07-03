const axios = require('axios');
const { setupDB, teardownDB, getToken, API_URL } = require('./setup');

let token;
let testTemplateId;
let testTemplateSetId;

describe('TemplateSet API测试', () => {
  beforeAll(async () => {
    await setupDB();
    // 获取认证令牌
    token = await getToken();
    
    // 创建一个测试模板供模板集使用
    const templateResponse = await axios.post(
      `${API_URL}/templates`,
      {
        name: '测试模板集用模板',
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
    await teardownDB();
  });

  // 测试创建模板集
  test('创建模板集', async () => {
    const response = await axios.post(
      `${API_URL}/template-sets`,
      {
        name: '测试模板集',
        items: [
          {
            template_id: testTemplateId,
            order: 1
          }
        ]
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    expect(response.status).toBe(201);
    expect(response.data).toHaveProperty('id');
    expect(response.data.name).toBe('测试模板集');
    expect(response.data.items).toHaveLength(1);
    expect(response.data.items[0].template_id).toBe(testTemplateId);
    expect(response.data.items[0].order).toBe(1);

    // 保存ID用于后续测试
    testTemplateSetId = response.data.id;
  });

  // 测试获取模板集列表
  test('获取模板集列表', async () => {
    const response = await axios.get(
      `${API_URL}/template-sets`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('items');
    expect(Array.isArray(response.data.items)).toBe(true);
    expect(response.data.items.length).toBeGreaterThan(0);
    
    // 验证刚创建的模板集在列表中
    const foundTemplateSet = response.data.items.find(set => set.id === testTemplateSetId);
    expect(foundTemplateSet).toBeTruthy();
    expect(foundTemplateSet.name).toBe('测试模板集');
  });

  // 测试获取单个模板集
  test('获取单个模板集', async () => {
    const response = await axios.get(
      `${API_URL}/template-sets/${testTemplateSetId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    expect(response.status).toBe(200);
    expect(response.data.id).toBe(testTemplateSetId);
    expect(response.data.name).toBe('测试模板集');
    expect(response.data.items).toHaveLength(1);
    expect(response.data.items[0].template_id).toBe(testTemplateId);
  });

  // 测试更新模板集
  test('更新模板集', async () => {
    const response = await axios.put(
      `${API_URL}/template-sets/${testTemplateSetId}`,
      {
        name: '更新后的模板集名称',
        items: [
          {
            template_id: testTemplateId,
            order: 10 // 更新顺序
          }
        ]
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    expect(response.status).toBe(200);
    expect(response.data.id).toBe(testTemplateSetId);
    expect(response.data.name).toBe('更新后的模板集名称');
    expect(response.data.items).toHaveLength(1);
    expect(response.data.items[0].order).toBe(10);
  });

  // 测试删除模板集
  test('删除模板集', async () => {
    const response = await axios.delete(
      `${API_URL}/template-sets/${testTemplateSetId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('message');
  });
}); 