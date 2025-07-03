const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { body, param } = require('express-validator');
const { protect } = require('../middlewares/auth.middleware');
const contactController = require('../controllers/contact.controller');
const tagController = require('../controllers/tag.controller');
const validate = require('../middlewares/validation.middleware');

// 配置文件上传
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, path.join(__dirname, '../../temp'));
  },
  filename: function(req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB限制
  fileFilter: function(req, file, cb) {
    const filetypes = /csv|xlsx|xls/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('只支持CSV和Excel文件'));
    }
  }
});

// 获取所有联系人
router.get('/', protect, contactController.getContacts);

// 导出联系人
router.get('/export', protect, contactController.exportContacts);

// 获取单个联系人
router.get(
  '/:id',
  protect,
  param('id').isUUID().withMessage('联系人ID必须是有效的UUID'),
  validate,
  contactController.getContact
);

// 创建联系人
router.post(
  '/',
  protect,
  [
    body('email').trim().notEmpty().withMessage('邮箱不能为空').isEmail().normalizeEmail().withMessage('请输入有效的邮箱地址'),
    body('username').optional().trim(),
    body('first_name').optional().trim(),
    body('last_name').optional().trim(),
    body('tiktok_unique_id').optional().trim(),
    body('instagram_id').optional().trim(),
    body('youtube_id').optional().trim(),
    body('custom_field_1').optional().trim(),
    body('custom_field_2').optional().trim(),
    body('custom_field_3').optional().trim(),
    body('custom_field_4').optional().trim(),
    body('custom_field_5').optional().trim(),
    body('source').optional().trim(),
    body('tags').optional().isArray().withMessage('标签必须是ID数组'),
    body('tags.*').optional().isUUID().withMessage('标签ID必须是有效的UUID'),
    validate
  ],
  contactController.createContact
);

// 批量导入联系人
router.post('/import', protect, upload.single('file'), contactController.importContacts);

// 更新联系人
router.put(
  '/:id',
  protect,
  [
    param('id').isUUID().withMessage('联系人ID必须是有效的UUID'),
    body('email').optional().trim().isEmail().normalizeEmail().withMessage('请输入有效的邮箱地址'),
    body('username').optional().trim(),
    body('first_name').optional().trim(),
    body('last_name').optional().trim(),
    body('tiktok_unique_id').optional().trim(),
    body('instagram_id').optional().trim(),
    body('youtube_id').optional().trim(),
    body('custom_field_1').optional().trim(),
    body('custom_field_2').optional().trim(),
    body('custom_field_3').optional().trim(),
    body('custom_field_4').optional().trim(),
    body('custom_field_5').optional().trim(),
    body('source').optional().trim(),
    body('tags').optional().isArray().withMessage('标签必须是ID数组'),
    body('tags.*').optional().isUUID().withMessage('标签ID必须是有效的UUID'),
    validate
  ],
  contactController.updateContact
);

// 删除联系人
router.delete(
  '/:id',
  protect,
  param('id').isUUID().withMessage('联系人ID必须是有效的UUID'),
  validate,
  contactController.deleteContact
);

// 获取联系人的标签详情（区分直接标签和继承标签）
router.get(
  '/:id/tags',
  protect,
  param('id').isUUID().withMessage('联系人ID必须是有效的UUID'),
  validate,
  tagController.getContactTags
);

// 为联系人添加标签
router.post(
  '/:contactId/tags',
  protect,
  [
    param('contactId').isUUID().withMessage('联系人ID必须是有效的UUID'),
    body('tagId').isUUID().withMessage('标签ID必须是有效的UUID')
  ],
  validate,
  tagController.addTagToContact
);

// 批量操作路由 (示例，具体实现待定，但加上保护)
router.post('/bulk-delete', protect, contactController.bulkDeleteContacts);
router.post('/bulk-add-tags', protect, contactController.bulkAddTagsToContacts);
router.post('/bulk-remove-tags', protect, contactController.bulkRemoveTagsFromContacts);

// 添加按标签计算联系人数量的API
router.post('/count-by-tags', protect, contactController.countContactsByTags);

module.exports = router; 