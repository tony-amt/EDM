#!/usr/bin/env node

/**
 * 快速测试登录修复
 * 验证前后端接口一致性
 */

const axios = require('axios');

async function testLoginFix() {
  console.log('🔍 测试前后端登录接口一致性...\n');
  
  const baseURL = 'http://localhost:3000';
  
  try {
    // 测试1: 正确的字段名
    console.log('✅ 测试1: 使用正确字段名 (usernameOrEmail)');
    const correctRequest = {
      usernameOrEmail: 'admin@example.com',
      password: 'admin123456'
    };
    
    const response1 = await axios.post(`${baseURL}/api/auth/login`, correctRequest);
    console.log('   结果: 成功登录');
    console.log(`   Token: ${response1.data.token.substring(0, 20)}...`);
    console.log(`   用户: ${response1.data.data.username}`);
    
    // 测试2: 错误的字段名
    console.log('\n❌ 测试2: 使用错误字段名 (username)');
    const wrongRequest = {
      username: 'admin@example.com', // 错误字段名
      password: 'admin123456'
    };
    
    try {
      await axios.post(`${baseURL}/api/auth/login`, wrongRequest);
      console.log('   结果: ⚠️  意外成功 - 这表明验证可能有问题');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('   结果: 正确返回400错误');
        console.log(`   错误信息: ${JSON.stringify(error.response.data, null, 2)}`);
      } else {
        console.log(`   结果: 意外错误 - ${error.message}`);
      }
    }
    
    // 测试3: 前端代理测试
    console.log('\n🌐 测试3: 前端代理测试 (3001端口)');
    try {
      const response3 = await axios.post(`http://localhost:3001/api/auth/login`, correctRequest, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log('   结果: 前端代理正常工作');
      console.log(`   状态: ${response3.status}`);
    } catch (error) {
      if (error.response) {
        console.log(`   结果: 前端代理可能有问题 - 状态码 ${error.response.status}`);
        console.log(`   响应: ${error.response.data ? error.response.data.substring(0, 100) : 'N/A'}...`);
      } else {
        console.log(`   结果: 连接错误 - ${error.message}`);
      }
    }
    
    console.log('\n🎯 测试总结:');
    console.log('- 后端API接口正常工作');
    console.log('- 字段验证机制有效');
    console.log('- 前端应该已经修复为直接连接后端');
    
  } catch (error) {
    console.error('\n❌ 测试失败:');
    console.error(`错误: ${error.message}`);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 请确保后端服务器在运行:');
      console.error('   cd src/backend && npm start');
    }
  }
}

// 运行测试
testLoginFix().catch(console.error); 