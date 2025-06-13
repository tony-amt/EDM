/**
 * 创建初始管理员账户的脚本
 */
require('dotenv').config();
// const mongoose = require('mongoose'); // 移除 Mongoose
const db = require('../models');
const { User } = db;
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

async function createAdminUser() {
  try {
    console.log('开始创建管理员用户...');
    
    // 检查管理员用户是否已存在
    const existingAdmin = await User.findOne({
      where: {
        username: config.adminUser.username,
      }
    });
    
    if (existingAdmin) {
      console.log('管理员用户已存在，无需重新创建');
      process.exit(0);
    }
    
    // 创建管理员用户 - 直接传递明文密码，让模型的hook处理哈希
    const admin = await User.create({
      id: uuidv4(),
      username: config.adminUser.username,
      email: config.adminUser.email,
      password_hash: config.adminUser.password, // 传递明文密码，模型hook会自动哈希
      role: 'admin',
      is_active: true
    });
    
    console.log('管理员用户创建成功:', {
      username: admin.username,
      email: admin.email,
      role: admin.role
    });
    
    process.exit(0);
  } catch (error) {
    console.error('创建管理员用户失败:', error);
    process.exit(1);
  }
}

// 连接数据库并创建管理员用户
(async () => {
  try {
    // 连接数据库
    console.log('连接数据库...');
    await db.sequelize.authenticate();
    console.log('数据库连接成功');
    
    // 创建管理员用户
    await createAdminUser();
  } catch (error) {
    console.error('数据库连接失败:', error);
    process.exit(1);
  }
})();

module.exports = createAdminUser; // 也导出函数，方便其他地方调用 