const jwt = require('jsonwebtoken');
const db = require('../models'); // Updated import
const { User } = db; // Destructure User from db
const config = require('../config');
const logger = require('../utils/logger'); // Assuming logger is a default export

// 从配置中获取JWT密钥 - 测试环境特殊处理
const JWT_SECRET = process.env.NODE_ENV === 'test' 
  ? (process.env.JWT_SECRET || 'test-jwt-secret') 
  : config.jwt.secret;

// 永久测试Token - 仅在开发环境使用
const PERMANENT_TEST_TOKEN = 'dev-permanent-test-token-admin-2025';
const TEST_ADMIN_USER = {
  id: '97b42886-778a-4495-9f18-07e382794a2a',
  username: 'admin',
  email: 'admin@example.com',
  role: 'admin',
  is_active: true,
  remaining_quota: 1000
};

/**
 * 保护路由中间件 (protect)
 * 验证JWT，并将完整的User对象(排除密码)附加到 req.user
 */
exports.protect = async (req, res, next) => {
  let token;
  try {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // DEBUG: Log received token and secret used for verification
    console.log('ℹ️ [AUTH_MIDDLEWARE_DEBUG] Received token:', token);
    console.log('ℹ️ [AUTH_MIDDLEWARE_DEBUG] Secret used for verification:', JWT_SECRET);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: { message: '未授权，请登录 (Token not found)' } // Consistent error format
      });
    }

    // 🔧 开发环境永久测试Token支持
    if (process.env.NODE_ENV === 'development' && token === PERMANENT_TEST_TOKEN) {
      console.log('✅ [AUTH_MIDDLEWARE] 使用永久测试Token，跳过JWT验证');
      req.user = TEST_ADMIN_USER;
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password_hash'] } // Use password_hash
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { message: '用户不存在或Token关联的用户无效' }
      });
    }

    if (!user.is_active) { // Use is_active
      return res.status(403).json({ // 403 Forbidden as user exists but is not allowed
        success: false,
        error: { message: '账号已被禁用，请联系管理员' }
      });
    }

    req.user = user; // Attach full user object (without password_hash)
    next();

  } catch (error) {
    logger.error(`认证保护中间件错误: ${error.message}`);
    logger.error(error.stack);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, error: { message: '无效的令牌' } });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: { message: '令牌已过期' } });
    } else {
      return res.status(401).json({ 
        success: false, 
        error: { message: '未授权，请重新登录' } 
      }); // General auth error if not JWT specific
    }
  }
};

/**
 * 角色权限中间件 (authorize)
 * 必须在 protect 中间件之后使用，因为它依赖 req.user
 * @param {...String} roles - 允许访问的角色列表 (e.g., 'admin', 'operator')
 */
exports.authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) { // req.user should be populated by 'protect' middleware
      return res.status(401).json({
        success: false,
        error: { message: '未授权，用户信息不完整' }
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: { message: '权限不足，无法访问此资源' }
      });
    }
    next();
  };
};


/**
 * 轻量级认证中间件 (authMiddleware)
 * 验证JWT并仅将解码后的 userId 附加到 req.userId。
 * 注意：此中间件不附加完整的用户对象，也不检查用户激活状态。
 * `authorize` 中间件不能与此中间件一起使用，因为它需要 req.user.role。
 */
exports.authMiddleware = async (req, res, next) => {
  let token;
  try {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: { message: '未提供认证令牌 (轻量级检查)' }
      });
    }

    // 🔧 开发环境永久测试Token支持
    if (process.env.NODE_ENV === 'development' && token === PERMANENT_TEST_TOKEN) {
      console.log('✅ [AUTH_MIDDLEWARE_LIGHT] 使用永久测试Token');
      req.userId = TEST_ADMIN_USER.id;
      return next();
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id; // Attach only userId
    // req.userRole = decoded.role; // Optionally attach role if it's in JWT and needed without full user object
    
    next();
  } catch (error) {
    logger.error(`轻量级认证中间件失败: ${error.message}`);
    // No stack trace for potentially frequent errors like invalid token
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, error: { message: '无效的认证令牌' } });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: { message: '认证令牌已过期' } });
    } else {
      return res.status(401).json({ 
        success: false, 
        error: { message: '认证令牌处理失败' } 
      });
    }
  }
};

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: { message: '需要管理员权限' } });
  }
  next();
}

module.exports = {
  verifyToken: exports.protect,
  protect: exports.protect,
  authorize: exports.authorize,
  authMiddleware: exports.authMiddleware,
  requireAdmin
};