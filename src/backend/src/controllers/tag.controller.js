const { Tag, Contact, sequelize, User } = require('../models/index');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const cacheManager = require('../utils/cacheManager');

/**
 * 获取所有标签（支持树形结构和统计）- 优化版本
 * @route GET /api/tags
 * @query {boolean} include_child_tags - 是否包含子标签（联系人管理为false，群发任务为true）
 * @access Private
 */
exports.getTags = async (req, res) => {
  try {
    const cacheKey = `tags_${req.user.id}_${JSON.stringify(req.query)}`;

    // 检查缓存
    const cachedData = cacheManager.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        success: true,
        data: cachedData,
        cached: true
      });
    }

    // 🔧 新增：解析include_child_tags参数
    const includeChildTags = req.query.include_child_tags === 'true';

    const where = {};
    // 🔒 安全修复：所有用户（包括管理员）只能查看自己的标签
    where.user_id = req.user.id;

    // 支持按父级ID过滤
    if (req.query.parentId) {
      if (req.query.parentId === 'null') {
        where.parent_id = null;
      } else {
        where.parent_id = req.query.parentId;
      }
    } else {
      // 🔧 修复：默认只返回根标签（parent_id为null），避免子标签重复显示
      where.parent_id = null;
    }

    // 支持搜索
    if (req.query.search) {
      where.name = { [Op.iLike]: `%${req.query.search}%` };
    }

    logger.info(`[getTags] Querying tags with where: ${JSON.stringify(where)}, includeChildTags: ${includeChildTags} by user ${req.user.id} (${req.user.role})`);

    // 🔧 修复：根据include_child_tags参数决定是否包含子标签
    const includeOptions = [
      {
        model: Tag,
        as: 'parent',
        attributes: ['id', 'name'],
        required: false
      }
    ];

    // 只有当include_child_tags为true时才包含子标签
    if (includeChildTags) {
      includeOptions.push({
        model: Tag,
        as: 'children',
        attributes: ['id', 'name', 'parent_id'],
        required: false
      });
    }

    // 🚀 性能优化：使用单个查询获取标签和联系人数量
    const tags = await Tag.findAll({
      where,
      attributes: [
        'id',
        'name',
        'description',
        'parent_id',
        'user_id',
        'created_at',
        'updated_at',
        // 🔧 修复：正确计算联系人数量 - 明确表名避免歧义
        [sequelize.literal(`
          CASE 
            WHEN "Tag"."contacts" IS NULL THEN 0
            WHEN jsonb_typeof("Tag"."contacts") = 'array' THEN jsonb_array_length("Tag"."contacts")
            ELSE 0
          END
        `), 'contact_count']
      ],
      include: includeOptions,
      order: [['name', 'ASC']]
    });

    // 🚀 性能优化：直接使用查询结果，无需额外计算
    const tagsWithCount = tags.map(tag => {
      const tagData = tag.toJSON();
      // 🔧 修复：使用查询结果中的真实联系人数量
      tagData.contact_count = tagData.contact_count || 0;

      // 🔧 新增：如果不包含子标签，确保children字段为空数组
      if (!includeChildTags) {
        tagData.children = [];
      }

      return tagData;
    });

    // 缓存结果
    cacheManager.set(cacheKey, tagsWithCount);

    logger.info(`[getTags] Found ${tags.length} tags, includeChildTags: ${includeChildTags}.`);

    res.status(200).json({
      success: true,
      data: tagsWithCount
    });
  } catch (error) {
    logger.error(`[CONTROLLER_ERROR] getTags: ${error.message} - ${error.stack}`);
    res.status(500).json({
      success: false,
      message: '获取标签列表失败',
      error: error.message
    });
  }
};

/**
 * 获取标签树（完整树形结构）- 优化版本
 * @route GET /api/tags/tree
 * @access Private
 */
exports.getTagTree = async (req, res) => {
  try {
    const cacheKey = `tag_tree_${req.user.id}`;

    // 检查缓存
    const cachedData = cacheManager.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        success: true,
        data: cachedData,
        cached: true
      });
    }

    const userWhere = { user_id: req.user.id };

    // 🚀 性能优化：使用单个查询获取标签和联系人数量
    const allTags = await Tag.findAll({
      where: userWhere,
      attributes: [
        'id',
        'name',
        'parent_id',
        'description',
        'created_at',
        'updated_at',
        // 🔧 修复：正确计算联系人数量 - 明确表名避免歧义
        [sequelize.literal(`
          CASE 
            WHEN "Tag"."contacts" IS NULL THEN 0
            WHEN jsonb_typeof("Tag"."contacts") = 'array' THEN jsonb_array_length("Tag"."contacts")
            ELSE 0
          END
        `), 'contact_count']
      ],
      order: [['name', 'ASC']]
    });

    logger.info(`[getTagTree] Found ${allTags.length} tags from database`);

    // 🚀 性能优化：构建树形结构
    const tagMap = {};
    const rootTags = [];

    // 第一遍：创建所有节点
    allTags.forEach(tag => {
      const tagData = tag.toJSON();
      tagMap[tag.id] = {
        id: tagData.id,
        name: tagData.name,
        parent_id: tagData.parent_id,
        description: tagData.description,
        contact_count: tagData.contact_count || 0, // 🔧 修复：使用真实的联系人数量
        created_at: tagData.created_at,
        updated_at: tagData.updated_at,
        children: []
      };
    });

    // 第二遍：建立父子关系
    allTags.forEach(tag => {
      const node = tagMap[tag.id];
      if (tag.parent_id && tagMap[tag.parent_id]) {
        tagMap[tag.parent_id].children.push(node);
      } else {
        rootTags.push(node);
      }
    });

    // 缓存结果
    cacheManager.set(cacheKey, rootTags);

    logger.info(`[getTagTree] Returning ${rootTags.length} root tags`);

    res.status(200).json({
      success: true,
      data: rootTags
    });
  } catch (error) {
    logger.error(`[CONTROLLER_ERROR] getTagTree: ${error.message} - ${error.stack}`);
    res.status(500).json({
      success: false,
      message: '获取标签树失败',
      error: error.message
    });
  }
};

/**
 * 获取单个标签
 * @route GET /api/tags/:id
 * @access Private
 */
exports.getTag = async (req, res) => {
  try {
    const where = { id: req.params.id };
    // 🔒 安全修复：所有用户（包括管理员）只能查看自己的标签
    where.user_id = req.user.id;

    logger.info(`[getTag] Querying tag with where: ${JSON.stringify(where)} by user ${req.user.id} (${req.user.role})`);

    const tag = await Tag.findOne({
      where,
      attributes: {
        include: [
          // 🔧 修复：正确计算联系人数量 - 明确表名避免歧义
          [sequelize.literal(`
            CASE 
              WHEN "Tag"."contacts" IS NULL THEN 0
              WHEN jsonb_typeof("Tag"."contacts") = 'array' THEN jsonb_array_length("Tag"."contacts")
              ELSE 0
            END
          `), 'contact_count']
        ]
      },
      include: [
        { model: Tag, as: 'parent', attributes: ['id', 'name'], required: false },
        { model: Tag, as: 'children', attributes: ['id', 'name'], required: false },
        { model: User, as: 'user', attributes: ['id', 'username'], required: false }
      ]
    });

    if (!tag) {
      logger.warn(`[getTag] Tag not found with where: ${JSON.stringify(where)}`);
      return res.status(404).json({
        success: false,
        message: '标签不存在或您无权查看'
      });
    }

    logger.info(`[getTag] Found tag: ${tag.name} with ${tag.get('contact_count')} contacts`);

    res.status(200).json({
      success: true,
      data: tag
    });
  } catch (error) {
    logger.error(`[CONTROLLER_ERROR] getTag: ${error.message} - ${error.stack}`);
    res.status(500).json({
      success: false,
      message: '获取标签详情失败',
      error: error.message
    });
  }
};

/**
 * 创建标签（支持多级树）
 * @route POST /api/tags
 * @access Private
 */
exports.createTag = async (req, res) => {
  try {
    const { name, description, parentId, color } = req.body;

    // 检查名称唯一性（同一父级下）
    const whereUniqueCheck = {
      name: name,
      user_id: req.user.id,
      parent_id: parentId || null
    };

    logger.info(`[createTag] Checking existing tag with: ${JSON.stringify(whereUniqueCheck)} by user ${req.user.id}`);

    const existingTag = await Tag.findOne({ where: whereUniqueCheck });

    if (existingTag) {
      logger.warn(`[createTag] Tag name already exists: ${name} for user ${req.user.id} with parent ${parentId || 'null'}`);
      return res.status(400).json({
        success: false,
        message: '具有相同父标签的标签名称已存在'
      });
    }

    // 验证父标签存在性
    if (parentId) {
      const parentTag = await Tag.findOne({
        where: {
          id: parentId,
          user_id: req.user.id
        }
      });

      if (!parentTag) {
        logger.warn(`[createTag] Parent tag not found: ${parentId} for user ${req.user.id}`);
        return res.status(400).json({
          success: false,
          message: '父标签不存在'
        });
      }

      // 检查是否会造成循环引用（可选，防止深度嵌套）
      let currentParent = parentTag;
      const visited = new Set([parentId]);
      while (currentParent && currentParent.parent_id) {
        if (visited.has(currentParent.parent_id)) {
          return res.status(400).json({
            success: false,
            message: '不能创建循环引用的标签层级'
          });
        }
        visited.add(currentParent.parent_id);
        currentParent = await Tag.findByPk(currentParent.parent_id);
      }
    }

    const createPayload = {
      name,
      description,
      color,
      parent_id: parentId || null,
      user_id: req.user.id,
      contacts: [] // V3.0: 初始化空的联系人数组
    };

    logger.info(`[createTag] Creating tag with payload: ${JSON.stringify(createPayload)}`);

    const tag = await Tag.create(createPayload);

    logger.info(`[createTag] Tag created successfully: ${tag.name} (${tag.id})`);

    // 重新获取包含关联信息的标签
    const resultTag = await Tag.findByPk(tag.id, {
      attributes: {
        include: [
          // 🔧 修复：正确计算联系人数量 - 明确表名避免歧义
          [sequelize.literal(`
            CASE 
              WHEN "Tag"."contacts" IS NULL THEN 0
              WHEN jsonb_typeof("Tag"."contacts") = 'array' THEN jsonb_array_length("Tag"."contacts")
              ELSE 0
            END
          `), 'contact_count']
        ]
      },
      include: [
        { model: Tag, as: 'parent', attributes: ['id', 'name'], required: false },
        { model: Tag, as: 'children', attributes: ['id', 'name'], required: false },
        { model: User, as: 'user', attributes: ['id', 'username'], required: false }
      ]
    });

    // 🔄 缓存优化：创建标签后清除用户的标签缓存
    cacheManager.clearUserTagCache(req.user.id);
    logger.info(`[CACHE] Cleared tag cache after creating tag ${resultTag.name} for user ${req.user.id}`);

    res.status(201).json({
      success: true,
      data: resultTag
    });
  } catch (error) {
    logger.error(`[CONTROLLER_ERROR] createTag: ${error.message} - ${error.stack}`);
    res.status(500).json({
      success: false,
      message: '创建标签失败',
      error: error.message
    });
  }
};

/**
 * 更新标签
 * @route PUT /api/tags/:id
 * @access Private
 */
exports.updateTag = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const findWhere = { id: req.params.id };
    // 🔒 安全修复：所有用户（包括管理员）只能修改自己的标签
    findWhere.user_id = req.user.id;

    logger.info(`[updateTag] Finding tag with: ${JSON.stringify(findWhere)} by user ${req.user.id} (${req.user.role})`);

    const tag = await Tag.findOne({ where: findWhere, transaction });

    if (!tag) {
      await transaction.rollback();
      logger.warn(`[updateTag] Tag not found or no access: ${req.params.id}`);
      return res.status(404).json({
        success: false,
        message: req.user.role === 'admin' ? '标签不存在' : '标签不存在或不属于您'
      });
    }

    logger.info(`[updateTag] Found tag: ${tag.name}`);

    const { name, description, color, parentId } = req.body;
    const updatePayload = {};

    // 处理名称更新
    if (name !== undefined && name !== tag.name) {
      logger.info(`[updateTag] Name change detected: from '${tag.name}' to '${name}'`);
      const nameCheckWhere = {
        name,
        user_id: tag.user_id,
        parent_id: parentId !== undefined ? (parentId || null) : tag.parent_id,
        id: { [Op.ne]: tag.id }
      };

      logger.info(`[updateTag] Checking name uniqueness with: ${JSON.stringify(nameCheckWhere)}`);

      const existingTag = await Tag.findOne({ where: nameCheckWhere, transaction });
      if (existingTag) {
        await transaction.rollback();
        logger.warn(`[updateTag] Name conflict: ${name} already exists at this level for this user.`);
        return res.status(400).json({
          success: false,
          message: '该名称的标签已在当前层级存在。'
        });
      }
      updatePayload.name = name;
    }

    // 处理父级更新
    if (parentId !== undefined) {
      const newParentId = parentId || null;
      if (newParentId !== tag.parent_id) {
        if (newParentId) {
          // 验证新父标签存在
          const parentTag = await Tag.findOne({
            where: { id: newParentId, user_id: tag.user_id },
            transaction
          });

          if (!parentTag) {
            await transaction.rollback();
            return res.status(400).json({
              success: false,
              message: '指定的父标签不存在'
            });
          }

          // 防止循环引用
          if (newParentId === tag.id) {
            await transaction.rollback();
            return res.status(400).json({
              success: false,
              message: '标签不能设置自己为父标签'
            });
          }

          // 检查是否会成为自己的后代
          const isDescendant = await checkIfDescendant(tag.id, newParentId, transaction);
          if (isDescendant) {
            await transaction.rollback();
            return res.status(400).json({
              success: false,
              message: '不能将标签移动到自己的子标签下'
            });
          }
        }
        updatePayload.parent_id = newParentId;
      }
    }

    // 处理其他字段
    if (description !== undefined) {
      updatePayload.description = description;
    }
    if (color !== undefined) {
      updatePayload.color = color;
    }

    if (Object.keys(updatePayload).length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '没有提供需要更新的字段。'
      });
    }

    logger.info("[updateTag] Updating tag with payload:", updatePayload);

    await tag.update(updatePayload, { transaction });
    await transaction.commit();

    // 重新获取更新后的标签
    const resultTag = await Tag.findByPk(tag.id, {
      attributes: {
        include: [
          // 🔧 修复：正确计算联系人数量 - 明确表名避免歧义
          [sequelize.literal(`
            CASE 
              WHEN "Tag"."contacts" IS NULL THEN 0
              WHEN jsonb_typeof("Tag"."contacts") = 'array' THEN jsonb_array_length("Tag"."contacts")
              ELSE 0
            END
          `), 'contact_count']
        ]
      },
      include: [
        { model: Tag, as: 'parent', attributes: ['id', 'name'], required: false },
        { model: Tag, as: 'children', attributes: ['id', 'name'], required: false },
        { model: User, as: 'user', attributes: ['id', 'username'], required: false }
      ]
    });

    // 🔄 缓存优化：更新标签后清除用户的标签缓存
    cacheManager.clearUserTagCache(req.user.id);
    logger.info(`[CACHE] Cleared tag cache after updating tag ${resultTag.name} for user ${req.user.id}`);

    res.status(200).json({
      success: true,
      message: '标签更新成功',
      data: resultTag
    });

  } catch (error) {
    if (transaction && !transaction.finished) {
      try { await transaction.rollback(); } catch (rbError) {
        logger.error('[CONTROLLER_ERROR] updateTag rollback error: ', rbError);
      }
    }
    logger.error(`[CONTROLLER_ERROR] updateTag: ${error.message} - ${error.stack}`);
    res.status(500).json({
      success: false,
      message: '更新标签失败',
      error: error.message
    });
  }
};

/**
 * 删除标签（V3.0 JSONB版本）
 * @route DELETE /api/tags/:id
 * @access Private
 */
exports.deleteTag = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const findWhere = { id: req.params.id };
    // 🔒 安全修复：所有用户（包括管理员）只能删除自己的标签
    findWhere.user_id = req.user.id;

    logger.info(`[deleteTag] Finding tag with: ${JSON.stringify(findWhere)} by user ${req.user.id} (${req.user.role})`);

    const tag = await Tag.findOne({
      where: findWhere,
      include: [{ model: Tag, as: 'children', required: false }],
      transaction
    });

    if (!tag) {
      await transaction.rollback();
      logger.warn(`[deleteTag] Tag not found or no access: ${req.params.id}`);
      return res.status(404).json({
        success: false,
        message: req.user.role === 'admin' ? '标签不存在' : '标签不存在或不属于您'
      });
    }

    logger.info(`[deleteTag] Found tag: ${tag.name} (Children count: ${tag.children ? tag.children.length : 0})`);

    // 检查是否有子标签
    if (tag.children && tag.children.length > 0) {
      await transaction.rollback();
      logger.warn(`[deleteTag] Attempted to delete tag ${tag.id} which has children.`);
      return res.status(400).json({
        success: false,
        message: '标签有关联的子标签，无法删除。请先删除或移动子标签。'
      });
    }

    // V3.0: 检查tag.contacts JSONB字段长度
    logger.info(`[deleteTag] Checking contacts for tag ${tag.id}`);
    const contactsArray = tag.contacts || [];
    const associatedContactsCount = contactsArray.length;

    logger.info(`[deleteTag] Tag ${tag.id} is associated with ${associatedContactsCount} contacts.`);

    if (associatedContactsCount > 0) {
      await transaction.rollback();
      logger.warn(`[deleteTag] Attempted to delete tag ${tag.id} which is associated with contacts.`);
      return res.status(400).json({
        success: false,
        message: `标签已关联 ${associatedContactsCount} 个联系人，无法删除。请先解除关联。`
      });
    }

    logger.info(`[deleteTag] Destroying tag ${tag.id}`);
    await tag.destroy({ transaction });
    await transaction.commit();

    logger.info(`[deleteTag] Tag ${tag.id} destroyed successfully.`);

    // 🔄 缓存优化：删除标签后清除用户的标签缓存
    cacheManager.clearUserTagCache(req.user.id);
    logger.info(`[CACHE] Cleared tag cache after deleting tag ${tag.id} for user ${req.user.id}`);

    res.status(204).send();

  } catch (error) {
    if (transaction && !transaction.finished) {
      try { await transaction.rollback(); } catch (rbError) {
        logger.error('[CONTROLLER_ERROR] deleteTag rollback error: ', rbError);
      }
    }
    logger.error(`[CONTROLLER_ERROR] deleteTag: ${error.message} - ${error.stack}`);
    res.status(500).json({
      success: false,
      message: '删除标签失败',
      error: error.message
    });
  }
};

/**
 * 获取标签关联的联系人（V3.0 JSONB版本）
 * @route GET /api/tags/:id/contacts
 * @access Private
 */
exports.getContactsByTag = async (req, res) => {
  try {
    const tagId = req.params.id;
    const findWhere = { id: tagId };
    // 🔒 安全修复：所有用户（包括管理员）只能访问自己的标签
    findWhere.user_id = req.user.id;

    logger.info(`[getContactsByTag] Querying tag with where: ${JSON.stringify(findWhere)} by user ${req.user.id} (${req.user.role})`);

    const tag = await Tag.findOne({ where: findWhere });

    if (!tag) {
      logger.warn(`[getContactsByTag] Tag not found with where: ${JSON.stringify(findWhere)}`);
      return res.status(404).json({
        success: false,
        message: req.user.role === 'admin' ? '标签不存在' : '标签不存在或不属于您'
      });
    }

    logger.info(`[getContactsByTag] Found tag: ${tag.name}. Now fetching contacts.`);

    // V3.0: 从tag.contacts JSONB字段获取联系人ID，然后查询联系人详情
    const contactIds = tag.contacts || [];

    if (contactIds.length === 0) {
      logger.info(`[getContactsByTag] No contacts found for tag ${tag.id}.`);
      return res.status(200).json({
        success: true,
        data: {
          id: tag.id,
          name: tag.name,
          contacts: []
        }
      });
    }

    const contacts = await Contact.findAll({
      where: {
        id: { [Op.in]: contactIds },
        user_id: tag.user_id // 确保联系人属于同一用户
      },
      order: [['created_at', 'DESC']]
    });

    logger.info(`[getContactsByTag] Found ${contacts.length} contacts for tag ${tag.id}.`);

    res.status(200).json({
      success: true,
      data: {
        id: tag.id,
        name: tag.name,
        contacts
      }
    });
  } catch (error) {
    logger.error(`[CONTROLLER_ERROR] getContactsByTag: ${error.message} - ${error.stack}`);
    res.status(500).json({
      success: false,
      message: '获取标签关联的联系人失败',
      error: error.message
    });
  }
};

/**
 * 为联系人添加标签（V3.0 JSONB双向同步 + 自动继承）
 * @route POST /api/tags/:tagId/contacts/:contactId
 * @route POST /api/contacts/:contactId/tags (tagId in body)
 * @access Private
 */
exports.addTagToContact = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    // 支持两种路由格式
    const { tagId: paramTagId, contactId } = req.params;
    const { tagId: bodyTagId, autoInherit = true } = req.body;

    const tagId = paramTagId || bodyTagId;

    if (!tagId) {
      await transaction.rollback();
      logger.warn('[addTagToContact] tagId not provided in params or body.');
      return res.status(400).json({ success: false, message: '标签ID是必需的' });
    }

    logger.info(`[addTagToContact] Attempting to link contact ${contactId} with tag ${tagId} by user ${req.user.id} (${req.user.role})`);

    const contactWhere = { id: contactId };
    const tagWhere = { id: tagId };

    // 🔒 安全修复：所有用户（包括管理员）只能访问自己的数据
    contactWhere.user_id = req.user.id;
    tagWhere.user_id = req.user.id;

    logger.info(`[addTagToContact] Contact where: ${JSON.stringify(contactWhere)}, Tag where: ${JSON.stringify(tagWhere)}`);

    const contact = await Contact.findOne({ where: contactWhere, transaction });
    const tag = await Tag.findOne({ where: tagWhere, transaction });

    if (!contact || !tag) {
      await transaction.rollback();
      let message = '无法关联：';
      if (!contact) message += '联系人不存在或不属于您。';
      if (!tag) message += (contact ? ' ' : '') + '标签不存在或不属于您。';
      logger.warn(`[addTagToContact] Failed: ${message}`);
      return res.status(404).json({ success: false, message: message.trim() });
    }

    logger.info(`[addTagToContact] Found contact: ${contact.email}, Found tag: ${tag.name}. Adding association.`);

    // 🚀 Phase 3修复: 只使用tag.contacts，不再使用contact.tags字段（已移除）
    const tagContacts = tag.contacts || [];

    // 检查是否已经关联（通过tag.contacts反向查询）
    if (tagContacts.includes(contactId)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '标签已经关联到此联系人'
      });
    }

    // 收集需要关联的标签（包括继承的父标签）
    const tagsToAdd = [tagId];
    const tagsToUpdate = [{ tag, contacts: tagContacts }];

    // 自动继承父标签逻辑
    if (autoInherit && tag.parent_id) {
      const parentTag = await Tag.findByPk(tag.parent_id, { transaction });
      if (parentTag && parentTag.user_id === tag.user_id) {
        const parentContacts = parentTag.contacts || [];
        // 检查是否已经关联父标签
        if (!parentContacts.includes(contactId)) {
          tagsToAdd.push(parentTag.id);
          tagsToUpdate.push({ tag: parentTag, contacts: parentContacts });
          logger.info(`[addTagToContact] Auto-inheriting parent tag: ${parentTag.name}`);
        }
      }
    }

    // 🚀 Phase 3修复: 只更新tag.contacts字段，不再更新contact.tags（已移除）
    // 更新所有相关标签的contacts字段
    for (const { tag: tagToUpdate, contacts } of tagsToUpdate) {
      const updatedTagContacts = [...new Set([...contacts, contactId])];
      await tagToUpdate.update({ contacts: updatedTagContacts }, { transaction });
    }

    await transaction.commit();
    logger.info(`[addTagToContact] Association added successfully. Tags added: ${tagsToAdd.join(', ')}`);

    // 🔄 缓存优化：添加标签关联后清除相关缓存
    cacheManager.clearContactRelatedCache(req.user.id, tagsToAdd);
    logger.info(`[CACHE] Cleared cache after adding tags ${tagsToAdd.join(', ')} to contact ${contactId}`);

    res.status(200).json({
      success: true,
      message: `标签已成功关联到联系人${autoInherit && tag.parent_id ? '（包含父标签）' : ''}`,
      data: {
        contactId: contact.id,
        tagId: tag.id,
        addedTags: tagsToAdd,
        autoInherit: autoInherit && tag.parent_id ? true : false
      }
    });

  } catch (error) {
    if (transaction && !transaction.finished) {
      try { await transaction.rollback(); } catch (rbError) {
        logger.error('[CONTROLLER_ERROR] addTagToContact rollback error: ', rbError);
      }
    }
    logger.error(`[CONTROLLER_ERROR] addTagToContact: ${error.message} - ${error.stack}`);
    res.status(500).json({
      success: false,
      message: '关联标签到联系人失败',
      error: error.message
    });
  }
};

/**
 * 从联系人移除标签（V3.0 JSONB双向同步 + 智能删除）
 * @route DELETE /api/tags/:tagId/contacts/:contactId
 * @access Private
 */
exports.removeTagFromContact = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { tagId, contactId } = req.params;
    const { removeParent = false } = req.body; // 是否同时移除父标签

    logger.info(`[removeTagFromContact] Attempting to remove tag ${tagId} from contact ${contactId} by user ${req.user.id} (${req.user.role})`);

    const contactWhere = { id: contactId };
    const tagWhere = { id: tagId };

    // 🔒 安全修复：所有用户（包括管理员）只能访问自己的数据
    contactWhere.user_id = req.user.id;
    tagWhere.user_id = req.user.id;

    logger.info(`[removeTagFromContact] Contact where: ${JSON.stringify(contactWhere)}, Tag where: ${JSON.stringify(tagWhere)}`);

    const contact = await Contact.findOne({ where: contactWhere, transaction });
    const tag = await Tag.findOne({ where: tagWhere, transaction });

    if (!contact) {
      await transaction.rollback();
      logger.warn(`[removeTagFromContact] Contact not found or no access: ${contactId}`);
      return res.status(404).json({ success: false, message: '联系人不存在或不属于您' });
    }
    if (!tag) {
      await transaction.rollback();
      logger.warn(`[removeTagFromContact] Tag not found or no access: ${tagId}`);
      return res.status(404).json({ success: false, message: '标签不存在或不属于您' });
    }

    logger.info(`[removeTagFromContact] Found contact: ${contact.email}, Found tag: ${tag.name}. Removing association.`);

    // 🚀 Phase 3修复: 只使用tag.contacts，不再使用contact.tags字段（已移除）
    const tagContacts = tag.contacts || [];

    // 检查是否存在关联（通过tag.contacts反向查询）
    if (!tagContacts.includes(contactId)) {
      await transaction.rollback();
      logger.warn(`[removeTagFromContact] Tag ${tagId} was not associated with contact ${contactId}.`);
      return res.status(404).json({
        success: false,
        message: '标签未关联到此联系人'
      });
    }

    // 收集需要移除的标签
    const tagsToRemove = [tagId];
    const tagsToUpdate = [{ tag, contacts: tagContacts }];

    // 🚀 Phase 3修复: 简化智能删除逻辑，使用反向查询
    if (tag.parent_id && !removeParent) {
      // 删除子标签时，检查是否还有其他子标签
      const parentTag = await Tag.findByPk(tag.parent_id, { transaction });
      if (parentTag) {
        // 获取该父标签下的所有子标签
        const siblingTags = await Tag.findAll({
          where: { parent_id: tag.parent_id, user_id: tag.user_id },
          transaction
        });

        // 🚀 修复: 通过tag.contacts反向查询检查联系人是否还关联其他子标签
        const hasOtherChildTags = siblingTags.some(sibling => {
          const siblingContacts = sibling.contacts || [];
          return sibling.id !== tagId && siblingContacts.includes(contactId);
        });

        // 如果没有其他子标签，也移除父标签
        const parentContacts = parentTag.contacts || [];
        if (!hasOtherChildTags && parentContacts.includes(contactId)) {
          tagsToRemove.push(parentTag.id);
          tagsToUpdate.push({ tag: parentTag, contacts: parentContacts });
          logger.info(`[removeTagFromContact] Auto-removing parent tag: ${parentTag.name} (no other child tags)`);
        }
      }
    } else if (!tag.parent_id) {
      // 删除父标签时，同时删除所有子标签
      const childTags = await Tag.findAll({
        where: { parent_id: tagId, user_id: tag.user_id },
        transaction
      });

      for (const childTag of childTags) {
        const childContacts = childTag.contacts || [];
        if (childContacts.includes(contactId)) {
          tagsToRemove.push(childTag.id);
          tagsToUpdate.push({ tag: childTag, contacts: childContacts });
          logger.info(`[removeTagFromContact] Auto-removing child tag: ${childTag.name}`);
        }
      }
    }

    // 🚀 Phase 3修复: 不再更新contact.tags字段（已移除）

    // 更新所有相关标签的contacts字段
    for (const { tag: tagToUpdate, contacts } of tagsToUpdate) {
      const updatedTagContacts = contacts.filter(id => id !== contactId);
      await tagToUpdate.update({ contacts: updatedTagContacts }, { transaction });
    }

    await transaction.commit();
    logger.info(`[removeTagFromContact] Association removed successfully. Tags removed: ${tagsToRemove.join(', ')}`);

    // 🔄 缓存优化：移除标签关联后清除相关缓存
    cacheManager.clearContactRelatedCache(req.user.id, tagsToRemove);
    logger.info(`[CACHE] Cleared cache after removing tags ${tagsToRemove.join(', ')} from contact ${contactId}`);

    res.status(200).json({
      success: true,
      message: `成功移除${tagsToRemove.length}个标签`,
      data: {
        contactId: contact.id,
        removedTags: tagsToRemove
      }
    });

  } catch (error) {
    if (transaction && !transaction.finished) {
      try { await transaction.rollback(); } catch (rbError) {
        logger.error('[CONTROLLER_ERROR] removeTagFromContact rollback error: ', rbError);
      }
    }
    logger.error(`[CONTROLLER_ERROR] removeTagFromContact: ${error.message} - ${error.stack}`);
    res.status(500).json({
      success: false,
      message: '从联系人移除标签失败',
      error: error.message
    });
  }
};

/**
 * 批量为联系人添加标签
 * @route POST /api/tags/bulk-add
 * @access Private
 */
exports.bulkAddTagsToContacts = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { contactIds, tagIds } = req.body;
    const userId = req.user.id;

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '请提供联系人ID数组'
      });
    }

    if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '请提供标签ID数组'
      });
    }

    logger.info(`[bulkAddTagsToContacts] Adding tags ${tagIds} to contacts ${contactIds} by user ${userId}`);

    // 验证所有联系人和标签都属于当前用户
    const contacts = await Contact.findAll({
      where: { id: { [Op.in]: contactIds }, user_id: userId },
      transaction
    });

    const tags = await Tag.findAll({
      where: { id: { [Op.in]: tagIds }, user_id: userId },
      transaction
    });

    if (contacts.length !== contactIds.length) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: '部分联系人不存在或不属于您'
      });
    }

    if (tags.length !== tagIds.length) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: '部分标签不存在或不属于您'
      });
    }

    let updatedContactCount = 0;
    let updatedTagCount = 0;

    // 🚀 Phase 3修复: 不再更新contact.tags字段（已移除），只更新tag.contacts
    // 更新标签的contacts字段，并统计实际更新的联系人数量
    for (const tag of tags) {
      const currentContacts = tag.contacts || [];
      const newContacts = [...new Set([...currentContacts, ...contactIds])];

      if (newContacts.length !== currentContacts.length) {
        await tag.update({ contacts: newContacts }, { transaction });
        updatedTagCount++;
        // 计算新增的联系人数量
        updatedContactCount += newContacts.length - currentContacts.length;
      }
    }

    await transaction.commit();

    logger.info(`[bulkAddTagsToContacts] Updated ${updatedContactCount} contacts and ${updatedTagCount} tags`);

    // 🔄 缓存优化：批量添加标签后清除相关缓存
    if (updatedContactCount > 0 || updatedTagCount > 0) {
      cacheManager.clearContactRelatedCache(userId, tagIds);
      logger.info(`[CACHE] Cleared cache after bulk adding tags ${tagIds.join(', ')} to ${updatedContactCount} contacts`);
    }

    res.status(200).json({
      success: true,
      message: `成功为 ${updatedContactCount} 个联系人添加了标签`,
      data: {
        updatedContactCount,
        updatedTagCount
      }
    });

  } catch (error) {
    if (transaction && !transaction.finished) {
      try { await transaction.rollback(); } catch (rbError) {
        logger.error('[CONTROLLER_ERROR] bulkAddTagsToContacts rollback error: ', rbError);
      }
    }
    logger.error(`[CONTROLLER_ERROR] bulkAddTagsToContacts: ${error.message} - ${error.stack}`);
    res.status(500).json({
      success: false,
      message: '批量添加标签失败',
      error: error.message
    });
  }
};

/**
 * 批量从联系人移除标签
 * @route POST /api/tags/bulk-remove
 * @access Private
 */
exports.bulkRemoveTagsFromContacts = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { contactIds, tagIds } = req.body;
    const userId = req.user.id;

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '请提供联系人ID数组'
      });
    }

    if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '请提供标签ID数组'
      });
    }

    logger.info(`[bulkRemoveTagsFromContacts] Removing tags ${tagIds} from contacts ${contactIds} by user ${userId}`);

    // 获取相关联系人和标签
    const contacts = await Contact.findAll({
      where: { id: { [Op.in]: contactIds }, user_id: userId },
      transaction
    });

    const tags = await Tag.findAll({
      where: { id: { [Op.in]: tagIds }, user_id: userId },
      transaction
    });

    let updatedContactCount = 0;
    let updatedTagCount = 0;

    // 🚀 Phase 3修复: 不再更新contact.tags字段（已移除），只更新tag.contacts
    // 更新标签的contacts字段，并统计实际移除的联系人数量
    for (const tag of tags) {
      const currentContacts = tag.contacts || [];
      const newContacts = currentContacts.filter(contactId => !contactIds.includes(contactId));

      if (newContacts.length !== currentContacts.length) {
        await tag.update({ contacts: newContacts }, { transaction });
        updatedTagCount++;
        // 计算移除的联系人数量
        updatedContactCount += currentContacts.length - newContacts.length;
      }
    }

    await transaction.commit();

    logger.info(`[bulkRemoveTagsFromContacts] Updated ${updatedContactCount} contacts and ${updatedTagCount} tags`);

    // 🔄 缓存优化：批量移除标签后清除相关缓存
    if (updatedContactCount > 0 || updatedTagCount > 0) {
      cacheManager.clearContactRelatedCache(userId, tagIds);
      logger.info(`[CACHE] Cleared cache after bulk removing tags ${tagIds.join(', ')} from ${updatedContactCount} contacts`);
    }

    res.status(200).json({
      success: true,
      message: `成功从 ${updatedContactCount} 个联系人移除了标签`,
      data: {
        updatedContactCount,
        updatedTagCount
      }
    });

  } catch (error) {
    if (transaction && !transaction.finished) {
      try { await transaction.rollback(); } catch (rbError) {
        logger.error('[CONTROLLER_ERROR] bulkRemoveTagsFromContacts rollback error: ', rbError);
      }
    }
    logger.error(`[CONTROLLER_ERROR] bulkRemoveTagsFromContacts: ${error.message} - ${error.stack}`);
    res.status(500).json({
      success: false,
      message: '批量移除标签失败',
      error: error.message
    });
  }
};

/**
 * 移动标签到新的父级
 * @route PUT /api/tags/:id/move
 * @access Private
 */
exports.moveTag = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { parentId } = req.body;

    const findWhere = { id };
    // 🔒 安全修复：所有用户（包括管理员）只能访问自己的标签
    findWhere.user_id = req.user.id;

    const tag = await Tag.findOne({ where: findWhere, transaction });

    if (!tag) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: '标签不存在或不属于您'
      });
    }

    // 验证新父标签（如果提供）
    if (parentId) {
      if (parentId === id) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: '标签不能设置自己为父标签'
        });
      }

      const parentTag = await Tag.findOne({
        where: { id: parentId, user_id: tag.user_id },
        transaction
      });

      if (!parentTag) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: '指定的父标签不存在'
        });
      }

      // 检查循环引用
      const isDescendant = await checkIfDescendant(id, parentId, transaction);
      if (isDescendant) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: '不能将标签移动到自己的子标签下'
        });
      }
    }

    await tag.update({ parent_id: parentId || null }, { transaction });
    await transaction.commit();

    // 重新获取更新后的标签
    const resultTag = await Tag.findByPk(id, {
      include: [
        { model: Tag, as: 'parent', attributes: ['id', 'name'], required: false },
        { model: Tag, as: 'children', attributes: ['id', 'name'], required: false }
      ]
    });

    // 🔄 缓存优化：移动标签后清除用户的标签缓存
    cacheManager.clearUserTagCache(req.user.id);
    logger.info(`[CACHE] Cleared tag cache after moving tag ${id} for user ${req.user.id}`);

    res.status(200).json({
      success: true,
      message: '标签移动成功',
      data: resultTag
    });

  } catch (error) {
    if (transaction && !transaction.finished) {
      try { await transaction.rollback(); } catch (rbError) {
        logger.error('[CONTROLLER_ERROR] moveTag rollback error: ', rbError);
      }
    }
    logger.error(`[CONTROLLER_ERROR] moveTag: ${error.message} - ${error.stack}`);
    res.status(500).json({
      success: false,
      message: '移动标签失败',
      error: error.message
    });
  }
};

/**
 * A/B测试分组功能
 * @route POST /api/tags/:tagId/split-test
 * @access Private
 */
exports.createSplitTest = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { tagId } = req.params;
    const {
      testName,
      groupCount = 2,
      splitRatio = null,
      groupNames = null,
      isRegroup = false // 新增：是否为重新分组
    } = req.body;

    // 验证参数
    if (!testName) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '请提供测试名称'
      });
    }

    if (groupCount < 2 || groupCount > 10) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '分组数量必须在2-10之间'
      });
    }

    // 验证标签存在性
    const tagWhere = { id: tagId };
    // 🔒 安全修复：所有用户（包括管理员）只能访问自己的标签
    tagWhere.user_id = req.user.id;

    const tag = await Tag.findOne({ where: tagWhere, transaction });
    if (!tag) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: '标签不存在或不属于您'
      });
    }

    // 如果是重新分组，先删除现有的子标签
    if (isRegroup) {
      const existingChildTags = await Tag.findAll({
        where: {
          parent_id: tagId,
          user_id: tag.user_id
        },
        transaction
      });

      if (existingChildTags.length > 0) {
        logger.info(`[createSplitTest] Regroup mode: deleting ${existingChildTags.length} existing child tags`);

        // 删除现有子标签并从联系人中移除这些标签
        for (const childTag of existingChildTags) {
          // 从所有联系人中移除这个子标签
          const childTagContacts = childTag.contacts || [];
          // 🚀 Phase 3修复: 不再更新contact.tags字段（已移除）
          // 子标签的联系人关联已通过tag.contacts字段管理，无需更新contact表

          // 删除子标签
          await Tag.destroy({ where: { id: childTag.id }, transaction });
        }
      }
    } else {
      // 检查是否已经存在分组（继续分组模式）
      const existingTestTags = await Tag.findAll({
        where: {
          parent_id: tagId,
          name: { [Op.like]: `${tag.name}_分组%` },
          user_id: tag.user_id
        },
        transaction
      });

      if (existingTestTags.length > 0) {
        logger.info(`[createSplitTest] Continue grouping mode: found ${existingTestTags.length} existing groups`);
      }
    }

    logger.info(`[createSplitTest] Creating split test for tag: ${tag.name} with ${groupCount} groups`);

    // 获取标签下的所有联系人
    // 从标签的contacts字段获取联系人ID，然后查询Contact表
    const contactIds = tag.contacts || [];

    if (contactIds.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '该标签下没有联系人，无法进行分组测试'
      });
    }

    const contacts = await Contact.findAll({
      where: {
        id: { [Op.in]: contactIds },
        user_id: tag.user_id
      },
      attributes: ['id', 'email', 'name'],
      transaction
    });



    logger.info(`[createSplitTest] Found ${contacts.length} contacts for split test`);

    // 随机打乱联系人顺序
    const shuffledContacts = [...contacts].sort(() => Math.random() - 0.5);

    // 计算分组比例
    let ratios = splitRatio;
    if (!ratios || ratios.length !== groupCount) {
      // 默认平均分配
      ratios = new Array(groupCount).fill(1 / groupCount);
    }

    // 验证比例总和
    const ratioSum = ratios.reduce((sum, ratio) => sum + ratio, 0);
    if (Math.abs(ratioSum - 1) > 0.01) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '分组比例总和必须等于1'
      });
    }

    // 生成分组名称 - 使用标签名_分组N的格式
    const finalGroupNames = groupNames ||
      Array.from({ length: groupCount }, (_, i) => `分组${i + 1}`);

    // 按比例分配联系人
    const groups = [];
    let startIndex = 0;

    for (let i = 0; i < groupCount; i++) {
      const groupSize = i === groupCount - 1
        ? shuffledContacts.length - startIndex // 最后一组包含剩余所有联系人
        : Math.floor(shuffledContacts.length * ratios[i]);

      const groupContacts = shuffledContacts.slice(startIndex, startIndex + groupSize);

      groups.push({
        groupName: finalGroupNames[i] || `组${i + 1}`,
        contacts: groupContacts,
        contactCount: groupContacts.length,
        ratio: groupContacts.length / shuffledContacts.length
      });

      startIndex += groupSize;
    }

    // 创建分组标签
    const createdGroups = [];
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const groupTagName = `${tag.name}_${group.groupName}`; // 使用父标签名_分组N格式

      // 检查标签名称是否已存在
      const existingGroupTag = await Tag.findOne({
        where: {
          name: groupTagName,
          user_id: tag.user_id,
          parent_id: tagId
        },
        transaction
      });

      if (existingGroupTag) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `分组标签"${groupTagName}"已存在`
        });
      }

      // 创建分组标签
      const groupTag = await Tag.create({
        name: groupTagName,
        description: `${testName}的${group.groupName}（A/B测试分组）`,
        parent_id: tagId,
        user_id: tag.user_id,
        contacts: group.contacts.map(c => c.id)
      }, { transaction });

      // 🚀 Phase 3修复: 不再更新contact.tags字段（已移除）
      // 标签的contacts字段已在创建时设置，无需额外更新联系人

      createdGroups.push({
        id: groupTag.id,
        name: groupTag.name,
        groupName: group.groupName,
        contactCount: group.contactCount,
        ratio: group.ratio,
        contacts: group.contacts
      });

      logger.info(`[createSplitTest] Created group tag: ${groupTag.name} with ${group.contactCount} contacts`);
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: `成功创建A/B测试分组，共${groupCount}组`,
      data: {
        testName,
        parentTag: {
          id: tag.id,
          name: tag.name
        },
        totalContacts: contacts.length,
        groups: createdGroups,
        summary: {
          groupCount: createdGroups.length,
          totalContacts: contacts.length,
          averageGroupSize: Math.round(contacts.length / createdGroups.length)
        }
      }
    });

  } catch (error) {
    if (transaction && !transaction.finished) {
      try { await transaction.rollback(); } catch (rbError) {
        logger.error('[CONTROLLER_ERROR] createSplitTest rollback error: ', rbError);
      }
    }
    logger.error(`[CONTROLLER_ERROR] createSplitTest: ${error.message} - ${error.stack}`);
    res.status(500).json({
      success: false,
      message: '创建A/B测试分组失败',
      error: error.message
    });
  }
};

/**
 * 获取联系人的标签详情（区分直接标签和继承标签）
 * @route GET /api/contacts/:id/tags
 * @access Private
 */
exports.getContactTags = async (req, res) => {
  try {
    const { id: contactId } = req.params;

    const contactWhere = { id: contactId };
    // 🔒 安全修复：所有用户（包括管理员）只能访问自己的联系人
    contactWhere.user_id = req.user.id;

    const contact = await Contact.findOne({ where: contactWhere });
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: '联系人不存在或不属于您'
      });
    }

    // 🚀 Phase 3修复: 使用反向查询获取联系人的标签
    const tags = await Tag.findAll({
      where: {
        user_id: contact.user_id,
        contacts: sequelize.literal(`contacts @> '[${JSON.stringify(contactId)}]'::jsonb`)
      },
      include: [
        { model: Tag, as: 'parent', attributes: ['id', 'name'], required: false }
      ]
    });

    if (tags.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          contactId: contact.id,
          email: contact.email,
          directTags: [],
          inheritedTags: [],
          allTags: []
        }
      });
    }

    // 分析标签关系
    const directTags = [];
    const inheritedTags = [];
    const parentTagIds = new Set();

    // 找出所有父标签ID
    tags.forEach(tag => {
      if (tag.parent_id) {
        parentTagIds.add(tag.parent_id);
      }
    });

    // 分类标签
    tags.forEach(tag => {
      if (tag.parent_id && parentTagIds.has(tag.parent_id)) {
        // 这是子标签，其父标签也在列表中
        directTags.push(tag);
      } else if (!tag.parent_id) {
        // 这是父标签
        const hasChildInList = tags.some(t => t.parent_id === tag.id);
        if (hasChildInList) {
          inheritedTags.push(tag);
        } else {
          directTags.push(tag);
        }
      } else {
        // 这是子标签，但父标签不在列表中（可能是数据不一致）
        directTags.push(tag);
      }
    });

    res.status(200).json({
      success: true,
      data: {
        contactId: contact.id,
        email: contact.email,
        directTags: directTags.map(tag => ({
          id: tag.id,
          name: tag.name,
          parent_id: tag.parent_id,
          parent: tag.parent
        })),
        inheritedTags: inheritedTags.map(tag => ({
          id: tag.id,
          name: tag.name,
          reason: '通过子标签继承'
        })),
        allTags: tags.map(tag => ({
          id: tag.id,
          name: tag.name,
          parent_id: tag.parent_id,
          isDirect: directTags.some(dt => dt.id === tag.id)
        }))
      }
    });

  } catch (error) {
    logger.error(`[CONTROLLER_ERROR] getContactTags: ${error.message} - ${error.stack}`);
    res.status(500).json({
      success: false,
      message: '获取联系人标签失败',
      error: error.message
    });
  }
};

// 辅助函数：检查是否为后代标签（防止循环引用）
async function checkIfDescendant(tagId, potentialAncestorId, transaction) {
  const descendants = await Tag.findAll({
    where: { parent_id: tagId },
    attributes: ['id'],
    transaction
  });

  for (const descendant of descendants) {
    if (descendant.id === potentialAncestorId) {
      return true;
    }
    // 递归检查
    const isNestedDescendant = await checkIfDescendant(descendant.id, potentialAncestorId, transaction);
    if (isNestedDescendant) {
      return true;
    }
  }

  return false;
} 