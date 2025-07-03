// 前端配置管理系统 - 符合配置规范
interface EnvironmentConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  API_BASE_URL: string;
  API_TIMEOUT: number;
  JWT_STORAGE_KEY: string;
  ENABLE_MOCK: boolean;
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  HEALTH_CHECK_INTERVAL: number;
}

interface ApiEndpoints {
  auth: {
    login: string;
    logout: string;
    refresh: string;
    verify: string;
  };
  users: {
    list: string;
    create: string;
    update: string;
    delete: string;
    allocateQuota: string;
  };
  senders: {
    list: string;
    create: string;
    update: string;
    delete: string;
  };
  emailServices: {
    list: string;
    create: string;
    update: string;
    delete: string;
    healthCheck: string;
  };
  campaigns: {
    list: string;
    create: string;
    update: string;
    delete: string;
    detail: string;
    start: string;
    pause: string;
    stop: string;
  };
  contacts: {
    list: string;
    create: string;
    update: string;
    delete: string;
    import: string;
    export: string;
  };
  templates: {
    list: string;
    create: string;
    update: string;
    delete: string;
  };
  health: {
    ping: string;
    status: string;
  };
}

// 环境配置映射
const environmentConfigs: Record<string, EnvironmentConfig> = {
  development: {
    NODE_ENV: 'development',
    API_BASE_URL: process.env.REACT_APP_API_BASE_URL || '/api',
    API_TIMEOUT: parseInt(process.env.REACT_APP_API_TIMEOUT || '10000'),
    JWT_STORAGE_KEY: 'edm_token',
    ENABLE_MOCK: process.env.REACT_APP_ENABLE_MOCK === 'true',
    LOG_LEVEL: (process.env.REACT_APP_LOG_LEVEL as any) || 'debug',
    HEALTH_CHECK_INTERVAL: parseInt(process.env.REACT_APP_HEALTH_CHECK_INTERVAL || '30000'),
  },
  production: {
    NODE_ENV: 'production',
    API_BASE_URL: process.env.REACT_APP_API_BASE_URL || '/api',
    API_TIMEOUT: parseInt(process.env.REACT_APP_API_TIMEOUT || '15000'),
    JWT_STORAGE_KEY: 'edm_token',
    ENABLE_MOCK: false,
    LOG_LEVEL: (process.env.REACT_APP_LOG_LEVEL as any) || 'info',
    HEALTH_CHECK_INTERVAL: parseInt(process.env.REACT_APP_HEALTH_CHECK_INTERVAL || '60000'),
  },
  test: {
    NODE_ENV: 'test',
    API_BASE_URL: '/api',
    API_TIMEOUT: 5000,
    JWT_STORAGE_KEY: 'edm_token_test',
    ENABLE_MOCK: true,
    LOG_LEVEL: 'error',
    HEALTH_CHECK_INTERVAL: 5000,
  },
};

// API端点配置
const apiEndpoints: ApiEndpoints = {
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    refresh: '/auth/refresh',
    verify: '/auth/verify',
  },
  users: {
    list: '/users',
    create: '/users',
    update: '/users/:id',
    delete: '/users/:id',
    allocateQuota: '/users/:id/allocate-quota',
  },
  senders: {
    list: '/senders',
    create: '/senders',
    update: '/senders/:id',
    delete: '/senders/:id',
  },
  emailServices: {
    list: '/email-services',
    create: '/email-services',
    update: '/email-services/:id',
    delete: '/email-services/:id',
    healthCheck: '/email-services/:id/health',
  },
  campaigns: {
    list: '/campaigns',
    create: '/campaigns',
    update: '/campaigns/:id',
    delete: '/campaigns/:id',
    detail: '/campaigns/:id',
    start: '/campaigns/:id/start',
    pause: '/campaigns/:id/pause',
    stop: '/campaigns/:id/stop',
  },
  contacts: {
    list: '/contacts',
    create: '/contacts',
    update: '/contacts/:id',
    delete: '/contacts/:id',
    import: '/contacts/import',
    export: '/contacts/export',
  },
  templates: {
    list: '/templates',
    create: '/templates',
    update: '/templates/:id',
    delete: '/templates/:id',
  },
  health: {
    ping: '/health/ping',
    status: '/health/status',
  },
};

// 环境检测
class EnvironmentDetector {
  static getCurrentEnvironment(): string {
    const env = process.env.NODE_ENV || 'development';
    if (env in environmentConfigs) {
      return env;
    }
    console.warn(`未知环境: ${env}, 使用默认环境: development`);
    return 'development';
  }

  static validateEnvironment(): boolean {
    const env = this.getCurrentEnvironment();
    const config = environmentConfigs[env];
    
    const requiredFields = ['API_BASE_URL', 'JWT_STORAGE_KEY'];
    const missing = requiredFields.filter(field => !config[field as keyof EnvironmentConfig]);
    
    if (missing.length > 0) {
      console.error(`环境配置缺失字段: ${missing.join(', ')}`);
      return false;
    }
    
    return true;
  }
}

// 配置管理器
class ConfigManager {
  private static instance: ConfigManager;
  private config: EnvironmentConfig;
  private endpoints: ApiEndpoints;

  private constructor() {
    const env = EnvironmentDetector.getCurrentEnvironment();
    this.config = environmentConfigs[env];
    this.endpoints = apiEndpoints;
    
    if (!EnvironmentDetector.validateEnvironment()) {
      throw new Error('配置验证失败');
    }
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  getConfig(): EnvironmentConfig {
    return { ...this.config };
  }

  getApiBaseUrl(): string {
    return this.config.API_BASE_URL;
  }

  getApiTimeout(): number {
    return this.config.API_TIMEOUT;
  }

  getEndpoint(path: string, params?: Record<string, string>): string {
    const fullPath = this.config.API_BASE_URL + path;
    
    if (params) {
      return Object.entries(params).reduce(
        (url, [key, value]) => url.replace(`:${key}`, value),
        fullPath
      );
    }
    
    return fullPath;
  }

  getEndpoints(): ApiEndpoints {
    return { ...this.endpoints };
  }

  isProduction(): boolean {
    return this.config.NODE_ENV === 'production';
  }

  isDevelopment(): boolean {
    return this.config.NODE_ENV === 'development';
  }

  isTest(): boolean {
    return this.config.NODE_ENV === 'test';
  }

  isMockEnabled(): boolean {
    return this.config.ENABLE_MOCK;
  }

  getLogLevel(): string {
    return this.config.LOG_LEVEL;
  }

  getHealthCheckInterval(): number {
    return this.config.HEALTH_CHECK_INTERVAL;
  }
}

// API健康检查
class ApiHealthChecker {
  private configManager: ConfigManager;
  private intervalId?: NodeJS.Timeout;
  private isHealthy: boolean = true;
  private lastCheckTime?: Date;

  constructor() {
    this.configManager = ConfigManager.getInstance();
  }

  async checkHealth(): Promise<boolean> {
    try {
      const healthUrl = this.configManager.getEndpoint('/health/ping');
      
      // 使用AbortController实现超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      this.isHealthy = response.ok;
      this.lastCheckTime = new Date();
      
      if (!this.isHealthy) {
        console.warn('API健康检查失败:', response.status);
      }
      
      return this.isHealthy;
    } catch (error) {
      this.isHealthy = false;
      this.lastCheckTime = new Date();
      console.error('API健康检查异常:', error);
      return false;
    }
  }

  startPeriodicCheck(): void {
    const interval = this.configManager.getHealthCheckInterval();
    this.intervalId = setInterval(() => {
      this.checkHealth();
    }, interval);
  }

  stopPeriodicCheck(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  getHealthStatus(): { isHealthy: boolean; lastCheckTime?: Date } {
    return {
      isHealthy: this.isHealthy,
      lastCheckTime: this.lastCheckTime,
    };
  }
}

// 导出实例
export const configManager = ConfigManager.getInstance();
export const apiHealthChecker = new ApiHealthChecker();

// 导出类型
export type { EnvironmentConfig, ApiEndpoints };

// 导出工具函数
export const getApiUrl = (path: string, params?: Record<string, string>): string => {
  return configManager.getEndpoint(path, params);
};

export const isProduction = (): boolean => configManager.isProduction();
export const isDevelopment = (): boolean => configManager.isDevelopment();
export const isTest = (): boolean => configManager.isTest();
export const isMockEnabled = (): boolean => configManager.isMockEnabled();

export default configManager; 