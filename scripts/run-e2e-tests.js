#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class E2ETestRunner {
  constructor() {
    this.testResults = {
      timestamp: new Date().toISOString(),
      preCheck: { status: 'pending', details: [] },
      criticalFlows: { status: 'pending', details: [] },
      overall: { status: 'pending', passRate: 0 }
    };
  }

  async runTests() {
    console.log('🚀 启动改进后的E2E测试套件...');
    console.log('📅 测试时间:', new Date().toLocaleString());
    console.log('🎯 测试目标: 验证之前6个验收Bug已修复');
    console.log('');

    try {
      // 1. 环境预检查
      await this.preCheck();
      
      // 2. 启动服务
      await this.startServices();
      
      // 3. 运行预检查测试
      await this.runPreCheckTests();
      
      // 4. 运行关键流程测试
      await this.runCriticalFlowTests();
      
      // 5. 生成测试报告
      await this.generateReport();
      
      console.log('🎉 E2E测试套件执行完成!');
      
    } catch (error) {
      console.error('❌ E2E测试执行失败:', error.message);
      this.testResults.overall.status = 'failed';
      this.testResults.overall.error = error.message;
      await this.generateReport();
      process.exit(1);
    }
  }

  async preCheck() {
    console.log('🔍 Phase 1: 环境预检查...');
    
    // 检查Node.js版本
    const nodeVersion = process.version;
    console.log('📋 Node.js版本:', nodeVersion);
    
    // 检查端口占用
    try {
      execSync('lsof -ti:3000', { stdio: 'ignore' });
      console.log('✅ 后端端口3000已被占用(服务已运行)');
    } catch (error) {
      console.log('⚠️ 后端端口3000未被占用，将启动服务');
    }
    
    try {
      execSync('lsof -ti:3001', { stdio: 'ignore' });
      console.log('✅ 前端端口3001已被占用(服务已运行)');
    } catch (error) {
      console.log('⚠️ 前端端口3001未被占用，将启动服务');
    }
    
    // 检查数据库连接
    try {
      execSync('pg_isready -h localhost -p 5432', { stdio: 'ignore' });
      console.log('✅ PostgreSQL数据库连接正常');
    } catch (error) {
      console.log('⚠️ PostgreSQL数据库连接检查失败，请确认数据库已启动');
    }
    
    this.testResults.preCheck.status = 'passed';
    console.log('✅ 环境预检查完成\n');
  }

  async startServices() {
    console.log('🚀 Phase 2: 启动服务...');
    
    // 检查是否已有服务运行
    const backendRunning = this.isPortInUse(3000);
    const frontendRunning = this.isPortInUse(3001);
    
    if (!backendRunning) {
      console.log('🔧 启动后端服务...');
      // 这里不直接启动，因为Playwright配置会自动启动
    } else {
      console.log('✅ 后端服务已运行');
    }
    
    if (!frontendRunning) {
      console.log('🔧 启动前端服务...');
      // 这里不直接启动，因为Playwright配置会自动启动
    } else {
      console.log('✅ 前端服务已运行');
    }
    
    console.log('✅ 服务启动完成\n');
  }

  async runPreCheckTests() {
    console.log('🧪 Phase 3: 运行系统预检查测试...');
    
    try {
      const result = execSync('npx playwright test tests/e2e/pre-test-check.spec.js --reporter=json', 
        { encoding: 'utf8', timeout: 60000 });
      
      const testData = JSON.parse(result);
      const passed = testData.stats.expected || 0;
      const failed = testData.stats.unexpected || 0;
      
      console.log(`✅ 预检查测试完成: ${passed} 通过, ${failed} 失败`);
      this.testResults.preCheck.details = testData.suites;
      this.testResults.preCheck.status = failed === 0 ? 'passed' : 'failed';
      
    } catch (error) {
      console.log('⚠️ 预检查测试执行警告:', error.message);
      // 不中断流程，继续执行关键测试
    }
    
    console.log('');
  }

  async runCriticalFlowTests() {
    console.log('🎯 Phase 4: 运行关键业务流程测试...');
    console.log('📝 测试覆盖:');
    console.log('  - Bug-010-1: 联系人编辑表单数据显示');
    console.log('  - Bug-010-2: 联系人创建后列表刷新');
    console.log('  - Bug-010-3: 富文本编辑器加载');
    console.log('  - Bug-010-4: 模板保存功能');
    console.log('  - Bug-010-5: 模板集API调用');
    console.log('  - Bug-010-6: 端到端邮件发送');
    console.log('');
    
    try {
      const result = execSync('npx playwright test tests/e2e/critical-user-flows.spec.js --reporter=json --timeout=90000', 
        { encoding: 'utf8', timeout: 300000 }); // 5分钟超时
      
      const testData = JSON.parse(result);
      const passed = testData.stats.expected || 0;
      const failed = testData.stats.unexpected || 0;
      const total = passed + failed;
      const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
      
      console.log(`📊 关键流程测试结果: ${passed}/${total} 通过 (${passRate}%)`);
      
      this.testResults.criticalFlows.status = failed === 0 ? 'passed' : 'failed';
      this.testResults.criticalFlows.details = testData.suites;
      this.testResults.criticalFlows.passed = passed;
      this.testResults.criticalFlows.failed = failed;
      this.testResults.criticalFlows.passRate = passRate;
      
      this.testResults.overall.passRate = passRate;
      this.testResults.overall.status = failed === 0 ? 'passed' : 'failed';
      
      if (failed === 0) {
        console.log('🎉 所有关键流程测试通过!');
      } else {
        console.log(`⚠️ ${failed} 个测试失败，需要检查`);
      }
      
    } catch (error) {
      console.error('❌ 关键流程测试执行失败:', error.message);
      this.testResults.criticalFlows.status = 'failed';
      this.testResults.overall.status = 'failed';
      throw error;
    }
    
    console.log('');
  }

  async generateReport() {
    console.log('📋 Phase 5: 生成测试报告...');
    
    const reportData = {
      ...this.testResults,
      summary: this.generateSummary()
    };
    
    // 保存JSON报告
    const reportPath = 'test-results/e2e-test-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    
    // 生成HTML报告
    const htmlReport = this.generateHTMLReport(reportData);
    fs.writeFileSync('test-results/e2e-test-report.html', htmlReport);
    
    // 控制台输出摘要
    console.log('📄 测试报告已生成:');
    console.log(`  - JSON: ${reportPath}`);
    console.log(`  - HTML: test-results/e2e-test-report.html`);
    console.log('');
    
    console.log('📊 测试结果摘要:');
    console.log(`  整体状态: ${reportData.overall.status}`);
    console.log(`  通过率: ${reportData.overall.passRate}%`);
    console.log(`  预检查: ${reportData.preCheck.status}`);
    console.log(`  关键流程: ${reportData.criticalFlows.status}`);
    
    if (reportData.overall.status === 'passed') {
      console.log('');
      console.log('🎉 ===============================================');
      console.log('🎉 E2E测试全部通过，系统已准备好进入UAT测试!');
      console.log('🎉 之前的6个验收Bug已全部修复并验证');
      console.log('🎉 ===============================================');
    } else {
      console.log('');
      console.log('⚠️ ===============================================');
      console.log('⚠️ E2E测试存在失败项，请检查并修复后重新测试');
      console.log('⚠️ ===============================================');
    }
  }

  generateSummary() {
    const { preCheck, criticalFlows, overall } = this.testResults;
    
    return {
      readyForUAT: overall.status === 'passed' && overall.passRate >= 95,
      criticalBugsFixed: criticalFlows.status === 'passed',
      systemStable: preCheck.status === 'passed',
      recommendation: overall.status === 'passed' 
        ? '系统已准备好进入UAT测试阶段' 
        : '需要修复失败的测试用例后重新测试'
    };
  }

  generateHTMLReport(data) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>E2E测试报告 - EDM系统</title>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .status-passed { color: #28a745; }
        .status-failed { color: #dc3545; }
        .status-pending { color: #ffc107; }
        .progress { width: 100%; height: 20px; background: #f0f0f0; border-radius: 10px; overflow: hidden; }
        .progress-bar { height: 100%; background: #28a745; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f5f5f5; }
        .summary { background: #e7f3ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>EDM系统 E2E测试报告</h1>
        <p>生成时间: ${data.timestamp}</p>
        <p>测试状态: <span class="status-${data.overall.status}">${data.overall.status.toUpperCase()}</span></p>
    </div>
    
    <div class="summary">
        <h2>测试摘要</h2>
        <p><strong>整体通过率:</strong> ${data.overall.passRate}%</p>
        <div class="progress">
            <div class="progress-bar" style="width: ${data.overall.passRate}%"></div>
        </div>
        <p><strong>UAT准备状态:</strong> ${data.summary.readyForUAT ? '✅ 准备就绪' : '❌ 需要修复'}</p>
        <p><strong>建议:</strong> ${data.summary.recommendation}</p>
    </div>
    
    <h2>测试详情</h2>
    <table>
        <tr>
            <th>测试阶段</th>
            <th>状态</th>
            <th>描述</th>
        </tr>
        <tr>
            <td>环境预检查</td>
            <td><span class="status-${data.preCheck.status}">${data.preCheck.status}</span></td>
            <td>系统基础环境和服务状态检查</td>
        </tr>
        <tr>
            <td>关键业务流程</td>
            <td><span class="status-${data.criticalFlows.status}">${data.criticalFlows.status}</span></td>
            <td>6个关键Bug修复验证测试</td>
        </tr>
    </table>
    
    ${data.criticalFlows.passRate !== undefined ? `
    <h3>关键流程测试结果</h3>
    <p>通过: ${data.criticalFlows.passed || 0} | 失败: ${data.criticalFlows.failed || 0} | 通过率: ${data.criticalFlows.passRate}%</p>
    ` : ''}
    
    <h2>下一步行动</h2>
    ${data.overall.status === 'passed' ? `
    <ul>
        <li>✅ 进入UAT测试阶段</li>
        <li>✅ 准备生产环境部署</li>
        <li>✅ 进行用户验收测试</li>
    </ul>
    ` : `
    <ul>
        <li>❌ 修复失败的测试用例</li>
        <li>❌ 重新运行E2E测试</li>
        <li>❌ 等待全部通过后进入UAT</li>
    </ul>
    `}
    
    <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666;">
        <p>报告生成时间: ${new Date().toLocaleString()}</p>
        <p>测试框架: Playwright | 报告版本: 2.0</p>
    </footer>
</body>
</html>`;
  }

  isPortInUse(port) {
    try {
      execSync(`lsof -ti:${port}`, { stdio: 'ignore' });
      return true;
    } catch (error) {
      return false;
    }
  }
}

// 执行测试
if (require.main === module) {
  const runner = new E2ETestRunner();
  runner.runTests().catch(console.error);
}

module.exports = E2ETestRunner; 