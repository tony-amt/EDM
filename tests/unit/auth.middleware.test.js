// 在模块导入之前先设置mock
jest.mock('../../src/backend/src/utils/logger');

const jwt = require('jsonwebtoken');
const config = require('../../src/backend/src/config');

// 模拟User模型 - 使用Sequelize风格
const mockUser = {
  findByPk: jest.fn(),
};

const mockDb = {
  User: mockUser
};

jest.mock('../../src/backend/src/models', () => mockDb);

// 导入auth中间件 - 必须在mock之后
const authMiddleware = require('../../src/backend/src/middlewares/auth.middleware');

describe('Auth Middleware Unit Tests', () => {
  let req, res, next;

  beforeEach(() => {
    // 清除所有mock
    jest.clearAllMocks();
    
    // 准备mock对象
    req = {
      headers: {}
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    next = jest.fn();
  });

  describe('protect middleware', () => {
    test('should return 401 if no authorization header', async () => {
      await authMiddleware.protect(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: { message: expect.stringContaining('Token not found') }
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 if authorization header is not Bearer', async () => {
      req.headers.authorization = 'Basic sometoken';
      
      await authMiddleware.protect(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: { message: expect.stringContaining('Token not found') }
      });
      expect(next).not.toHaveBeenCalled();
    });
    
    test('should return 401 if JWT verification fails', async () => {
      req.headers.authorization = 'Bearer invalid-token';
      
      await authMiddleware.protect(req, res, next);
      
      // 验证响应 - 无效token应该返回401
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: { message: expect.stringMatching(/无效的令牌|未授权/) }
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 if token is expired', async () => {
      // 创建一个已过期的真实token
      const expiredToken = jwt.sign({ id: 'user-id' }, config.jwt.secret, { expiresIn: '0s' });
      req.headers.authorization = `Bearer ${expiredToken}`;
      
      // 等待确保token过期
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await authMiddleware.protect(req, res, next);
      
      // 验证响应 - 过期token应该返回401
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: { message: expect.stringMatching(/令牌已过期|过期/) }
      });
      expect(next).not.toHaveBeenCalled();
    });
    
    test('should return 401 if user not found', async () => {
      // 创建一个有效的真实token
      const validToken = jwt.sign({ id: 'user-id' }, config.jwt.secret, { expiresIn: '1h' });
      req.headers.authorization = `Bearer ${validToken}`;
      
      // Mock User.findByPk返回null
      mockUser.findByPk.mockResolvedValue(null);
      
      await authMiddleware.protect(req, res, next);
      
      // 验证数据库调用和响应
      expect(mockUser.findByPk).toHaveBeenCalledWith('user-id', {
        attributes: { exclude: ['password_hash'] }
      });
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: { message: expect.stringContaining('用户不存在') }
      });
      expect(next).not.toHaveBeenCalled();
    });
    
    test('should return 403 if user is inactive', async () => {
      // 创建一个有效的真实token
      const validToken = jwt.sign({ id: 'user-id' }, config.jwt.secret, { expiresIn: '1h' });
      req.headers.authorization = `Bearer ${validToken}`;
      
      // Mock User.findByPk返回非激活用户
      const inactiveUser = {
        id: 'user-id',
        username: 'testuser',
        is_active: false,
        role: 'operator'
      };
      mockUser.findByPk.mockResolvedValue(inactiveUser);
      
      await authMiddleware.protect(req, res, next);
      
      // 验证数据库调用和响应
      expect(mockUser.findByPk).toHaveBeenCalledWith('user-id', {
        attributes: { exclude: ['password_hash'] }
      });
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: { message: expect.stringContaining('账号已被禁用') }
      });
      expect(next).not.toHaveBeenCalled();
    });
    
    test('should call next if token is valid and user is active', async () => {
      // 创建一个有效的真实token
      const validToken = jwt.sign({ id: 'user-id' }, config.jwt.secret, { expiresIn: '1h' });
      req.headers.authorization = `Bearer ${validToken}`;
      
      // Mock User.findByPk返回激活用户
      const activeUser = {
        id: 'user-id',
        username: 'testuser',
        is_active: true,
        role: 'operator'
      };
      mockUser.findByPk.mockResolvedValue(activeUser);
      
      await authMiddleware.protect(req, res, next);
      
      // 验证数据库调用和成功流程
      expect(mockUser.findByPk).toHaveBeenCalledWith('user-id', {
        attributes: { exclude: ['password_hash'] }
      });
      expect(req.user).toEqual(activeUser);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('authorize middleware', () => {
    test('should return 401 if req.user is not set', () => {
      const authorizeMiddleware = authMiddleware.authorize('admin');
      authorizeMiddleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: { message: expect.stringContaining('用户信息不完整') }
      });
      expect(next).not.toHaveBeenCalled();
    });
    
    test('should return 403 if user role is not authorized', () => {
      req.user = {
        id: 'user-id',
        username: 'testuser',
        role: 'operator'
      };
      
      const authorizeMiddleware = authMiddleware.authorize('admin');
      authorizeMiddleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: { message: expect.stringContaining('权限不足') }
      });
      expect(next).not.toHaveBeenCalled();
    });
    
    test('should call next if user role is authorized', () => {
      req.user = {
        id: 'user-id',
        username: 'testuser',
        role: 'admin'
      };
      
      const authorizeMiddleware = authMiddleware.authorize('admin');
      authorizeMiddleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
    
    test('should support multiple allowed roles', () => {
      req.user = {
        id: 'user-id',
        username: 'testuser',
        role: 'operator'
      };
      
      const authorizeMiddleware = authMiddleware.authorize('admin', 'operator');
      authorizeMiddleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('authMiddleware (lightweight)', () => {
    test('should return 401 if no token provided', async () => {
      await authMiddleware.authMiddleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: { message: expect.stringContaining('未提供认证令牌') }
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should set req.userId if token is valid', async () => {
      // 创建一个有效的真实token
      const validToken = jwt.sign({ id: 'user-id' }, config.jwt.secret, { expiresIn: '1h' });
      req.headers.authorization = `Bearer ${validToken}`;
      
      await authMiddleware.authMiddleware(req, res, next);
      
      // 验证结果
      expect(req.userId).toBe('user-id');
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });
}); 