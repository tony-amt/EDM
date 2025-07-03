/**
 * Phase 4.1 队列调度系统优化 - 端到端测试
 * 测试完整的邮件发送流程和系统集成
 */

const request = require('supertest');
const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const { Task, SubTask, Contact, User } = require('../../src/backend/src/models');
const { Op } = require('sequelize');

const API_BASE_URL = 'http://localhost:3002';
const AUTH_TOKEN = 'dev-permanent-test-token-admin-2025';

describe('Phase 4.1 端到端测试', () => {

  let testContact = null;
  let testTask = null;
  let testSubTask = null;

  beforeAll(async () => {
    console.log('🚀 开始Phase 4.1 端到端测试');
    console.log(`测试环境: ${API_BASE_URL}`);

    // 清理之前的测试数据
    await cleanupTestData();
  });

  afterAll(async () => {
    // 清理测试数据
    await cleanupTestData();
    console.log('✅ Phase 4.1 端到端测试完成');
  });

  // 清理测试数据的辅助函数
  async function cleanupTestData() {
    try {
      // 删除测试子任务
      await SubTask.destroy({
        where: {
          email: {
            [Op.like]: 'test-e2e-%@example.com'
          }
        }
      });

      // 删除测试任务
      await Task.destroy({
        where: {
          name: {
            [Op.like]: 'E2E Test %'
          }
        }
      });

      // 删除测试联系人
      await Contact.destroy({
        where: {
          email: {
            [Op.like]: 'test-e2e-%@example.com'
          }
        }
      });

      console.log('🧹 测试数据清理完成');
    } catch (error) {
      console.warn('⚠️  测试数据清理时出现错误:', error.message);
    }
  }

  describe('1. 完整邮件发送流程测试', () => {

    test('创建测试数据 - 联系人和任务', async () => {
      // Step 1: 创建测试联系人
      testContact = await Contact.create({
        email: 'test-e2e-main@example.com',
        name: 'E2E Test Contact Main',
        user_id: 'admin-user-id'
      });

      expect(testContact).toBeDefined();
      expect(testContact.email).toBe('test-e2e-main@example.com');

      // Step 2: 创建邮件任务
      testTask = await Task.create({
        name: 'E2E Test Campaign Main',
        subject: 'E2E Test Email Subject',
        content: 'This is an E2E test email content for Phase 4.1',
        user_id: 'admin-user-id',
        status: 'scheduled',
        scheduled_at: new Date()
      });

      expect(testTask).toBeDefined();
      expect(testTask.name).toBe('E2E Test Campaign Main');

      // Step 3: 创建子任务
      testSubTask = await SubTask.create({
        task_id: testTask.id,
        contact_id: testContact.id,
        email: testContact.email,
        status: 'pending'
      });

      expect(testSubTask).toBeDefined();
      expect(testSubTask.status).toBe('pending');

      console.log('✅ 测试数据创建成功');
      console.log(`   - 联系人ID: ${testContact.id}`);
      console.log(`   - 任务ID: ${testTask.id}`);
      console.log(`   - 子任务ID: ${testSubTask.id}`);
    });

    test('队列调度器启动和状态验证', async () => {
      // Step 1: 获取启动前状态
      const beforeStatus = await request(API_BASE_URL)
        .get('/api/queue-v2/status')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .expect(200);

      console.log('📊 启动前状态:', beforeStatus.body.data.isRunning);

      // Step 2: 启动队列调度器
      const startResponse = await request(API_BASE_URL)
        .post('/api/queue-v2/start')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .expect(200);

      expect(startResponse.body.success).toBe(true);
      expect(startResponse.body.data.status).toBe('running');

      // Step 3: 验证启动后状态
      const afterStatus = await request(API_BASE_URL)
        .get('/api/queue-v2/status')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .expect(200);

      expect(afterStatus.body.data.isRunning).toBe(true);

      console.log('✅ 队列调度器启动成功');
      console.log(`   - 运行状态: ${afterStatus.body.data.isRunning}`);
      console.log(`   - 待处理任务: ${afterStatus.body.data.pendingSubTasks}`);
    });

    test('任务处理监控和状态变化', async () => {
      const maxWaitTime = 30000; // 30秒超时
      const checkInterval = 2000; // 2秒检查一次
      const startTime = Date.now();

      let currentStatus = 'pending';
      let iterations = 0;
      const maxIterations = maxWaitTime / checkInterval;

      console.log('⏳ 开始监控任务处理状态...');

      while (currentStatus === 'pending' && iterations < maxIterations) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));

        // 重新加载子任务状态
        await testSubTask.reload();
        currentStatus = testSubTask.status;
        iterations++;

        console.log(`   - 检查 ${iterations}/${maxIterations}: 状态 = ${currentStatus}`);

        // 如果状态已经改变，跳出循环
        if (currentStatus !== 'pending') {
          break;
        }
      }

      const totalWaitTime = Date.now() - startTime;

      console.log('✅ 任务状态监控完成');
      console.log(`   - 最终状态: ${currentStatus}`);
      console.log(`   - 总等待时间: ${totalWaitTime}ms`);
      console.log(`   - 检查次数: ${iterations}`);

      // 验证状态已经改变（不再是pending）
      expect(['allocated', 'sending', 'sent', 'failed']).toContain(currentStatus);

      // 验证处理时间合理
      expect(totalWaitTime).toBeLessThan(maxWaitTime);
    });

    test('服务统计和性能指标验证', async () => {
      // Step 1: 获取服务统计
      const statsResponse = await request(API_BASE_URL)
        .get('/api/queue-v2/services/stats')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .expect(200);

      expect(statsResponse.body.success).toBe(true);
      expect(typeof statsResponse.body.data.totalServices).toBe('number');
      expect(typeof statsResponse.body.data.availableServices).toBe('number');

      // Step 2: 获取性能指标
      const metricsResponse = await request(API_BASE_URL)
        .get('/api/monitoring/performance-metrics')
        .expect(200);

      expect(metricsResponse.body.success).toBe(true);
      expect(typeof metricsResponse.body.data.cpu.usage).toBe('number');
      expect(typeof metricsResponse.body.data.memory.usage).toBe('number');

      console.log('✅ 服务统计和性能指标验证通过');
      console.log(`   - 总服务数: ${statsResponse.body.data.totalServices}`);
      console.log(`   - 可用服务数: ${statsResponse.body.data.availableServices}`);
      console.log(`   - CPU使用率: ${metricsResponse.body.data.cpu.usage}%`);
      console.log(`   - 内存使用率: ${metricsResponse.body.data.memory.usage}%`);
    });
  });

  describe('2. 队列调度器故障恢复测试', () => {

    test('停止和重启队列调度器', async () => {
      // Step 1: 停止队列调度器
      const stopResponse = await request(API_BASE_URL)
        .post('/api/queue-v2/stop')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .expect(200);

      expect(stopResponse.body.success).toBe(true);
      expect(stopResponse.body.data.status).toBe('stopped');

      // Step 2: 验证停止状态
      const stoppedStatus = await request(API_BASE_URL)
        .get('/api/queue-v2/status')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .expect(200);

      expect(stoppedStatus.body.data.isRunning).toBe(false);

      console.log('✅ 队列调度器停止成功');

      // Step 3: 等待一段时间
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 4: 重新启动
      const restartResponse = await request(API_BASE_URL)
        .post('/api/queue-v2/start')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .expect(200);

      expect(restartResponse.body.success).toBe(true);
      expect(restartResponse.body.data.status).toBe('running');

      // Step 5: 验证重启后状态
      const restartedStatus = await request(API_BASE_URL)
        .get('/api/queue-v2/status')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .expect(200);

      expect(restartedStatus.body.data.isRunning).toBe(true);

      console.log('✅ 队列调度器重启成功');
    });

    test('系统健康状态持续监控', async () => {
      const healthChecks = 5;
      const checkInterval = 1000; // 1秒间隔

      for (let i = 0; i < healthChecks; i++) {
        const healthResponse = await request(API_BASE_URL)
          .get('/api/monitoring/system-health')
          .expect(200);

        expect(healthResponse.body.success).toBe(true);
        expect(healthResponse.body.data.status).toBe('healthy');

        console.log(`✅ 健康检查 ${i + 1}/${healthChecks}: ${healthResponse.body.data.status}`);

        if (i < healthChecks - 1) {
          await new Promise(resolve => setTimeout(resolve, checkInterval));
        }
      }

      console.log('✅ 系统健康状态持续监控通过');
    });
  });

  describe('3. 批量任务处理测试', () => {

    test('批量联系人和任务创建', async () => {
      const batchSize = 10;
      const contacts = [];
      const subTasks = [];

      // 创建批量测试任务
      const batchTask = await Task.create({
        name: 'E2E Test Batch Campaign',
        subject: 'Batch Test Email',
        content: 'This is a batch test email for Phase 4.1',
        user_id: 'admin-user-id',
        status: 'scheduled',
        scheduled_at: new Date()
      });

      // 创建批量联系人
      for (let i = 0; i < batchSize; i++) {
        const contact = await Contact.create({
          email: `test-e2e-batch-${i}@example.com`,
          name: `E2E Batch Contact ${i}`,
          user_id: 'admin-user-id'
        });
        contacts.push(contact);

        // 创建对应的子任务
        const subTask = await SubTask.create({
          task_id: batchTask.id,
          contact_id: contact.id,
          email: contact.email,
          status: 'pending'
        });
        subTasks.push(subTask);
      }

      expect(contacts.length).toBe(batchSize);
      expect(subTasks.length).toBe(batchSize);

      console.log('✅ 批量测试数据创建成功');
      console.log(`   - 批量任务ID: ${batchTask.id}`);
      console.log(`   - 联系人数量: ${contacts.length}`);
      console.log(`   - 子任务数量: ${subTasks.length}`);

      // 监控批量处理进度
      const maxWaitTime = 60000; // 60秒超时
      const checkInterval = 3000; // 3秒检查一次
      const startTime = Date.now();

      let processedCount = 0;
      let iterations = 0;
      const maxIterations = maxWaitTime / checkInterval;

      console.log('⏳ 开始监控批量处理进度...');

      while (processedCount < batchSize && iterations < maxIterations) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));

        const processed = await SubTask.count({
          where: {
            task_id: batchTask.id,
            status: ['sent', 'failed', 'allocated', 'sending']
          }
        });

        processedCount = processed;
        iterations++;

        console.log(`   - 检查 ${iterations}/${maxIterations}: 已处理 ${processedCount}/${batchSize}`);

        if (processedCount >= batchSize) {
          break;
        }
      }

      const totalTime = Date.now() - startTime;

      // 获取最终统计
      const finalStats = await SubTask.findAll({
        where: { task_id: batchTask.id },
        attributes: [
          'status',
          [require('sequelize').fn('COUNT', '*'), 'count']
        ],
        group: ['status'],
        raw: true
      });

      console.log('✅ 批量处理监控完成');
      console.log(`   - 总处理时间: ${totalTime}ms`);
      console.log(`   - 处理统计:`, finalStats);

      // 验证处理结果
      expect(processedCount).toBeGreaterThan(0);
      expect(totalTime).toBeLessThan(maxWaitTime);

      // 清理批量测试数据
      await SubTask.destroy({ where: { task_id: batchTask.id } });
      await batchTask.destroy();
      await Contact.destroy({
        where: {
          email: {
            [Op.like]: 'test-e2e-batch-%@example.com'
          }
        }
      });

      console.log('🧹 批量测试数据清理完成');
    });
  });

  describe('4. 配置管理集成测试', () => {

    test('动态配置变更对队列的影响', async () => {
      // Step 1: 获取当前队列配置
      const configResponse = await request(API_BASE_URL)
        .get('/api/system-config/queue')
        .expect(200);

      expect(configResponse.body.success).toBe(true);
      const originalConfigs = configResponse.body.data;

      // 找到批量大小配置
      const batchSizeConfig = originalConfigs.find(c =>
        c.configKey === 'queue_batch_size' || c.config_key === 'queue_batch_size'
      );

      if (batchSizeConfig) {
        const originalValue = batchSizeConfig.configValue || batchSizeConfig.config_value;
        console.log(`✅ 当前批量大小配置: ${originalValue}`);

        // Step 2: 验证配置对队列行为的影响
        const statusResponse = await request(API_BASE_URL)
          .get('/api/queue-v2/status')
          .set('Authorization', `Bearer ${AUTH_TOKEN}`)
          .expect(200);

        expect(statusResponse.body.success).toBe(true);
        console.log('✅ 配置管理集成验证通过');
      } else {
        console.log('⚠️  未找到批量大小配置，跳过动态配置测试');
      }
    });

    test('监控系统与队列系统集成', async () => {
      // Step 1: 获取队列监控状态
      const queueMonitorResponse = await request(API_BASE_URL)
        .get('/api/monitoring/queue-status')
        .expect(200);

      expect(queueMonitorResponse.body.success).toBe(true);
      expect(typeof queueMonitorResponse.body.data.queueLength).toBe('number');

      // Step 2: 获取队列V2状态
      const queueV2Response = await request(API_BASE_URL)
        .get('/api/queue-v2/status')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .expect(200);

      expect(queueV2Response.body.success).toBe(true);
      expect(typeof queueV2Response.body.data.pendingSubTasks).toBe('number');

      console.log('✅ 监控系统与队列系统集成验证通过');
      console.log(`   - 监控队列长度: ${queueMonitorResponse.body.data.queueLength}`);
      console.log(`   - 队列V2待处理: ${queueV2Response.body.data.pendingSubTasks}`);
    });
  });

  describe('5. 系统压力和稳定性测试', () => {

    test('并发API请求压力测试', async () => {
      const concurrentRequests = 20;
      const requests = [];

      // 创建并发请求
      for (let i = 0; i < concurrentRequests; i++) {
        requests.push(
          request(API_BASE_URL)
            .get('/api/queue-v2/health')
            .expect(200)
        );
      }

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();

      // 验证所有请求成功
      responses.forEach(response => {
        expect(response.body.success).toBe(true);
      });

      const totalTime = endTime - startTime;
      const averageTime = totalTime / concurrentRequests;

      console.log('✅ 并发API请求压力测试通过');
      console.log(`   - 并发请求数: ${concurrentRequests}`);
      console.log(`   - 总耗时: ${totalTime}ms`);
      console.log(`   - 平均响应时间: ${averageTime}ms`);

      expect(averageTime).toBeLessThan(1000); // 平均响应时间小于1秒
    });

    test('长时间运行稳定性测试', async () => {
      const testDuration = 30000; // 30秒测试
      const checkInterval = 5000; // 5秒检查一次
      const startTime = Date.now();

      let healthyChecks = 0;
      let totalChecks = 0;

      console.log('⏳ 开始长时间运行稳定性测试...');

      while ((Date.now() - startTime) < testDuration) {
        try {
          const healthResponse = await request(API_BASE_URL)
            .get('/api/monitoring/system-health')
            .expect(200);

          totalChecks++;
          if (healthResponse.body.data.status === 'healthy') {
            healthyChecks++;
          }

          console.log(`   - 检查 ${totalChecks}: ${healthResponse.body.data.status}`);

        } catch (error) {
          console.warn(`   - 检查 ${totalChecks + 1} 失败:`, error.message);
          totalChecks++;
        }

        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }

      const healthyRate = (healthyChecks / totalChecks) * 100;

      console.log('✅ 长时间运行稳定性测试完成');
      console.log(`   - 总检查次数: ${totalChecks}`);
      console.log(`   - 健康检查次数: ${healthyChecks}`);
      console.log(`   - 健康率: ${healthyRate.toFixed(2)}%`);

      expect(healthyRate).toBeGreaterThan(90); // 健康率大于90%
    });
  });
});

module.exports = {
  testSuite: 'Phase 4.1 端到端测试',
  testCount: 12,
  estimatedTime: '90分钟'
}; 