/**
 * V2.0 用户服务映射管理路由
 */
const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../middlewares/auth.middleware');
const { 
  getUserServiceMappings,
  createUserServiceMapping,
  updateUserServiceMapping,
  deleteUserServiceMapping,
  getUserEmailServices
} = require('../controllers/userServiceMapping.controller');

/**
 * 获取用户服务映射列表
 */
router.get('/', verifyToken, getUserServiceMappings);

/**
 * 创建用户服务映射 (仅管理员)
 */
router.post('/', verifyToken, requireAdmin, createUserServiceMapping);

/**
 * 更新用户服务映射 (仅管理员)
 */
router.put('/:id', verifyToken, requireAdmin, updateUserServiceMapping);

/**
 * 删除用户服务映射 (仅管理员)
 */
router.delete('/:id', verifyToken, requireAdmin, deleteUserServiceMapping);

/**
 * 获取用户的发信服务
 */
router.get('/user/:user_id/services', verifyToken, getUserEmailServices);

module.exports = router;
