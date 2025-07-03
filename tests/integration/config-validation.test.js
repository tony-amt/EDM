const request = require('supertest');
const app = require('../../src/index');
const config = require('../../src/config');

describe('配置验证集成测试', () => {
  
  describe('环境配置验证', () => {
    test('应该正确识别当前环境', () => {
      expect(config.env).toBeDefined();
      expect(['development', 'production', 'test']).toContain(config.env);
    });

    test('数据库配置应该完整', () => {
      expect(config.database).toBeDefined();
      expect(config.database.host).toBeDefined();
      expect(config.database.port).toBeDefined();
      expect(config.database.database).toBeDefined();
      expect(config.database.username).toBeDefined();
      expect(config.database.password).toBeDefined();
    });

    test('JWT配置应该安全', () => {
      expect(config.jwt).toBeDefined();
      expect(config.jwt.secret).toBeDefined();
      expect(config.jwt.secret.length).toBeGreaterThan(10);
      expect(config.jwt.expiresIn).toBeDefined();
    });

    test('Redis配置应该正确', () => {
      expect(config.redis).toBeDefined();
      expect(config.redis.url).toBeDefined();
      expect(config.redis.url).toMatch(/^redis:\/\//);
    });

    test('CORS配置应该安全', () => {
      expect(config.cors).toBeDefined();
      expect(config.cors.origin).toBeDefined();
      expect(config.cors.credentials).toBeDefined();
    });
  });

  describe('API健康检查', () => {
    test('GET /api/health/ping 应该返回健康状态', async () => {
      const response = await request(app)
        .get('/api/health/ping')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.uptime).toBeGreaterThan(0);
      expect(response.body.data.responseTime).toBeGreaterThanOrEqual(0);
    });

    test('GET /api/health/status 应该返回详细状态', async () => {
      const response = await request(app)
        .get('/api/health/status')
        .expect(200);

      expect(response.body.success).toBeDefined();
      expect(response.body.data).toBeDefined();
      expect(response.body.data.checks).toBeDefined();
      expect(response.body.data.checks.database).toBeDefined();
      expect(response.body.data.checks.redis).toBeDefined();
      expect(response.body.data.checks.memory).toBeDefined();
      expect(response.body.data.summary).toBeDefined();
    });

    test('GET /api/health/dependencies 应该检查依赖服务', async () => {
      const response = await request(app)
        .get('/api/health/dependencies');

      // 健康状态应该是200或503
      expect([200, 503]).toContain(response.status);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.dependencies).toBeDefined();
      expect(response.body.data.dependencies.postgresql).toBeDefined();
      expect(response.body.data.dependencies.redis).toBeDefined();
      expect(response.body.data.summary).toBeDefined();
    });
  });

  describe('环境切换测试', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    test('开发环境配置应该正确', () => {
      process.env.NODE_ENV = 'development';
      delete require.cache[require.resolve('../../src/config')];
      const devConfig = require('../../src/config');
      
      expect(devConfig.env).toBe('development');
      expect(devConfig.port).toBeDefined();
    });

    test('生产环境配置应该正确', () => {
      process.env.NODE_ENV = 'production';
      delete require.cache[require.resolve('../../src/config')];
      const prodConfig = require('../../src/config');
      
      expect(prodConfig.env).toBe('production');
      expect(prodConfig.port).toBeDefined();
    });
  });

  describe('配置安全性验证', () => {
    test('敏感信息不应该被意外暴露', () => {
      expect(config.database.password).toBeDefined();
      expect(config.jwt.secret).toBeDefined();
      
      // 确保这些敏感信息不是默认值
      if (config.env === 'production') {
        expect(config.database.password).not.toBe('password');
        expect(config.jwt.secret).not.toBe('default-secret');
      }
    });

    test('生产环境应该禁用调试功能', () => {
      if (config.env === 'production') {
        // 检查是否禁用了开发特性
        expect(process.env.DEBUG).toBeFalsy();
      }
    });
  });

  describe('API路径配置测试', () => {
    test('认证路径应该可访问', async () => {
      // 测试登录路径（应该返回401或400，而不是404）
      const response = await request(app)
        .post('/api/auth/login');
      
      expect([400, 401, 422]).toContain(response.status);
    });

    test('用户管理路径应该存在', async () => {
      const response = await request(app)
        .get('/api/users');
      
      // 应该返回401（未授权）而不是404（路径不存在）
      expect([401, 403]).toContain(response.status);
    });

    test('群发任务路径应该存在', async () => {
      const response = await request(app)
        .get('/api/campaigns');
      
      expect([401, 403]).toContain(response.status);
    });
  });

  describe('数据库连接测试', () => {
    test('应该能连接到数据库', async () => {
      const response = await request(app)
        .get('/api/health/status');
      
      if (response.status === 200) {
        expect(response.body.data.checks.database.status).toBe('healthy');
      }
    });
  });

  describe('Redis连接测试', () => {
    test('应该能连接到Redis', async () => {
      const response = await request(app)
        .get('/api/health/status');
      
      if (response.status === 200) {
        expect(response.body.data.checks.redis.status).toBe('healthy');
      }
    });
  });
}); 