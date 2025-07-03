#!/usr/bin/env node

/**
 * 创建种子数据脚本
 * 添加两个种子邮箱用于测试邮件发送功能
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../src/backend/.env') });

// 引入数据库模型
const db = require('../src/backend/src/models');

async function createSeedData() {
  console.log('🌱 开始创建种子数据...\n');

  try {
    // 确保数据库连接
    await db.sequelize.authenticate();
    console.log('✅ 数据库连接成功');

    // 获取管理员用户
    console.log('\n📋 获取管理员用户:');
    const adminUser = await db.User.findOne({
      where: { email: 'admin@example.com' }
    });
    
    if (!adminUser) {
      console.error('❌ 管理员用户未找到，请先确保管理员用户存在');
      return;
    }
    
    console.log(`  - 找到管理员: ${adminUser.email} (ID: ${adminUser.id})`);

    // 创建种子标签
    console.log('\n📋 创建种子标签:');
    const seedTags = [
      { name: '种子用户', description: '用于邮件发送测试的种子用户' },
      { name: '测试账户', description: '邮件功能测试专用账户' },
      { name: 'Gmail用户', description: 'Gmail邮箱用户' }
    ];

    const createdTags = [];
    for (const tagData of seedTags) {
      const [tag, created] = await db.Tag.findOrCreate({
        where: { 
          user_id: adminUser.id,
          name: tagData.name 
        },
        defaults: {
          ...tagData,
          user_id: adminUser.id
        }
      });
      createdTags.push(tag);
      console.log(`  - ${created ? '创建' : '已存在'}: ${tag.name}`);
    }

    // 创建种子联系人
    console.log('\n📋 创建种子联系人:');
    const seedContacts = [
      {
        email: 'gloda2024@gmail.com',
        first_name: 'Gloda',
        last_name: 'Test',
        company: 'Gloda Market',
        position: '产品经理',
        phone: '+1234567890',
        status: 'active',
        custom_field_1: '种子邮箱1 - 用于邮件发送功能测试',
        tags: ['种子用户', '测试账户', 'Gmail用户']
      },
      {
        email: 'zhangton58@gmail.com',
        first_name: 'Zhang',
        last_name: 'Ton',
        company: 'Tech Solutions',
        position: '技术总监',
        phone: '+1234567891',
        status: 'active',
        custom_field_1: '种子邮箱2 - 用于邮件发送功能测试',
        tags: ['种子用户', '测试账户', 'Gmail用户']
      }
    ];

    const createdContacts = [];
    for (const contactData of seedContacts) {
      const { tags, ...contact } = contactData;
      
      const [contactRecord, created] = await db.Contact.findOrCreate({
        where: { email: contact.email },
        defaults: {
          ...contact,
          user_id: adminUser.id
        }
      });
      
      // 为联系人添加标签
      if (created) {
        for (const tagName of tags) {
          const tag = createdTags.find(t => t.name === tagName);
          if (tag) {
            await db.ContactTag.findOrCreate({
              where: {
                contact_id: contactRecord.id,
                tag_id: tag.id
              }
            });
          }
        }
      }
      
      createdContacts.push(contactRecord);
      console.log(`  - ${created ? '创建' : '已存在'}: ${contactRecord.email} (${contactRecord.first_name} ${contactRecord.last_name})`);
    }

    // 创建测试邮件模板
    console.log('\n📋 创建测试邮件模板:');
    const testTemplate = {
      name: '种子邮箱测试模板',
      subject: '🎯 EDM系统邮件发送功能测试 - {{contact.first_name}}您好',
      body: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1890ff; margin-bottom: 10px;">🎯 EDM系统测试</h1>
            <p style="color: #666; font-size: 16px;">邮件发送功能验证</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
            <h3 style="color: #333; margin-top: 0;">尊敬的 {{contact.first_name}} {{contact.last_name}}，</h3>
            <p>感谢您参与EDM系统的邮件发送功能测试！</p>
            <p>如果您收到这封邮件，说明我们的邮件发送功能正常工作。</p>
          </div>
          
          <div style="margin-bottom: 20px;">
            <h4 style="color: #333;">📊 您的信息</h4>
            <ul style="color: #666; line-height: 1.8;">
              <li><strong>姓名:</strong> {{contact.first_name}} {{contact.last_name}}</li>
              <li><strong>邮箱:</strong> {{contact.email}}</li>
              <li><strong>公司:</strong> {{contact.company}}</li>
              <li><strong>职位:</strong> {{contact.position}}</li>
            </ul>
          </div>
          
          <div style="margin-bottom: 20px;">
            <h4 style="color: #333;">🔧 系统功能验证</h4>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
              <span style="background: #52c41a; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">✓ Engage Lab API</span>
              <span style="background: #52c41a; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">✓ 模板渲染</span>
              <span style="background: #52c41a; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">✓ 变量替换</span>
              <span style="background: #52c41a; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">✓ HTML格式</span>
            </div>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; color: #999; font-size: 12px; text-align: center;">
            <p>此邮件由EDM系统自动发送，用于功能测试 • 请勿回复</p>
            <p>测试时间: {{current_time}} • 测试ID: {{test_id}}</p>
          </div>
        </div>
      `,
      textContent: `
尊敬的 {{contact.first_name}} {{contact.last_name}}，

感谢您参与EDM系统的邮件发送功能测试！

您的信息:
- 姓名: {{contact.first_name}} {{contact.last_name}}
- 邮箱: {{contact.email}}
- 公司: {{contact.company}}
- 职位: {{contact.position}}

如果您收到这封邮件，说明我们的邮件发送功能正常工作。

此邮件由EDM系统自动发送，用于功能测试，请勿回复。
测试时间: {{current_time}}
测试ID: {{test_id}}
      `,
      category: 'general',
      user_id: adminUser.id
    };

    const [template, templateCreated] = await db.Template.findOrCreate({
      where: { 
        user_id: adminUser.id,
        name: testTemplate.name 
      },
      defaults: testTemplate
    });
    
    console.log(`  - ${templateCreated ? '创建' : '已存在'}: ${template.name}`);

    console.log('\n✅ 种子数据创建完成！');
    console.log('\n📊 创建汇总:');
    console.log(`  - 种子联系人: ${createdContacts.length} 个`);
    console.log(`  - 种子标签: ${createdTags.length} 个`);
    console.log(`  - 测试模板: 1 个`);
    console.log('\n🎯 种子邮箱列表:');
    createdContacts.forEach(contact => {
      console.log(`  - ${contact.email} (${contact.first_name} ${contact.last_name})`);
    });

  } catch (error) {
    console.error('❌ 创建种子数据时发生错误:', error.message);
    console.error('详细错误:', error);
  } finally {
    // 关闭数据库连接
    await db.sequelize.close();
    console.log('\n🔌 数据库连接已关闭');
  }
}

// 执行创建
if (require.main === module) {
  createSeedData().catch(error => {
    console.error('种子数据创建脚本执行失败:', error);
    process.exit(1);
  });
}

module.exports = { createSeedData }; 