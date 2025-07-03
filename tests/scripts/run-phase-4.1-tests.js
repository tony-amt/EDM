#!/usr/bin/env node

/**
 * Phase 4.1 队列调度系统优化 - 测试执行脚本
 * 自动执行所有测试用例并生成报告
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class TestRunner {
  constructor() {
    this.testResults = {
      startTime: new Date(),
      endTime: null,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      testSuites: [],
      errors: []
    };
  }

  async runTest(testFile, testName) {
    console.log(`\n🚀 开始执行: ${testName}`);
    console.log(`📁 测试文件: ${testFile}`);
    console.log('=' * 60);

    return new Promise((resolve) => {
      const startTime = Date.now();

      const testProcess = spawn('npm', ['test', '--', testFile], {
        stdio: 'pipe',
        shell: true,
        cwd: process.cwd()
      });

      let stdout = '';
      let stderr = '';

      testProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log(output);
      });

      testProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.error(output);
      });

      testProcess.on('close', (code) => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        const result = {
          name: testName,
          file: testFile,
          exitCode: code,
          duration: duration,
          success: code === 0,
          stdout: stdout,
          stderr: stderr,
          timestamp: new Date()
        };

        this.testResults.testSuites.push(result);

        if (code === 0) {
          console.log(`✅ ${testName} 执行成功 (${duration}ms)`);
          this.testResults.passedTests++;
        } else {
          console.log(`❌ ${testName} 执行失败 (${duration}ms)`);
          this.testResults.failedTests++;
          this.testResults.errors.push({
            testName,
            error: stderr || `Exit code: ${code}`
          });
        }

        resolve(result);
      });
    });
  }

  async checkSystemHealth() {
    console.log('\n🔍 检查系统健康状态...');

    try {
      const response = await fetch('http://localhost:3002/api/monitoring/system-health');
      if (response.ok) {
        const data = await response.json();
        console.log('✅ 系统健康检查通过:', data.data.status);
        return true;
      } else {
        console.log('❌ 系统健康检查失败:', response.status);
        return false;
      }
    } catch (error) {
      console.log('❌ 系统健康检查失败:', error.message);
      return false;
    }
  }

  async generateReport() {
    this.testResults.endTime = new Date();
    this.testResults.totalTests = this.testResults.passedTests + this.testResults.failedTests;

    const reportContent = `
# Phase 4.1 队列调度系统优化 - 测试报告

## 📊 测试概览

- **开始时间**: ${this.testResults.startTime.toISOString()}
- **结束时间**: ${this.testResults.endTime.toISOString()}
- **总耗时**: ${this.testResults.endTime.getTime() - this.testResults.startTime.getTime()}ms
- **总测试数**: ${this.testResults.totalTests}
- **通过测试**: ${this.testResults.passedTests}
- **失败测试**: ${this.testResults.failedTests}
- **成功率**: ${((this.testResults.passedTests / this.testResults.totalTests) * 100).toFixed(2)}%

## 🧪 测试套件详情

${this.testResults.testSuites.map(suite => `
### ${suite.name}
- **状态**: ${suite.success ? '✅ 通过' : '❌ 失败'}
- **耗时**: ${suite.duration}ms
- **退出码**: ${suite.exitCode}
- **执行时间**: ${suite.timestamp.toISOString()}

${suite.success ? '' : `
**错误信息**:
\`\`\`
${suite.stderr}
\`\`\`
`}
`).join('\n')}

## ❌ 错误汇总

${this.testResults.errors.length === 0 ? '无错误' : this.testResults.errors.map(error => `
### ${error.testName}
\`\`\`
${error.error}
\`\`\`
`).join('\n')}

## 📈 性能指标

${this.testResults.testSuites.map(suite => `
- **${suite.name}**: ${suite.duration}ms
`).join('')}

---

**报告生成时间**: ${new Date().toISOString()}
**测试环境**: Development
**系统版本**: Phase 4.1
`;

    const reportPath = path.join(__dirname, '../docs/test-reports/phase-4.1-test-report.md');
    await fs.writeFile(reportPath, reportContent);

    console.log(`\n📄 测试报告已生成: ${reportPath}`);
    return reportPath;
  }

  async run() {
    console.log('🎯 Phase 4.1 队列调度系统优化 - 完整测试执行');
    console.log('=' * 80);

    // 检查系统健康状态
    const isHealthy = await this.checkSystemHealth();
    if (!isHealthy) {
      console.log('⚠️  系统健康检查失败，但继续执行测试...');
    }

    // 定义测试套件
    const testSuites = [
      {
        name: 'API综合测试',
        file: 'tests/integration/phase-4.1-api-comprehensive.test.js',
        priority: 1
      },
      {
        name: '数据库层测试',
        file: 'tests/integration/phase-4.1-database.test.js',
        priority: 2
      },
      {
        name: '端到端测试',
        file: 'tests/e2e/phase-4.1-end-to-end.spec.js',
        priority: 3
      }
    ];

    // 按优先级执行测试
    for (const testSuite of testSuites) {
      try {
        await this.runTest(testSuite.file, testSuite.name);
      } catch (error) {
        console.error(`❌ 测试套件 ${testSuite.name} 执行异常:`, error);
        this.testResults.errors.push({
          testName: testSuite.name,
          error: error.message
        });
      }
    }

    // 生成测试报告
    await this.generateReport();

    // 输出最终结果
    console.log('\n' + '=' * 80);
    console.log('🎉 Phase 4.1 测试执行完成');
    console.log('=' * 80);
    console.log(`📊 总测试数: ${this.testResults.totalTests}`);
    console.log(`✅ 通过: ${this.testResults.passedTests}`);
    console.log(`❌ 失败: ${this.testResults.failedTests}`);
    console.log(`📈 成功率: ${((this.testResults.passedTests / this.testResults.totalTests) * 100).toFixed(2)}%`);

    if (this.testResults.failedTests > 0) {
      console.log('\n❌ 失败的测试:');
      this.testResults.errors.forEach(error => {
        console.log(`   - ${error.testName}`);
      });
    }

    console.log('\n🎯 测试建议:');
    if (this.testResults.failedTests === 0) {
      console.log('   ✅ 所有测试通过，系统状态良好');
      console.log('   ✅ 可以安全部署到生产环境');
    } else {
      console.log('   ⚠️  存在失败测试，需要修复后再部署');
      console.log('   📋 请查看测试报告了解详细错误信息');
    }

    // 返回退出码
    process.exit(this.testResults.failedTests > 0 ? 1 : 0);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const runner = new TestRunner();
  runner.run().catch(error => {
    console.error('❌ 测试执行器异常:', error);
    process.exit(1);
  });
}

module.exports = TestRunner; 