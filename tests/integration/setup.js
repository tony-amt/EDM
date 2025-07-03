const axios = require('axios');
const jwt = require('jsonwebtoken'); // 用于生成测试token
const db = require('../../src/backend/src/models'); // 导入 Sequelize 实例和模型
const backendConfig = require('../../src/backend/src/config'); // 导入后端配置 (用于JWT secret等)
const bcrypt = require('bcryptjs');
// const { startServer } = require('../../src/backend/src/index'); // 不再需要在这里导入 startServer, 由 run-tests.js 全局管理

// 🔧 【环境统一规范】强制使用开发环境，严禁环境分离
process.env.NODE_ENV = 'development';

const API_URL = `http://localhost:${backendConfig.server.port}/api`;

console.log('🔧 [环境统一] 集成测试配置:');
console.log('  - 环境: 开发环境 (超简化模式)');
console.log('  - 使用现有admin用户，无需创建测试用户');
console.log('  - API地址:', API_URL);

const setupTestEnvironment = async () => {
  console.log('🚀 设置集成测试环境（超简化模式）...');
  
  try {
    // 🔧 【环境统一】直接使用现有admin用户，无需数据库操作
    console.log('✅ 使用现有admin用户进行集成测试');
    
    // 创建API客户端，使用admin凭据登录获取真实token
    const tempClient = axios.create({ baseURL: API_URL, validateStatus: () => true });
    const loginResponse = await tempClient.post('/auth/login', {
      usernameOrEmail: 'admin',
      password: 'admin123456'
    });
    
    if (loginResponse.status !== 200) {
      throw new Error(`无法登录admin用户: ${JSON.stringify(loginResponse.data)}`);
    }

    const adminToken = loginResponse.data.token;
    const adminUser = loginResponse.data.data;
    
    console.log('✅ admin用户登录成功，获取到token');
    
    // 为了兼容测试用例，创建一个"测试用户"，实际上是admin的复制
    return {
      testUser: adminUser,  // 使用admin作为测试用户
      authToken: adminToken, 
      adminUser: adminUser,
      adminAuthToken: adminToken,
      apiClient: createApiClientWithToken(adminToken),
      adminApiClient: createApiClientWithToken(adminToken)
    };
  } catch (error) {
    console.error('❌ 集成测试环境设置失败:', error);
    throw error; 
  }
};

const teardownTestEnvironment = async () => {
  console.log('🧹 清理测试环境（无需操作）...');
  // 无需任何清理操作，因为没有创建测试数据
  console.log('✅ 清理完成');
};

// 辅助函数
const createApiClientWithToken = (token) => {
  const client = axios.create({ baseURL: API_URL, validateStatus: () => true });
  if (token) {
    client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
  return client;
};

const getTestUserApiClient = () => {
  const client = axios.create({ baseURL: API_URL, validateStatus: () => true });
  if (currentAuthToken) { // 使用模块作用域的 token
    client.defaults.headers.common['Authorization'] = `Bearer ${currentAuthToken}`;
  }
  return client;
};

const getAdminApiClient = () => {
    const client = axios.create({ baseURL: API_URL, validateStatus: () => true });
    if (currentAdminAuthToken) { // 使用模块作用域的 token
        client.defaults.headers.common['Authorization'] = `Bearer ${currentAdminAuthToken}`;
    }
    return client;
};

const randomString = (length = 8) => Math.random().toString(36).substring(2, length + 2);

const createTestContact = async (userId, customData = {}) => {
  if (!userId) throw new Error('userId is required for createTestContact');
  const defaultData = {
    email: `contact-${randomString()}@example.com`,
    user_id: userId, // 确保模型中的外键是 user_id
  };
  return db.Contact.create({ ...defaultData, ...customData });
};

const createTestTag = async (userId, customData = {}) => {
  if (!userId) throw new Error('userId is required for createTestTag');
  const defaultData = {
    name: `Tag-${randomString()}`,
    user_id: userId, // 确保模型中的外键是 user_id
  };
  return db.Tag.create({ ...defaultData, ...customData });
};

// 导出供测试文件使用
module.exports = {
  setupTestEnvironment,
  teardownTestEnvironment,
  createApiClientWithToken,
  db,
  API_URL,
  
  // 旧名称别名，保持向后兼容性
  setupDB: setupTestEnvironment,
  teardownDB: teardownTestEnvironment,
}; 