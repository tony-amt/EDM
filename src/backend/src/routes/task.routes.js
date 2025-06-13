const express = require('express');
const { body, param, query } = require('express-validator');
const TaskController = require('../controllers/task.controller');
const { protect } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validation.middleware');

const router = express.Router();

// V2.0: 所有路由都需要认证
router.use(protect);

/**
 * V2.0: 创建群发任务
 * POST /api/tasks
 */
router.post('/', [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Task name is required')
    .isLength({ max: 255 })
    .withMessage('Task name must be less than 255 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  
  body('schedule_time')
    .optional()
    .isISO8601()
    .withMessage('Valid schedule time is required'),
  
  body('sender_id')
    .isUUID()
    .withMessage('Valid sender ID is required'),
  
  body('template_ids')
    .isArray({ min: 1 })
    .withMessage('At least one template ID is required'),
  
  body('template_ids.*')
    .isUUID()
    .withMessage('Each template ID must be a valid UUID'),
  
  body('recipient_rule')
    .isObject()
    .withMessage('Recipient rule must be an object'),
  
  body('recipient_rule.type')
    .isIn(['specific', 'tag_based', 'all_contacts'])
    .withMessage('Invalid recipient rule type'),
  
  validate
], TaskController.createTask);

/**
 * V2.0: 获取任务列表
 * GET /api/tasks
 */
router.get('/', [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('status')
    .optional()
    .customSanitizer(value => value === '' ? undefined : value)
    .isIn(['draft', 'scheduled', 'sending', 'paused', 'completed', 'failed', 'cancelled'])
    .withMessage('Invalid status filter'),
  
  query('name')
    .optional()
    .customSanitizer(value => value === '' ? undefined : value)
    .trim()
    .isLength({ max: 100 })
    .withMessage('Name filter must be less than 100 characters'),
  
  query('search')
    .optional()
    .customSanitizer(value => value === '' ? undefined : value)
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),
  
  validate
], TaskController.getTasks);

/**
 * V2.0: 获取任务统计
 * GET /api/tasks/stats
 */
router.get('/stats', TaskController.getTaskStats);

/**
 * V2.0: 获取单个任务详情
 * GET /api/tasks/:id
 */
router.get('/:id', [
  param('id')
    .isUUID()
    .withMessage('Valid task ID is required'),
  
  validate
], TaskController.getTaskById);

/**
 * V2.0: 更新任务状态
 * PATCH /api/tasks/:id/status
 */
router.patch('/:id/status', [
  param('id')
    .isUUID()
    .withMessage('Valid task ID is required'),
  
  body('status')
    .isIn(['draft', 'scheduled', 'sending', 'paused', 'completed', 'failed', 'cancelled', 'closed'])
    .withMessage('Invalid status'),
  
  validate
], TaskController.updateTaskStatus);

/**
 * V2.0: 更新任务
 * PUT /api/tasks/:id
 */
router.put('/:id', [
  param('id')
    .isUUID()
    .withMessage('Valid task ID is required'),
  
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Task name cannot be empty')
    .isLength({ max: 255 })
    .withMessage('Task name must be less than 255 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  
  body('schedule_time')
    .optional()
    .isISO8601()
    .withMessage('Valid schedule time is required'),
  
  body('template_ids')
    .optional()
    .isArray({ min: 1 })
    .withMessage('At least one template ID is required'),
  
  body('template_ids.*')
    .optional()
    .isUUID()
    .withMessage('Each template ID must be a valid UUID'),
  
  body('recipient_rule')
    .optional()
    .isObject()
    .withMessage('Recipient rule must be an object'),
  
  body('recipient_rule.type')
    .optional()
    .isIn(['specific', 'tag_based', 'all_contacts'])
    .withMessage('Invalid recipient rule type'),
  
  validate
], TaskController.updateTask);

/**
 * V2.0: 删除任务
 * DELETE /api/tasks/:id
 */
router.delete('/:id', [
  param('id')
    .isUUID()
    .withMessage('Valid task ID is required'),
  
  validate
], TaskController.deleteTask);

/**
 * V2.0: 获取任务的SubTask列表
 * GET /api/tasks/:id/subtasks
 */
router.get('/:id/subtasks', [
  param('id')
    .isUUID()
    .withMessage('Valid task ID is required'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('status')
    .optional()
    .isIn(['pending', 'sent', 'delivered', 'bounced', 'opened', 'clicked', 'failed'])
    .withMessage('Invalid status filter'),
  
  validate
], TaskController.getTaskSubTasks);

/**
 * V2.0: 获取任务详细分析报告
 * GET /api/tasks/:id/analytics
 */
router.get('/:id/analytics', [
  param('id')
    .isUUID()
    .withMessage('Valid task ID is required'),
  
  validate
], TaskController.getTaskAnalytics);

/**
 * V2.0: 获取任务实时统计
 * GET /api/tasks/:id/stats
 */
router.get('/:id/stats', [
  param('id')
    .isUUID()
    .withMessage('Valid task ID is required'),
  
  validate
], TaskController.getTaskRealTimeStats);

/**
 * V2.0: 获取SubTask热力图数据
 * GET /api/tasks/:id/heatmap
 */
router.get('/:id/heatmap', [
  param('id')
    .isUUID()
    .withMessage('Valid task ID is required'),
  
  query('date')
    .optional()
    .isISO8601()
    .withMessage('Valid date is required'),
  
  validate
], TaskController.getTaskHeatmap);

/**
 * V2.0: 立即调度任务
 * POST /api/tasks/:id/schedule-now
 */
router.post('/:id/schedule-now', [
  param('id')
    .isUUID()
    .withMessage('Valid task ID is required'),
  
  validate
], TaskController.scheduleTaskNow);

/**
 * V2.0: 复制任务
 * POST /api/tasks/:id/copy
 */
router.post('/:id/copy', [
  param('id')
    .isUUID()
    .withMessage('Valid task ID is required'),
  
  body('name')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Task name must be less than 255 characters'),
  
  validate
], TaskController.copyTask);

/**
 * V2.0: 暂停任务
 * POST /api/tasks/:id/pause
 */
router.post('/:id/pause', [
  param('id')
    .isUUID()
    .withMessage('Valid task ID is required'),
  
  validate
], TaskController.pauseTask);

/**
 * V2.0: 恢复任务
 * POST /api/tasks/:id/resume
 */
router.post('/:id/resume', [
  param('id')
    .isUUID()
    .withMessage('Valid task ID is required'),
  
  validate
], TaskController.resumeTask);

/**
 * V2.0: 批量更新SubTask状态
 * POST /api/tasks/:id/subtasks/batch-update
 */
router.post('/:id/subtasks/batch-update', [
  param('id')
    .isUUID()
    .withMessage('Valid task ID is required'),
  
  body('subtask_ids')
    .isArray({ min: 1 })
    .withMessage('At least one subtask ID is required'),
  
  body('subtask_ids.*')
    .isUUID()
    .withMessage('All subtask IDs must be valid UUIDs'),
  
  body('status')
    .isIn(['pending', 'sent', 'delivered', 'bounced', 'opened', 'clicked', 'failed'])
    .withMessage('Invalid status'),
  
  validate
], TaskController.batchUpdateSubTaskStatus);

/**
 * V2.0: 手动检查并更新任务状态
 * POST /api/tasks/:id/check-status
 */
router.post('/:id/check-status', [
  param('id')
    .isUUID()
    .withMessage('Valid task ID is required'),
  
  validate
], TaskController.checkTaskStatus);

module.exports = router; 