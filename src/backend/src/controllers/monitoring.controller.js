/**
 * 监控系统控制器 - 简化版本
 * 提供系统健康检查和基础监控功能
 */
const logger = require('../utils/logger');

/**
 * 获取系统健康状态
 */
const getSystemHealth = async (req, res, next) => {
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version,
      environment: process.env.NODE_ENV || 'development',
      services: {
        api: 'healthy',
        database: 'checking...',
        redis: 'checking...',
        queue: 'healthy'
      }
    };

    // 简单的数据库连接检查
    try {
      const db = require('../models/index');
      await db.sequelize.authenticate();
      healthStatus.services.database = 'healthy';
    } catch (error) {
      healthStatus.services.database = 'unhealthy';
      healthStatus.status = 'degraded';
    }

    res.json({
      success: true,
      data: healthStatus
    });
  } catch (error) {
    logger.error('获取系统健康状态失败:', error);
    next(error);
  }
};

/**
 * 获取系统性能指标
 */
const getPerformanceMetrics = async (req, res, next) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        platform: process.platform,
        arch: process.arch
      },
      application: {
        version: process.version,
        environment: process.env.NODE_ENV || 'development',
        pid: process.pid
      }
    };

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('获取性能指标失败:', error);
    next(error);
  }
};

/**
 * 获取任务监控信息
 */
const getTaskMetrics = async (req, res, next) => {
  try {
    const { taskId } = req.params;

    // 暂时返回模拟数据
    const taskMetrics = {
      taskId: taskId,
      status: 'running',
      progress: '50%',
      startTime: new Date(Date.now() - 300000).toISOString(), // 5分钟前
      estimatedCompletion: new Date(Date.now() + 300000).toISOString(), // 5分钟后
      metrics: {
        emailsSent: 150,
        emailsTotal: 300,
        successRate: 98.5,
        avgResponseTime: 120
      }
    };

    res.json({
      success: true,
      data: taskMetrics
    });
  } catch (error) {
    logger.error('获取任务指标失败:', error);
    next(error);
  }
};

/**
 * 获取告警列表
 */
const getAlerts = async (req, res, next) => {
  try {
    // 暂时返回模拟数据
    const alerts = [
      {
        id: 1,
        type: 'performance',
        severity: 'medium',
        message: '内存使用率较高',
        timestamp: new Date().toISOString(),
        resolved: false
      }
    ];

    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    logger.error('获取告警列表失败:', error);
    next(error);
  }
};

/**
 * 获取队列状态
 */
const getQueueStatus = async (req, res, next) => {
  try {
    const queueStatus = {
      timestamp: new Date().toISOString(),
      queues: {
        pending: 5,
        processing: 2,
        completed: 148,
        failed: 3
      },
      workers: {
        active: 3,
        idle: 1,
        total: 4
      }
    };

    res.json({
      success: true,
      data: queueStatus
    });
  } catch (error) {
    logger.error('获取队列状态失败:', error);
    next(error);
  }
};

module.exports = {
  getSystemHealth,
  getPerformanceMetrics,
  getTaskMetrics,
  getAlerts,
  getQueueStatus
};