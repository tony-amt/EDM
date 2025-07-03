/**
 * Phase 3 测试路由
 * 用于验证标签系统JSONB优化功能
 */

const express = require('express');
const router = express.Router();
const phase3TestController = require('../controllers/phase3Test.controller');
const { protect } = require('../middlewares/auth.middleware');

// 所有路由都需要认证
router.use(protect);

/**
 * @route GET /api/test/phase3/status
 * @desc 获取Phase 3优化状态概览
 * @access Private
 */
router.get('/status', phase3TestController.getPhase3Status);

/**
 * @route GET /api/test/phase3/reverse-query
 * @desc 测试反向查询功能
 * @access Private
 */
router.get('/reverse-query', phase3TestController.testReverseQuery);

/**
 * @route GET /api/test/phase3/data-consistency
 * @desc 验证数据一致性
 * @access Private
 */
router.get('/data-consistency', phase3TestController.testDataConsistency);

/**
 * @route GET /api/test/phase3/contact-list
 * @desc 测试联系人列表功能（使用反向查询）
 * @access Private
 */
router.get('/contact-list', phase3TestController.testContactList);

module.exports = router; 