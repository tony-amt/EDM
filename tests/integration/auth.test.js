const axios = require('axios'); // 保留以防万一需要一个无token的原始客户端
const { 
  setupTestEnvironment, 
  teardownTestEnvironment, 
  // getTestUserApiClient, // 不再需要直接从这里导入并调用
  // getAdminApiClient, 
  API_URL // 可以保留用于构造不带token的请求，或者直接使用axios.create
} = require('./setup');
const db = require('../../src/backend/src/models');

let testUser, authToken, adminUser, adminAuthToken, apiClient, userApiClient;

// 测试套件
describe('认证模块集成测试', () => {
  beforeAll(async () => {
    const setupData = await setupTestEnvironment();
    testUser = setupData.testUser; // 普通用户
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

  // 清理可能存在的测试用户，以防上次测试中断
  beforeEach(async () => {
    try {
      // 注意：在 beforeAll 中，用户是以特定密码哈希创建的。
      // 如果这里的清理逻辑试图用明文密码登录并删除，则会失败。
      // 更安全的做法是直接通过 ID 删除（如果ID已知）或通过 email/username。
      // 或者，setupTestEnvironment 中的 force:true 应该已经处理了清理。
      // 为避免复杂性，暂时移除此处的特定用户清理，依赖 beforeAll 的 sync。
    } catch (error) {
      console.warn('清理旧测试用户时出错 (可忽略):', error.message);
    }
  });

  // 如果有注册功能，则添加测试
  // describe('用户注册功能', () => {
  //   test.skip('成功注册新用户', async () => {
  //     const newUser = {
  //       username: 'newsignup',
  //       email: 'newsignup@example.com',
  //       password: 'password123',
  //     };
  //     const response = await axios.post(`${API_URL}/auth/register`, newUser, { validateStatus: () => true });
  //     expect(response.status).toBe(201);
  //     expect(response.data.user).toHaveProperty('id');
  //     expect(response.data).toHaveProperty('token');
  //     // 可选: 检查数据库中是否真的创建了用户
  //     const dbUser = await db.User.findOne({ where: { email: newUser.email } });
  //     expect(dbUser).not.toBeNull();
  //   });
  // });

  describe('登录功能测试', () => {
    test('使用正确凭据登录应成功', async () => {
      const response = await apiClient.post('/auth/login', {
        usernameOrEmail: testUser.email,
        password: 'testpassword' // Assuming 'testpassword' was used to create this user in setup
      });
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.token).toBeDefined();
      // Controller returns user info under 'data' key
      expect(response.data.data).toBeDefined(); 
      expect(response.data.data.email).toBe(testUser.email);
      expect(response.data.data.id).toBe(testUser.id);
    });

    test('使用错误密码登录应失败', async () => {
      const response = await apiClient.post('/auth/login', {
        usernameOrEmail: testUser.email,
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
      // Use userApiClient which has the token for testUser
      const response = await userApiClient.get('/auth/me'); 
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      // Controller returns user info under 'data' key
      expect(response.data.data).toBeDefined();
      expect(response.data.data).toHaveProperty('id', testUser.id);
      expect(response.data.data.email).toBe(testUser.email);
      expect(response.data.data.role).toBe(testUser.role);
      expect(response.data.data).not.toHaveProperty('password_hash');
    });

    test('不带令牌应无法获取用户信息', async () => {
      // Use the basic apiClient without token
      const response = await apiClient.get('/auth/me');
      expect(response.status).toBe(401);
      expect(response.data.success).toBe(false);
    });
  });

  describe('修改密码功能', () => {
    test('使用有效的当前密码应能修改密码', async () => {
      const newPassword = 'newSecurePassword123';
      // Use userApiClient which has the token for testUser
      const response = await userApiClient.put('/auth/password', {
        currentPassword: 'testpassword', // Original password for testUser
        newPassword: newPassword
      });
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.message).toBe('密码修改成功');

      // Try to login with the new password
      const loginResponse = await apiClient.post('/auth/login', {
        usernameOrEmail: testUser.email,
        password: newPassword
      });
      expect(loginResponse.status).toBe(200);
      expect(loginResponse.data.success).toBe(true);
      expect(loginResponse.data.token).toBeDefined();

      // Change password back to original for subsequent tests if any (or rely on full teardown/setup)
      await userApiClient.put('/auth/password', {
        currentPassword: newPassword,
        newPassword: 'testpassword' 
      });
    });

    test('使用错误的当前密码应无法修改密码', async () => {
      const response = await userApiClient.put('/auth/password', {
        currentPassword: 'wrongoldpassword',
        newPassword: 'somenewpassword'
      });
      expect(response.status).toBe(400); // Controller returns 400 for wrong current password
      expect(response.data.success).toBe(false);
      expect(response.data.error.message).toBe('当前密码错误');
    });
  });

  // 可以添加 refreshToken, logout 等测试
}); 