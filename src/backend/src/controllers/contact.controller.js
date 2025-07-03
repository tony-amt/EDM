const { Contact, Tag, User, sequelize } = require('../models/index');
const { Op } = require('sequelize');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const ContactService = require('../services/core/contact.service');
const { AppError } = require('../utils/errorHandler');
const { validationResult } = require('express-validator');

// Helper to send success response (can be shared or controller-specific)
const sendSuccess = (res, data, statusCode = 200, message = 'Success') => {
  res.status(statusCode).json(data);
};

// Helper to pass errors to the error handling middleware (can be shared or controller-specific)
const handleError = (err, next) => {
  if (err instanceof AppError) {
    return next(err);
  }
  logger.error('Unexpected error in ContactController:', { error: err.message, stack: err.stack });
  return next(new AppError(err.message || 'An unexpected error occurred in contact operations.', 500));
};

/**
 * 获取所有联系人
 * @route GET /api/contacts
 * @query {boolean} include_child_tags - 是否包含二级标签显示（群发任务时为true，联系人管理时为false）
 * @access Private
 */
exports.getContacts = async (req, res, next) => {
  try {
    // 传递include_child_tags参数到service
    const filters = {
      ...req.query,
      include_child_tags: req.query.include_child_tags === 'true'
    };

    const result = await ContactService.getContacts(filters, req.user.id);
    sendSuccess(res, result);
  } catch (error) {
    handleError(error, next);
  }
};

/**
 * 获取单个联系人
 * @route GET /api/contacts/:id
 * @access Private
 */
exports.getContact = async (req, res, next) => {
  try {
    // 联系人编辑页面不显示子标签，设置为false
    const contactDto = await ContactService.getContactById(req.params.id, req.user.id, false);
    // Service method already throws AppError on not found, so no need to check for null here.
    sendSuccess(res, { data: contactDto });
  } catch (error) {
    handleError(error, next);
  }
};

/**
 * 创建联系人
 * @route POST /api/contacts
 * @access Private
 */
exports.createContact = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation failed in createContact:', { errors: errors.array(), body: req.body });
      throw new AppError('Validation failed.', 400, errors.array());
    }

    const { tags, ...contactDto } = req.body;
    const userId = req.user.id;

    if (!contactDto.email) {
      throw new AppError('Email is required in contact data.', 400);
    }

    const newContact = await ContactService.createContact(contactDto, tags, userId);
    sendSuccess(res, newContact, 201);

  } catch (error) {
    handleError(error, next);
  }
};

/**
 * 更新联系人
 * @route PUT /api/contacts/:id
 * @access Private
 */
exports.updateContact = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation failed in updateContact:', { errors: errors.array(), body: req.body });
      throw new AppError('Validation failed.', 400, errors.array());
    }

    const contactId = req.params.id;
    const userId = req.user.id;
    const { tags, ...contactUpdateDto } = req.body; // `tags` might be undefined if not sent

    const updatedContact = await ContactService.updateContact(contactId, contactUpdateDto, tags, userId);
    sendSuccess(res, updatedContact);

  } catch (error) {
    handleError(error, next);
  }
};

/**
 * 删除联系人
 * @route DELETE /api/contacts/:id
 * @access Private
 */
exports.deleteContact = async (req, res, next) => {
  try {
    const contactId = req.params.id;
    const userId = req.user.id;

    await ContactService.deleteContact(contactId, userId);
    sendSuccess(res, { message: 'Contact deleted successfully.' }, 200); // Or 204 No Content

  } catch (error) {
    handleError(error, next);
  }
};

/**
 * 批量导入联系人
 * @route POST /api/contacts/import
 * @access Private
 */
exports.importContacts = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请上传CSV文件'
      });
    }

    const results = [];
    const errors = [];
    const existingEmails = new Set();

    const existingContacts = await Contact.findAll({
      where: { user_id: req.user.id },
      attributes: ['email'],
      transaction
    });

    existingContacts.forEach(contact => {
      existingEmails.add(contact.email.toLowerCase());
    });

    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => {
          results.push(data);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    const contactsToCreate = [];
    const tagMap = new Map();

    for (const row of results) {
      if (!row.email) {
        errors.push({ row, error: '邮箱不能为空' });
        continue;
      }

      const email = row.email.trim().toLowerCase();

      if (existingEmails.has(email)) {
        errors.push({ row, error: '邮箱已存在' });
        continue;
      }

      existingEmails.add(email);

      let contactTagsIds = [];
      if (row.tags) {
        const tagNames = row.tags.split(',').map(t => t.trim()).filter(Boolean);

        for (const tagName of tagNames) {
          let tag = await Tag.findOne({ where: { name: tagName, user_id: req.user.id }, transaction });
          if (!tag) {
            tag = await Tag.create({ name: tagName, user_id: req.user.id }, { transaction });
          }
          contactTagsIds.push(tag.id);
        }
      }

      const contact = {
        email,
        username: row.username || '',
        name: row.name || '',
        mobile: row.mobile || '',
        company: row.company || '',
        title: row.title || '',
        country: row.country || '',
        source: row.source || 'manual',
        tiktok_unique_id: row.tikTokId || '',
        instagram_id: row.insId || '',
        youtube_id: row.youtubeId || '',
        remark: row.remark || '',
        user_id: req.user.id,
        tags: contactTagsIds
      };

      contactsToCreate.push(contact);
    }

    // 逐个创建联系人并处理分组逻辑
    const createdContacts = [];
    for (const contactData of contactsToCreate) {
      const contact = await Contact.create(contactData, { transaction });
      createdContacts.push(contact);

      if (contactData.tags && contactData.tags.length > 0) {
        // 检查标签是否已分组，如果是，将新联系人加入未分组名单
        for (const tagId of contactData.tags) {
          const tag = await Tag.findByPk(tagId, { transaction });
          if (tag && tag.contacts && tag.contacts.length > 0) {
            // 标签已有联系人，检查是否有分组
            const childTags = await Tag.findAll({
              where: { parent_id: tagId, user_id: req.user.id },
              transaction
            });

            if (childTags.length > 0) {
              // 已有分组，将新联系人添加到父标签的未分组名单
              const currentContacts = tag.contacts || [];
              if (!currentContacts.includes(contact.id)) {
                await Tag.update(
                  { contacts: [...currentContacts, contact.id] },
                  { where: { id: tagId }, transaction }
                );
              }
            } else {
              // 没有分组，直接添加到标签的联系人列表
              const currentContacts = tag.contacts || [];
              if (!currentContacts.includes(contact.id)) {
                await Tag.update(
                  { contacts: [...currentContacts, contact.id] },
                  { where: { id: tagId }, transaction }
                );
              }
            }
          } else {
            // 标签还没有联系人，直接添加
            await Tag.update(
              { contacts: [contact.id] },
              { where: { id: tagId }, transaction }
            );
          }
        }
      }
    }

    fs.unlinkSync(req.file.path);

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: `成功导入 ${contactsToCreate.length} 个联系人`,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    await transaction.rollback();

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    logger.error(`批量导入联系人失败: ${error.message} ${error.stack}`);
    res.status(500).json({
      success: false,
      message: '批量导入联系人失败',
      error: error.message
    });
  }
};

/**
 * 导出联系人
 * @route GET /api/contacts/export
 * @access Private
 */
exports.exportContacts = async (req, res) => {
  try {
    const whereClause = { user_id: req.user.id };
    if (req.query.tags) {
      console.warn("Tag filtering in export is complex and might not be fully implemented here.");
    }
    if (req.query.status) {
      whereClause.status = req.query.status;
    }

    const contacts = await Contact.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']]
    });

    // 🚀 Phase 3: 使用反向查询获取联系人标签信息
    const ContactTagService = require('../services/core/contactTag.service');
    const contactIds = contacts.map(c => c.id);
    const contactTagMap = await ContactTagService.getContactsWithTagsBatch(
      contactIds,
      false, // 导出时不包含子标签，只显示直接标签
      req.user.id
    );

    const exportData = contacts.map(contact => {
      const contactTags = contactTagMap.get(contact.id) || [];
      const tagNames = contactTags.map(tag => tag.name).join(', ');

      return {
        email: contact.email,
        username: contact.username,
        tiktok_unique_id: contact.tiktok_unique_id,
        instagram_id: contact.instagram_id,
        youtube_id: contact.youtube_id,
        customField1: contact.customField1,
        customField2: contact.customField2,
        customField3: contact.customField3,
        customField4: contact.customField4,
        customField5: contact.customField5,
        tags: tagNames,
        status: contact.status,
        createdAt: contact.createdAt.toISOString()
      };
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=contacts.csv');

    const csvHeader = Object.keys(exportData[0]).join(',') + '\n';
    res.write(csvHeader);

    exportData.forEach(contact => {
      const row = Object.values(contact).map(value => {
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value;
      }).join(',');
      res.write(row + '\n');
    });

    res.end();
  } catch (error) {
    logger.error(`导出联系人失败: ${error.message} ${error.stack}`);
    res.status(500).json({
      success: false,
      message: '导出联系人失败',
      error: error.message
    });
  }
};

/**
 * 批量删除联系人
 * @route POST /api/contacts/bulk-delete
 * @access Private
 */
exports.bulkDeleteContacts = async (req, res, next) => {
  try {
    const { contactIds } = req.body;
    const userId = req.user.id;

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      // No need to start a transaction in the controller for this validation
      throw new AppError('请提供要删除的联系人ID数组。', 400);
    }

    const deletedCount = await ContactService.bulkDeleteContacts(contactIds, userId);

    // Service will throw an AppError if deletedCount is 0 (e.g., 404), handled by handleError
    // So, no specific check for deletedCount === 0 here is necessary if the service handles it.

    sendSuccess(res, {
      message: `成功删除了 ${deletedCount} 个联系人。`,
      data: { deletedCount }
    }, 200);

  } catch (error) {
    // The transaction is managed by the service, so no rollback here.
    handleError(error, next); // Universal error handler
  }
};

// 占位符：批量为联系人添加标签
exports.bulkAddTagsToContacts = async (req, res, next) => {
  try {
    const { contactIds, tagIds } = req.body;
    const userId = req.user.id;

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      throw new AppError('请提供联系人ID数组。', 400);
    }
    if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
      throw new AppError('请提供标签ID数组。', 400);
    }

    const result = await ContactService.bulkAddTagsToContacts(contactIds, tagIds, userId);

    sendSuccess(res, {
      message: `成功为 ${result.updatedCount} 个联系人添加了 ${result.addedTagsCount} 个标签。`,
      data: result
    }, 200);

  } catch (error) {
    handleError(error, next);
  }
};

// 占位符：批量移除联系人的标签
exports.bulkRemoveTagsFromContacts = async (req, res, next) => {
  try {
    const { contactIds, tagIds } = req.body;
    const userId = req.user.id;

    // Basic validation, can be expanded or moved to service if complex rules apply
    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      throw new AppError('请提供联系人ID数组。', 400);
    }
    if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
      throw new AppError('请提供标签ID数组。', 400);
    }

    // Call the service method which is expected to throw a 501 AppError
    await ContactService.bulkRemoveTagsFromContacts(contactIds, tagIds, userId);

    // This part should ideally not be reached if the service throws 501
    sendSuccess(res, { message: 'This feature is not implemented.' }, 501);

  } catch (error) {
    handleError(error, next); // This will catch the 501 AppError from the service
  }
};

/**
 * 添加标签到联系人
 * @route POST /api/contacts/:contactId/tags/:tagId
 * @access Private
 */
exports.addTagToContact = async (req, res, next) => {
  try {
    const { contactId, tagId } = req.params;
    const userId = req.user.id;

    const updatedContact = await ContactService.addTagToContact(contactId, tagId, userId);
    sendSuccess(res, updatedContact);

  } catch (error) {
    handleError(error, next);
  }
};

/**
 * 从联系人移除标签
 * @route DELETE /api/contacts/:contactId/tags/:tagId
 * @access Private
 */
exports.removeTagFromContact = async (req, res, next) => {
  try {
    const { contactId, tagId } = req.params;
    const userId = req.user.id;

    const updatedContact = await ContactService.removeTagFromContact(contactId, tagId, userId);
    sendSuccess(res, updatedContact);

  } catch (error) {
    handleError(error, next);
  }
};

/**
 * 按标签计算联系人数量
 * @route POST /api/contacts/count-by-tags
 * @access Private
 */
exports.countContactsByTags = async (req, res, next) => {
  try {
    const { tagIds, include_tags, exclude_tags } = req.body;
    const userId = req.user.id;

    console.log('📊 计算标签关联人数请求:', { tagIds, include_tags, exclude_tags, userId });

    // 支持两种格式：tagIds（旧格式）或 include_tags/exclude_tags（新格式）
    if (include_tags || exclude_tags) {
      // 新格式：使用include_tags和exclude_tags（这里传递的是标签ID，不是名称）
      const count = await ContactService.countContactsByTagIds(include_tags || [], exclude_tags || [], userId);
      console.log('✅ 标签关联人数计算结果:', count);
      sendSuccess(res, { count }, 200);
    } else if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
      // 旧格式：使用tagIds
      const totalCount = await ContactService.countContactsByTagIds(tagIds, [], userId);
      console.log('✅ 标签关联人数计算结果:', totalCount);
      sendSuccess(res, { count: totalCount }, 200);
    } else {
      throw new AppError('请提供标签ID数组。', 400);
    }

  } catch (error) {
    console.error('❌ 计算标签关联人数失败:', error);
    handleError(error, next);
  }
}; 