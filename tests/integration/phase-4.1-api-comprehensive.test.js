/**
 * Phase 4.1 队列调度系统优化 - API综合测试
 * 测试所有新增和修改的API端点
 */

const request = require('supertest');
const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');

const API_BASE_URL = 'http://localhost:3002';
const AUTH_TOKEN = 'dev-permanent-test-token-admin-2025';

describe('Phase 4.1 API综合测试', () => {

  beforeAll(async () => {
    console.log('🚀 开始Phase 4.1 API综合测试');
    console.log(`测试环境: ${API_BASE_URL}`);
  });

  afterAll(async () => {
    console.log('✅ Phase 4.1 API综合测试完成');
  });

  describe('1. 队列调度系统V2 API测试', () => {

    test('GET /api/queue-v2/health - 基础健康检查', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/queue-v2/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Queue V2 API is working');
      expect(response.body.timestamp).toBeDefined();

      console.log('✅ 队列V2基础健康检查通过');
    });

    test('GET /api/queue-v2/health-detailed - 详细健康状态', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/queue-v2/health-detailed')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('queueScheduler');
      expect(response.body.data).toHaveProperty('monitoring');
      expect(response.body.data).toHaveProperty('configuration');
      expect(response.body.data).toHaveProperty('database');

      console.log('✅ 队列V2详细健康检查通过');
      console.log('   - 队列调度器状态:', response.body.data.queueScheduler.status);
      console.log('   - 监控系统状态:', response.body.data.monitoring.status);
    });

    test('GET /api/queue-v2/status - 获取队列状态', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/queue-v2/status')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('isRunning');
      expect(response.body.data).toHaveProperty('pendingSubTasks');
      expect(response.body.data).toHaveProperty('processingSubTasks');
      expect(response.body.data).toHaveProperty('completedSubTasks');
      expect(response.body.data).toHaveProperty('failedSubTasks');

      console.log('✅ 队列状态查询通过');
      console.log('   - 运行状态:', response.body.data.isRunning);
      console.log('   - 待处理任务:', response.body.data.pendingSubTasks);
    });

    test('GET /api/queue-v2/services/stats - 服务统计', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/queue-v2/services/stats')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalServices');
      expect(response.body.data).toHaveProperty('availableServices');
      expect(response.body.data).toHaveProperty('serviceDetails');
      expect(typeof response.body.data.totalServices).toBe('number');

      console.log('✅ 服务统计查询通过');
      console.log('   - 总服务数:', response.body.data.totalServices);
      console.log('   - 可用服务数:', response.body.data.availableServices);
    });

    test('GET /api/queue-v2/services/ready - 可用服务', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/queue-v2/services/ready')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.services)).toBe(true);

      console.log('✅ 可用服务查询通过');
      console.log('   - 可用服务列表长度:', response.body.data.services.length);
    });

    test('POST /api/queue-v2/start - 启动队列调度器', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/queue-v2/start')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('running');

      console.log('✅ 队列调度器启动成功');
    });

    test('POST /api/queue-v2/stop - 停止队列调度器', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/queue-v2/stop')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('stopped');

      console.log('✅ 队列调度器停止成功');
    });
  });

  describe('2. 监控系统API测试', () => {

    test('GET /api/monitoring/system-health - 系统健康检查', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/monitoring/system-health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.services).toHaveProperty('api');
      expect(response.body.data.services).toHaveProperty('database');
      expect(response.body.data.services).toHaveProperty('redis');

      console.log('✅ 系统健康检查通过');
      console.log('   - 整体状态:', response.body.data.status);
    });

    test('GET /api/monitoring/performance-metrics - 性能指标', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/monitoring/performance-metrics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('cpu');
      expect(response.body.data).toHaveProperty('memory');
      expect(response.body.data).toHaveProperty('uptime');
      expect(typeof response.body.data.cpu.usage).toBe('number');

      console.log('✅ 性能指标获取通过');
      console.log('   - CPU使用率:', response.body.data.cpu.usage + '%');
      console.log('   - 内存使用率:', response.body.data.memory.usage + '%');
    });

    test('GET /api/monitoring/queue-status - 队列状态监控', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/monitoring/queue-status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('queueLength');
      expect(response.body.data).toHaveProperty('processingTasks');
      expect(typeof response.body.data.queueLength).toBe('number');

      console.log('✅ 队列状态监控通过');
      console.log('   - 队列长度:', response.body.data.queueLength);
    });

    test('GET /api/monitoring/alerts - 告警信息', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/monitoring/alerts')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.alerts)).toBe(true);

      console.log('✅ 告警信息获取通过');
      console.log('   - 当前告警数量:', response.body.data.alerts.length);
    });
  });

  describe('3. 配置管理API测试', () => {

    test('GET /api/system-config/ - 获取所有配置', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/system-config/')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.total).toBeGreaterThan(0);

      console.log('✅ 获取所有配置通过');
      console.log('   - 配置项总数:', response.body.total);
    });

    test('GET /api/system-config/queue - 获取队列配置', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/system-config/queue')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      // 验证队列配置项
      const queueConfigs = response.body.data;
      const expectedKeys = [
        'queue_batch_size',
        'queue_interval_seconds',
        'max_concurrent_tasks',
        'max_retry_attempts'
      ];

      expectedKeys.forEach(key => {
        const config = queueConfigs.find(c =>
          c.configKey === key || c.config_key === key
        );
        expect(config).toBeDefined();
      });

      console.log('✅ 获取队列配置通过');
      console.log('   - 队列配置项数量:', queueConfigs.length);
    });
  });

  describe('4. API响应时间性能测试', () => {

    test('API响应时间测试 - 所有关键端点', async () => {
      const endpoints = [
        { method: 'GET', path: '/api/queue-v2/health', auth: false },
        { method: 'GET', path: '/api/queue-v2/status', auth: true },
        { method: 'GET', path: '/api/monitoring/system-health', auth: false },
        { method: 'GET', path: '/api/system-config/', auth: false }
      ];

      for (const endpoint of endpoints) {
        const startTime = Date.now();

        let req = request(API_BASE_URL)[endpoint.method.toLowerCase()](endpoint.path);
        if (endpoint.auth) {
          req = req.set('Authorization', `Bearer ${AUTH_TOKEN}`);
        }

        const response = await req.expect(200);
        const responseTime = Date.now() - startTime;

        expect(response.body.success).toBe(true);
        expect(responseTime).toBeLessThan(1000); // 响应时间小于1秒

        console.log(`✅ ${endpoint.method} ${endpoint.path} - 响应时间: ${responseTime}ms`);
      }
    });
  });

  describe('5. API并发测试', () => {

    test('并发请求测试', async () => {
      const concurrentRequests = 10;
      const requests = [];

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

      console.log('✅ 并发请求测试通过');
      console.log(`   - 并发数: ${concurrentRequests}`);
      console.log(`   - 总耗时: ${totalTime}ms`);
      console.log(`   - 平均响应时间: ${averageTime}ms`);

      expect(averageTime).toBeLessThan(500); // 平均响应时间小于500ms
    });
  });

  describe('6. 错误处理测试', () => {

    test('无效认证token测试', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/queue-v2/health-detailed')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      console.log('✅ 无效认证token正确被拒绝');
    });

    test('不存在的端点测试', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/queue-v2/nonexistent')
        .expect(404);

      console.log('✅ 不存在的端点正确返回404');
    });
  });
});

module.exports = {
  testSuite: 'Phase 4.1 API综合测试',
  testCount: 20,
  estimatedTime: '45分钟'
}; 