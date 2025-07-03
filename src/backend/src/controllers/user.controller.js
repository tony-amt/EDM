const { User, UserQuotaLog, sequelize } = require('../models/index');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const { authorize } = require('../middlewares/auth.middleware');

// 🚀 性能优化：添加简单缓存
const cache = new Map();
const CACHE_TTL = 2 * 60 * 1000; // 2分钟缓存

/**
 * 获取所有用户 - 性能优化版本
 * @route GET /api/users
 * @access Private/Admin
 */
exports.getUsers = async (req, res) => {
  try {
    // 🚀 缓存键
    const cacheKey = `users_${JSON.stringify(req.query)}`;

    // 检查缓存
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return res.status(200).json({
          ...cached.data,
          cached: true
        });
      }
      cache.delete(cacheKey);
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    // 构建查询条件
    const where = {};

    // 搜索功能
    if (req.query.search) {
      where[Op.or] = [
        { username: { [Op.iLike]: `%${req.query.search}%` } },
        { email: { [Op.iLike]: `%${req.query.search}%` } },
        { name: { [Op.iLike]: `%${req.query.search}%` } }
      ];
    }

    // 角色筛选
    if (req.query.role) {
      where.role = req.query.role;
    }

    // 状态筛选
    if (req.query.isActive !== undefined) {
      where.isActive = req.query.isActive === 'true';
    }

    // 🚀 性能优化：只查询必要字段，减少数据传输
    const { count, rows: users } = await User.findAndCountAll({
      where,
      attributes: {
        exclude: ['password', 'password_hash'] // 排除敏感字段
      },
      order: [['createdAt', 'DESC']],
      offset,
      limit,
      // 🚀 性能优化：禁用子查询计数
      distinct: true
    });

    const result = {
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit)
      }
    };

    // 🚀 缓存结果
    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    res.status(200).json(result);
  } catch (error) {
    logger.error(`获取用户列表失败: ${error.message}`);
    res.status(500).json({
      success: false,
      message: '获取用户列表失败',
      error: error.message
    });
  }
};

/**
 * 获取单个用户
 * @route GET /api/users/:id
 * @access Private/Admin
 */
exports.getUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error(`获取用户详情失败: ${error.message}`);
    res.status(500).json({
      success: false,
      message: '获取用户详情失败',
      error: error.message
    });
  }
};

/**
 * 创建用户（仅管理员）
 * @route POST /api/users
 * @access Private/Admin
 */
exports.createUser = async (req, res) => {
  try {
    const { username, email, password, role, is_active, initialQuota } = req.body;

    // 验证必填字段
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名和密码为必填项'
      });
    }

    // 检查用户名是否已存在
    const userExists = await User.findOne({
      where: { username }
    });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: '用户名已被使用'
      });
    }

    // 检查邮箱是否已存在（只有当邮箱不为空时才检查）
    if (email) {
      const emailExists = await User.findOne({
        where: { email }
      });

      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: '邮箱已被使用'
        });
      }
    }

    // 使用事务确保用户创建和额度分配的原子性
    const result = await sequelize.transaction(async (transaction) => {
      // 创建用户
      const user = await User.create({
        username,
        email,
        password_hash: password, // 模型的beforeCreate hook会自动哈希密码
        role: role || 'operator',
        is_active: is_active !== undefined ? is_active : true,
        remaining_quota: initialQuota || 0
      }, { transaction });

      // 如果设置了初始额度，记录额度分配日志
      if (initialQuota && initialQuota > 0) {
        await UserQuotaLog.create({
          user_id: user.id,
          operation_type: 'allocate',
          amount: initialQuota,
          balance_before: 0,
          balance_after: initialQuota,
          reason: '创建用户时分配初始额度'
        }, { transaction });

        logger.info(`为新用户 ${user.username} (${user.id}) 分配初始额度: ${initialQuota}`);
      }

      return user;
    });

    res.status(201).json({
      success: true,
      data: {
        id: result.id,
        username: result.username,
        email: result.email,
        role: result.role,
        is_active: result.is_active,
        remaining_quota: result.remaining_quota
      }
    });
  } catch (error) {
    logger.error(`创建用户失败: ${error.message}`, { stack: error.stack });
    res.status(500).json({
      success: false,
      message: '创建用户失败',
      error: error.message
    });
  }
};

/**
 * 更新用户
 * @route PUT /api/users/:id
 * @access Private/Admin
 */
exports.updateUser = async (req, res) => {
  try {
    const { name, email, role, isActive } = req.body;

    // 查找用户
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 如果更新邮箱，检查是否已存在
    if (email && email !== user.email) {
      const emailExists = await User.findOne({
        where: { email }
      });

      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: '邮箱已被使用'
        });
      }
      user.email = email;
    }

    // 更新其他字段
    if (name) user.name = name;
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (error) {
    logger.error(`更新用户失败: ${error.message}`);
    res.status(500).json({
      success: false,
      message: '更新用户失败',
      error: error.message
    });
  }
};

/**
 * 重置用户密码
 * @route PUT /api/users/:id/reset-password
 * @access Private/Admin
 */
exports.resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: '密码长度至少为6个字符'
      });
    }

    // 查找用户
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 更新密码
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: '密码重置成功'
    });
  } catch (error) {
    logger.error(`重置密码失败: ${error.message}`);
    res.status(500).json({
      success: false,
      message: '重置密码失败',
      error: error.message
    });
  }
};

/**
 * 删除用户
 * @route DELETE /api/users/:id
 * @access Private/Admin
 */
exports.deleteUser = async (req, res) => {
  try {
    // 查找用户
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 不允许删除自己
    if (user.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: '不能删除当前登录的用户'
      });
    }

    // 删除用户
    await user.destroy();

    res.status(200).json({
      success: true,
      message: '用户删除成功'
    });
  } catch (error) {
    logger.error(`删除用户失败: ${error.message}`);
    res.status(500).json({
      success: false,
      message: '删除用户失败',
      error: error.message
    });
  }
};

/**
 * 分配用户额度
 * @route POST /api/users/:id/quota
 * @access Private/Admin
 */
exports.allocateQuota = async (req, res) => {
  try {
    const { amount, reason } = req.body;
    const userId = req.params.id;

    // 查找用户
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 更新用户额度
    const currentQuota = user.remaining_quota || 0;
    const newQuota = currentQuota + amount;

    await user.update({
      remaining_quota: newQuota
    });

    logger.info(`管理员 ${req.user.id} 为用户 ${userId} 分配额度 ${amount}，原因: ${reason || '无'}`);

    res.status(200).json({
      success: true,
      message: '额度分配成功',
      data: {
        user_id: userId,
        previous_quota: currentQuota,
        allocated_amount: amount,
        new_quota: newQuota,
        reason: reason || null
      }
    });
  } catch (error) {
    logger.error(`分配用户额度失败: ${error.message}`);
    res.status(500).json({
      success: false,
      message: '分配用户额度失败',
      error: error.message
    });
  }
};

/**
 * 获取用户额度信息
 * @route GET /api/users/:id/quota
 * @access Private/Admin
 */
exports.getUserQuota = async (req, res) => {
  try {
    const userId = req.params.id;

    // 查找用户
    const user = await User.findByPk(userId, {
      attributes: ['id', 'username', 'email', 'remaining_quota', 'created_at']
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user_id: user.id,
        username: user.username,
        email: user.email,
        remaining_quota: user.remaining_quota || 0,
        created_at: user.created_at
      }
    });
  } catch (error) {
    logger.error(`获取用户额度信息失败: ${error.message}`);
    res.status(500).json({
      success: false,
      message: '获取用户额度信息失败',
      error: error.message
    });
  }
}; 