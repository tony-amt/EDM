const axios = require('axios');
const { setupDB, teardownDB, getToken, API_URL } = require('./setup');

let token;
let testVariableId;
const testVariableKey = 'test_var_' + Date.now(); // 确保唯一性

describe('EmailVariable API测试', () => {
  beforeAll(async () => {
    await setupDB();
    // 获取认证令牌（假设是管理员令牌）
    token = await getToken();
  });

  afterAll(async () => {
    await teardownDB();
  });

  // 测试创建邮件变量
  test('创建邮件变量', async () => {
    const response = await axios.post(
      `${API_URL}/templates/variables`,
      {
        variable_key: testVariableKey,
        display_name: '测试变量',
        description: '这是一个测试变量',
        source_type: 'CONTACT_FIELD',
        source_details: {
          field_name: 'email'
        },
        is_system_defined: false
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    expect(response.status).toBe(201);
    expect(response.data).toHaveProperty('id');
    expect(response.data.variable_key).toBe(testVariableKey);
    expect(response.data.display_name).toBe('测试变量');
    expect(response.data.source_type).toBe('CONTACT_FIELD');
    expect(response.data.source_details).toHaveProperty('field_name', 'email');

    // 保存ID用于后续测试
    testVariableId = response.data.id;
  });

  // 测试获取变量列表
  test('获取变量列表', async () => {
    const response = await axios.get(
      `${API_URL}/templates/variables`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('items');
    expect(Array.isArray(response.data.items)).toBe(true);
    expect(response.data.items.length).toBeGreaterThan(0);
    
    // 验证刚创建的变量在列表中
    const foundVariable = response.data.items.find(v => v.id === testVariableId);
    expect(foundVariable).toBeTruthy();
    expect(foundVariable.variable_key).toBe(testVariableKey);
  });

  // 测试通过ID获取变量
  test('通过ID获取变量', async () => {
    const response = await axios.get(
      `${API_URL}/templates/variables/${testVariableId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    expect(response.status).toBe(200);
    expect(response.data.id).toBe(testVariableId);
    expect(response.data.variable_key).toBe(testVariableKey);
    expect(response.data.display_name).toBe('测试变量');
  });

  // 测试通过Key获取变量
  test('通过Key获取变量', async () => {
    const response = await axios.get(
      `${API_URL}/templates/variables/${testVariableKey}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    expect(response.status).toBe(200);
    expect(response.data.id).toBe(testVariableId);
    expect(response.data.variable_key).toBe(testVariableKey);
    expect(response.data.display_name).toBe('测试变量');
  });

  // 测试更新变量
  test('更新变量', async () => {
    const response = await axios.put(
      `${API_URL}/templates/variables/${testVariableId}`,
      {
        display_name: '更新后的变量名称',
        description: '更新后的描述',
        source_details: {
          field_name: 'username'
        }
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    expect(response.status).toBe(200);
    expect(response.data.id).toBe(testVariableId);
    expect(response.data.variable_key).toBe(testVariableKey); // 键不应改变
    expect(response.data.display_name).toBe('更新后的变量名称');
    expect(response.data.description).toBe('更新后的描述');
    expect(response.data.source_details).toHaveProperty('field_name', 'username');
  });

  // 测试删除变量
  test('删除变量', async () => {
    const response = await axios.delete(
      `${API_URL}/templates/variables/${testVariableId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('message');
  });
}); 