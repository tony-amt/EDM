/**
 * 临时认证中间件
 * 用于内部团队使用，跳过复杂的用户认证流程
 */

// 临时用户ID
const TEMP_USER_ID = '650a0c7b9a0f4c2b8d1e3f5a'; // 示例ObjectId

/**
 * 临时认证中间件
 * 自动为所有请求添加一个内部团队用户身份
 */
exports.tempProtect = (req, res, next) => {
  // 为请求添加一个默认的内部用户
  req.user = {
    _id: TEMP_USER_ID,
    username: 'internal',
    email: 'internal@example.com',
    role: 'admin', // 内部团队默认拥有管理员权限
    isActive: true
  };
  
  next();
};

/**
 * 临时角色权限中间件
 * 由于是内部团队使用，所有人都具有完整权限
 */
exports.tempAuthorize = (...roles) => {
  return (req, res, next) => {
    // 内部团队默认拥有所有权限
    next();
  };
}; 