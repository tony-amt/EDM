/**
 * V2.0 SubTask管理路由
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth.middleware');
const { 
  getSubTasks,
  getSubTaskById,
  rescheduleSubTask,
  cancelSubTask,
  bulkOperateSubTasks,
  getSubTaskStats
} = require('../controllers/subtask.controller');

/**
 * 获取SubTask列表
 */
router.get('/', verifyToken, getSubTasks);

/**
 * 获取SubTask统计信息
 */
router.get('/stats', verifyToken, getSubTaskStats);

/**
 * 获取SubTask详情
 */
router.get('/:id', verifyToken, getSubTaskById);

/**
 * 重新调度SubTask
 */
router.put('/:id/reschedule', verifyToken, rescheduleSubTask);

/**
 * 取消SubTask
 */
router.put('/:id/cancel', verifyToken, cancelSubTask);

/**
 * 批量操作SubTask
 */
router.post('/bulk', verifyToken, bulkOperateSubTasks);

module.exports = router;
