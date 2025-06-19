const logger = require('../utils/logger');
const db = require('../models');

class DashboardController {
  /**
   * 获取仪表盘统计数据
   */
  async getStats(req, res) {
    try {
      const userId = req.user.id;
      
      // 简化版本：先返回基本统计，避免复杂查询
      const stats = {
        contacts: 0,
        tags: 0,
        templates: 0,
        tasks: 0,
        recentContacts: []
      };

      // 尝试获取简单统计
      try {
        const contactsCount = await db.Contact.count({ where: { user_id: userId } });
        stats.contacts = contactsCount;
      } catch (error) {
        logger.warn('获取联系人统计失败:', error.message);
      }

      try {
        // 只统计父标签（parent_id 为 null），不包括子标签
        const tagsCount = await db.Tag.count({ 
          where: { 
            user_id: userId,
            parent_id: null 
          } 
        });
        stats.tags = tagsCount;
      } catch (error) {
        logger.warn('获取标签统计失败:', error.message);
      }

      try {
        const templatesCount = await db.Template.count({ where: { user_id: userId } });
        stats.templates = templatesCount;
      } catch (error) {
        logger.warn('获取模板统计失败:', error.message);
      }

      try {
        const tasksCount = await db.Task.count({ where: { created_by: userId } });
        stats.tasks = tasksCount;
      } catch (error) {
        logger.warn('获取任务统计失败:', error.message);
      }

      res.json({
        success: true,
        data: stats
      });

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
   * 获取用户仪表盘信息（兼容V2 API）
   */
  async getUserDashboard(req, res) {
    try {
      const userId = req.user.id;
      
      // 获取用户信息
      const user = {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
        remaining_quota: req.user.remaining_quota || 0
      };

      // 简化统计数据
      const dashboardData = {
        user: user,
        stats: {
          total_campaigns: 0,
          completed_campaigns: 0,
          sending_campaigns: 0,
          failed_campaigns: 0
        },
        recent_quota_logs: [],
        recent_campaigns: []
      };

      // 尝试获取任务统计
      try {
        const totalCampaigns = await db.Task.count({ where: { created_by: userId } });
        const completedCampaigns = await db.Task.count({ where: { created_by: userId, status: 'completed' } });
        const sendingCampaigns = await db.Task.count({ where: { created_by: userId, status: 'sending' } });
        const failedCampaigns = await db.Task.count({ where: { created_by: userId, status: 'failed' } });

        dashboardData.stats = {
          total_campaigns: totalCampaigns,
          completed_campaigns: completedCampaigns,
          sending_campaigns: sendingCampaigns,
          failed_campaigns: failedCampaigns
        };
      } catch (error) {
        logger.warn('获取任务统计失败:', error.message);
      }

      res.json({
        success: true,
        data: dashboardData
      });

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