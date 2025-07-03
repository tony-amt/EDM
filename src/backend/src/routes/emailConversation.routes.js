const express = require('express');
const router = express.Router();
const {
  getConversations,
  createConversation,
  getConversationDetail,
  sendReply,
  updateConversationStatus,
  markAsRead,
  getConversationStats
} = require('../controllers/emailConversation.controller');
const { protect } = require('../middlewares/auth.middleware');
const { body, param, query } = require('express-validator');
const validate = require('../middlewares/validation.middleware');

// 所有路由都需要认证
router.use(protect);

/**
 * @swagger
 * /api/conversations:
 *   get:
 *     summary: 获取邮件会话列表
 *     tags: [EmailConversations]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, closed, archived]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 会话列表获取成功
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['active', 'closed', 'archived']),
  validate
], getConversations);

/**
 * @swagger
 * /api/conversations/stats:
 *   get:
 *     summary: 获取会话统计信息
 *     tags: [EmailConversations]
 *     responses:
 *       200:
 *         description: 统计信息获取成功
 */
router.get('/stats', getConversationStats);

/**
 * @swagger
 * /api/conversations:
 *   post:
 *     summary: 创建新会话
 *     tags: [EmailConversations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subject:
 *                 type: string
 *               participants:
 *                 type: array
 *                 items:
 *                   type: string
 *               email_service_id:
 *                 type: string
 *                 format: uuid
 *               initial_message:
 *                 type: object
 *                 properties:
 *                   to_email:
 *                     type: string
 *                   body:
 *                     type: string
 *                   html_body:
 *                     type: string
 *             required:
 *               - subject
 *               - participants
 *               - email_service_id
 *     responses:
 *       201:
 *         description: 会话创建成功
 *       400:
 *         description: 请求参数错误
 */
router.post('/', [
  body('subject').isString().trim().withMessage('主题不能为空'),
  body('participants').isArray().withMessage('参与者必须是数组'),
  body('email_service_id').isUUID().withMessage('邮件服务ID必须是有效的UUID'),
  body('initial_message.to_email').optional().isEmail().withMessage('收件人邮箱格式不正确'),
  body('initial_message.body').optional().isString().withMessage('邮件内容必须是字符串'),
  validate
], createConversation);

/**
 * @swagger
 * /api/conversations/{id}:
 *   get:
 *     summary: 获取会话详情和消息列表
 *     tags: [EmailConversations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: 会话详情获取成功
 *       404:
 *         description: 会话不存在
 */
router.get('/:id', [
  param('id').isUUID().withMessage('会话ID必须是有效的UUID'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validate
], getConversationDetail);

/**
 * @swagger
 * /api/conversations/{id}/reply:
 *   post:
 *     summary: 发送回复邮件
 *     tags: [EmailConversations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subject:
 *                 type: string
 *               content_text:
 *                 type: string
 *               content_html:
 *                 type: string
 *             required:
 *               - content_text
 *     responses:
 *       201:
 *         description: 回复发送成功
 *       400:
 *         description: 请求参数错误
 *       404:
 *         description: 会话不存在
 */
router.post('/:id/reply', [
  param('id').isUUID().withMessage('会话ID必须是有效的UUID'),
  body('subject').optional().isString().trim(),
  body('content_text').optional().isString(),
  body('content_html').optional().isString(),
  validate
], sendReply);

/**
 * @swagger
 * /api/conversations/{id}/status:
 *   patch:
 *     summary: 更新会话状态
 *     tags: [EmailConversations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, closed, archived]
 *             required:
 *               - status
 *     responses:
 *       200:
 *         description: 状态更新成功
 *       400:
 *         description: 无效的状态值
 *       404:
 *         description: 会话不存在
 */
router.patch('/:id/status', [
  param('id').isUUID().withMessage('会话ID必须是有效的UUID'),
  body('status').isIn(['active', 'closed', 'archived']).withMessage('无效的会话状态'),
  validate
], updateConversationStatus);

/**
 * @swagger
 * /api/conversations/{id}/mark-read:
 *   post:
 *     summary: 标记会话为已读
 *     tags: [EmailConversations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: 标记成功
 *       404:
 *         description: 会话不存在
 */
router.post('/:id/mark-read', [
  param('id').isUUID().withMessage('会话ID必须是有效的UUID'),
  validate
], markAsRead);

module.exports = router; 