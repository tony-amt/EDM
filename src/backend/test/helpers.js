const request = require('supertest');
const app = require('../src/index');
const { sequelize } = require('../src/models');
const jwt = require('jsonwebtoken');
const config = require('../src/config');

/**
 * 清理数据库表
 * @param {Array} models - 要清理的模型数组
 * @returns {Promise} - 清理完成的Promise
 */
const clearTables = async (models) => {
  const transaction = await sequelize.transaction();
  try {
    for (const model of models) {
      await model.destroy({ 
        where: {}, 
        truncate: true, 
        cascade: true, 
        force: true,
        transaction
      });
    }
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * 登录获取令牌
 * @param {Object} credentials - 登录凭据
 * @returns {Promise<String>} - JWT令牌
 */
const getToken = async (credentials = global.testData.admin) => {
  const res = await request(app)
    .post('/api/auth/login')
    .send(credentials);
  
  if (res.statusCode !== 200 || !res.body.token) {
    throw new Error('获取测试令牌失败');
  }
  
  return res.body.token;
};

/**
 * 生成一个有效的JWT令牌
 * @param {Object} payload - 令牌负载
 * @returns {String} - JWT令牌
 */
const generateToken = (payload = { id: 1 }) => {
  return jwt.sign(payload, config.jwt.secret, { 
    expiresIn: config.jwt.expiresIn 
  });
};

/**
 * 创建测试用户
 * @param {Object} userData - 用户数据
 * @param {String} token - 管理员令牌
 * @returns {Promise<Object>} - 创建的用户
 */
const createTestUser = async (userData, token) => {
  const res = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${token}`)
    .send(userData);
  
  if (res.statusCode !== 201 || !res.body.data) {
    throw new Error('创建测试用户失败');
  }
  
  return res.body.data;
};

/**
 * 创建测试标签
 * @param {Object} tagData - 标签数据
 * @param {String} token - 令牌
 * @returns {Promise<Object>} - 创建的标签
 */
const createTestTag = async (tagData = global.testData.tag, token) => {
  const res = await request(app)
    .post('/api/tags')
    .set('Authorization', `Bearer ${token}`)
    .send(tagData);
  
  if (res.statusCode !== 201 || !res.body.data) {
    throw new Error('创建测试标签失败');
  }
  
  return res.body.data;
};

/**
 * 创建测试联系人
 * @param {Object} contactData - 联系人数据
 * @param {String} token - 令牌
 * @returns {Promise<Object>} - 创建的联系人
 */
const createTestContact = async (contactData, token) => {
  const res = await request(app)
    .post('/api/contacts')
    .set('Authorization', `Bearer ${token}`)
    .send(contactData);
  
  if (res.statusCode !== 201 || !res.body.data) {
    throw new Error('创建测试联系人失败');
  }
  
  return res.body.data;
};

module.exports = {
  clearTables,
  getToken,
  generateToken,
  createTestUser,
  createTestTag,
  createTestContact
}; 