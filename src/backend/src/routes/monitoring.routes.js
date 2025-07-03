/**
 * 监控系统路由 - 简化版本
 */
const express = require('express');
const router = express.Router();
const monitoringController = require('../controllers/monitoring.controller');

// 系统健康检查
router.get('/system-health', monitoringController.getSystemHealth);

// 系统性能指标
router.get('/performance-metrics', monitoringController.getPerformanceMetrics);

// 任务监控指标
router.get('/task-metrics/:taskId', monitoringController.getTaskMetrics);

// 告警列表
router.get('/alerts', monitoringController.getAlerts);

// 队列状态
router.get('/queue-status', monitoringController.getQueueStatus);

module.exports = router; 