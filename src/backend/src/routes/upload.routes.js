const express = require('express');
const { UploadController, uploadMiddleware } = require('../controllers/upload.controller');
const { protect } = require('../middlewares/auth.middleware');
const router = express.Router();

/**
 * @api {post} /api/upload/image 上传图片
 * @apiName UploadImage
 * @apiGroup Upload
 * @apiDescription 上传图片并返回图片URL
 * 
 * @apiHeader {String} Authorization 用户认证token
 * 
 * @apiParam {File} image 要上传的图片文件
 * 
 * @apiSuccess {Boolean} success 上传成功标志
 * @apiSuccess {String} url 图片URL
 * @apiSuccess {String} filename 图片文件名
 * @apiSuccess {Number} [original_size] 原始文件大小(字节)
 * @apiSuccess {Number} [optimized_size] 优化后文件大小(字节)
 * @apiSuccess {String} [compression_rate] 压缩率
 * 
 * @apiError (400) BadRequest 请求参数错误
 * @apiError (401) Unauthorized 用户未登录
 * @apiError (500) InternalServerError 服务器内部错误
 */
router.post('/image', protect, uploadMiddleware, UploadController.uploadImage);

module.exports = router; 