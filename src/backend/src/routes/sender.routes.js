const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth.middleware');
const { Sender } = require('../models/index');
const logger = require('../utils/logger');

// 🚀 性能优化：添加简单缓存
const cache = new Map();
const CACHE_TTL = 2 * 60 * 1000; // 2分钟缓存

/**
 * 获取发信人列表 - 性能优化版本
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    // 🚀 缓存键
    const cacheKey = `senders_${req.user.id}_${JSON.stringify(req.query)}`;

    // 检查缓存
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return res.json({
          ...cached.data,
          cached: true
        });
      }
      cache.delete(cacheKey);
    }

    // 🚀 性能优化：只查询必要字段
    const senders = await Sender.findAll({
      where: {
        user_id: req.user.id
      },
      attributes: ['id', 'name', 'display_name', 'user_id', 'created_at', 'updated_at'],
      order: [['created_at', 'DESC']],
      // 🚀 性能优化：限制查询数量
      limit: 100
    });

    const result = {
      success: true,
      data: senders
    };

    // 🚀 缓存结果
    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    res.json(result);
  } catch (error) {
    logger.error('获取发信人列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取发信人列表失败'
    });
  }
});

/**
 * 创建发信人
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const { name, display_name } = req.body;

    // 验证必填字段
    if (!name) {
      return res.status(400).json({
        success: false,
        message: '发信人名称不能为空'
      });
    }

    // 验证名称格式
    const nameRegex = /^[a-zA-Z0-9._-]+$/;
    if (!nameRegex.test(name)) {
      return res.status(400).json({
        success: false,
        message: '发信人名称格式不合法，只能包含字母、数字、点、下划线和连字符'
      });
    }

    // 检查名称是否已存在
    const existingSender = await Sender.findOne({
      where: {
        name,
        user_id: req.user.id
      }
    });

    if (existingSender) {
      return res.status(400).json({
        success: false,
        message: '发信人名称已存在'
      });
    }

    // 创建发信人
    const sender = await Sender.create({
      name,
      display_name,
      user_id: req.user.id
    });

    res.status(201).json({
      success: true,
      message: '发信人创建成功',
      data: sender
    });
  } catch (error) {
    logger.error('创建发信人失败:', error);
    res.status(500).json({
      success: false,
      message: '创建发信人失败'
    });
  }
});

/**
 * 删除发信人
 */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // 查找发信人
    const sender = await Sender.findOne({
      where: {
        id,
        user_id: req.user.id
      }
    });

    if (!sender) {
      return res.status(404).json({
        success: false,
        message: '发信人不存在或无权删除'
      });
    }

    // 检查是否被任务使用
    const { Task } = require('../models/index');
    const taskCount = await Task.count({
      where: {
        sender_id: id
      }
    });

    if (taskCount > 0) {
      return res.status(400).json({
        success: false,
        message: '该发信人已被任务使用，无法删除'
      });
    }

    // 删除发信人
    await sender.destroy();

    res.json({
      success: true,
      message: '发信人删除成功'
    });
  } catch (error) {
    logger.error('删除发信人失败:', error);
    res.status(500).json({
      success: false,
      message: '删除发信人失败'
    });
  }
});

/**
 * 获取发信人详情
 */
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const sender = await Sender.findOne({
      where: {
        id,
        user_id: req.user.id
      }
    });

    if (!sender) {
      return res.status(404).json({
        success: false,
        message: '发信人不存在'
      });
    }

    res.json({
      success: true,
      data: sender
    });
  } catch (error) {
    logger.error('获取发信人详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取发信人详情失败'
    });
  }
});

module.exports = router; 