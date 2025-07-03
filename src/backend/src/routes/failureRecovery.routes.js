const express = require('express');
const router = express.Router();
const failureRecoveryService = require('../services/core/failureRecovery.service');
const authMiddleware = require('../middlewares/auth.middleware');
const logger = require('../utils/logger');

/**
 * 故障恢复服务 API 路由
 */

/**
 * 获取故障恢复服务状态
 */
router.get('/status', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    const stats = failureRecoveryService.getRecoveryStats();

    res.json({
      success: true,
      data: {
        service: 'FailureRecoveryService',
        status: stats.isRunning ? 'running' : 'stopped',
        stats: stats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('获取故障恢复服务状态失败:', error);
    next(error);
  }
});

/**
 * 启动故障恢复服务
 */
router.post('/start', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    await failureRecoveryService.start();

    res.json({
      success: true,
      message: '故障恢复服务已启动',
      data: {
        service: 'FailureRecoveryService',
        status: 'running',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('启动故障恢复服务失败:', error);
    next(error);
  }
});

/**
 * 停止故障恢复服务
 */
router.post('/stop', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    await failureRecoveryService.stop();

    res.json({
      success: true,
      message: '故障恢复服务已停止',
      data: {
        service: 'FailureRecoveryService',
        status: 'stopped',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('停止故障恢复服务失败:', error);
    next(error);
  }
});

/**
 * 手动触发故障恢复
 */
router.post('/trigger', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    await failureRecoveryService.triggerManualRecovery();

    res.json({
      success: true,
      message: '故障恢复已手动触发',
      data: {
        service: 'FailureRecoveryService',
        action: 'manual_trigger',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('手动触发故障恢复失败:', error);
    next(error);
  }
});

/**
 * 重置故障恢复统计
 */
router.post('/reset-stats', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    failureRecoveryService.resetStats();

    res.json({
      success: true,
      message: '故障恢复统计已重置',
      data: {
        service: 'FailureRecoveryService',
        action: 'reset_stats',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('重置故障恢复统计失败:', error);
    next(error);
  }
});

/**
 * 获取详细的故障恢复报告
 */
router.get('/report', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    const stats = failureRecoveryService.getRecoveryStats();

    // 计算成功率
    const totalRecoveries = stats.successfulRecoveries + stats.failedRecoveries;
    const successRate = totalRecoveries > 0 ?
      ((stats.successfulRecoveries / totalRecoveries) * 100).toFixed(2) : 100;

    // 计算平均发现率
    const avgStuckTasksPerCheck = stats.totalChecks > 0 ?
      (stats.stuckTasksFound / stats.totalChecks).toFixed(2) : 0;
    const avgTimeoutSubTasksPerCheck = stats.totalChecks > 0 ?
      (stats.timeoutSubTasksFound / stats.totalChecks).toFixed(2) : 0;

    const report = {
      service: 'FailureRecoveryService',
      status: stats.isRunning ? 'running' : 'stopped',
      config: stats.config,
      statistics: {
        totalChecks: stats.totalChecks,
        totalIssuesFound: stats.stuckTasksFound + stats.timeoutSubTasksFound,
        stuckTasksFound: stats.stuckTasksFound,
        timeoutSubTasksFound: stats.timeoutSubTasksFound,
        successfulRecoveries: stats.successfulRecoveries,
        failedRecoveries: stats.failedRecoveries,
        successRate: successRate + '%',
        avgStuckTasksPerCheck: avgStuckTasksPerCheck,
        avgTimeoutSubTasksPerCheck: avgTimeoutSubTasksPerCheck
      },
      timeline: {
        lastCheckTime: stats.lastCheckTime,
        nextCheckTime: stats.isRunning ?
          new Date(Date.now() + 5 * 60 * 1000).toISOString() : null
      },
      health: {
        status: stats.failedRecoveries === 0 ? 'healthy' : 'warning',
        message: stats.failedRecoveries === 0 ?
          '故障恢复服务运行正常' :
          `存在 ${stats.failedRecoveries} 次恢复失败`
      }
    };

    res.json({
      success: true,
      data: report,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('获取故障恢复报告失败:', error);
    next(error);
  }
});

/**
 * 健康检查接口
 */
router.get('/health', async (req, res, next) => {
  try {
    const stats = failureRecoveryService.getRecoveryStats();

    const health = {
      service: 'FailureRecoveryService',
      status: stats.isRunning ? 'running' : 'stopped',
      healthy: stats.failedRecoveries === 0,
      uptime: stats.totalChecks > 0 ? 'active' : 'inactive',
      lastCheck: stats.lastCheckTime,
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    logger.error('故障恢复健康检查失败:', error);
    next(error);
  }
});

module.exports = router; 