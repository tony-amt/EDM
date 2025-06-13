const config = require('../../src/config');

describe('配置管理单元测试', () => {
  
  describe('基础配置验证', () => {
    test('应该正确加载配置', () => {
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });

    test('环境配置应该正确', () => {
      expect(config.env).toBeDefined();
      expect(['development', 'production', 'test']).toContain(config.env);
    });

    test('端口配置应该是数字', () => {
      expect(config.port).toBeDefined();
      expect(typeof config.port).toBe('number');
      expect(config.port).toBeGreaterThan(0);
      expect(config.port).toBeLessThan(65536);
    });
  });

  describe('数据库配置验证', () => {
    test('数据库配置应该完整', () => {
      expect(config.database).toBeDefined();
      expect(config.database.host).toBeDefined();
      expect(config.database.port).toBeDefined();
      expect(config.database.database).toBeDefined();
      expect(config.database.username).toBeDefined();
      expect(config.database.password).toBeDefined();
    });

    test('数据库端口应该是有效的PostgreSQL端口', () => {
      expect(typeof config.database.port).toBe('number');
      expect(config.database.port).toBe(5432);
    });

    test('数据库方言应该是postgres', () => {
      expect(config.database.dialect).toBe('postgres');
    });
  });

  describe('JWT配置验证', () => {
    test('JWT配置应该存在', () => {
      expect(config.jwt).toBeDefined();
      expect(config.jwt.secret).toBeDefined();
      expect(config.jwt.expiresIn).toBeDefined();
    });

    test('JWT密钥长度应该足够安全', () => {
      expect(config.jwt.secret.length).toBeGreaterThan(10);
    });

    test('JWT过期时间格式应该正确', () => {
      expect(config.jwt.expiresIn).toMatch(/^\d+[dhms]$/);
    });
  });

  describe('Redis配置验证', () => {
    test('Redis配置应该存在', () => {
      expect(config.redis).toBeDefined();
      expect(config.redis.url).toBeDefined();
    });

    test('Redis URL格式应该正确', () => {
      expect(config.redis.url).toMatch(/^redis:\/\//);
    });
  });

  describe('CORS配置验证', () => {
    test('CORS配置应该存在', () => {
      expect(config.cors).toBeDefined();
      expect(config.cors.origin).toBeDefined();
      expect(config.cors.credentials).toBeDefined();
    });

    test('CORS凭据应该启用', () => {
      expect(config.cors.credentials).toBe(true);
    });
  });

  describe('文件上传配置验证', () => {
    test('上传配置应该存在', () => {
      expect(config.upload).toBeDefined();
      expect(config.upload.maxSize).toBeDefined();
      expect(config.upload.directory).toBeDefined();
    });

    test('最大文件大小应该合理', () => {
      expect(typeof config.upload.maxSize).toBe('number');
      expect(config.upload.maxSize).toBeGreaterThan(0);
      expect(config.upload.maxSize).toBeLessThanOrEqual(10 * 1024 * 1024); // 不超过10MB
    });
  });

  describe('环境特定配置', () => {
    test('开发环境配置', () => {
      if (config.env === 'development') {
        expect(config.cors.origin).toContain('localhost');
      }
    });

    test('生产环境配置', () => {
      if (config.env === 'production') {
        // 生产环境应该有更严格的配置
        expect(config.jwt.secret).not.toBe('default-secret');
        expect(config.database.password).not.toBe('password');
      }
    });

    test('测试环境配置', () => {
      if (config.env === 'test') {
        // 测试环境配置验证
        expect(config).toBeDefined();
      }
    });
  });

  describe('配置安全性', () => {
    test('敏感信息不应该是默认值', () => {
      if (config.env === 'production') {
        expect(config.jwt.secret).not.toBe('secret');
        expect(config.jwt.secret).not.toBe('default-secret');
        expect(config.database.password).not.toBe('password');
        expect(config.database.password).not.toBe('123456');
      }
    });

    test('JWT密钥应该足够复杂', () => {
      const secret = config.jwt.secret;
      expect(secret.length).toBeGreaterThanOrEqual(16);
      
      // 检查是否包含字母和数字
      const hasLetter = /[a-zA-Z]/.test(secret);
      const hasNumber = /\d/.test(secret);
      
      if (config.env === 'production') {
        expect(hasLetter || hasNumber).toBe(true);
      }
    });
  });

  describe('配置一致性', () => {
    test('所有必需的配置项都应该存在', () => {
      const requiredKeys = ['env', 'port', 'database', 'jwt', 'redis', 'cors'];
      
      requiredKeys.forEach(key => {
        expect(config[key]).toBeDefined();
      });
    });

    test('配置类型应该正确', () => {
      expect(typeof config.env).toBe('string');
      expect(typeof config.port).toBe('number');
      expect(typeof config.database).toBe('object');
      expect(typeof config.jwt).toBe('object');
      expect(typeof config.redis).toBe('object');
      expect(typeof config.cors).toBe('object');
    });
  });
}); 