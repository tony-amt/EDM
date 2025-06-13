#!/usr/bin/env node

/**
 * 邮件发送功能测试脚本
 * 用于验证Engage Lab API集成和邮件发送功能
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../src/backend/.env') });

const MailService = require('../src/backend/src/services/mail.service');
const config = require('../src/backend/src/config');

async function testEmailSending() {
  console.log('🚀 开始测试邮件发送功能...\n');

  // 1. 检查配置
  console.log('📋 步骤1: 检查Engage Lab API配置');
  console.log(`Base URL: ${config.engagelab.baseUrl || '未配置'}`);
  console.log(`API User: ${config.engagelab.apiUser ? '已配置' : '未配置'}`);
  console.log(`API Key: ${config.engagelab.apiKey ? '已配置' : '未配置'}\n`);

  if (!config.engagelab.apiUser || !config.engagelab.apiKey) {
    console.log('❌ Engage Lab API凭证未配置');
    console.log('请在 src/backend/.env 文件中添加:');
    console.log('ENGAGELAB_API_USER=your_api_user');
    console.log('ENGAGELAB_API_KEY=your_api_key');
    process.exit(1);
  }

  // 2. 创建邮件服务实例
  console.log('📋 步骤2: 创建邮件服务实例');
  const mailService = new MailService();

  // 3. 跳过API连接测试，直接测试邮件发送
  console.log('📋 步骤3: 跳过连接测试，直接测试邮件发送\n');
  
  // 注释掉连接测试，因为Engage Lab可能没有/user端点
  // try {
  //   const connectionOk = await mailService.testConnection();
  //   if (connectionOk) {
  //     console.log('✅ API连接测试成功\n');
  //   } else {
  //     console.log('❌ API连接测试失败\n');
  //     return;
  //   }
  // } catch (error) {
  //   console.log(`❌ API连接测试异常: ${error.message}\n`);
  //   return;
  // }

  // 4. 获取测试邮箱
  const testEmail = process.argv[2];
  if (!testEmail) {
    console.log('❌ 请提供测试邮箱地址');
    console.log('用法: node scripts/test-email-sending.js <your-email@example.com>');
    process.exit(1);
  }

  // 验证邮箱格式
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(testEmail)) {
    console.log('❌ 无效的邮箱地址格式');
    process.exit(1);
  }

  console.log(`📋 步骤4: 发送测试邮件到 ${testEmail}`);

  // 5. 构建邮件内容
  const mailOptions = mailService.buildMailOptions({
    from: 'A.MT邮件系统 <noreply@example.com>',
    to: testEmail,
    subject: '🎯 EDM系统邮件发送功能测试',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1890ff; margin-bottom: 10px;">🎯 EDM系统测试</h1>
          <p style="color: #666; font-size: 16px;">邮件发送功能验证</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
          <h3 style="color: #333; margin-top: 0;">✅ 测试成功！</h3>
          <p>如果您收到这封邮件，说明EDM系统的邮件发送功能正常工作。</p>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h4 style="color: #333;">📊 测试信息</h4>
          <ul style="color: #666; line-height: 1.8;">
            <li><strong>收件人:</strong> ${testEmail}</li>
            <li><strong>发送时间:</strong> ${new Date().toLocaleString('zh-CN')}</li>
            <li><strong>系统环境:</strong> ${process.env.NODE_ENV || 'development'}</li>
            <li><strong>API提供商:</strong> Engage Lab</li>
            <li><strong>测试ID:</strong> ${Date.now()}</li>
          </ul>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h4 style="color: #333;">🔧 系统功能验证</h4>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <span style="background: #52c41a; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">✓ API集成正常</span>
            <span style="background: #52c41a; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">✓ 认证配置正确</span>
            <span style="background: #52c41a; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">✓ 邮件格式正确</span>
            <span style="background: #52c41a; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">✓ 模板渲染正常</span>
          </div>
        </div>
        
        <div style="border-top: 1px solid #eee; padding-top: 20px; color: #999; font-size: 12px; text-align: center;">
          <p>此邮件由EDM系统自动发送，用于功能测试 • 请勿回复</p>
          <p>如有问题，请联系系统管理员</p>
        </div>
      </div>
    `,
    text: `
EDM系统邮件发送功能测试

✅ 测试成功！
如果您收到这封邮件，说明EDM系统的邮件发送功能正常工作。

📊 测试信息:
- 收件人: ${testEmail}
- 发送时间: ${new Date().toLocaleString('zh-CN')}
- 系统环境: ${process.env.NODE_ENV || 'development'}
- API提供商: Engage Lab
- 测试ID: ${Date.now()}

此邮件由EDM系统自动发送，用于功能测试，请勿回复。
    `,
    openTracking: true,
    clickTracking: true,
    customArgs: {
      test_type: 'functionality_test',
      timestamp: Date.now()
    }
  });

  // 6. 发送邮件
  try {
    console.log('📧 正在发送邮件...');
    console.log('邮件数据预览:');
    console.log(`  - 收件人: ${testEmail}`);
    console.log(`  - 主题: ${mailOptions.body.subject}`);
    console.log(`  - 内容长度: ${mailOptions.body.content.html.length} 字符\n`);

    const result = await mailService.sendMail(mailOptions);
    
    console.log('✅ 邮件发送成功！');
    console.log('响应结果:');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('\n🎉 测试完成！请检查您的邮箱是否收到测试邮件。');
    console.log('如果未收到邮件，请检查:');
    console.log('1. 垃圾邮件文件夹');
    console.log('2. 邮箱地址是否正确');
    console.log('3. Engage Lab API配置是否正确');
    
  } catch (error) {
    console.log('❌ 邮件发送失败');
    console.error('错误详情:', error.message);
    
    if (error.response) {
      console.error('API响应:', error.response);
    }
    
    console.log('\n🔧 故障排除建议:');
    console.log('1. 检查Engage Lab API凭证是否正确');
    console.log('2. 检查网络连接是否正常');
    console.log('3. 检查API配额是否充足');
    console.log('4. 检查发件人域名是否已验证');
  }
}

// 执行测试
if (require.main === module) {
  testEmailSending().catch(error => {
    console.error('测试脚本执行失败:', error);
    process.exit(1);
  });
}

module.exports = { testEmailSending }; 