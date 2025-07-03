#!/usr/bin/env node

/**
 * 种子邮箱邮件发送测试脚本
 * 向两个种子邮箱发送测试邮件
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../src/backend/.env') });

const MailService = require('../src/backend/src/services/mail.service');
const db = require('../src/backend/src/models');

// 模板变量替换函数
function replaceTemplateVariables(template, contact, extraVars = {}) {
  let content = template;
  
  // 替换联系人变量
  content = content.replace(/\{\{contact\.first_name\}\}/g, contact.first_name || '');
  content = content.replace(/\{\{contact\.last_name\}\}/g, contact.last_name || '');
  content = content.replace(/\{\{contact\.email\}\}/g, contact.email || '');
  content = content.replace(/\{\{contact\.company\}\}/g, contact.company || '');
  content = content.replace(/\{\{contact\.position\}\}/g, contact.position || '');
  
  // 替换额外变量
  Object.keys(extraVars).forEach(key => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    content = content.replace(regex, extraVars[key]);
  });
  
  return content;
}

async function testSeedEmails() {
  console.log('🎯 开始种子邮箱邮件发送测试...\n');

  try {
    // 数据库连接
    await db.sequelize.authenticate();
    console.log('✅ 数据库连接成功');

    // 创建邮件服务实例
    const mailService = new MailService();

    // 获取种子联系人
    console.log('\n📋 获取种子联系人:');
    const seedContacts = await db.Contact.findAll({
      where: {
        email: {
          [db.Sequelize.Op.in]: ['gloda2024@gmail.com', 'zhangton58@gmail.com']
        }
      },
      include: [
        {
          model: db.Tag,
          as: 'tags',
          where: { name: '种子用户' },
          through: { attributes: [] }
        }
      ]
    });

    if (seedContacts.length === 0) {
      console.error('❌ 未找到种子联系人，请先运行 node scripts/create-seed-data.js');
      return;
    }

    console.log(`找到 ${seedContacts.length} 个种子联系人:`);
    seedContacts.forEach(contact => {
      console.log(`  - ${contact.email} (${contact.first_name} ${contact.last_name})`);
    });

    // 获取测试模板
    console.log('\n📋 获取测试模板:');
    const template = await db.Template.findOne({
      where: { name: '种子邮箱测试模板' }
    });

    if (!template) {
      console.error('❌ 未找到测试模板，请先运行 node scripts/create-seed-data.js');
      return;
    }

    console.log(`  - 找到模板: ${template.name}`);

    // 发送邮件到每个种子邮箱
    console.log('\n📧 开始发送邮件:');
    const results = [];

    for (const contact of seedContacts) {
      try {
        console.log(`\n正在发送邮件到: ${contact.email}...`);

        // 准备模板变量
        const templateVars = {
          current_time: new Date().toLocaleString('zh-CN'),
          test_id: Date.now()
        };

        // 替换模板变量
        const subject = replaceTemplateVariables(template.subject, contact, templateVars);
        const htmlContent = replaceTemplateVariables(template.body, contact, templateVars);
        const textContent = replaceTemplateVariables(template.textContent, contact, templateVars);

        // 构建邮件选项
        const mailOptions = mailService.buildMailOptions({
          from: 'A.MT邮件系统 <noreply@glodamarket.fun>',
          to: contact.email,
          subject: subject,
          html: htmlContent,
          text: textContent,
          openTracking: true,
          clickTracking: true,
          customArgs: {
            contact_id: contact.id,
            template_id: template.id,
            test_type: 'seed_email_test',
            timestamp: Date.now()
          }
        });

        // 发送邮件
        const result = await mailService.sendMail(mailOptions);
        
        console.log(`✅ 发送成功 - ${contact.email}`);
        console.log(`   邮件ID: ${result.message_id || 'N/A'}`);
        
        results.push({
          email: contact.email,
          name: `${contact.first_name} ${contact.last_name}`,
          success: true,
          messageId: result.message_id,
          result: result
        });

        // 短暂延迟避免频率限制
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ 发送失败 - ${contact.email}: ${error.message}`);
        results.push({
          email: contact.email,
          name: `${contact.first_name} ${contact.last_name}`,
          success: false,
          error: error.message
        });
      }
    }

    // 输出测试结果
    console.log('\n📊 测试结果汇总:');
    console.log('=' * 50);
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`总数: ${results.length}`);
    console.log(`成功: ${successful.length}`);
    console.log(`失败: ${failed.length}`);
    console.log(`成功率: ${(successful.length / results.length * 100).toFixed(1)}%`);
    
    if (successful.length > 0) {
      console.log('\n✅ 发送成功的邮箱:');
      successful.forEach(result => {
        console.log(`  - ${result.email} (${result.name})`);
        console.log(`    邮件ID: ${result.messageId}`);
      });
    }
    
    if (failed.length > 0) {
      console.log('\n❌ 发送失败的邮箱:');
      failed.forEach(result => {
        console.log(`  - ${result.email} (${result.name})`);
        console.log(`    错误: ${result.error}`);
      });
    }

    console.log('\n🎉 种子邮箱测试完成！');
    console.log('\n📋 请检查以下邮箱是否收到测试邮件:');
    console.log('  - gloda2024@gmail.com');
    console.log('  - zhangton58@gmail.com');
    console.log('\n💡 注意: 如果未收到邮件，请检查垃圾邮件文件夹');

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message);
    console.error('详细错误:', error);
  } finally {
    // 关闭数据库连接
    await db.sequelize.close();
    console.log('\n🔌 数据库连接已关闭');
  }
}

// 执行测试
if (require.main === module) {
  testSeedEmails().catch(error => {
    console.error('种子邮箱测试脚本执行失败:', error);
    process.exit(1);
  });
}

module.exports = { testSeedEmails }; 