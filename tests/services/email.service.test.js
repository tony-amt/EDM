const EmailService = require('../../src/backend/src/services/emailService');
const TemplateService = require('../../src/backend/src/services/templateService');
const ContactService = require('../../src/backend/src/services/contactService');
const config = require('../../src/config');

// 模拟外部依赖
jest.mock('../../src/config');
jest.mock('nodemailer');
jest.mock('aliyun-sdk');

describe('邮件服务测试', () => {
  let emailService;
  let mockUser, mockCampaign, mockContacts, mockTemplate;

  beforeEach(() => {
    emailService = new EmailService();
    
    // 设置模拟数据
    mockUser = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com'
    };

    mockCampaign = {
      id: 1,
      name: '测试群发任务',
      subject: '测试邮件主题',
      content: '<h1>Hello {{name}}</h1><p>This is a test email.</p>',
      userId: 1,
      status: 'draft',
      settings: {
        trackOpens: true,
        trackClicks: true,
        unsubscribeLink: true
      }
    };

    mockContacts = [
      {
        id: 1,
        email: 'contact1@example.com',
        name: '联系人1',
        customFields: { company: '公司A' }
      },
      {
        id: 2,
        email: 'contact2@example.com',
        name: '联系人2',
        customFields: { company: '公司B' }
      }
    ];

    mockTemplate = {
      id: 1,
      name: '测试模板',
      subject: '模板主题 {{name}}',
      content: '<h1>Hello {{name}}</h1><p>Company: {{company}}</p>',
      type: 'html'
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('邮件发送核心功能', () => {
    test('应该成功发送单个邮件', async () => {
      const recipient = mockContacts[0];
      const emailData = {
        to: recipient.email,
        subject: mockCampaign.subject,
        content: mockCampaign.content,
        from: mockUser.email
      };

      const result = await emailService.sendSingleEmail(emailData);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.recipient).toBe(recipient.email);
    });

    test('应该处理邮件发送失败', async () => {
      // 模拟发送失败
      emailService.transporter = {
        sendMail: jest.fn().mockRejectedValue(new Error('SMTP错误'))
      };

      const emailData = {
        to: 'invalid@example.com',
        subject: '测试',
        content: '测试内容'
      };

      const result = await emailService.sendSingleEmail(emailData);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('SMTP错误');
    });

    test('应该验证邮件地址格式', async () => {
      const invalidEmails = [
        'invalid-email',
        'test@',
        '@example.com',
        'test..test@example.com'
      ];

      for (const email of invalidEmails) {
        const emailData = {
          to: email,
          subject: '测试',
          content: '测试内容'
        };

        const result = await emailService.sendSingleEmail(emailData);
        expect(result.success).toBe(false);
        expect(result.error).toContain('邮件地址格式无效');
      }
    });

    test('应该正确设置邮件头部信息', async () => {
      const mockSendMail = jest.fn().mockResolvedValue({
        messageId: 'test-message-id'
      });

      emailService.transporter = { sendMail: mockSendMail };

      const emailData = {
        to: 'test@example.com',
        subject: '测试主题',
        content: '测试内容',
        from: 'sender@example.com',
        replyTo: 'reply@example.com'
      };

      await emailService.sendSingleEmail(emailData);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: emailData.from,
          to: emailData.to,
          subject: emailData.subject,
          html: emailData.content,
          replyTo: emailData.replyTo,
          headers: expect.objectContaining({
            'X-Mailer': 'EDM-System',
            'List-Unsubscribe': expect.any(String)
          })
        })
      );
    });
  });

  describe('模板处理功能', () => {
    test('应该正确解析邮件模板变量', () => {
      const template = '您好 {{name}}，欢迎来到 {{company}}！';
      const variables = {
        name: '张三',
        company: '测试公司'
      };

      const result = emailService.renderTemplate(template, variables);

      expect(result).toBe('您好 张三，欢迎来到 测试公司！');
    });

    test('应该处理缺失的模板变量', () => {
      const template = '您好 {{name}}，欢迎来到 {{company}}！';
      const variables = {
        name: '张三'
        // 缺少 company 变量
      };

      const result = emailService.renderTemplate(template, variables);

      expect(result).toBe('您好 张三，欢迎来到 ！');
    });

    test('应该支持条件模板语法', () => {
      const template = '{{#if vip}}尊敬的VIP用户{{else}}亲爱的用户{{/if}} {{name}}';
      const variables1 = { name: '张三', vip: true };
      const variables2 = { name: '李四', vip: false };

      const result1 = emailService.renderTemplate(template, variables1);
      const result2 = emailService.renderTemplate(template, variables2);

      expect(result1).toBe('尊敬的VIP用户 张三');
      expect(result2).toBe('亲爱的用户 李四');
    });

    test('应该支持循环模板语法', () => {
      const template = '商品列表：{{#each products}}<li>{{name}} - ¥{{price}}</li>{{/each}}';
      const variables = {
        products: [
          { name: '商品A', price: 100 },
          { name: '商品B', price: 200 }
        ]
      };

      const result = emailService.renderTemplate(template, variables);

      expect(result).toContain('<li>商品A - ¥100</li>');
      expect(result).toContain('<li>商品B - ¥200</li>');
    });

    test('应该过滤XSS攻击内容', () => {
      const template = '用户输入：{{userInput}}';
      const variables = {
        userInput: '<script>alert("XSS")</script>'
      };

      const result = emailService.renderTemplate(template, variables);

      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });
  });

  describe('群发任务处理', () => {
    test('应该创建群发任务的子任务', async () => {
      const result = await emailService.createCampaignTasks(mockCampaign, mockContacts);

      expect(result.success).toBe(true);
      expect(result.tasks).toBeDefined();
      expect(result.tasks.length).toBe(mockContacts.length);
      
      result.tasks.forEach((task, index) => {
        expect(task.campaignId).toBe(mockCampaign.id);
        expect(task.recipientEmail).toBe(mockContacts[index].email);
        expect(task.status).toBe('pending');
      });
    });

    test('应该验证群发任务状态', async () => {
      const sentCampaign = { ...mockCampaign, status: 'sent' };

      const result = await emailService.createCampaignTasks(sentCampaign, mockContacts);

      expect(result.success).toBe(false);
      expect(result.error).toContain('群发任务状态不允许创建子任务');
    });

    test('应该处理空联系人列表', async () => {
      const result = await emailService.createCampaignTasks(mockCampaign, []);

      expect(result.success).toBe(false);
      expect(result.error).toContain('联系人列表为空');
    });

    test('应该去重邮件地址', async () => {
      const duplicatedContacts = [
        ...mockContacts,
        { id: 3, email: 'contact1@example.com', name: '重复联系人' }
      ];

      const result = await emailService.createCampaignTasks(mockCampaign, duplicatedContacts);

      expect(result.success).toBe(true);
      expect(result.tasks.length).toBe(2); // 去重后只有2个
      
      const emails = result.tasks.map(task => task.recipientEmail);
      expect(new Set(emails).size).toBe(emails.length); // 确保没有重复
    });
  });

  describe('邮件队列处理', () => {
    test('应该按优先级处理邮件队列', async () => {
      const tasks = [
        { id: 1, priority: 'low', recipientEmail: 'low@example.com' },
        { id: 2, priority: 'high', recipientEmail: 'high@example.com' },
        { id: 3, priority: 'normal', recipientEmail: 'normal@example.com' },
        { id: 4, priority: 'urgent', recipientEmail: 'urgent@example.com' }
      ];

      const sortedTasks = emailService.sortTasksByPriority(tasks);

      const priorities = sortedTasks.map(task => task.priority);
      expect(priorities).toEqual(['urgent', 'high', 'normal', 'low']);
    });

    test('应该限制发送频率', async () => {
      emailService.rateLimiter = {
        checkLimit: jest.fn()
          .mockReturnValueOnce(true)  // 第一次允许
          .mockReturnValueOnce(true)  // 第二次允许
          .mockReturnValueOnce(false) // 第三次被限制
      };

      const tasks = [
        { id: 1, recipientEmail: 'test1@example.com' },
        { id: 2, recipientEmail: 'test2@example.com' },
        { id: 3, recipientEmail: 'test3@example.com' }
      ];

      const results = [];
      for (const task of tasks) {
        const result = await emailService.processTask(task);
        results.push(result);
      }

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[2].success).toBe(false);
      expect(results[2].error).toContain('发送频率超限');
    });

    test('应该重试失败的邮件', async () => {
      let attemptCount = 0;
      emailService.transporter = {
        sendMail: jest.fn().mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 3) {
            throw new Error('临时错误');
          }
          return { messageId: 'success-id' };
        })
      };

      const task = {
        id: 1,
        recipientEmail: 'retry@example.com',
        attempts: 0,
        maxAttempts: 3
      };

      const result = await emailService.processTaskWithRetry(task);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
    });

    test('应该处理不可重试的错误', async () => {
      emailService.transporter = {
        sendMail: jest.fn().mockRejectedValue(new Error('邮件地址不存在'))
      };

      const task = {
        id: 1,
        recipientEmail: 'notexist@example.com',
        attempts: 0
      };

      const result = await emailService.processTaskWithRetry(task);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1); // 不会重试
      expect(result.error).toContain('邮件地址不存在');
    });
  });

  describe('统计和监控', () => {
    test('应该跟踪邮件发送统计', async () => {
      const campaign = mockCampaign;
      
      // 模拟发送多封邮件
      await emailService.sendSingleEmail({
        to: 'success@example.com',
        subject: '测试',
        content: '内容'
      });

      // 模拟发送失败
      emailService.transporter = {
        sendMail: jest.fn().mockRejectedValue(new Error('发送失败'))
      };

      await emailService.sendSingleEmail({
        to: 'fail@example.com',
        subject: '测试',
        content: '内容'
      });

      const stats = await emailService.getCampaignStatistics(campaign.id);

      expect(stats.totalSent).toBeGreaterThan(0);
      expect(stats.totalFailed).toBeGreaterThan(0);
      expect(stats.successRate).toBeDefined();
      expect(stats.successRate).toBeGreaterThanOrEqual(0);
      expect(stats.successRate).toBeLessThanOrEqual(100);
    });

    test('应该记录邮件事件', async () => {
      const eventData = {
        type: 'open',
        messageId: 'test-message-id',
        recipientEmail: 'test@example.com',
        timestamp: new Date(),
        userAgent: 'Test User Agent',
        ipAddress: '192.168.1.1'
      };

      const result = await emailService.recordEmailEvent(eventData);

      expect(result.success).toBe(true);
      expect(result.eventId).toBeDefined();
    });

    test('应该处理邮件退回', async () => {
      const bounceData = {
        messageId: 'bounced-message-id',
        recipientEmail: 'bounce@example.com',
        bounceType: 'permanent',
        reason: '邮箱不存在'
      };

      const result = await emailService.handleBounce(bounceData);

      expect(result.success).toBe(true);
      
      // 验证联系人状态已更新
      const contact = await ContactService.findByEmail(bounceData.recipientEmail);
      expect(contact.status).toBe('bounced');
    });

    test('应该处理退订请求', async () => {
      const unsubscribeData = {
        email: 'unsubscribe@example.com',
        campaignId: mockCampaign.id,
        reason: '不再需要此类邮件'
      };

      const result = await emailService.handleUnsubscribe(unsubscribeData);

      expect(result.success).toBe(true);
      
      // 验证联系人状态已更新
      const contact = await ContactService.findByEmail(unsubscribeData.email);
      expect(contact.unsubscribed).toBe(true);
    });
  });

  describe('邮件路由和负载均衡', () => {
    test('应该根据域名选择合适的邮件服务', () => {
      const emailRoutes = [
        {
          id: 1,
          name: 'Gmail路由',
          conditions: { domains: ['gmail.com', 'googlemail.com'] },
          serviceId: 1,
          priority: 1
        },
        {
          id: 2,
          name: '默认路由',
          conditions: { domains: ['*'] },
          serviceId: 2,
          priority: 10
        }
      ];

      emailService.emailRoutes = emailRoutes;

      const gmailRoute = emailService.selectRoute('test@gmail.com');
      const otherRoute = emailService.selectRoute('test@yahoo.com');

      expect(gmailRoute.id).toBe(1);
      expect(otherRoute.id).toBe(2);
    });

    test('应该进行负载均衡', () => {
      const services = [
        { id: 1, name: '服务A', currentLoad: 50, maxLoad: 100 },
        { id: 2, name: '服务B', currentLoad: 30, maxLoad: 100 },
        { id: 3, name: '服务C', currentLoad: 80, maxLoad: 100 }
      ];

      const selectedService = emailService.selectServiceByLoad(services);

      expect(selectedService.id).toBe(2); // 负载最低的服务
    });

    test('应该处理服务不可用情况', () => {
      const services = [
        { id: 1, name: '服务A', status: 'unavailable' },
        { id: 2, name: '服务B', status: 'maintenance' },
        { id: 3, name: '服务C', status: 'active', currentLoad: 50, maxLoad: 100 }
      ];

      const selectedService = emailService.selectAvailableService(services);

      expect(selectedService.id).toBe(3); // 唯一可用的服务
    });
  });

  describe('安全性测试', () => {
    test('应该验证发送者权限', async () => {
      const unauthorizedUser = { id: 2, email: 'unauthorized@example.com' };
      const campaign = { ...mockCampaign, userId: 1 };

      const result = await emailService.validateSenderPermission(unauthorizedUser, campaign);

      expect(result.success).toBe(false);
      expect(result.error).toContain('无权限发送此群发任务');
    });

    test('应该防止邮件注入攻击', () => {
      const maliciousSubject = '测试主题\r\nBcc: hacker@evil.com';
      const maliciousContent = '正常内容\r\n\r\n--\r\nBcc: hacker@evil.com';

      const cleanSubject = emailService.sanitizeEmailHeader(maliciousSubject);
      const cleanContent = emailService.sanitizeEmailContent(maliciousContent);

      expect(cleanSubject).not.toContain('\r\n');
      expect(cleanSubject).not.toContain('Bcc:');
      expect(cleanContent).not.toContain('Bcc: hacker@evil.com');
    });

    test('应该限制邮件发送频率', async () => {
      const user = mockUser;
      const currentHour = new Date().getHours();

      // 模拟用户已发送接近限制的邮件数量
      emailService.userSendingLimits = {
        [user.id]: {
          daily: 990,
          hourly: 45,
          lastReset: new Date()
        }
      };

      const canSendDaily = emailService.checkDailyLimit(user);
      const canSendHourly = emailService.checkHourlyLimit(user);

      expect(canSendDaily).toBe(true);  // 990 < 1000
      expect(canSendHourly).toBe(true); // 45 < 50
    });

    test('应该拦截垃圾邮件特征', () => {
      const spamContents = [
        '恭喜您中奖1000万！！！立即点击领取！！！',
        '免费赚钱机会！！！无需投资！！！',
        'URGENT!!! CLAIM YOUR PRIZE NOW!!!',
        '限时优惠！！！错过再无！！！'
      ];

      spamContents.forEach(content => {
        const isSpam = emailService.detectSpam(content);
        expect(isSpam).toBe(true);
      });
    });
  });

  describe('错误处理和恢复', () => {
    test('应该处理网络连接错误', async () => {
      emailService.transporter = {
        sendMail: jest.fn().mockRejectedValue(new Error('ECONNREFUSED'))
      };

      const emailData = {
        to: 'test@example.com',
        subject: '测试',
        content: '测试内容'
      };

      const result = await emailService.sendSingleEmail(emailData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('网络连接失败');
      expect(result.retryable).toBe(true);
    });

    test('应该处理认证错误', async () => {
      emailService.transporter = {
        sendMail: jest.fn().mockRejectedValue(new Error('535 Authentication failed'))
      };

      const emailData = {
        to: 'test@example.com',
        subject: '测试',
        content: '测试内容'
      };

      const result = await emailService.sendSingleEmail(emailData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('认证失败');
      expect(result.retryable).toBe(false);
    });

    test('应该处理配额超限错误', async () => {
      emailService.transporter = {
        sendMail: jest.fn().mockRejectedValue(new Error('Daily quota exceeded'))
      };

      const emailData = {
        to: 'test@example.com',
        subject: '测试',
        content: '测试内容'
      };

      const result = await emailService.sendSingleEmail(emailData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('配额超限');
      expect(result.retryAfter).toBeDefined();
    });

    test('应该实现断路器模式', async () => {
      // 模拟连续失败
      let failureCount = 0;
      emailService.transporter = {
        sendMail: jest.fn().mockImplementation(() => {
          failureCount++;
          throw new Error('Service unavailable');
        })
      };

      // 连续发送5封邮件触发断路器
      for (let i = 0; i < 5; i++) {
        await emailService.sendSingleEmail({
          to: `test${i}@example.com`,
          subject: '测试',
          content: '内容'
        });
      }

      // 断路器应该打开，拒绝后续请求
      const result = await emailService.sendSingleEmail({
        to: 'test@example.com',
        subject: '测试',
        content: '内容'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('服务暂时不可用');
    });
  });
}); 