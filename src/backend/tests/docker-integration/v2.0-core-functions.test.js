/**
 * V2.0核心功能Docker集成测试
 * 严格按照README.md规范在Docker环境中执行
 */
const { DockerTestSuite } = require('../docker-test-setup');
const request = require('supertest');

describe('🐳 V2.0核心功能 - Docker环境集成测试', () => {
  let dockerSuite;
  let authToken;

  beforeAll(async () => {
    dockerSuite = new DockerTestSuite('V2.0核心功能测试');
    await dockerSuite.setupDockerTest();
    
    // Docker环境中的用户认证
    const loginResponse = await dockerSuite.dockerApiRequest('post', '/api/auth/login', {
      username: 'admin',
      password: 'admin123456'
    });
    
    expect(loginResponse.status).toBe(200);
    authToken = loginResponse.body.token;
    
    console.log('✅ Docker环境认证成功');
  });

  afterAll(async () => {
    await dockerSuite.teardownDockerTest();
  });

  describe('📧 邮件服务管理 (V2.0)', () => {
    let emailServiceId;

    test('创建邮件服务 - Docker环境', async () => {
      const serviceData = {
        name: 'Docker测试SMTP',
        service_type: 'smtp',
        smtp_host: 'smtp.example.com',
        smtp_port: 587,
        smtp_secure: false,
        smtp_user: 'docker-test@example.com',
        smtp_password: 'test-password',
        domain: 'example.com',
        max_daily_send: 1000,
        is_active: true
      };

      const response = await dockerSuite.dockerApiRequest('post', '/api/email-services', serviceData, authToken);
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(serviceData.name);
      expect(response.body.data.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      
      emailServiceId = response.body.data.id;
      console.log('✅ Docker环境邮件服务创建成功:', emailServiceId);
    });

    test('测试邮件服务连接 - Docker环境', async () => {
      const response = await dockerSuite.dockerApiRequest('post', `/api/email-services/${emailServiceId}/test`, {}, authToken);
      
      // 在Docker环境中，测试连接可能失败（正常），但API应正常响应
      expect([200, 400, 500]).toContain(response.status);
      expect(response.body).toHaveProperty('success');
      
      console.log('✅ Docker环境连接测试API响应正常');
    });

    test('获取邮件服务列表 - Docker环境', async () => {
      const response = await dockerSuite.dockerApiRequest('get', '/api/email-services', null, authToken);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      
      console.log('✅ Docker环境邮件服务列表获取成功');
    });
  });

  describe('👥 用户服务映射 (V2.0)', () => {
    test('获取用户服务映射 - Docker环境', async () => {
      const response = await dockerSuite.dockerApiRequest('get', '/api/user-service-mapping', null, authToken);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      
      console.log('✅ Docker环境用户服务映射获取成功');
    });
  });

  describe('⏰ 任务调度器 (V2.0)', () => {
    test('获取调度器状态 - Docker环境', async () => {
      const response = await dockerSuite.dockerApiRequest('get', '/api/scheduler/status', null, authToken);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success');
      expect(response.body.data).toHaveProperty('isRunning');
      
      console.log('✅ Docker环境调度器状态获取成功');
    });

    test('获取调度器统计 - Docker环境', async () => {
      const response = await dockerSuite.dockerApiRequest('get', '/api/scheduler/stats', null, authToken);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success');
      expect(response.body.data).toHaveProperty('totalTasks');
      expect(response.body.data).toHaveProperty('pendingTasks');
      
      console.log('✅ Docker环境调度器统计获取成功');
    });
  });

  describe('📋 子任务管理 (V2.0)', () => {
    test('获取子任务列表 - Docker环境', async () => {
      const response = await dockerSuite.dockerApiRequest('get', '/api/subtasks', null, authToken);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      
      console.log('✅ Docker环境子任务列表获取成功');
    });

    test('获取子任务统计 - Docker环境', async () => {
      const response = await dockerSuite.dockerApiRequest('get', '/api/subtasks/stats', null, authToken);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('total');
      
      console.log('✅ Docker环境子任务统计获取成功');
    });
  });

  describe('📈 任务管理 (V2.0)', () => {
    test('获取任务列表 - Docker环境', async () => {
      const response = await dockerSuite.dockerApiRequest('get', '/api/tasks', null, authToken);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      
      console.log('✅ Docker环境任务列表获取成功');
    });
  });

  describe('🔍 数据库结构验证 (V2.0)', () => {
    test('验证V2.0数据库表结构 - Docker环境', async () => {
      const tables = [
        'users', 'contacts', 'tags', 'templates', 'campaigns',
        'email_services', 'user_service_mappings', 'tasks', 'sub_tasks',
        'event_logs', 'sent_logs', 'contact_tags'
      ];

      for (const tableName of tables) {
        const query = `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = '${tableName}' ORDER BY ordinal_position`;
        
        const [results] = await dockerSuite.sequelize.query(query);
        expect(results.length).toBeGreaterThan(0);
        
        console.log(`✅ Docker环境表 ${tableName} 结构验证成功`);
      }
    });

    test('验证UUID主键规范 - Docker环境', async () => {
      const uuidTables = [
        'users', 'contacts', 'tags', 'templates', 'campaigns',
        'email_services', 'user_service_mappings', 'tasks', 'sub_tasks'
      ];

      for (const tableName of uuidTables) {
        const query = `SELECT data_type FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name = 'id'`;
        
        const [results] = await dockerSuite.sequelize.query(query);
        expect(results.length).toBe(1);
        expect(results[0].data_type).toBe('uuid');
        
        console.log(`✅ Docker环境表 ${tableName} UUID主键规范验证成功`);
      }
    });
  });
});

/**
 * Docker环境E2E业务流程测试
 */
describe('🐳 V2.0完整业务流程 - Docker环境E2E测试', () => {
  let dockerSuite;
  let authToken;
  let emailServiceId;
  let contactId;
  let templateId;
  let taskId;

  beforeAll(async () => {
    dockerSuite = new DockerTestSuite('V2.0业务流程E2E');
    await dockerSuite.setupDockerTest();
    
    // 认证
    const loginResponse = await dockerSuite.dockerApiRequest('post', '/api/auth/login', {
      username: 'admin',
      password: 'admin123456'
    });
    authToken = loginResponse.body.token;
    
    console.log('✅ Docker环境E2E测试认证成功');
  });

  afterAll(async () => {
    await dockerSuite.teardownDockerTest();
  });

  test('完整业务流程 - Docker环境', async () => {
    // 1. 创建邮件服务
    const serviceResponse = await dockerSuite.dockerApiRequest('post', '/api/email-services', {
      name: 'E2E测试SMTP',
      service_type: 'smtp',
      smtp_host: 'smtp.test.com',
      smtp_port: 587,
      smtp_user: 'test@test.com',
      smtp_password: 'test123',
      domain: 'test.com',
      max_daily_send: 500
    }, authToken);
    
    expect(serviceResponse.status).toBe(201);
    emailServiceId = serviceResponse.body.data.id;
    console.log('✅ Docker环境E2E: 邮件服务创建成功');

    // 2. 创建联系人
    const contactResponse = await dockerSuite.dockerApiRequest('post', '/api/contacts', {
      name: 'Docker测试联系人',
      email: 'docker-test@example.com',
      phone: '13800138000'
    }, authToken);
    
    expect(contactResponse.status).toBe(201);
    contactId = contactResponse.body.data.id;
    console.log('✅ Docker环境E2E: 联系人创建成功');

    // 3. 创建邮件模板
    const templateResponse = await dockerSuite.dockerApiRequest('post', '/api/templates', {
      name: 'Docker测试模板',
      subject: 'Docker环境测试邮件',
      content: '<p>这是Docker环境中的测试邮件 - {{name}}</p>',
      template_type: 'email'
    }, authToken);
    
    expect(templateResponse.status).toBe(201);
    templateId = templateResponse.body.data.id;
    console.log('✅ Docker环境E2E: 邮件模板创建成功');

    // 4. 创建发送任务
    const taskResponse = await dockerSuite.dockerApiRequest('post', '/api/tasks', {
      name: 'Docker环境E2E测试任务',
      template_id: templateId,
      contact_ids: [contactId],
      schedule_type: 'immediate',
      sender_name: 'Docker测试发送者',
      sender_email: null, // V2.0会自动生成
      send_time: new Date().toISOString()
    }, authToken);
    
    expect(taskResponse.status).toBe(201);
    taskId = taskResponse.body.data.id;
    console.log('✅ Docker环境E2E: 发送任务创建成功');

    // 5. 验证任务状态
    const taskDetailResponse = await dockerSuite.dockerApiRequest('get', `/api/tasks/${taskId}`, null, authToken);
    
    expect(taskDetailResponse.status).toBe(200);
    expect(taskDetailResponse.body.data.status).toBeDefined();
    console.log('✅ Docker环境E2E: 任务状态验证成功');

    console.log('🎉 Docker环境完整业务流程测试通过！');
  });
}); 