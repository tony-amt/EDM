const { Tag, User, sequelize } = require('../../../src/models');
const tagController = require('../../../src/controllers/tag.controller');

// 模拟请求和响应对象
const mockRequest = (query = {}, body = {}, params = {}, user = {}) => ({
  query,
  body,
  params,
  user
});

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Tag Controller', () => {
  let testUser;
  let testTag;
  
  beforeAll(async () => {
    await sequelize.sync({ force: true });
    
    // 创建测试用户
    testUser = await User.create({
      username: 'tagtest',
      email: 'tagtest@example.com',
      password: 'password123',
      name: 'Tag Test User',
      role: 'user'
    });
  });
  
  afterAll(async () => {
    await Tag.destroy({ where: {}, truncate: true, cascade: true });
    await User.destroy({ where: {}, truncate: true, cascade: true });
    await sequelize.close();
  });
  
  beforeEach(async () => {
    // 创建测试标签
    testTag = await Tag.create({
      name: '测试标签',
      color: '#FF5733',
      createdById: testUser.id
    });
  });
  
  afterEach(async () => {
    await Tag.destroy({ where: {}, truncate: true, cascade: true });
  });
  
  describe('getTags', () => {
    test('应该获取用户的所有标签', async () => {
      // 创建额外的测试标签
      await Tag.create({
        name: '另一个标签',
        color: '#33FF57',
        createdById: testUser.id
      });
      
      const req = mockRequest({}, {}, {}, { id: testUser.id });
      const res = mockResponse();
      
      await tagController.getTags(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({ name: '测试标签' }),
            expect.objectContaining({ name: '另一个标签' })
          ])
        })
      );
    });
    
    test('应该根据父标签筛选标签', async () => {
      // 创建父标签
      const parentTag = await Tag.create({
        name: '父标签',
        color: '#3366FF',
        createdById: testUser.id
      });
      
      // 创建子标签
      await Tag.create({
        name: '子标签',
        color: '#FF3366',
        parentId: parentTag.id,
        createdById: testUser.id
      });
      
      const req = mockRequest(
        { parentId: parentTag.id },
        {},
        {},
        { id: testUser.id }
      );
      const res = mockResponse();
      
      await tagController.getTags(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({ name: '子标签', parentId: parentTag.id })
          ])
        })
      );
      
      // 验证结果不包含其他标签
      const data = res.json.mock.calls[0][0].data;
      expect(data.length).toBe(1);
      expect(data[0].name).toBe('子标签');
    });
    
    test('应该支持搜索标签', async () => {
      // 创建多个测试标签
      await Tag.create({
        name: '特殊标签',
        color: '#FF00FF',
        createdById: testUser.id
      });
      
      await Tag.create({
        name: '普通标签',
        color: '#00FFFF',
        createdById: testUser.id
      });
      
      const req = mockRequest(
        { search: '特殊' },
        {},
        {},
        { id: testUser.id }
      );
      const res = mockResponse();
      
      await tagController.getTags(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({ name: '特殊标签' })
          ])
        })
      );
      
      // 验证结果不包含其他标签
      const data = res.json.mock.calls[0][0].data;
      expect(data.length).toBe(1);
      expect(data[0].name).toBe('特殊标签');
    });
  });
  
  describe('getTagTree', () => {
    test('应该构建标签树结构', async () => {
      // 创建父标签
      const parentTag = await Tag.create({
        name: '父标签',
        color: '#3366FF',
        createdById: testUser.id
      });
      
      // 创建两个子标签
      const childTag1 = await Tag.create({
        name: '子标签1',
        color: '#FF3366',
        parentId: parentTag.id,
        createdById: testUser.id
      });
      
      const childTag2 = await Tag.create({
        name: '子标签2',
        color: '#66FF33',
        parentId: parentTag.id,
        createdById: testUser.id
      });
      
      // 创建孙子标签
      await Tag.create({
        name: '孙子标签',
        color: '#33FFCC',
        parentId: childTag1.id,
        createdById: testUser.id
      });
      
      const req = mockRequest({}, {}, {}, { id: testUser.id });
      const res = mockResponse();
      
      await tagController.getTagTree(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({
              name: '测试标签',
              children: expect.any(Array)
            }),
            expect.objectContaining({
              name: '父标签',
              children: expect.arrayContaining([
                expect.objectContaining({
                  name: '子标签1',
                  children: expect.arrayContaining([
                    expect.objectContaining({
                      name: '孙子标签'
                    })
                  ])
                }),
                expect.objectContaining({
                  name: '子标签2'
                })
              ])
            })
          ])
        })
      );
    });
  });
  
  describe('createTag', () => {
    test('应该创建新标签', async () => {
      const req = mockRequest(
        {},
        {
          name: '新标签',
          color: '#AABBCC',
          description: '新标签描述'
        },
        {},
        { id: testUser.id }
      );
      const res = mockResponse();
      
      await tagController.createTag(req, res);
      
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            name: '新标签',
            color: '#AABBCC',
            description: '新标签描述',
            createdById: testUser.id
          })
        })
      );
      
      // 验证标签是否已创建
      const tag = await Tag.findOne({
        where: { name: '新标签', createdById: testUser.id }
      });
      expect(tag).toBeDefined();
      expect(tag.color).toBe('#AABBCC');
    });
    
    test('创建同名标签应该失败', async () => {
      const req = mockRequest(
        {},
        {
          name: '测试标签', // 已存在的标签名
          color: '#DDEEFF'
        },
        {},
        { id: testUser.id }
      );
      const res = mockResponse();
      
      await tagController.createTag(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.any(String)
        })
      );
    });
    
    test('应该创建带父标签的标签', async () => {
      const req = mockRequest(
        {},
        {
          name: '子标签',
          color: '#123456',
          parentId: testTag.id
        },
        {},
        { id: testUser.id }
      );
      const res = mockResponse();
      
      await tagController.createTag(req, res);
      
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            name: '子标签',
            parentId: testTag.id
          })
        })
      );
    });
  });
  
  describe('updateTag', () => {
    test('应该更新标签', async () => {
      const req = mockRequest(
        {},
        {
          name: '更新后的标签',
          color: '#654321'
        },
        { id: testTag.id },
        { id: testUser.id }
      );
      const res = mockResponse();
      
      await tagController.updateTag(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: testTag.id,
            name: '更新后的标签',
            color: '#654321'
          })
        })
      );
      
      // 验证标签是否已更新
      const updatedTag = await Tag.findByPk(testTag.id);
      expect(updatedTag.name).toBe('更新后的标签');
      expect(updatedTag.color).toBe('#654321');
    });
    
    test('不存在的标签ID应该返回错误', async () => {
      const req = mockRequest(
        {},
        { name: '更新标签' },
        { id: 999999 }, // 不存在的ID
        { id: testUser.id }
      );
      const res = mockResponse();
      
      await tagController.updateTag(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.any(String)
        })
      );
    });
  });
  
  describe('deleteTag', () => {
    test('应该删除标签', async () => {
      const req = mockRequest(
        {},
        {},
        { id: testTag.id },
        { id: testUser.id }
      );
      const res = mockResponse();
      
      await tagController.deleteTag(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.any(String)
        })
      );
      
      // 验证标签是否已删除
      const deletedTag = await Tag.findByPk(testTag.id);
      expect(deletedTag).toBeNull();
    });
    
    test('不能删除有子标签的标签', async () => {
      // 创建子标签
      await Tag.create({
        name: '子标签',
        color: '#FF3366',
        parentId: testTag.id,
        createdById: testUser.id
      });
      
      const req = mockRequest(
        {},
        {},
        { id: testTag.id },
        { id: testUser.id }
      );
      const res = mockResponse();
      
      await tagController.deleteTag(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.any(String)
        })
      );
      
      // 验证标签是否未被删除
      const notDeletedTag = await Tag.findByPk(testTag.id);
      expect(notDeletedTag).not.toBeNull();
    });
  });
  
  describe('createAutoTagRule', () => {
    test('应该创建自动标签规则', async () => {
      const req = mockRequest(
        {},
        {
          name: '自动标签',
          color: '#9900CC',
          rules: [
            {
              field: 'email',
              operator: 'contains',
              value: 'example.com'
            }
          ],
          ruleLogic: 'and'
        },
        {},
        { id: testUser.id }
      );
      const res = mockResponse();
      
      await tagController.createAutoTagRule(req, res);
      
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            name: '自动标签',
            isAuto: true,
            rules: expect.arrayContaining([
              expect.objectContaining({
                field: 'email',
                operator: 'contains',
                value: 'example.com'
              })
            ])
          })
        })
      );
    });
  });
}); 