const request = require('supertest');
const { app } = require('./src/index');
const { setupTestDB, createTestUser, getAuthToken } = require('./tests/helpers/testHelper');

async function debugSenderAPI() {
  try {
    console.log('🔧 开始调试发信人API...');
    
    // 设置测试数据库
    await setupTestDB();
    console.log('✅ 测试数据库设置完成');
    
    // 创建测试用户
    const testUser = await createTestUser({ role: 'operator' });
    console.log('✅ 测试用户创建:', testUser.id, testUser.username);
    
    // 获取认证token
    const token = await getAuthToken(testUser);
    console.log('✅ JWT Token生成:', token.substring(0, 50) + '...');
    
    // 测试创建发信人
    const senderData = {
      name: 'debug-sender',
      display_name: '调试发信人'
    };
    
    console.log('🚀 发送创建发信人请求...');
    const response = await request(app)
      .post('/api/senders')
      .set('Authorization', `Bearer ${token}`)
      .send(senderData);
    
    console.log('📊 响应状态:', response.status);
    console.log('📊 响应内容:', response.body);
    
    if (response.status === 201) {
      console.log('🎉 发信人创建成功！');
    } else {
      console.log('❌ 发信人创建失败');
    }
    
  } catch (error) {
    console.error('💥 调试过程出错:', error.message);
    console.error(error.stack);
  }
  
  process.exit(0);
}

debugSenderAPI(); 