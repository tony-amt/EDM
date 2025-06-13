// 在所有 require 之前设置环境变量，确保它们在模块加载时生效
process.env.NODE_ENV = 'ci_test'; 
process.env.DB_HOST_TEST = 'localhost'; 
console.log(`ℹ️ [RUN_TESTS_DEBUG] Initializing with NODE_ENV: ${process.env.NODE_ENV}, DB_HOST_TEST: ${process.env.DB_HOST_TEST}`);

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { startServer, closeServer } = require('../../src/backend/src/index'); // 现在这个 require 会在环境变量设置后执行

let sharedHttpServer = null; // 用于保存全局服务器实例

// 测试配置
const config = {
  timeout: 30000, // 超时时间 30 秒
  testsDir: path.join(__dirname),
  outputDir: path.join(__dirname, 'results'),
  reportFile: path.join(__dirname, 'results', 'test-report.json')
};

// 确保结果目录存在
if (!fs.existsSync(config.outputDir)) {
  fs.mkdirSync(config.outputDir, { recursive: true });
}

// 收集测试文件
const testFiles = fs.readdirSync(config.testsDir)
  .filter(file => file.endsWith('.test.js'))
  .map(file => path.join(config.testsDir, file));

console.log(`\n🚀 开始执行集成测试`);
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

const runAllTests = async () => {
  try {
    console.log('\n⏳ 正在启动全局 HTTP 服务器进行集成测试...');
    // 环境变量已在文件顶部设置，startServer() 将读取它们
    sharedHttpServer = await startServer();
    if (sharedHttpServer && sharedHttpServer.address()) {
        const effectivePort = sharedHttpServer.address().port;
        console.log(`✅ 全局 HTTP 服务器已在端口 ${effectivePort} 启动`);
        process.env.JEST_EFFECTIVE_BACKEND_PORT = effectivePort.toString(); // 传递给子进程
    } else {
        console.error('❌ 全局 HTTP 服务器未能按预期启动。');
        throw new Error('Global HTTP server failed to start.');
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
        // 环境变量应已通过父进程继承，或者可以通过 exec 的 env 选项再次明确传递
        // 为了保险起见，明确传递给 jest 子进程的环境变量
        const jestEnv = { 
          ...process.env, // 继承父进程的环境变量
          NODE_ENV: 'ci_test', 
          DB_HOST_TEST: 'localhost',
          JEST_EFFECTIVE_BACKEND_PORT: process.env.JEST_EFFECTIVE_BACKEND_PORT // 确保传递下去
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
    if (sharedHttpServer) {
      console.log('\n⏳ 正在关闭全局 HTTP 服务器...');
      await closeServer(sharedHttpServer).catch(err => console.error('⚠️ 关闭服务器时出错:', err));
      console.log('✅ 全局 HTTP 服务器已关闭。');
    }
    results.endTime = new Date();
    fs.writeFileSync(config.reportFile, JSON.stringify(results, null, 2));
    generateReport();
    
    if (results.testsFailed > 0) {
        console.log(`\n🔴 ${results.testsFailed} 个测试模块失败。`);
        process.exit(1);
    } else if (results.testsRun === 0 && testFiles.length > 0) { // 确保如果有测试文件但没有运行，也视为失败
        console.warn('⚠️ 没有成功执行任何测试模块，尽管找到了测试文件。');
        process.exit(1); 
    } else if (testFiles.length === 0) {
        console.warn('⚠️ 没有找到任何测试文件 (*.test.js)。');
        process.exit(0); // 没有文件则不视为失败
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
  if (sharedHttpServer) {
    closeServer(sharedHttpServer).finally(() => process.exit(1));
  } else {
    process.exit(1);
  }
}); 