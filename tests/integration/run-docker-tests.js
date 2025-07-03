// 集成测试运行器 - Docker环境版本
// 直接使用已经运行的Docker服务，不启动新的服务器实例

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

// 测试配置
const config = {
  timeout: 30000, // 超时时间 30 秒
  testsDir: path.join(__dirname),
  outputDir: path.join(__dirname, 'results'),
  reportFile: path.join(__dirname, 'results', 'test-report.json'),
  apiUrl: 'http://localhost:3000/api'
};

// 确保结果目录存在
if (!fs.existsSync(config.outputDir)) {
  fs.mkdirSync(config.outputDir, { recursive: true });
}

// 收集测试文件
const testFiles = fs.readdirSync(config.testsDir)
  .filter(file => file.endsWith('.test.js'))
  .map(file => path.join(config.testsDir, file));

console.log(`\n🚀 开始执行集成测试 (Docker环境)`);
console.log(`发现 ${testFiles.length} 个测试文件: ${testFiles.map(f => path.basename(f)).join(', ')}\n`);

// 执行测试
const results = {
  startTime: new Date(),
  endTime: null,
  testsRun: 0,
  testsPassed: 0,
  testsFailed: 0,
  modules: []
};

// 检查Docker服务是否可用
const checkDockerServices = async () => {
  console.log('🔍 检查Docker服务状态...');
  
  try {
    // 检查后端API
    const healthResponse = await axios.get('http://localhost:3000/health', { timeout: 5000 });
    if (healthResponse.status === 200) {
      console.log('✅ 后端API服务正常');
    } else {
      throw new Error(`后端API健康检查失败: ${healthResponse.status}`);
    }
    
    // 检查前端
    const frontendResponse = await axios.get('http://localhost:3001', { timeout: 5000 });
    if (frontendResponse.status === 200) {
      console.log('✅ 前端服务正常');
    } else {
      console.log('⚠️ 前端服务可能未完全启动，但不影响API测试');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Docker服务检查失败:', error.message);
    console.error('请确保已通过 ./start-edm-system.sh 启动系统');
    return false;
  }
};

const runAllTests = async () => {
  try {
    // 检查服务状态
    const servicesReady = await checkDockerServices();
    if (!servicesReady) {
      throw new Error('Docker服务未就绪，无法运行测试');
    }

    for (const testFile of testFiles) {
      const moduleName = path.basename(testFile, '.test.js');
      console.log(`\n📋 正在测试模块: ${moduleName}`);
      
      const moduleResult = {
        name: moduleName,
        file: testFile,
        startTime: new Date(),
        endTime: null,
        status: 'pending',
        error: null,
        output: ''
      };
      
      try {
        // 设置环境变量，指向Docker服务
        const jestEnv = { 
          ...process.env,
          NODE_ENV: 'development',
          API_BASE_URL: 'http://localhost:3000/api',
          FRONTEND_URL: 'http://localhost:3001',
          USE_DOCKER_SERVICES: 'true'
        };
        
        const command = `npx jest ${testFile} --verbose --runInBand --testTimeout=15000`; 
        
        const { stdout, stderr } = await new Promise((resolve, reject) => {
          exec(command, { timeout: config.timeout, env: jestEnv }, (error, stdout, stderr) => {
            if (error) {
              moduleResult.status = 'failed';
              moduleResult.error = error.message;
              console.log(`❌ ${moduleName} 测试失败`);
              console.error('Jest stderr:', stderr);
              console.error('Jest stdout:', stdout);
              results.testsFailed++;
            } else {
              moduleResult.status = 'passed';
              console.log(`✅ ${moduleName} 测试通过`);
              results.testsPassed++;
            }
            resolve({ stdout, stderr });
          });
        });
        
        moduleResult.output = stdout + stderr;
      } catch (error) {
        moduleResult.status = 'error';
        moduleResult.error = error.message;
        console.error(`⚠️ 运行 ${moduleName} 测试时发生 exec 错误:`, error);
        results.testsFailed++;
      }
      
      moduleResult.endTime = new Date();
      results.modules.push(moduleResult);
      results.testsRun++;
    }
  } catch (error) {
    console.error('❌ 运行测试套件时发生严重错误:', error);
  } finally {
    results.endTime = new Date();
    fs.writeFileSync(config.reportFile, JSON.stringify(results, null, 2));
    generateReport();
    
    if (results.testsFailed > 0) {
        console.log(`\n🔴 ${results.testsFailed} 个测试模块失败。`);
        process.exit(1);
    } else if (results.testsRun === 0 && testFiles.length > 0) {
        console.warn('⚠️ 没有成功执行任何测试模块，尽管找到了测试文件。');
        process.exit(1); 
    } else if (testFiles.length === 0) {
        console.warn('⚠️ 没有找到任何测试文件 (*.test.js)。');
        process.exit(0);
    } else {
        console.log('\n🟢 所有测试模块通过!');
        process.exit(0);
    }
  }
};

// 生成测试报告
const generateReport = () => {
  const duration = results.endTime && results.startTime ? (results.endTime - results.startTime) / 1000 : 0;
  
  console.log('\n📊 测试报告摘要');
  console.log('====================');
  console.log(`总共测试模块: ${results.testsRun} (找到 ${testFiles.length} 个文件)`);
  console.log(`通过: ${results.testsPassed}`);
  console.log(`失败: ${results.testsFailed}`);
  console.log(`总耗时: ${duration.toFixed(2)} 秒`);
  console.log('====================');
  
  results.modules.forEach(module => {
    const moduleDuration = module.endTime && module.startTime ? (module.endTime - module.startTime) / 1000 : 0;
    let statusSymbol = '❓';
    if (module.status === 'passed') statusSymbol = '✅ 通过';
    if (module.status === 'failed') statusSymbol = '❌ 失败';
    if (module.status === 'error') statusSymbol = '⚠️ 错误';

    console.log(`\n模块: ${module.name} - ${statusSymbol} (${moduleDuration.toFixed(2)}s)`);
    
    if (module.status !== 'passed' && module.error) {
      console.log(`错误信息: ${module.error}`);
    }
    // 为了避免报告过长，只在失败时打印详细 output
    if (module.status !== 'passed' && module.output) {
      console.log(`--- ${module.name} output (stderr/stdout) ---\n${module.output}\n--- end ${module.name} output ---`);
    }
  });
  
  console.log(`\n详细报告已保存至: ${config.reportFile}`);
};

// 运行所有测试
runAllTests().catch(error => {
  console.error('‼️ runAllTests 顶层 Promise 被拒绝:', error);
  process.exit(1);
}); 