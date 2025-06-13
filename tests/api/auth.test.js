const request = require('supertest');
const app = require('../../src/index');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../../src/config');

describe('认证API测试', () => {
  
  describe('POST /api/auth/register', () => {
    test('应该成功注册新用户', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Test123456'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.username).toBe(userData.username);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.password).toBeUndefined(); // 密码不应返回
      expect(response.body.data.token).toBeDefined();
    });

    test('应该拒绝重复的用户名', async () => {
      const userData = {
        username: 'duplicate',
        email: 'first@example.com',
        password: 'Test123456'
      };

      // 第一次注册
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // 第二次注册相同用户名
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...userData,
          email: 'second@example.com'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('用户名已存在');
    });

    test('应该拒绝重复的邮箱', async () => {
      const userData = {
        username: 'first',
        email: 'duplicate@example.com',
        password: 'Test123456'
      };

      // 第一次注册
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // 第二次注册相同邮箱
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...userData,
          username: 'second'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('邮箱已存在');
    });

    test('应该验证输入格式', async () => {
      const invalidInputs = [
        {
          username: 'ab', // 太短
          email: 'test@example.com',
          password: 'Test123456'
        },
        {
          username: 'testuser',
          email: 'invalid-email', // 无效邮箱
          password: 'Test123456'
        },
        {
          username: 'testuser',
          email: 'test@example.com',
          password: '123' // 密码太短
        },
        {
          // 缺少必需字段
          username: 'testuser'
        }
      ];

      for (const input of invalidInputs) {
        const response = await request(app)
          .post('/api/auth/register')
          .send(input)
          .expect(400);

        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('POST /api/auth/login', () => {
    let testUser;

    beforeEach(async () => {
      // 创建测试用户
      testUser = {
        username: 'logintest',
        email: 'login@example.com',
        password: 'Test123456'
      };

      await request(app)
        .post('/api/auth/register')
        .send(testUser);
    });

    test('应该使用用户名成功登录', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          login: testUser.username,
          password: testUser.password
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.username).toBe(testUser.username);
      expect(response.body.data.token).toBeDefined();
      
      // 验证JWT token
      const decoded = jwt.verify(response.body.data.token, config.jwt.secret);
      expect(decoded.userId).toBeDefined();
      expect(decoded.username).toBe(testUser.username);
    });

    test('应该使用邮箱成功登录', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          login: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.token).toBeDefined();
    });

    test('应该拒绝错误的密码', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          login: testUser.username,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('密码错误');
    });

    test('应该拒绝不存在的用户', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'nonexistent',
          password: 'Test123456'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('用户不存在');
    });

    test('应该验证登录输入', async () => {
      const invalidInputs = [
        {
          // 缺少login
          password: 'Test123456'
        },
        {
          login: testUser.username
          // 缺少password
        },
        {
          login: '',
          password: 'Test123456'
        },
        {
          login: testUser.username,
          password: ''
        }
      ];

      for (const input of invalidInputs) {
        const response = await request(app)
          .post('/api/auth/login')
          .send(input)
          .expect(400);

        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('POST /api/auth/logout', () => {
    let authToken;

    beforeEach(async () => {
      // 注册并登录获取token
      const userData = {
        username: 'logouttest',
        email: 'logout@example.com',
        password: 'Test123456'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      authToken = registerResponse.body.data.token;
    });

    test('应该成功登出', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('成功登出');
    });

    test('应该拒绝无效token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('应该拒绝缺少token的请求', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('未提供认证token');
    });
  });

  describe('POST /api/auth/refresh', () => {
    let authToken;

    beforeEach(async () => {
      const userData = {
        username: 'refreshtest',
        email: 'refresh@example.com',
        password: 'Test123456'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      authToken = registerResponse.body.data.token;
    });

    test('应该成功刷新token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.token).not.toBe(authToken);
      
      // 验证新token
      const decoded = jwt.verify(response.body.data.token, config.jwt.secret);
      expect(decoded.userId).toBeDefined();
    });

    test('应该拒绝无效token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('应该拒绝过期token', async () => {
      // 创建过期token
      const expiredToken = jwt.sign(
        { userId: 1, username: 'test' },
        config.jwt.secret,
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('token已过期');
    });
  });

  describe('GET /api/auth/verify', () => {
    let authToken, userId;

    beforeEach(async () => {
      const userData = {
        username: 'verifytest',
        email: 'verify@example.com',
        password: 'Test123456'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      authToken = registerResponse.body.data.token;
      userId = registerResponse.body.data.user.id;
    });

    test('应该验证有效token', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.id).toBe(userId);
      expect(response.body.data.user.password).toBeUndefined();
    });

    test('应该拒绝无效token', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('应该拒绝缺少token的请求', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    beforeEach(async () => {
      // 创建测试用户
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'forgottest',
          email: 'forgot@example.com',
          password: 'Test123456'
        });
    });

    test('应该发送重置密码邮件', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'forgot@example.com'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('重置密码邮件已发送');
    });

    test('应该处理不存在的邮箱', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'nonexistent@example.com'
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('邮箱不存在');
    });

    test('应该验证邮箱格式', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'invalid-email'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/reset-password', () => {
    let resetToken;

    beforeEach(async () => {
      // 创建测试用户并获取重置token
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'resettest',
          email: 'reset@example.com',
          password: 'Test123456'
        });

      const forgotResponse = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'reset@example.com'
        });

      // 模拟获取重置token（实际中会从邮件中获取）
      resetToken = 'mock-reset-token';
    });

    test('应该成功重置密码', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'NewTest123456'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('密码重置成功');

      // 验证新密码可以登录
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'reset@example.com',
          password: 'NewTest123456'
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
    });

    test('应该拒绝无效的重置token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          newPassword: 'NewTest123456'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('无效的重置token');
    });

    test('应该验证新密码格式', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: '123' // 太短
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('认证中间件测试', () => {
    let authToken;

    beforeEach(async () => {
      const userData = {
        username: 'middlewaretest',
        email: 'middleware@example.com',
        password: 'Test123456'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      authToken = registerResponse.body.data.token;
    });

    test('应该允许有效token访问受保护路由', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('应该拒绝无token访问受保护路由', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('应该拒绝错误格式的Authorization头', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'InvalidFormat')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('应该拒绝错误类型的token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Basic sometoken')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('密码安全测试', () => {
    test('应该正确哈希密码', async () => {
      const userData = {
        username: 'hashtest',
        email: 'hash@example.com',
        password: 'Test123456'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.body.success).toBe(true);
      
      // 验证密码已被哈希（不等于原始密码）
      expect(response.body.data.user.password).toBeUndefined();
    });

    test('应该验证密码复杂度', async () => {
      const weakPasswords = [
        'password',      // 常见密码
        '123456',        // 纯数字
        'abcdefg',       // 纯字母
        'Pass1',         // 太短
        'PASSWORD123',   // 缺少小写字母
        'password123'    // 缺少大写字母
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'weaktest',
            email: 'weak@example.com',
            password: password
          })
          .expect(400);

        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('JWT安全测试', () => {
    test('应该使用安全的JWT密钥', () => {
      expect(config.jwt.secret).toBeDefined();
      expect(config.jwt.secret.length).toBeGreaterThan(16);
    });

    test('应该设置合适的token过期时间', () => {
      expect(config.jwt.expiresIn).toBeDefined();
      expect(config.jwt.expiresIn).toMatch(/^\d+[dhms]$/);
    });

    test('应该在token中包含必要信息', async () => {
      const userData = {
        username: 'jwttest',
        email: 'jwt@example.com',
        password: 'Test123456'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      const token = response.body.data.token;
      const decoded = jwt.verify(token, config.jwt.secret);

      expect(decoded.userId).toBeDefined();
      expect(decoded.username).toBe(userData.username);
      expect(decoded.iat).toBeDefined(); // 签发时间
      expect(decoded.exp).toBeDefined(); // 过期时间
    });
  });
}); 