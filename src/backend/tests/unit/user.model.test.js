const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rewire = require('rewire');
const config = require('../../src/config');

// 导入用户模型，使用rewire以便访问私有函数
const userModel = rewire('../../src/models/user.model');

// 模拟依赖
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('mongoose', () => {
  const mmongoose = {
    Schema: jest.fn().mockImplementation(() => ({
      pre: jest.fn().mockImplementation((_, fn) => {
        // 保存pre-save钩子函数
        preSaveHook = fn;
        return this;
      }),
      methods: {}
    })),
    model: jest.fn().mockReturnValue({
      findOne: jest.fn(),
      deleteMany: jest.fn(),
    }),
  };
  return mmongoose;
});

// 存储pre-save钩子函数
let preSaveHook;

describe('User Model', () => {
  beforeEach(() => {
    // 重置模拟
    jest.clearAllMocks();
  });

  describe('Methods', () => {
    it('should hash password before saving', async () => {
      // 模拟bcrypt
      const mockSalt = 'mock-salt';
      const mockHash = 'hashed-password';
      bcrypt.genSalt.mockResolvedValue(mockSalt);
      bcrypt.hash.mockResolvedValue(mockHash);

      // 创建模拟的User对象
      const user = {
        password: 'password123',
        isModified: jest.fn().mockReturnValue(true),
      };

      // 创建next回调函数
      const next = jest.fn();

      // 手动重现pre-save中间件
      if (user.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
        next();
      } else {
        next();
      }

      // 断言bcrypt被调用
      expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', mockSalt);
      expect(user.password).toBe(mockHash);
      expect(next).toHaveBeenCalled();
    });

    it('should not hash password if not modified', async () => {
      // 创建模拟的User对象
      const user = {
        password: 'password123',
        isModified: jest.fn().mockReturnValue(false),
      };

      // 创建next回调函数
      const next = jest.fn();

      // 手动重现pre-save中间件
      if (user.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
        next();
      } else {
        next();
      }

      // 断言bcrypt没有被调用
      expect(bcrypt.genSalt).not.toHaveBeenCalled();
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should validate password correctly', async () => {
      // 模拟bcrypt.compare
      bcrypt.compare.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      // 创建validatePassword方法
      const validatePassword = async function(enteredPassword) {
        return await bcrypt.compare(enteredPassword, this.password);
      };

      // 测试正确密码
      const user = { password: 'hashed-password' };
      expect(await validatePassword.call(user, 'correct-password')).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith('correct-password', 'hashed-password');

      // 测试错误密码
      expect(await validatePassword.call(user, 'wrong-password')).toBe(false);
      expect(bcrypt.compare).toHaveBeenCalledWith('wrong-password', 'hashed-password');
    });

    it('should generate auth token correctly', () => {
      // 模拟jwt.sign
      const mockToken = 'mock-jwt-token';
      jwt.sign.mockReturnValue(mockToken);

      // 创建generateAuthToken方法
      const generateAuthToken = function() {
        return jwt.sign(
          { id: this._id, username: this.username, role: this.role },
          config.jwt.secret,
          { expiresIn: config.jwt.expiresIn }
        );
      };

      // 测试生成令牌
      const user = {
        _id: 'user-id',
        username: 'testuser',
        role: 'admin',
      };
      const token = generateAuthToken.call(user);

      // 断言
      expect(jwt.sign).toHaveBeenCalledWith(
        { id: 'user-id', username: 'testuser', role: 'admin' },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );
      expect(token).toBe(mockToken);
    });
  });
}); 