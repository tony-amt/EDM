const { setupTestEnvironment, teardownTestEnvironment } = require('./setup-docker');

describe('🚀 V2.0-用户额度管理功能-集成测试', () => {
  let testEnv;
  let apiClient;
  let adminApiClient;
  let testUser;

  beforeAll(async () => {
    console.log('🔧 [V2.0-用户额度管理] 设置测试环境...');
    testEnv = await setupTestEnvironment();
    apiClient = testEnv.apiClient;
    adminApiClient = testEnv.adminApiClient;
    testUser = testEnv.testUser;
    console.log('✅ 测试环境就绪');
  });

  afterAll(async () => {
    console.log('🧹 [V2.0-用户额度管理] 清理测试环境...');
    await teardownTestEnvironment();
    console.log('✅ 测试环境清理完成');
  });

  describe('TC-INT-QUOTA-001: 用户额度查询功能', () => {
    test('用户应该能查看自己的额度信息', async () => {
      // 查询用户额度
      const response = await apiClient.get('/users-v2/quota');
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveProperty('daily_quota');
      expect(response.data.data).toHaveProperty('used_quota');
      expect(response.data.data).toHaveProperty('remaining_quota');
      expect(response.data.data).toHaveProperty('quota_reset_time');
      
      // 验证数据类型
      expect(typeof response.data.data.daily_quota).toBe('number');
      expect(typeof response.data.data.used_quota).toBe('number');
      expect(typeof response.data.data.remaining_quota).toBe('number');
      
      // 验证逻辑关系
      const { daily_quota, used_quota, remaining_quota } = response.data.data;
      expect(remaining_quota).toBe(daily_quota - used_quota);
      
      console.log('✅ 用户额度信息:', response.data.data);
    });

    test('管理员应该能查看所有用户的额度统计', async () => {
      const response = await adminApiClient.get('/admin/users/quota-stats');
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.data)).toBe(true);
      
      if (response.data.data.length > 0) {
        const userQuota = response.data.data[0];
        expect(userQuota).toHaveProperty('user_id');
        expect(userQuota).toHaveProperty('username');
        expect(userQuota).toHaveProperty('daily_quota');
        expect(userQuota).toHaveProperty('used_quota');
        expect(userQuota).toHaveProperty('remaining_quota');
        expect(userQuota).toHaveProperty('last_reset_time');
      }
      
      console.log('✅ 用户额度统计数量:', response.data.data.length);
    });
  });

  describe('TC-INT-QUOTA-002: 额度管理功能', () => {
    test('管理员应该能调整用户额度', async () => {
      const newQuota = 2000;
      
      const response = await adminApiClient.put(`/admin/users/${testUser.id}/quota`, {
        daily_quota: newQuota,
        reason: '测试额度调整'
      });
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.daily_quota).toBe(newQuota);
      
      // 验证用户端能看到更新后的额度
      const userQuotaResponse = await apiClient.get('/users-v2/quota');
      expect(userQuotaResponse.data.data.daily_quota).toBe(newQuota);
      
      console.log('✅ 额度调整成功，新额度:', newQuota);
    });

    test('应该拒绝设置无效的额度值', async () => {
      const invalidQuotas = [-100, 0, 'invalid', null];
      
      for (const invalidQuota of invalidQuotas) {
        const response = await adminApiClient.put(`/admin/users/${testUser.id}/quota`, {
          daily_quota: invalidQuota,
          reason: '无效额度测试'
        });
        
        expect(response.status).toBe(400);
        expect(response.data.success).toBe(false);
        console.log(`✅ 正确拒绝无效额度: ${invalidQuota}`);
      }
    });

    test('普通用户应该无法修改自己的额度', async () => {
      const response = await apiClient.put(`/users-v2/${testUser.id}/quota`, {
        daily_quota: 5000,
        reason: '用户尝试自己修改额度'
      });
      
      expect(response.status).toBe(403);
      expect(response.data.success).toBe(false);
      
      console.log('✅ 正确阻止用户自己修改额度');
    });
  });

  describe('TC-INT-QUOTA-003: 额度重置功能', () => {
    test('应该能手动重置用户额度', async () => {
      // 先模拟使用一些额度
      await adminApiClient.put(`/admin/users/${testUser.id}/quota-usage`, {
        used_quota: 500,
        reason: '模拟额度使用'
      });
      
      // 重置额度
      const resetResponse = await adminApiClient.post(`/admin/users/${testUser.id}/quota-reset`, {
        reason: '手动重置测试'
      });
      
      expect(resetResponse.status).toBe(200);
      expect(resetResponse.data.success).toBe(true);
      
      // 验证额度已重置
      const quotaResponse = await apiClient.get('/users-v2/quota');
      expect(quotaResponse.data.data.used_quota).toBe(0);
      expect(quotaResponse.data.data.remaining_quota).toBe(quotaResponse.data.data.daily_quota);
      
      console.log('✅ 额度重置成功');
    });

    test('应该记录额度重置历史', async () => {
      const response = await adminApiClient.get(`/admin/users/${testUser.id}/quota-history`);
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.data)).toBe(true);
      
      if (response.data.data.length > 0) {
        const historyRecord = response.data.data[0];
        expect(historyRecord).toHaveProperty('operation_type');
        expect(historyRecord).toHaveProperty('old_value');
        expect(historyRecord).toHaveProperty('new_value');
        expect(historyRecord).toHaveProperty('reason');
        expect(historyRecord).toHaveProperty('operator_id');
        expect(historyRecord).toHaveProperty('created_at');
      }
      
      console.log('✅ 额度历史记录数量:', response.data.data.length);
    });
  });

  describe('TC-INT-QUOTA-004: 额度监控与告警', () => {
    test('应该能获取额度使用趋势', async () => {
      const response = await adminApiClient.get('/admin/quota/usage-trends', {
        params: {
          days: 7,
          user_id: testUser.id
        }
      });
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.data)).toBe(true);
      
      console.log('✅ 额度使用趋势数据点数量:', response.data.data.length);
    });

    test('应该能获取额度告警信息', async () => {
      const response = await adminApiClient.get('/admin/quota/alerts');
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.data)).toBe(true);
      
      // 验证告警数据结构
      if (response.data.data.length > 0) {
        const alert = response.data.data[0];
        expect(alert).toHaveProperty('user_id');
        expect(alert).toHaveProperty('alert_type');
        expect(alert).toHaveProperty('threshold');
        expect(alert).toHaveProperty('current_usage');
        expect(alert).toHaveProperty('created_at');
      }
      
      console.log('✅ 额度告警数量:', response.data.data.length);
    });
  });

  describe('TC-INT-QUOTA-005: 额度数据完整性', () => {
    test('额度数据应该保持一致性', async () => {
      // 获取用户额度信息
      const userQuotaResponse = await apiClient.get('/users-v2/quota');
      const userQuota = userQuotaResponse.data.data;
      
      // 获取管理员视角的用户额度
      const adminQuotaResponse = await adminApiClient.get(`/admin/users/${testUser.id}/quota`);
      const adminQuota = adminQuotaResponse.data.data;
      
      // 验证数据一致性
      expect(userQuota.daily_quota).toBe(adminQuota.daily_quota);
      expect(userQuota.used_quota).toBe(adminQuota.used_quota);
      expect(userQuota.remaining_quota).toBe(adminQuota.remaining_quota);
      
      console.log('✅ 用户和管理员视角的额度数据一致');
    });

    test('额度计算应该正确', async () => {
      const response = await apiClient.get('/users-v2/quota');
      const quota = response.data.data;
      
      // 验证基本数学关系
      expect(quota.remaining_quota).toBe(quota.daily_quota - quota.used_quota);
      expect(quota.daily_quota).toBeGreaterThanOrEqual(0);
      expect(quota.used_quota).toBeGreaterThanOrEqual(0);
      expect(quota.remaining_quota).toBeGreaterThanOrEqual(0);
      expect(quota.remaining_quota).toBeLessThanOrEqual(quota.daily_quota);
      
      console.log('✅ 额度计算逻辑正确');
    });
  });
}); 