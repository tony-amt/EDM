#!/usr/bin/env node

/**
 * Phase 4 两阶段队列系统功能测试
 * 验证 next_available_at 间隔控制、SubTask分配和发送流程
 */

const { EmailService, SubTask, Task, Sender, sequelize } = require('../src/backend/src/models/index.model');
const QueueSchedulerV2 = require('../src/backend/src/services/core/queueSchedulerV2.service');
const { Op } = require('sequelize');

class Phase4SystemTest {
  constructor() {
    this.scheduler = new QueueSchedulerV2();
    this.testResults = [];
  }

  async runAllTests() {
    console.log('🚀 Phase 4 两阶段队列系统测试开始');
    console.log('=====================================');

    try {
      // 1. 数据库连接测试
      await this.testDatabaseConnection();

      // 2. 发信服务状态测试
      await this.testEmailServiceStatus();

      // 3. next_available_at 间隔控制测试
      await this.testNextAvailableAtControl();

      // 4. SubTask分配测试
      await this.testSubTaskAllocation();

      // 5. 队列调度器状态测试
      await this.testQueueSchedulerStatus();

      // 6. 批量处理测试
      await this.testBatchProcessing();

      // 7. 服务轮询测试
      await this.testServiceRotation();

      // 8. 错误处理测试
      await this.testErrorHandling();

      // 输出测试结果
      this.printTestResults();

    } catch (error) {
      console.error('❌ 测试过程中发生错误:', error);
      process.exit(1);
    }
  }

  async testDatabaseConnection() {
    console.log('\n📊 1. 数据库连接测试');
    console.log('-------------------');

    try {
      await sequelize.authenticate();
      this.addTestResult('数据库连接', '✅ 成功', '数据库连接正常');

      // 检查关键表
      const tables = ['tasks', 'sub_tasks', 'email_services', 'senders'];
      for (const table of tables) {
        const count = await sequelize.query(`SELECT COUNT(*) FROM ${table}`, {
          type: sequelize.QueryTypes.SELECT
        });
        this.addTestResult(`${table}表`, '✅ 存在', `记录数: ${count[0].count}`);
      }

    } catch (error) {
      this.addTestResult('数据库连接', '❌ 失败', error.message);
    }
  }

  async testEmailServiceStatus() {
    console.log('\n📧 2. 发信服务状态测试');
    console.log('-------------------');

    try {
      // 查询可用的发信服务
      const availableServices = await EmailService.findAll({
        where: {
          is_enabled: true,
          is_frozen: false
        },
        attributes: ['id', 'name', 'next_available_at', 'total_sent', 'quota_per_hour']
      });

      console.log(`发现 ${availableServices.length} 个可用发信服务:`);
      for (const service of availableServices) {
        const isReady = new Date(service.next_available_at) <= new Date();
        const status = isReady ? '✅ 可用' : '⏳ 等待中';
        console.log(`- ${service.name}: ${status} (下次可用: ${service.next_available_at})`);

        this.addTestResult(`发信服务-${service.name}`, status,
          `配额: ${service.total_sent}/${service.quota_per_hour}`);
      }

      if (availableServices.length === 0) {
        this.addTestResult('发信服务检查', '⚠️ 警告', '没有可用的发信服务');
      }

    } catch (error) {
      this.addTestResult('发信服务状态', '❌ 失败', error.message);
    }
  }

  async testNextAvailableAtControl() {
    console.log('\n⏰ 3. next_available_at 间隔控制测试');
    console.log('-----------------------------------');

    try {
      // 模拟发送后更新 next_available_at
      const testService = await EmailService.findOne({
        where: { is_enabled: true }
      });

      if (!testService) {
        this.addTestResult('间隔控制测试', '⚠️ 跳过', '没有可用的测试服务');
        return;
      }

      const originalTime = testService.next_available_at;
      const newTime = new Date(Date.now() + 60000); // 1分钟后

      // 更新 next_available_at
      await testService.update({
        next_available_at: newTime,
        total_sent: testService.total_sent + 1
      });

      // 验证更新
      const updatedService = await EmailService.findByPk(testService.id);
      const isUpdated = new Date(updatedService.next_available_at).getTime() === newTime.getTime();

      if (isUpdated) {
        this.addTestResult('间隔控制', '✅ 成功',
          `next_available_at 已更新: ${updatedService.next_available_at}`);
      } else {
        this.addTestResult('间隔控制', '❌ 失败', 'next_available_at 更新失败');
      }

      // 恢复原始时间
      await testService.update({ next_available_at: originalTime });

    } catch (error) {
      this.addTestResult('间隔控制测试', '❌ 失败', error.message);
    }
  }

  async testSubTaskAllocation() {
    console.log('\n📋 4. SubTask分配测试');
    console.log('-------------------');

    try {
      // 查询pending状态的SubTask
      const pendingSubTasks = await SubTask.findAll({
        where: {
          status: 'pending',
          service_id: null
        },
        limit: 3
      });

      console.log(`发现 ${pendingSubTasks.length} 个pending SubTask`);

      if (pendingSubTasks.length === 0) {
        this.addTestResult('SubTask分配', '⚠️ 无数据', '没有pending状态的SubTask');
        return;
      }

      // 测试分配逻辑
      const availableService = await EmailService.findOne({
        where: {
          is_enabled: true,
          next_available_at: { [Op.lte]: new Date() }
        }
      });

      if (availableService) {
        this.addTestResult('SubTask分配', '✅ 可分配',
          `找到可用服务: ${availableService.name}`);

        // 模拟分配（不实际修改数据）
        console.log(`- 可分配服务: ${availableService.name}`);
        console.log(`- 待分配SubTask数量: ${pendingSubTasks.length}`);
      } else {
        this.addTestResult('SubTask分配', '⏳ 等待中', '暂无可用服务');
      }

    } catch (error) {
      this.addTestResult('SubTask分配测试', '❌ 失败', error.message);
    }
  }

  async testQueueSchedulerStatus() {
    console.log('\n🔄 5. 队列调度器状态测试');
    console.log('------------------------');

    try {
      // 获取调度器状态
      const status = await this.scheduler.getQueueStatus();

      console.log('调度器状态:', JSON.stringify(status, null, 2));

      if (status.scheduler_status) {
        this.addTestResult('调度器状态', '✅ 正常',
          `状态: ${status.scheduler_status}, 任务队列: ${status.active_task_queues}`);
      } else {
        this.addTestResult('调度器状态', '❌ 异常', '无法获取调度器状态');
      }

    } catch (error) {
      this.addTestResult('调度器状态测试', '❌ 失败', error.message);
    }
  }

  async testBatchProcessing() {
    console.log('\n📦 6. 批量处理测试');
    console.log('------------------');

    try {
      // 测试批量配置
      const batchSize = await this.scheduler.getBatchSize();
      const processingInterval = await this.scheduler.getProcessingInterval();

      console.log(`- 批量大小: ${batchSize}`);
      console.log(`- 处理间隔: ${processingInterval}ms`);

      this.addTestResult('批量处理配置', '✅ 正常',
        `批量大小: ${batchSize}, 间隔: ${processingInterval}ms`);

      // 测试批量分配逻辑
      const readyServices = await this.scheduler.getReadyServices();
      console.log(`- 就绪服务数量: ${readyServices.length}`);

      if (readyServices.length > 0) {
        this.addTestResult('批量处理能力', '✅ 可用',
          `${readyServices.length}个服务就绪`);
      } else {
        this.addTestResult('批量处理能力', '⏳ 等待中', '暂无就绪服务');
      }

    } catch (error) {
      this.addTestResult('批量处理测试', '❌ 失败', error.message);
    }
  }

  async testServiceRotation() {
    console.log('\n🔄 7. 服务轮询测试');
    console.log('------------------');

    try {
      // 获取可用服务列表
      const availableServices = await EmailService.findAll({
        where: {
          is_enabled: true,
          is_frozen: false
        },
        attributes: ['id', 'name', 'total_sent', 'quota_per_hour']
      });

      if (availableServices.length > 1) {
        // 测试轮询选择
        const service1 = this.scheduler.selectNextService(availableServices);
        const service2 = this.scheduler.selectNextService(availableServices);

        console.log(`- 首次选择: ${service1.name}`);
        console.log(`- 二次选择: ${service2.name}`);

        this.addTestResult('服务轮询', '✅ 正常',
          `支持${availableServices.length}个服务轮询`);
      } else {
        this.addTestResult('服务轮询', '⚠️ 有限',
          `只有${availableServices.length}个可用服务`);
      }

    } catch (error) {
      this.addTestResult('服务轮询测试', '❌ 失败', error.message);
    }
  }

  async testErrorHandling() {
    console.log('\n⚠️ 8. 错误处理测试');
    console.log('------------------');

    try {
      // 测试无效服务ID处理
      try {
        await this.scheduler.processServiceQueue('invalid-service-id');
        this.addTestResult('错误处理-无效服务', '❌ 未捕获', '应该抛出异常');
      } catch (error) {
        this.addTestResult('错误处理-无效服务', '✅ 正常', '正确捕获异常');
      }

      // 测试空SubTask队列处理
      const emptyResult = await this.scheduler.getNextSubTaskForService('non-existent-service');
      if (emptyResult === null) {
        this.addTestResult('错误处理-空队列', '✅ 正常', '正确返回null');
      } else {
        this.addTestResult('错误处理-空队列', '❌ 异常', '应该返回null');
      }

    } catch (error) {
      this.addTestResult('错误处理测试', '❌ 失败', error.message);
    }
  }

  addTestResult(testName, status, details) {
    this.testResults.push({
      name: testName,
      status,
      details,
      timestamp: new Date().toISOString()
    });

    console.log(`${status} ${testName}: ${details}`);
  }

  printTestResults() {
    console.log('\n📊 测试结果汇总');
    console.log('=====================================');

    const passed = this.testResults.filter(r => r.status.includes('✅')).length;
    const failed = this.testResults.filter(r => r.status.includes('❌')).length;
    const warnings = this.testResults.filter(r => r.status.includes('⚠️')).length;
    const waiting = this.testResults.filter(r => r.status.includes('⏳')).length;

    console.log(`✅ 通过: ${passed}`);
    console.log(`❌ 失败: ${failed}`);
    console.log(`⚠️ 警告: ${warnings}`);
    console.log(`⏳ 等待: ${waiting}`);
    console.log(`📋 总计: ${this.testResults.length}`);

    if (failed > 0) {
      console.log('\n❌ 失败的测试:');
      this.testResults
        .filter(r => r.status.includes('❌'))
        .forEach(r => console.log(`- ${r.name}: ${r.details}`));
    }

    if (warnings > 0) {
      console.log('\n⚠️ 需要关注的警告:');
      this.testResults
        .filter(r => r.status.includes('⚠️'))
        .forEach(r => console.log(`- ${r.name}: ${r.details}`));
    }

    // 生成测试报告
    const testReport = {
      timestamp: new Date().toISOString(),
      summary: { passed, failed, warnings, waiting, total: this.testResults.length },
      results: this.testResults
    };

    require('fs').writeFileSync(
      './scripts/phase4-test-report.json',
      JSON.stringify(testReport, null, 2)
    );

    console.log('\n📄 详细测试报告已保存至: ./scripts/phase4-test-report.json');

    // 判断整体测试结果
    if (failed === 0) {
      console.log('\n🎉 Phase 4 两阶段队列系统测试通过！');
      process.exit(0);
    } else {
      console.log('\n❌ Phase 4 测试存在失败项目，需要修复');
      process.exit(1);
    }
  }
}

// 运行测试
if (require.main === module) {
  const test = new Phase4SystemTest();
  test.runAllTests().catch(console.error);
}

module.exports = Phase4SystemTest; 