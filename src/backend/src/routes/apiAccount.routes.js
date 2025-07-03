const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');

// 临时路由，稍后会实现完整功能
router.get('/', protect, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API账户功能正在开发中'
  });
});

module.exports = router; 