const { Contact, Tag, User, sequelize } = require('../../../src/models');
const contactController = require('../../../src/controllers/contact.controller');
const fs = require('fs');
const path = require('path');

// 模拟请求和响应对象
const mockRequest = (query = {}, body = {}, params = {}, user = {}, file = null) => ({
  query,
  body,
  params,
  user,
  file
});

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.write = jest.fn();
  res.end = jest.fn();
  res.setHeader = jest.fn();
  return res;
};

describe('Contact Controller', () => {
  let testUser;
  let testTag;
  let testContact;
  
  beforeAll(async () => {
    await sequelize.sync({ force: true });
    
    // 创建测试用户
    testUser = await User.create({
      username: 'contacttest',
      email: 'contacttest@example.com',
      password: 'password123',
      name: 'Contact Test User',
      role: 'user'
    });
    
    // 创建测试标签
    testTag = await Tag.create({
      name: '测试标签',
      color: '#FF5733',
      createdById: testUser.id
    });
  });
  
  afterAll(async () => {
    await Contact.destroy({ where: {}, truncate: true, cascade: true });
    await Tag.destroy({ where: {}, truncate: true, cascade: true });
    await User.destroy({ where: {}, truncate: true, cascade: true });
    await sequelize.close();
  });
  
  beforeEach(async () => {
    // 创建测试联系人
    testContact = await Contact.create({
      email: 'test@example.com',
      username: '测试用户',
      source: 'manual',
      status: 'active',
      createdById: testUser.id
    });
    
    // 添加标签
    await testContact.addTag(testTag);
  });
  
  afterEach(async () => {
    await Contact.destroy({ where: {}, truncate: true, cascade: true });
  });
  
  describe('getContacts', () => {
    test('应该获取所有联系人', async () => {
      // 创建额外的联系人
      await Contact.create({
        email: 'another@example.com',
        username: '另一个用户',
        createdById: testUser.id
      });
      
      const req = mockRequest({}, {}, {}, { id: testUser.id });
      const res = mockResponse();
      
      await contactController.getContacts(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({ email: 'test@example.com' }),
            expect.objectContaining({ email: 'another@example.com' })
          ]),
          pagination: expect.objectContaining({
            page: 1,
            limit: 50
          })
        })
      );
    });
    
    test('应该支持分页', async () => {
      // 创建10个额外联系人
      for (let i = 0; i < 10; i++) {
        await Contact.create({
          email: `user${i}@example.com`,
          username: `用户${i}`,
          createdById: testUser.id
        });
      }
      
      const req = mockRequest(
        { page: 2, limit: 5 },
        {},
        {},
        { id: testUser.id }
      );
      const res = mockResponse();
      
      await contactController.getContacts(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          pagination: expect.objectContaining({
            page: 2,
            limit: 5,
            total: expect.any(Number)
          })
        })
      );
      
      // 验证返回的数据长度
      const data = res.json.mock.calls[0][0].data;
      expect(data.length).toBeLessThanOrEqual(5);
    });
    
    test('应该支持搜索联系人', async () => {
      // 创建特殊联系人
      await Contact.create({
        email: 'special@example.com',
        username: '特殊用户',
        createdById: testUser.id
      });
      
      const req = mockRequest(
        { search: 'special' },
        {},
        {},
        { id: testUser.id }
      );
      const res = mockResponse();
      
      await contactController.getContacts(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({ email: 'special@example.com' })
          ])
        })
      );
      
      // 验证结果不包含其他联系人
      const data = res.json.mock.calls[0][0].data;
      const emails = data.map(contact => contact.email);
      expect(emails).not.toContain('test@example.com');
    });
    
    test('应该支持按标签筛选联系人', async () => {
      // 创建第二个标签
      const secondTag = await Tag.create({
        name: '第二标签',
        color: '#33FF57',
        createdById: testUser.id
      });
      
      // 创建带有第二个标签的联系人
      const secondContact = await Contact.create({
        email: 'tagged@example.com',
        username: '带标签用户',
        createdById: testUser.id
      });
      
      await secondContact.setTags([secondTag.id]);
      
      const req = mockRequest(
        { tags: secondTag.id.toString() },
        {},
        {},
        { id: testUser.id }
      );
      const res = mockResponse();
      
      await contactController.getContacts(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({ email: 'tagged@example.com' })
          ])
        })
      );
      
      // 验证结果不包含其他联系人
      const data = res.json.mock.calls[0][0].data;
      const emails = data.map(contact => contact.email);
      expect(emails).not.toContain('test@example.com');
      
      // 清理
      await secondTag.destroy();
    });
  });
  
  describe('getContact', () => {
    test('应该获取单个联系人', async () => {
      const req = mockRequest(
        {},
        {},
        { id: testContact.id },
        { id: testUser.id }
      );
      const res = mockResponse();
      
      await contactController.getContact(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: testContact.id,
            email: 'test@example.com',
            username: '测试用户',
            Tags: expect.arrayContaining([
              expect.objectContaining({ id: testTag.id })
            ])
          })
        })
      );
    });
    
    test('不存在的联系人ID应该返回错误', async () => {
      const req = mockRequest(
        {},
        {},
        { id: 999999 }, // 不存在的ID
        { id: testUser.id }
      );
      const res = mockResponse();
      
      await contactController.getContact(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.any(String)
        })
      );
    });
  });
  
  describe('createContact', () => {
    test('应该创建新联系人', async () => {
      const req = mockRequest(
        {},
        {
          email: 'new@example.com',
          username: '新联系人',
          company: '测试公司',
          tags: [testTag.id]
        },
        {},
        { id: testUser.id }
      );
      const res = mockResponse();
      
      await contactController.createContact(req, res);
      
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            email: 'new@example.com',
            username: '新联系人',
            company: '测试公司',
            Tags: expect.arrayContaining([
              expect.objectContaining({ id: testTag.id })
            ])
          })
        })
      );
      
      // 验证联系人是否已创建
      const contact = await Contact.findOne({
        where: { email: 'new@example.com' },
        include: [Tag]
      });
      expect(contact).toBeDefined();
      // 🚀 Phase 3修复: 使用反向查询验证标签关联
      const tagWithContacts = await Tag.findByPk(testTag.id);
      expect(tagWithContacts.contacts).toContain(contact.id);
      
      // 验证标签计数是否已更新
      const updatedTag = await Tag.findByPk(testTag.id);
      expect(updatedTag.count).toBe(2); // 测试联系人和新联系人
    });
    
    test('创建重复邮箱联系人应该失败', async () => {
      const req = mockRequest(
        {},
        {
          email: 'test@example.com', // 已存在的邮箱
          username: '重复联系人'
        },
        {},
        { id: testUser.id }
      );
      const res = mockResponse();
      
      await contactController.createContact(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.any(String)
        })
      );
    });
  });
  
  describe('updateContact', () => {
    test('应该更新联系人', async () => {
      const req = mockRequest(
        {},
        {
          username: '更新后的用户',
          company: '新公司',
          tags: [testTag.id]
        },
        { id: testContact.id },
        { id: testUser.id }
      );
      const res = mockResponse();
      
      await contactController.updateContact(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: testContact.id,
            username: '更新后的用户',
            company: '新公司'
          })
        })
      );
      
      // 验证联系人是否已更新
      const updatedContact = await Contact.findByPk(testContact.id);
      expect(updatedContact.username).toBe('更新后的用户');
      expect(updatedContact.company).toBe('新公司');
    });
    
    test('不存在的联系人ID应该返回错误', async () => {
      const req = mockRequest(
        {},
        { username: '更新失败' },
        { id: 999999 }, // 不存在的ID
        { id: testUser.id }
      );
      const res = mockResponse();
      
      await contactController.updateContact(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.any(String)
        })
      );
    });
    
    test('应该更新联系人标签', async () => {
      // 创建第二个标签
      const secondTag = await Tag.create({
        name: '第二标签',
        color: '#33FF57',
        createdById: testUser.id
      });
      
      const req = mockRequest(
        {},
        {
          tags: [secondTag.id] // 更换标签
        },
        { id: testContact.id },
        { id: testUser.id }
      );
      const res = mockResponse();
      
      await contactController.updateContact(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      
      // 🚀 Phase 3修复: 使用反向查询验证标签关联
      const oldTagWithContacts = await Tag.findByPk(testTag.id);
      const newTagWithContacts = await Tag.findByPk(secondTag.id);
      
      expect(oldTagWithContacts.contacts || []).not.toContain(testContact.id);
      expect(newTagWithContacts.contacts || []).toContain(testContact.id);
      
      // 验证标签计数是否已更新
      const originalTag = await Tag.findByPk(testTag.id);
      const newTag = await Tag.findByPk(secondTag.id);
      
      expect(originalTag.count).toBe(0);
      expect(newTag.count).toBe(1);
      
      // 清理
      await secondTag.destroy();
    });
  });
  
  describe('deleteContact', () => {
    test('应该删除联系人', async () => {
      const req = mockRequest(
        {},
        {},
        { id: testContact.id },
        { id: testUser.id }
      );
      const res = mockResponse();
      
      await contactController.deleteContact(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.any(String)
        })
      );
      
      // 验证联系人是否已删除
      const deletedContact = await Contact.findByPk(testContact.id);
      expect(deletedContact).toBeNull();
      
      // 验证标签计数是否已更新
      const updatedTag = await Tag.findByPk(testTag.id);
      expect(updatedTag.count).toBe(0);
    });
    
    test('不存在的联系人ID应该返回错误', async () => {
      const req = mockRequest(
        {},
        {},
        { id: 999999 }, // 不存在的ID
        { id: testUser.id }
      );
      const res = mockResponse();
      
      await contactController.deleteContact(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.any(String)
        })
      );
    });
  });
  
  describe('exportContacts', () => {
    test('应该导出联系人', async () => {
      const req = mockRequest({}, {}, {}, { id: testUser.id });
      const res = mockResponse();
      
      await contactController.exportContacts(req, res);
      
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename=contacts.csv'
      );
      expect(res.write).toHaveBeenCalled();
      expect(res.end).toHaveBeenCalled();
    });
  });
}); 