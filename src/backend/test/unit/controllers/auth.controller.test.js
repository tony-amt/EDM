const { User, sequelize } = require('../../../src/models');
const authController = require('../../../src/controllers/auth.controller');
const jwt = require('jsonwebtoken');
const config = require('../../../src/config');

// 模拟请求和响应对象
const mockRequest = (body = {}, params = {}, user = {}) => ({
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

describe('Auth Controller', () => {
  let testUser;
  
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });
  
  afterAll(async () => {
    await User.destroy({ where: {}, truncate: true, cascade: true });
    await sequelize.close();
  });
  
  beforeEach(async () => {
    // 创建一个测试用户
    testUser = await User.create({
      username: 'testauth',
      email: 'testauth@example.com',
      password: 'password123',
      name: 'Test Auth User',
      role: 'user'
    });
  });
  
  afterEach(async () => {
    await User.destroy({ where: {}, truncate: true, cascade: true });
  });
  
  describe('register', () => {
    test('应该成功注册新用户', async () => {
      const req = mockRequest({
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User'
      });
      const res = mockResponse();
      
      await authController.register(req, res);
      
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.any(String)
        })
      );
      
      // 验证用户是否已创建
      const user = await User.findOne({ where: { username: 'newuser' } });
      expect(user).toBeDefined();
      expect(user.email).toBe('newuser@example.com');
    });
    
    test('注册重复用户名应该失败', async () => {
      const req = mockRequest({
        username: 'testauth', // 已存在的用户名
        email: 'different@example.com',
        password: 'password123',
        name: 'Duplicate User'
      });
      const res = mockResponse();
      
      await authController.register(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.any(String)
        })
      );
    });
  });
  
  describe('login', () => {
    test('应该使用正确凭据登录成功', async () => {
      const req = mockRequest({
        username: 'testauth',
        password: 'password123'
      });
      const res = mockResponse();
      
      await authController.login(req, res);
      
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          token: expect.any(String),
          user: expect.objectContaining({
            id: testUser.id,
            username: 'testauth'
          })
        })
      );
      
      // 验证返回的令牌
      const { token } = res.json.mock.calls[0][0];
      const decoded = jwt.verify(token, config.jwt.secret);
      expect(decoded.id).toBe(testUser.id);
    });
    
    test('使用错误密码应该登录失败', async () => {
      const req = mockRequest({
        username: 'testauth',
        password: 'wrongpassword'
      });
      const res = mockResponse();
      
      await authController.login(req, res);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.any(String)
        })
      );
    });
    
    test('不存在的用户应该登录失败', async () => {
      const req = mockRequest({
        username: 'nonexistentuser',
        password: 'password123'
      });
      const res = mockResponse();
      
      await authController.login(req, res);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.any(String)
        })
      );
    });
  });
  
  describe('getMe', () => {
    test('应该返回当前用户信息', async () => {
      const req = { userId: testUser.id };
      const res = mockResponse();
      
      await authController.getMe(req, res);
      
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: testUser.id,
            username: 'testauth',
            email: 'testauth@example.com'
          })
        })
      );
    });
    
    test('不存在的用户ID应该返回错误', async () => {
      const req = { userId: 999999 }; // 不存在的ID
      const res = mockResponse();
      
      await authController.getMe(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.any(String)
        })
      );
    });
  });
  
  describe('changePassword', () => {
    test('应该成功更改密码', async () => {
      const req = mockRequest(
        {
          currentPassword: 'password123',
          newPassword: 'newpassword123'
        },
        {},
        { id: testUser.id }
      );
      const res = mockResponse();
      
      await authController.changePassword(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.any(String)
        })
      );
      
      // 验证密码是否已更改
      const updatedUser = await User.findByPk(testUser.id);
      const isValidPassword = await updatedUser.comparePassword('newpassword123');
      expect(isValidPassword).toBe(true);
    });
    
    test('当前密码错误应该失败', async () => {
      const req = mockRequest(
        {
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123'
        },
        {},
        { id: testUser.id }
      );
      const res = mockResponse();
      
      await authController.changePassword(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.any(String)
        })
      );
    });
  });
}); 