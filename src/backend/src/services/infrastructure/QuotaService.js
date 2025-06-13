const { User, UserQuotaLog, sequelize } = require('../../models');

class QuotaService {
  /**
   * 检查用户额度是否充足
   * @param {string} userId - 用户ID
   * @param {number} requiredQuota - 需要的额度
   * @returns {Promise<Object>} 检查结果
   */
  async checkUserQuota(userId, requiredQuota) {
    try {
      const user = await User.findByPk(userId, {
        attributes: ['id', 'username', 'remaining_quota']
      });

      if (!user) {
        return {
          success: false,
          reason: 'USER_NOT_FOUND',
          message: '用户不存在'
        };
      }

      const isEnough = user.remaining_quota >= requiredQuota;

      return {
        success: isEnough,
        user_id: userId,
        username: user.username,
        current_quota: user.remaining_quota,
        required_quota: requiredQuota,
        remaining_after: isEnough ? user.remaining_quota - requiredQuota : user.remaining_quota,
        reason: isEnough ? 'SUFFICIENT' : 'INSUFFICIENT',
        message: isEnough ? 
          `用户额度充足，当前余额: ${user.remaining_quota}` : 
          `用户额度不足，当前余额: ${user.remaining_quota}，需要: ${requiredQuota}`
      };
    } catch (error) {
      console.error('检查用户额度失败:', error);
      return {
        success: false,
        reason: 'SYSTEM_ERROR',
        message: '系统错误'
      };
    }
  }

  /**
   * 扣减用户额度（原子性操作）
   * @param {string} userId - 用户ID
   * @param {number} amount - 扣减数量
   * @param {string} taskId - 关联的任务ID（可选）
   * @param {string} reason - 扣减原因
   * @returns {Promise<Object>} 操作结果
   */
  async deductUserQuota(userId, amount, taskId = null, reason = '邮件发送') {
    const transaction = await sequelize.transaction();
    
    try {
      // 先查询用户当前额度
      const user = await User.findByPk(userId, {
        attributes: ['id', 'username', 'remaining_quota'],
        transaction,
        lock: true // 锁定记录防止并发修改
      });

      if (!user) {
        await transaction.rollback();
        return {
          success: false,
          reason: 'USER_NOT_FOUND',
          message: '用户不存在'
        };
      }

      // 检查额度是否充足
      if (user.remaining_quota < amount) {
        await transaction.rollback();
        return {
          success: false,
          reason: 'INSUFFICIENT_QUOTA',
          message: `额度不足，当前余额: ${user.remaining_quota}，需要: ${amount}`
        };
      }

      const balanceBefore = user.remaining_quota;
      const balanceAfter = balanceBefore - amount;

      // 更新用户额度
      await user.update({
        remaining_quota: balanceAfter
      }, { transaction });

      // 记录额度日志
      await UserQuotaLog.create({
        user_id: userId,
        operation_type: 'deduct',
        amount: amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        task_id: taskId,
        reason: reason
      }, { transaction });

      await transaction.commit();

      return {
        success: true,
        user_id: userId,
        username: user.username,
        deducted_amount: amount,
        remaining_quota: balanceAfter,
        message: `成功扣减 ${amount} 个额度，剩余 ${balanceAfter} 个`
      };

    } catch (error) {
      await transaction.rollback();
      console.error('扣减用户额度失败:', error);
      return {
        success: false,
        reason: 'SYSTEM_ERROR',
        message: '系统错误'
      };
    }
  }

  /**
   * 回退用户额度
   * @param {string} userId - 用户ID
   * @param {number} amount - 回退数量
   * @param {string} taskId - 关联的任务ID（可选）
   * @param {string} reason - 回退原因
   * @returns {Promise<Object>} 操作结果
   */
  async refundUserQuota(userId, amount, taskId = null, reason = '任务取消') {
    const transaction = await sequelize.transaction();
    
    try {
      // 查询用户当前额度
      const user = await User.findByPk(userId, {
        attributes: ['id', 'username', 'remaining_quota'],
        transaction,
        lock: true
      });

      if (!user) {
        await transaction.rollback();
        return {
          success: false,
          reason: 'USER_NOT_FOUND',
          message: '用户不存在'
        };
      }

      const balanceBefore = user.remaining_quota;
      const balanceAfter = balanceBefore + amount;

      // 更新用户额度
      await user.update({
        remaining_quota: balanceAfter
      }, { transaction });

      // 记录额度日志
      await UserQuotaLog.create({
        user_id: userId,
        operation_type: 'refund',
        amount: amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        task_id: taskId,
        reason: reason
      }, { transaction });

      await transaction.commit();

      return {
        success: true,
        user_id: userId,
        username: user.username,
        refunded_amount: amount,
        remaining_quota: balanceAfter,
        message: `成功回退 ${amount} 个额度，当前余额 ${balanceAfter} 个`
      };

    } catch (error) {
      await transaction.rollback();
      console.error('回退用户额度失败:', error);
      return {
        success: false,
        reason: 'SYSTEM_ERROR',
        message: '系统错误'
      };
    }
  }

  /**
   * 分配用户额度（管理员功能）
   * @param {string} userId - 用户ID
   * @param {number} amount - 分配数量
   * @param {string} reason - 分配原因
   * @returns {Promise<Object>} 操作结果
   */
  async allocateUserQuota(userId, amount, reason = '管理员分配') {
    const transaction = await sequelize.transaction();
    
    try {
      // 查询用户当前额度
      const user = await User.findByPk(userId, {
        attributes: ['id', 'username', 'remaining_quota'],
        transaction,
        lock: true
      });

      if (!user) {
        await transaction.rollback();
        return {
          success: false,
          reason: 'USER_NOT_FOUND',
          message: '用户不存在'
        };
      }

      const balanceBefore = user.remaining_quota;
      const balanceAfter = balanceBefore + amount;

      // 更新用户额度
      await user.update({
        remaining_quota: balanceAfter
      }, { transaction });

      // 记录额度日志
      await UserQuotaLog.create({
        user_id: userId,
        operation_type: 'allocate',
        amount: amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        task_id: null,
        reason: reason
      }, { transaction });

      await transaction.commit();

      return {
        success: true,
        user_id: userId,
        username: user.username,
        allocated_amount: amount,
        remaining_quota: balanceAfter,
        message: `成功分配 ${amount} 个额度，当前余额 ${balanceAfter} 个`
      };

    } catch (error) {
      await transaction.rollback();
      console.error('分配用户额度失败:', error);
      return {
        success: false,
        reason: 'SYSTEM_ERROR',
        message: '系统错误'
      };
    }
  }

  /**
   * 获取用户额度使用历史
   * @param {string} userId - 用户ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 历史记录
   */
  async getUserQuotaHistory(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        operation_type = null,
        start_date = null,
        end_date = null
      } = options;

      const offset = (page - 1) * limit;

      let whereCondition = { user_id: userId };

      if (operation_type) {
        whereCondition.operation_type = operation_type;
      }

      if (start_date || end_date) {
        whereCondition.created_at = {};
        if (start_date) {
          whereCondition.created_at[sequelize.Op.gte] = new Date(start_date);
        }
        if (end_date) {
          whereCondition.created_at[sequelize.Op.lte] = new Date(end_date);
        }
      }

      const { count, rows: logs } = await UserQuotaLog.findAndCountAll({
        where: whereCondition,
        order: [['created_at', 'DESC']],
        offset: parseInt(offset),
        limit: parseInt(limit)
      });

      // 计算统计信息
      const stats = await UserQuotaLog.findAll({
        where: { user_id: userId },
        attributes: [
          [sequelize.fn('SUM', 
            sequelize.case()
              .when(sequelize.col('operation_type').eq('allocate'), sequelize.col('amount'))
              .else(0)
          ), 'total_allocated'],
          [sequelize.fn('SUM', 
            sequelize.case()
              .when(sequelize.col('operation_type').eq('deduct'), sequelize.literal('-amount'))
              .else(0)
          ), 'total_deducted'],
          [sequelize.fn('SUM', 
            sequelize.case()
              .when(sequelize.col('operation_type').eq('refund'), sequelize.col('amount'))
              .else(0)
          ), 'total_refunded']
        ],
        raw: true
      });

      return {
        success: true,
        data: {
          logs: logs.map(log => ({
            id: log.id,
            operation_type: log.operation_type,
            amount: log.amount,
            balance_before: log.balance_before,
            balance_after: log.balance_after,
            reason: log.reason,
            created_at: log.created_at
          })),
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / limit)
          },
          statistics: {
            total_allocated: parseInt(stats[0]?.total_allocated) || 0,
            total_deducted: Math.abs(parseInt(stats[0]?.total_deducted)) || 0,
            total_refunded: parseInt(stats[0]?.total_refunded) || 0
          }
        }
      };
    } catch (error) {
      console.error('获取用户额度历史失败:', error);
      return {
        success: false,
        reason: 'SYSTEM_ERROR',
        message: '系统错误'
      };
    }
  }

  /**
   * 获取全局额度统计（管理员功能）
   * @param {Object} options - 统计选项
   * @returns {Promise<Object>} 统计结果
   */
  async getGlobalQuotaStats(options = {}) {
    try {
      const { period = '7days' } = options;

      // 获取时间范围
      const endDate = new Date();
      let startDate = new Date();
      
      switch (period) {
        case '24hours':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case '7days':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30days':
          startDate.setDate(startDate.getDate() - 30);
          break;
        default:
          startDate.setDate(startDate.getDate() - 7);
      }

      // 用户额度分布
      const userQuotaDistribution = await User.findAll({
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'user_count'],
          [sequelize.fn('SUM', sequelize.col('remaining_quota')), 'total_quota'],
          [sequelize.fn('AVG', sequelize.col('remaining_quota')), 'avg_quota'],
          [sequelize.fn('MIN', sequelize.col('remaining_quota')), 'min_quota'],
          [sequelize.fn('MAX', sequelize.col('remaining_quota')), 'max_quota']
        ],
        where: { role: 'user' },
        raw: true
      });

      // 按额度范围分组
      const quotaRanges = await User.findAll({
        attributes: [
          [sequelize.fn('COUNT', 
            sequelize.case()
              .when(sequelize.col('remaining_quota').eq(0), 1)
              .else(null)
          ), 'zero_quota'],
          [sequelize.fn('COUNT', 
            sequelize.case()
              .when(sequelize.col('remaining_quota').between(1, 100), 1)
              .else(null)
          ), 'low_quota'],
          [sequelize.fn('COUNT', 
            sequelize.case()
              .when(sequelize.col('remaining_quota').between(101, 1000), 1)
              .else(null)
          ), 'medium_quota'],
          [sequelize.fn('COUNT', 
            sequelize.case()
              .when(sequelize.col('remaining_quota').gt(1000), 1)
              .else(null)
          ), 'high_quota']
        ],
        where: { role: 'user' },
        raw: true
      });

      // 时间段内的额度操作统计
      const periodStats = await UserQuotaLog.findAll({
        attributes: [
          'operation_type',
          [sequelize.fn('COUNT', sequelize.col('id')), 'operation_count'],
          [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount']
        ],
        where: {
          created_at: {
            [sequelize.Op.between]: [startDate, endDate]
          }
        },
        group: ['operation_type'],
        raw: true
      });

      // 每日额度变化趋势
      const dailyTrend = await UserQuotaLog.findAll({
        attributes: [
          [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
          [sequelize.fn('SUM', 
            sequelize.case()
              .when(sequelize.col('operation_type').eq('allocate'), sequelize.col('amount'))
              .when(sequelize.col('operation_type').eq('refund'), sequelize.col('amount'))
              .else(0)
          ), 'credits'],
          [sequelize.fn('SUM', 
            sequelize.case()
              .when(sequelize.col('operation_type').eq('deduct'), sequelize.col('amount'))
              .else(0)
          ), 'debits']
        ],
        where: {
          created_at: {
            [sequelize.Op.between]: [startDate, endDate]
          }
        },
        group: [sequelize.fn('DATE', sequelize.col('created_at'))],
        order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
        raw: true
      });

      return {
        success: true,
        data: {
          summary: {
            period,
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            ...userQuotaDistribution[0]
          },
          distribution: {
            zero_quota_users: parseInt(quotaRanges[0]?.zero_quota) || 0,
            low_quota_users: parseInt(quotaRanges[0]?.low_quota) || 0,
            medium_quota_users: parseInt(quotaRanges[0]?.medium_quota) || 0,
            high_quota_users: parseInt(quotaRanges[0]?.high_quota) || 0
          },
          period_operations: periodStats.reduce((acc, stat) => {
            acc[stat.operation_type] = {
              count: parseInt(stat.operation_count),
              amount: parseInt(stat.total_amount)
            };
            return acc;
          }, {}),
          daily_trend: dailyTrend.map(day => ({
            date: day.date,
            credits: parseInt(day.credits) || 0,
            debits: parseInt(day.debits) || 0,
            net_change: (parseInt(day.credits) || 0) - (parseInt(day.debits) || 0)
          }))
        }
      };
    } catch (error) {
      console.error('获取全局额度统计失败:', error);
      return {
        success: false,
        reason: 'SYSTEM_ERROR',
        message: '系统错误'
      };
    }
  }

  /**
   * 批量分配用户额度
   * @param {Array} allocations - 分配列表 [{userId, amount, reason}]
   * @returns {Promise<Object>} 批量操作结果
   */
  async batchAllocateQuota(allocations) {
    const results = [];
    const transaction = await sequelize.transaction();

    try {
      for (const allocation of allocations) {
        const { userId, amount, reason = '批量分配' } = allocation;
        
        try {
          const result = await this.allocateUserQuota(userId, amount, reason);
          results.push({
            user_id: userId,
            success: result.success,
            amount: amount,
            message: result.message
          });
        } catch (error) {
          results.push({
            user_id: userId,
            success: false,
            amount: amount,
            message: error.message
          });
        }
      }

      await transaction.commit();

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      return {
        success: true,
        summary: {
          total: allocations.length,
          success: successCount,
          failed: failCount
        },
        results
      };

    } catch (error) {
      await transaction.rollback();
      console.error('批量分配额度失败:', error);
      return {
        success: false,
        reason: 'SYSTEM_ERROR',
        message: '系统错误'
      };
    }
  }
}

module.exports = new QuotaService(); 