# TEST-002-群发调度与发信服务管理测试用例

## 一、测试概述

### 测试范围
- **发信人管理功能**：创建、删除、查询发信人
- **发信服务管理功能**：CRUD操作、状态管理、额度重置
- **用户管理功能**：用户创建、额度管理、服务关联
- **群发调度功能**：任务创建、执行、取消、状态跟踪
- **路由引擎功能**：服务选择、负载均衡、故障恢复
- **额度管理功能**：扣减、回退、统计

### 测试策略
- **单元测试**：核心业务逻辑和工具函数
- **集成测试**：模块间交互和数据流
- **API接口测试**：RESTful接口的请求响应
- **端到端测试**：完整业务流程验证
- **性能测试**：并发处理和响应时间
- **异常测试**：错误处理和故障恢复

---

## 二、单元测试用例

### 2.1 发信人管理单元测试

#### TC-UNIT-SENDER-001: 发信人创建验证
**测试目的**: 验证发信人创建业务逻辑
**前置条件**: 测试数据库已初始化

| 测试步骤 | 输入数据 | 期望结果 |
|----------|----------|----------|
| 1. 创建有效发信人 | `{senderName: "Test Sender"}` | 创建成功，返回UUID |
| 2. 创建重复名称 | `{senderName: "Test Sender"}` | 抛出`SENDER_NAME_EXISTS`错误 |
| 3. 创建空名称 | `{senderName: ""}` | 抛出验证错误 |
| 4. 创建特殊字符名称 | `{senderName: "Test@#$"}` | 抛出格式验证错误 |

```javascript
describe('SenderService', () => {
  test('should create sender successfully', async () => {
    const result = await SenderService.createSender({
      senderName: 'Test Sender',
      createdBy: 'user-uuid'
    });
    expect(result.id).toMatch(UUID_REGEX);
    expect(result.senderName).toBe('Test Sender');
  });
  
  test('should throw error for duplicate sender name', async () => {
    await SenderService.createSender({
      senderName: 'Duplicate Sender',
      createdBy: 'user-uuid'
    });
    
    await expect(SenderService.createSender({
      senderName: 'Duplicate Sender',
      createdBy: 'user-uuid'
    })).rejects.toThrow('SENDER_NAME_EXISTS');
  });
});
```

#### TC-UNIT-SENDER-002: 发信人删除权限验证
**测试目的**: 验证发信人删除权限控制

```javascript
test('should only allow creator to delete sender', async () => {
  const sender = await SenderService.createSender({
    senderName: 'Permission Test',
    createdBy: 'creator-uuid'
  });
  
  await expect(SenderService.deleteSender(
    sender.id, 
    'other-user-uuid'
  )).rejects.toThrow('PERMISSION_DENIED');
  
  await expect(SenderService.deleteSender(
    sender.id, 
    'creator-uuid'
  )).resolves.toBe(true);
});
```

### 2.2 额度管理单元测试

#### TC-UNIT-QUOTA-001: 原子性额度扣减
**测试目的**: 验证额度扣减的原子性和并发安全

```javascript
describe('QuotaService', () => {
  test('should deduct quota atomically', async () => {
    const userId = 'test-user-uuid';
    await QuotaService.setUserQuota(userId, 1000);
    
    const result = await QuotaService.deductQuota(
      userId, 
      100, 
      'test-campaign-uuid',
      'campaign_execution'
    );
    
    expect(result.success).toBe(true);
    expect(result.remainingQuota).toBe(900);
    
    const userQuota = await QuotaService.getUserQuota(userId);
    expect(userQuota).toBe(900);
  });
  
  test('should handle concurrent quota deduction', async () => {
    const userId = 'concurrent-test-uuid';
    await QuotaService.setUserQuota(userId, 1000);
    
    const promises = Array.from({length: 10}, (_, i) => 
      QuotaService.deductQuota(userId, 100, `campaign-${i}`, 'test')
    );
    
    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.success).length;
    
    expect(successCount).toBeLessThanOrEqual(10);
    
    const finalQuota = await QuotaService.getUserQuota(userId);
    expect(finalQuota).toBe(1000 - (successCount * 100));
  });
});
```

#### TC-UNIT-QUOTA-002: 额度不足处理
**测试目的**: 验证额度不足时的处理逻辑

```javascript
test('should reject deduction when quota insufficient', async () => {
  const userId = 'insufficient-quota-uuid';
  await QuotaService.setUserQuota(userId, 50);
  
  const result = await QuotaService.deductQuota(
    userId, 
    100, 
    'test-campaign-uuid',
    'campaign_execution'
  );
  
  expect(result.success).toBe(false);
  expect(result.error).toBe('QUOTA_INSUFFICIENT');
  
  const userQuota = await QuotaService.getUserQuota(userId);
  expect(userQuota).toBe(50); // 额度未变
});
```

### 2.3 路由引擎单元测试

#### TC-UNIT-ROUTING-001: 服务选择算法
**测试目的**: 验证智能路由服务选择逻辑

```javascript
describe('RoutingEngine', () => {
  test('should select optimal service', async () => {
    const mockServices = [
      {
        id: 'service-1-uuid',
        remainingQuota: 1000,
        sendingRate: 100,
        status: 'enabled',
        currentLoad: 50
      },
      {
        id: 'service-2-uuid',
        remainingQuota: 500,
        sendingRate: 200,
        status: 'enabled',
        currentLoad: 20
      }
    ];
    
    const selectedService = await RoutingEngine.selectOptimalService(
      'user-uuid', 
      mockServices
    );
    
    expect(selectedService.id).toBe('service-2-uuid'); // 负载更低
  });
  
  test('should skip frozen services', async () => {
    const mockServices = [
      {
        id: 'frozen-service-uuid',
        remainingQuota: 1000,
        status: 'frozen'
      },
      {
        id: 'active-service-uuid',
        remainingQuota: 500,
        status: 'enabled'
      }
    ];
    
    const selectedService = await RoutingEngine.selectOptimalService(
      'user-uuid', 
      mockServices
    );
    
    expect(selectedService.id).toBe('active-service-uuid');
  });
});
```

### 2.4 用户管理单元测试

#### TC-UNIT-USER-001: 用户创建和验证
**测试目的**: 验证用户创建业务逻辑和字段验证

```javascript
describe('UserService', () => {
  test('should create user with valid data', async () => {
    const userData = {
      username: 'testuser123',
      email: 'test@example.com',
      password: 'SecurePass123!',
      role: 'user',
      initialQuota: 1000
    };
    
    const result = await UserService.createUser(userData, 'admin-uuid');
    
    expect(result.id).toMatch(UUID_REGEX);
    expect(result.username).toBe('testuser123');
    expect(result.role).toBe('user');
    expect(result.remainingQuota).toBe(1000);
    expect(result.password).toBeUndefined(); // 密码不应返回
  });
  
  test('should hash password correctly', async () => {
    const userData = {
      username: 'password-test',
      email: 'pwd@example.com',
      password: 'PlainPassword123!'
    };
    
    const user = await UserService.createUser(userData, 'admin-uuid');
    const savedUser = await User.findByPk(user.id);
    
    expect(savedUser.password).not.toBe('PlainPassword123!');
    expect(savedUser.password).toMatch(/^\$2[ab]\$\d+\$/); // bcrypt格式
  });
  
  test('should validate email format', async () => {
    const invalidEmails = [
      'invalid-email',
      '@example.com',
      'test@',
      'test.example.com'
    ];
    
    for (const email of invalidEmails) {
      await expect(UserService.createUser({
        username: 'test',
        email,
        password: 'ValidPass123!'
      }, 'admin-uuid')).rejects.toThrow('INVALID_EMAIL_FORMAT');
    }
  });
  
  test('should enforce unique username and email', async () => {
    const userData = {
      username: 'duplicate-test',
      email: 'duplicate@example.com',
      password: 'Pass123!'
    };
    
    await UserService.createUser(userData, 'admin-uuid');
    
    // 重复用户名
    await expect(UserService.createUser({
      ...userData,
      email: 'different@example.com'
    }, 'admin-uuid')).rejects.toThrow('USERNAME_EXISTS');
    
    // 重复邮箱
    await expect(UserService.createUser({
      ...userData,
      username: 'different-user'
    }, 'admin-uuid')).rejects.toThrow('EMAIL_EXISTS');
  });
});

#### TC-UNIT-USER-002: 额度管理操作
**测试目的**: 验证用户额度调整的各种操作

```javascript
describe('UserQuotaManagement', () => {
  test('should adjust quota with add operation', async () => {
    const user = await createTestUser({quota: 500});
    
    const result = await UserService.adjustQuota(
      user.id,
      'add',
      200,
      'admin-uuid',
      '月度额度补充'
    );
    
    expect(result.previousQuota).toBe(500);
    expect(result.newQuota).toBe(700);
    expect(result.operation).toBe('add');
    
    const updatedUser = await User.findByPk(user.id);
    expect(updatedUser.remainingQuota).toBe(700);
  });
  
  test('should adjust quota with subtract operation', async () => {
    const user = await createTestUser({quota: 500});
    
    const result = await UserService.adjustQuota(
      user.id,
      'subtract',
      100,
      'admin-uuid',
      '额度回收'
    );
    
    expect(result.newQuota).toBe(400);
  });
  
  test('should adjust quota with set operation', async () => {
    const user = await createTestUser({quota: 500});
    
    const result = await UserService.adjustQuota(
      user.id,
      'set',
      1000,
      'admin-uuid',
      '重置额度'
    );
    
    expect(result.newQuota).toBe(1000);
  });
  
  test('should prevent negative quota', async () => {
    const user = await createTestUser({quota: 100});
    
    await expect(UserService.adjustQuota(
      user.id,
      'subtract',
      200,
      'admin-uuid',
      '超额扣减'
    )).rejects.toThrow('QUOTA_WOULD_BE_NEGATIVE');
  });
  
  test('should log quota changes', async () => {
    const user = await createTestUser({quota: 500});
    
    await UserService.adjustQuota(
      user.id,
      'add',
      200,
      'admin-uuid',
      '测试调整'
    );
    
    const logs = await UserQuotaLog.findAll({
      where: { userId: user.id }
    });
    
    expect(logs).toHaveLength(1);
    expect(logs[0].operation).toBe('add');
    expect(logs[0].amount).toBe(200);
    expect(logs[0].reason).toBe('测试调整');
  });
});

### 2.5 发信服务管理单元测试

#### TC-UNIT-EMAIL-SERVICE-001: 发信服务创建和验证
**测试目的**: 验证发信服务创建和配置验证

```javascript
describe('EmailServiceManager', () => {
  test('should create email service with valid configuration', async () => {
    const serviceData = {
      serviceName: 'Test Engagelab Service',
      serviceType: 'engagelab',
      apiCredentials: {
        apiUser: 'test-api-user',
        apiKey: 'test-api-key'
      },
      sendingDomain: 'mail.test.com',
      dailyQuota: 10000,
      sendingRate: 100,
      quotaResetTime: '00:00',
      timezone: 'Asia/Shanghai'
    };
    
    const result = await EmailServiceManager.createService(serviceData);
    
    expect(result.id).toMatch(UUID_REGEX);
    expect(result.serviceName).toBe('Test Engagelab Service');
    expect(result.status).toBe('enabled');
    expect(result.remainingQuota).toBe(10000);
  });
  
  test('should validate domain format', async () => {
    const invalidDomains = [
      'invalid-domain',
      'http://example.com',
      'domain with spaces.com',
      '.invalid.com',
      'invalid..com'
    ];
    
    for (const domain of invalidDomains) {
      await expect(EmailServiceManager.createService({
        serviceName: 'Test Service',
        serviceType: 'engagelab',
        sendingDomain: domain,
        dailyQuota: 1000
      })).rejects.toThrow('INVALID_DOMAIN_FORMAT');
    }
  });
  
  test('should validate API credentials', async () => {
    await expect(EmailServiceManager.createService({
      serviceName: 'Test Service',
      serviceType: 'engagelab',
      apiCredentials: {
        apiUser: '',
        apiKey: 'test-key'
      }
    })).rejects.toThrow('INVALID_API_CREDENTIALS');
  });
});

#### TC-UNIT-EMAIL-SERVICE-002: 服务状态管理
**测试目的**: 验证服务状态切换和冻结机制

```javascript
describe('EmailServiceStatusManagement', () => {
  test('should update service status correctly', async () => {
    const service = await createTestEmailService({status: 'enabled'});
    
    const result = await EmailServiceManager.updateServiceStatus(
      service.id,
      'disabled',
      '维护升级'
    );
    
    expect(result.status).toBe('disabled');
    expect(result.statusReason).toBe('维护升级');
    
    const statusLog = await ServiceStatusLog.findOne({
      where: { serviceId: service.id },
      order: [['createdAt', 'DESC']]
    });
    
    expect(statusLog.fromStatus).toBe('enabled');
    expect(statusLog.toStatus).toBe('disabled');
  });
  
  test('should freeze service after consecutive failures', async () => {
    const service = await createTestEmailService();
    
    // 模拟连续失败
    for (let i = 0; i < 10; i++) {
      await EmailServiceManager.recordFailure(
        service.id,
        `Test failure ${i + 1}`,
        500
      );
    }
    
    const updatedService = await EmailService.findByPk(service.id);
    expect(updatedService.status).toBe('frozen');
    expect(updatedService.consecutiveFailures).toBe(10);
  });
  
  test('should reset consecutive failures on success', async () => {
    const service = await createTestEmailService();
    
    // 先记录一些失败
    for (let i = 0; i < 5; i++) {
      await EmailServiceManager.recordFailure(service.id, 'Test failure');
    }
    
    // 记录成功
    await EmailServiceManager.recordSuccess(service.id);
    
    const updatedService = await EmailService.findByPk(service.id);
    expect(updatedService.consecutiveFailures).toBe(0);
  });
});

#### TC-UNIT-EMAIL-SERVICE-003: 额度重置机制
**测试目的**: 验证每日额度重置功能

```javascript
describe('EmailServiceQuotaReset', () => {
  test('should reset daily quota at scheduled time', async () => {
    const service = await createTestEmailService({
      dailyQuota: 1000,
      remainingQuota: 300
    });
    
    await EmailServiceManager.resetDailyQuota(service.id);
    
    const updatedService = await EmailService.findByPk(service.id);
    expect(updatedService.remainingQuota).toBe(1000);
    expect(updatedService.lastQuotaReset).toBeInstanceOf(Date);
  });
  
  test('should log quota reset operation', async () => {
    const service = await createTestEmailService({
      dailyQuota: 1000,
      remainingQuota: 300
    });
    
    await EmailServiceManager.resetDailyQuota(service.id);
    
    const quotaLog = await ServiceQuotaLog.findOne({
      where: { 
        serviceId: service.id,
        operation: 'daily_reset'
      },
      order: [['createdAt', 'DESC']]
    });
    
    expect(quotaLog).toBeDefined();
    expect(quotaLog.previousQuota).toBe(300);
    expect(quotaLog.newQuota).toBe(1000);
  });
});

### 2.6 用户发信服务关联单元测试

#### TC-UNIT-USER-SERVICE-MAPPING-001: 服务关联管理
**测试目的**: 验证用户与发信服务的关联管理

```javascript
describe('UserServiceMapping', () => {
  test('should assign services to user', async () => {
    const user = await createTestUser();
    const service1 = await createTestEmailService();
    const service2 = await createTestEmailService();
    
    await UserServiceManager.assignServicesToUser(
      user.id,
      [service1.id, service2.id],
      'admin-uuid'
    );
    
    const mappings = await UserServiceMapping.findAll({
      where: { userId: user.id }
    });
    
    expect(mappings).toHaveLength(2);
    expect(mappings.map(m => m.serviceId)).toContain(service1.id);
    expect(mappings.map(m => m.serviceId)).toContain(service2.id);
  });
  
  test('should remove existing mappings when reassigning', async () => {
    const user = await createTestUser();
    const service1 = await createTestEmailService();
    const service2 = await createTestEmailService();
    const service3 = await createTestEmailService();
    
    // 初始分配
    await UserServiceManager.assignServicesToUser(
      user.id,
      [service1.id, service2.id],
      'admin-uuid'
    );
    
    // 重新分配
    await UserServiceManager.assignServicesToUser(
      user.id,
      [service2.id, service3.id],
      'admin-uuid'
    );
    
    const mappings = await UserServiceMapping.findAll({
      where: { userId: user.id }
    });
    
    expect(mappings).toHaveLength(2);
    expect(mappings.map(m => m.serviceId)).not.toContain(service1.id);
    expect(mappings.map(m => m.serviceId)).toContain(service2.id);
    expect(mappings.map(m => m.serviceId)).toContain(service3.id);
  });
  
  test('should validate service availability for user', async () => {
    const user = await createTestUser();
    const enabledService = await createTestEmailService({status: 'enabled'});
    const disabledService = await createTestEmailService({status: 'disabled'});
    
    await UserServiceManager.assignServicesToUser(
      user.id,
      [enabledService.id, disabledService.id],
      'admin-uuid'
    );
    
    const availableServices = await UserServiceManager.getAvailableServices(user.id);
    
    expect(availableServices).toHaveLength(1);
    expect(availableServices[0].id).toBe(enabledService.id);
  });
});
```

### 2.7 发信人管理单元测试（增强）

#### TC-UNIT-SENDER-003: 发信人格式验证
**测试目的**: 验证发信人名称格式规范

```javascript
describe('SenderNameValidation', () => {
  test('should accept valid sender names', async () => {
    const validNames = [
      'marketing-team',
      'support_center',
      'info.center',
      'user123',
      'test-user_01.info'
    ];
    
    for (const name of validNames) {
      const result = await SenderService.createSender({
        senderName: name,
        createdBy: 'user-uuid'
      });
      expect(result.senderName).toBe(name);
    }
  });
  
  test('should reject invalid sender names', async () => {
    const invalidNames = [
      'marketing team', // 空格
      'info@center',    // @符号
      'test#user',      // #符号
      'user*info',      // *符号
      '',               // 空字符串
      'a'.repeat(65)    // 超长
    ];
    
    for (const name of invalidNames) {
      await expect(SenderService.createSender({
        senderName: name,
        createdBy: 'user-uuid'
      })).rejects.toThrow('SENDER_NAME_INVALID');
    }
  });
  
  test('should enforce sender name length limits', async () => {
    // 最短1个字符
    const result1 = await SenderService.createSender({
      senderName: 'a',
      createdBy: 'user-uuid'
    });
    expect(result1.senderName).toBe('a');
    
    // 最长64个字符
    const longName = 'a'.repeat(64);
    const result2 = await SenderService.createSender({
      senderName: longName,
      createdBy: 'user-uuid'
    });
    expect(result2.senderName).toBe(longName);
    
    // 超过64个字符应该失败
    await expect(SenderService.createSender({
      senderName: 'a'.repeat(65),
      createdBy: 'user-uuid'
    })).rejects.toThrow('SENDER_NAME_INVALID');
  });
});
```

---

## 三、集成测试用例

### 3.1 群发任务完整流程测试

#### TC-INT-CAMPAIGN-001: 正常群发流程
**测试目的**: 验证从任务创建到完成的完整流程

```javascript
describe('Campaign Integration Test', () => {
  let testUser, testSender, testService, testContacts, testTemplates;
  
  beforeEach(async () => {
    testUser = await createTestUser({quota: 1000});
    testSender = await createTestSender(testUser.id);
    testService = await createTestEmailService();
    testContacts = await createTestContacts(5);
    testTemplates = await createTestTemplates(2);
  });
  
  test('should complete campaign successfully', async () => {
    // 1. 创建群发任务
    const campaign = await CampaignService.createCampaign({
      campaignName: 'Integration Test Campaign',
      senderId: testSender.id,
      contactTagIds: [testContacts.tagId],
      templateIds: [testTemplates[0].id, testTemplates[1].id],
      scheduledAt: new Date(),
      createdBy: testUser.id
    });
    
    expect(campaign.status).toBe('scheduled');
    
    // 2. 等待调度器执行
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 3. 检查任务状态
    const updatedCampaign = await CampaignService.getCampaign(campaign.id);
    expect(updatedCampaign.status).toBeOneOf(['running', 'completed']);
    
    // 4. 检查子任务生成
    const subTasks = await SubTaskService.getSubTasks(campaign.id);
    expect(subTasks.length).toBe(5); // 5个联系人
    
    // 5. 检查额度扣减
    const userQuota = await QuotaService.getUserQuota(testUser.id);
    expect(userQuota).toBe(995); // 1000 - 5
  });
});
```

#### TC-INT-CAMPAIGN-002: 额度不足场景
**测试目的**: 验证额度不足时的处理流程

```javascript
test('should handle insufficient quota gracefully', async () => {
  const lowQuotaUser = await createTestUser({quota: 2});
  const contacts = await createTestContacts(5); // 需要5个额度
  
  const campaignPromise = CampaignService.createCampaign({
    campaignName: 'Low Quota Test',
    senderId: testSender.id,
    contactTagIds: [contacts.tagId],
    templateIds: [testTemplates[0].id],
    createdBy: lowQuotaUser.id
  });
  
  await expect(campaignPromise).rejects.toThrow('QUOTA_INSUFFICIENT');
  
  // 确认额度未扣减
  const userQuota = await QuotaService.getUserQuota(lowQuotaUser.id);
  expect(userQuota).toBe(2);
});
```

### 3.2 服务冻结与恢复测试

#### TC-INT-SERVICE-001: 服务自动冻结
**测试目的**: 验证服务连续失败后的自动冻结机制

```javascript
test('should freeze service after consecutive failures', async () => {
  const service = await createTestEmailService();
  
  // 模拟连续失败
  for (let i = 0; i < 10; i++) {
    await EmailServiceManager.recordFailure(
      service.id, 
      `Mock failure ${i + 1}`
    );
  }
  
  const updatedService = await EmailServiceManager.getService(service.id);
  expect(updatedService.status).toBe('frozen');
  expect(updatedService.frozenReason).toContain('连续失败');
});
```

---

## 四、API接口测试用例

### 4.1 发信人管理API测试

#### TC-API-SENDER-001: 创建发信人接口
**测试目的**: 验证发信人创建API的完整功能

```javascript
describe('POST /api/senders', () => {
  test('should create sender successfully', async () => {
    const response = await request(app)
      .post('/api/senders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        senderName: 'API Test Sender'
      })
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toMatch(UUID_REGEX);
    expect(response.body.data.senderName).toBe('API Test Sender');
  });
  
  test('should return 400 for invalid sender name', async () => {
    const response = await request(app)
      .post('/api/senders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        senderName: ''
      })
      .expect(400);
    
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
  
  test('should return 401 without auth token', async () => {
    await request(app)
      .post('/api/senders')
      .send({
        senderName: 'Unauthorized Test'
      })
      .expect(401);
  });
});
```

### 4.2 群发任务API测试

#### TC-API-CAMPAIGN-001: 创建群发任务接口
**测试目的**: 验证群发任务创建API的参数验证和业务逻辑

```javascript
describe('POST /api/campaigns', () => {
  test('should create campaign with valid parameters', async () => {
    const response = await request(app)
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        campaignName: 'API Test Campaign',
        senderId: testSender.id,
        contactTagIds: [testTag.id],
        templateIds: [testTemplate.id],
        scheduledAt: '2025-01-27T15:00:00Z'
      })
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('scheduled');
    expect(response.body.data.estimatedRecipients).toBeGreaterThan(0);
  });
  
  test('should validate UUID format for IDs', async () => {
    const response = await request(app)
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        campaignName: 'Invalid ID Test',
        senderId: 'invalid-uuid',
        contactTagIds: ['invalid-uuid'],
        templateIds: ['invalid-uuid']
      })
      .expect(400);
    
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
```

### 4.3 管理员权限API测试

#### TC-API-ADMIN-001: 发信服务管理权限
**测试目的**: 验证管理员专用接口的权限控制

```javascript
describe('Admin Email Service APIs', () => {
  test('should allow admin to create service', async () => {
    const response = await request(app)
      .post('/api/email-services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        serviceName: 'Test Service',
        serviceType: 'engagelab',
        apiCredentials: {
          apiUser: 'test-user',
          apiKey: 'test-key'
        },
        sendingDomain: 'test.example.com',
        dailyQuota: 1000,
        sendingRate: 50
      })
      .expect(200);
    
    expect(response.body.success).toBe(true);
  });
  
  test('should deny regular user access', async () => {
    await request(app)
      .post('/api/email-services')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        serviceName: 'Unauthorized Service'
      })
      .expect(403);
  });
});
```

---

## 五、端到端测试用例

### 5.1 完整业务流程E2E测试

#### TC-E2E-FLOW-001: 从用户注册到邮件发送完整流程
**测试目的**: 验证系统完整业务流程的端到端功能

```javascript
describe('Complete E2E Flow', () => {
  test('should complete full email campaign flow', async () => {
    // 1. 管理员创建用户
    const createUserResponse = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: 'e2euser',
        email: 'e2euser@test.com',
        password: 'TestPass123!',
        role: 'user',
        initialQuota: 100
      });
    
    const newUser = createUserResponse.body.data;
    
    // 2. 用户登录
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'e2euser',
        password: 'TestPass123!'
      });
    
    const userToken = loginResponse.body.data.token;
    
    // 3. 用户创建发信人
    const senderResponse = await request(app)
      .post('/api/senders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        senderName: 'E2E Test Sender'
      });
    
    const sender = senderResponse.body.data;
    
    // 4. 用户创建群发任务
    const campaignResponse = await request(app)
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        campaignName: 'E2E Test Campaign',
        senderId: sender.id,
        contactTagIds: [testTag.id],
        templateIds: [testTemplate.id],
        scheduledAt: new Date().toISOString()
      });
    
    const campaign = campaignResponse.body.data;
    expect(campaign.status).toBe('scheduled');
    
    // 5. 等待任务执行
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 6. 检查任务完成状态
    const statusResponse = await request(app)
      .get(`/api/campaigns/${campaign.id}`)
      .set('Authorization', `Bearer ${userToken}`);
    
    expect(statusResponse.body.data.status).toBeOneOf(['running', 'completed']);
    
    // 7. 检查用户额度变化
    const dashboardResponse = await request(app)
      .get('/api/users/dashboard')
      .set('Authorization', `Bearer ${userToken}`);
    
    expect(dashboardResponse.body.data.remainingQuota).toBeLessThan(100);
  });
});
```

---

## 六、性能测试用例

### 6.1 并发处理性能测试

#### TC-PERF-CONCURRENT-001: 并发群发任务创建
**测试目的**: 验证系统在高并发下的稳定性

```javascript
describe('Performance Tests', () => {
  test('should handle concurrent campaign creation', async () => {
    const concurrentRequests = 20;
    const startTime = Date.now();
    
    const promises = Array.from({length: concurrentRequests}, (_, i) =>
      request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          campaignName: `Concurrent Campaign ${i}`,
          senderId: testSender.id,
          contactTagIds: [testTag.id],
          templateIds: [testTemplate.id],
          scheduledAt: new Date(Date.now() + 60000).toISOString()
        })
    );
    
    const responses = await Promise.all(promises);
    const endTime = Date.now();
    
    const successCount = responses.filter(r => r.status === 200).length;
    const avgResponseTime = (endTime - startTime) / concurrentRequests;
    
    expect(successCount).toBeGreaterThan(concurrentRequests * 0.8); // 80%成功率
    expect(avgResponseTime).toBeLessThan(1000); // 平均响应时间<1秒
  });
});
```

#### TC-PERF-QUOTA-001: 额度操作性能测试
**测试目的**: 验证高频额度操作的性能表现

```javascript
test('should handle high frequency quota operations', async () => {
  const userId = 'perf-test-user';
  await QuotaService.setUserQuota(userId, 10000);
  
  const startTime = Date.now();
  const operations = 100;
  
  const promises = Array.from({length: operations}, (_, i) =>
    QuotaService.deductQuota(
      userId, 
      1, 
      `perf-campaign-${i}`,
      'performance_test'
    )
  );
  
  const results = await Promise.all(promises);
  const endTime = Date.now();
  
  const successCount = results.filter(r => r.success).length;
  const avgOperationTime = (endTime - startTime) / operations;
  
  expect(successCount).toBeGreaterThan(0);
  expect(avgOperationTime).toBeLessThan(50); // 平均操作时间<50ms
});
```

---

## 七、异常场景测试用例

### 7.1 网络故障恢复测试

#### TC-EXCEPTION-NETWORK-001: Redis连接中断恢复
**测试目的**: 验证Redis连接中断后的自动恢复机制

```javascript
describe('Exception Handling', () => {
  test('should recover from Redis connection failure', async () => {
    // 模拟Redis连接中断
    await RedisService.disconnect();
    
    // 尝试额度操作（应该失败）
    const result = await QuotaService.deductQuota(
      'test-user', 
      100, 
      'test-campaign',
      'test'
    );
    expect(result.success).toBe(false);
    
    // 恢复Redis连接
    await RedisService.reconnect();
    
    // 再次尝试额度操作（应该成功）
    await new Promise(resolve => setTimeout(resolve, 1000)); // 等待连接恢复
    
    const retryResult = await QuotaService.deductQuota(
      'test-user', 
      100, 
      'test-campaign',
      'test'
    );
    expect(retryResult.success).toBe(true);
  });
});
```

### 7.2 数据一致性测试

#### TC-EXCEPTION-CONSISTENCY-001: 任务取消时的数据一致性
**测试目的**: 验证任务取消时额度回退和状态更新的一致性

```javascript
test('should maintain data consistency on campaign cancellation', async () => {
  const userId = 'consistency-test-user';
  await QuotaService.setUserQuota(userId, 1000);
  
  // 创建任务
  const campaign = await CampaignService.createCampaign({
    campaignName: 'Consistency Test',
    senderId: testSender.id,
    contactTagIds: [testTag.id],
    templateIds: [testTemplate.id],
    createdBy: userId
  });
  
  // 等待部分执行
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 取消任务
  const cancelResult = await CampaignService.cancelCampaign(
    campaign.id, 
    userId
  );
  
  expect(cancelResult.success).toBe(true);
  
  // 验证数据一致性
  const updatedCampaign = await CampaignService.getCampaign(campaign.id);
  const userQuota = await QuotaService.getUserQuota(userId);
  const quotaLogs = await QuotaService.getQuotaLogs(userId);
  
  expect(updatedCampaign.status).toBe('cancelled');
  
  // 验证额度计算正确性
  const deductLog = quotaLogs.find(log => log.operation === 'deduct');
  const refundLog = quotaLogs.find(log => log.operation === 'refund');
  
  expect(refundLog).toBeDefined();
  expect(userQuota + deductLog.amount - refundLog.amount).toBe(1000);
});
```

---

## 八、测试数据准备

### 8.1 测试工具函数

```javascript
// 测试辅助函数
const TestHelper = {
  async createTestUser(options = {}) {
    return await User.create({
      id: uuidv4(),
      username: options.username || `testuser_${Date.now()}`,
      email: options.email || `test_${Date.now()}@example.com`,
      password: await bcrypt.hash('TestPass123!', 10),
      role: options.role || 'user',
      remainingQuota: options.quota || 1000,
      ...options
    });
  },
  
  async createTestEmailService(options = {}) {
    return await EmailService.create({
      id: uuidv4(),
      serviceName: options.serviceName || `Test Service ${Date.now()}`,
      serviceType: 'engagelab',
      sendingDomain: 'test.example.com',
      dailyQuota: options.dailyQuota || 1000,
      remainingQuota: options.remainingQuota || 1000,
      sendingRate: 100,
      status: options.status || 'enabled',
      ...options
    });
  },
  
  async cleanupTestData() {
    await User.destroy({ where: { username: { [Op.startsWith]: 'testuser_' } } });
    await EmailService.destroy({ where: { serviceName: { [Op.startsWith]: 'Test Service' } } });
    await Campaign.destroy({ where: { campaignName: { [Op.startsWith]: 'Test Campaign' } } });
  }
};
```

### 8.2 测试配置

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  testTimeout: 30000,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/migrations/**',
    '!src/config/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

---

## 九、测试执行计划

### 9.1 测试执行顺序

1. **单元测试** (预计2小时)
   - 核心业务逻辑验证
   - 工具函数测试
   - 边界条件测试

2. **集成测试** (预计4小时)
   - 模块间交互测试
   - 数据库事务测试
   - 缓存一致性测试

3. **API接口测试** (预计3小时)
   - RESTful接口测试
   - 权限控制测试
   - 参数验证测试

4. **端到端测试** (预计2小时)
   - 完整业务流程测试
   - 用户场景模拟测试

5. **性能测试** (预计2小时)
   - 并发处理测试
   - 响应时间测试
   - 系统压力测试

6. **异常测试** (预计2小时)
   - 故障恢复测试
   - 数据一致性测试
   - 边界异常测试

### 9.2 测试环境要求

| 组件 | 版本要求 | 配置要求 |
|------|----------|----------|
| Node.js | 18+ | - |
| PostgreSQL | 14+ | 测试数据库独立 |
| Redis | 7+ | 测试实例独立 |
| Jest | 29+ | 并发执行 |

### 9.3 测试通过标准

- **单元测试覆盖率**: ≥80%
- **API接口测试**: 100%通过
- **集成测试**: 100%通过
- **性能测试**: 响应时间≤预期值
- **异常测试**: 故障恢复100%成功

---

**文档版本**: v1.0  
**创建日期**: 2025-01-27  
**负责人**: QA测试Agent 