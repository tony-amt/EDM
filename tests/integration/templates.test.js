const axios = require('axios');
const { setupDB, teardownDB, getToken, API_URL } = require('./setup');

let token;
let testTemplateId;

describe('Template API测试', () => {
  beforeAll(async () => {
    await setupDB();
    // 获取认证令牌
    token = await getToken();
  });

  afterAll(async () => {
    await teardownDB();
  });

  // 测试创建模板
  test('创建邮件模板', async () => {
    const response = await axios.post(
      `${API_URL}/templates`,
      {
        name: '测试模板',
        subject: '测试邮件主题 {{contact.nickname}}',
        body: '<div>尊敬的 {{contact.nickname}}，您好！</div><div>这是一封测试邮件。</div>'
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    expect(response.status).toBe(201);
    expect(response.data).toHaveProperty('id');
    expect(response.data.name).toBe('测试模板');
    expect(response.data.subject).toBe('测试邮件主题 {{contact.nickname}}');

    // 保存ID用于后续测试
    testTemplateId = response.data.id;
  });

  // 测试获取模板列表
  test('获取模板列表', async () => {
    const response = await axios.get(
      `${API_URL}/templates`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('items');
    expect(Array.isArray(response.data.items)).toBe(true);
    expect(response.data.items.length).toBeGreaterThan(0);
  });

  // 测试获取单个模板
  test('获取单个模板', async () => {
    const response = await axios.get(
      `${API_URL}/templates/${testTemplateId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    expect(response.status).toBe(200);
    expect(response.data.id).toBe(testTemplateId);
    expect(response.data.name).toBe('测试模板');
    expect(response.data.subject).toBe('测试邮件主题 {{contact.nickname}}');
    expect(response.data.body).toContain('尊敬的 {{contact.nickname}}');
  });

  // 测试更新模板
  test('更新模板', async () => {
    const response = await axios.put(
      `${API_URL}/templates/${testTemplateId}`,
      {
        name: '更新后的模板名称',
        subject: '更新后的邮件主题 {{contact.nickname}}'
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    expect(response.status).toBe(200);
    expect(response.data.id).toBe(testTemplateId);
    expect(response.data.name).toBe('更新后的模板名称');
    expect(response.data.subject).toBe('更新后的邮件主题 {{contact.nickname}}');
  });

  // 测试预览模板
  test('预览模板', async () => {
    const response = await axios.post(
      `${API_URL}/templates/preview`,
      {
        template_id: testTemplateId,
        sample_contact_data: {
          nickname: '张三',
          email: 'zhangsan@example.com'
        },
        sample_system_data: {
          unsubscribe_link: '#unsubscribe-preview',
          view_in_browser_link: '#view-in-browser-preview'
        }
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('rendered_subject');
    expect(response.data).toHaveProperty('rendered_body');
    expect(response.data.rendered_subject).toContain('张三');
    expect(response.data.rendered_body).toContain('张三');
  });

  // 测试删除模板
  test('删除模板', async () => {
    const response = await axios.delete(
      `${API_URL}/templates/${testTemplateId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('message');
  });
}); 