const SystemPerformanceMetrics = require('../../models/index');
const os = require('os');
const { sequelize } = require('../../config');

/**
 * 系统监控服务
 * 负责监控系统资源使用情况、数据库性能、队列状态等
 */
class SystemMonitorService {
  constructor() {
    this.monitoringEnabled = true;
    this.monitoringInterval = 60 * 1000; // 1分钟监控一次
    this.timers = new Map();
  }

  /**
   * 启动系统监控服务
   */
  start() {
    console.log('🖥️  系统监控服务启动');

    this.startResourceMonitoring();
    this.startDatabaseMonitoring();
    this.startQueueMonitoring();
    this.startAPIMonitoring();
  }

  /**
   * 停止系统监控服务
   */
  stop() {
    console.log('🛑 系统监控服务停止');

    // 清理所有定时器
    for (const [name, timer] of this.timers) {
      clearInterval(timer);
      console.log(`停止监控: ${name}`);
    }
    this.timers.clear();
  }

  /**
   * 启动资源监控
   */
  startResourceMonitoring() {
    const timer = setInterval(async () => {
      try {
        await this.collectSystemResources();
      } catch (error) {
        console.error('收集系统资源信息时出错:', error);
      }
    }, this.monitoringInterval);

    this.timers.set('resource_monitoring', timer);
    console.log('✅ 资源监控已启动');
  }

  /**
   * 启动数据库监控
   */
  startDatabaseMonitoring() {
    const timer = setInterval(async () => {
      try {
        await this.collectDatabaseMetrics();
      } catch (error) {
        console.error('收集数据库指标时出错:', error);
      }
    }, this.monitoringInterval);

    this.timers.set('database_monitoring', timer);
    console.log('✅ 数据库监控已启动');
  }

  /**
   * 启动队列监控
   */
  startQueueMonitoring() {
    const timer = setInterval(async () => {
      try {
        await this.collectQueueMetrics();
      } catch (error) {
        console.error('收集队列指标时出错:', error);
      }
    }, this.monitoringInterval);

    this.timers.set('queue_monitoring', timer);
    console.log('✅ 队列监控已启动');
  }

  /**
   * 启动API监控
   */
  startAPIMonitoring() {
    // API监控通过中间件实现，这里只是初始化
    console.log('✅ API监控已初始化');
  }

  /**
   * 收集系统资源指标
   */
  async collectSystemResources() {
    try {
      // CPU使用率
      const cpuUsage = await this.getCPUUsage();
      await SystemPerformanceMetrics.recordSystemCPUUsage(cpuUsage);

      // 内存使用率
      const memoryUsage = this.getMemoryUsage();
      await SystemPerformanceMetrics.recordSystemMemoryUsage(memoryUsage.percentage);

      // 记录详细内存信息
      await SystemPerformanceMetrics.create({
        metric_name: 'system_memory_total',
        metric_value: memoryUsage.total,
        metric_unit: 'bytes',
        tags: { category: 'system' }
      });

      await SystemPerformanceMetrics.create({
        metric_name: 'system_memory_free',
        metric_value: memoryUsage.free,
        metric_unit: 'bytes',
        tags: { category: 'system' }
      });

      // 负载平均值
      const loadAverage = os.loadavg();
      await SystemPerformanceMetrics.create({
        metric_name: 'system_load_average_1m',
        metric_value: loadAverage[0],
        metric_unit: 'load',
        tags: { category: 'system' }
      });

      await SystemPerformanceMetrics.create({
        metric_name: 'system_load_average_5m',
        metric_value: loadAverage[1],
        metric_unit: 'load',
        tags: { category: 'system' }
      });

      // 系统正常运行时间
      const uptime = os.uptime();
      await SystemPerformanceMetrics.create({
        metric_name: 'system_uptime',
        metric_value: uptime,
        metric_unit: 'seconds',
        tags: { category: 'system' }
      });

      console.log(`📊 系统资源 - CPU: ${cpuUsage.toFixed(1)}%, 内存: ${memoryUsage.percentage.toFixed(1)}%, 负载: ${loadAverage[0].toFixed(2)}`);
    } catch (error) {
      console.error('收集系统资源指标时出错:', error);
    }
  }

  /**
   * 收集数据库性能指标
   */
  async collectDatabaseMetrics() {
    try {
      const startTime = Date.now();

      // 测试数据库连接响应时间
      await sequelize.authenticate();
      const connectionTime = Date.now() - startTime;

      await SystemPerformanceMetrics.recordDatabaseQueryTime(connectionTime, 'connection_test');

      // 获取数据库连接池状态
      const pool = sequelize.connectionManager.pool;
      if (pool) {
        const poolStats = {
          total: pool.options.max || 0,
          used: pool.used.length || 0,
          waiting: pool.pending.length || 0
        };

        const poolUsagePercent = poolStats.total > 0 ? (poolStats.used / poolStats.total) * 100 : 0;
        await SystemPerformanceMetrics.recordDatabaseConnectionPool(poolUsagePercent, {
          total_connections: poolStats.total,
          used_connections: poolStats.used,
          waiting_connections: poolStats.waiting
        });

        console.log(`🗄️  数据库 - 连接时间: ${connectionTime}ms, 连接池使用率: ${poolUsagePercent.toFixed(1)}%`);
      }

      // 检查数据库大小（如果支持）
      try {
        const [results] = await sequelize.query(`
          SELECT 
            pg_size_pretty(pg_database_size(current_database())) as size,
            pg_database_size(current_database()) as size_bytes
        `);

        if (results && results[0]) {
          await SystemPerformanceMetrics.create({
            metric_name: 'database_size',
            metric_value: results[0].size_bytes,
            metric_unit: 'bytes',
            tags: {
              category: 'database',
              size_pretty: results[0].size
            }
          });
        }
      } catch (error) {
        // 忽略数据库大小查询错误（可能权限不足）
      }

    } catch (error) {
      console.error('收集数据库指标时出错:', error);

      // 记录数据库连接失败
      await SystemPerformanceMetrics.create({
        metric_name: 'database_connection_status',
        metric_value: 0,
        metric_unit: 'boolean',
        tags: {
          category: 'database',
          error: error.message
        }
      });
    }
  }

  /**
   * 收集队列和邮件服务指标
   */
  async collectQueueMetrics() {
    try {
      // 这里需要根据实际的邮件服务模型来获取数据
      // 假设我们有EmailService模型
      const EmailService = require('../../models/index');
      const Task = require('../../models/index');
      const SubTask = require('../../models/index');

      // 统计可用邮件服务数量
      const availableServices = await EmailService.count({
        where: { status: 'active' }
      });

      await SystemPerformanceMetrics.recordAvailableServicesCount(availableServices);

      // 统计活跃任务数量
      const activeTasks = await Task.count({
        where: { status: 'sending' }
      });

      await SystemPerformanceMetrics.recordActiveTasksCount(activeTasks);

      // 统计待处理子任务数量
      const pendingSubtasks = await SubTask.count({
        where: { status: 'pending' }
      });

      await SystemPerformanceMetrics.create({
        metric_name: 'pending_subtasks_count',
        metric_value: pendingSubtasks,
        metric_unit: 'count',
        tags: { category: 'queue' }
      });

      // 统计发送中的子任务数量
      const sendingSubtasks = await SubTask.count({
        where: { status: 'sending' }
      });

      await SystemPerformanceMetrics.create({
        metric_name: 'sending_subtasks_count',
        metric_value: sendingSubtasks,
        metric_unit: 'count',
        tags: { category: 'queue' }
      });

      console.log(`📬 队列状态 - 可用服务: ${availableServices}, 活跃任务: ${activeTasks}, 待处理: ${pendingSubtasks}, 发送中: ${sendingSubtasks}`);

    } catch (error) {
      console.error('收集队列指标时出错:', error);
    }
  }

  /**
   * 记录API响应时间（由中间件调用）
   */
  async recordAPIMetrics(endpoint, method, responseTime, statusCode, error = null) {
    if (!this.monitoringEnabled) return;

    try {
      // 记录响应时间
      await SystemPerformanceMetrics.recordAPIResponseTime(responseTime, endpoint, method, {
        status_code: statusCode,
        has_error: !!error
      });

      // 如果有错误，记录错误率
      if (error) {
        await SystemPerformanceMetrics.create({
          metric_name: 'api_error_count',
          metric_value: 1,
          metric_unit: 'count',
          tags: {
            endpoint,
            method,
            status_code: statusCode,
            error_type: error.name || 'unknown',
            category: 'api_error'
          }
        });
      }

      // 记录API调用计数
      await SystemPerformanceMetrics.create({
        metric_name: 'api_request_count',
        metric_value: 1,
        metric_unit: 'count',
        tags: {
          endpoint,
          method,
          status_code: statusCode,
          category: 'api'
        }
      });

    } catch (recordError) {
      console.error('记录API指标时出错:', recordError);
    }
  }

  /**
   * 计算API错误率
   */
  async calculateAPIErrorRate(timeWindowMinutes = 5) {
    try {
      const startTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000);

      // 获取总请求数
      const totalRequests = await SystemPerformanceMetrics.findAll({
        where: {
          metric_name: 'api_request_count',
          timestamp: {
            [require('sequelize').Op.gte]: startTime
          }
        },
        attributes: [
          [sequelize.fn('SUM', sequelize.col('metric_value')), 'total']
        ],
        raw: true
      });

      // 获取错误请求数
      const errorRequests = await SystemPerformanceMetrics.findAll({
        where: {
          metric_name: 'api_error_count',
          timestamp: {
            [require('sequelize').Op.gte]: startTime
          }
        },
        attributes: [
          [sequelize.fn('SUM', sequelize.col('metric_value')), 'total']
        ],
        raw: true
      });

      const total = parseInt(totalRequests[0]?.total || 0);
      const errors = parseInt(errorRequests[0]?.total || 0);
      const errorRate = total > 0 ? (errors / total) * 100 : 0;

      // 记录错误率
      await SystemPerformanceMetrics.recordAPIErrorRate(errorRate, 'all_endpoints');

      return errorRate;
    } catch (error) {
      console.error('计算API错误率时出错:', error);
      return 0;
    }
  }

  /**
   * 获取CPU使用率
   */
  async getCPUUsage() {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const startUsage = process.cpuUsage();

      setTimeout(() => {
        const endTime = Date.now();
        const endUsage = process.cpuUsage(startUsage);

        const totalTime = (endTime - startTime) * 1000; // 转换为微秒
        const userTime = endUsage.user;
        const systemTime = endUsage.system;

        const cpuPercent = ((userTime + systemTime) / totalTime) * 100;
        resolve(Math.min(100, Math.max(0, cpuPercent)));
      }, 100);
    });
  }

  /**
   * 获取内存使用情况
   */
  getMemoryUsage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const percentage = (usedMemory / totalMemory) * 100;

    return {
      total: totalMemory,
      free: freeMemory,
      used: usedMemory,
      percentage
    };
  }

  /**
   * 获取系统健康状态
   */
  async getSystemHealthStatus() {
    try {
      return await SystemPerformanceMetrics.getSystemHealthStatus();
    } catch (error) {
      console.error('获取系统健康状态时出错:', error);
      return {
        health_score: 0,
        status: 'unknown',
        error: error.message
      };
    }
  }

  /**
   * 设置监控配置
   */
  setConfig(config) {
    if (config.enabled !== undefined) {
      this.monitoringEnabled = config.enabled;
    }

    if (config.monitoringInterval !== undefined) {
      this.monitoringInterval = config.monitoringInterval;

      // 重启监控定时器
      this.stop();
      if (this.monitoringEnabled) {
        this.start();
      }
    }
  }

  /**
   * 获取当前配置
   */
  getConfig() {
    return {
      monitoringEnabled: this.monitoringEnabled,
      monitoringInterval: this.monitoringInterval,
      activeTimers: Array.from(this.timers.keys())
    };
  }

  /**
   * 获取监控统计
   */
  async getMonitoringStats(startTime, endTime) {
    try {
      const metrics = await SystemPerformanceMetrics.findAll({
        where: {
          timestamp: {
            [require('sequelize').Op.between]: [startTime, endTime]
          }
        },
        attributes: [
          'metric_name',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('AVG', sequelize.col('metric_value')), 'avg_value'],
          [sequelize.fn('MIN', sequelize.col('metric_value')), 'min_value'],
          [sequelize.fn('MAX', sequelize.col('metric_value')), 'max_value']
        ],
        group: ['metric_name'],
        raw: true
      });

      return metrics.reduce((acc, metric) => {
        acc[metric.metric_name] = {
          count: parseInt(metric.count),
          avg_value: parseFloat(metric.avg_value),
          min_value: parseFloat(metric.min_value),
          max_value: parseFloat(metric.max_value)
        };
        return acc;
      }, {});
    } catch (error) {
      console.error('获取监控统计时出错:', error);
      return {};
    }
  }
}

module.exports = SystemMonitorService; 