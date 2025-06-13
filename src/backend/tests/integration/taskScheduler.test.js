/**
 * V2.0 TaskScheduler核心调度逻辑测试
 * 重点测试sender@domain生成和智能服务分配
 */
const { Task, SubTask, EmailService, UserServiceMapping, Contact, Sender, TemplateSet, TemplateSetItem, Template } = require('../../src/models');
const TaskScheduler = require('../../src/services/infrastructure/TaskScheduler');
const { setupTestDB, cleanupTestDB, createTestUser } = require('../helpers/testHelper');

describe('TaskScheduler V2.0核心功能', () => {
  let taskScheduler;
  let testUser;
  let testEmailService;
  let testSender;
  let testTemplateSet;
  let testContacts;

  beforeAll(async () => {
    await setupTestDB();
    taskScheduler = new TaskScheduler();
  });

  afterAll(async () => {
    await cleanupTestDB();
  });

  beforeEach(async () => {
    // 创建测试用户
    testUser = await createTestUser({ remaining_quota: 1000 });

    // 创建发信服务
    testEmailService = await EmailService.create({
      name: '测试发信服务',
      provider: 'smtp',
      api_endpoint: 'smtp.test.com',
      domain: 'example.com', // 用于测试sender@domain
      auth_config: { username: 'test', password: 'test' },
      daily_quota: 1000,
      status: 'active'
    });

    // 创建用户服务映射
    await UserServiceMapping.create({
      user_id: testUser.id,
      service_id: testEmailService.id,
      daily_quota: 500,
      priority: 1,
      is_default: true
    });

    // 创建发信人
    testSender = await Sender.create({
      name: 'testsender', // 用于生成testsender@example.com
      display_name: '测试发信人',
      user_id: testUser.id
    });

    // 创建模板
    const template = await Template.create({
      name: '测试模板',
      subject: 'Hello {{name}}',
      body: 'Dear {{name}}, this is a test email.',
      user_id: testUser.id
    });

    // 创建模板集
    testTemplateSet = await TemplateSet.create({
      name: '测试模板集',
      user_id: testUser.id
    });

    await TemplateSetItem.create({
      template_set_id: testTemplateSet.id,
      template_id: template.id,
      order_index: 1
    });

    // 创建测试联系人
    testContacts = await Contact.bulkCreate([
      { email: 'user1@test.com', name: 'User 1', user_id: testUser.id },
      { email: 'user2@test.com', name: 'User 2', user_id: testUser.id },
      { email: 'user3@test.com', name: 'User 3', user_id: testUser.id }
    ]);
  });

  afterEach(async () => {
    // 清理测试数据
    await SubTask.destroy({ where: {}, force: true });
    await Task.destroy({ where: {}, force: true });
    await TemplateSetItem.destroy({ where: {}, force: true });
    await TemplateSet.destroy({ where: {}, force: true });
    await Template.destroy({ where: {}, force: true });
    await Contact.destroy({ where: {}, force: true });
    await UserServiceMapping.destroy({ where: {}, force: true });
    await EmailService.destroy({ where: {}, force: true });
    await Sender.destroy({ where: {}, force: true });
  });

  describe('processScheduledTasks - V2.0核心调度流程', () => {
    it('应该正确生成SubTask并分配发信服务', async () => {
      // 创建待调度的任务
      const task = await Task.create({
        name: '测试群发任务',
        user_id: testUser.id,
        sender_id: testSender.id,
        template_set_id: testTemplateSet.id,
        recipient_rule: {
          type: 'all_contacts'
        },
        status: 'scheduled',
        scheduled_at: new Date(),
        priority: 1
      });

      // 执行调度
      const result = await taskScheduler.processScheduledTasks(10);

      expect(result.processed).toBe(1);
      expect(result.failed).toBe(0);

      // 验证任务状态更新
      const updatedTask = await Task.findByPk(task.id);
      expect(updatedTask.status).toBe('sending');
      expect(updatedTask.total_subtasks).toBe(3); // 3个联系人
      expect(updatedTask.allocated_subtasks).toBe(3);

      // 验证SubTask生成
      const subtasks = await SubTask.findAll({
        where: { task_id: task.id }
      });

      expect(subtasks.length).toBe(3);

      // 验证每个SubTask都正确分配了服务和生成了sender@domain
      subtasks.forEach(subtask => {
        expect(subtask.service_id).toBe(testEmailService.id);
        expect(subtask.sender_email).toBe('testsender@example.com'); // 核心测试：sender@domain
        expect(subtask.status).toBe('allocated');
        expect(subtask.scheduled_at).toBeDefined();
        expect(subtask.allocated_quota).toBe(1);
      });
    });

    it('应该根据recipient_rule正确筛选联系人', async () => {
      // 测试指定联系人
      const task = await Task.create({
        name: '指定联系人任务',
        user_id: testUser.id,
        sender_id: testSender.id,
        template_set_id: testTemplateSet.id,
        recipient_rule: {
          type: 'specific',
          contact_ids: [testContacts[0].id, testContacts[1].id] // 只选择前2个
        },
        status: 'scheduled',
        scheduled_at: new Date(),
        priority: 1
      });

      await taskScheduler.processScheduledTasks(10);

      const subtasks = await SubTask.findAll({
        where: { task_id: task.id }
      });

      expect(subtasks.length).toBe(2); // 只应该生成2个SubTask
      
      const recipientEmails = subtasks.map(st => st.recipient_email).sort();
      expect(recipientEmails).toEqual(['user1@test.com', 'user2@test.com']);
    });

    it('用户额度不足时应该失败', async () => {
      // 设置用户额度为0
      await testUser.update({ remaining_quota: 0 });

      const task = await Task.create({
        name: '额度不足任务',
        user_id: testUser.id,
        sender_id: testSender.id,
        template_set_id: testTemplateSet.id,
        recipient_rule: { type: 'all_contacts' },
        status: 'scheduled',
        scheduled_at: new Date()
      });

      const result = await taskScheduler.processScheduledTasks(10);

      expect(result.failed).toBe(1);
      expect(result.processed).toBe(0);

      // 验证任务状态
      const failedTask = await Task.findByPk(task.id);
      expect(failedTask.status).toBe('failed');
    });

    it('没有可用发信服务时应该保持pending状态', async () => {
      // 删除用户服务映射
      await UserServiceMapping.destroy({
        where: { user_id: testUser.id }
      });

      const task = await Task.create({
        name: '无服务任务',
        user_id: testUser.id,
        sender_id: testSender.id,
        template_set_id: testTemplateSet.id,
        recipient_rule: { type: 'all_contacts' },
        status: 'scheduled',
        scheduled_at: new Date()
      });

      const result = await taskScheduler.processScheduledTasks(10);

      expect(result.failed).toBe(1);

      // 验证任务状态
      const failedTask = await Task.findByPk(task.id);
      expect(failedTask.status).toBe('failed');
    });
  });

  describe('sender@domain邮箱生成逻辑', () => {
    it('应该正确生成sender@domain格式的发信邮箱', async () => {
      // 创建不同的发信人和服务组合
      const customSender = await Sender.create({
        name: 'marketing', // 应该生成 marketing@example.com
        display_name: '营销部门',
        user_id: testUser.id
      });

      const customService = await EmailService.create({
        name: '自定义服务',
        provider: 'smtp',
        api_endpoint: 'smtp.custom.com',
        domain: 'custom-domain.com', // 自定义域名
        auth_config: { username: 'test', password: 'test' },
        daily_quota: 1000,
        status: 'active'
      });

      await UserServiceMapping.create({
        user_id: testUser.id,
        service_id: customService.id,
        daily_quota: 500,
        priority: 2
      });

      const task = await Task.create({
        name: '自定义邮箱测试',
        user_id: testUser.id,
        sender_id: customSender.id,
        template_set_id: testTemplateSet.id,
        recipient_rule: { type: 'all_contacts' },
        status: 'scheduled',
        scheduled_at: new Date()
      });

      await taskScheduler.processScheduledTasks(10);

      const subtasks = await SubTask.findAll({
        where: { task_id: task.id }
      });

      // 验证生成的邮箱格式
      subtasks.forEach(subtask => {
        expect(subtask.sender_email).toBe('marketing@custom-domain.com');
      });
    });

    it('应该为不同服务生成不同域名的邮箱', async () => {
      // 创建第二个发信服务
      const service2 = await EmailService.create({
        name: '服务2',
        provider: 'smtp',
        api_endpoint: 'smtp.service2.com',
        domain: 'service2.com',
        auth_config: { username: 'test', password: 'test' },
        daily_quota: 1000,
        status: 'active'
      });

      await UserServiceMapping.create({
        user_id: testUser.id,
        service_id: service2.id,
        daily_quota: 500,
        priority: 0 // 低优先级
      });

      // 由于我们有多个服务，系统应该选择优先级最高的
      const task = await Task.create({
        name: '多服务测试',
        user_id: testUser.id,
        sender_id: testSender.id,
        template_set_id: testTemplateSet.id,
        recipient_rule: { type: 'all_contacts' },
        status: 'scheduled',
        scheduled_at: new Date()
      });

      await taskScheduler.processScheduledTasks(10);

      const subtasks = await SubTask.findAll({
        where: { task_id: task.id }
      });

      // 由于testEmailService优先级更高(priority: 1)，应该使用example.com
      subtasks.forEach(subtask => {
        expect(subtask.sender_email).toBe('testsender@example.com');
      });
    });
  });

  describe('processAllocatedSubTasks - 发送处理', () => {
    it('应该正确处理已分配的SubTask', async () => {
      // 创建已分配的SubTask
      const task = await Task.create({
        name: '发送测试任务',
        user_id: testUser.id,
        status: 'sending'
      });

      const subtask = await SubTask.create({
        task_id: task.id,
        contact_id: testContacts[0].id,
        template_id: testTemplateSet.id,
        service_id: testEmailService.id,
        sender_email: 'testsender@example.com',
        recipient_email: 'user1@test.com',
        rendered_subject: 'Test Subject',
        rendered_body: 'Test Body',
        status: 'allocated',
        scheduled_at: new Date(),
        allocated_quota: 1
      });

      const result = await taskScheduler.processAllocatedSubTasks(10);

      expect(result.sent).toBe(1);
      expect(result.failed).toBe(0);

      // 验证SubTask状态更新
      const sentSubTask = await SubTask.findByPk(subtask.id);
      expect(sentSubTask.status).toBe('sent');
    });
  });

  describe('模板渲染功能', () => {
    it('应该正确渲染模板变量', async () => {
      const contact = { name: 'John', email: 'john@test.com' };
      const template = 'Hello {{name}}, your email is {{email}}';

      const rendered = taskScheduler.renderTemplate(template, contact);
      
      expect(rendered).toBe('Hello John, your email is john@test.com');
    });

    it('缺少变量时应该保持原样', async () => {
      const contact = { name: 'John' };
      const template = 'Hello {{name}}, your email is {{email}}';

      const rendered = taskScheduler.renderTemplate(template, contact);
      
      expect(rendered).toBe('Hello John, your email is {{email}}');
    });
  });
}); 