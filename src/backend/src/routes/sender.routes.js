const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth.middleware');
const { Sender } = require('../models');
const logger = require('../utils/logger');

/**
 * 获取发信人列表
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const senders = await Sender.findAll({
      where: {
        user_id: req.user.id
      },
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: senders
    });
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
    const { Task } = require('../models');
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