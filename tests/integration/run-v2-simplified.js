#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 启动 V2.0 简化集成测试套件...\n');

const testFiles = [
  'v2-senders.test.js',
  'v2-email-services.test.js', 
  'v2-user-quota.test.js'
];

async function runTest(testFile) {
  return new Promise((resolve, reject) => {
    console.log(`\n📋 运行测试: ${testFile}`);
    console.log('=' .repeat(50));
    
    const testProcess = spawn('npm', ['test', '--', testFile, '--verbose'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    testProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${testFile} 测试通过`);
        resolve({ file: testFile, success: true, code });
      } else {
        console.log(`❌ ${testFile} 测试失败 (退出码: ${code})`);
        resolve({ file: testFile, success: false, code });
      }
    });

    testProcess.on('error', (error) => {
      console.error(`❌ ${testFile} 测试执行错误:`, error.message);
      resolve({ file: testFile, success: false, error: error.message });
    });
  });
}

async function runAllTests() {
  const results = [];
  
  for (const testFile of testFiles) {
    const result = await runTest(testFile);
    results.push(result);
  }
  
  // 输出测试总结
  console.log('\n' + '='.repeat(60));
  console.log('📊 V2.0 集成测试总结');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ 通过: ${passed}/${results.length}`);
  console.log(`❌ 失败: ${failed}/${results.length}`);
  
  if (failed > 0) {
    console.log('\n❌ 失败的测试:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.file} (退出码: ${r.code || 'N/A'})`);
    });
  }
  
  console.log('\n🎯 V2.0 功能测试状态:');
  console.log('  📧 发信人管理: ' + (results.find(r => r.file.includes('senders'))?.success ? '✅' : '❌'));
  console.log('  ⚙️  发信服务管理: ' + (results.find(r => r.file.includes('email-services'))?.success ? '✅' : '❌'));
  console.log('  💰 用户额度管理: ' + (results.find(r => r.file.includes('user-quota'))?.success ? '✅' : '❌'));
  
  console.log('\n📝 下一步计划:');
  console.log('  🔄 路由引擎测试');
  console.log('  📨 群发调度增强测试');
  console.log('  🔍 健康检查功能测试');
  
  process.exit(failed > 0 ? 1 : 0);
}

// 检查是否在正确的目录
if (!process.cwd().endsWith('tests/integration')) {
  console.error('❌ 请在 tests/integration 目录下运行此脚本');
  process.exit(1);
}

runAllTests().catch(error => {
  console.error('❌ 测试运行器出错:', error);
  process.exit(1);
}); 