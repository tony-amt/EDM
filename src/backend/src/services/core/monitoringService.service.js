const TaskMonitorService = require('./taskMonitor.service');
const SystemMonitorService = require('./systemMonitor.service');
const AlertManagerService = require('./alertManager.service');
const ServiceReservations = require('../../models/index');

/**
 * 监控系统主服务
 * 统一管理任务监控、系统监控和告警管理
 */
class MonitoringService {
  constructor() {
    this.taskMonitor = new TaskMonitorService();
    this.systemMonitor = new SystemMonitorService();
    this.alertManager = new AlertManagerService();

    this.isRunning = false;
    this.startTime = null;
    this.config = {
      enabled: true,
      taskMonitoring: true,
      systemMonitoring: true,
      alerting: true,
      autoStart: true
    };
  }

  /**
   * 启动监控系统
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️  监控系统已在运行');
      return;
    }

    console.log('🚀 启动EDM监控系统 v2.1');
    this.startTime = new Date();

    try {
      // 启动告警管理服务（优先启动，其他服务需要依赖）
      if (this.config.alerting) {
        await this.alertManager.start();
      }

      // 启动任务监控服务
      if (this.config.taskMonitoring) {
        this.taskMonitor.start();
      }

      // 启动系统监控服务
      if (this.config.systemMonitoring) {
        this.systemMonitor.start();
      }

      // 启动服务预留清理定时器
      this.reservationCleanupTimer = ServiceReservations.startCleanupTimer(60);

      this.isRunning = true;
      console.log('✅ 监控系统启动完成');

      // 记录启动指标
      await this.recordStartupMetrics();

    } catch (error) {
      console.error('❌ 监控系统启动失败:', error);
      await this.stop();
      throw error;
    }
  }

  /**
   * 停止监控系统
   */
  async stop() {
    if (!this.isRunning) {
      console.log('⚠️  监控系统未在运行');
      return;
    }

    console.log('🛑 停止监控系统');

    try {
      // 停止各个监控服务
      this.taskMonitor.stop();
      this.systemMonitor.stop();
      this.alertManager.stop();

      // 停止服务预留清理定时器
      if (this.reservationCleanupTimer) {
        clearInterval(this.reservationCleanupTimer);
      }

      this.isRunning = false;
      console.log('✅ 监控系统已停止');

    } catch (error) {
      console.error('❌ 停止监控系统时出错:', error);
      throw error;
    }
  }

  /**
   * 重启监控系统
   */
  async restart() {
    console.log('🔄 重启监控系统');
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
    await this.start();
  }

  /**
   * 记录启动指标
   */
  async recordStartupMetrics() {
    try {
      const SystemPerformanceMetrics = require('../../models/index');

      await SystemPerformanceMetrics.create({
        metric_name: 'monitoring_system_startup',
        metric_value: 1,
        metric_unit: 'count',
        tags: {
          category: 'system',
          version: '2.1',
          startup_time: this.startTime.toISOString()
        }
      });

      console.log('📊 记录监控系统启动指标');
    } catch (error) {
      console.error('记录启动指标时出错:', error);
    }
  }

  /**
   * 获取监控系统状态
   */
  getStatus() {
    const uptime = this.startTime ? Date.now() - this.startTime.getTime() : 0;

    return {
      isRunning: this.isRunning,
      startTime: this.startTime,
      uptime: uptime,
      uptimeFormatted: this.formatUptime(uptime),
      services: {
        taskMonitor: {
          enabled: this.config.taskMonitoring,
          config: this.taskMonitor.getConfig()
        },
        systemMonitor: {
          enabled: this.config.systemMonitoring,
          config: this.systemMonitor.getConfig()
        },
        alertManager: {
          enabled: this.config.alerting,
          config: this.alertManager.getConfig()
        }
      },
      config: this.config
    };
  }

  /**
   * 获取系统健康状态
   */
  async getHealthStatus() {
    try {
      const health = await this.systemMonitor.getSystemHealthStatus();
      const activeAlerts = this.alertManager.getActiveAlerts();

      return {
        ...health,
        monitoring_system: {
          status: this.isRunning ? 'running' : 'stopped',
          uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
          active_alerts: activeAlerts.length,
          services_status: {
            task_monitor: this.config.taskMonitoring,
            system_monitor: this.config.systemMonitoring,
            alert_manager: this.config.alerting
          }
        }
      };
    } catch (error) {
      console.error('获取健康状态时出错:', error);
      return {
        health_score: 0,
        status: 'error',
        error: error.message,
        monitoring_system: {
          status: this.isRunning ? 'running' : 'stopped'
        }
      };
    }
  }

  /**
   * 任务监控接口
   */
  async recordTaskCreated(taskId, userId, totalSubtasks, metadata = {}) {
    if (!this.config.taskMonitoring) return;
    return await this.taskMonitor.recordTaskCreated(taskId, userId, totalSubtasks, metadata);
  }

  async recordFirstEmailSent(taskId, userId, metadata = {}) {
    if (!this.config.taskMonitoring) return;
    return await this.taskMonitor.recordFirstEmailSent(taskId, userId, metadata);
  }

  async recordTaskProgress(taskId, userId, subtasksSent, totalSubtasks, metadata = {}) {
    if (!this.config.taskMonitoring) return;
    return await this.taskMonitor.recordTaskProgress(taskId, userId, subtasksSent, totalSubtasks, metadata);
  }

  async recordTaskCompleted(taskId, userId, totalSubtasks, metadata = {}) {
    if (!this.config.taskMonitoring) return;
    return await this.taskMonitor.recordTaskCompleted(taskId, userId, totalSubtasks, metadata);
  }

  async recordTaskFailed(taskId, userId, subtasksSent, totalSubtasks, failureReason, metadata = {}) {
    if (!this.config.taskMonitoring) return;
    return await this.taskMonitor.recordTaskFailed(taskId, userId, subtasksSent, totalSubtasks, failureReason, metadata);
  }

  /**
   * 系统监控接口
   */
  async recordAPIMetrics(endpoint, method, responseTime, statusCode, error = null) {
    if (!this.config.systemMonitoring) return;
    return await this.systemMonitor.recordAPIMetrics(endpoint, method, responseTime, statusCode, error);
  }

  /**
   * 告警管理接口
   */
  async checkMetric(metricName, metricValue, metadata = {}) {
    if (!this.config.alerting) return;
    return await this.alertManager.checkMetric(metricName, metricValue, metadata);
  }

  async createAlertRule(ruleData) {
    return await this.alertManager.createAlertRule(ruleData);
  }

  async resolveAlert(alertId, resolvedBy, resolutionMessage) {
    return await this.alertManager.resolveAlert(alertId, resolvedBy, resolutionMessage);
  }

  getActiveAlerts() {
    return this.alertManager.getActiveAlerts();
  }

  /**
   * 获取监控统计
   */
  async getMonitoringStats(startTime, endTime) {
    try {
      const [taskStats, systemStats, alertStats] = await Promise.all([
        this.taskMonitor.getTaskMonitoringStats(startTime, endTime),
        this.systemMonitor.getMonitoringStats(startTime, endTime),
        this.alertManager.getAlertStatistics(startTime, endTime)
      ]);

      return {
        task_monitoring: taskStats,
        system_monitoring: systemStats,
        alert_management: alertStats,
        time_range: {
          start: startTime,
          end: endTime,
          duration_hours: (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
        }
      };
    } catch (error) {
      console.error('获取监控统计时出错:', error);
      return null;
    }
  }

  /**
   * 更新配置
   */
  async updateConfig(newConfig) {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    try {
      // 如果监控服务配置发生变化，需要重新配置
      if (newConfig.taskMonitoring !== undefined && newConfig.taskMonitoring !== oldConfig.taskMonitoring) {
        this.taskMonitor.setConfig({ enabled: newConfig.taskMonitoring });
      }

      if (newConfig.systemMonitoring !== undefined && newConfig.systemMonitoring !== oldConfig.systemMonitoring) {
        this.systemMonitor.setConfig({ enabled: newConfig.systemMonitoring });
      }

      if (newConfig.alerting !== undefined && newConfig.alerting !== oldConfig.alerting) {
        this.alertManager.setConfig({ enabled: newConfig.alerting });
      }

      // 如果整个监控系统被禁用，停止服务
      if (newConfig.enabled === false && this.isRunning) {
        await this.stop();
      }
      // 如果监控系统被启用，启动服务
      else if (newConfig.enabled === true && !this.isRunning) {
        await this.start();
      }

      console.log('📝 监控系统配置已更新');
      return true;
    } catch (error) {
      // 如果更新失败，回滚配置
      this.config = oldConfig;
      console.error('更新监控系统配置失败:', error);
      throw error;
    }
  }

  /**
   * 执行健康检查
   */
  async performHealthCheck() {
    const results = {
      overall_status: 'healthy',
      checks: {},
      timestamp: new Date(),
      issues: []
    };

    try {
      // 检查监控系统本身
      results.checks.monitoring_system = {
        status: this.isRunning ? 'healthy' : 'unhealthy',
        uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0
      };

      if (!this.isRunning) {
        results.issues.push('监控系统未运行');
        results.overall_status = 'unhealthy';
      }

      // 检查数据库连接
      try {
        const { sequelize } = require('../../config');
        await sequelize.authenticate();
        results.checks.database = { status: 'healthy' };
      } catch (error) {
        results.checks.database = { status: 'unhealthy', error: error.message };
        results.issues.push('数据库连接失败');
        results.overall_status = 'unhealthy';
      }

      // 检查活跃告警
      const activeAlerts = this.alertManager.getActiveAlerts();
      const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical');

      results.checks.alerts = {
        status: criticalAlerts.length > 0 ? 'warning' : 'healthy',
        active_alerts: activeAlerts.length,
        critical_alerts: criticalAlerts.length
      };

      if (criticalAlerts.length > 0) {
        results.issues.push(`${criticalAlerts.length} 个严重告警`);
        if (results.overall_status === 'healthy') {
          results.overall_status = 'warning';
        }
      }

      // 检查卡顿任务
      const stuckTasks = await this.taskMonitor.checkStuckTasks();
      results.checks.stuck_tasks = {
        status: stuckTasks.length > 0 ? 'warning' : 'healthy',
        count: stuckTasks.length
      };

      if (stuckTasks.length > 0) {
        results.issues.push(`${stuckTasks.length} 个卡顿任务`);
        if (results.overall_status === 'healthy') {
          results.overall_status = 'warning';
        }
      }

    } catch (error) {
      results.overall_status = 'error';
      results.error = error.message;
      results.issues.push('健康检查执行失败');
    }

    return results;
  }

  /**
   * 格式化运行时间
   */
  formatUptime(uptime) {
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}天 ${hours % 24}小时 ${minutes % 60}分钟`;
    } else if (hours > 0) {
      return `${hours}小时 ${minutes % 60}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟 ${seconds % 60}秒`;
    } else {
      return `${seconds}秒`;
    }
  }

  /**
   * 清理过期数据
   */
  async cleanupExpiredData(daysToKeep = 30) {
    try {
      console.log(`🧹 开始清理 ${daysToKeep} 天前的监控数据`);

      const SystemPerformanceMetrics = require('../../models/index');
      const AlertHistory = require('../../models/index');
      const TaskProcessingMetrics = require('../../models/index');

      const [systemMetricsDeleted, alertHistoryDeleted, taskMetricsDeleted, reservationsDeleted] = await Promise.all([
        SystemPerformanceMetrics.cleanupOldData(daysToKeep),
        AlertHistory.cleanupOldData(daysToKeep),
        TaskProcessingMetrics.cleanupOldData(daysToKeep),
        ServiceReservations.cleanupExpiredReservations()
      ]);

      const totalDeleted = systemMetricsDeleted + alertHistoryDeleted + taskMetricsDeleted + reservationsDeleted;

      console.log(`✅ 数据清理完成，删除了 ${totalDeleted} 条记录`);
      console.log(`   - 系统指标: ${systemMetricsDeleted}`);
      console.log(`   - 告警历史: ${alertHistoryDeleted}`);
      console.log(`   - 任务指标: ${taskMetricsDeleted}`);
      console.log(`   - 过期预留: ${reservationsDeleted}`);

      return {
        total_deleted: totalDeleted,
        system_metrics: systemMetricsDeleted,
        alert_history: alertHistoryDeleted,
        task_metrics: taskMetricsDeleted,
        expired_reservations: reservationsDeleted
      };
    } catch (error) {
      console.error('清理过期数据时出错:', error);
      throw error;
    }
  }
}

// 创建单例实例
const monitoringService = new MonitoringService();

module.exports = monitoringService; 