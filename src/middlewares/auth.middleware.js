const jwt = require('jsonwebtoken');
const { User } = require('../models');
const config = require('../config');

/**
 * 测试模式标志 - 仅用于测试环境
 */
let isTestMode = false;

/**
 * 设置测试模式 - 仅用于测试
 * @param {boolean} mode 是否启用测试模式
 */
exports.setTestMode = (mode) => {
  isTestMode = mode;
};

/**
 * 保护路由中间件 - 验证用户是否已登录
 */
exports.protect = async (req, res, next) => {
  try {
    // 检查请求头中是否包含Authorization
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      // 从Bearer token中提取token部分
      token = req.headers.authorization.split(' ')[1];
    }

    // 如果没有token
    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未授权，请登录'
      });
    }

    try {
      // 验证token
      const decoded = jwt.verify(token, config.jwt.secret);

      // 检查用户是否存在
      const user = await User.findById(decoded.id);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: '用户不存在或已被禁用'
        });
      }

      // 检查用户是否处于激活状态
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: '账号已被禁用，请联系管理员'
        });
      }

      // 将用户信息添加到请求对象
      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: '无效的令牌，请重新登录'
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * 授权中间件 - 检查用户是否有特定角色权限
 * @param {...String} roles - 允许访问的角色列表
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    // 检查req.user是否存在，如果之前没有经过protect中间件，则req.user不存在
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '未授权，请登录'
      });
    }

    // 检查用户角色是否在允许的角色列表中
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: '权限不足，无法访问此资源'
      });
    }

    next();
  };
}; 