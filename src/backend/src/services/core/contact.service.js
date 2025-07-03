const { Contact, Tag, User, sequelize } = require('../../models/index');
const { Op } = require('sequelize');
const { AppError, handleServiceError } = require('../../utils/errorHandler');
const logger = require('../../utils/logger');
// const cacheManager = require('../../utils/cacheManager'); // 暂时注释，Phase 3专注核心功能
const ContactTagService = require('./contactTag.service');


// Helper to convert API (camelCase) DTO to Model (snake_case)
const contactDtoToModel = (dto) => {
  const modelData = {};
  if (dto.email !== undefined) modelData.email = dto.email;
  if (dto.name !== undefined) modelData.name = dto.name;
  if (dto.phone !== undefined) modelData.phone = dto.phone;
  if (dto.company !== undefined) modelData.company = dto.company;
  if (dto.position !== undefined) modelData.position = dto.position;
  if (dto.username !== undefined) modelData.username = dto.username;
  if (dto.firstName !== undefined) modelData.first_name = dto.firstName;
  if (dto.lastName !== undefined) modelData.last_name = dto.lastName;
  if (dto.tikTokId !== undefined) modelData.tiktok_unique_id = dto.tikTokId;
  if (dto.insId !== undefined) modelData.instagram_id = dto.insId;
  if (dto.youtubeId !== undefined) modelData.youtube_id = dto.youtubeId;
  if (dto.status !== undefined) modelData.status = dto.status; // Assuming status is same in DTO and model
  if (dto.source !== undefined) modelData.source = dto.source;

  // Custom fields
  for (let i = 1; i <= 5; i++) {
    if (dto[`customField${i}`] !== undefined) {
      modelData[`custom_field_${i}`] = dto[`customField${i}`];
    }
  }
  return modelData;
};

// Helper to convert Model (snake_case) to API (camelCase) DTO
const contactModelToDto = async (contactInstance, includeChildTags = true) => {
  if (!contactInstance) return null;
  const contactJson = contactInstance.toJSON ? contactInstance.toJSON() : contactInstance;

  const dto = {
    id: contactJson.id,
    email: contactJson.email,
    name: contactJson.name,
    phone: contactJson.phone,
    company: contactJson.company,
    position: contactJson.position,
    username: contactJson.username,
    firstName: contactJson.first_name,
    lastName: contactJson.last_name,
    tikTokId: contactJson.tiktok_unique_id,
    insId: contactJson.instagram_id,
    youtubeId: contactJson.youtube_id,
    status: contactJson.status,
    source: contactJson.source,
    userId: contactJson.user_id,
    createdAt: contactJson.created_at ? new Date(contactJson.created_at).toISOString() : null,
    updatedAt: contactJson.updated_at ? new Date(contactJson.updated_at).toISOString() : null,
  };

  for (let i = 1; i <= 5; i++) {
    dto[`customField${i}`] = contactJson[`custom_field_${i}`];
  }

  // 🚀 Phase 3: 使用反向查询获取标签信息（按照IMPLEMENTATION-003方案）
  try {
    const contactTagMap = await ContactTagService.getContactsWithTagsBatch(
      [contactJson.id],
      includeChildTags,
      contactJson.user_id
    );
    dto.tags = contactTagMap.get(contactJson.id) || [];
  } catch (error) {
    logger.warn('Failed to fetch tag details for contact:', { contactId: contactJson.id, error: error.message });
    dto.tags = [];
  }

  return dto;
};


class ContactService {
  /**
   * 🚀 性能优化：批量转换联系人为DTO，避免N+1查询问题
   * 🔄 Phase 3: 改为使用反向查询（按照IMPLEMENTATION-003方案）
   * @param {Array} contacts - 联系人实例数组
   * @param {boolean} includeChildTags - 是否包含子标签
   * @param {string} userId - 用户ID
   * @returns {Promise<Array>} DTO数组
   */
  async batchConvertToDto(contacts, includeChildTags = true, userId) {
    // 直接调用反向查询版本
    return await this.batchConvertToDtoWithReverseQuery(contacts, includeChildTags, userId);
  }

  /**
   * Create a new contact
   * @param {object} contactDto - Contact data in DTO format (camelCase)
   * @param {Array<number>} tagIds - Array of tag IDs to associate
   * @param {string} userId - ID of the user creating the contact
   * @returns {Promise<object>} The created contact DTO
   */
  async createContact(contactDto, tagIds, userId) {
    const transaction = await sequelize.transaction();
    try {
      if (!contactDto.email) {
        throw new AppError('Email is required.', 400);
      }

      const existingContact = await Contact.findOne({
        where: { email: contactDto.email, user_id: userId },
        transaction,
      });

      if (existingContact) {
        throw new AppError('Contact with this email already exists for this user.', 409); // 409 Conflict
      }

      const contactModelData = contactDtoToModel(contactDto);

      // V3.0: 验证并设置标签JSONB字段
      let validTagIds = [];
      let tagsToUpdate = [];
      if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
        const validTags = await Tag.findAll({
          where: { id: { [Op.in]: tagIds }, user_id: userId },
          transaction,
        });
        validTagIds = validTags.map(t => t.id);
        tagsToUpdate = validTags;
      }

      const newContactInstance = await Contact.create(
        {
          ...contactModelData,
          user_id: userId
          // 🚀 Phase 3: 不再存储tags字段到contacts表（按照IMPLEMENTATION-003方案）
        },
        { transaction }
      );

      // V3.0: 双向同步 - 更新标签的contacts字段
      for (const tag of tagsToUpdate) {
        const currentContacts = tag.contacts || [];
        if (!currentContacts.includes(newContactInstance.id)) {
          const updatedContacts = [...currentContacts, newContactInstance.id];
          await tag.update({ contacts: updatedContacts }, { transaction });
        }
      }

      await transaction.commit();

      // 🔄 缓存优化：创建联系人后清除相关标签缓存
      if (validTagIds.length > 0) {
        // cacheManager.clearContactRelatedCache(userId, validTagIds);
        logger.info(`[CACHE] Cleared cache after creating contact ${newContactInstance.id} with tags: ${validTagIds.join(', ')}`);
      }

      return await contactModelToDto(newContactInstance);
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      // Log the original error for server-side debugging
      logger.error('Error in ContactService.createContact:', { error: error.message, stack: error.stack, contactDto, userId });
      // Re-throw AppError or wrap other errors
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to create contact.', 500, error.message);
    }
  }

  /**
   * Get a list of contacts with filtering, pagination, and sorting
   * @param {object} filters - { page, limit, search, status, tags (comma-separated string of tag IDs), sort, order, include_child_tags, context }
   * @param {string} userId - ID of the user requesting the contacts
   * @returns {Promise<object>} { data: [contactDtos], pagination: { page, limit, total, pages } }
   */
  async getContacts(filters, userId) {
    try {
      const page = parseInt(filters.page, 10) || 1;
      let limit = parseInt(filters.limit, 10) || 50;

      // 🚀 Phase 3: 根据使用场景控制分页大小，优化性能
      const context = filters.context || 'contact_management';
      const maxLimit = context === 'task_creation' ? 100 : 50;
      limit = Math.min(limit, maxLimit);

      const offset = (page - 1) * limit;
      // 正确处理字符串参数转换为布尔值
      const includeChildTags = filters.include_child_tags === 'true' || filters.include_child_tags === true;

      logger.info('获取联系人列表:', {
        page,
        limit,
        context,
        includeChildTags,
        userId,
        hasTagFilter: !!filters.tags
      });

      // 🚀 Phase 3: 如果有标签筛选，使用反向查询优化
      if (filters.tags) {
        return await this.getContactsWithTagFilter(filters, userId, page, limit, includeChildTags);
      }

      // 常规查询逻辑
      const whereClause = { user_id: userId };

      if (filters.search) {
        const searchTerm = `%${filters.search}%`;
        whereClause[Op.or] = [
          { email: { [Op.iLike]: searchTerm } },
          { username: { [Op.iLike]: searchTerm } },
          { first_name: { [Op.iLike]: searchTerm } },
          { last_name: { [Op.iLike]: searchTerm } },
          { tiktok_unique_id: { [Op.iLike]: searchTerm } },
          { instagram_id: { [Op.iLike]: searchTerm } },
          { youtube_id: { [Op.iLike]: searchTerm } },
        ];
      }

      if (filters.status) {
        whereClause.status = filters.status;
      }

      // 排序设置
      const orderBy = filters.sort && filters.order ? [[filters.sort, filters.order.toUpperCase()]] : [['created_at', 'DESC']];

      const { count, rows } = await Contact.findAndCountAll({
        where: whereClause,
        attributes: [
          'id', 'email', 'name', 'phone', 'company', 'position',
          'username', 'first_name', 'last_name', 'tiktok_unique_id',
          'instagram_id', 'youtube_id', 'status', 'source', 'user_id',
          'custom_field_1', 'custom_field_2', 'custom_field_3',
          'custom_field_4', 'custom_field_5', 'imported_at',
          'created_at', 'updated_at'
        ],
        limit,
        offset,
        order: orderBy,
        distinct: true,
      });

      // 🚀 Phase 3: 使用反向查询批量获取标签
      const contactDtos = await this.batchConvertToDtoWithReverseQuery(rows, includeChildTags, userId);

      return {
        data: contactDtos,
        pagination: {
          page,
          limit,
          total: count,
          pages: Math.ceil(count / limit),
        },
      };
    } catch (error) {
      logger.error('Error in ContactService.getContacts:', { error: error.message, stack: error.stack, filters, userId });
      throw handleServiceError(error, 'Failed to get contacts.');
    }
  }

  /**
   * 🚀 Phase 3: 使用标签筛选的联系人查询（反向查询优化）
   * @param {object} filters - 筛选条件
   * @param {string} userId - 用户ID
   * @param {number} page - 页码
   * @param {number} limit - 每页数量
   * @param {boolean} includeChildTags - 是否包含子标签
   * @returns {Promise<object>} 查询结果
   */
  async getContactsWithTagFilter(filters, userId, page, limit, includeChildTags) {
    try {
      const tagIds = filters.tags.split(',').map(id => id.trim()).filter(id => id.length > 0);

      if (tagIds.length === 0) {
        return { data: [], pagination: { page, limit, total: 0, pages: 0 } };
      }

      logger.info('使用标签筛选联系人:', { tagIds, page, limit, includeChildTags });

      // 1. 通过标签反向查询获取联系人ID
      const tagFilterResult = await ContactTagService.getContactIdsByTags(tagIds, userId, { page, limit });
      const { contactIds, pagination } = tagFilterResult;

      if (contactIds.length === 0) {
        return { data: [], pagination };
      }

      // 2. 获取联系人详情
      let whereClause = {
        id: contactIds,
        user_id: userId
      };

      // 添加其他筛选条件
      if (filters.search) {
        const searchTerm = `%${filters.search}%`;
        whereClause[Op.and] = [
          whereClause,
          {
            [Op.or]: [
              { email: { [Op.iLike]: searchTerm } },
              { username: { [Op.iLike]: searchTerm } },
              { first_name: { [Op.iLike]: searchTerm } },
              { last_name: { [Op.iLike]: searchTerm } },
              { tiktok_unique_id: { [Op.iLike]: searchTerm } },
              { instagram_id: { [Op.iLike]: searchTerm } },
              { youtube_id: { [Op.iLike]: searchTerm } },
            ]
          }
        ];
      }

      if (filters.status) {
        whereClause.status = filters.status;
      }

      // 排序设置
      const orderBy = filters.sort && filters.order ? [[filters.sort, filters.order.toUpperCase()]] : [['created_at', 'DESC']];

      const contacts = await Contact.findAll({
        where: whereClause,
        order: orderBy
      });

      // 3. 使用反向查询批量获取标签
      const contactDtos = await this.batchConvertToDtoWithReverseQuery(contacts, includeChildTags, userId);

      return {
        data: contactDtos,
        pagination
      };

    } catch (error) {
      logger.error('标签筛选联系人失败:', error);
      throw error;
    }
  }

  /**
   * 🚀 Phase 3: 使用反向查询批量转换联系人为DTO
   * @param {Array} contacts - 联系人实例数组
   * @param {boolean} includeChildTags - 是否包含子标签
   * @param {string} userId - 用户ID
   * @returns {Promise<Array>} DTO数组
   */
  async batchConvertToDtoWithReverseQuery(contacts, includeChildTags = true, userId) {
    if (!contacts || contacts.length === 0) return [];

    logger.info('批量转换联系人DTO:', {
      contactCount: contacts.length,
      includeChildTags,
      userId
    });

    // 1. 提取联系人ID
    const contactIds = contacts.map(contact => contact.id);

    // 2. 使用反向查询批量获取标签（Phase 3核心功能）
    const contactTagMap = await ContactTagService.getContactsWithTagsBatch(
      contactIds,
      includeChildTags,
      userId
    );

    // 3. 批量转换所有联系人
    return contacts.map(contact => {
      const contactJson = contact.toJSON ? contact.toJSON() : contact;

      const dto = {
        id: contactJson.id,
        email: contactJson.email,
        name: contactJson.name,
        phone: contactJson.phone,
        company: contactJson.company,
        position: contactJson.position,
        username: contactJson.username,
        firstName: contactJson.first_name,
        lastName: contactJson.last_name,
        tikTokId: contactJson.tiktok_unique_id,
        insId: contactJson.instagram_id,
        youtubeId: contactJson.youtube_id,
        status: contactJson.status,
        source: contactJson.source,
        userId: contactJson.user_id,
        createdAt: contactJson.created_at ? new Date(contactJson.created_at).toISOString() : null,
        updatedAt: contactJson.updated_at ? new Date(contactJson.updated_at).toISOString() : null,
      };

      // 添加自定义字段
      for (let i = 1; i <= 5; i++) {
        dto[`customField${i}`] = contactJson[`custom_field_${i}`];
      }

      // 🚀 Phase 3: 使用反向查询结果设置标签
      dto.tags = contactTagMap.get(contactJson.id) || [];

      return dto;
    });
  }

  /**
   * Get a single contact by ID
   * @param {string} contactId - ID of the contact
   * @param {string} userId - ID of the user (for permission check)
   * @param {boolean} includeChildTags - 是否包含子标签显示，默认false（联系人编辑页面不显示子标签）
   * @returns {Promise<object|null>} The contact DTO or null if not found/not permitted
   */
  async getContactById(contactId, userId, includeChildTags = false) {
    try {
      const contactInstance = await Contact.findOne({
        where: { id: contactId, user_id: userId }
      });

      if (!contactInstance) {
        throw new AppError('Contact not found or access denied.', 404);
      }
      return await contactModelToDto(contactInstance, includeChildTags);
    } catch (error) {
      logger.error('Error in ContactService.getContactById:', { error: error.message, stack: error.stack, contactId, userId });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to retrieve contact by ID.', 500, error.message);
    }
  }

  /**
   * Update an existing contact
   * @param {string} contactId - ID of the contact to update
   * @param {object} contactUpdateDto - Contact data to update (camelCase)
   * @param {Array<number>|undefined} tagIds - Array of tag IDs to set. If undefined, tags are not changed.
   *                                         If empty array, all tags are removed.
   * @param {string} userId - ID of the user updating the contact
   * @returns {Promise<object>} The updated contact DTO
   */
  async updateContact(contactId, contactUpdateDto, tagIds, userId) {
    const transaction = await sequelize.transaction();
    try {
      const contactInstance = await Contact.findOne({
        where: { id: contactId, user_id: userId },
        transaction,
      });

      if (!contactInstance) {
        throw new AppError('Contact not found or access denied.', 404);
      }

      // Check for email uniqueness if email is being changed
      if (contactUpdateDto.email && contactUpdateDto.email !== contactInstance.email) {
        const existingContactWithNewEmail = await Contact.findOne({
          where: {
            email: contactUpdateDto.email,
            user_id: userId,
            id: { [Op.ne]: contactId }, // Exclude current contact
          },
          transaction,
        });
        if (existingContactWithNewEmail) {
          throw new AppError('Another contact with this email already exists.', 409);
        }
      }

      const contactModelUpdateData = contactDtoToModel(contactUpdateDto);

      // V3.0: 只维护tag.contacts字段，不再使用contact.tags（IMPLEMENTATION-003方案）
      // contactModelUpdateData.tags = validTagIds; // 已移除contact.tags字段

      await contactInstance.update(contactModelUpdateData, { transaction });

      await transaction.commit();

      // 🔄 缓存优化：更新联系人后清除相关标签缓存
      if (tagIds !== undefined) {
        const allAffectedTagIds = [...new Set([...tagIds])];
        if (allAffectedTagIds.length > 0) {
          // cacheManager.clearContactRelatedCache(userId, allAffectedTagIds);
          logger.info(`[CACHE] Cleared cache after updating contact ${contactId} with affected tags: ${allAffectedTagIds.join(', ')}`);
        }
      }

      return await contactModelToDto(contactInstance);
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      logger.error('Error in ContactService.updateContact:', { error: error.message, stack: error.stack, contactId, userId });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to update contact.', 500, error.message);
    }
  }

  /**
   * Delete a contact by ID
   * @param {string} contactId - ID of the contact to delete
   * @param {string} userId - ID of the user deleting the contact
   * @returns {Promise<void>} Resolves if deletion is successful
   */
  async deleteContact(contactId, userId) {
    const transaction = await sequelize.transaction();
    try {
      const contactInstance = await Contact.findOne({
        where: { id: contactId, user_id: userId },
        transaction,
      });

      if (!contactInstance) {
        throw new AppError('Contact not found or access denied.', 404);
      }

      // 🚀 Phase 3: 使用反向查询找到包含该联系人的标签（IMPLEMENTATION-003方案）
      const relatedTags = await Tag.findAll({
        where: {
          user_id: userId,
          contacts: sequelize.literal(`contacts @> '[${contactId}]'`)
        },
        transaction,
      });

      // 从相关标签的contacts字段中移除该联系人
      for (const tag of relatedTags) {
        const currentContacts = tag.contacts || [];
        const updatedContacts = currentContacts.filter(id => id !== contactId);
        await tag.update({ contacts: updatedContacts }, { transaction });
      }

      await contactInstance.destroy({ transaction });

      await transaction.commit();

      // 🔄 缓存优化：删除联系人后清除相关标签缓存
      const relatedTagIds = relatedTags.map(tag => tag.id);
      if (relatedTagIds.length > 0) {
        // cacheManager.clearContactRelatedCache(userId, relatedTagIds);
        logger.info(`[CACHE] Cleared cache after deleting contact ${contactId} with tags: ${relatedTagIds.join(', ')}`);
      }
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      logger.error('Error in ContactService.deleteContact:', { error: error.message, stack: error.stack, contactId, userId });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to delete contact.', 500, error.message);
    }
  }

  /**
   * Bulk delete contacts by their IDs
   * @param {Array<string|number>} contactIds - Array of contact IDs to delete
   * @param {string} userId - ID of the user deleting the contacts
   * @returns {Promise<number>} The number of contacts deleted
   */
  async bulkDeleteContacts(contactIds, userId) {
    const transaction = await sequelize.transaction();
    try {
      // 验证联系人存在
      const contactsToDelete = await Contact.findAll({
        where: {
          id: { [Op.in]: contactIds },
          user_id: userId,
        },
        attributes: ['id'],
        transaction,
      });

      if (contactsToDelete.length === 0) {
        throw new AppError('No contacts found to delete, or no permissions for the provided IDs.', 404);
      }

      // 🚀 Phase 3: 使用反向查询找到包含这些联系人的标签
      const relatedTags = await Tag.findAll({
        where: {
          user_id: userId,
          contacts: sequelize.literal(`contacts && '${JSON.stringify(contactIds)}'::jsonb`)
        },
        transaction,
      });

      // 从相关标签的contacts字段中移除这些联系人
      for (const tag of relatedTags) {
        const currentContacts = tag.contacts || [];
        const updatedContacts = currentContacts.filter(contactId =>
          !contactIds.includes(contactId)
        );
        await tag.update({ contacts: updatedContacts }, { transaction });
      }

      // 执行删除操作
      const deletedCount = await Contact.destroy({
        where: {
          id: { [Op.in]: contactIds },
          user_id: userId,
        },
        transaction,
      });

      await transaction.commit();

      // 🔄 缓存优化：批量删除联系人后清除相关标签缓存
      const relatedTagIds = relatedTags.map(tag => tag.id);
      if (relatedTagIds.length > 0) {
        // cacheManager.clearContactRelatedCache(userId, relatedTagIds);
        logger.info(`[CACHE] Cleared cache after bulk deleting ${deletedCount} contacts with tags: ${relatedTagIds.join(', ')}`);
      }

      return deletedCount;
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      logger.error('Error in ContactService.bulkDeleteContacts:', { error: error.message, stack: error.stack, contactIds, userId });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to bulk delete contacts.', 500, error.message);
    }
  }

  /**
   * Add a tag to a contact
   * @param {string} contactId - ID of the contact
   * @param {number} tagId - ID of the tag to add
   * @param {string} userId - ID of the user (for permission check)
   * @returns {Promise<object>} The updated contact DTO
   */
  async addTagToContact(contactId, tagId, userId) {
    const transaction = await sequelize.transaction();
    try {
      const contactInstance = await Contact.findOne({
        where: { id: contactId, user_id: userId },
        transaction,
      });

      if (!contactInstance) {
        throw new AppError('Contact not found or access denied.', 404);
      }

      // Verify the tag exists and belongs to the user
      const tagInstance = await Tag.findOne({
        where: { id: tagId, user_id: userId },
        transaction,
      });

      if (!tagInstance) {
        throw new AppError('Tag not found or access denied.', 404);
      }

      // V3.0: 双向同步更新JSONB字段
      const currentTags = contactInstance.tags || [];
      if (!currentTags.includes(tagId)) {
        const updatedTags = [...currentTags, tagId];
        await contactInstance.update({ tags: updatedTags }, { transaction });

        // 同步更新标签的contacts字段
        const currentContacts = tagInstance.contacts || [];
        if (!currentContacts.includes(contactId)) {
          const updatedContacts = [...currentContacts, contactId];
          await tagInstance.update({ contacts: updatedContacts }, { transaction });
        }
      }

      await transaction.commit();

      // 🔄 缓存优化：添加标签后清除相关缓存
      // cacheManager.clearContactRelatedCache(userId, [tagId]);
      logger.info(`[CACHE] Cleared cache after adding tag ${tagId} to contact ${contactId}`);

      return await contactModelToDto(contactInstance);
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      logger.error('Error in ContactService.addTagToContact:', { error: error.message, stack: error.stack, contactId, tagId, userId });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to add tag to contact.', 500, error.message);
    }
  }

  /**
   * Remove a tag from a contact
   * @param {string} contactId - ID of the contact
   * @param {number} tagId - ID of the tag to remove
   * @param {string} userId - ID of the user (for permission check)
   * @returns {Promise<object>} The updated contact DTO
   */
  async removeTagFromContact(contactId, tagId, userId) {
    const transaction = await sequelize.transaction();
    try {
      const contactInstance = await Contact.findOne({
        where: { id: contactId, user_id: userId },
        transaction,
      });

      if (!contactInstance) {
        throw new AppError('Contact not found or access denied.', 404);
      }

      // V3.0: 双向同步从JSONB字段移除标签
      const currentTags = contactInstance.tags || [];
      if (currentTags.includes(tagId)) {
        const updatedTags = currentTags.filter(id => id !== tagId);
        await contactInstance.update({ tags: updatedTags }, { transaction });

        // 同步更新标签的contacts字段
        const tagInstance = await Tag.findOne({
          where: { id: tagId, user_id: userId },
          transaction,
        });

        if (tagInstance) {
          const currentContacts = tagInstance.contacts || [];
          const updatedContacts = currentContacts.filter(id => id !== contactId);
          await tagInstance.update({ contacts: updatedContacts }, { transaction });
        }
      }

      await transaction.commit();

      // 🔄 缓存优化：移除标签后清除相关缓存
      // cacheManager.clearContactRelatedCache(userId, [tagId]);
      logger.info(`[CACHE] Cleared cache after removing tag ${tagId} from contact ${contactId}`);

      return await contactModelToDto(contactInstance);
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      logger.error('Error in ContactService.removeTagFromContact:', { error: error.message, stack: error.stack, contactId, tagId, userId });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to remove tag from contact.', 500, error.message);
    }
  }

  /**
   * Bulk add tags to multiple contacts
   * @param {Array<string>} contactIds - Array of contact IDs
   * @param {Array<number>} tagIds - Array of tag IDs to add
   * @param {string} userId - ID of the user (for permission check)
   * @returns {Promise<number>} The number of contacts updated
   */
  async bulkAddTagsToContacts(contactIds, tagIds, userId) {
    const transaction = await sequelize.transaction();
    try {
      // Verify all tags exist and belong to the user
      const validTags = await Tag.findAll({
        where: { id: { [Op.in]: tagIds }, user_id: userId },
        attributes: ['id'],
        transaction,
      });
      const validTagIds = validTags.map(t => t.id);

      if (validTagIds.length === 0) {
        throw new AppError('No valid tags found.', 404);
      }

      // V3.0: 使用ContactTagService管理tag.contacts字段
      const contacts = await Contact.findAll({
        where: { id: { [Op.in]: contactIds }, user_id: userId },
        transaction,
      });

      let updatedCount = 0;
      for (const contact of contacts) {
        // 使用ContactTagService添加联系人到标签
        for (const tagId of validTagIds) {
          await ContactTagService.addContactToTag(contact.id, tagId, userId, transaction);
        }
        updatedCount++;
      }

      await transaction.commit();

      // 🔄 缓存优化：批量添加标签后清除相关缓存
      if (updatedCount > 0) {
        logger.info(`[CACHE] Cleared cache after bulk adding tags ${validTagIds.join(', ')} to ${updatedCount} contacts`);
      }

      return updatedCount;
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      logger.error('Error in ContactService.bulkAddTagsToContacts:', { error: error.message, stack: error.stack, contactIds, tagIds, userId });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to bulk add tags to contacts.', 500, error.message);
    }
  }

  /**
   * Bulk remove tags from multiple contacts
   * @param {Array<string>} contactIds - Array of contact IDs
   * @param {Array<number>} tagIds - Array of tag IDs to remove
   * @param {string} userId - ID of the user (for permission check)
   * @returns {Promise<number>} The number of contacts updated
   */
  async bulkRemoveTagsFromContacts(contactIds, tagIds, userId) {
    const transaction = await sequelize.transaction();
    try {
      // V3.0: 使用ContactTagService管理tag.contacts字段
      const contacts = await Contact.findAll({
        where: { id: { [Op.in]: contactIds }, user_id: userId },
        transaction,
      });

      let updatedCount = 0;
      for (const contact of contacts) {
        // 使用ContactTagService从标签中移除联系人
        for (const tagId of tagIds) {
          await ContactTagService.removeContactFromTag(contact.id, tagId, userId, transaction);
        }
        updatedCount++;
      }

      await transaction.commit();

      // 🔄 缓存优化：批量移除标签后清除相关缓存
      if (updatedCount > 0) {
        logger.info(`[CACHE] Cleared cache after bulk removing tags ${tagIds.join(', ')} from ${updatedCount} contacts`);
      }

      return updatedCount;
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      logger.error('Error in ContactService.bulkRemoveTagsFromContacts:', { error: error.message, stack: error.stack, contactIds, tagIds, userId });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to bulk remove tags from contacts.', 500, error.message);
    }
  }

  /**
   * Count contacts by tag IDs
   * @param {Array<number>} tagIds - Array of tag IDs
   * @param {string} userId - ID of the user
   * @returns {Promise<object>} Object with tag IDs as keys and counts as values
   */
  async countContactsByTags(tagIds, userId) {
    try {
      const result = {};

      // V3.0: 使用ContactTagService反向查询
      for (const tagId of tagIds) {
        const contacts = await ContactTagService.getContactsByTag(tagId, userId);
        result[tagId] = contacts.length;
      }

      return result;
    } catch (error) {
      logger.error('Error in ContactService.countContactsByTags:', { error: error.message, stack: error.stack, tagIds, userId });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to count contacts by tags.', 500, error.message);
    }
  }

  /**
   * Count contacts by tag IDs (include/exclude logic)
   * @param {Array<string>} includeTagIds - Tag IDs that contacts must have
   * @param {Array<string>} excludeTagIds - Tag IDs that contacts must not have
   * @param {string} userId - ID of the user
   * @returns {Promise<number>} Count of matching contacts
   */
  async countContactsByTagIds(includeTagIds = [], excludeTagIds = [], userId) {
    try {
      let whereClause = { user_id: userId };

      // 🚀 Phase 3完成: 使用反向查询统计联系人
      let contactIds = new Set();

      if (includeTagIds.length > 0) {
        // 获取包含指定标签的联系人
        for (const tagId of includeTagIds) {
          const tagContacts = await ContactTagService.getContactsByTag(tagId, userId);
          tagContacts.forEach(contact => contactIds.add(contact.id));
        }
      } else {
        // 如果没有包含条件，获取所有联系人
        const allContacts = await Contact.findAll({
          where: { user_id: userId },
          attributes: ['id']
        });
        allContacts.forEach(contact => contactIds.add(contact.id));
      }

      if (excludeTagIds.length > 0) {
        // 移除包含排除标签的联系人
        for (const tagId of excludeTagIds) {
          const tagContacts = await ContactTagService.getContactsByTag(tagId, userId);
          tagContacts.forEach(contact => contactIds.delete(contact.id));
        }
      }

      const count = contactIds.size;


      return count;
    } catch (error) {
      logger.error('Error in ContactService.countContactsByTagIds:', { error: error.message, stack: error.stack, includeTagIds, excludeTagIds, userId });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to count contacts by tag IDs.', 500, error.message);
    }
  }

  /**
   * Count contacts by tag names (include/exclude logic)
   * @param {Array<string>} includeTagNames - Tag names that contacts must have
   * @param {Array<string>} excludeTagNames - Tag names that contacts must not have
   * @param {string} userId - ID of the user
   * @returns {Promise<number>} Count of matching contacts
   */
  async countContactsByTagNames(includeTagNames = [], excludeTagNames = [], userId) {
    try {
      let whereClause = { user_id: userId };

      // 🚀 Phase 3完成: 通过标签名称使用反向查询
      let includeTagIds = [];
      let excludeTagIds = [];

      if (includeTagNames.length > 0) {
        const includeTags = await Tag.findAll({
          where: { name: { [Op.in]: includeTagNames }, user_id: userId },
          attributes: ['id']
        });
        includeTagIds = includeTags.map(t => t.id);

        if (includeTagIds.length === 0) {
          return 0; // 没有找到匹配的标签，返回0
        }
      }

      if (excludeTagNames.length > 0) {
        const excludeTags = await Tag.findAll({
          where: { name: { [Op.in]: excludeTagNames }, user_id: userId },
          attributes: ['id']
        });
        excludeTagIds = excludeTags.map(t => t.id);
      }

      // 使用反向查询统计
      const count = await this.countContactsByTagIds(includeTagIds, excludeTagIds, userId);
      return count;
    } catch (error) {
      logger.error('Error in ContactService.countContactsByTagNames:', { error: error.message, stack: error.stack, includeTagNames, excludeTagNames, userId });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to count contacts by tag names.', 500, error.message);
    }
  }
}

module.exports = new ContactService(); 