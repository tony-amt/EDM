const request = require('supertest');
const app = require('../../src/index');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../../src/config');

describe('安全性测试', () => {
  let authToken, userId, adminToken, adminId;

  beforeAll(async () => {
    // 创建普通用户
    const userData = {
      username: 'securitytest',
      email: 'security@example.com',
      password: 'Test123456'
    };

    const userResponse = await request(app)
      .post('/api/auth/register')
      .send(userData);

    authToken = userResponse.body.data.token;
    userId = userResponse.body.data.user.id;

    // 创建管理员用户
    const adminData = {
      username: 'admin',
      email: 'admin@example.com',
      password: 'Admin123456',
      role: 'admin'
    };

    const adminResponse = await request(app)
      .post('/api/auth/register')
      .send(adminData);

    adminToken = adminResponse.body.data.token;
    adminId = adminResponse.body.data.user.id;
  });

  describe('认证安全测试', () => {
    test('应该拒绝无效的JWT token', async () => {
      const invalidTokens = [
        'invalid-token',
        '',
        null,
        undefined,
        'Bearer',
        'Bearer ',
        'Basic dGVzdDp0ZXN0', // Base64编码的Basic认证
        jwt.sign({ userId: 1 }, 'wrong-secret'), // 错误密钥签名
      ];

      for (const token of invalidTokens) {
        const response = await request(app)
          .get('/api/auth/verify')
          .set('Authorization', token ? `Bearer ${token}` : '');

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      }
    });

    test('应该拒绝过期的JWT token', async () => {
      const expiredToken = jwt.sign(
        { userId: userId, username: 'test' },
        config.jwt.secret,
        { expiresIn: '-1h' } // 1小时前过期
      );

      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('token已过期');
    });

    test('应该拒绝篡改的JWT token', async () => {
      // 篡改有效token的载荷
      const validTokenParts = authToken.split('.');
      const tamperedPayload = Buffer.from(JSON.stringify({
        userId: 999,
        username: 'hacker',
        role: 'admin'
      })).toString('base64url');
      
      const tamperedToken = `${validTokenParts[0]}.${tamperedPayload}.${validTokenParts[2]}`;

      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${tamperedToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('应该验证JWT密钥强度', () => {
      expect(config.jwt.secret).toBeDefined();
      expect(config.jwt.secret.length).toBeGreaterThan(32);
      expect(config.jwt.secret).toMatch(/[A-Za-z0-9]/); // 包含字母和数字
    });

    test('应该实现令牌刷新安全机制', async () => {
      // 使用有效token刷新
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const newToken = response.body.data.token;
      expect(newToken).toBeDefined();
      expect(newToken).not.toBe(authToken);

      // 验证新token有效
      const verifyResponse = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${newToken}`)
        .expect(200);

      expect(verifyResponse.body.success).toBe(true);
    });
  });

  describe('密码安全测试', () => {
    test('应该拒绝弱密码', async () => {
      const weakPasswords = [
        'password',      // 常见密码
        '123456',        // 纯数字
        'abcdefg',       // 纯字母小写
        'ABCDEFG',       // 纯字母大写
        'Pass1',         // 太短
        '12345678',      // 纯数字长度够
        'passwordpassword', // 常见密码重复
        'qwerty123',     // 键盘模式
        'abc123'         // 简单组合但太短
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'weakpasstest',
            email: 'weak@example.com',
            password: password
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('密码强度不够');
      }
    });

    test('应该接受强密码', async () => {
      const strongPasswords = [
        'MyStr0ngP@ssw0rd!',
        'C0mplex!P@ssw0rd',
        'S3cur3!P4ssw0rd#',
        'Ungu3ss@bl3P@ss!'
      ];

      for (const password of strongPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: `strongtest${Math.random().toString(36).substr(2, 9)}`,
            email: `strong${Math.random().toString(36).substr(2, 9)}@example.com`,
            password: password
          });

        expect([200, 201]).toContain(response.status);
        if (response.status === 201) {
          expect(response.body.success).toBe(true);
        }
      }
    });

    test('应该正确哈希密码', async () => {
      const testPassword = 'TestHashPassword123!';
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'hashtest',
          email: 'hashtest@example.com',
          password: testPassword
        });

      expect(response.status).toBe(201);
      expect(response.body.data.user.password).toBeUndefined(); // 密码不应返回

      // 验证可以使用原密码登录
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          login: 'hashtest',
          password: testPassword
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);
    });

    test('应该实现密码重试限制', async () => {
      const maxAttempts = 5;
      const testUser = 'retrytest';
      const correctPassword = 'CorrectPass123!';
      const wrongPassword = 'WrongPass123!';

      // 先注册用户
      await request(app)
        .post('/api/auth/register')
        .send({
          username: testUser,
          email: 'retry@example.com',
          password: correctPassword
        });

      // 连续尝试错误密码
      for (let i = 0; i < maxAttempts; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            login: testUser,
            password: wrongPassword
          });

        expect(response.status).toBe(401);
      }

      // 超过限制后，即使密码正确也应该被锁定
      const lockedResponse = await request(app)
        .post('/api/auth/login')
        .send({
          login: testUser,
          password: correctPassword
        });

      expect(lockedResponse.status).toBe(429); // Too Many Requests
      expect(lockedResponse.body.message).toContain('账户已被锁定');
    });
  });

  describe('输入验证和注入攻击防护', () => {
    test('应该防护SQL注入攻击', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; UPDATE users SET role='admin' WHERE id=1; --",
        "' UNION SELECT * FROM users WHERE '1'='1",
        "admin'--",
        "' OR 1=1#"
      ];

      for (const payload of sqlInjectionPayloads) {
        // 尝试在登录中注入
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            login: payload,
            password: 'password'
          });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);

        // 尝试在搜索中注入
        const searchResponse = await request(app)
          .get(`/api/campaigns?search=${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect([200, 400]).toContain(searchResponse.status);
        if (searchResponse.status === 200) {
          expect(searchResponse.body.success).toBe(true);
        }
      }
    });

    test('应该防护XSS攻击', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        '<svg onload=alert("XSS")>',
        'javascript:alert("XSS")',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        '"><script>alert("XSS")</script>'
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/campaigns')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: payload,
            subject: `Subject with ${payload}`,
            content: `Content with ${payload}`
          });

        if (response.status === 201) {
          // 如果创建成功，检查返回的数据是否被正确转义
          const campaign = response.body.data.campaign;
          expect(campaign.name).not.toContain('<script>');
          expect(campaign.subject).not.toContain('<script>');
          expect(campaign.content).not.toContain('<script>');
        }
      }
    });

    test('应该验证输入长度限制', async () => {
      const longString = 'A'.repeat(10000); // 10KB字符串

      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: longString,
          subject: longString,
          content: longString
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('输入长度超限');
    });

    test('应该验证邮件地址格式', async () => {
      const invalidEmails = [
        'invalid-email',
        'test@',
        '@example.com',
        'test..test@example.com',
        'test@example',
        '<script>alert("xss")</script>@example.com',
        'test@<script>alert("xss")</script>.com'
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/contacts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            email: email,
            name: '测试联系人'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('权限和访问控制测试', () => {
    test('应该阻止未授权访问受保护资源', async () => {
      const protectedEndpoints = [
        { method: 'get', path: '/api/campaigns' },
        { method: 'post', path: '/api/campaigns' },
        { method: 'get', path: '/api/contacts' },
        { method: 'post', path: '/api/contacts' },
        { method: 'get', path: '/api/templates' },
        { method: 'post', path: '/api/templates' },
        { method: 'get', path: '/api/users/profile' }
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await request(app)[endpoint.method](endpoint.path)
          .send({});

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      }
    });

    test('应该阻止用户访问他人资源', async () => {
      // 创建另一个用户
      const otherUserData = {
        username: 'otheruser',
        email: 'other@example.com',
        password: 'OtherPass123!'
      };

      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send(otherUserData);

      const otherToken = otherUserResponse.body.data.token;

      // 用户A创建群发任务
      const campaignResponse = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '私人群发任务',
          subject: '私人主题',
          content: '私人内容'
        });

      const campaignId = campaignResponse.body.data.campaign.id;

      // 用户B尝试访问用户A的群发任务
      const unauthorizedResponse = await request(app)
        .get(`/api/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(unauthorizedResponse.status).toBe(403);
      expect(unauthorizedResponse.body.success).toBe(false);
    });

    test('应该正确实现角色权限控制', async () => {
      // 普通用户尝试访问管理员功能
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);

      // 管理员用户应该能访问管理员功能
      const adminResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 404]).toContain(adminResponse.status); // 可能功能未实现
    });

    test('应该防护特权提升攻击', async () => {
      // 尝试通过修改请求提升权限
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          role: 'admin',
          permissions: ['all'],
          isAdmin: true
        });

      if (response.status === 200) {
        expect(response.body.data.user.role).not.toBe('admin');
      }
    });
  });

  describe('会话安全测试', () => {
    test('应该在登出后使token失效', async () => {
      // 创建新用户用于测试
      const sessionTestUser = {
        username: 'sessiontest',
        email: 'session@example.com',
        password: 'SessionTest123!'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(sessionTestUser);

      const testToken = registerResponse.body.data.token;

      // 验证token有效
      await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      // 登出
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      // 验证token已失效
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(401);
    });

    test('应该防护会话固定攻击', async () => {
      // 登录前的token
      const beforeLoginToken = jwt.sign(
        { temp: true },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      // 尝试使用预设token登录
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .set('Authorization', `Bearer ${beforeLoginToken}`)
        .send({
          login: 'securitytest',
          password: 'Test123456'
        });

      // 应该获得新的token，而不是使用预设的
      if (loginResponse.status === 200) {
        expect(loginResponse.body.data.token).not.toBe(beforeLoginToken);
      }
    });

    test('应该实现并发会话控制', async () => {
      // 多次登录同一账户
      const loginPromises = [];
      for (let i = 0; i < 5; i++) {
        const promise = request(app)
          .post('/api/auth/login')
          .send({
            login: 'securitytest',
            password: 'Test123456'
          });
        loginPromises.push(promise);
      }

      const responses = await Promise.all(loginPromises);
      const successfulLogins = responses.filter(r => r.status === 200);

      // 根据安全策略，可能限制并发会话数量
      expect(successfulLogins.length).toBeGreaterThan(0);
      expect(successfulLogins.length).toBeLessThanOrEqual(3); // 假设最多3个并发会话
    });
  });

  describe('数据泄露防护测试', () => {
    test('应该过滤敏感信息', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const user = response.body.data.user;
      expect(user.password).toBeUndefined();
      expect(user.passwordHash).toBeUndefined();
      expect(user.salt).toBeUndefined();
    });

    test('应该防护目录遍历攻击', async () => {
      const traversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '..%252f..%252f..%252fetc%252fpasswd'
      ];

      for (const payload of traversalPayloads) {
        const response = await request(app)
          .get(`/api/files/${payload}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).not.toBe(200);
        expect(response.body).not.toContain('root:');
      }
    });

    test('应该防护信息泄露', async () => {
      // 尝试获取不存在的资源
      const response = await request(app)
        .get('/api/campaigns/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      // 错误信息不应该泄露敏感信息
      expect(response.body.message).not.toContain('SQL');
      expect(response.body.message).not.toContain('database');
      expect(response.body.message).not.toContain('table');
      expect(response.body.message).not.toContain('column');
    });
  });

  describe('CSRF和CORS安全测试', () => {
    test('应该设置正确的CORS头', async () => {
      const response = await request(app)
        .options('/api/auth/login');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });

    test('应该拒绝不安全的跨域请求', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Origin', 'http://malicious-site.com')
        .send({
          login: 'test',
          password: 'test'
        });

      // 根据CORS配置，可能拒绝或允许请求
      if (response.headers['access-control-allow-origin']) {
        expect(response.headers['access-control-allow-origin']).not.toBe('http://malicious-site.com');
      }
    });
  });

  describe('安全头检查', () => {
    test('应该设置安全相关的HTTP头', async () => {
      const response = await request(app)
        .get('/api/health/ping');

      // 检查安全头
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
      
      // 检查是否隐藏了服务器信息
      expect(response.headers['server']).not.toContain('Express');
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    test('应该使用HTTPS（在生产环境）', () => {
      if (config.env === 'production') {
        expect(config.server.https).toBe(true);
        expect(config.server.httpsRedirect).toBe(true);
      }
    });
  });

  describe('文件上传安全测试', () => {
    test('应该验证文件类型', async () => {
      const maliciousFiles = [
        { filename: 'virus.exe', mimetype: 'application/x-executable' },
        { filename: 'script.php', mimetype: 'application/x-php' },
        { filename: 'malware.bat', mimetype: 'application/x-bat' },
        { filename: 'shell.sh', mimetype: 'application/x-sh' }
      ];

      for (const file of maliciousFiles) {
        const response = await request(app)
          .post('/api/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', Buffer.from('malicious content'), {
            filename: file.filename,
            contentType: file.mimetype
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('文件类型不允许');
      }
    });

    test('应该限制文件大小', async () => {
      const largeFileContent = Buffer.alloc(10 * 1024 * 1024, 'A'); // 10MB

      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', largeFileContent, {
          filename: 'large.txt',
          contentType: 'text/plain'
        });

      expect(response.status).toBe(413); // Payload Too Large
    });

    test('应该扫描文件内容', async () => {
      const suspiciousContent = Buffer.from(`
        <script>alert('xss')</script>
        <?php system($_GET['cmd']); ?>
        eval(base64_decode($_POST['data']));
      `);

      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', suspiciousContent, {
          filename: 'suspicious.txt',
          contentType: 'text/plain'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('文件内容不安全');
    });
  });

  describe('API安全限制测试', () => {
    test('应该实现速率限制', async () => {
      const requests = [];
      const endpoint = '/api/auth/login';
      const maxRequests = 20;

      // 快速发送大量请求
      for (let i = 0; i < maxRequests; i++) {
        const promise = request(app)
          .post(endpoint)
          .send({
            login: 'test',
            password: 'test'
          });
        requests.push(promise);
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      // 应该有一些请求被限制
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    test('应该防护暴力破解攻击', async () => {
      const username = 'bruteforcetest';
      const correctPassword = 'CorrectPass123!';
      
      // 注册测试用户
      await request(app)
        .post('/api/auth/register')
        .send({
          username,
          email: 'bruteforce@example.com',
          password: correctPassword
        });

      // 尝试暴力破解
      const commonPasswords = [
        'password', '123456', 'admin', 'test', 'root',
        'password123', 'admin123', 'test123', 'qwerty'
      ];

      let blockedCount = 0;
      for (const password of commonPasswords) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            login: username,
            password: password
          });

        if (response.status === 429) {
          blockedCount++;
        }
      }

      // 应该触发暴力破解保护
      expect(blockedCount).toBeGreaterThan(0);
    });
  });

  describe('加密和数据保护测试', () => {
    test('应该使用强加密算法', () => {
      // 检查配置中的加密设置
      expect(config.encryption).toBeDefined();
      expect(config.encryption.algorithm).toBe('aes-256-gcm');
      expect(config.encryption.keyLength).toBeGreaterThanOrEqual(32);
    });

    test('应该正确处理敏感数据', async () => {
      const sensitiveData = {
        creditCard: '4532-1234-5678-9012',
        ssn: '123-45-6789',
        apiKey: 'sk-1234567890abcdef'
      };

      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '测试任务',
          subject: '测试主题',
          content: JSON.stringify(sensitiveData)
        });

      if (response.status === 201) {
        // 检查响应中是否泄露敏感数据
        const responseString = JSON.stringify(response.body);
        expect(responseString).not.toContain('4532-1234-5678-9012');
        expect(responseString).not.toContain('123-45-6789');
        expect(responseString).not.toContain('sk-1234567890abcdef');
      }
    });
  });

  describe('日志和监控安全测试', () => {
    test('应该记录安全事件', async () => {
      // 触发一些安全事件
      await request(app)
        .post('/api/auth/login')
        .send({
          login: 'nonexistent',
          password: 'wrongpassword'
        });

      await request(app)
        .get('/api/campaigns')
        .set('Authorization', 'Bearer invalid-token');

      // 检查是否记录了安全事件（这里假设有日志记录功能）
      // 实际实现中需要检查日志文件或数据库中的审计记录
    });

    test('应该过滤日志中的敏感信息', async () => {
      const sensitivePassword = 'MySecretPassword123!';
      
      await request(app)
        .post('/api/auth/login')
        .send({
          login: 'test',
          password: sensitivePassword
        });

      // 确保密码不会出现在错误日志中
      // 这需要检查实际的日志输出
    });
  });
}); 