require('dotenv').config();
const path = require('path');

const env = process.env.NODE_ENV || 'development';

// 环境变量配置
const config = {
  // 服务器配置
  server: {
    env,
    port: parseInt(process.env.BACKEND_PORT, 10) || 3000,
    host: process.env.BACKEND_HOST || '0.0.0.0',
  },
  
  // PostgreSQL数据库配置
  postgres: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'amt_mail_system',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development',
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  
  // Redis配置 - 更新为Docker环境
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || '',
  },
  
  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'amt-mail-system-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'amt-mail-system-refresh-secret-key',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  // 初始管理员用户配置
  adminUser: {
    username: process.env.ADMIN_USERNAME || 'admin',
    email: process.env.ADMIN_EMAIL || 'admin@example.com',
    password: process.env.ADMIN_PASSWORD || 'admin123456',
  },
  
  // 极光API配置 - 集成测试时配置
  engagelab: {
    baseUrl: process.env.ENGAGELAB_BASE_URL || 'https://email.api.engagelab.cc/v1',
    apiUser: process.env.ENGAGELAB_API_USER,
    apiKey: process.env.ENGAGELAB_API_KEY,
    webhookPath: process.env.WEBHOOK_PATH || '/api/webhook/mail',
  },
  
  // 邮件任务配置
  mailTask: {
    batchSize: parseInt(process.env.MAIL_BATCH_SIZE || '50', 10),
    sendInterval: parseInt(process.env.MAIL_SEND_INTERVAL || '1000', 10), // 毫秒
    maxRetries: parseInt(process.env.MAIL_MAX_RETRIES || '3', 10),
  },
  
  // 日志配置
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    filename: process.env.LOG_FILE || 'app.log',
  },
  
  // CORS配置
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3001'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  },
  
  tempDir: path.join(__dirname, '../../temp'),
};

// 环境特定配置 (可以覆盖或扩展基础配置)
const environmentConfigs = {
  development: {
    // 开发环境特定配置，例如更详细的日志
    postgres: {
        ...config.postgres, // 继承基础数据库配置
        logging: console.log, // 开发时显示SQL日志
    }
  },
  test: {
    server: {
        ...config.server,
        port: parseInt(process.env.BACKEND_PORT_TEST, 10) || 3000, // 测试环境也使用 3000 或专用环境变量
    },
    postgres: {
        host: process.env.DB_HOST_TEST || 'localhost', // 测试通常连接本地或特定测试DB
        port: parseInt(process.env.DB_PORT_TEST, 10) || 5432,
        username: process.env.DB_USER_TEST || 'postgres',
        password: process.env.DB_PASSWORD_TEST || 'password',
        database: process.env.DB_NAME_TEST || 'amt_mail_test',
        dialect: 'postgres',
        logging: false, // 测试时通常关闭SQL日志
        pool: {
          max: 5,
          min: 0,
          acquire: 30000,
          idle: 10000
        }
    },
    // 测试环境可以有自己的JWT密钥或CORS设置，如果需要隔离
  },
  production: {
    // 生产环境特定配置，例如SSL，更严格的安全设置
    server: {
        ...config.server,
        port: parseInt(process.env.PORT, 10) || parseInt(process.env.BACKEND_PORT, 10) || 8080, // 生产环境通常使用不同端口
    },
    cors: {
        ...config.cors,
        origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['https://tkmail.fun', 'http://tkmail.fun'], // 生产环境的CORS源
    },
    // 生产数据库配置使用Docker环境变量
    postgres: {
        host: process.env.DB_HOST || 'postgres',
        port: parseInt(process.env.DB_PORT, 10) || 5432,
        username: process.env.DB_USER || 'edm_user',
        password: process.env.DB_PASSWORD || 'edm_secure_2025_tk',
        database: process.env.DB_NAME || 'amt_mail_system',
        dialect: 'postgres',
        logging: false, 
        pool: {
          max: 5,
          min: 0,
          acquire: 30000,
          idle: 10000
        }
    },
  },
};

const finalConfig = { ...config, ...environmentConfigs[env] };

// 如果特定环境的配置（如 postgres）也是对象，需要深度合并
if (environmentConfigs[env] && typeof environmentConfigs[env].postgres === 'object') {
  finalConfig.postgres = { ...config.postgres, ...environmentConfigs[env].postgres };
}
if (environmentConfigs[env] && typeof environmentConfigs[env].server === 'object') {
  finalConfig.server = { ...config.server, ...environmentConfigs[env].server };
}
if (environmentConfigs[env] && typeof environmentConfigs[env].jwt === 'object') {
  finalConfig.jwt = { ...config.jwt, ...environmentConfigs[env].jwt };
}
if (environmentConfigs[env] && typeof environmentConfigs[env].cors === 'object') {
  finalConfig.cors = { ...config.cors, ...environmentConfigs[env].cors };
}

console.log(`ℹ️ [CONFIG_DEBUG] Loaded config for environment: ${env}`);
console.log(`ℹ️ [CONFIG_DEBUG] Final config.server.port: ${finalConfig.server.port}`);

module.exports = finalConfig; 