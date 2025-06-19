const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

/**
 * @route   GET /api/dashboard/stats
 * @desc    获取仪表盘统计数据
 * @access  Private
 */
router.get('/stats', protect, dashboardController.getStats);

/**
 * @route   GET /api/users-v2/dashboard
 * @desc    获取用户仪表盘信息（V2 API兼容）
 * @access  Private
 */
router.get('/users-v2/dashboard', protect, dashboardController.getUserDashboard);

module.exports = router; 