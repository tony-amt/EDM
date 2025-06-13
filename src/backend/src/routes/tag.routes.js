const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { protect } = require('../middlewares/auth.middleware');
const tagController = require('../controllers/tag.controller');
const validator = require('../middlewares/validator.middleware');

// 获取所有标签
router.get('/', protect, tagController.getTags);

// 获取标签树结构
router.get('/tree', protect, tagController.getTagTree);

// 获取单个标签
router.get(
  '/:id',
  protect,
  param('id').isUUID().withMessage('标签ID必须是有效的UUID'),
  validator.validate,
  tagController.getTag
);

// 创建标签
router.post(
  '/',
  protect,
  [
    body('name').trim().notEmpty().withMessage('标签名称不能为空').isLength({ min: 1, max: 100 }).withMessage('标签名称长度必须在1到100之间'),
    body('description').optional().trim().isLength({ max: 255 }).withMessage('描述长度不能超过255字符'),
    body('parentId').optional({nullable: true, checkFalsy: true}).isUUID().withMessage('父标签ID必须是有效的UUID'),
    validator.validate
  ],
  tagController.createTag
);

// 更新标签
router.put(
  '/:id',
  protect,
  [
    param('id').isUUID().withMessage('标签ID必须是有效的UUID'),
    body('name').optional().trim().notEmpty().withMessage('标签名称不能为空').isLength({ min: 1, max: 100 }).withMessage('标签名称长度必须在1到100之间'),
    body('description').optional({nullable: true}).trim().isLength({ max: 255 }).withMessage('描述长度不能超过255字符'),
    body('parentId').optional({nullable: true, checkFalsy: true}).isUUID().withMessage('父标签ID必须是有效的UUID'),
    validator.validate
  ],
  tagController.updateTag
);

// 删除标签
router.delete(
  '/:id',
  protect,
  param('id').isUUID().withMessage('标签ID必须是有效的UUID'),
  validator.validate,
  tagController.deleteTag
);

// 获取标签关联的联系人
router.get(
  '/:id/contacts',
  protect,
  [param('id').isUUID().withMessage('标签ID必须是有效的UUID')],
  validator.validate,
  tagController.getContactsByTag
);

// 为联系人添加标签（支持自动继承）
router.post(
  '/:tagId/contacts/:contactId',
  protect,
  [
    param('tagId').isUUID().withMessage('标签ID必须是有效的UUID'),
    param('contactId').isUUID().withMessage('联系人ID必须是有效的UUID'),
    body('autoInherit').optional().isBoolean().withMessage('autoInherit必须是布尔值'),
    validator.validate
  ],
  tagController.addTagToContact
);

// 从联系人移除标签（智能删除）
router.delete(
  '/:tagId/contacts/:contactId',
  protect,
  [
    param('tagId').isUUID().withMessage('标签ID必须是有效的UUID'),
    param('contactId').isUUID().withMessage('联系人ID必须是有效的UUID'),
    body('removeParent').optional().isBoolean().withMessage('removeParent必须是布尔值'),
    validator.validate
  ],
  tagController.removeTagFromContact
);

// 批量为联系人添加标签
router.post(
  '/bulk-add',
  protect,
  [
    body('contactIds').isArray({ min: 1 }).withMessage('contactIds必须是非空数组'),
    body('contactIds.*').isUUID().withMessage('联系人ID必须是有效的UUID'),
    body('tagIds').isArray({ min: 1 }).withMessage('tagIds必须是非空数组'),
    body('tagIds.*').isUUID().withMessage('标签ID必须是有效的UUID'),
    validator.validate
  ],
  tagController.bulkAddTagsToContacts
);

// 批量从联系人移除标签
router.post(
  '/bulk-remove',
  protect,
  [
    body('contactIds').isArray({ min: 1 }).withMessage('contactIds必须是非空数组'),
    body('contactIds.*').isUUID().withMessage('联系人ID必须是有效的UUID'),
    body('tagIds').isArray({ min: 1 }).withMessage('tagIds必须是非空数组'),
    body('tagIds.*').isUUID().withMessage('标签ID必须是有效的UUID'),
    validator.validate
  ],
  tagController.bulkRemoveTagsFromContacts
);

// 移动标签到新的父级
router.put(
  '/:id/move',
  protect,
  [
    param('id').isUUID().withMessage('标签ID必须是有效的UUID'),
    body('parentId').optional({nullable: true, checkFalsy: true}).isUUID().withMessage('父标签ID必须是有效的UUID'),
    validator.validate
  ],
  tagController.moveTag
);

// A/B测试分组
router.post(
  '/:tagId/split-test',
  protect,
  [
    param('tagId').isUUID().withMessage('标签ID必须是有效的UUID'),
    body('testName').trim().notEmpty().withMessage('测试名称不能为空').isLength({ min: 1, max: 100 }).withMessage('测试名称长度必须在1到100之间'),
    body('groupCount').optional().isInt({ min: 2, max: 10 }).withMessage('分组数量必须在2到10之间'),
    body('splitRatio').optional().isArray().withMessage('splitRatio必须是数组'),
    body('splitRatio.*').optional().isFloat({ min: 0, max: 1 }).withMessage('分组比例必须在0到1之间'),
    body('groupNames').optional().isArray().withMessage('groupNames必须是数组'),
    body('groupNames.*').optional().trim().notEmpty().withMessage('分组名称不能为空'),
    validator.validate
  ],
  tagController.createSplitTest
);

// --- Auto Tag Rules (Functionality temporarily commented out) ---
/*
// 创建自动标签规则
router.post('/auto-rule', protect, tagController.createAutoTagRule);

// 应用自动标签规则
router.post('/apply-rules', protect, tagController.applyAutoTagRules);
*/

module.exports = router; 