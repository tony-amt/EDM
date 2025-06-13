const { User, UserQuotaLog } = require('../models');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * 获取所有用户的额度信息
 */
exports.getUserQuotas = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    const whereCondition = {};
    if (status) {
      whereCondition.is_active = status === 'active';
    }
    
    const users = await User.findAndCountAll({
      where: whereCondition,
      attributes: [
        'id', 'username', 'email', 'remaining_quota', 
        'is_active', 'created_at', 'updated_at'
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });
    
    // 转换数据格式以匹配前端期望
    const items = users.rows.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      remainingQuota: user.remaining_quota || 0,
      totalQuotaUsed: 0, // 可以后续从日志计算
      quotaLimit: 1000, // 可以配置化
      lastUsedAt: null, // 可以从日志获取
      usageToday: 0, // 可以从日志计算
      usageThisWeek: 0, // 可以从日志计算
      usageThisMonth: 0, // 可以从日志计算
      status: user.is_active ? 'active' : 'inactive'
    }));
    
    // 计算汇总信息
    const summary = {
      totalUsers: users.count,
      totalQuotaLimit: users.count * 1000, // 可以配置化
      totalQuotaUsed: 0, // 可以从日志计算
      totalQuotaRemaining: users.rows.reduce((sum, user) => sum + (user.remaining_quota || 0), 0)
    };
    
    res.json({
      success: true,
      data: {
        items,
        summary,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(limit),
          total: users.count,
          totalPages: Math.ceil(users.count / limit)
        }
      }
    });
  } catch (error) {
    logger.error('获取用户额度失败:', error);
    res.status(500).json({
      success: false,
      error: { message: '获取用户额度失败' }
    });
  }
};

/**
 * 获取额度历史记录
 */
exports.getQuotaHistory = async (req, res) => {
  try {
    const { userId, operation, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    const whereCondition = {};
    if (userId) whereCondition.user_id = userId;
    if (operation) whereCondition.operation_type = operation;
    
    const logs = await UserQuotaLog.findAndCountAll({
      where: whereCondition,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });
    
    // 转换数据格式以匹配前端期望
    const items = logs.rows.map(log => ({
      id: log.id,
      userId: log.user_id,
      username: log.user?.username || '未知用户',
      operation: log.operation_type,
      amount: log.amount,
      beforeQuota: log.balance_before,
      afterQuota: log.balance_after,
      reason: log.reason || '无',
      operatedBy: 'admin', // 可以扩展为记录操作人
      operatedAt: log.created_at
    }));
    
    res.json({
      success: true,
      data: items,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(limit),
        total: logs.count,
        totalPages: Math.ceil(logs.count / limit)
      }
    });
  } catch (error) {
    logger.error('获取额度历史失败:', error);
    res.status(500).json({
      success: false,
      error: { message: '获取额度历史失败' }
    });
  }
};

/**
 * 调整用户额度
 */
exports.adjustUserQuota = async (req, res) => {
  try {
    const { id: userId } = req.params;
    const { operation, amount, reason } = req.body;
    
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: '用户不存在' }
      });
    }
    
    const currentQuota = user.remaining_quota || 0;
    let newQuota;
    
    switch (operation) {
      case 'add':
        newQuota = currentQuota + amount;
        break;
      case 'subtract':
        newQuota = Math.max(0, currentQuota - amount);
        break;
      case 'set':
        newQuota = amount;
        break;
      default:
        return res.status(400).json({
          success: false,
          error: { message: '无效的操作类型' }
        });
    }
    
    // 更新用户额度
    await user.update({ remaining_quota: newQuota });
    
    // 记录额度变更日志
    await UserQuotaLog.create({
      user_id: userId,
      operation_type: operation === 'add' ? 'allocate' : operation === 'subtract' ? 'deduct' : 'allocate',
      amount: operation === 'subtract' ? -amount : amount,
      balance_before: currentQuota,
      balance_after: newQuota,
      reason: reason || `管理员${operation}额度`
    });
    
    logger.info(`用户 ${userId} 额度调整: ${operation} ${amount}, 原额度: ${currentQuota}, 新额度: ${newQuota}`);
    
    res.json({
      success: true,
      data: {
        userId,
        operation,
        amount,
        beforeQuota: currentQuota,
        afterQuota: newQuota,
        reason: reason || '管理员调整'
      }
    });
  } catch (error) {
    logger.error('调整用户额度失败:', error);
    res.status(500).json({
      success: false,
      error: { message: '调整用户额度失败' }
    });
  }
};

/**
 * 批量调整用户额度
 */
exports.batchAdjustQuota = async (req, res) => {
  try {
    const { userIds, operation, amount, reason } = req.body;
    
    const users = await User.findAll({
      where: { id: { [Op.in]: userIds } }
    });
    
    if (users.length !== userIds.length) {
      return res.status(400).json({
        success: false,
        error: { message: '部分用户不存在' }
      });
    }
    
    const results = [];
    
    for (const user of users) {
      const currentQuota = user.remaining_quota || 0;
      let newQuota;
      
      switch (operation) {
        case 'add':
          newQuota = currentQuota + amount;
          break;
        case 'subtract':
          newQuota = Math.max(0, currentQuota - amount);
          break;
        case 'set':
          newQuota = amount;
          break;
      }
      
      // 更新用户额度
      await user.update({ remaining_quota: newQuota });
      
      // 记录额度变更日志
      await UserQuotaLog.create({
        user_id: user.id,
        operation_type: operation === 'add' ? 'allocate' : operation === 'subtract' ? 'deduct' : 'allocate',
        amount: operation === 'subtract' ? -amount : amount,
        balance_before: currentQuota,
        balance_after: newQuota,
        reason: reason || `管理员批量${operation}额度`
      });
      
      results.push({
        userId: user.id,
        username: user.username,
        beforeQuota: currentQuota,
        afterQuota: newQuota
      });
    }
    
    logger.info(`批量调整用户额度: ${userIds.length} 个用户, ${operation} ${amount}`);
    
    res.json({
      success: true,
      data: {
        operation,
        amount,
        affectedUsers: results.length,
        results
      }
    });
  } catch (error) {
    logger.error('批量调整用户额度失败:', error);
    res.status(500).json({
      success: false,
      error: { message: '批量调整用户额度失败' }
    });
  }
}; 