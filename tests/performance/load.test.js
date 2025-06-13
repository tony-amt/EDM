const request = require('supertest');
const app = require('../../src/index');
const { performance } = require('perf_hooks');

describe('性能和负载测试', () => {
  let authToken, userId;

  beforeAll(async () => {
    // 设置测试超时时间
    jest.setTimeout(60000);

    // 注册测试用户
    const userData = {
      username: 'performancetest',
      email: 'performance@example.com',
      password: 'Test123456'
    };

    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(userData);

    authToken = registerResponse.body.data.token;
    userId = registerResponse.body.data.user.id;
  });

  describe('API响应时间测试', () => {
    test('认证API应该在100ms内响应', async () => {
      const start = performance.now();

      await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100);
    });

    test('健康检查API应该在50ms内响应', async () => {
      const start = performance.now();

      await request(app)
        .get('/api/health/ping')
        .expect(200);

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(50);
    });

    test('群发任务列表API应该在200ms内响应', async () => {
      // 先创建一些测试数据
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/campaigns')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: `性能测试任务${i}`,
            subject: `性能测试主题${i}`,
            content: `性能测试内容${i}`
          });
      }

      const start = performance.now();

      await request(app)
        .get('/api/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(200);
    });
  });

  describe('并发请求测试', () => {
    test('应该处理并发认证请求', async () => {
      const concurrentRequests = 20;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const promise = request(app)
          .get('/api/auth/verify')
          .set('Authorization', `Bearer ${authToken}`);
        promises.push(promise);
      }

      const start = performance.now();
      const responses = await Promise.all(promises);
      const duration = performance.now() - start;

      // 所有请求都应该成功
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // 平均响应时间应该合理
      const avgResponseTime = duration / concurrentRequests;
      expect(avgResponseTime).toBeLessThan(100);
    });

    test('应该处理并发群发任务创建', async () => {
      const concurrentRequests = 10;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const promise = request(app)
          .post('/api/campaigns')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: `并发测试任务${i}`,
            subject: `并发测试主题${i}`,
            content: `并发测试内容${i}`
          });
        promises.push(promise);
      }

      const responses = await Promise.all(promises);

      // 所有请求都应该成功
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      // 验证所有任务都创建成功且没有重复
      const campaignIds = responses.map(r => r.body.data.campaign.id);
      const uniqueIds = new Set(campaignIds);
      expect(uniqueIds.size).toBe(concurrentRequests);
    });

    test('应该处理高频读取请求', async () => {
      // 创建一个测试任务
      const campaignResponse = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '高频读取测试任务',
          subject: '高频读取测试主题',
          content: '高频读取测试内容'
        });

      const campaignId = campaignResponse.body.data.campaign.id;
      const concurrentRequests = 50;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const promise = request(app)
          .get(`/api/campaigns/${campaignId}`)
          .set('Authorization', `Bearer ${authToken}`);
        promises.push(promise);
      }

      const start = performance.now();
      const responses = await Promise.all(promises);
      const duration = performance.now() - start;

      // 所有请求都应该成功
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.data.campaign.id).toBe(campaignId);
      });

      // 总响应时间应该合理
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('大数据量处理测试', () => {
    test('应该处理大量联系人创建', async () => {
      const contactCount = 100;
      const batchSize = 10;
      const batches = Math.ceil(contactCount / batchSize);

      const start = performance.now();

      for (let batch = 0; batch < batches; batch++) {
        const promises = [];
        const batchStart = batch * batchSize;
        const batchEnd = Math.min((batch + 1) * batchSize, contactCount);

        for (let i = batchStart; i < batchEnd; i++) {
          const promise = request(app)
            .post('/api/contacts')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              email: `contact${i}@example.com`,
              name: `联系人${i}`,
              phone: `1380013800${i % 10}`
            });
          promises.push(promise);
        }

        const batchResponses = await Promise.all(promises);
        batchResponses.forEach(response => {
          expect(response.status).toBe(201);
        });
      }

      const duration = performance.now() - start;
      const avgTimePerContact = duration / contactCount;

      console.log(`创建${contactCount}个联系人用时: ${duration.toFixed(2)}ms`);
      console.log(`平均每个联系人: ${avgTimePerContact.toFixed(2)}ms`);

      expect(avgTimePerContact).toBeLessThan(50); // 每个联系人创建不超过50ms
    });

    test('应该处理大量数据的分页查询', async () => {
      const pageSize = 20;
      const totalPages = 5;

      for (let page = 1; page <= totalPages; page++) {
        const start = performance.now();

        const response = await request(app)
          .get(`/api/contacts?page=${page}&limit=${pageSize}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const duration = performance.now() - start;

        expect(response.body.data.contacts).toBeDefined();
        expect(response.body.data.pagination).toBeDefined();
        expect(response.body.data.pagination.currentPage).toBe(page);
        expect(response.body.data.pagination.limit).toBe(pageSize);

        // 分页查询响应时间应该稳定
        expect(duration).toBeLessThan(300);

        console.log(`第${page}页查询用时: ${duration.toFixed(2)}ms`);
      }
    });

    test('应该处理复杂搜索查询', async () => {
      const searchQueries = [
        '联系人',
        'example.com',
        '138001380',
        '测试',
        ''
      ];

      for (const query of searchQueries) {
        const start = performance.now();

        const response = await request(app)
          .get(`/api/contacts?search=${encodeURIComponent(query)}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const duration = performance.now() - start;

        expect(response.body.data.contacts).toBeDefined();
        expect(Array.isArray(response.body.data.contacts)).toBe(true);

        // 搜索查询响应时间应该合理
        expect(duration).toBeLessThan(500);

        console.log(`搜索"${query}"用时: ${duration.toFixed(2)}ms`);
      }
    });
  });

  describe('内存和资源使用测试', () => {
    test('应该在大量操作后正确释放内存', async () => {
      const initialMemory = process.memoryUsage();

      // 执行大量操作
      for (let i = 0; i < 50; i++) {
        await request(app)
          .post('/api/campaigns')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: `内存测试任务${i}`,
            subject: `内存测试主题${i}`,
            content: `内存测试内容${i}`.repeat(100) // 创建较大的内容
          });
      }

      // 触发垃圾回收
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(`初始内存: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`最终内存: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`内存增长: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

      // 内存增长应该在合理范围内（小于50MB）
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    test('应该正确处理资源密集型操作', async () => {
      const start = performance.now();

      // 创建一个包含大量数据的群发任务
      const largeContent = 'A'.repeat(10000); // 10KB内容

      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '资源密集型测试任务',
          subject: '资源密集型测试主题',
          content: largeContent
        })
        .expect(201);

      const duration = performance.now() - start;

      expect(response.body.success).toBe(true);
      expect(response.body.data.campaign.content).toBe(largeContent);

      // 即使处理大数据，响应时间也应该合理
      expect(duration).toBeLessThan(1000);

      console.log(`处理10KB数据用时: ${duration.toFixed(2)}ms`);
    });
  });

  describe('数据库性能测试', () => {
    test('应该快速执行数据库查询', async () => {
      const queryTypes = [
        { path: '/api/campaigns', description: '群发任务查询' },
        { path: '/api/contacts', description: '联系人查询' },
        { path: '/api/templates', description: '模板查询' }
      ];

      for (const queryType of queryTypes) {
        const start = performance.now();

        await request(app)
          .get(queryType.path)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const duration = performance.now() - start;

        console.log(`${queryType.description}用时: ${duration.toFixed(2)}ms`);

        // 数据库查询应该在合理时间内完成
        expect(duration).toBeLessThan(200);
      }
    });

    test('应该高效处理聚合查询', async () => {
      // 创建一些有统计数据的群发任务
      const campaign = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '统计测试任务',
          subject: '统计测试主题',
          content: '统计测试内容'
        });

      const campaignId = campaign.body.data.campaign.id;

      const start = performance.now();

      const response = await request(app)
        .get(`/api/campaigns/${campaignId}/statistics`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const duration = performance.now() - start;

      expect(response.body.data.statistics).toBeDefined();

      console.log(`统计查询用时: ${duration.toFixed(2)}ms`);

      // 聚合查询应该快速完成
      expect(duration).toBeLessThan(300);
    });
  });

  describe('缓存性能测试', () => {
    test('应该利用缓存提高重复查询性能', async () => {
      const queryPath = '/api/campaigns';

      // 第一次查询（无缓存）
      const start1 = performance.now();
      await request(app)
        .get(queryPath)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      const duration1 = performance.now() - start1;

      // 第二次查询（可能有缓存）
      const start2 = performance.now();
      await request(app)
        .get(queryPath)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      const duration2 = performance.now() - start2;

      console.log(`首次查询用时: ${duration1.toFixed(2)}ms`);
      console.log(`缓存查询用时: ${duration2.toFixed(2)}ms`);

      // 缓存查询应该更快或至少不慢很多
      expect(duration2).toBeLessThanOrEqual(duration1 * 1.2);
    });
  });

  describe('错误处理性能测试', () => {
    test('应该快速处理无效请求', async () => {
      const invalidRequests = [
        { method: 'post', path: '/api/campaigns', data: {} }, // 缺少必需字段
        { method: 'get', path: '/api/campaigns/invalid-id' }, // 无效ID
        { method: 'put', path: '/api/campaigns/999999', data: {} }, // 不存在的资源
      ];

      for (const req of invalidRequests) {
        const start = performance.now();

        const response = await request(app)[req.method](req.path)
          .set('Authorization', `Bearer ${authToken}`)
          .send(req.data || {});

        const duration = performance.now() - start;

        // 错误处理应该很快
        expect(duration).toBeLessThan(100);
        expect(response.status).toBeGreaterThanOrEqual(400);

        console.log(`错误处理用时: ${duration.toFixed(2)}ms`);
      }
    });

    test('应该快速处理认证失败', async () => {
      const start = performance.now();

      await request(app)
        .get('/api/campaigns')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      const duration = performance.now() - start;

      // 认证失败应该很快返回
      expect(duration).toBeLessThan(50);

      console.log(`认证失败处理用时: ${duration.toFixed(2)}ms`);
    });
  });

  describe('压力测试', () => {
    test('应该在高负载下保持稳定', async () => {
      const requestCount = 100;
      const concurrency = 10;
      const batches = requestCount / concurrency;

      const results = [];

      for (let batch = 0; batch < batches; batch++) {
        const promises = [];

        for (let i = 0; i < concurrency; i++) {
          const promise = (async () => {
            const start = performance.now();
            
            const response = await request(app)
              .get('/api/health/ping')
              .expect(200);

            const duration = performance.now() - start;
            return { duration, success: response.status === 200 };
          })();

          promises.push(promise);
        }

        const batchResults = await Promise.all(promises);
        results.push(...batchResults);
      }

      // 统计结果
      const successCount = results.filter(r => r.success).length;
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      const maxDuration = Math.max(...results.map(r => r.duration));
      const minDuration = Math.min(...results.map(r => r.duration));

      console.log(`压力测试结果:`);
      console.log(`总请求数: ${requestCount}`);
      console.log(`成功请求: ${successCount} (${(successCount / requestCount * 100).toFixed(2)}%)`);
      console.log(`平均响应时间: ${avgDuration.toFixed(2)}ms`);
      console.log(`最大响应时间: ${maxDuration.toFixed(2)}ms`);
      console.log(`最小响应时间: ${minDuration.toFixed(2)}ms`);

      // 压力测试要求
      expect(successCount / requestCount).toBeGreaterThan(0.95); // 95%成功率
      expect(avgDuration).toBeLessThan(200); // 平均响应时间200ms以内
      expect(maxDuration).toBeLessThan(1000); // 最大响应时间1秒以内
    });
  });

  describe('长时间运行稳定性测试', () => {
    test('应该在长时间运行后保持性能', async () => {
      const testDuration = 10000; // 10秒
      const interval = 100; // 每100ms一次请求
      const requestCount = testDuration / interval;

      const results = [];
      const startTime = performance.now();

      for (let i = 0; i < requestCount; i++) {
        const requestStart = performance.now();

        await request(app)
          .get('/api/health/ping')
          .expect(200);

        const requestDuration = performance.now() - requestStart;
        results.push(requestDuration);

        // 控制请求间隔
        const elapsed = performance.now() - startTime;
        const expectedTime = (i + 1) * interval;
        if (elapsed < expectedTime) {
          await new Promise(resolve => setTimeout(resolve, expectedTime - elapsed));
        }
      }

      const totalDuration = performance.now() - startTime;

      // 分析性能趋势
      const firstHalf = results.slice(0, Math.floor(results.length / 2));
      const secondHalf = results.slice(Math.floor(results.length / 2));

      const firstHalfAvg = firstHalf.reduce((sum, d) => sum + d, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, d) => sum + d, 0) / secondHalf.length;

      console.log(`长时间运行测试结果:`);
      console.log(`总时长: ${totalDuration.toFixed(2)}ms`);
      console.log(`总请求: ${requestCount}`);
      console.log(`前半段平均响应时间: ${firstHalfAvg.toFixed(2)}ms`);
      console.log(`后半段平均响应时间: ${secondHalfAvg.toFixed(2)}ms`);

      // 性能不应该明显下降
      expect(secondHalfAvg).toBeLessThanOrEqual(firstHalfAvg * 1.5);
    });
  });
}); 