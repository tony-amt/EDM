const axios = require('axios');
const { 
  setupTestEnvironment, 
  teardownTestEnvironment, 
  API_URL
} = require('./setup-docker');

let testUser, authToken, adminUser, adminAuthToken, apiClient, userApiClient;

// 测试套件
describe('认证模块集成测试 (Docker环境)', () => {
  beforeAll(async () => {
    const setupData = await setupTestEnvironment();
    testUser = setupData.testUser; // 普通用户 (实际是admin)
    adminUser = setupData.adminUser; // 管理员用户
    authToken = setupData.authToken; // 普通用户的token
    adminAuthToken = setupData.adminAuthToken; // 管理员的token

    // apiClient for general requests, might not need specific auth initially
    apiClient = axios.create({ baseURL: API_URL, validateStatus: () => true });

    // userApiClient with testUser's token
    userApiClient = axios.create({
        baseURL: API_URL,
        validateStatus: () => true,
        headers: { 'Authorization': `Bearer ${authToken}` }
    });
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  describe('登录功能测试', () => {
    test('使用admin凭据登录应成功', async () => {
      const response = await apiClient.post('/auth/login', {
        usernameOrEmail: 'admin',
        password: 'admin123456'
      });
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.token).toBeDefined();
      expect(response.data.data).toBeDefined(); 
      expect(response.data.data.username).toBe('admin');
    });

    test('使用错误密码登录应失败', async () => {
      const response = await apiClient.post('/auth/login', {
        usernameOrEmail: 'admin',
        password: 'wrongpassword'
      });
      expect(response.status).toBe(401);
      expect(response.data.success).toBe(false);
    });

    test('使用不存在的用户名/邮箱登录应失败', async () => {
      const response = await apiClient.post('/auth/login', {
        usernameOrEmail: 'nonexistent@example.com',
        password: 'anypassword'
      });
      expect(response.status).toBe(401);
      expect(response.data.success).toBe(false);
    });
  });

  describe('获取当前用户信息', () => {
    test('使用有效令牌应能获取当前用户信息', async () => {
      const response = await userApiClient.get('/auth/me'); 
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toBeDefined();
      expect(response.data.data).toHaveProperty('id');
      expect(response.data.data.username).toBe('admin');
      expect(response.data.data).not.toHaveProperty('password_hash');
    });

    test('不带令牌应无法获取用户信息', async () => {
      const response = await apiClient.get('/auth/me');
      expect(response.status).toBe(401);
      expect(response.data.success).toBe(false);
    });
  });

  describe('健康检查', () => {
    test('API健康检查应正常', async () => {
      const response = await axios.get('http://localhost:3000/health');
      expect(response.status).toBe(200);
      expect(response.data.status).toBe('ok');
      expect(response.data.database).toBe('healthy');
    });
  });
}); 