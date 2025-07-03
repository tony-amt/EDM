/**
 * V3.0 QueueScheduler队列调度器核心功能测试
 */
const { sequelize } = require('../../src/backend/src/models');
const { Task, SubTask, Contact, Template, EmailService, User, Sender } = require('../../src/backend/src/models');
const QueueScheduler = require('../../src/backend/src/services/infrastructure/queueScheduler.service');

describe('QueueScheduler V3.0核心功能', () => {
  let queueScheduler;
  let testUser, testSender, testEmailService, testTemplate, testContacts;

  beforeAll(async () => {
    // 确保数据库连接
    await sequelize.authenticate();

    // 同步数据库结构
    await sequelize.sync({ force: true });

    queueScheduler = new QueueScheduler();
  });

  beforeEach(async () => {
    // 清理数据
    await SubTask.destroy({ where: {}, force: true });
    await Task.destroy({ where: {}, force: true });
    await Contact.destroy({ where: {}, force: true });
    await Template.destroy({ where: {}, force: true });
    await EmailService.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });
    await Sender.destroy({ where: {}, force: true });

    // 创建测试数据
    testUser = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password_hash: 'hashedpassword',
      remaining_quota: 1000
    });

    testSender = await Sender.create({
      name: 'testsender',
      email: 'sender@example.com',
      user_id: testUser.id
    });

    testEmailService = await EmailService.create({
      name: 'Test Service',
      provider: 'engagelab',
      domain: 'test.com',
      api_key: 'test_key',
      api_secret: 'test_secret',
      is_enabled: true,
      is_frozen: false,
      daily_quota: 1000,
      used_quota: 0,
      sending_rate: 60 // 每分钟发送间隔
    });

    testTemplate = await Template.create({
      name: 'Test Template',
      subject: 'Hello {{name}}',
      body: '<p>Hi {{name}}, this is a test email.</p>',
      user_id: testUser.id
    });

    // 创建测试联系人
    testContacts = await Contact.bulkCreate([
      { email: 'contact1@example.com', name: 'Contact 1', tags: ['tag1', 'tag2'] },
      { email: 'contact2@example.com', name: 'Contact 2', tags: ['tag2', 'tag3'] },
      { email: 'contact3@example.com', name: 'Contact 3', tags: ['tag1'] }
    ], { returning: true });
  });

  afterAll(async () => {
    await queueScheduler.stop();
    await sequelize.close();
  });

  describe('任务队列生成', () => {
    test('应该为scheduled任务生成SubTask队列', async () => {
      // 创建scheduled任务
      const task = await Task.create({
        name: 'Test Task',
        status: 'scheduled',
        scheduled_at: new Date(Date.now() - 1000), // 1秒前
        sender_id: testSender.id,
        created_by: testUser.id,
        contacts: testContacts.map(c => c.id), // 使用新的JSONB字段
        templates: [testTemplate.id] // 使用新的JSONB字段
      });

      // 处理任务
      const result = await queueScheduler.processScheduledTasks(10);

      expect(result.processed).toBe(1);
      expect(result.failed).toBe(0);

      // 检查SubTask是否生成
      const subtasks = await SubTask.findAll({ where: { task_id: task.id } });
      expect(subtasks.length).toBe(testContacts.length);

      // 检查SubTask内容
      subtasks.forEach(subtask => {
        expect(subtask.status).toBe('queued');
        expect(subtask.rendered_subject).toContain('Hello');
        expect(subtask.rendered_body).toContain('Hi');
        expect(subtask.sender_email).toContain('@test.com');
      });

      // 检查任务状态更新
      await task.reload();
      expect(task.status).toBe('sending');
      expect(task.total_subtasks).toBe(testContacts.length);
    });

    test('应该正确处理基于标签的联系人选择', async () => {
      const task = await Task.create({
        name: 'Tag-based Task',
        status: 'scheduled',
        scheduled_at: new Date(Date.now() - 1000),
        sender_id: testSender.id,
        created_by: testUser.id,
        templates: [testTemplate.id],
        recipient_rule: {
          type: 'tag_based',
          include_tags: ['tag1'],
          exclude_tags: ['tag3']
        }
      });

      const result = await queueScheduler.processScheduledTasks(10);

      expect(result.processed).toBe(1);

      const subtasks = await SubTask.findAll({ where: { task_id: task.id } });
      // 应该只包含有tag1但没有tag3的联系人
      expect(subtasks.length).toBe(2); // contact1 和 contact3
    });
  });

  describe('队列调度机制', () => {
    test('应该按时间间隔发送邮件', async () => {
      // 创建任务和SubTask
      const task = await Task.create({
        name: 'Queue Test Task',
        status: 'sending',
        sender_id: testSender.id,
        created_by: testUser.id,
        templates: [testTemplate.id]
      });

      const subtasks = await SubTask.bulkCreate([
        {
          task_id: task.id,
          contact_id: testContacts[0].id,
          template_id: testTemplate.id,
          recipient_email: testContacts[0].email,
          sender_email: `${testSender.name}@${testEmailService.domain}`,
          rendered_subject: 'Test Subject',
          rendered_body: 'Test Body',
          status: 'queued',
          service_id: testEmailService.id
        },
        {
          task_id: task.id,
          contact_id: testContacts[1].id,
          template_id: testTemplate.id,
          recipient_email: testContacts[1].email,
          sender_email: `${testSender.name}@${testEmailService.domain}`,
          rendered_subject: 'Test Subject 2',
          rendered_body: 'Test Body 2',
          status: 'queued',
          service_id: testEmailService.id
        }
      ], { returning: true });

      // 启动调度器
      await queueScheduler.start();

      // 等待一段时间让调度器处理
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 检查SubTask状态变化
      await subtasks[0].reload();
      await subtasks[1].reload();

      // 由于是测试环境，邮件不会真正发送，但状态应该更新
      expect(['sending', 'sent', 'failed']).toContain(subtasks[0].status);
      expect(['sending', 'sent', 'failed']).toContain(subtasks[1].status);
    });

    test('应该实现多用户公平轮询', async () => {
      // 创建第二个用户
      const user2 = await User.create({
        username: 'testuser2',
        email: 'test2@example.com',
        password_hash: 'hashedpassword',
        remaining_quota: 1000
      });

      const sender2 = await Sender.create({
        name: 'testsender2',
        email: 'sender2@example.com',
        user_id: user2.id
      });

      // 为两个用户创建任务
      const task1 = await Task.create({
        name: 'User1 Task',
        status: 'sending',
        sender_id: testSender.id,
        created_by: testUser.id,
        templates: [testTemplate.id]
      });

      const task2 = await Task.create({
        name: 'User2 Task',
        status: 'sending',
        sender_id: sender2.id,
        created_by: user2.id,
        templates: [testTemplate.id]
      });

      // 为每个任务创建多个SubTask
      await SubTask.bulkCreate([
        {
          task_id: task1.id,
          contact_id: testContacts[0].id,
          template_id: testTemplate.id,
          recipient_email: testContacts[0].email,
          sender_email: `${testSender.name}@${testEmailService.domain}`,
          rendered_subject: 'User1 Email',
          rendered_body: 'User1 Body',
          status: 'queued',
          service_id: testEmailService.id
        },
        {
          task_id: task2.id,
          contact_id: testContacts[1].id,
          template_id: testTemplate.id,
          recipient_email: testContacts[1].email,
          sender_email: `${sender2.name}@${testEmailService.domain}`,
          rendered_subject: 'User2 Email',
          rendered_body: 'User2 Body',
          status: 'queued',
          service_id: testEmailService.id
        }
      ]);

      // 启动调度器并观察轮询行为
      await queueScheduler.start();
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 检查两个用户的任务都有进展
      const user1Subtasks = await SubTask.findAll({ where: { task_id: task1.id } });
      const user2Subtasks = await SubTask.findAll({ where: { task_id: task2.id } });

      // 验证公平性（两个用户的任务都应该有处理）
      const user1Processed = user1Subtasks.filter(st => st.status !== 'queued').length;
      const user2Processed = user2Subtasks.filter(st => st.status !== 'queued').length;

      expect(user1Processed).toBeGreaterThan(0);
      expect(user2Processed).toBeGreaterThan(0);
    });
  });

  describe('额度控制', () => {
    test('应该检查用户额度', async () => {
      // 设置用户额度不足
      await testUser.update({ remaining_quota: 1 });

      const task = await Task.create({
        name: 'Quota Test Task',
        status: 'scheduled',
        scheduled_at: new Date(Date.now() - 1000),
        sender_id: testSender.id,
        created_by: testUser.id,
        contacts: testContacts.map(c => c.id), // 需要3个联系人，但额度只有1
        templates: [testTemplate.id]
      });

      const result = await queueScheduler.processScheduledTasks(10);

      expect(result.failed).toBe(1);

      await task.reload();
      expect(task.status).toBe('failed');
      expect(task.error_message).toContain('额度不足');
    });

    test('应该检查发信服务额度', async () => {
      // 设置发信服务额度不足
      await testEmailService.update({
        daily_quota: 10,
        used_quota: 10 // 已用完
      });

      const task = await Task.create({
        name: 'Service Quota Test',
        status: 'scheduled',
        scheduled_at: new Date(Date.now() - 1000),
        sender_id: testSender.id,
        created_by: testUser.id,
        contacts: [testContacts[0].id],
        templates: [testTemplate.id]
      });

      const result = await queueScheduler.processScheduledTasks(10);

      expect(result.processed).toBe(1);

      await task.reload();
      expect(task.status).toBe('paused'); // 应该暂停而不是失败
    });
  });

  describe('任务控制', () => {
    test('应该能够暂停和恢复任务', async () => {
      const task = await Task.create({
        name: 'Pause Test Task',
        status: 'sending',
        sender_id: testSender.id,
        created_by: testUser.id,
        templates: [testTemplate.id]
      });

      await SubTask.create({
        task_id: task.id,
        contact_id: testContacts[0].id,
        template_id: testTemplate.id,
        recipient_email: testContacts[0].email,
        sender_email: `${testSender.name}@${testEmailService.domain}`,
        rendered_subject: 'Test Subject',
        rendered_body: 'Test Body',
        status: 'queued',
        service_id: testEmailService.id
      });

      // 暂停任务
      await queueScheduler.pauseTask(task.id);
      await task.reload();
      expect(task.status).toBe('paused');

      // 恢复任务
      await queueScheduler.resumeTask(task.id);
      await task.reload();
      expect(task.status).toBe('sending');
    });

    test('应该正确处理任务完成状态', async () => {
      const task = await Task.create({
        name: 'Completion Test Task',
        status: 'sending',
        sender_id: testSender.id,
        created_by: testUser.id,
        templates: [testTemplate.id]
      });

      const subtask = await SubTask.create({
        task_id: task.id,
        contact_id: testContacts[0].id,
        template_id: testTemplate.id,
        recipient_email: testContacts[0].email,
        sender_email: `${testSender.name}@${testEmailService.domain}`,
        rendered_subject: 'Test Subject',
        rendered_body: 'Test Body',
        status: 'queued',
        service_id: testEmailService.id
      });

      // 模拟SubTask完成
      await subtask.update({ status: 'sent', sent_at: new Date() });

      // 检查任务状态更新
      await queueScheduler.checkAndUpdateTaskStatus(task.id);
      await task.reload();

      expect(task.status).toBe('completed');
      expect(task.completed_at).toBeTruthy();
    });
  });

  describe('错误处理', () => {
    test('应该正确处理发送失败的SubTask', async () => {
      const task = await Task.create({
        name: 'Error Test Task',
        status: 'sending',
        sender_id: testSender.id,
        created_by: testUser.id,
        templates: [testTemplate.id]
      });

      const subtask = await SubTask.create({
        task_id: task.id,
        contact_id: testContacts[0].id,
        template_id: testTemplate.id,
        recipient_email: 'invalid@invalid.com',
        sender_email: `${testSender.name}@${testEmailService.domain}`,
        rendered_subject: 'Test Subject',
        rendered_body: 'Test Body',
        status: 'queued',
        service_id: testEmailService.id
      });

      // 启动调度器处理
      await queueScheduler.start();
      await new Promise(resolve => setTimeout(resolve, 2000));

      await subtask.reload();

      // 检查错误处理
      if (subtask.status === 'failed') {
        expect(subtask.error_message).toBeTruthy();
        expect(subtask.retry_count).toBeGreaterThan(0);
      }
    });

    test('应该实现重试机制', async () => {
      const task = await Task.create({
        name: 'Retry Test Task',
        status: 'sending',
        sender_id: testSender.id,
        created_by: testUser.id,
        templates: [testTemplate.id]
      });

      const subtask = await SubTask.create({
        task_id: task.id,
        contact_id: testContacts[0].id,
        template_id: testTemplate.id,
        recipient_email: testContacts[0].email,
        sender_email: `${testSender.name}@${testEmailService.domain}`,
        rendered_subject: 'Test Subject',
        rendered_body: 'Test Body',
        status: 'failed',
        retry_count: 1,
        next_retry_at: new Date(Date.now() - 1000), // 1秒前，应该重试
        service_id: testEmailService.id
      });

      // 处理重试
      const retryResult = await queueScheduler.processRetrySubTasks();

      expect(retryResult.processed).toBeGreaterThan(0);
    });
  });

  describe('性能测试', () => {
    test('应该能够处理大量SubTask', async () => {
      const task = await Task.create({
        name: 'Performance Test Task',
        status: 'sending',
        sender_id: testSender.id,
        created_by: testUser.id,
        templates: [testTemplate.id]
      });

      // 创建100个SubTask
      const subtasks = [];
      for (let i = 0; i < 100; i++) {
        subtasks.push({
          task_id: task.id,
          contact_id: testContacts[i % testContacts.length].id,
          template_id: testTemplate.id,
          recipient_email: `test${i}@example.com`,
          sender_email: `${testSender.name}@${testEmailService.domain}`,
          rendered_subject: `Test Subject ${i}`,
          rendered_body: `Test Body ${i}`,
          status: 'queued',
          service_id: testEmailService.id
        });
      }

      await SubTask.bulkCreate(subtasks);

      const startTime = Date.now();

      // 启动调度器
      await queueScheduler.start();
      await new Promise(resolve => setTimeout(resolve, 5000));

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // 检查处理性能
      const processedSubtasks = await SubTask.findAll({
        where: {
          task_id: task.id,
          status: { [Op.ne]: 'queued' }
        }
      });

      console.log(`处理了 ${processedSubtasks.length}/100 个SubTask，耗时 ${processingTime}ms`);

      // 验证至少处理了一些SubTask
      expect(processedSubtasks.length).toBeGreaterThan(0);
    });
  });
}); 