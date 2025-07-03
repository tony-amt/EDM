const { Task, SubTask, EmailService } = require('../../models/index');
const { Op } = require('sequelize');
const logger = require('../../utils/logger');

/**
 * 故障恢复服务
 * 负责检测和恢复卡住的任务和SubTask
 */
class FailureRecoveryService {
  constructor() {
    // 配置阈值
    this.stuckTaskThreshold = 30 * 60 * 1000; // 30分钟
    this.timeoutSubTaskThreshold = 10 * 60 * 1000; // 10分钟
    this.checkInterval = 5 * 60 * 1000; // 5分钟检查一次

    // 运行状态
    this.isRunning = false;
    this.intervalId = null;
    this.recoveryStats = {
      totalChecks: 0,
      stuckTasksFound: 0,
      timeoutSubTasksFound: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      lastCheckTime: null
    };

    // 集成监控服务（安全引用）
    try {
      this.alertManager = require('../monitoring/AlertManagerService');
    } catch (error) {
      logger.warn('AlertManagerService未找到，将使用空实现');
      this.alertManager = { createAlert: async () => { } };
    }

    try {
      this.taskMonitor = require('../monitoring/TaskMonitorService');
    } catch (error) {
      logger.warn('TaskMonitorService未找到，将使用空实现');
      this.taskMonitor = {
        recordTaskRecovery: async () => { },
        recordSubTaskRecovery: async () => { }
      };
    }

    logger.info('故障恢复服务初始化完成', {
      stuckTaskThreshold: this.stuckTaskThreshold / 1000 + 's',
      timeoutSubTaskThreshold: this.timeoutSubTaskThreshold / 1000 + 's',
      checkInterval: this.checkInterval / 1000 + 's'
    });
  }

  /**
   * 启动故障恢复服务
   */
  async start() {
    if (this.isRunning) {
      logger.warn('故障恢复服务已在运行中');
      return;
    }

    this.isRunning = true;
    logger.info('🚀 故障恢复服务启动');

    // 立即执行一次检查
    await this.performRecoveryCheck();

    // 设置定时检查
    this.intervalId = setInterval(async () => {
      try {
        await this.performRecoveryCheck();
      } catch (error) {
        logger.error('故障恢复定时检查失败:', error);
      }
    }, this.checkInterval);

    logger.info('故障恢复服务已启动，检查间隔:', this.checkInterval / 1000 + 's');
  }

  /**
   * 停止故障恢复服务
   */
  async stop() {
    if (!this.isRunning) {
      logger.warn('故障恢复服务未在运行');
      return;
    }

    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    logger.info('⏹️ 故障恢复服务已停止');
  }

  /**
   * 执行故障恢复检查
   */
  async performRecoveryCheck() {
    const startTime = Date.now();
    this.recoveryStats.totalChecks++;
    this.recoveryStats.lastCheckTime = new Date();

    logger.info('🔍 开始故障恢复检查...');

    try {
      // 1. 检查卡住的任务
      const stuckTasks = await this.findStuckTasks();
      this.recoveryStats.stuckTasksFound += stuckTasks.length;

      // 2. 检查超时的SubTask
      const timeoutSubTasks = await this.findTimeoutSubTasks();
      this.recoveryStats.timeoutSubTasksFound += timeoutSubTasks.length;

      // 3. 执行恢复操作
      if (stuckTasks.length > 0) {
        logger.warn(`发现 ${stuckTasks.length} 个卡住的任务，开始恢复...`);
        await this.recoverStuckTasks(stuckTasks);
      }

      if (timeoutSubTasks.length > 0) {
        logger.warn(`发现 ${timeoutSubTasks.length} 个超时的SubTask，开始恢复...`);
        await this.recoverTimeoutSubTasks(timeoutSubTasks);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      logger.info('✅ 故障恢复检查完成', {
        duration: duration + 'ms',
        stuckTasks: stuckTasks.length,
        timeoutSubTasks: timeoutSubTasks.length,
        stats: this.recoveryStats
      });

      // 如果发现问题，发送告警
      if (stuckTasks.length > 0 || timeoutSubTasks.length > 0) {
        await this.sendRecoveryAlert(stuckTasks.length, timeoutSubTasks.length);
      }

    } catch (error) {
      logger.error('故障恢复检查失败:', error);
      this.recoveryStats.failedRecoveries++;

      // 发送错误告警
      await this.sendErrorAlert(error);
    }
  }

  /**
   * 查找卡住的任务
   */
  async findStuckTasks() {
    const now = new Date();
    const stuckThreshold = new Date(now.getTime() - this.stuckTaskThreshold);

    const stuckTasks = await Task.findAll({
      where: {
        status: 'sending',
        updated_at: {
          [Op.lt]: stuckThreshold
        }
      },
      include: [{
        model: SubTask,
        as: 'subTasks',
        where: {
          status: ['allocated', 'processing']
        },
        required: false
      }]
    });

    return stuckTasks;
  }

  /**
   * 查找超时的SubTask
   */
  async findTimeoutSubTasks() {
    const now = new Date();
    const timeoutThreshold = new Date(now.getTime() - this.timeoutSubTaskThreshold);

    const timeoutSubTasks = await SubTask.findAll({
      where: {
        status: ['allocated', 'processing'],
        updated_at: {
          [Op.lt]: timeoutThreshold
        }
      },
      include: [{
        model: Task,
        as: 'task',
        attributes: ['id', 'title', 'user_id', 'status']
      }]
    });

    return timeoutSubTasks;
  }

  /**
   * 恢复卡住的任务
   */
  async recoverStuckTasks(stuckTasks) {
    for (const task of stuckTasks) {
      try {
        logger.info(`恢复卡住的任务: ${task.id}`);

        // 1. 重置任务状态
        await task.update({
          status: 'pending',
          updated_at: new Date()
        });

        // 2. 重置相关的SubTask
        const resetCount = await SubTask.update({
          status: 'pending',
          service_id: null,
          sender_email: null,
          error_message: 'Reset due to stuck task recovery',
          updated_at: new Date()
        }, {
          where: {
            task_id: task.id,
            status: ['allocated', 'processing']
          }
        });

        logger.info(`任务 ${task.id} 恢复完成，重置了 ${resetCount[0]} 个SubTask`);

        // 3. 记录恢复事件
        await this.taskMonitor.recordTaskRecovery(task.id, 'stuck_task', resetCount[0]);

        this.recoveryStats.successfulRecoveries++;

      } catch (error) {
        logger.error(`任务 ${task.id} 恢复失败:`, error);
        this.recoveryStats.failedRecoveries++;
      }
    }
  }

  /**
   * 恢复超时的SubTask
   */
  async recoverTimeoutSubTasks(timeoutSubTasks) {
    for (const subTask of timeoutSubTasks) {
      try {
        logger.info(`恢复超时的SubTask: ${subTask.id}`);

        // 1. 重置SubTask状态
        await subTask.update({
          status: 'pending',
          service_id: null,
          sender_email: null,
          error_message: 'Reset due to timeout recovery',
          updated_at: new Date()
        });

        // 2. 如果有关联的邮件服务，释放其占用
        if (subTask.service_id) {
          await this.releaseEmailService(subTask.service_id);
        }

        logger.info(`SubTask ${subTask.id} 恢复完成`);

        // 3. 记录恢复事件
        await this.taskMonitor.recordSubTaskRecovery(subTask.id, 'timeout_recovery');

        this.recoveryStats.successfulRecoveries++;

      } catch (error) {
        logger.error(`SubTask ${subTask.id} 恢复失败:`, error);
        this.recoveryStats.failedRecoveries++;
      }
    }
  }

  /**
   * 释放邮件服务占用
   */
  async releaseEmailService(serviceId) {
    try {
      const service = await EmailService.findByPk(serviceId);
      if (service) {
        // 如果服务的next_available_at时间已过，立即释放
        const now = new Date();
        if (!service.next_available_at || service.next_available_at <= now) {
          await service.update({
            next_available_at: now
          });
          logger.info(`释放邮件服务 ${serviceId} 的占用`);
        }
      }
    } catch (error) {
      logger.error(`释放邮件服务 ${serviceId} 失败:`, error);
    }
  }

  /**
   * 发送恢复告警
   */
  async sendRecoveryAlert(stuckTaskCount, timeoutSubTaskCount) {
    try {
      const alertData = {
        type: 'failure_recovery',
        level: stuckTaskCount > 0 ? 'critical' : 'warning',
        title: '故障恢复执行',
        message: `发现并恢复了 ${stuckTaskCount} 个卡住的任务和 ${timeoutSubTaskCount} 个超时的SubTask`,
        details: {
          stuckTasks: stuckTaskCount,
          timeoutSubTasks: timeoutSubTaskCount,
          stats: this.recoveryStats
        },
        timestamp: new Date()
      };

      await this.alertManager.createAlert(alertData);
    } catch (error) {
      logger.error('发送恢复告警失败:', error);
    }
  }

  /**
   * 发送错误告警
   */
  async sendErrorAlert(error) {
    try {
      const alertData = {
        type: 'failure_recovery_error',
        level: 'critical',
        title: '故障恢复服务错误',
        message: `故障恢复服务执行失败: ${error.message}`,
        details: {
          error: error.stack,
          stats: this.recoveryStats
        },
        timestamp: new Date()
      };

      await this.alertManager.createAlert(alertData);
    } catch (alertError) {
      logger.error('发送错误告警失败:', alertError);
    }
  }

  /**
   * 获取恢复统计信息
   */
  getRecoveryStats() {
    return {
      ...this.recoveryStats,
      isRunning: this.isRunning,
      config: {
        stuckTaskThreshold: this.stuckTaskThreshold / 1000 + 's',
        timeoutSubTaskThreshold: this.timeoutSubTaskThreshold / 1000 + 's',
        checkInterval: this.checkInterval / 1000 + 's'
      }
    };
  }

  /**
   * 手动触发故障恢复
   */
  async triggerManualRecovery() {
    logger.info('🔧 手动触发故障恢复');
    await this.performRecoveryCheck();
  }

  /**
   * 重置恢复统计
   */
  resetStats() {
    this.recoveryStats = {
      totalChecks: 0,
      stuckTasksFound: 0,
      timeoutSubTasksFound: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      lastCheckTime: null
    };
    logger.info('故障恢复统计已重置');
  }
}

// 创建单例实例
const failureRecoveryService = new FailureRecoveryService();

module.exports = failureRecoveryService;