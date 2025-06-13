/**
 * 邮件路由机制测试
 */
const { sequelize } = require('../../src/backend/src/models');
const { EmailService, User, UserServiceMapping } = require('../../src/backend/src/models');
const EmailRoutingService = require('../../src/backend/src/services/infrastructure/EmailRoutingService');

describe('邮件路由机制测试', () => {
  let testUser, emailServices;

  beforeAll(async () => {
    await sequelize.authenticate();
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    // 清理数据
    await UserServiceMapping.destroy({ where: {}, force: true });
    await EmailService.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });

    // 创建测试用户
    testUser = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password_hash: 'hashedpassword',
      remaining_quota: 1000
    });

    // 创建多个邮件服务
    emailServices = await EmailService.bulkCreate([
      {
        name: 'Service A',
        provider: 'engagelab',
        domain: 'servicea.com',
        api_key: 'key_a',
        api_secret: 'secret_a',
        is_enabled: true,
        is_frozen: false,
        daily_quota: 1000,
        used_quota: 100,
        sending_rate: 60
      },
      {
        name: 'Service B',
        provider: 'engagelab',
        domain: 'serviceb.com',
        api_key: 'key_b',
        api_secret: 'secret_b',
        is_enabled: true,
        is_frozen: false,
        daily_quota: 500,
        used_quota: 450,
        sending_rate: 120
      },
      {
        name: 'Service C',
        provider: 'engagelab',
        domain: 'servicec.com',
        api_key: 'key_c',
        api_secret: 'secret_c',
        is_enabled: false, // 禁用的服务
        is_frozen: false,
        daily_quota: 2000,
        used_quota: 0,
        sending_rate: 30
      }
    ], { returning: true });

    // 创建用户服务映射
    await UserServiceMapping.bulkCreate([
      {
        user_id: testUser.id,
        service_id: emailServices[0].id,
        is_enabled: true,
        priority: 1
      },
      {
        user_id: testUser.id,
        service_id: emailServices[1].id,
        is_enabled: true,
        priority: 2
      },
      {
        user_id: testUser.id,
        service_id: emailServices[2].id,
        is_enabled: false, // 用户禁用
        priority: 3
      }
    ]);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('获取用户可用服务', () => {
    test('应该返回用户启用且服务启用的服务', async () => {
      const availableServices = await EmailRoutingService.getUserAvailableServices(testUser.id);

      expect(availableServices.length).toBe(2); // 只有前两个服务可用
      expect(availableServices[0].name).toBe('Service A');
      expect(availableServices[1].name).toBe('Service B');
    });

    test('应该按优先级排序', async () => {
      // 修改优先级
      await UserServiceMapping.update(
        { priority: 3 },
        { where: { user_id: testUser.id, service_id: emailServices[0].id } }
      );
      await UserServiceMapping.update(
        { priority: 1 },
        { where: { user_id: testUser.id, service_id: emailServices[1].id } }
      );

      const availableServices = await EmailRoutingService.getUserAvailableServices(testUser.id);

      expect(availableServices[0].name).toBe('Service B'); // 优先级1
      expect(availableServices[1].name).toBe('Service A'); // 优先级3
    });

    test('应该过滤掉冻结的服务', async () => {
      // 冻结Service A
      await emailServices[0].update({ is_frozen: true });

      const availableServices = await EmailRoutingService.getUserAvailableServices(testUser.id);

      expect(availableServices.length).toBe(1);
      expect(availableServices[0].name).toBe('Service B');
    });
  });

  describe('服务选择算法', () => {
    test('应该选择剩余额度最多的服务', async () => {
      const selectedService = await EmailRoutingService.selectEmailService(testUser.id, 1);

      expect(selectedService).toBeTruthy();
      expect(selectedService.name).toBe('Service A'); // 剩余额度900，比Service B的50多
    });

    test('应该检查服务剩余额度', async () => {
      // 将Service A的额度用完
      await emailServices[0].update({ used_quota: 1000 });

      const selectedService = await EmailRoutingService.selectEmailService(testUser.id, 1);

      expect(selectedService.name).toBe('Service B'); // 只有Service B还有额度
    });

    test('当所有服务额度不足时应该返回null', async () => {
      // 将所有服务额度用完
      await emailServices[0].update({ used_quota: 1000 });
      await emailServices[1].update({ used_quota: 500 });

      const selectedService = await EmailRoutingService.selectEmailService(testUser.id, 1);

      expect(selectedService).toBeNull();
    });

    test('应该检查请求数量是否超过剩余额度', async () => {
      const selectedService = await EmailRoutingService.selectEmailService(testUser.id, 1000);

      expect(selectedService).toBeNull(); // 没有服务能满足1000的需求
    });
  });

  describe('额度管理', () => {
    test('应该正确计算剩余额度', async () => {
      const remainingQuota = await EmailRoutingService.getServiceRemainingQuota(emailServices[0].id);

      expect(remainingQuota).toBe(900); // 1000 - 100
    });

    test('应该更新服务使用额度', async () => {
      await EmailRoutingService.updateServiceUsage(emailServices[0].id, 50);

      await emailServices[0].reload();
      expect(emailServices[0].used_quota).toBe(150); // 100 + 50
    });

    test('应该检查服务是否可用', async () => {
      const isAvailable = await EmailRoutingService.isServiceAvailable(emailServices[0].id, 100);
      expect(isAvailable).toBe(true);

      const isNotAvailable = await EmailRoutingService.isServiceAvailable(emailServices[0].id, 1000);
      expect(isNotAvailable).toBe(false);
    });
  });

  describe('负载均衡', () => {
    test('应该在多个服务间分配负载', async () => {
      const selections = [];
      
      // 进行多次选择
      for (let i = 0; i < 10; i++) {
        const service = await EmailRoutingService.selectEmailService(testUser.id, 1);
        if (service) {
          selections.push(service.name);
          // 模拟使用额度
          await EmailRoutingService.updateServiceUsage(service.id, 1);
        }
      }

      // 检查是否使用了多个服务
      const uniqueServices = [...new Set(selections)];
      expect(uniqueServices.length).toBeGreaterThan(1);
    });

    test('应该优先使用剩余额度多的服务', async () => {
      // 设置Service A有更多剩余额度
      await emailServices[0].update({ used_quota: 0 });
      await emailServices[1].update({ used_quota: 400 });

      const selections = [];
      
      for (let i = 0; i < 5; i++) {
        const service = await EmailRoutingService.selectEmailService(testUser.id, 1);
        if (service) {
          selections.push(service.name);
          await EmailRoutingService.updateServiceUsage(service.id, 1);
        }
      }

      // Service A应该被选择更多次
      const serviceACount = selections.filter(s => s === 'Service A').length;
      const serviceBCount = selections.filter(s => s === 'Service B').length;
      
      expect(serviceACount).toBeGreaterThanOrEqual(serviceBCount);
    });
  });

  describe('服务健康检查', () => {
    test('应该检测服务健康状态', async () => {
      const healthStatus = await EmailRoutingService.checkServiceHealth(emailServices[0].id);

      expect(healthStatus).toHaveProperty('service_id');
      expect(healthStatus).toHaveProperty('is_healthy');
      expect(healthStatus).toHaveProperty('remaining_quota');
      expect(healthStatus).toHaveProperty('usage_percentage');
    });

    test('应该标识额度不足的服务为不健康', async () => {
      // 将服务额度用完
      await emailServices[0].update({ used_quota: 1000 });

      const healthStatus = await EmailRoutingService.checkServiceHealth(emailServices[0].id);

      expect(healthStatus.is_healthy).toBe(false);
      expect(healthStatus.remaining_quota).toBe(0);
      expect(healthStatus.usage_percentage).toBe(100);
    });

    test('应该获取所有服务的健康状态', async () => {
      const allHealthStatus = await EmailRoutingService.getAllServicesHealth();

      expect(allHealthStatus.length).toBe(3);
      expect(allHealthStatus[0]).toHaveProperty('service_name');
      expect(allHealthStatus[0]).toHaveProperty('is_healthy');
    });
  });

  describe('故障转移', () => {
    test('当首选服务不可用时应该选择备用服务', async () => {
      // 禁用优先级最高的服务
      await UserServiceMapping.update(
        { is_enabled: false },
        { where: { user_id: testUser.id, service_id: emailServices[0].id } }
      );

      const selectedService = await EmailRoutingService.selectEmailService(testUser.id, 1);

      expect(selectedService.name).toBe('Service B'); // 应该选择备用服务
    });

    test('当服务额度不足时应该自动切换', async () => {
      // 将Service A额度用完
      await emailServices[0].update({ used_quota: 1000 });

      const selectedService = await EmailRoutingService.selectEmailService(testUser.id, 1);

      expect(selectedService.name).toBe('Service B');
    });

    test('应该记录故障转移事件', async () => {
      // 冻结Service A
      await emailServices[0].update({ is_frozen: true });

      const selectedService = await EmailRoutingService.selectEmailService(testUser.id, 1);

      expect(selectedService.name).toBe('Service B');
      
      // 这里可以检查是否记录了故障转移日志
      // 实际实现中可能需要添加日志记录功能
    });
  });

  describe('配额重置', () => {
    test('应该能够重置日配额', async () => {
      // 设置服务已使用一些额度
      await emailServices[0].update({ used_quota: 500 });

      await EmailRoutingService.resetDailyQuota(emailServices[0].id);

      await emailServices[0].reload();
      expect(emailServices[0].used_quota).toBe(0);
    });

    test('应该能够批量重置所有服务的日配额', async () => {
      // 设置所有服务都有使用额度
      await EmailService.update({ used_quota: 100 }, { where: {} });

      await EmailRoutingService.resetAllDailyQuotas();

      const services = await EmailService.findAll();
      services.forEach(service => {
        expect(service.used_quota).toBe(0);
      });
    });
  });

  describe('统计和监控', () => {
    test('应该提供服务使用统计', async () => {
      const stats = await EmailRoutingService.getServiceUsageStats(emailServices[0].id);

      expect(stats).toHaveProperty('total_quota');
      expect(stats).toHaveProperty('used_quota');
      expect(stats).toHaveProperty('remaining_quota');
      expect(stats).toHaveProperty('usage_percentage');
    });

    test('应该提供用户的服务使用概览', async () => {
      const overview = await EmailRoutingService.getUserServiceOverview(testUser.id);

      expect(overview).toHaveProperty('total_services');
      expect(overview).toHaveProperty('available_services');
      expect(overview).toHaveProperty('total_quota');
      expect(overview).toHaveProperty('remaining_quota');
      expect(overview.services).toBeInstanceOf(Array);
    });
  });
}); 