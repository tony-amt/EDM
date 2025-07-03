const express = require('express');
const router = express.Router();
const {
  getAllConfigs,
  getQueueConfigs,
  updateConfig,
  updateConfigs,
  createConfig,
  deleteConfig,
  resetConfig
} = require('../controllers/systemConfig.controller');

// 导入认证中间件
let authMiddleware;
let requireAdmin;

try {
  const authModule = require('../middlewares/auth.middleware');
  authMiddleware = authModule.protect; // 使用完整的protect中间件，它会设置req.user

  // 验证管理员权限的中间件
  requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '仅管理员可访问系统配置'
      });
    }
    next();
  };
} catch (error) {
  // 开发环境fallback：模拟认证中间件
  console.warn('⚠️ 认证中间件加载失败，使用开发模式:', error.message);

  authMiddleware = (req, res, next) => {
    // 开发环境：检查是否有测试token
    const token = req.headers.authorization;
    if (token && token.includes('dev-permanent-test-token-admin')) {
      req.user = {
        id: '00000000-0000-0000-0000-000000000001', // 使用合适的UUID格式
        role: 'admin',
        username: 'admin',
        _isDevelopmentMode: true
      };
    } else {
      return res.status(401).json({
        success: false,
        message: '开发环境需要测试token'
      });
    }
    next();
  };

  requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '仅管理员可访问系统配置'
      });
    }
    next();
  };
}

// 所有路由都需要认证
router.use(authMiddleware);

/**
 * @route GET /api/system-config
 * @desc 获取所有系统配置
 * @access Admin
 */
router.get('/', requireAdmin, getAllConfigs);

/**
 * @route GET /api/system-config/queue
 * @desc 获取队列相关配置
 * @access Admin
 */
router.get('/queue', requireAdmin, getQueueConfigs);

/**
 * @route POST /api/system-config
 * @desc 创建新的系统配置
 * @access Admin
 */
router.post('/', requireAdmin, createConfig);

/**
 * @route PUT /api/system-config/batch
 * @desc 批量更新系统配置
 * @access Admin
 */
router.put('/batch', requireAdmin, updateConfigs);

/**
 * @route PUT /api/system-config/:key
 * @desc 更新单个系统配置
 * @access Admin
 */
router.put('/:key', requireAdmin, updateConfig);

/**
 * @route PUT /api/system-config/:key/reset
 * @desc 重置配置为默认值
 * @access Admin
 */
router.put('/:key/reset', requireAdmin, resetConfig);

/**
 * @route DELETE /api/system-config/:key
 * @desc 删除系统配置
 * @access Admin
 */
router.delete('/:key', requireAdmin, deleteConfig);

module.exports = router; 