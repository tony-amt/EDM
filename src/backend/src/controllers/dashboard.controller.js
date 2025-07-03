const logger = require('../utils/logger');
const db = require('../models/index');

// 🚀 性能优化：添加简单缓存
const cache = new Map();
const CACHE_TTL = 1 * 60 * 1000; // 1分钟缓存（仪表盘数据更新频率高）

class DashboardController {
  /**
   * 获取仪表盘统计数据 - 性能优化版本
   */
  async getStats(req, res) {
    try {
      const userId = req.user.id;

      // 🚀 缓存键
      const cacheKey = `dashboard_stats_${userId}`;

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

      // 🚀 性能优化：并行查询所有统计数据
      const [contactsCount, tagsCount, templatesCount, tasksCount] = await Promise.allSettled([
        db.Contact.count({ where: { user_id: userId } }),
        db.Tag.count({ where: { user_id: userId, parent_id: null } }),
        db.Template.count({ where: { user_id: userId } }),
        db.Task.count({ where: { created_by: userId } })
      ]);

      const stats = {
        contacts: contactsCount.status === 'fulfilled' ? contactsCount.value : 0,
        tags: tagsCount.status === 'fulfilled' ? tagsCount.value : 0,
        templates: templatesCount.status === 'fulfilled' ? templatesCount.value : 0,
        tasks: tasksCount.status === 'fulfilled' ? tasksCount.value : 0,
        recentContacts: []
      };

      // 记录失败的查询
      const failures = [contactsCount, tagsCount, templatesCount, tasksCount]
        .filter(result => result.status === 'rejected')
        .map(result => result.reason?.message);

      if (failures.length > 0) {
        logger.warn('部分仪表盘统计查询失败:', failures);
      }

      const result = {
        success: true,
        data: stats
      };

      // 🚀 缓存结果
      cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      res.json(result);

    } catch (error) {
      logger.error('获取仪表盘统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取统计数据失败',
        error: error.message
      });
    }
  }

  /**
   * 获取用户仪表盘信息（兼容V2 API）- 性能优化版本
   */
  async getUserDashboard(req, res) {
    try {
      const userId = req.user.id;

      // 🚀 缓存键
      const cacheKey = `user_dashboard_${userId}`;

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

      // 获取用户信息
      const user = {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
        remaining_quota: req.user.remaining_quota || 0
      };

      // 🚀 性能优化：并行查询任务统计
      const [totalCampaigns, completedCampaigns, sendingCampaigns, failedCampaigns] = await Promise.allSettled([
        db.Task.count({ where: { created_by: userId } }),
        db.Task.count({ where: { created_by: userId, status: 'completed' } }),
        db.Task.count({ where: { created_by: userId, status: 'sending' } }),
        db.Task.count({ where: { created_by: userId, status: 'failed' } })
      ]);

      const dashboardData = {
        user: user,
        stats: {
          total_campaigns: totalCampaigns.status === 'fulfilled' ? totalCampaigns.value : 0,
          completed_campaigns: completedCampaigns.status === 'fulfilled' ? completedCampaigns.value : 0,
          sending_campaigns: sendingCampaigns.status === 'fulfilled' ? sendingCampaigns.value : 0,
          failed_campaigns: failedCampaigns.status === 'fulfilled' ? failedCampaigns.value : 0
        },
        recent_quota_logs: [],
        recent_campaigns: []
      };

      const result = {
        success: true,
        data: dashboardData
      };

      // 🚀 缓存结果
      cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      res.json(result);

    } catch (error) {
      logger.error('获取用户仪表盘失败:', error);
      res.status(500).json({
        success: false,
        message: '获取仪表盘数据失败',
        error: error.message
      });
    }
  }
}

module.exports = new DashboardController(); 