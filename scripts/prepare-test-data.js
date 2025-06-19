#!/usr/bin/env node

/**
 * 测试数据准备脚本
 * 为 EngageLab Webhook 测试创建必要的测试数据
 */

const path = require('path');

// 设置环境变量
process.env.NODE_ENV = 'development';

// 引入后端模块
const configPath = path.join(__dirname, '../src/backend/src/config');
const modelsPath = path.join(__dirname, '../src/backend/src/models');

const config = require(configPath);
const { 
  User, 
  EmailService, 
  Sender, 
  Contact,
  sequelize 
} = require(modelsPath);

/**
 * 创建测试用户
 */
async function createTestUsers() {
  console.log('📝 创建测试用户...');
  
  const testUsers = [
    {
      username: 'test_service_user',
      email: 'service@yourdomain.com',
      password_hash: 'test123456', // 这会被hook自动加密
      role: 'admin',
      is_active: true
    },
    {
      username: 'test_support_user', 
      email: 'support@yourdomain.com',
      password_hash: 'test123456', // 这会被hook自动加密
      role: 'operator',
      is_active: true
    }
  ];
  
  const createdUsers = [];
  for (const userData of testUsers) {
    try {
      const [user, created] = await User.findOrCreate({
        where: { email: userData.email },
        defaults: userData
      });
      
      if (created) {
        console.log(`✅ 创建用户: ${user.email}`);
      } else {
        console.log(`ℹ️ 用户已存在: ${user.email}`);
      }
      
      createdUsers.push(user);
    } catch (error) {
      console.error(`❌ 创建用户失败 ${userData.email}:`, error.message);
    }
  }
  
  return createdUsers;
}

/**
 * 创建测试邮件服务
 */
async function createTestEmailServices(users) {
  console.log('📧 创建测试邮件服务...');
  
  const testServices = [
    {
      name: '测试客服邮件服务',
      provider: 'engagelab',
      domain: 'yourdomain.com',
      api_key: 'test_api_key_123',
      api_secret: 'test_api_secret_456',
      daily_quota: 1000,
      is_enabled: true
    },
    {
      name: '测试技术支持邮件服务',
      provider: 'engagelab', 
      domain: 'yourdomain.com',
      api_key: 'test_api_key_789',
      api_secret: 'test_api_secret_012',
      daily_quota: 500,
      is_enabled: true
    }
  ];
  
  const createdServices = [];
  for (const serviceData of testServices) {
    try {
      const [service, created] = await EmailService.findOrCreate({
        where: { name: serviceData.name },
        defaults: serviceData
      });
      
      if (created) {
        console.log(`✅ 创建邮件服务: ${service.name}`);
      } else {
        console.log(`ℹ️ 邮件服务已存在: ${service.name}`);
      }
      
      createdServices.push(service);
    } catch (error) {
      console.error(`❌ 创建邮件服务失败 ${serviceData.name}:`, error.message);
    }
  }
  
  return createdServices;
}

/**
 * 创建测试发信人
 */
async function createTestSenders(users) {
  console.log('👤 创建测试发信人...');
  
  const testSenders = [
    {
      name: 'service_team',
      display_name: '客服团队',
      user_id: users[0].id
    },
    {
      name: 'tech_support',
      display_name: '技术支持', 
      user_id: users[1].id
    }
  ];
  
  const createdSenders = [];
  for (const senderData of testSenders) {
    try {
      const [sender, created] = await Sender.findOrCreate({
        where: { name: senderData.name, user_id: senderData.user_id },
        defaults: senderData
      });
      
      if (created) {
        console.log(`✅ 创建发信人: ${sender.display_name} (${sender.name})`);
      } else {
                  console.log(`ℹ️ 发信人已存在: ${sender.display_name} (${sender.name})`);
      }
      
      createdSenders.push(sender);
    } catch (error) {
      console.error(`❌ 创建发信人失败 ${senderData.name}:`, error.message);
    }
  }
  
  return createdSenders;
}

/**
 * 创建测试联系人
 */
async function createTestContacts(users) {
  console.log('📇 创建测试联系人...');
  
  const testContacts = [
    {
      name: '客户张三',
      email: 'customer@example.com',
      phone: '13800138001',
      user_id: users[0].id,
      source: 'manual',
      status: 'active'
    },
    {
      name: '新客户李四',
      email: 'newcustomer@example.com',
      phone: '13800138002', 
      user_id: users[1].id,
      source: 'manual',
      status: 'active'
    },
    {
      name: '测试联系人',
      email: 'test@example.com',
      phone: '13800138003',
      user_id: users[0].id,
      source: 'manual', 
      status: 'active'
    }
  ];
  
  const createdContacts = [];
  for (const contactData of testContacts) {
    try {
      const [contact, created] = await Contact.findOrCreate({
        where: { email: contactData.email },
        defaults: contactData
      });
      
      if (created) {
        console.log(`✅ 创建联系人: ${contact.name} (${contact.email})`);
      } else {
        console.log(`ℹ️ 联系人已存在: ${contact.name} (${contact.email})`);
      }
      
      createdContacts.push(contact);
    } catch (error) {
      console.error(`❌ 创建联系人失败 ${contactData.name}:`, error.message);
    }
  }
  
  return createdContacts;
}

/**
 * 验证数据库连接
 */
async function verifyDatabaseConnection() {
  try {
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功');
    return true;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始准备测试数据...\n');
  
  // 验证数据库连接
  const dbConnected = await verifyDatabaseConnection();
  if (!dbConnected) {
    process.exit(1);
  }
  
  try {
    // 创建测试数据
    const users = await createTestUsers();
    const emailServices = await createTestEmailServices(users);
    const senders = await createTestSenders(users);
    const contacts = await createTestContacts(users);
    
    console.log('\n📊 测试数据创建完成:');
    console.log(`👥 用户: ${users.length}`);
    console.log(`📧 邮件服务: ${emailServices.length}`);
    console.log(`👤 发信人: ${senders.length}`);
    console.log(`📇 联系人: ${contacts.length}`);
    
    console.log('\n🎯 测试环境准备就绪！');
    console.log('现在可以运行 webhook 测试脚本：');
    console.log('node scripts/test-engagelab-webhook.js');
    
  } catch (error) {
    console.error('❌ 准备测试数据失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // 关闭数据库连接
    await sequelize.close();
  }
}

// 运行主函数
if (require.main === module) {
  main();
}

module.exports = {
  createTestUsers,
  createTestEmailServices,
  createTestSenders,
  createTestContacts,
  verifyDatabaseConnection
}; 