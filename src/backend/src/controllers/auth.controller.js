const db = require('../models');
const { User } = db;
const jwt = require('jsonwebtoken');
const { Op } = db.Sequelize;
const logger = require('../utils/logger');
const config = require('../config');

/**
 * 用户注册
 */
exports.register = async (req, res) => {
  try {
    const { username, email, password, name, role } = req.body;

    // 基本字段验证
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: { message: '用户名、邮箱和密码不能为空' }
      });
    }

    // 检查用户名和邮箱是否已存在
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { username },
          { email }
        ]
      }
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: { message: '用户名或邮箱已存在' }
      });
    }

    // 创建新用户
    const user = await User.create({
      username,
      email,
      password_hash: password,
      role: role || 'operator',
    });
    
    // Exclude password_hash from the response if user object is returned
    const userResponse = { ...user.toJSON() };
    delete userResponse.password_hash;

    res.status(201).json({
      success: true,
      message: '用户注册成功',
      data: userResponse
    });
  } catch (error) {
    logger.error(`用户注册失败: ${error.message}`);
    logger.error(error.stack);
    res.status(500).json({
      success: false,
      error: { message: '服务器错误，请稍后再试' }
    });
  }
};

/**
 * 用户登录
 */
exports.login = async (req, res) => {
  console.log('login req.body:', req.body);
  try {
    const { usernameOrEmail, password } = req.body;

    // 查询用户
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { username: usernameOrEmail },
          { email: usernameOrEmail }
        ]
      }
    });
    
    // 检查用户是否存在
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { message: '用户名/邮箱或密码错误' }
      });
    }

    // 检查用户是否激活
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        error: { message: '用户账户未激活或已被禁用' }
      });
    }

    // 验证密码
    const isPasswordValid = await user.isValidPassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: { message: '用户名/邮箱或密码错误' }
      });
    }

    // 生成JWT令牌
    const token = jwt.sign(
      { id: user.id, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    
    // Exclude password_hash from the response
    const userResponse = { ...user.toJSON() };
    delete userResponse.password_hash;

    res.json({
      success: true,
      token,
      data: userResponse
    });
  } catch (error) {
    logger.error(`用户登录失败: ${error.message}`);
    logger.error(error.stack);
    res.status(500).json({
      success: false,
      error: { message: '服务器错误，请稍后再试' }
    });
  }
};

/**
 * 获取当前用户信息
 */
exports.getMe = async (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      error: { message: '用户未认证' }
    });
  }

  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password_hash'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: '用户不存在' }
      });
    }
    
    if (!user.is_active) {
        return res.status(403).json({
            success: false,
            error: { message: '用户账户未激活或已被禁用' }
        });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error(`获取用户信息失败: ${error.message}`);
    logger.error(error.stack);
    res.status(500).json({
      success: false,
      error: { message: '服务器错误，请稍后再试' }
    });
  }
};

/**
 * 修改密码
 * @route PUT /api/auth/password
 */
exports.changePassword = async (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      error: { message: '用户未认证' }
    });
  }

  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({
            success: false,
            error: { message: '当前密码和新密码不能为空' }
        });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({
            success: false,
            error: { message: '新密码长度不能少于6位' }
        });
    }

    // 获取用户
    const user = await User.findByPk(req.user.id);

    if (!user) {
        return res.status(404).json({
            success: false,
            error: { message: '用户不存在' }
        });
    }

    // 验证当前密码
    if (!(await user.isValidPassword(currentPassword))) {
      return res.status(400).json({
        success: false,
        error: { message: '当前密码错误' }
      });
    }

    // 更新密码 (Sequelize hook will hash it)
    user.password_hash = newPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: '密码修改成功'
    });
  } catch (error) {
    logger.error(`修改密码失败: ${error.message}`);
    logger.error(error.stack);
    return res.status(500).json({
      success: false,
      error: { message: '服务器错误，请稍后重试' }
    });
  }
}; 