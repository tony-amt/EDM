const axios = require('axios');

// 🔧 【环境统一规范】使用Docker环境配置
const API_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';

console.log('🔧 [环境统一] 集成测试配置 (Docker版本):');
console.log('  - 环境: Docker开发环境');
console.log('  - 使用现有admin用户，无需创建测试用户');
console.log('  - API地址:', API_URL);

const setupTestEnvironment = async () => {
  console.log('🚀 设置集成测试环境（Docker模式）...');
  
  try {
    // 等待服务就绪
    await waitForService();
    
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

const waitForService = async (maxRetries = 30, retryInterval = 1000) => {
  console.log('⏳ 等待Docker服务就绪...');
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await axios.get('http://localhost:3000/health', { timeout: 5000 });
      if (response.status === 200) {
        console.log('✅ Docker服务已就绪');
        return;
      }
    } catch (error) {
      if (i === maxRetries - 1) {
        throw new Error(`Docker服务在 ${maxRetries * retryInterval / 1000} 秒后仍未就绪`);
      }
      console.log(`⏳ 等待服务启动... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }
  }
};

const teardownTestEnvironment = async () => {
  console.log('🧹 清理测试环境（Docker模式，无需操作）...');
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

const randomString = (length = 8) => Math.random().toString(36).substring(2, length + 2);

// 导出供测试文件使用
module.exports = {
  setupTestEnvironment,
  teardownTestEnvironment,
  createApiClientWithToken,
  API_URL,
  
  // 旧名称别名，保持向后兼容性
  setupDB: setupTestEnvironment,
  teardownDB: teardownTestEnvironment,
}; 