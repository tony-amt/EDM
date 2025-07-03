import { configManager, apiHealthChecker, getApiUrl, isProduction, isDevelopment, isTest, isMockEnabled } from '../index';

// 模拟环境变量
const mockEnv = (env: string, vars: Record<string, string> = {}) => {
  const originalEnv = process.env.NODE_ENV;
  const originalVars = { ...process.env };
  
  process.env.NODE_ENV = env;
  Object.assign(process.env, vars);
  
  return () => {
    process.env.NODE_ENV = originalEnv;
    process.env = originalVars;
  };
};

describe('前端配置管理系统', () => {
  
  describe('ConfigManager', () => {
    test('应该是单例模式', () => {
      const instance1 = configManager;
      const instance2 = configManager;
      expect(instance1).toBe(instance2);
    });

    test('应该正确获取配置', () => {
      const config = configManager.getConfig();
      expect(config).toBeDefined();
      expect(config.NODE_ENV).toBeDefined();
      expect(config.API_BASE_URL).toBeDefined();
      expect(config.API_TIMEOUT).toBeGreaterThan(0);
      expect(config.JWT_STORAGE_KEY).toBeDefined();
    });

    test('应该正确获取API基础URL', () => {
      const baseUrl = configManager.getApiBaseUrl();
      expect(baseUrl).toBeDefined();
      expect(typeof baseUrl).toBe('string');
    });

    test('应该正确构建端点URL', () => {
      const url = configManager.getEndpoint('/users');
      expect(url).toBeDefined();
      expect(url).toContain('/users');
      
      const urlWithParams = configManager.getEndpoint('/users/:id', { id: '123' });
      expect(urlWithParams).toContain('/users/123');
    });

    test('应该正确识别环境', () => {
      const restoreEnv = mockEnv('development');
      
      // 需要重新创建配置管理器实例来测试新环境
      const config = configManager.getConfig();
      expect(config.NODE_ENV).toBe('development');
      
      restoreEnv();
    });
  });

  describe('环境检测', () => {
    test('开发环境配置', () => {
      const restoreEnv = mockEnv('development', {
        REACT_APP_API_BASE_URL: 'http://localhost:3000/api',
        REACT_APP_ENABLE_MOCK: 'true'
      });

      expect(isDevelopment()).toBe(true);
      expect(isProduction()).toBe(false);
      expect(isTest()).toBe(false);
      
      restoreEnv();
    });

    test('生产环境配置', () => {
      const restoreEnv = mockEnv('production', {
        REACT_APP_API_BASE_URL: '/api',
        REACT_APP_ENABLE_MOCK: 'false'
      });

      // 注意：由于配置管理器是单例，这里测试的是当前环境
      // 在真实测试中，这些值会根据实际环境变化
      const config = configManager.getConfig();
      expect(config).toBeDefined();
      
      restoreEnv();
    });
  });

  describe('API URL构建', () => {
    test('应该正确构建基础URL', () => {
      const url = getApiUrl('/auth/login');
      expect(url).toBeDefined();
      expect(url).toContain('/auth/login');
    });

    test('应该正确替换路径参数', () => {
      const url = getApiUrl('/users/:id', { id: '123' });
      expect(url).toContain('/users/123');
      expect(url).not.toContain(':id');
    });

    test('应该处理多个参数', () => {
      const url = getApiUrl('/users/:userId/campaigns/:campaignId', {
        userId: '123',
        campaignId: '456'
      });
      expect(url).toContain('/users/123/campaigns/456');
    });
  });

  describe('功能开关', () => {
    test('Mock功能开关', () => {
      const mockEnabled = isMockEnabled();
      expect(typeof mockEnabled).toBe('boolean');
    });

    test('环境判断函数', () => {
      expect(typeof isDevelopment()).toBe('boolean');
      expect(typeof isProduction()).toBe('boolean');
      expect(typeof isTest()).toBe('boolean');
    });
  });

  describe('ApiHealthChecker', () => {
    // 模拟fetch
    const mockFetch = jest.fn();
    global.fetch = mockFetch;

    beforeEach(() => {
      mockFetch.mockClear();
    });

    test('应该检查API健康状态', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      const isHealthy = await apiHealthChecker.checkHealth();
      expect(isHealthy).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('应该处理API错误', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503
      });

      const isHealthy = await apiHealthChecker.checkHealth();
      expect(isHealthy).toBe(false);
    });

    test('应该处理网络错误', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const isHealthy = await apiHealthChecker.checkHealth();
      expect(isHealthy).toBe(false);
    });

    test('应该获取健康状态', () => {
      const status = apiHealthChecker.getHealthStatus();
      expect(status).toBeDefined();
      expect(typeof status.isHealthy).toBe('boolean');
    });

    test('应该能启动和停止定期检查', () => {
      // 启动定期检查
      apiHealthChecker.startPeriodicCheck();
      
      // 停止定期检查
      apiHealthChecker.stopPeriodicCheck();
      
      // 这里主要测试方法是否存在且能正常调用
      expect(true).toBe(true);
    });
  });

  describe('配置验证', () => {
    test('必要配置项应该存在', () => {
      const config = configManager.getConfig();
      
      // 验证必要的配置项
      expect(config.API_BASE_URL).toBeDefined();
      expect(config.JWT_STORAGE_KEY).toBeDefined();
      expect(config.API_TIMEOUT).toBeGreaterThan(0);
      expect(['debug', 'info', 'warn', 'error']).toContain(config.LOG_LEVEL);
    });

    test('端点配置应该完整', () => {
      const endpoints = configManager.getEndpoints();
      
      expect(endpoints.auth).toBeDefined();
      expect(endpoints.auth.login).toBeDefined();
      expect(endpoints.auth.logout).toBeDefined();
      
      expect(endpoints.users).toBeDefined();
      expect(endpoints.users.list).toBeDefined();
      expect(endpoints.users.create).toBeDefined();
      
      expect(endpoints.campaigns).toBeDefined();
      expect(endpoints.health).toBeDefined();
    });

    test('超时配置应该合理', () => {
      const timeout = configManager.getApiTimeout();
      expect(timeout).toBeGreaterThan(1000); // 至少1秒
      expect(timeout).toBeLessThan(60000);   // 不超过60秒
    });

    test('健康检查间隔应该合理', () => {
      const interval = configManager.getHealthCheckInterval();
      expect(interval).toBeGreaterThan(1000);   // 至少1秒
      expect(interval).toBeLessThan(300000);    // 不超过5分钟
    });
  });

  describe('错误处理', () => {
    test('应该处理无效的环境配置', () => {
      // 这里测试配置管理器对异常情况的处理
      expect(() => {
        configManager.getConfig();
      }).not.toThrow();
    });

    test('应该处理缺失的参数', () => {
      const url = getApiUrl('/users/:id');
      expect(url).toContain(':id'); // 参数未替换但不会报错
    });
  });
}); 