#!/usr/bin/env node

/**
 * EDM SaaS 调度器健康检查脚本
 * 
 * 功能：
 * 1. 检查调度器运行状态
 * 2. 检查定时任务处理情况
 * 3. 检查发信服务状态
 * 4. 检查用户额度重置情况
 * 5. 检查任务队列状态
 * 6. 生成详细的健康报告
 */

const { Task, SubTask, EmailService, User, Sender } = require('./src/backend/src/models');
const { sequelize, Sequelize } = require('./src/backend/src/models');
const { Op } = Sequelize;

class SchedulerHealthChecker {
  constructor() {
    this.startTime = new Date();
    this.results = {
      overall_status: 'UNKNOWN',
      checks: [],
      warnings: [],
      errors: [],
      recommendations: []
    };
  }

  /**
   * 添加检查结果
   */
  addCheck(name, status, message, details = null) {
    const check = {
      name,
      status,
      message,
      timestamp: new Date(),
      details
    };

    this.results.checks.push(check);

    if (status === 'WARNING') {
      this.results.warnings.push(check);
    } else if (status === 'ERROR') {
      this.results.errors.push(check);
    }

    console.log(`[${status}] ${name}: ${message}`);
    if (details) {
      console.log(`  详情: ${JSON.stringify(details, null, 2)}`);
    }
  }

  /**
   * 添加建议
   */
  addRecommendation(message) {
    this.results.recommendations.push({
      message,
      timestamp: new Date()
    });
    console.log(`💡 建议: ${message}`);
  }

  /**
   * 检查数据库连接
   */
  async checkDatabaseConnection() {
    try {
      await sequelize.authenticate();
      this.addCheck('数据库连接', 'OK', '数据库连接正常');
      return true;
    } catch (error) {
      this.addCheck('数据库连接', 'ERROR', '数据库连接失败', { error: error.message });
      return false;
    }
  }

  /**
   * 检查调度器基础状态
   */
  async checkSchedulerStatus() {
    try {
      // 检查当前运行的任务
      const runningTasks = await Task.findAll({
        where: {
          status: {
            [Op.in]: ['pending', 'scheduled', 'sending']
          }
        },
        attributes: ['id', 'name', 'status', 'created_at', 'scheduled_at']
      });

      this.addCheck('任务队列状态', 'OK', 
        `发现 ${runningTasks.length} 个活跃任务`, 
        { active_tasks: runningTasks.length });

      if (runningTasks.length > 50) {
        this.addCheck('任务队列负载', 'WARNING', 
          `活跃任务数量较多: ${runningTasks.length}，建议监控系统性能`);
        this.addRecommendation('考虑增加发信服务或调整发送频率');
      }

      return true;
    } catch (error) {
      this.addCheck('调度器状态', 'ERROR', '检查调度器状态失败', { error: error.message });
      return false;
    }
  }

  /**
   * 检查发信服务状态
   */
  async checkEmailServices() {
    try {
      const services = await EmailService.findAll({
        attributes: ['id', 'name', 'is_enabled', 'is_frozen', 'daily_quota', 'used_quota', 'sending_rate']
      });

      const enabledServices = services.filter(s => s.is_enabled && !s.is_frozen);
      const availableServices = enabledServices.filter(s => s.used_quota < s.daily_quota);

      this.addCheck('发信服务总数', 'OK', 
        `共有 ${services.length} 个发信服务`, 
        { 
          total: services.length,
          enabled: enabledServices.length,
          available: availableServices.length
        });

      if (availableServices.length === 0) {
        this.addCheck('可用发信服务', 'ERROR', '没有可用的发信服务');
        this.addRecommendation('紧急：需要立即重置发信服务的每日额度或添加新的发信服务');
      } else if (availableServices.length < 3) {
        this.addCheck('可用发信服务', 'WARNING', 
          `可用发信服务数量较少: ${availableServices.length}`);
        this.addRecommendation('建议增加更多发信服务以提高系统稳定性');
      }

      // 检查服务额度使用情况
      for (const service of services) {
        const usageRate = (service.used_quota / service.daily_quota) * 100;
        if (usageRate > 90) {
          this.addCheck(`发信服务额度-${service.name}`, 'WARNING', 
            `额度使用率过高: ${usageRate.toFixed(1)}%`);
        }
      }

      return true;
    } catch (error) {
      this.addCheck('发信服务检查', 'ERROR', '检查发信服务失败', { error: error.message });
      return false;
    }
  }

  /**
   * 检查用户额度情况
   */
  async checkUserQuotas() {
    try {
      const users = await User.findAll({
        attributes: ['id', 'username', 'remaining_quota', 'total_quota'],
        where: {
          remaining_quota: { [Op.gt]: 0 }
        }
      });

      const lowQuotaUsers = users.filter(u => u.remaining_quota < u.total_quota * 0.1);

      this.addCheck('用户额度状态', 'OK', 
        `${users.length} 个用户有剩余额度`, 
        { 
          users_with_quota: users.length,
          low_quota_users: lowQuotaUsers.length
        });

      if (lowQuotaUsers.length > 0) {
        this.addCheck('低额度用户', 'WARNING', 
          `${lowQuotaUsers.length} 个用户额度不足10%`);
        this.addRecommendation('建议为低额度用户补充额度');
      }

      return true;
    } catch (error) {
      this.addCheck('用户额度检查', 'ERROR', '检查用户额度失败', { error: error.message });
      return false;
    }
  }

  /**
   * 检查子任务处理效率
   */
  async checkSubTaskProcessing() {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      // 检查最近24小时的子任务统计
      const recentStats = await SubTask.findAll({
        where: {
          created_at: { [Op.gte]: oneDayAgo }
        },
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      });

      const stats = {};
      let totalRecent = 0;
      recentStats.forEach(stat => {
        const count = parseInt(stat.count);
        stats[stat.status] = count;
        totalRecent += count;
      });

      // 检查待处理的子任务
      const pendingSubTasks = await SubTask.count({
        where: { status: 'pending' }
      });

      this.addCheck('子任务处理效率', 'OK', 
        `最近24小时处理 ${totalRecent} 个子任务，${pendingSubTasks} 个待处理`, 
        { recent_24h: stats, pending: pendingSubTasks });

      if (pendingSubTasks > 10000) {
        this.addCheck('待处理子任务', 'WARNING', 
          `待处理子任务数量较多: ${pendingSubTasks}`);
        this.addRecommendation('建议检查调度器性能或增加发信服务');
      }

      // 检查失败率
      const failedCount = stats.failed || 0;
      const failureRate = totalRecent > 0 ? (failedCount / totalRecent) * 100 : 0;
      
      if (failureRate > 5) {
        this.addCheck('子任务失败率', 'WARNING', 
          `失败率过高: ${failureRate.toFixed(2)}%`);
        this.addRecommendation('建议检查发信服务配置和网络连接');
      }

      return true;
    } catch (error) {
      this.addCheck('子任务处理检查', 'ERROR', '检查子任务处理失败', { error: error.message });
      return false;
    }
  }

  /**
   * 检查定时任务处理
   */
  async checkScheduledTasks() {
    try {
      const now = new Date();
      const overdueTasks = await Task.findAll({
        where: {
          status: 'scheduled',
          scheduled_at: { [Op.lt]: now }
        },
        attributes: ['id', 'name', 'scheduled_at'],
        order: [['scheduled_at', 'ASC']]
      });

      this.addCheck('定时任务处理', 'OK', 
        `${overdueTasks.length} 个过期的定时任务`, 
        { overdue_count: overdueTasks.length });

      if (overdueTasks.length > 0) {
        const oldestTask = overdueTasks[0];
        const delayMinutes = Math.floor((now - oldestTask.scheduled_at) / (1000 * 60));
        
        if (delayMinutes > 5) {
          this.addCheck('定时任务延迟', 'WARNING', 
            `最老的定时任务延迟 ${delayMinutes} 分钟`);
          this.addRecommendation('建议检查调度器是否正常运行');
        }
      }

      return true;
    } catch (error) {
      this.addCheck('定时任务检查', 'ERROR', '检查定时任务失败', { error: error.message });
      return false;
    }
  }

  /**
   * 检查发信人配置
   */
  async checkSenderConfiguration() {
    try {
      const senders = await Sender.findAll({
        attributes: ['id', 'name', 'email', 'is_verified', 'is_active']
      });

      const activeSenders = senders.filter(s => s.is_active && s.is_verified);

      this.addCheck('发信人配置', 'OK', 
        `共有 ${senders.length} 个发信人，${activeSenders.length} 个可用`, 
        { 
          total: senders.length,
          active: activeSenders.length
        });

      if (activeSenders.length === 0) {
        this.addCheck('可用发信人', 'ERROR', '没有可用的发信人');
        this.addRecommendation('紧急：需要配置并验证发信人');
      }

      return true;
    } catch (error) {
      this.addCheck('发信人检查', 'ERROR', '检查发信人配置失败', { error: error.message });
      return false;
    }
  }

  /**
   * 执行完整的健康检查
   */
  async runHealthCheck() {
    console.log('🔍 EDM调度器健康检查开始...\n');

    const dbOk = await this.checkDatabaseConnection();
    if (!dbOk) {
      this.results.overall_status = 'CRITICAL';
      return this.generateReport();
    }

    await this.checkSchedulerStatus();
    await this.checkEmailServices();
    await this.checkUserQuotas();
    await this.checkSubTaskProcessing();
    await this.checkScheduledTasks();
    await this.checkSenderConfiguration();

    // 确定整体状态
    if (this.results.errors.length > 0) {
      this.results.overall_status = 'CRITICAL';
    } else if (this.results.warnings.length > 0) {
      this.results.overall_status = 'WARNING';
    } else {
      this.results.overall_status = 'HEALTHY';
    }

    return this.generateReport();
  }

  /**
   * 生成健康检查报告
   */
  generateReport() {
    const endTime = new Date();
    const duration = endTime - this.startTime;

    const report = {
      ...this.results,
      summary: {
        check_duration_ms: duration,
        total_checks: this.results.checks.length,
        warnings_count: this.results.warnings.length,
        errors_count: this.results.errors.length,
        recommendations_count: this.results.recommendations.length
      },
      generated_at: endTime
    };

    console.log('\n📋 健康检查报告:');
    console.log('='.repeat(50));
    console.log(`整体状态: ${report.overall_status}`);
    console.log(`检查项目: ${report.summary.total_checks}`);
    console.log(`警告数量: ${report.summary.warnings_count}`);
    console.log(`错误数量: ${report.summary.errors_count}`);
    console.log(`建议数量: ${report.summary.recommendations_count}`);
    console.log(`检查耗时: ${report.summary.check_duration_ms}ms`);

    if (report.recommendations.length > 0) {
      console.log('\n💡 改进建议:');
      report.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec.message}`);
      });
    }

    console.log('\n✅ 健康检查完成');
    return report;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const checker = new SchedulerHealthChecker();
  
  checker.runHealthCheck()
    .then(report => {
      // 根据状态设置退出码
      const exitCode = report.overall_status === 'CRITICAL' ? 1 : 0;
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('健康检查失败:', error);
      process.exit(1);
    });
}

module.exports = SchedulerHealthChecker; 