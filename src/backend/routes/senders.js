const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const { Sender, User } = require('../src/models');
const { protect: authenticateToken } = require('../src/middlewares/auth.middleware');

// 发信人名称验证中间件
const validateSenderName = [
  body('name')
    .isLength({ min: 1, max: 64 })
    .withMessage('发信人名称长度必须在1-64字符之间')
    .matches(/^[a-zA-Z0-9._-]+$/)
    .withMessage('发信人名称只能包含字母、数字、点号、横线和下划线')
    .not()
    .matches(/^[.-]|[.-]$/)
    .withMessage('发信人名称不能以点号或横线开头或结尾'),
];

// 创建发信人
router.post('/', authenticateToken, validateSenderName, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: `名称格式错误: ${errors.array().map(e => e.msg).join(', ')}`
      });
    }

    const { name, display_name } = req.body;
    
    // 检查必需字段
    if (!name) {
      return res.status(400).json({
        success: false,
        error: '发信人名称(name)是必需的'
      });
    }

    // 检查用户下的发信人名称唯一性
    const existingSender = await Sender.findOne({
      where: {
        name: name,
        user_id: req.user.id
      }
    });

    if (existingSender) {
      return res.status(409).json({
        success: false,
        error: '发信人名称已存在'
      });
    }

    const sender = await Sender.create({
      name,
      display_name: display_name || name,
      user_id: req.user.id
    });

    res.status(201).json({
      success: true,
      data: sender
    });
  } catch (error) {
    console.error('Create sender error:', error);
    res.status(500).json({
      success: false,
      error: '创建发信人失败'
    });
  }
});

// 获取发信人列表
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;

    const whereCondition = {
      user_id: req.user.id
    };

    if (search) {
      whereCondition.name = {
        [require('sequelize').Op.iLike]: `%${search}%`
      };
    }

    const { count, rows } = await Sender.findAndCountAll({
      where: whereCondition,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get senders error:', error);
    res.status(500).json({
      success: false,
      error: '获取发信人列表失败'
    });
  }
});

// 更新发信人
router.put('/:id', authenticateToken, validateSenderName, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: `名称格式错误: ${errors.array().map(e => e.msg).join(', ')}`
      });
    }

    const { id } = req.params;
    const { name, display_name } = req.body;

    const sender = await Sender.findOne({
      where: {
        id,
        user_id: req.user.id
      }
    });

    if (!sender) {
      return res.status(404).json({
        success: false,
        error: '发信人不存在'
      });
    }

    // 如果名称有变化，检查唯一性
    if (name && name !== sender.name) {
      const existingSender = await Sender.findOne({
        where: {
          name: name,
          user_id: req.user.id,
          id: { [require('sequelize').Op.ne]: id }
        }
      });

      if (existingSender) {
        return res.status(409).json({
          success: false,
          error: '发信人名称已存在'
        });
      }
    }

    await sender.update({
      name: name || sender.name,
      display_name: display_name || sender.display_name
    });

    res.json({
      success: true,
      data: sender
    });
  } catch (error) {
    console.error('Update sender error:', error);
    res.status(500).json({
      success: false,
      error: '更新发信人失败'
    });
  }
});

// 删除发信人
router.delete('/:id', authenticateToken, async (req, res) => {
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
        error: '发信人不存在'
      });
    }

    await sender.destroy();

    res.json({
      success: true,
      message: '发信人删除成功'
    });
  } catch (error) {
    console.error('Delete sender error:', error);
    res.status(500).json({
      success: false,
      error: '删除发信人失败'
    });
  }
});

module.exports = router; 