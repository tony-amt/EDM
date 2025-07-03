const QueueSchedulerV2 = require('../services/core/queueSchedulerV2.service');
const { EmailService } = require('../models/index');
const logger = require('../utils/logger');

// 全局队列调度器实例
let queueScheduler = null;

/**
 * 🎯 启动队列调度器
 */
const startScheduler = async (req, res, next) => {
  try {
    if (!queueScheduler) {
      queueScheduler = new QueueSchedulerV2();
    }

    await queueScheduler.start();

    const status = await queueScheduler.getQueueStatus();

    res.json({
      success: true,
      message: '队列调度器启动成功',
      data: {
        scheduler_status: 'started',
        ...status
      }
    });

    logger.info('🚀 QueueSchedulerV2 通过API启动');

  } catch (error) {
    logger.error('❌ 启动队列调度器失败:', error);
    next(error);
  }
};

/**
 * 🎯 停止队列调度器
 */
const stopScheduler = async (req, res, next) => {
  try {
    if (queueScheduler) {
      await queueScheduler.stop();
    }

    res.json({
      success: true,
      message: '队列调度器停止成功',
      data: {
        scheduler_status: 'stopped'
      }
    });

    logger.info('🛑 QueueSchedulerV2 通过API停止');

  } catch (error) {
    logger.error('❌ 停止队列调度器失败:', error);
    next(error);
  }
};

/**
 * 🎯 获取队列状态
 */
const getQueueStatus = async (req, res, next) => {
  try {
    if (!queueScheduler) {
      return res.json({
        success: true,
        data: {
          scheduler_status: 'not_initialized',
          message: '队列调度器未初始化'
        }
      });
    }

    const status = await queueScheduler.getQueueStatus();

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error('❌ 获取队列状态失败:', error);
    next(error);
  }
};

/**
 * 🎯 获取服务状态统计
 */
const getServiceStats = async (req, res, next) => {
  try {
    const { hours = 24 } = req.query;

    // 使用EmailService的静态方法
    const stats = await EmailService.getServiceStats(null, parseInt(hours));

    res.json({
      success: true,
      data: {
        service_stats: stats,
        summary: {
          total_services: stats.length,
          available_services: stats.filter(s => s.is_available).length,
          average_success_rate: stats.length > 0 ?
            (stats.reduce((sum, s) => sum + s.success_rate, 0) / stats.length).toFixed(2) : 0,
          average_response_time: stats.length > 0 ?
            Math.round(stats.reduce((sum, s) => sum + s.avg_response_time, 0) / stats.length) : 0
        }
      }
    });

  } catch (error) {
    logger.error('❌ 获取服务统计失败:', error);
    next(error);
  }
};

/**
 * 🎯 手动触发队列处理
 */
const triggerProcessing = async (req, res, next) => {
  try {
    if (!queueScheduler) {
      return res.status(400).json({
        success: false,
        message: '队列调度器未初始化'
      });
    }

    if (!queueScheduler.isRunning) {
      return res.status(400).json({
        success: false,
        message: '队列调度器未运行'
      });
    }

    // 手动触发一次处理
    setImmediate(() => queueScheduler.processGlobalQueue());

    res.json({
      success: true,
      message: '手动触发队列处理成功',
      data: {
        triggered_at: new Date().toISOString()
      }
    });

    logger.info('🔧 手动触发队列处理');

  } catch (error) {
    logger.error('❌ 手动触发队列处理失败:', error);
    next(error);
  }
};

/**
 * 🎯 获取队列调度器健康状态
 */
const getHealthStatus = async (req, res, next) => {
  try {
    const healthData = {
      scheduler_initialized: !!queueScheduler,
      scheduler_running: queueScheduler ? queueScheduler.isRunning : false,
      timestamp: new Date().toISOString()
    };

    if (queueScheduler) {
      const queueStatus = await queueScheduler.getQueueStatus();
      healthData.queue_status = queueStatus;

      if (queueScheduler.taskWaitMonitor && queueScheduler.taskWaitMonitor.getStatus) {
        healthData.wait_monitor_status = queueScheduler.taskWaitMonitor.getStatus();
      }
    }

    res.json({
      success: true,
      data: healthData
    });

  } catch (error) {
    logger.error('❌ 获取健康状态失败:', error);
    next(error);
  }
};

/**
 * 🎯 获取可用服务列表
 */
const getReadyServices = async (req, res, next) => {
  try {
    if (!queueScheduler) {
      return res.status(400).json({
        success: false,
        message: '队列调度器未初始化'
      });
    }

    const services = await queueScheduler.getReadyServices();

    res.json({
      success: true,
      data: {
        ready_services: services.map(service => ({
          id: service.id,
          name: service.name,
          domain: service.domain,
          used_quota: service.used_quota,
          daily_quota: service.daily_quota,
          quota_percentage: Math.round((service.used_quota / service.daily_quota) * 100),
          success_rate: parseFloat(service.success_rate || 100),
          avg_response_time: service.avg_response_time || 0,
          last_sent_at: service.last_sent_at,
          next_available_at: service.next_available_at,
          is_available: service.isAvailable ? service.isAvailable() : true
        })),
        total_count: services.length
      }
    });

  } catch (error) {
    logger.error('❌ 获取可用服务失败:', error);
    next(error);
  }
};

/**
 * 🔧 调试接口：测试EmailService.getReadyServices()
 */
const debugEmailServices = async (req, res, next) => {
  try {
    const { EmailService } = require('../models/index');

    // 1. 获取所有服务
    const allServices = await EmailService.findAll({
      attributes: ['id', 'name', 'is_enabled', 'used_quota', 'daily_quota', 'next_available_at']
    });

    // 2. 测试getReadyServices静态方法
    const readyServices = await EmailService.getReadyServices();

    // 3. 测试每个服务的isAvailable方法
    const serviceDetails = allServices.map(service => ({
      id: service.id,
      name: service.name,
      is_enabled: service.is_enabled,
      used_quota: service.used_quota,
      daily_quota: service.daily_quota,
      next_available_at: service.next_available_at,
      isAvailable: service.isAvailable()
    }));

    res.json({
      success: true,
      data: {
        all_services_count: allServices.length,
        ready_services_count: readyServices.length,
        service_details: serviceDetails,
        ready_services: readyServices.map(s => ({
          id: s.id,
          name: s.name,
          isAvailable: s.isAvailable()
        }))
      }
    });

  } catch (error) {
    logger.error('❌ 调试EmailService失败:', error);
    next(error);
  }
};

// ============================================================================
// 🎯 Phase 5: 管理员控制接口
// ============================================================================

/**
 * 📊 获取队列状态详情
 */
const getQueueStatusDetail = async (req, res, next) => {
  try {
    const queueScheduler = global.queueSchedulerV2Instance;
    if (!queueScheduler) {
      return res.status(503).json({
        success: false,
        message: '队列调度器未启动'
      });
    }

    const status = await queueScheduler.getQueueStatus();
    
    res.json({
      success: true,
      data: {
        ...status,
        systemInfo: {
          nodeVersion: process.version,
          platform: process.platform,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage()
        }
      }
    });

  } catch (error) {
    logger.error('获取队列状态详情失败:', error);
    next(error);
  }
}

/**
 * ⚙️ 更新队列配置
 */
const updateQueueConfig = async (req, res, next) => {
  try {
    const queueScheduler = global.queueSchedulerV2Instance;
    if (!queueScheduler) {
      return res.status(503).json({
        success: false,
        message: '队列调度器未启动'
      });
    }

    const {
      task_supplement_interval,
      service_scan_interval,
      service_max_queue_size,
      queue_memory_optimization,
      failure_block_strategy
    } = req.body;

    // 验证配置参数
    if (task_supplement_interval && (task_supplement_interval < 5000 || task_supplement_interval > 300000)) {
      return res.status(400).json({
        success: false,
        message: '任务补充间隔必须在5秒到5分钟之间'
      });
    }

    if (service_scan_interval && (service_scan_interval < 1000 || service_scan_interval > 60000)) {
      return res.status(400).json({
        success: false,
        message: '服务扫描间隔必须在1秒到1分钟之间'
      });
    }

    if (service_max_queue_size && (service_max_queue_size < 1 || service_max_queue_size > 100)) {
      return res.status(400).json({
        success: false,
        message: '服务最大队列长度必须在1到100之间'
      });
    }

    // 更新配置
    const oldConfig = { ...queueScheduler.config };
    
    if (task_supplement_interval) queueScheduler.config.task_supplement_interval = task_supplement_interval;
    if (service_scan_interval) queueScheduler.config.service_scan_interval = service_scan_interval;
    if (service_max_queue_size) queueScheduler.config.service_max_queue_size = service_max_queue_size;
    if (queue_memory_optimization !== undefined) queueScheduler.config.queue_memory_optimization = queue_memory_optimization;
    if (failure_block_strategy !== undefined) queueScheduler.config.failure_block_strategy = failure_block_strategy;

    // 如果间隔时间有变化，需要重启定时器
    if (task_supplement_interval || service_scan_interval) {
      await this.restartQueueTimers(queueScheduler);
    }

    logger.info('📊 队列配置已更新', {
      oldConfig,
      newConfig: queueScheduler.config,
      updatedBy: req.user?.id || 'system'
    });

    res.json({
      success: true,
      message: '队列配置更新成功',
      data: {
        oldConfig,
        newConfig: queueScheduler.config
      }
    });

  } catch (error) {
    logger.error('更新队列配置失败:', error);
    next(error);
  }
}

/**
 * 🔄 重启队列定时器
 */
const restartQueueTimers = async (queueScheduler) => {
  try {
    logger.info('🔄 重启队列定时器');

    // 停止现有定时器
    if (queueScheduler.taskSupplementTimer) {
      clearInterval(queueScheduler.taskSupplementTimer);
      queueScheduler.taskSupplementTimer = null;
    }

    if (queueScheduler.serviceProcessTimer) {
      clearInterval(queueScheduler.serviceProcessTimer);
      queueScheduler.serviceProcessTimer = null;
    }

    // 重新启动定时器
    queueScheduler.startTaskSupplementTimer();
    queueScheduler.startServiceProcessTimer();

    logger.info('✅ 队列定时器重启成功');

  } catch (error) {
    logger.error('❌ 重启队列定时器失败:', error);
    throw error;
  }
}

/**
 * 🧹 全局队列清空
 */
const clearAllQueues = async (req, res, next) => {
  try {
    const queueScheduler = global.queueSchedulerV2Instance;
    if (!queueScheduler) {
      return res.status(503).json({
        success: false,
        message: '队列调度器未启动'
      });
    }

    const beforeStatus = await queueScheduler.getQueueStatus();
    
    // 执行清空操作
    await queueScheduler.clearAllQueues();
    
    const afterStatus = await queueScheduler.getQueueStatus();

    logger.info('🧹 管理员执行全局队列清空', {
      beforeTotalTasks: beforeStatus.metrics.totalQueuedTasks,
      afterTotalTasks: afterStatus.metrics.totalQueuedTasks,
      operatedBy: req.user?.id || 'system'
    });

    res.json({
      success: true,
      message: '全局队列清空成功',
      data: {
        before: beforeStatus.metrics,
        after: afterStatus.metrics
      }
    });

  } catch (error) {
    logger.error('全局队列清空失败:', error);
    next(error);
  }
}

/**
 * 🔓 解除服务阻塞
 */
const unblockService = async (req, res, next) => {
  try {
    const queueScheduler = global.queueSchedulerV2Instance;
    if (!queueScheduler) {
      return res.status(503).json({
        success: false,
        message: '队列调度器未启动'
      });
    }

    const { serviceId } = req.params;
    
    if (!serviceId) {
      return res.status(400).json({
        success: false,
        message: '服务ID不能为空'
      });
    }

    // 检查服务是否存在
    const service = await EmailService.findByPk(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: '服务不存在'
      });
    }

    // 解除阻塞
    queueScheduler.metrics.blockedServices.delete(parseInt(serviceId));
    
    // 重置服务状态
    queueScheduler.serviceStatus.delete(parseInt(serviceId));

    logger.info('🔓 管理员解除服务阻塞', {
      serviceId,
      serviceName: service.name,
      operatedBy: req.user?.id || 'system'
    });

    res.json({
      success: true,
      message: `服务 ${service.name} 阻塞状态已解除`,
      data: {
        serviceId,
        serviceName: service.name
      }
    });

  } catch (error) {
    logger.error('解除服务阻塞失败:', error);
    next(error);
  }
};

/**
 * 🔄 手动触发任务补充
 */
const manualTaskSupplement = async (req, res, next) => {
  try {
    const queueScheduler = global.queueSchedulerV2Instance;
    if (!queueScheduler) {
      return res.status(503).json({
        success: false,
        message: '队列调度器未启动'
      });
    }

    const beforeStatus = await queueScheduler.getQueueStatus();
    
    // 手动触发任务补充
    await queueScheduler.supplementTasksToQueues();
    
    const afterStatus = await queueScheduler.getQueueStatus();

    const supplemented = afterStatus.metrics.totalQueuedTasks - beforeStatus.metrics.totalQueuedTasks;

    logger.info('🔄 管理员手动触发任务补充', {
      supplemented,
      operatedBy: req.user?.id || 'system'
    });

    res.json({
      success: true,
      message: '任务补充完成',
      data: {
        supplemented,
        before: beforeStatus.metrics,
        after: afterStatus.metrics
      }
    });

  } catch (error) {
    logger.error('手动任务补充失败:', error);
    next(error);
  }
};

/**
 * ⚡ 手动触发服务处理
 */
const manualServiceProcess = async (req, res, next) => {
  try {
    const queueScheduler = global.queueSchedulerV2Instance;
    if (!queueScheduler) {
      return res.status(503).json({
        success: false,
        message: '队列调度器未启动'
      });
    }

    const beforeStatus = await queueScheduler.getQueueStatus();
    
    // 手动触发服务处理
    await queueScheduler.processServiceQueues();
    
    const afterStatus = await queueScheduler.getQueueStatus();

    const processed = beforeStatus.metrics.totalQueuedTasks - afterStatus.metrics.totalQueuedTasks;

    logger.info('⚡ 管理员手动触发服务处理', {
      processed,
      operatedBy: req.user?.id || 'system'
    });

    res.json({
      success: true,
      message: '服务处理完成',
      data: {
        processed,
        before: beforeStatus.metrics,
        after: afterStatus.metrics
      }
    });

  } catch (error) {
    logger.error('手动服务处理失败:', error);
    next(error);
  }
};

/**
 * 📈 获取队列性能指标
 */
const getQueueMetrics = async (req, res, next) => {
  try {
    const queueScheduler = global.queueSchedulerV2Instance;
    if (!queueScheduler) {
      return res.status(503).json({
        success: false,
        message: '队列调度器未启动'
      });
    }

    const status = await queueScheduler.getQueueStatus();
    
    // 计算性能指标
    const metrics = {
      currentStatus: status.metrics,
      configuration: status.config,
      queueDetails: status.queueDetails,
      systemPerformance: {
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        uptime: process.uptime()
      },
      queueEfficiency: {
        totalServices: Object.keys(status.queueDetails).length,
        activeServices: status.metrics.activeServices,
        blockedServices: status.metrics.blockedServices.length,
        averageQueueLength: calculateAverageQueueLength(status.queueDetails)
      }
    };

    res.json({
      success: true,
      data: metrics
    });

  } catch (error) {
    logger.error('获取队列性能指标失败:', error);
    next(error);
  }
};

/**
 * 📊 计算平均队列长度
 */
const calculateAverageQueueLength = (queueDetails) => {
  const serviceCounts = Object.values(queueDetails);
  if (serviceCounts.length === 0) return 0;
  
  const totalLength = serviceCounts.reduce((sum, service) => sum + service.queueLength, 0);
  return (totalLength / serviceCounts.length).toFixed(2);
};

/**
 * 🔧 队列健康检查
 */
const queueHealthCheck = async (req, res, next) => {
  try {
    const queueScheduler = global.queueSchedulerV2Instance;
    if (!queueScheduler) {
      return res.status(503).json({
        success: false,
        message: '队列调度器未启动',
        health: 'unhealthy'
      });
    }

    const status = await queueScheduler.getQueueStatus();
    
    // 健康检查逻辑
    const healthChecks = {
      scheduler_running: queueScheduler.isRunning,
      timers_active: !!(queueScheduler.taskSupplementTimer && queueScheduler.serviceProcessTimer),
      memory_usage_normal: process.memoryUsage().heapUsed < 1024 * 1024 * 1024, // 小于1GB
      no_excessive_blocked_services: status.metrics.blockedServices.length < 5,
      queue_not_overloaded: status.metrics.totalQueuedTasks < 1000
    };

    const healthyChecks = Object.values(healthChecks).filter(check => check).length;
    const totalChecks = Object.keys(healthChecks).length;
    const healthScore = (healthyChecks / totalChecks * 100).toFixed(2);

    const isHealthy = healthyChecks === totalChecks;

    res.json({
      success: true,
      health: isHealthy ? 'healthy' : 'degraded',
      score: `${healthScore}%`,
      checks: healthChecks,
      metrics: status.metrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('队列健康检查失败:', error);
    res.status(500).json({
      success: false,
      health: 'unhealthy',
      error: error.message
    });
  }
};
// 导出所有控制器方法
module.exports = {
  startScheduler,
  stopScheduler,
  getQueueStatus,
  getServiceStats,
  triggerProcessing,
  getHealthStatus,
  getReadyServices,
  debugEmailServices,
  // Phase 5: 新增的管理接口
  getQueueStatusDetail,
  updateQueueConfig,
  restartQueueTimers,
  clearAllQueues,
  unblockService,
  manualTaskSupplement,
  manualServiceProcess,
  getQueueMetrics,
  queueHealthCheck,
  // 导出队列调度器实例，供其他模块使用
  getSchedulerInstance: () => queueScheduler
};