const express = require('express');
const { protect, authorize } = require('../middlewares/auth.middleware');
const { body, query, param } = require('express-validator');
const validate = require('../middlewares/validation.middleware');
const quotaController = require('../controllers/quota.controller');

const router = express.Router();

// 所有路由都需要管理员权限
router.use(protect);
router.use(authorize('admin'));

/**
 * @route   GET /api/quota/users
 * @desc    获取所有用户的额度信息
 * @access  Private/Admin
 */
router.get('/users', [
  query('status')
    .optional()
    .customSanitizer(value => value === '' ? undefined : value)
    .isIn(['active', 'inactive'])
    .withMessage('Invalid status filter'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  validate
], quotaController.getUserQuotas);

/**
 * @route   GET /api/quota/history
 * @desc    获取额度历史记录
 * @access  Private/Admin
 */
router.get('/history', [
  query('userId')
    .optional()
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
  
  query('operation')
    .optional()
    .customSanitizer(value => value === '' ? undefined : value)
    .isIn(['allocate', 'deduct', 'refund', 'cancel'])
    .withMessage('Invalid operation filter'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  validate
], quotaController.getQuotaHistory);

/**
 * @route   PATCH /api/quota/users/:id
 * @desc    调整用户额度
 * @access  Private/Admin
 */
router.patch('/users/:id', [
  param('id')
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
  
  body('operation')
    .isIn(['add', 'subtract', 'set'])
    .withMessage('Operation must be add, subtract, or set'),
  
  body('amount')
    .isInt({ min: 1 })
    .withMessage('Amount must be a positive integer'),
  
  body('reason')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Reason must be a string with max 500 characters'),
  
  validate
], quotaController.adjustUserQuota);

/**
 * @route   POST /api/quota/batch-adjust
 * @desc    批量调整用户额度
 * @access  Private/Admin
 */
router.post('/batch-adjust', [
  body('userIds')
    .isArray({ min: 1 })
    .withMessage('User IDs array is required'),
  
  body('userIds.*')
    .isUUID()
    .withMessage('All user IDs must be valid UUIDs'),
  
  body('operation')
    .isIn(['add', 'subtract', 'set'])
    .withMessage('Operation must be add, subtract, or set'),
  
  body('amount')
    .isInt({ min: 1 })
    .withMessage('Amount must be a positive integer'),
  
  body('reason')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Reason must be a string with max 500 characters'),
  
  validate
], quotaController.batchAdjustQuota);

module.exports = router; 