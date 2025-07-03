const express = require('express');
const router = express.Router();
const TagOptimizationController = require('../controllers/tagOptimization.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

/**
 * 标签系统优化路由 - Phase 3
 * 专门用于管理标签系统JSONB优化过程
 */

// 应用认证中间件
router.use(authMiddleware);

/**
 * @route GET /api/tag-optimization/status
 * @desc 获取标签系统优化状态概览
 * @access Private
 */
router.get('/status', TagOptimizationController.getOptimizationStatus);

/**
 * @route GET /api/tag-optimization/validate-consistency
 * @desc 验证contact.tags和tag.contacts的数据一致性
 * @access Private
 */
router.get('/validate-consistency', TagOptimizationController.validateDataConsistency);

/**
 * @route POST /api/tag-optimization/sync-data
 * @desc 同步contact.tags数据到tag.contacts（数据一致性修复）
 * @access Private
 */
router.post('/sync-data', TagOptimizationController.syncContactTagsToTagContacts);

/**
 * @route GET /api/tag-optimization/performance-test
 * @desc 执行反向查询性能基准测试
 * @access Private
 */
router.get('/performance-test', TagOptimizationController.performanceTest);

/**
 * @route POST /api/tag-optimization/test-reverse-query
 * @desc 测试反向查询功能
 * @access Private
 */
router.post('/test-reverse-query', TagOptimizationController.testReverseQuery);

module.exports = router; 