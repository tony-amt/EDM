#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 启动 V2.0 集成测试套件');
console.log('==========================================');

// 测试配置
const TEST_CONFIG = {
  timeout: 300000, // 5分钟超时
  verbose: true,
  maxWorkers: 1, // 串行执行避免资源冲突
  detectOpenHandles: true,
  forceExit: true
};

// V2.0 测试文件列表
const V2_TEST_FILES = [
  'v2-senders.test.js',
  'v2-email-services.test.js', 
  'v2-user-quota.test.js'
];

// 检查Docker环境
async function checkDockerEnvironment() {
  console.log('🔧 检查Docker环境状态...');
  
  return new Promise((resolve, reject) => {
    const healthCheck = spawn('curl', ['-f', 'http://localhost:3000/health'], { 
      stdio: 'pipe' 
    });
    
    healthCheck.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Docker环境健康检查通过');
        resolve();
      } else {
        console.error('❌ Docker环境未就绪，请先启动系统：');
        console.error('   ./start-edm-system.sh');
        reject(new Error('Docker环境未就绪'));
      }
    });
  });
}

// 运行单个测试文件
async function runTestFile(testFile) {
  console.log(`\n📋 运行测试: ${testFile}`);
  console.log('------------------------------------------');
  
  const testPath = path.join(__dirname, testFile);
  
  // 检查测试文件是否存在
  if (!fs.existsSync(testPath)) {
    console.log(`⚠️ 测试文件不存在: ${testFile}`);
    return { success: false, reason: 'FILE_NOT_FOUND' };
  }
  
  return new Promise((resolve) => {
    const jest = spawn('npx', [
      'jest',
      testPath,
      '--verbose',
      '--no-cache',
      '--detectOpenHandles',
      '--forceExit',
      `--testTimeout=${TEST_CONFIG.timeout}`,
      '--maxWorkers=1'
    ], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    jest.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${testFile} - 测试通过`);
        resolve({ success: true, code });
      } else {
        console.log(`❌ ${testFile} - 测试失败 (退出码: ${code})`);
        resolve({ success: false, code });
      }
    });

    jest.on('error', (error) => {
      console.error(`❌ ${testFile} - 运行错误:`, error.message);
      resolve({ success: false, error: error.message });
    });
  });
}

// 运行所有V2.0测试
async function runV2IntegrationTests() {
  const startTime = Date.now();
  const results = [];
  
  console.log(`📊 准备运行 ${V2_TEST_FILES.length} 个V2.0集成测试文件`);
  
  try {
    // 检查Docker环境
    await checkDockerEnvironment();
    
    // 串行运行每个测试文件
    for (const testFile of V2_TEST_FILES) {
      const result = await runTestFile(testFile);
      results.push({
        file: testFile,
        ...result
      });
      
      // 如果测试失败，可以选择继续或停止
      if (!result.success) {
        console.log(`⚠️ ${testFile} 测试失败，继续执行后续测试...`);
      }
    }
    
  } catch (error) {
    console.error('❌ 测试环境检查失败:', error.message);
    return;
  }
  
  // 生成测试报告
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  console.log('\n🏁 V2.0 集成测试完成');
  console.log('==========================================');
  console.log(`📊 测试统计:`);
  console.log(`   总计: ${results.length} 个测试文件`);
  console.log(`   通过: ${results.filter(r => r.success).length} 个`);
  console.log(`   失败: ${results.filter(r => !r.success).length} 个`);
  console.log(`   耗时: ${duration} 秒`);
  
  // 详细结果
  console.log('\n📋 详细结果:');
  results.forEach(result => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    const reason = result.reason ? ` (${result.reason})` : '';
    console.log(`   ${status} - ${result.file}${reason}`);
  });
  
  // 失败的测试
  const failedTests = results.filter(r => !r.success);
  if (failedTests.length > 0) {
    console.log('\n⚠️ 失败的测试:');
    failedTests.forEach(result => {
      console.log(`   - ${result.file}`);
      if (result.error) {
        console.log(`     错误: ${result.error}`);
      }
      if (result.code) {
        console.log(`     退出码: ${result.code}`);
      }
    });
  }
  
  // 生成机器可读的报告
  const report = {
    timestamp: new Date().toISOString(),
    duration: duration,
    total: results.length,
    passed: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results: results
  };
  
  const reportPath = path.join(__dirname, 'results', 'v2-integration-test-report.json');
  
  // 确保results目录存在
  const resultsDir = path.dirname(reportPath);
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 测试报告已保存: ${reportPath}`);
  
  // 根据测试结果设置退出码
  const exitCode = failedTests.length > 0 ? 1 : 0;
  
  if (exitCode === 0) {
    console.log('\n🎉 所有V2.0集成测试通过！');
  } else {
    console.log('\n💥 部分V2.0集成测试失败！');
  }
  
  process.exit(exitCode);
}

// 主程序
if (require.main === module) {
  // 设置环境变量
  process.env.NODE_ENV = 'test';
  
  // 运行测试
  runV2IntegrationTests().catch(error => {
    console.error('❌ 测试执行出错:', error);
    process.exit(1);
  });
}

module.exports = {
  runV2IntegrationTests,
  runTestFile,
  checkDockerEnvironment,
  V2_TEST_FILES
}; 