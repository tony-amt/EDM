#!/usr/bin/env node

/**
 * 验收前完整验证脚本
 * 确保系统真正可以验收，避免浪费用户时间
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const { execSync } = require('child_process');

async function validateSystem() {
  console.log('🔍 开始验收前系统验证...\n');
  
  let allTestsPassed = true;
  const results = [];
  
  try {
    // 1. 检查服务是否运行
    console.log('📋 检查1: 验证服务状态');
    try {
      await execAsync('curl -f http://localhost:3000/api/auth/test');
      results.push('✅ 后端服务正常运行');
    } catch (error) {
      results.push('❌ 后端服务未运行');
      allTestsPassed = false;
    }
    
    try {
      await execAsync('curl -f http://localhost:3001');
      results.push('✅ 前端服务正常运行');
    } catch (error) {
      results.push('❌ 前端服务未运行');
      allTestsPassed = false;
    }
    
    // 2. 检查API连通性
    console.log('📋 检查2: 验证API连通性');
    try {
      const { stdout } = await execAsync(`curl -X POST http://localhost:3000/api/auth/login \\
        -H "Content-Type: application/json" \\
        -d '{"usernameOrEmail":"admin@example.com","password":"admin123456"}' \\
        -s`);
      
      const response = JSON.parse(stdout);
      if (response.success && response.token) {
        results.push('✅ 登录API正常工作');
      } else {
        results.push('❌ 登录API返回异常');
        allTestsPassed = false;
      }
    } catch (error) {
      results.push('❌ 登录API不可访问');
      allTestsPassed = false;
    }
    
    // 3. 运行Playwright测试
    console.log('📋 检查3: 运行前端E2E测试');
    try {
      const result = execSync('npx playwright test tests/e2e/simple-login-test.spec.js --project=chromium --reporter=line', {
        encoding: 'utf8',
        timeout: 60000
      });
      
      if (result.includes('1 passed')) {
        results.push('✅ 前端E2E测试通过');
      } else {
        results.push('❌ 前端E2E测试失败');
        allTestsPassed = false;
      }
    } catch (error) {
      results.push('❌ 前端E2E测试执行失败');
      allTestsPassed = false;
    }
    
    // 4. 检查数据库连接
    console.log('📋 检查4: 验证数据库连接');
    try {
      // 先获取登录token
      const { stdout: loginResponse } = await execAsync(`curl -s -X POST http://localhost:3000/api/auth/login \\
        -H "Content-Type: application/json" \\
        -d '{"usernameOrEmail":"admin@example.com","password":"admin123456"}'`);
      
      const loginData = JSON.parse(loginResponse);
      if (!loginData.success || !loginData.token) {
        throw new Error('无法获取认证token');
      }
      
      // 使用token访问需要认证的API
      const { stdout } = await execAsync(`curl -s "http://localhost:3000/api/contacts?limit=1" \\
        -H "Authorization: Bearer ${loginData.token}"`);
      
      const response = JSON.parse(stdout);
      if (response.data && Array.isArray(response.data)) {
        results.push('✅ 数据库连接正常');
      } else {
        results.push('❌ 数据库连接异常');
        allTestsPassed = false;
      }
    } catch (error) {
      results.push('❌ 数据库连接检查失败');
      allTestsPassed = false;
    }
    
  } catch (error) {
    console.error('🚨 验证过程中发生错误:', error.message);
    allTestsPassed = false;
  }
  
  // 输出结果
  console.log('\\n📊 验证结果:');
  results.forEach(result => console.log(`  ${result}`));
  
  console.log('\\n' + '='.repeat(50));
  
  if (allTestsPassed) {
    console.log('🎉 **系统验收就绪！**');
    console.log('');
    console.log('📋 验收信息:');
    console.log('   地址: http://localhost:3001');
    console.log('   账号: admin@example.com');
    console.log('   密码: admin123456');
    console.log('');
    console.log('✅ 所有检查通过，可以进行验收');
    process.exit(0);
  } else {
    console.log('⚠️ **系统尚未就绪，请修复问题后再验收**');
    console.log('');
    console.log('🔧 建议修复步骤:');
    console.log('   1. 检查前后端服务是否正常启动');
    console.log('   2. 确认API接口字段名一致性');
    console.log('   3. 验证数据库连接和数据完整性');
    console.log('   4. 重新运行此验证脚本');
    process.exit(1);
  }
}

// 运行验证
validateSystem().catch(error => {
  console.error('🚨 验证脚本执行失败:', error.message);
  process.exit(1);
}); 