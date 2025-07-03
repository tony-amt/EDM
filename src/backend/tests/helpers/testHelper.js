/**
 * 测试辅助函数
 */
const { sequelize } = require('../../src/models');
const { User } = require('../../src/models');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

/**
 * 设置测试数据库
 */
const setupTestDB = async () => {
  await sequelize.sync({ force: true });
  console.log('测试数据库已重置');
};

/**
 * 清理测试数据库
 */
const cleanupTestDB = async () => {
  await sequelize.close();
  console.log('测试数据库连接已关闭');
};

/**
 * 创建测试用户
 */
const createTestUser = async (userData = {}) => {
  const defaultData = {
    id: uuidv4(),
    username: `testuser_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    email: `test_${Date.now()}_${Math.random().toString(36).substr(2, 5)}@test.com`,
    password_hash: await bcrypt.hash('password123', 10), // 修正：使用password_hash而不是password
    role: 'operator',
    is_active: true,
    remaining_quota: 1000
  };

  const user = await User.create({
    ...defaultData,
    ...userData
  });

  return user;
};

/**
 * 获取认证token
 */
const getAuthToken = async (user) => {
  const payload = {
    id: user.id,
    role: user.role
  };

  return jwt.sign(payload, process.env.JWT_SECRET || 'test-jwt-secret', {
    expiresIn: '24h'
  });
};

/**
 * 创建测试管理员用户
 */
const createTestAdmin = async () => {
  return createTestUser({ role: 'admin' });
};

/**
 * 等待异步操作
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
  setupTestDB,
  cleanupTestDB,
  createTestUser,
  createTestAdmin,
  getAuthToken,
  delay
}; 