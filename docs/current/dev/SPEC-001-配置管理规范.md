# SPEC-001-配置管理规范

**文档版本**: v1.0  
**创建时间**: 2025-01-27  
**更新时间**: 2025-01-27  
**负责人**: AI开发团队  
**文档状态**: 已发布

---

## 📋 概述

本文档定义了EDM系统V2.0的配置管理规范，确保所有环境相关配置遵循统一标准，满足开发、测试、生产环境的不同需求。

## 🎯 配置管理原则

### 1. 环境隔离原则
- 所有环境相关配置必须从配置文件或环境变量获取
- 禁止在业务代码中硬编码环境参数
- 不同环境使用独立的配置文件

### 2. 安全性原则
- 敏感信息必须通过环境变量传递
- 生产环境配置文件不包含敏感信息
- 配置文件版本控制时排除敏感数据

### 3. 可维护性原则
- 配置项命名遵循统一规范
- 提供配置项的详细文档说明
- 配置变更记录可追溯

## 🏗️ 配置架构

### 前端配置架构
```
src/frontend/src/config/
├── index.ts                 # 配置管理器主文件
├── __tests__/              # 配置测试文件
│   └── config.test.ts
└── types.ts                # 配置类型定义
```

### 后端配置架构
```
src/config/
├── index.js                # 后端配置主文件
├── database.js             # 数据库配置
├── redis.js                # Redis配置
└── security.js             # 安全相关配置
```

### 环境配置文件
```
config/
├── frontend.env.development    # 前端开发环境
├── frontend.env.production     # 前端生产环境
├── backend.env.development     # 后端开发环境
└── backend.env.production      # 后端生产环境
```

## 📝 配置规范

### 前端配置规范

#### 1. 环境变量命名
- 所有前端环境变量必须以 `REACT_APP_` 开头
- 使用大写字母和下划线分隔
- 示例：`REACT_APP_API_BASE_URL`

#### 2. 配置分类
```typescript
interface EnvironmentConfig {
  // 基础配置
  NODE_ENV: 'development' | 'production' | 'test';
  API_BASE_URL: string;
  API_TIMEOUT: number;
  
  // 功能开关
  ENABLE_MOCK: boolean;
  DEBUG_MODE: boolean;
  
  // 安全配置
  JWT_STORAGE_KEY: string;
  
  // 性能配置
  HEALTH_CHECK_INTERVAL: number;
  
  // 日志配置
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
}
```

#### 3. 配置管理器使用
```typescript
import { configManager, getApiUrl } from '@/config';

// 获取配置
const config = configManager.getConfig();

// 构建API URL
const userListUrl = getApiUrl('/users');
const userDetailUrl = getApiUrl('/users/:id', { id: '123' });

// 环境判断
if (configManager.isDevelopment()) {
  console.log('开发环境');
}
```

### 后端配置规范

#### 1. 配置分组
```javascript
module.exports = {
  // 环境信息
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  
  // 数据库配置
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'edm_system',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
  },
  
  // 安全配置
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  
  // 第三方服务配置
  emailServices: {
    aliyun: {
      accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
      accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
    }
  }
};
```

#### 2. 配置验证
```javascript
const validateConfig = () => {
  const requiredEnvVars = [
    'DB_PASSWORD',
    'JWT_SECRET',
    'REDIS_URL'
  ];
  
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`缺少必要的环境变量: ${missing.join(', ')}`);
  }
};
```

## 🌍 环境配置

### 开发环境 (development)
```bash
# API配置
REACT_APP_API_BASE_URL=http://localhost:3000/api
REACT_APP_API_TIMEOUT=10000

# 功能开关
REACT_APP_ENABLE_MOCK=false
REACT_APP_DEBUG_MODE=true
REACT_APP_LOG_LEVEL=debug

# 健康检查
REACT_APP_HEALTH_CHECK_INTERVAL=30000
```

### 生产环境 (production)
```bash
# API配置
REACT_APP_API_BASE_URL=/api
REACT_APP_API_TIMEOUT=15000

# 功能开关
REACT_APP_ENABLE_MOCK=false
REACT_APP_DEBUG_MODE=false
REACT_APP_LOG_LEVEL=info

# 健康检查
REACT_APP_HEALTH_CHECK_INTERVAL=60000
```

### 测试环境 (test)
```bash
# API配置
REACT_APP_API_BASE_URL=http://localhost:3000/api
REACT_APP_API_TIMEOUT=5000

# 功能开关
REACT_APP_ENABLE_MOCK=true
REACT_APP_DEBUG_MODE=false
REACT_APP_LOG_LEVEL=error

# 健康检查
REACT_APP_HEALTH_CHECK_INTERVAL=5000
```

## 🔧 API健康检查

### 健康检查端点
| 端点 | 描述 | 响应时间要求 |
|------|------|-------------|
| `/api/health/ping` | 基础健康检查 | < 100ms |
| `/api/health/status` | 详细健康检查 | < 500ms |
| `/api/health/dependencies` | 依赖服务检查 | < 1000ms |

### 健康检查实现
```typescript
class ApiHealthChecker {
  async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('/api/health/ping', {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.error('健康检查失败:', error);
      return false;
    }
  }
}
```

## 🧪 配置测试

### 测试覆盖范围
- [x] 环境配置验证
- [x] API健康检查
- [x] 配置管理器功能
- [x] 环境切换测试
- [x] 安全性验证

### 测试用例示例
```typescript
describe('配置验证', () => {
  test('必要配置项应该存在', () => {
    const config = configManager.getConfig();
    expect(config.API_BASE_URL).toBeDefined();
    expect(config.JWT_STORAGE_KEY).toBeDefined();
  });
  
  test('API健康检查应该正常', async () => {
    const isHealthy = await apiHealthChecker.checkHealth();
    expect(typeof isHealthy).toBe('boolean');
  });
});
```

## 🔒 安全要求

### 敏感信息处理
1. **数据库密码**: 必须通过环境变量传递
2. **JWT密钥**: 必须使用强随机字符串
3. **第三方API密钥**: 不得硬编码在代码中
4. **生产环境**: 禁用调试模式和详细日志

### 配置文件安全
1. 敏感配置文件不纳入版本控制
2. 提供配置文件模板（不含敏感信息）
3. 生产环境配置文件权限控制

## 📊 配置监控

### 配置一致性检查
```bash
# 构建时验证配置
npm run build:verify-config

# 运行时配置检查
npm run health:config
```

### 配置变更记录
- 所有配置变更必须记录在变更日志中
- 配置变更需要经过代码审查
- 生产环境配置变更需要审批流程

## 🚀 构建流程

### 开发构建
```bash
# 加载开发环境配置
cp config/frontend.env.development .env
npm run build:dev
```

### 生产构建
```bash
# 加载生产环境配置
cp config/frontend.env.production .env
npm run build:prod
npm run verify:config
```

### 配置注入
构建过程中自动将环境变量注入到应用中：
```javascript
// webpack.config.js
const webpack = require('webpack');

module.exports = {
  plugins: [
    new webpack.DefinePlugin({
      'process.env': JSON.stringify(process.env)
    })
  ]
};
```

## 📚 最佳实践

### 1. 配置命名
- 使用描述性名称
- 保持命名一致性
- 避免缩写和简写

### 2. 默认值设置
- 为所有配置项提供合理默认值
- 开发环境优先便于调试
- 生产环境优先安全和性能

### 3. 文档维护
- 每个配置项都有详细说明
- 配置变更同步更新文档
- 提供配置示例和最佳实践

### 4. 错误处理
- 配置加载失败应有明确错误信息
- 提供配置检查和验证工具
- 支持配置回滚机制

## 📋 配置清单

### 必需配置项
- [x] API_BASE_URL - API基础地址
- [x] JWT_STORAGE_KEY - JWT存储键名
- [x] API_TIMEOUT - API超时时间
- [x] LOG_LEVEL - 日志级别

### 可选配置项
- [x] ENABLE_MOCK - 是否启用Mock
- [x] DEBUG_MODE - 调试模式
- [x] HEALTH_CHECK_INTERVAL - 健康检查间隔

### 环境特定配置
- [x] 开发环境：启用调试、详细日志
- [x] 生产环境：禁用调试、简化日志
- [x] 测试环境：启用Mock、错误日志

## 🔄 变更历史

| 版本 | 日期 | 变更内容 | 负责人 |
|------|------|----------|--------|
| v1.0 | 2025-01-27 | 初始版本，建立配置管理规范 | AI开发团队 |

---

**文档状态**: ✅ 已发布  
**下次审查**: 2025-02-27  
**相关文档**: 
- [API设计规范](./API-002-群发调度与发信服务管理接口设计.md)
- [测试规范](../05-testing/TEST-002-群发调度与发信服务管理测试用例.md)
- [部署指南](../06-operation/OPS-001-部署指南.md) 