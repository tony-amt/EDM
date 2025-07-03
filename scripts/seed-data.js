#!/usr/bin/env node

/**
 * 测试数据种子脚本
 * 创建基础测试数据用于验收测试
 */

const { connectDB, sequelize } = require('../src/backend/src/models');
const bcrypt = require('bcryptjs');

async function seedData() {
  console.log('🌱 开始创建测试数据...');
  
  try {
    await connectDB();
    
    // 获取模型
    const { User, Tag, Contact, Template, Campaign, Task, TemplateSet } = sequelize.models;
    
    // 1. 创建测试用户
    console.log('👤 创建测试用户...');
    
    const [adminUser, adminCreated] = await User.findOrCreate({
      where: { username: 'admin' },
      defaults: {
        username: 'admin',
        email: 'admin@example.com',
        password_hash: '123456', // 让模型的hook处理哈希
        role: 'admin'
      }
    });
    
    const [operatorUser, operatorCreated] = await User.findOrCreate({
      where: { username: 'operator' },
      defaults: {
        username: 'operator',
        email: 'operator@example.com',
        password_hash: '123456', // 让模型的hook处理哈希
        role: 'operator'
      }
    });
    
    console.log('✅ 用户创建完成');
    
    // 2. 创建测试标签
    console.log('🏷️ 创建测试标签...');
    const tags = [
      { name: '重要客户', description: '高价值客户', user_id: adminUser.id },
      { name: '潜在客户', description: '有购买意向的客户', user_id: adminUser.id },
      { name: '已成交', description: '已完成交易的客户', user_id: adminUser.id },
      { name: 'VIP客户', description: 'VIP级别客户', user_id: adminUser.id },
      { name: '流失客户', description: '长期未联系的客户', user_id: adminUser.id }
    ];
    
    for (const tagData of tags) {
      await Tag.findOrCreate({
        where: { name: tagData.name, user_id: tagData.user_id },
        defaults: tagData
      });
    }
    
    console.log('✅ 标签创建完成');
    
    // 3. 创建测试联系人
    console.log('👥 创建测试联系人...');
    const contacts = [
      {
        email: 'zhang.san@example.com',
        name: '张三',
        status: 'active',
        source: 'manual',
        phone: '13800138001',
        company: '测试公司A',
        position: '产品经理',
        user_id: adminUser.id
      },
      {
        email: 'li.si@example.com',
        name: '李四',
        status: 'active',
        source: 'import',
        phone: '13800138002',
        company: '测试公司B',
        position: '技术总监',
        user_id: adminUser.id
      },
      {
        email: 'wang.wu@example.com',
        name: '王五',
        status: 'active',
        source: 'manual',
        phone: '13800138003',
        company: '测试公司C',
        position: '市场经理',
        user_id: adminUser.id
      }
    ];
    
    for (const contactData of contacts) {
      await Contact.findOrCreate({
        where: { email: contactData.email, user_id: contactData.user_id },
        defaults: contactData
      });
    }
    
    console.log('✅ 联系人创建完成');
    
    // 4. 创建测试模板
    console.log('📧 创建测试模板...');
    const templates = [
      {
        name: '欢迎邮件模板',
        subject: '欢迎加入我们！',
        body: '<h1>欢迎！</h1><p>感谢您的关注，我们将为您提供最优质的服务。</p>',
        user_id: adminUser.id
      },
      {
        name: '产品推广模板',
        subject: '新产品发布通知',
        body: '<h2>新产品上线</h2><p>我们很高兴地宣布新产品正式发布！</p>',
        user_id: adminUser.id
      }
    ];
    
    for (const templateData of templates) {
      await Template.findOrCreate({
        where: { name: templateData.name, user_id: templateData.user_id },
        defaults: templateData
      });
    }
    
    console.log('✅ 模板创建完成');
    
    // 5. 创建测试活动
    console.log('📢 创建测试活动...');
    const campaigns = [
      {
        name: '春季促销活动',
        description: '春季产品促销推广活动',
        status: 'draft',
        user_id: adminUser.id
      },
      {
        name: '新用户欢迎系列',
        description: '新用户注册后的欢迎邮件系列',
        status: 'active',
        user_id: adminUser.id
      }
    ];
    
    for (const campaignData of campaigns) {
      await Campaign.findOrCreate({
        where: { name: campaignData.name, user_id: campaignData.user_id },
        defaults: campaignData
      });
    }
    
    console.log('✅ 活动创建完成');
    
    // 6. 创建测试模板集
    console.log('📦 创建测试模板集...');
    const templateSets = [
      {
        name: '欢迎邮件系列',
        user_id: adminUser.id
      },
      {
        name: '营销推广系列',
        user_id: adminUser.id
      }
    ];
    
    const createdTemplateSets = [];
    for (const templateSetData of templateSets) {
      const [templateSet] = await TemplateSet.findOrCreate({
        where: { name: templateSetData.name, user_id: templateSetData.user_id },
        defaults: templateSetData
      });
      createdTemplateSets.push(templateSet);
    }
    
    console.log('✅ 模板集创建完成');
    
    // 7. 创建测试任务
    console.log('📋 创建测试任务...');
    const createdCampaigns = await Campaign.findAll({ where: { user_id: adminUser.id } });
    
    const tasks = [
      {
        name: '发送欢迎邮件',
        status: 'scheduled',
        plan_time: new Date(Date.now() + 60 * 60 * 1000), // 1小时后
        user_id: adminUser.id,
        campaign_id: createdCampaigns[0].id,
        template_set_id: createdTemplateSets[0].id,
        recipient_rule: { type: 'ALL_CONTACTS' }
      },
      {
        name: '客户回访任务',
        status: 'finished',
        plan_time: new Date(Date.now() - 24 * 60 * 60 * 1000), // 昨天
        actual_start_time: new Date(Date.now() - 24 * 60 * 60 * 1000),
        actual_finish_time: new Date(Date.now() - 23 * 60 * 60 * 1000),
        user_id: adminUser.id,
        campaign_id: createdCampaigns[1].id,
        template_set_id: createdTemplateSets[1].id,
        recipient_rule: { type: 'TAG_BASED', include_tags: ['重要客户'] }
      }
    ];
    
    for (const taskData of tasks) {
      await Task.findOrCreate({
        where: { name: taskData.name, user_id: taskData.user_id },
        defaults: taskData
      });
    }
    
    console.log('✅ 任务创建完成');
    
    console.log('\n🎉 测试数据创建完成！');
    console.log('\n📋 创建的测试数据:');
    console.log('👤 用户账号:');
    console.log('   - admin / 123456 (管理员)');
    console.log('   - operator / 123456 (操作员)');
    console.log('🏷️ 标签: 5个测试标签');
    console.log('👥 联系人: 3个测试联系人');
    console.log('📧 模板: 2个邮件模板');
    console.log('📢 活动: 2个测试活动');
    console.log('📋 任务: 2个测试任务');
    
  } catch (error) {
    console.error('❌ 创建测试数据失败:', error);
  } finally {
    process.exit(0);
  }
}

seedData(); 