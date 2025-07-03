const { setupTestEnvironment, teardownTestEnvironment } = require('./setup-docker');

describe('🚀 V2.0-发信服务管理功能-集成测试', () => {
  let testEnv;
  let apiClient;
  let adminApiClient;
  let testUser;
  let createdServices = [];

  beforeAll(async () => {
    console.log('🔧 [V2.0-发信服务管理] 设置测试环境...');
    testEnv = await setupTestEnvironment();
    apiClient = testEnv.apiClient;
    adminApiClient = testEnv.adminApiClient;
    testUser = testEnv.testUser;
    console.log('✅ 测试环境就绪');
  });

  afterAll(async () => {
    console.log('🧹 [V2.0-发信服务管理] 清理测试数据...');
    // 清理创建的发信服务
    for (const service of createdServices) {
      try {
        await adminApiClient.delete(`/email-services/${service.id}`);
        console.log(`✅ 已清理发信服务: ${service.name || service.id}`);
      } catch (error) {
        console.log(`⚠️ 清理发信服务失败: ${service.name || service.id}`);
      }
    }
    await teardownTestEnvironment();
    console.log('✅ 测试环境清理完成');
  });

  describe('TC-INT-SERVICE-001: 发信服务创建功能', () => {
    test('应该成功创建Engagelab发信服务', async () => {
      const serviceData = {
        name: 'Engagelab测试服务',
        provider: 'engagelab',
        api_key: 'test-api-key-123',
        api_secret: 'test-api-secret-123',
        domain: 'mail.test.com',
        daily_quota: 1000,
        sending_rate: 50,
        quota_reset_time: '00:00:00'
      };

      const response = await adminApiClient.post('/email-services', serviceData);
      
      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveProperty('id');
      expect(response.data.data.name).toBe(serviceData.name);
      expect(response.data.data.provider).toBe(serviceData.provider);
      expect(response.data.data.domain).toBe(serviceData.domain);
      expect(response.data.data.daily_quota).toBe(serviceData.daily_quota);
      expect(response.data.data.sending_rate).toBe(serviceData.sending_rate);
      expect(response.data.data.is_enabled).toBe(true);
      
      // 验证UUID格式
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(response.data.data.id).toMatch(uuidPattern);
      
      createdServices.push(response.data.data);
    });

    test('应该拒绝创建重复名称的发信服务', async () => {
      const serviceData = {
        name: '重复服务名称',
        provider: 'engagelab',
        api_key: 'duplicate-key',
        api_secret: 'duplicate-secret',
        domain: 'duplicate.test.com',
        daily_quota: 500,
        sending_rate: 25
      };

      // 创建第一个服务
      const firstResponse = await adminApiClient.post('/email-services', serviceData);
      expect(firstResponse.status).toBe(201);
      createdServices.push(firstResponse.data.data);

      // 尝试创建重复名称的服务
      const duplicateResponse = await adminApiClient.post('/email-services', serviceData);
      expect(duplicateResponse.status).toBe(409);
      expect(duplicateResponse.data.success).toBe(false);
      expect(duplicateResponse.data.message).toBe('服务名称已存在');
    });

    test('应该拒绝无效的服务提供商', async () => {
      const invalidServiceData = {
        name: '无效服务类型测试',
        provider: 'invalid-provider',
        api_key: 'test-key',
        api_secret: 'test-secret',
        domain: 'invalid.test.com',
        daily_quota: 1000,
        sending_rate: 50
      };

      const response = await adminApiClient.post('/email-services', invalidServiceData);
      
      expect(response.status).toBe(400);
      expect(response.data.success).toBe(false);
      expect(response.data.message).toBe('输入验证失败');
    });

    test('应该拒绝缺少必要字段的服务', async () => {
      const incompleteServiceData = {
        name: '缺少字段测试',
        provider: 'engagelab',
        // 缺少api_key
        api_secret: 'test-secret',
        domain: 'incomplete.test.com',
        daily_quota: 1000,
        sending_rate: 50
      };

      const response = await adminApiClient.post('/email-services', incompleteServiceData);
      
      expect(response.status).toBe(400);
      expect(response.data.success).toBe(false);
      expect(response.data.message).toBe('输入验证失败');
    });
  });

  describe('TC-INT-SERVICE-002: 发信服务查询功能', () => {
    test('应该正确返回发信服务列表', async () => {
      const response = await adminApiClient.get('/email-services');
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.data)).toBe(true);
      
      // 验证数据结构
      if (response.data.data.length > 0) {
        const service = response.data.data[0];
        expect(service).toHaveProperty('id');
        expect(service).toHaveProperty('name');
        expect(service).toHaveProperty('provider');
        expect(service).toHaveProperty('domain');
        expect(service).toHaveProperty('daily_quota');
        expect(service).toHaveProperty('used_quota');
        expect(service).toHaveProperty('sending_rate');
        expect(service).toHaveProperty('is_enabled');
        expect(service).toHaveProperty('created_at');
        // API凭据应该被隐藏
        expect(service).not.toHaveProperty('api_key');
        expect(service).not.toHaveProperty('api_secret');
      }
    });

    test('普通用户应该看到受限的服务信息', async () => {
      const response = await apiClient.get('/email-services');
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.data)).toBe(true);
      
      // 验证普通用户看到的字段更少
      if (response.data.data.length > 0) {
        const service = response.data.data[0];
        expect(service).toHaveProperty('id');
        expect(service).toHaveProperty('name');
        expect(service).toHaveProperty('provider');
        expect(service).toHaveProperty('domain');
        expect(service).toHaveProperty('is_enabled');
        expect(service).toHaveProperty('created_at');
        // 敏感信息应该被隐藏
        expect(service).not.toHaveProperty('api_key');
        expect(service).not.toHaveProperty('api_secret');
        expect(service).not.toHaveProperty('daily_quota');
        expect(service).not.toHaveProperty('used_quota');
      }
    });
  });

  describe('TC-INT-SERVICE-003: 发信服务更新功能', () => {
    test('管理员应该能更新服务配置', async () => {
      // 创建一个服务用于更新测试
      const serviceData = {
        name: '更新测试服务',
        provider: 'engagelab',
        api_key: 'update-test-key',
        api_secret: 'update-test-secret',
        domain: 'update.test.com',
        daily_quota: 1000,
        sending_rate: 50
      };

      const createResponse = await adminApiClient.post('/email-services', serviceData);
      const serviceId = createResponse.data.data.id;
      createdServices.push(createResponse.data.data);

      // 更新服务配置
      const updateData = {
        name: '更新后的服务名称',
        daily_quota: 2000,
        sending_rate: 100
      };

      const updateResponse = await adminApiClient.put(`/email-services/${serviceId}`, updateData);
      
      expect(updateResponse.status).toBe(200);
      expect(updateResponse.data.success).toBe(true);
      expect(updateResponse.data.data.name).toBe(updateData.name);
      expect(updateResponse.data.data.daily_quota).toBe(updateData.daily_quota);
      expect(updateResponse.data.data.sending_rate).toBe(updateData.sending_rate);
    });

    test('应该拒绝更新不存在的服务', async () => {
      const nonExistentId = '550e8400-e29b-41d4-a716-446655440000';
      
      const response = await adminApiClient.put(`/email-services/${nonExistentId}`, {
        name: '不存在的服务'
      });
      
      expect(response.status).toBe(404);
      expect(response.data.success).toBe(false);
      expect(response.data.message).toBe('发信服务不存在');
    });
  });

  describe('TC-INT-SERVICE-004: 发信服务权限控制', () => {
    test('普通用户应该无法创建发信服务', async () => {
      const serviceData = {
        name: '权限测试服务',
        provider: 'engagelab',
        api_key: 'permission-test-key',
        api_secret: 'permission-test-secret',
        domain: 'permission.test.com',
        daily_quota: 1000,
        sending_rate: 50
      };

      const response = await apiClient.post('/email-services', serviceData);
      
      expect(response.status).toBe(403);
      expect(response.data.success).toBe(false);
    });

    test('普通用户应该无法更新发信服务', async () => {
      // 使用已创建的服务
      if (createdServices.length > 0) {
        const serviceId = createdServices[0].id;
        
        const response = await apiClient.put(`/email-services/${serviceId}`, {
          name: '普通用户尝试更新'
        });
        
        expect(response.status).toBe(403);
        expect(response.data.success).toBe(false);
      }
    });
  });

  describe('TC-INT-SERVICE-005: 发信服务数据完整性', () => {
    test('应该正确保存和返回服务详情', async () => {
      const serviceData = {
        name: '数据完整性测试服务',
        provider: 'engagelab',
        api_key: 'integrity-test-key',
        api_secret: 'integrity-test-secret',
        domain: 'integrity.test.com',
        daily_quota: 1500,
        sending_rate: 75,
        quota_reset_time: '01:30:00'
      };

      const createResponse = await adminApiClient.post('/email-services', serviceData);
      const serviceId = createResponse.data.data.id;
      createdServices.push(createResponse.data.data);

      // 获取服务列表，验证数据一致性
      const listResponse = await adminApiClient.get('/email-services');
      const createdService = listResponse.data.data.find(
        service => service.id === serviceId
      );
      
      expect(createdService).toBeDefined();
      expect(createdService.id).toBe(serviceId);
      expect(createdService.name).toBe(serviceData.name);
      expect(createdService.provider).toBe(serviceData.provider);
      expect(createdService.domain).toBe(serviceData.domain);
      expect(createdService.daily_quota).toBe(serviceData.daily_quota);
      expect(createdService.used_quota).toBe(0); // 新创建的服务使用额度应该为0
      expect(createdService.sending_rate).toBe(serviceData.sending_rate);
      expect(createdService.quota_reset_time).toBe(serviceData.quota_reset_time);
      expect(createdService.is_enabled).toBe(true); // 默认应该启用
      expect(createdService.is_frozen).toBe(false); // 默认应该未冻结
      expect(createdService.created_at).toBeDefined();
      expect(new Date(createdService.created_at)).toBeInstanceOf(Date);
    });

    test('应该正确记录服务的基本信息', async () => {
      const serviceData = {
        name: '基本信息测试服务',
        provider: 'engagelab',
        api_key: 'basic-info-key',
        api_secret: 'basic-info-secret',
        domain: 'basicinfo.test.com',
        daily_quota: 800,
        sending_rate: 40
      };

      const createResponse = await adminApiClient.post('/email-services', serviceData);
      createdServices.push(createResponse.data.data);

      // 验证返回的数据结构
      const serviceDetail = createResponse.data.data;
      expect(serviceDetail).toHaveProperty('id');
      expect(serviceDetail).toHaveProperty('name');
      expect(serviceDetail).toHaveProperty('provider');
      expect(serviceDetail).toHaveProperty('domain');
      expect(serviceDetail).toHaveProperty('daily_quota');
      expect(serviceDetail).toHaveProperty('used_quota');
      expect(serviceDetail).toHaveProperty('sending_rate');
      expect(serviceDetail).toHaveProperty('quota_reset_time');
      expect(serviceDetail).toHaveProperty('is_enabled');
      expect(serviceDetail).toHaveProperty('is_frozen');
      expect(serviceDetail).toHaveProperty('created_at');
      
      expect(typeof serviceDetail.id).toBe('string');
      expect(typeof serviceDetail.name).toBe('string');
      expect(typeof serviceDetail.provider).toBe('string');
      expect(typeof serviceDetail.domain).toBe('string');
      expect(typeof serviceDetail.daily_quota).toBe('number');
      expect(typeof serviceDetail.used_quota).toBe('number');
      expect(typeof serviceDetail.sending_rate).toBe('number');
      expect(typeof serviceDetail.is_enabled).toBe('boolean');
      expect(typeof serviceDetail.is_frozen).toBe('boolean');
    });
  });
}); 