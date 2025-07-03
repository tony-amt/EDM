const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
// Use protect middleware for routes requiring full user object
const { protect } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validation.middleware');

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    注册新用户
 * @access  Public
 */
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail().withMessage('请输入有效的邮箱地址'),
    body('username').trim().notEmpty().withMessage('用户名为必填项').isLength({ min: 3 }).withMessage('用户名长度至少3位'),
    body('password').isLength({ min: 6 }).withMessage('密码长度至少6位'),
    body('role').optional().isIn(['operator', 'admin', 'read_only']).withMessage('无效的角色') // Match User model roles
  ],
  validate,
  authController.register
);

/**
 * @route   POST /api/auth/login
 * @desc    用户登录
 * @access  Public
 */
router.post(
  '/login',
  [
    body('usernameOrEmail').notEmpty().withMessage('用户名或邮箱不能为空'),
    body('password').notEmpty().withMessage('密码不能为空')
  ],
  validate,
  authController.login
);

/**
 * @route   GET /api/auth/me
 * @desc    获取当前用户信息
 * @access  Private
 */
// Changed authMiddleware to protect to get full req.user object
router.get('/me', protect, authController.getMe);

/**
 * @route   PUT /api/auth/password
 * @desc    修改当前用户密码
 * @access  Private
 */
router.put(
  '/password',
  protect, // Requires user to be authenticated
  [
    body('currentPassword').notEmpty().withMessage('当前密码不能为空'),
    body('newPassword').isLength({ min: 6 }).withMessage('新密码长度至少6位')
  ],
  validate,
  authController.changePassword
);

module.exports = router;