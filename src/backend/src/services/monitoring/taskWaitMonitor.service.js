const { TaskWaitMetric } = require('../../models/index');
const logger = require('../../utils/logger');

class TaskWaitMonitorService {
  constructor() {
    this.waitingTasks = new Map(); // 内存中的等待任务缓存
    this.alertThresholds = {
      warning: 300,    // 5分钟
      critical: 600,   // 10分钟
      emergency: 1800  // 30分钟
    };

    // 集成已有告警管理器（Phase 1）
    this.alertManager = null;
    this.initializeAlertManager();
  }

  async initializeAlertManager() {
    try {
      const AlertManagerService = require('./alertManager.service');
      this.alertManager = new AlertManagerService();
      logger.info('✅ TaskWaitMonitor: 告警管理器初始化成功');
    } catch (error) {
      logger.warn('⚠️ TaskWaitMonitor: 告警管理器初始化失败，将使用简化版本', error.message);
      this.alertManager = {
        createAlert: async (alertData) => {
          logger.warn(`🚨 告警: ${alertData.message}`, alertData);
        }
      };
    }
  }

  /**
   * 🎯 记录任务进入队列
   */
  async recordTaskEntry(taskId, userId) {
    try {
      const entryTime = new Date();

      // 记录到内存监控
      this.waitingTasks.set(taskId, {
        userId,
        entryTime,
        status: 'waiting'
      });

      // 记录到数据库
      await TaskWaitMetric.create({
        task_id: taskId,
        user_id: userId,
        queue_entry_time: entryTime,
        status: 'waiting'
      });

      logger.info(`📥 任务 ${taskId} 进入队列监控`);

    } catch (error) {
      logger.error(`❌ 记录任务进入队列失败: ${taskId}`, error);
    }
  }

  /**
   * 🎯 记录首次发送
   */
  async recordFirstSend(taskId) {
    try {
      const sendTime = new Date();
      const waitingTask = this.waitingTasks.get(taskId);

      if (waitingTask) {
        const waitDuration = Math.floor((sendTime - waitingTask.entryTime) / 1000);

        // 更新内存状态
        waitingTask.status = 'processing';
        waitingTask.firstSendTime = sendTime;
        waitingTask.waitDuration = waitDuration;

        // 更新数据库
        await TaskWaitMetric.update({
          first_send_time: sendTime,
          wait_duration_seconds: waitDuration,
          status: 'processing'
        }, {
          where: { task_id: taskId }
        });

        // 检查是否需要告警
        await this.checkWaitTimeAlert(taskId, waitDuration);

        logger.info(`🚀 任务 ${taskId} 开始发送，等待时长: ${waitDuration}秒`);

      } else {
        logger.warn(`⚠️ 任务 ${taskId} 在内存中未找到，直接记录到数据库`);

        // 尝试从数据库查找
        const metric = await TaskWaitMetric.findOne({
          where: { task_id: taskId, status: 'waiting' }
        });

        if (metric) {
          const waitDuration = Math.floor((sendTime - metric.queue_entry_time) / 1000);

          await metric.update({
            first_send_time: sendTime,
            wait_duration_seconds: waitDuration,
            status: 'processing'
          });

          await this.checkWaitTimeAlert(taskId, waitDuration);
        }
      }

    } catch (error) {
      logger.error(`❌ 记录首次发送失败: ${taskId}`, error);
    }
  }

  /**
   * 🎯 记录任务完成
   */
  async recordTaskCompletion(taskId) {
    try {
      // 从内存移除
      this.waitingTasks.delete(taskId);

      // 更新数据库状态
      await TaskWaitMetric.update({
        status: 'completed'
      }, {
        where: { task_id: taskId }
      });

      logger.info(`✅ 任务 ${taskId} 完成并移出监控`);

    } catch (error) {
      logger.error(`❌ 记录任务完成失败: ${taskId}`, error);
    }
  }

  /**
   * 🎯 检查等待时间告警
   */
  async checkWaitTimeAlert(taskId, waitDuration) {
    try {
      let alertLevel = null;

      if (waitDuration >= this.alertThresholds.emergency) {
        alertLevel = 'emergency';
      } else if (waitDuration >= this.alertThresholds.critical) {
        alertLevel = 'critical';
      } else if (waitDuration >= this.alertThresholds.warning) {
        alertLevel = 'warning';
      }

      if (alertLevel) {
        await this.alertManager.createAlert({
          type: `task_wait_${alertLevel}`,
          task_id: taskId,
          wait_duration: waitDuration,
          severity: alertLevel,
          message: `任务 ${taskId} 等待时长 ${waitDuration}秒，达到${alertLevel}级别`,
          metadata: {
            threshold: this.alertThresholds[alertLevel],
            actual_wait: waitDuration
          }
        });

        logger.warn(`🚨 任务等待告警: ${taskId}, 等待${waitDuration}秒, 级别: ${alertLevel}`);
      }

    } catch (error) {
      logger.error(`❌ 检查等待时间告警失败: ${taskId}`, error);
    }
  }

  /**
   * 🎯 获取等待时间统计
   */
  async getWaitTimeStats(userId = null, hours = 24) {
    try {
      // 使用模型的类方法
      const avgStats = await TaskWaitMetric.getAverageWaitTime(userId, hours);

      // 获取长时间等待的任务
      const longWaitingTasks = await TaskWaitMetric.getLongWaitingTasks(this.alertThresholds.warning);

      // 内存中的等待任务统计
      const memoryStats = this.getMemoryWaitStats();

      return {
        average_wait_seconds: avgStats.average_wait_seconds,
        total_completed_tasks: avgStats.total_tasks,
        long_waiting_tasks: longWaitingTasks.length,
        current_waiting_tasks: memoryStats.waiting_count,
        memory_cache_size: memoryStats.total_count,
        alert_thresholds: this.alertThresholds
      };

    } catch (error) {
      logger.error('❌ 获取等待时间统计失败', error);
      return {
        average_wait_seconds: 0,
        total_completed_tasks: 0,
        long_waiting_tasks: 0,
        current_waiting_tasks: 0,
        memory_cache_size: 0,
        error: error.message
      };
    }
  }

  /**
   * 🎯 获取内存缓存统计
   */
  getMemoryWaitStats() {
    const now = new Date();
    let waitingCount = 0;
    let processingCount = 0;
    let totalWaitTime = 0;

    for (const [taskId, task] of this.waitingTasks.entries()) {
      if (task.status === 'waiting') {
        waitingCount++;
        totalWaitTime += Math.floor((now - task.entryTime) / 1000);
      } else if (task.status === 'processing') {
        processingCount++;
      }
    }

    return {
      total_count: this.waitingTasks.size,
      waiting_count: waitingCount,
      processing_count: processingCount,
      average_current_wait: waitingCount > 0 ? Math.round(totalWaitTime / waitingCount) : 0
    };
  }

  /**
   * 🎯 清理过期的内存缓存
   */
  cleanupMemoryCache() {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24小时

    let cleanedCount = 0;

    for (const [taskId, task] of this.waitingTasks.entries()) {
      if (now - task.entryTime > maxAge) {
        this.waitingTasks.delete(taskId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`🧹 清理了 ${cleanedCount} 个过期的内存缓存任务`);
    }

    return cleanedCount;
  }

  /**
   * 🎯 启动定期清理任务
   */
  startCleanupTimer() {
    // 每小时清理一次过期缓存
    this.cleanupTimer = setInterval(() => {
      this.cleanupMemoryCache();
    }, 60 * 60 * 1000);

    logger.info('✅ TaskWaitMonitor: 定期清理任务已启动');
  }

  /**
   * 🎯 停止服务
   */
  stop() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.waitingTasks.clear();
    logger.info('✅ TaskWaitMonitor: 服务已停止');
  }

  /**
   * 🎯 获取服务状态
   */
  getStatus() {
    return {
      service: 'TaskWaitMonitorService',
      status: 'running',
      memory_cache_size: this.waitingTasks.size,
      alert_thresholds: this.alertThresholds,
      cleanup_timer_active: !!this.cleanupTimer
    };
  }
}

module.exports = TaskWaitMonitorService; 