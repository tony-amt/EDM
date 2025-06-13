/**
 * Docker环境测试设置
 * 严格按照README.md规范，100%在Docker环境中运行
 */
const request = require('supertest');

// Docker环境配置
const DOCKER_CONFIG = {
  // 按照docker-compose.yml配置
  BACKEND_URL: process.env.BACKEND_URL || 'http://backend:3000',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://frontend:3001',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:password@postgres:5432/amt_mail_system',
  
  // Docker网络内部通信
  POSTGRES_HOST: 'postgres',
  POSTGRES_PORT: 5432,
  POSTGRES_DB: 'amt_mail_system',
  POSTGRES_USER: 'postgres',
  POSTGRES_PASSWORD: 'password',
  
  // Redis Docker服务
  REDIS_HOST: 'redis',
  REDIS_PORT: 6379
};

/**
 * Docker环境健康检查
 */
const checkDockerEnvironment = async () => {
  const checks = {
    backend: false,
    database: false,
    redis: false
  };

  try {
    // 检查后端服务（Docker容器间通信）
    const backendResponse = await request(DOCKER_CONFIG.BACKEND_URL)
      .get('/health')
      .timeout(5000);
    
    checks.backend = backendResponse.status === 200;
    
    console.log('✅ Docker环境检查完成:', checks);
    return checks;
  } catch (error) {
    console.log('❌ Docker环境检查失败:', error.message);
    console.log('🐳 请确保Docker Compose服务已启动: docker-compose up -d');
    return checks;
  }
};

/**
 * Docker测试数据库连接
 */
const getDockerDatabaseConnection = () => {
  const { Sequelize } = require('sequelize');
  
  return new Sequelize({
    dialect: 'postgres',
    host: DOCKER_CONFIG.POSTGRES_HOST,
    port: DOCKER_CONFIG.POSTGRES_PORT,
    database: DOCKER_CONFIG.POSTGRES_DB,
    username: DOCKER_CONFIG.POSTGRES_USER,
    password: DOCKER_CONFIG.POSTGRES_PASSWORD,
    logging: false, // 测试时关闭SQL日志
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
};

/**
 * Docker环境测试套件基类
 */
class DockerTestSuite {
  constructor(suiteName) {
    this.suiteName = suiteName;
    this.sequelize = null;
    this.app = null;
  }

  async setupDockerTest() {
    console.log(`🐳 [${this.suiteName}] 初始化Docker测试环境...`);
    
    // 检查Docker环境
    const envCheck = await checkDockerEnvironment();
    if (!envCheck.backend) {
      throw new Error('Docker后端服务不可用，请检查docker-compose up -d');
    }

    // 连接Docker数据库
    this.sequelize = getDockerDatabaseConnection();
    
    try {
      await this.sequelize.authenticate();
      console.log(`✅ [${this.suiteName}] Docker数据库连接成功`);
    } catch (error) {
      throw new Error(`Docker数据库连接失败: ${error.message}`);
    }

    // 设置测试app（指向Docker服务）
    this.app = DOCKER_CONFIG.BACKEND_URL;
    
    console.log(`✅ [${this.suiteName}] Docker测试环境就绪`);
  }

  async teardownDockerTest() {
    if (this.sequelize) {
      await this.sequelize.close();
      console.log(`🐳 [${this.suiteName}] Docker数据库连接已关闭`);
    }
  }

  // Docker环境API测试辅助方法
  async dockerApiRequest(method, path, data = null, token = null) {
    const req = request(this.app)[method.toLowerCase()](path);
    
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    
    if (data) {
      req.send(data);
    }
    
    return req;
  }
}

module.exports = {
  DOCKER_CONFIG,
  checkDockerEnvironment,
  getDockerDatabaseConnection,
  DockerTestSuite
}; 