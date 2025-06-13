const express = require('express');
const { body } = require('express-validator');
const userController = require('../controllers/user.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');
const validator = require('../middlewares/validator.middleware');

const router = express.Router();

/**
 * @route   GET /api/users
 * @desc    获取所有用户
 * @access  Private/Admin
 */
router.get('/', protect, authorize('admin'), userController.getUsers);

/**
 * @route   GET /api/users/:id
 * @desc    获取单个用户
 * @access  Private/Admin
 */
router.get('/:id', protect, authorize('admin'), userController.getUser);

/**
 * @route   POST /api/users
 * @desc    创建新用户
 * @access  Private/Admin
 */
router.post(
  '/',
  [
    protect,
    authorize('admin'),
    body('username').trim().notEmpty().withMessage('用户名为必填项').isLength({ min: 3 }).withMessage('用户名至少需要3个字符'),
    body('email').optional().isEmail().normalizeEmail().withMessage('请提供有效的邮箱地址'),
    body('password').isLength({ min: 6 }).withMessage('密码至少需要6个字符'),
    body('role').optional().isIn(['operator', 'admin', 'read_only']).withMessage('角色必须是 operator, admin, 或 read_only'),
    body('is_active').optional().isBoolean().withMessage('is_active 必须是布尔值'),
    body('initialQuota').optional().isInt({ min: 0 }).withMessage('初始额度必须是非负整数'),
    validator.validate
  ],
  userController.createUser
);

/**
 * @route   PUT /api/users/:id
 * @desc    更新用户
 * @access  Private/Admin
 */
router.put(
  '/:id',
  [
    protect,
    authorize('admin'),
    body('email').optional().isEmail().normalizeEmail().withMessage('请提供有效的邮箱地址'),
    body('role').optional().isIn(['operator', 'admin', 'read_only']).withMessage('角色必须是 operator, admin, 或 read_only'),
    body('is_active').optional().isBoolean().withMessage('is_active 必须是布尔值'),
    validator.validate
  ],
  userController.updateUser
);

/**
 * @route   PUT /api/users/:id/reset-password
 * @desc    重置用户密码
 * @access  Private/Admin
 */
router.put(
  '/:id/reset-password',
  [
    protect,
    authorize('admin'),
    body('newPassword').isLength({ min: 6 }).withMessage('新密码至少需要6个字符'),
    validator.validate
  ],
  userController.resetPassword
);

/**
 * @route   DELETE /api/users/:id
 * @desc    删除用户
 * @access  Private/Admin
 */
router.delete('/:id', protect, authorize('admin'), userController.deleteUser);

/**
 * @route   POST /api/users/:id/quota
 * @desc    分配用户额度
 * @access  Private/Admin
 */
router.post(
  '/:id/quota',
  [
    protect,
    authorize('admin'),
    body('amount').isInt({ min: 1 }).withMessage('额度数量必须是正整数'),
    body('reason').optional().isString().withMessage('分配原因必须是字符串'),
    validator.validate
  ],
  userController.allocateQuota
);

/**
 * @route   GET /api/users/:id/quota
 * @desc    获取用户额度信息
 * @access  Private/Admin
 */
router.get('/:id/quota', protect, authorize('admin'), userController.getUserQuota);

module.exports = router; 