const express = require('express');
const router = express.Router();
const EmailReplyController = require('../controllers/emailReply.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

/**
 * @api {post} /api/email-reply/process 处理邮件回复
 * @apiName ProcessEmailReply
 * @apiGroup EmailReply
 * @apiDescription 处理收到的邮件回复（通过webhook调用）
 * 
 * @apiParam {String} to 收件人地址（sender@domain格式）
 * @apiParam {String} from 发件人地址
 * @apiParam {String} subject 邮件主题
 * @apiParam {String} body 邮件内容
 * @apiParam {Date} [received_at] 接收时间
 * @apiParam {Object} [headers] 邮件头信息
 * 
 * @apiSuccess {Boolean} success 处理成功标志
 * @apiSuccess {String} message 处理结果信息
 * @apiSuccess {Object} data 处理结果数据
 * 
 * @apiError (400) BadRequest 邮件数据无效
 */
router.post('/process', EmailReplyController.processEmailReply);

/**
 * @api {post} /api/email-reply/send 发送回复邮件
 * @apiName SendEmailReply
 * @apiGroup EmailReply
 * @apiDescription 发送回复邮件
 * 
 * @apiHeader {String} Authorization 用户认证token
 * 
 * @apiParam {String} conversationId 会话ID
 * @apiParam {String} subject 回复主题
 * @apiParam {String} body 回复内容
 * 
 * @apiSuccess {Boolean} success 发送成功标志
 * @apiSuccess {String} message 发送结果信息
 * @apiSuccess {Object} data 发送结果数据
 * 
 * @apiError (400) BadRequest 参数不完整
 * @apiError (401) Unauthorized 用户未登录
 * @apiError (404) NotFound 会话不存在
 */
router.post('/send', verifyToken, EmailReplyController.sendReply);

/**
 * @api {get} /api/email-reply/conversations 获取邮件会话列表
 * @apiName GetConversations
 * @apiGroup EmailReply
 * @apiDescription 获取用户的邮件会话列表
 * 
 * @apiHeader {String} Authorization 用户认证token
 * 
 * @apiParam {Number} [page=1] 页码
 * @apiParam {Number} [limit=20] 每页数量
 * @apiParam {String} [status=active] 会话状态
 * @apiParam {String} [search] 搜索关键词
 * 
 * @apiSuccess {Boolean} success 获取成功标志
 * @apiSuccess {String} message 获取结果信息
 * @apiSuccess {Object} data 会话列表数据
 * 
 * @apiError (401) Unauthorized 用户未登录
 */
router.get('/conversations', verifyToken, EmailReplyController.getConversations);

/**
 * @api {get} /api/email-reply/conversations/:id 获取会话详情
 * @apiName GetConversationDetail
 * @apiGroup EmailReply
 * @apiDescription 获取会话详情和消息列表
 * 
 * @apiHeader {String} Authorization 用户认证token
 * 
 * @apiParam {String} id 会话ID
 * @apiParam {Number} [page=1] 页码
 * @apiParam {Number} [limit=50] 每页消息数量
 * 
 * @apiSuccess {Boolean} success 获取成功标志
 * @apiSuccess {String} message 获取结果信息
 * @apiSuccess {Object} data 会话详情和消息列表
 * 
 * @apiError (401) Unauthorized 用户未登录
 * @apiError (404) NotFound 会话不存在或无权限访问
 */
router.get('/conversations/:id', verifyToken, EmailReplyController.getConversationDetail);

/**
 * @api {put} /api/email-reply/conversations/:id/status 更新会话状态
 * @apiName UpdateConversationStatus
 * @apiGroup EmailReply
 * @apiDescription 更新会话状态（活跃、暂停、已关闭等）
 * 
 * @apiHeader {String} Authorization 用户认证token
 * 
 * @apiParam {String} id 会话ID
 * @apiParam {String} status 新状态
 * 
 * @apiSuccess {Boolean} success 更新成功标志
 * @apiSuccess {String} message 更新结果信息
 * @apiSuccess {Object} data 更新后的会话数据
 * 
 * @apiError (401) Unauthorized 用户未登录
 * @apiError (404) NotFound 会话不存在或无权限访问
 */
router.put('/conversations/:id/status', verifyToken, EmailReplyController.updateConversationStatus);

/**
 * @api {get} /api/email-reply/stats 获取邮件回复统计
 * @apiName GetReplyStats
 * @apiGroup EmailReply
 * @apiDescription 获取用户的邮件回复统计信息
 * 
 * @apiHeader {String} Authorization 用户认证token
 * 
 * @apiSuccess {Boolean} success 获取成功标志
 * @apiSuccess {String} message 获取结果信息
 * @apiSuccess {Object} data 统计数据
 * 
 * @apiError (401) Unauthorized 用户未登录
 */
router.get('/stats', verifyToken, EmailReplyController.getReplyStats);

module.exports = router; 