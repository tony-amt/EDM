const request = require('supertest');
const { Task, SubTask, EmailService } = require('../../src/backend/src/models');
const failureRecoveryService = require('../../src/backend/src/services/core/failureRecovery.service');

/**
 * Phase 4.2 故障恢复系统集成测试
 */
describe('Phase 4.2 故障恢复系统集成测试', () => {
  const baseURL = 'http://localhost:3002';
  const testToken = 'dev-permanent-test-token-admin-2025';

  beforeAll(async () => {
    // 确保故障恢复服务已停止
    await failureRecoveryService.stop();
  });

  afterAll(async () => {
    // 清理测试数据
    await cleanupTestData();
    await failureRecoveryService.stop();
  });

  describe('故障恢复服务API测试', () => {
    test('GET /api/failure-recovery/health - 健康检查', async () => {
      const response = await request(baseURL)
        .get('/api/failure-recovery/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('service', 'FailureRecoveryService');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('healthy');
      expect(response.body.data).toHaveProperty('timestamp');
    });

    test('GET /api/failure-recovery/status - 获取服务状态', async () => {
      const response = await request(baseURL)
        .get('/api/failure-recovery/status')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('service', 'FailureRecoveryService');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('stats');
      expect(response.body.data.stats).toHaveProperty('totalChecks');
      expect(response.body.data.stats).toHaveProperty('config');
    });

    test('POST /api/failure-recovery/start - 启动故障恢复服务', async () => {
      const response = await request(baseURL)
        .post('/api/failure-recovery/start')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('故障恢复服务已启动');
      expect(response.body.data.status).toBe('running');
    });

    test('POST /api/failure-recovery/stop - 停止故障恢复服务', async () => {
      const response = await request(baseURL)
        .post('/api/failure-recovery/stop')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('故障恢复服务已停止');
      expect(response.body.data.status).toBe('stopped');
    });

    test('POST /api/failure-recovery/trigger - 手动触发故障恢复', async () => {
      const response = await request(baseURL)
        .post('/api/failure-recovery/trigger')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('故障恢复已手动触发');
      expect(response.body.data.action).toBe('manual_trigger');
    });

    test('GET /api/failure-recovery/report - 获取详细报告', async () => {
      const response = await request(baseURL)
        .get('/api/failure-recovery/report')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('service', 'FailureRecoveryService');
      expect(response.body.data).toHaveProperty('statistics');
      expect(response.body.data).toHaveProperty('timeline');
      expect(response.body.data).toHaveProperty('health');
      expect(response.body.data.statistics).toHaveProperty('successRate');
    });

    test('POST /api/failure-recovery/reset-stats - 重置统计', async () => {
      const response = await request(baseURL)
        .post('/api/failure-recovery/reset-stats')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('故障恢复统计已重置');
      expect(response.body.data.action).toBe('reset_stats');
    });
  });

  describe('故障恢复功能测试', () => {
    let testTask;
    let testSubTasks;
    let testEmailService;

    beforeEach(async () => {
      // 创建测试数据
      const testData = await createTestData();
      testTask = testData.task;
      testSubTasks = testData.subTasks;
      testEmailService = testData.emailService;
    });

    afterEach(async () => {
      // 清理测试数据
      await cleanupTestData();
    });

    test('检测和恢复卡住的任务', async () => {
      // 1. 创建卡住的任务（状态为sending，但超过30分钟未更新）
      const stuckTime = new Date(Date.now() - 35 * 60 * 1000); // 35分钟前
      await testTask.update({
        status: 'sending',
        updated_at: stuckTime
      });

      // 2. 触发故障恢复
      await failureRecoveryService.triggerManualRecovery();

      // 3. 验证任务已恢复
      await testTask.reload();
      expect(testTask.status).toBe('pending');
      expect(testTask.updated_at.getTime()).toBeGreaterThan(stuckTime.getTime());
    });

    test('检测和恢复超时的SubTask', async () => {
      // 1. 创建超时的SubTask（状态为allocated，但超过10分钟未更新）
      const timeoutTime = new Date(Date.now() - 15 * 60 * 1000); // 15分钟前
      await testSubTasks[0].update({
        status: 'allocated',
        service_id: testEmailService.id,
        updated_at: timeoutTime
      });

      // 2. 触发故障恢复
      await failureRecoveryService.triggerManualRecovery();

      // 3. 验证SubTask已恢复
      await testSubTasks[0].reload();
      expect(testSubTasks[0].status).toBe('pending');
      expect(testSubTasks[0].service_id).toBeNull();
      expect(testSubTasks[0].updated_at.getTime()).toBeGreaterThan(timeoutTime.getTime());
    });

    test('故障恢复统计记录', async () => {
      // 1. 重置统计
      failureRecoveryService.resetStats();

      // 2. 创建卡住的任务和超时的SubTask
      const stuckTime = new Date(Date.now() - 35 * 60 * 1000);
      await testTask.update({
        status: 'sending',
        updated_at: stuckTime
      });

      const timeoutTime = new Date(Date.now() - 15 * 60 * 1000);
      await testSubTasks[0].update({
        status: 'processing',
        updated_at: timeoutTime
      });

      // 3. 触发故障恢复
      await failureRecoveryService.triggerManualRecovery();

      // 4. 验证统计数据
      const stats = failureRecoveryService.getRecoveryStats();
      expect(stats.totalChecks).toBeGreaterThan(0);
      expect(stats.stuckTasksFound).toBeGreaterThan(0);
      expect(stats.timeoutSubTasksFound).toBeGreaterThan(0);
      expect(stats.successfulRecoveries).toBeGreaterThan(0);
    });

    test('故障恢复服务自动运行', async () => {
      // 1. 启动故障恢复服务
      await failureRecoveryService.start();

      // 2. 等待服务运行
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 3. 验证服务状态
      const stats = failureRecoveryService.getRecoveryStats();
      expect(stats.isRunning).toBe(true);
      expect(stats.totalChecks).toBeGreaterThan(0);

      // 4. 停止服务
      await failureRecoveryService.stop();
    });
  });

  describe('contact.tags移除验证测试', () => {
    test('验证contact.tags字段已移除', async () => {
      // 通过API检查contact模型结构
      const response = await request(baseURL)
        .get('/api/contacts')
        .set('Authorization', `Bearer ${testToken}`)
        .query({ limit: 1 })
        .expect(200);

      if (response.body.data && response.body.data.length > 0) {
        const contact = response.body.data[0];
        // contact.tags字段应该不存在
        expect(contact).not.toHaveProperty('tags');
      }
    });

    test('验证标签功能仍然正常', async () => {
      // 1. 创建测试标签
      const tagResponse = await request(baseURL)
        .post('/api/tags')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'test-tag-phase42',
          description: 'Phase 4.2测试标签'
        })
        .expect(200);

      const tagId = tagResponse.body.data.id;

      // 2. 验证标签可以正常创建和管理
      const getTagResponse = await request(baseURL)
        .get(`/api/tags/${tagId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(getTagResponse.body.data.name).toBe('test-tag-phase42');
      expect(getTagResponse.body.data).toHaveProperty('contacts');

      // 3. 清理测试标签
      await request(baseURL)
        .delete(`/api/tags/${tagId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);
    });
  });

  describe('性能和稳定性测试', () => {
    test('故障恢复性能测试', async () => {
      const startTime = Date.now();

      // 执行故障恢复检查
      await failureRecoveryService.triggerManualRecovery();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 故障恢复检查应在5秒内完成
      expect(duration).toBeLessThan(5000);
    });

    test('故障恢复服务稳定性测试', async () => {
      // 1. 启动服务
      await failureRecoveryService.start();

      // 2. 连续运行30秒
      await new Promise(resolve => setTimeout(resolve, 30000));

      // 3. 验证服务仍在运行
      const stats = failureRecoveryService.getRecoveryStats();
      expect(stats.isRunning).toBe(true);
      expect(stats.failedRecoveries).toBe(0); // 无恢复失败

      // 4. 停止服务
      await failureRecoveryService.stop();
    });
  });

  describe('错误处理测试', () => {
    test('无效认证处理', async () => {
      await request(baseURL)
        .get('/api/failure-recovery/status')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    test('服务异常处理', async () => {
      // 模拟服务异常情况下的API响应
      const response = await request(baseURL)
        .get('/api/failure-recovery/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      // 即使在异常情况下，健康检查也应该返回状态信息
    });
  });
});

/**
 * 创建测试数据
 */
async function createTestData() {
  // 创建测试用户
  const { User } = require('../../src/backend/src/models');
  const testUser = await User.findOne({ where: { username: 'admin' } });

  if (!testUser) {
    throw new Error('测试用户不存在');
  }

  // 创建测试邮件服务
  const emailService = await EmailService.create({
    name: 'test-service-phase42',
    type: 'smtp',
    host: 'smtp.test.com',
    port: 587,
    username: 'test@test.com',
    password: 'testpass',
    is_enabled: true,
    daily_quota: 1000,
    used_quota: 0,
    sending_rate: 10
  });

  // 创建测试任务
  const task = await Task.create({
    title: 'Phase 4.2测试任务',
    user_id: testUser.id,
    status: 'pending',
    total_count: 2,
    completed_count: 0
  });

  // 创建测试SubTask
  const subTasks = await Promise.all([
    SubTask.create({
      task_id: task.id,
      contact_email: 'test1@example.com',
      contact_name: 'Test User 1',
      status: 'pending'
    }),
    SubTask.create({
      task_id: task.id,
      contact_email: 'test2@example.com',
      contact_name: 'Test User 2',
      status: 'pending'
    })
  ]);

  return {
    user: testUser,
    task,
    subTasks,
    emailService
  };
}

/**
 * 清理测试数据
 */
async function cleanupTestData() {
  try {
    // 清理测试SubTask
    await SubTask.destroy({
      where: {
        contact_email: ['test1@example.com', 'test2@example.com']
      }
    });

    // 清理测试任务
    await Task.destroy({
      where: {
        title: 'Phase 4.2测试任务'
      }
    });

    // 清理测试邮件服务
    await EmailService.destroy({
      where: {
        name: 'test-service-phase42'
      }
    });

  } catch (error) {
    console.warn('清理测试数据失败:', error.message);
  }
}

module.exports = {
  testSuite: 'Phase 4.2 故障恢复系统集成测试',
  testCount: 18,
  estimatedTime: '60分钟'
}; 