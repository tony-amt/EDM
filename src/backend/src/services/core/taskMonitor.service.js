const TaskProcessingMetrics = require('../../models/index');
const SystemPerformanceMetrics = require('../../models/index');
const AlertManagerService = require('./alertManager.service');

/**
 * 任务监控服务
 * 负责记录和跟踪任务执行过程
 */
class TaskMonitorService {
  constructor() {
    this.alertManager = new AlertManagerService();
    this.monitoringEnabled = true;
    this.stuckTaskThresholdMinutes = 10;
    this.checkInterval = 5 * 60 * 1000; // 5分钟检查一次
    this.taskCreationTimes = new Map(); // 缓存任务创建时间
  }

  /**
   * 启动任务监控服务
   */
  start() {
    console.log('🔍 任务监控服务启动');

    // 启动定期检查卡顿任务的定时器
    this.stuckTaskCheckTimer = setInterval(() => {
      this.checkStuckTasks().catch(error => {
        console.error('检查卡顿任务时出错:', error);
      });
    }, this.checkInterval);

    // 启动定期统计任务处理性能的定时器
    this.performanceStatsTimer = setInterval(() => {
      this.recordTaskPerformanceStats().catch(error => {
        console.error('记录任务性能统计时出错:', error);
      });
    }, 10 * 60 * 1000); // 每10分钟记录一次
  }

  /**
   * 停止任务监控服务
   */
  stop() {
    console.log('🛑 任务监控服务停止');

    if (this.stuckTaskCheckTimer) {
      clearInterval(this.stuckTaskCheckTimer);
    }

    if (this.performanceStatsTimer) {
      clearInterval(this.performanceStatsTimer);
    }
  }

  /**
   * 记录任务创建
   */
  async recordTaskCreated(taskId, userId, totalSubtasks, metadata = {}) {
    if (!this.monitoringEnabled) return;

    try {
      const createdTime = new Date();
      this.taskCreationTimes.set(taskId, createdTime);

      await TaskProcessingMetrics.recordTaskCreated(taskId, userId, totalSubtasks, {
        ...metadata,
        task_created_at: createdTime.toISOString(),
        monitoring_version: '2.1'
      });

      console.log(`📝 记录任务创建: ${taskId}, 子任务数: ${totalSubtasks}`);
    } catch (error) {
      console.error('记录任务创建时出错:', error);
    }
  }

  /**
   * 记录首封邮件发送
   */
  async recordFirstEmailSent(taskId, userId, metadata = {}) {
    if (!this.monitoringEnabled) return;

    try {
      const sentTime = new Date();
      const createdTime = this.taskCreationTimes.get(taskId);
      const waitTimeSeconds = createdTime
        ? Math.round((sentTime.getTime() - createdTime.getTime()) / 1000)
        : 0;

      await TaskProcessingMetrics.recordFirstEmailSent(taskId, userId, waitTimeSeconds, {
        ...metadata,
        first_email_sent_at: sentTime.toISOString(),
        monitoring_version: '2.1'
      });

      // 记录系统级指标
      await SystemPerformanceMetrics.recordQueueThroughput(1, {
        task_id: taskId,
        metric_type: 'first_email'
      });

      console.log(`📧 记录首封邮件发送: ${taskId}, 等待时间: ${waitTimeSeconds}秒`);

      // 如果等待时间过长，触发告警检查
      if (waitTimeSeconds > 300) { // 5分钟
        await this.alertManager.checkMetric('task_wait_time', waitTimeSeconds, {
          task_id: taskId,
          user_id: userId
        });
      }
    } catch (error) {
      console.error('记录首封邮件发送时出错:', error);
    }
  }

  /**
   * 记录任务进度
   */
  async recordTaskProgress(taskId, userId, subtasksSent, totalSubtasks, metadata = {}) {
    if (!this.monitoringEnabled) return;

    try {
      const createdTime = this.taskCreationTimes.get(taskId);

      await TaskProcessingMetrics.recordTaskProgress(taskId, userId, subtasksSent, totalSubtasks, {
        ...metadata,
        task_created_at: createdTime?.toISOString(),
        progress_recorded_at: new Date().toISOString(),
        monitoring_version: '2.1'
      });

      // 计算并记录当前吞吐量
      if (createdTime) {
        const elapsedHours = (Date.now() - createdTime.getTime()) / (1000 * 60 * 60);
        const currentThroughput = elapsedHours > 0 ? subtasksSent / elapsedHours : 0;

        await SystemPerformanceMetrics.recordQueueThroughput(currentThroughput, {
          task_id: taskId,
          metric_type: 'progress_update'
        });
      }

      const progressPercent = ((subtasksSent / totalSubtasks) * 100).toFixed(1);
      console.log(`📊 记录任务进度: ${taskId}, 进度: ${progressPercent}% (${subtasksSent}/${totalSubtasks})`);
    } catch (error) {
      console.error('记录任务进度时出错:', error);
    }
  }

  /**
   * 记录任务完成
   */
  async recordTaskCompleted(taskId, userId, totalSubtasks, metadata = {}) {
    if (!this.monitoringEnabled) return;

    try {
      const completedTime = new Date();
      const createdTime = this.taskCreationTimes.get(taskId);
      const totalTimeSeconds = createdTime
        ? Math.round((completedTime.getTime() - createdTime.getTime()) / 1000)
        : 0;

      await TaskProcessingMetrics.recordTaskCompleted(taskId, userId, totalSubtasks, totalTimeSeconds, {
        ...metadata,
        task_completed_at: completedTime.toISOString(),
        monitoring_version: '2.1'
      });

      // 记录最终吞吐量
      const finalThroughput = totalTimeSeconds > 0 ? (totalSubtasks * 3600) / totalTimeSeconds : 0;
      await SystemPerformanceMetrics.recordQueueThroughput(finalThroughput, {
        task_id: taskId,
        metric_type: 'task_completed'
      });

      // 清理缓存
      this.taskCreationTimes.delete(taskId);

      console.log(`✅ 记录任务完成: ${taskId}, 总耗时: ${totalTimeSeconds}秒, 吞吐量: ${finalThroughput.toFixed(2)} emails/hour`);
    } catch (error) {
      console.error('记录任务完成时出错:', error);
    }
  }

  /**
   * 记录任务失败
   */
  async recordTaskFailed(taskId, userId, subtasksSent, totalSubtasks, failureReason, metadata = {}) {
    if (!this.monitoringEnabled) return;

    try {
      await TaskProcessingMetrics.recordTaskFailed(taskId, userId, subtasksSent, totalSubtasks, failureReason, {
        ...metadata,
        task_failed_at: new Date().toISOString(),
        monitoring_version: '2.1'
      });

      // 记录失败率指标
      const failureRate = ((totalSubtasks - subtasksSent) / totalSubtasks) * 100;
      await SystemPerformanceMetrics.create({
        metric_name: 'task_failure_rate',
        metric_value: failureRate,
        metric_unit: 'percent',
        tags: {
          task_id: taskId,
          failure_reason: failureReason,
          category: 'task_failure'
        }
      });

      // 清理缓存
      this.taskCreationTimes.delete(taskId);

      console.log(`❌ 记录任务失败: ${taskId}, 失败原因: ${failureReason}, 完成率: ${((subtasksSent / totalSubtasks) * 100).toFixed(1)}%`);

      // 触发失败率告警检查
      await this.alertManager.checkMetric('task_failure_rate', failureRate, {
        task_id: taskId,
        user_id: userId,
        failure_reason: failureReason
      });
    } catch (error) {
      console.error('记录任务失败时出错:', error);
    }
  }

  /**
   * 检查卡顿任务
   */
  async checkStuckTasks() {
    try {
      const stuckTasks = await TaskProcessingMetrics.getStuckTasks(this.stuckTaskThresholdMinutes);

      for (const task of stuckTasks) {
        const stuckDurationMinutes = Math.round(task.stuck_duration_seconds / 60);

        console.log(`⚠️  发现卡顿任务: ${task.task_id}, 卡顿时长: ${stuckDurationMinutes}分钟`);

        // 记录卡顿持续时间指标
        await SystemPerformanceMetrics.create({
          metric_name: 'task_stuck_duration',
          metric_value: task.stuck_duration_seconds,
          metric_unit: 'seconds',
          tags: {
            task_id: task.task_id,
            category: 'task_stuck'
          }
        });

        // 触发卡顿告警
        await this.alertManager.checkMetric('task_stuck_duration', task.stuck_duration_seconds, {
          task_id: task.task_id,
          stuck_duration_minutes: stuckDurationMinutes,
          last_progress_time: task.last_progress_time,
          subtasks_sent: task.last_subtasks_sent,
          total_subtasks: task.total_subtasks
        });
      }

      if (stuckTasks.length > 0) {
        // 记录卡顿任务总数
        await SystemPerformanceMetrics.create({
          metric_name: 'stuck_tasks_count',
          metric_value: stuckTasks.length,
          metric_unit: 'count',
          tags: {
            category: 'task_monitoring'
          }
        });
      }

      return stuckTasks;
    } catch (error) {
      console.error('检查卡顿任务时出错:', error);
      return [];
    }
  }

  /**
   * 记录任务处理性能统计
   */
  async recordTaskPerformanceStats() {
    try {
      const now = new Date();
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

      // 获取最近10分钟的任务指标
      const recentMetrics = await TaskProcessingMetrics.findAll({
        where: {
          timestamp: {
            [require('sequelize').Op.gte]: tenMinutesAgo
          }
        }
      });

      if (recentMetrics.length === 0) return;

      // 统计各种指标
      const stats = {
        total_tasks: new Set(recentMetrics.map(m => m.task_id)).size,
        completed_tasks: recentMetrics.filter(m => m.metric_type === 'completed').length,
        failed_tasks: recentMetrics.filter(m => m.metric_type === 'failed').length,
        avg_wait_time: 0,
        avg_throughput: 0
      };

      // 计算平均等待时间
      const firstSentMetrics = recentMetrics.filter(m => m.metric_type === 'first_sent');
      if (firstSentMetrics.length > 0) {
        stats.avg_wait_time = firstSentMetrics.reduce((sum, m) => sum + m.wait_time_seconds, 0) / firstSentMetrics.length;
      }

      // 计算平均吞吐量
      const completedMetrics = recentMetrics.filter(m => m.metric_type === 'completed' && m.throughput_per_hour > 0);
      if (completedMetrics.length > 0) {
        stats.avg_throughput = completedMetrics.reduce((sum, m) => sum + parseFloat(m.throughput_per_hour), 0) / completedMetrics.length;
      }

      // 记录统计指标
      await Promise.all([
        SystemPerformanceMetrics.recordActiveTasksCount(stats.total_tasks),
        SystemPerformanceMetrics.create({
          metric_name: 'avg_task_wait_time',
          metric_value: stats.avg_wait_time,
          metric_unit: 'seconds',
          tags: { category: 'task_performance' }
        }),
        SystemPerformanceMetrics.recordQueueThroughput(stats.avg_throughput),
        SystemPerformanceMetrics.create({
          metric_name: 'task_completion_rate',
          metric_value: stats.total_tasks > 0 ? (stats.completed_tasks / stats.total_tasks) * 100 : 0,
          metric_unit: 'percent',
          tags: { category: 'task_performance' }
        })
      ]);

      console.log(`📈 任务性能统计 - 总任务: ${stats.total_tasks}, 完成: ${stats.completed_tasks}, 失败: ${stats.failed_tasks}, 平均等待: ${stats.avg_wait_time.toFixed(1)}秒`);
    } catch (error) {
      console.error('记录任务性能统计时出错:', error);
    }
  }

  /**
   * 获取任务监控统计
   */
  async getTaskMonitoringStats(startTime, endTime) {
    try {
      const metrics = await TaskProcessingMetrics.findAll({
        where: {
          timestamp: {
            [require('sequelize').Op.between]: [startTime, endTime]
          }
        }
      });

      const stats = {
        total_tasks: new Set(metrics.map(m => m.task_id)).size,
        metrics_by_type: {},
        avg_wait_time: 0,
        avg_throughput: 0,
        stuck_tasks_detected: 0
      };

      // 按类型统计指标
      metrics.forEach(metric => {
        if (!stats.metrics_by_type[metric.metric_type]) {
          stats.metrics_by_type[metric.metric_type] = 0;
        }
        stats.metrics_by_type[metric.metric_type]++;
      });

      // 计算平均等待时间
      const firstSentMetrics = metrics.filter(m => m.metric_type === 'first_sent');
      if (firstSentMetrics.length > 0) {
        stats.avg_wait_time = firstSentMetrics.reduce((sum, m) => sum + m.wait_time_seconds, 0) / firstSentMetrics.length;
      }

      // 计算平均吞吐量
      const completedMetrics = metrics.filter(m => m.metric_type === 'completed' && m.throughput_per_hour > 0);
      if (completedMetrics.length > 0) {
        stats.avg_throughput = completedMetrics.reduce((sum, m) => sum + parseFloat(m.throughput_per_hour), 0) / completedMetrics.length;
      }

      return stats;
    } catch (error) {
      console.error('获取任务监控统计时出错:', error);
      return null;
    }
  }

  /**
   * 设置监控配置
   */
  setConfig(config) {
    if (config.enabled !== undefined) {
      this.monitoringEnabled = config.enabled;
    }
    if (config.stuckTaskThresholdMinutes !== undefined) {
      this.stuckTaskThresholdMinutes = config.stuckTaskThresholdMinutes;
    }
    if (config.checkInterval !== undefined) {
      this.checkInterval = config.checkInterval;

      // 重启定时器
      if (this.stuckTaskCheckTimer) {
        clearInterval(this.stuckTaskCheckTimer);
        this.stuckTaskCheckTimer = setInterval(() => {
          this.checkStuckTasks().catch(error => {
            console.error('检查卡顿任务时出错:', error);
          });
        }, this.checkInterval);
      }
    }
  }

  /**
   * 获取当前配置
   */
  getConfig() {
    return {
      monitoringEnabled: this.monitoringEnabled,
      stuckTaskThresholdMinutes: this.stuckTaskThresholdMinutes,
      checkInterval: this.checkInterval,
      cachedTasksCount: this.taskCreationTimes.size
    };
  }
}

module.exports = TaskMonitorService; 