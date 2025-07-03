/**
 * V2.0 发信服务管理路由
 */
const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../middlewares/auth.middleware');
const { 
  getEmailServices, 
  getEmailServiceById,
  createEmailService,
  updateEmailService,
  deleteEmailService,
  testEmailService,
  testEmailServiceConfig
} = require('../controllers/emailService.controller');

/**
 * 获取发信服务列表
 */
router.get('/', verifyToken, getEmailServices);

/**
 * 获取发信服务详情
 */
router.get('/:id', verifyToken, getEmailServiceById);

/**
 * 创建发信服务 (仅管理员)
 */
router.post('/', verifyToken, requireAdmin, createEmailService);

/**
 * 更新发信服务 (仅管理员)
 */
router.put('/:id', verifyToken, requireAdmin, updateEmailService);

/**
 * 删除发信服务 (仅管理员)
 */
router.delete('/:id', verifyToken, requireAdmin, deleteEmailService);

/**
 * 测试发信服务连通性
 */
router.post('/:id/test', verifyToken, requireAdmin, testEmailService);

/**
 * 测试邮件服务配置（创建前测试）
 */
router.post('/test-connection', verifyToken, requireAdmin, testEmailServiceConfig);

module.exports = router; 