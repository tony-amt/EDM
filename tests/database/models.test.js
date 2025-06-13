const { Sequelize } = require('sequelize');
const config = require('../../src/config');

// 模拟数据库连接
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false
});

// 导入所有模型
const User = require('../../src/backend/src/models/user.model')(sequelize, Sequelize.DataTypes);
const Campaign = require('../../src/backend/src/models/campaign.model')(sequelize, Sequelize.DataTypes);
const Contact = require('../../src/backend/src/models/contact.model')(sequelize, Sequelize.DataTypes);
const Template = require('../../src/backend/src/models/template.model')(sequelize, Sequelize.DataTypes);
const MailService = require('../../src/backend/src/models/mailService.model')(sequelize, Sequelize.DataTypes);
const EmailRoute = require('../../src/backend/src/models/emailRoute.model')(sequelize, Sequelize.DataTypes);
const Task = require('../../src/backend/src/models/task.model')(sequelize, Sequelize.DataTypes);
const EventLog = require('../../src/backend/src/models/eventLog.model')(sequelize, Sequelize.DataTypes);

describe('数据库模型测试', () => {
  
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    // 清理所有表数据
    await sequelize.truncate({ cascade: true });
  });

  describe('User模型测试', () => {
    test('应该创建用户', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword',
        role: 'user',
        status: 'active'
      };

      const user = await User.create(userData);
      
      expect(user.id).toBeDefined();
      expect(user.username).toBe(userData.username);
      expect(user.email).toBe(userData.email);
      expect(user.role).toBe(userData.role);
      expect(user.status).toBe(userData.status);
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
    });

    test('应该验证必需字段', async () => {
      await expect(User.create({})).rejects.toThrow();
      
      await expect(User.create({
        username: 'test'
        // 缺少 email 和 password
      })).rejects.toThrow();
    });

    test('应该验证邮箱唯一性', async () => {
      const userData = {
        username: 'testuser1',
        email: 'test@example.com',
        password: 'hashedpassword',
        role: 'user'
      };

      await User.create(userData);
      
      await expect(User.create({
        ...userData,
        username: 'testuser2'
      })).rejects.toThrow();
    });

    test('应该正确设置默认值', async () => {
      const user = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword'
      });

      expect(user.role).toBe('user'); // 默认角色
      expect(user.status).toBe('active'); // 默认状态
    });
  });

  describe('Campaign模型测试', () => {
    let userId;

    beforeEach(async () => {
      const user = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword'
      });
      userId = user.id;
    });

    test('应该创建群发任务', async () => {
      const campaignData = {
        name: '测试群发任务',
        subject: '测试邮件主题',
        content: '测试邮件内容',
        userId: userId,
        status: 'draft',
        scheduledAt: new Date()
      };

      const campaign = await Campaign.create(campaignData);
      
      expect(campaign.id).toBeDefined();
      expect(campaign.name).toBe(campaignData.name);
      expect(campaign.subject).toBe(campaignData.subject);
      expect(campaign.userId).toBe(userId);
      expect(campaign.status).toBe('draft');
    });

    test('应该验证必需字段', async () => {
      await expect(Campaign.create({})).rejects.toThrow();
      
      await expect(Campaign.create({
        name: '测试任务'
        // 缺少其他必需字段
      })).rejects.toThrow();
    });

    test('应该正确设置状态枚举', async () => {
      const validStatuses = ['draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'];
      
      for (const status of validStatuses) {
        const campaign = await Campaign.create({
          name: `测试任务-${status}`,
          subject: '测试主题',
          content: '测试内容',
          userId: userId,
          status: status
        });
        
        expect(campaign.status).toBe(status);
      }
    });

    test('应该拒绝无效状态', async () => {
      await expect(Campaign.create({
        name: '测试任务',
        subject: '测试主题',
        content: '测试内容',
        userId: userId,
        status: 'invalid_status'
      })).rejects.toThrow();
    });
  });

  describe('Contact模型测试', () => {
    let userId;

    beforeEach(async () => {
      const user = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword'
      });
      userId = user.id;
    });

    test('应该创建联系人', async () => {
      const contactData = {
        email: 'contact@example.com',
        name: '测试联系人',
        phone: '13800138000',
        userId: userId,
        status: 'active'
      };

      const contact = await Contact.create(contactData);
      
      expect(contact.id).toBeDefined();
      expect(contact.email).toBe(contactData.email);
      expect(contact.name).toBe(contactData.name);
      expect(contact.phone).toBe(contactData.phone);
      expect(contact.userId).toBe(userId);
      expect(contact.status).toBe('active');
    });

    test('应该验证邮箱格式', async () => {
      await expect(Contact.create({
        email: 'invalid-email',
        name: '测试联系人',
        userId: userId
      })).rejects.toThrow();
    });

    test('应该验证联系人在用户范围内的邮箱唯一性', async () => {
      const contactData = {
        email: 'contact@example.com',
        name: '测试联系人',
        userId: userId
      };

      await Contact.create(contactData);
      
      await expect(Contact.create(contactData)).rejects.toThrow();
    });
  });

  describe('Template模型测试', () => {
    let userId;

    beforeEach(async () => {
      const user = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword'
      });
      userId = user.id;
    });

    test('应该创建邮件模板', async () => {
      const templateData = {
        name: '测试模板',
        subject: '模板主题',
        content: '<h1>测试内容</h1>',
        type: 'html',
        userId: userId
      };

      const template = await Template.create(templateData);
      
      expect(template.id).toBeDefined();
      expect(template.name).toBe(templateData.name);
      expect(template.subject).toBe(templateData.subject);
      expect(template.content).toBe(templateData.content);
      expect(template.type).toBe('html');
      expect(template.userId).toBe(userId);
    });

    test('应该验证模板类型', async () => {
      const validTypes = ['html', 'text', 'richtext'];
      
      for (const type of validTypes) {
        const template = await Template.create({
          name: `测试模板-${type}`,
          subject: '测试主题',
          content: '测试内容',
          type: type,
          userId: userId
        });
        
        expect(template.type).toBe(type);
      }
    });
  });

  describe('MailService模型测试', () => {
    test('应该创建邮件服务配置', async () => {
      const serviceData = {
        name: '阿里云邮件服务',
        provider: 'aliyun',
        config: {
          accessKeyId: 'test_key',
          accessKeySecret: 'test_secret',
          regionId: 'cn-hangzhou'
        },
        status: 'active',
        dailyLimit: 1000,
        monthlyLimit: 30000
      };

      const service = await MailService.create(serviceData);
      
      expect(service.id).toBeDefined();
      expect(service.name).toBe(serviceData.name);
      expect(service.provider).toBe(serviceData.provider);
      expect(service.config).toEqual(serviceData.config);
      expect(service.status).toBe('active');
      expect(service.dailyLimit).toBe(1000);
      expect(service.monthlyLimit).toBe(30000);
    });

    test('应该验证邮件服务提供商', async () => {
      const validProviders = ['aliyun', 'tencent', 'sendgrid', 'custom'];
      
      for (const provider of validProviders) {
        const service = await MailService.create({
          name: `测试服务-${provider}`,
          provider: provider,
          config: {},
          dailyLimit: 1000
        });
        
        expect(service.provider).toBe(provider);
      }
    });
  });

  describe('EmailRoute模型测试', () => {
    let userId;

    beforeEach(async () => {
      const user = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword'
      });
      userId = user.id;
    });

    test('应该创建邮件路由配置', async () => {
      const routeData = {
        name: '默认路由',
        conditions: {
          domains: ['example.com'],
          volume: { min: 0, max: 1000 }
        },
        priority: 1,
        isActive: true,
        userId: userId
      };

      const route = await EmailRoute.create(routeData);
      
      expect(route.id).toBeDefined();
      expect(route.name).toBe(routeData.name);
      expect(route.conditions).toEqual(routeData.conditions);
      expect(route.priority).toBe(1);
      expect(route.isActive).toBe(true);
      expect(route.userId).toBe(userId);
    });

    test('应该验证优先级范围', async () => {
      const route = await EmailRoute.create({
        name: '测试路由',
        conditions: {},
        priority: 5,
        userId: userId
      });
      
      expect(route.priority).toBe(5);
      expect(route.priority).toBeGreaterThanOrEqual(1);
      expect(route.priority).toBeLessThanOrEqual(10);
    });
  });

  describe('Task模型测试', () => {
    let userId, campaignId;

    beforeEach(async () => {
      const user = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword'
      });
      userId = user.id;

      const campaign = await Campaign.create({
        name: '测试群发任务',
        subject: '测试主题',
        content: '测试内容',
        userId: userId
      });
      campaignId = campaign.id;
    });

    test('应该创建子任务', async () => {
      const taskData = {
        campaignId: campaignId,
        recipientEmail: 'recipient@example.com',
        status: 'pending',
        priority: 'normal',
        attempts: 0
      };

      const task = await Task.create(taskData);
      
      expect(task.id).toBeDefined();
      expect(task.campaignId).toBe(campaignId);
      expect(task.recipientEmail).toBe(taskData.recipientEmail);
      expect(task.status).toBe('pending');
      expect(task.priority).toBe('normal');
      expect(task.attempts).toBe(0);
    });

    test('应该验证任务状态', async () => {
      const validStatuses = ['pending', 'sending', 'sent', 'failed', 'skipped'];
      
      for (const status of validStatuses) {
        const task = await Task.create({
          campaignId: campaignId,
          recipientEmail: `${status}@example.com`,
          status: status
        });
        
        expect(task.status).toBe(status);
      }
    });

    test('应该验证优先级', async () => {
      const validPriorities = ['low', 'normal', 'high', 'urgent'];
      
      for (const priority of validPriorities) {
        const task = await Task.create({
          campaignId: campaignId,
          recipientEmail: `${priority}@example.com`,
          priority: priority
        });
        
        expect(task.priority).toBe(priority);
      }
    });
  });

  describe('EventLog模型测试', () => {
    let userId;

    beforeEach(async () => {
      const user = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword'
      });
      userId = user.id;
    });

    test('应该创建事件日志', async () => {
      const logData = {
        userId: userId,
        action: 'campaign_created',
        resourceType: 'campaign',
        resourceId: '123',
        details: {
          campaignName: '测试群发',
          recipientCount: 100
        },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      };

      const log = await EventLog.create(logData);
      
      expect(log.id).toBeDefined();
      expect(log.userId).toBe(userId);
      expect(log.action).toBe(logData.action);
      expect(log.resourceType).toBe(logData.resourceType);
      expect(log.resourceId).toBe(logData.resourceId);
      expect(log.details).toEqual(logData.details);
      expect(log.ipAddress).toBe(logData.ipAddress);
      expect(log.userAgent).toBe(logData.userAgent);
    });

    test('应该验证事件类型', async () => {
      const validActions = [
        'user_login', 'user_logout', 'user_created', 'user_updated',
        'campaign_created', 'campaign_updated', 'campaign_started', 'campaign_completed',
        'template_created', 'template_updated', 'template_deleted',
        'contact_created', 'contact_updated', 'contact_deleted'
      ];
      
      for (const action of validActions.slice(0, 5)) { // 测试前5个
        const log = await EventLog.create({
          userId: userId,
          action: action,
          resourceType: 'test',
          resourceId: '123'
        });
        
        expect(log.action).toBe(action);
      }
    });
  });

  describe('模型关联测试', () => {
    let user, campaign, contact, template;

    beforeEach(async () => {
      user = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword'
      });

      campaign = await Campaign.create({
        name: '测试群发任务',
        subject: '测试主题',
        content: '测试内容',
        userId: user.id
      });

      contact = await Contact.create({
        email: 'contact@example.com',
        name: '测试联系人',
        userId: user.id
      });

      template = await Template.create({
        name: '测试模板',
        subject: '模板主题',
        content: '模板内容',
        userId: user.id
      });
    });

    test('用户与群发任务的关联', async () => {
      // 这里需要根据实际的模型关联来测试
      expect(campaign.userId).toBe(user.id);
    });

    test('用户与联系人的关联', async () => {
      expect(contact.userId).toBe(user.id);
    });

    test('用户与模板的关联', async () => {
      expect(template.userId).toBe(user.id);
    });
  });

  describe('数据验证测试', () => {
    test('应该验证邮箱格式', async () => {
      const invalidEmails = [
        'invalid-email',
        'test@',
        '@example.com',
        'test..test@example.com',
        'test@example',
        ''
      ];

      for (const email of invalidEmails) {
        await expect(User.create({
          username: 'testuser',
          email: email,
          password: 'hashedpassword'
        })).rejects.toThrow();
      }
    });

    test('应该验证密码长度', async () => {
      await expect(User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: '123' // 太短
      })).rejects.toThrow();
    });

    test('应该验证用户名长度和格式', async () => {
      const invalidUsernames = ['a', 'ab', '', 'user with spaces', 'user@name'];

      for (const username of invalidUsernames) {
        await expect(User.create({
          username: username,
          email: 'test@example.com',
          password: 'hashedpassword'
        })).rejects.toThrow();
      }
    });
  });

  describe('数据库约束测试', () => {
    test('应该强制唯一约束', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword'
      };

      await User.create(userData);
      
      // 相同用户名
      await expect(User.create({
        ...userData,
        email: 'different@example.com'
      })).rejects.toThrow();

      // 相同邮箱
      await expect(User.create({
        ...userData,
        username: 'differentuser'
      })).rejects.toThrow();
    });

    test('应该强制外键约束', async () => {
      // 尝试创建没有有效用户ID的群发任务
      await expect(Campaign.create({
        name: '测试群发任务',
        subject: '测试主题',
        content: '测试内容',
        userId: 999999 // 不存在的用户ID
      })).rejects.toThrow();
    });
  });
}); 