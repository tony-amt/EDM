const { Contact, Tag, User, sequelize } = require('../../models');
const { Op } = require('sequelize');
const { AppError, handleServiceError } = require('../../utils/errorHandler');
const logger = require('../../utils/logger');


// Helper to convert API (camelCase) DTO to Model (snake_case)
const contactDtoToModel = (dto) => {
  console.log('[DEBUG] contactDtoToModel input:', dto);
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
  console.log('[DEBUG] contactDtoToModel output:', modelData);
  return modelData;
};

// Helper to convert Model (snake_case) to API (camelCase) DTO
const contactModelToDto = async (contactInstance) => {
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

  // V3.0: 从JSONB字段获取标签信息
  if (contactJson.tags && Array.isArray(contactJson.tags) && contactJson.tags.length > 0) {
    try {
      const tagDetails = await Tag.findAll({
        where: { id: { [Op.in]: contactJson.tags } },
        attributes: ['id', 'name']
      });
      dto.tags = tagDetails.map(tag => ({
      id: tag.id,
        name: tag.name
      }));
    } catch (error) {
      logger.warn('Failed to fetch tag details for contact:', { contactId: contactJson.id, tagIds: contactJson.tags, error: error.message });
      dto.tags = [];
    }
  } else {
    dto.tags = [];
  }
  
  return dto;
};


class ContactService {
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
          user_id: userId,
          tags: validTagIds // V3.0: 直接存储标签ID数组到JSONB字段
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
   * @param {object} filters - { page, limit, search, status, tags (comma-separated string of tag IDs), sort, order }
   * @param {string} userId - ID of the user requesting the contacts
   * @returns {Promise<object>} { data: [contactDtos], pagination: { page, limit, total, pages } }
   */
  async getContacts(filters, userId) {
    try {
      const page = parseInt(filters.page, 10) || 1;
      const limit = parseInt(filters.limit, 10) || 50;
      const offset = (page - 1) * limit;

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

      // V3.0: 使用JSONB字段过滤标签
      if (filters.tags) {
        const tagIds = filters.tags.split(',').map(id => id.trim()).filter(id => id.length > 0);
        if (tagIds.length > 0) {
          // 使用PostgreSQL的JSONB包含操作符
          whereClause.tags = {
            [Op.contains]: tagIds // JSONB数组包含指定标签ID
          };
        }
      }

      // 排序设置
      let orderClause = [['created_at', 'DESC']]; // 默认排序
      if (filters.sort && filters.order) {
        const sortField = filters.sort === 'created_at' ? 'created_at' : 
                         filters.sort === 'updated_at' ? 'updated_at' :
                         filters.sort === 'email' ? 'email' :
                         filters.sort === 'name' ? 'name' : 'created_at';
        const sortOrder = filters.order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        orderClause = [[sortField, sortOrder]];
      }

      const queryOptions = {
        where: whereClause,
        offset,
        limit,
        order: orderClause,
      };
      
      const { count, rows: contacts } = await Contact.findAndCountAll(queryOptions);
      
      // 转换为DTO格式（包含标签详情）
      const contactDtos = await Promise.all(
        contacts.map(contact => contactModelToDto(contact))
      );
      
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
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to retrieve contacts.', 500, error.message);
    }
  }

  /**
   * Get a single contact by ID
   * @param {string} contactId - ID of the contact
   * @param {string} userId - ID of the user (for permission check)
   * @returns {Promise<object|null>} The contact DTO or null if not found/not permitted
   */
  async getContactById(contactId, userId) {
    try {
      const contactInstance = await Contact.findOne({
        where: { id: contactId, user_id: userId }
      });

      if (!contactInstance) {
        throw new AppError('Contact not found or access denied.', 404);
      }
      return await contactModelToDto(contactInstance);
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

      // V3.0: 处理标签更新 - 双向同步
      if (tagIds !== undefined) {
        const oldTagIds = contactInstance.tags || [];

        let validTagIds = [];
        if (Array.isArray(tagIds) && tagIds.length > 0) {
          const validTags = await Tag.findAll({
            where: { id: { [Op.in]: tagIds }, user_id: userId },
            transaction,
          });
          validTagIds = validTags.map(t => t.id);
        }
        
        // 找出需要添加和移除的标签
        const tagsToAdd = validTagIds.filter(id => !oldTagIds.includes(id));
        const tagsToRemove = oldTagIds.filter(id => !validTagIds.includes(id));
        
        // 更新需要添加的标签的contacts字段
        if (tagsToAdd.length > 0) {
          const tagsToAddInstances = await Tag.findAll({
            where: { id: { [Op.in]: tagsToAdd }, user_id: userId },
            transaction,
          });
          
          for (const tag of tagsToAddInstances) {
            const currentContacts = tag.contacts || [];
            if (!currentContacts.includes(contactId)) {
              const updatedContacts = [...currentContacts, contactId];
              await tag.update({ contacts: updatedContacts }, { transaction });
            }
          }
        }
        
        // 更新需要移除的标签的contacts字段
        if (tagsToRemove.length > 0) {
          const tagsToRemoveInstances = await Tag.findAll({
            where: { id: { [Op.in]: tagsToRemove }, user_id: userId },
            transaction,
          });
          
          for (const tag of tagsToRemoveInstances) {
            const currentContacts = tag.contacts || [];
            const updatedContacts = currentContacts.filter(id => id !== contactId);
            await tag.update({ contacts: updatedContacts }, { transaction });
          }
        }
        
        contactModelUpdateData.tags = validTagIds; // 更新JSONB字段
      }
      
      await contactInstance.update(contactModelUpdateData, { transaction });

      await transaction.commit();

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

      // V3.0: 双向同步 - 从相关标签的contacts字段中移除该联系人
      const contactTagIds = contactInstance.tags || [];
      if (contactTagIds.length > 0) {
        const relatedTags = await Tag.findAll({
          where: { id: { [Op.in]: contactTagIds }, user_id: userId },
          transaction,
        });
        
        for (const tag of relatedTags) {
          const currentContacts = tag.contacts || [];
          const updatedContacts = currentContacts.filter(id => id !== contactId);
          await tag.update({ contacts: updatedContacts }, { transaction });
        }
      }

      await contactInstance.destroy({ transaction });
      
      await transaction.commit();
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
      // V3.0: 双向同步 - 先获取要删除的联系人的标签信息
      const contactsToDelete = await Contact.findAll({
        where: {
          id: { [Op.in]: contactIds },
          user_id: userId,
        },
        attributes: ['id', 'tags'],
        transaction,
      });

      if (contactsToDelete.length === 0) {
        throw new AppError('No contacts found to delete, or no permissions for the provided IDs.', 404);
      }

      // 收集所有相关的标签ID
      const allTagIds = new Set();
      const contactTagMap = new Map();
      
      for (const contact of contactsToDelete) {
        const tagIds = contact.tags || [];
        contactTagMap.set(contact.id, tagIds);
        tagIds.forEach(tagId => allTagIds.add(tagId));
      }

      // 更新相关标签的contacts字段
      if (allTagIds.size > 0) {
        const relatedTags = await Tag.findAll({
          where: { id: { [Op.in]: Array.from(allTagIds) }, user_id: userId },
          transaction,
        });
        
        for (const tag of relatedTags) {
          const currentContacts = tag.contacts || [];
          const updatedContacts = currentContacts.filter(contactId => 
            !contactIds.includes(contactId)
          );
          await tag.update({ contacts: updatedContacts }, { transaction });
        }
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

      // V3.0: 批量更新JSONB字段
      const contacts = await Contact.findAll({
        where: { id: { [Op.in]: contactIds }, user_id: userId },
        transaction,
      });

      let updatedCount = 0;
      for (const contact of contacts) {
        const currentTags = contact.tags || [];
        const newTags = [...new Set([...currentTags, ...validTagIds])]; // 去重
        if (newTags.length !== currentTags.length) {
          await contact.update({ tags: newTags }, { transaction });
          updatedCount++;
        }
      }

      await transaction.commit();
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
      // V3.0: 批量更新JSONB字段
      const contacts = await Contact.findAll({
        where: { id: { [Op.in]: contactIds }, user_id: userId },
        transaction,
      });

      let updatedCount = 0;
      for (const contact of contacts) {
        const currentTags = contact.tags || [];
        const newTags = currentTags.filter(id => !tagIds.includes(id));
        if (newTags.length !== currentTags.length) {
          await contact.update({ tags: newTags }, { transaction });
          updatedCount++;
        }
      }

      await transaction.commit();
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

      // V3.0: 使用JSONB字段查询
      for (const tagId of tagIds) {
      const count = await Contact.count({
        where: {
          user_id: userId,
          tags: {
              [Op.contains]: [tagId] // JSONB数组包含指定标签ID
            }
          }
        });
        result[tagId] = count;
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

      // V3.0: 直接使用标签ID查询JSONB字段
      if (includeTagIds.length > 0) {
        // 对于单个标签，使用 @> 操作符检查JSONB数组是否包含指定元素
        if (includeTagIds.length === 1) {
          whereClause.tags = {
            [Op.contains]: [includeTagIds[0]] // JSONB数组包含指定标签ID
          };
        } else {
          // 对于多个标签，检查是否包含所有指定标签
          whereClause.tags = {
            [Op.contains]: includeTagIds // JSONB数组包含所有指定标签ID
          };
        }
      }

      if (excludeTagIds.length > 0) {
        if (whereClause.tags) {
          // 既有包含又有排除的复杂查询
          whereClause[Op.and] = [
            { tags: whereClause.tags },
            { tags: { [Op.not]: { [Op.overlap]: excludeTagIds } } }
          ];
          delete whereClause.tags;
        } else {
          // 只有排除标签
          whereClause.tags = {
            [Op.not]: { [Op.overlap]: excludeTagIds }
          };
        }
      }

      console.log('🔧 [DEBUG] countContactsByTagIds whereClause:', JSON.stringify(whereClause, null, 2));
      
      const count = await Contact.count({ where: whereClause });
      
      console.log(`🔧 [DEBUG] countContactsByTagIds result: ${count} contacts found for includeTagIds: ${JSON.stringify(includeTagIds)}, excludeTagIds: ${JSON.stringify(excludeTagIds)}`);
      
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

      // V3.0: 通过标签名称获取ID，然后查询JSONB字段
      if (includeTagNames.length > 0) {
        const includeTags = await Tag.findAll({
          where: { name: { [Op.in]: includeTagNames }, user_id: userId },
          attributes: ['id']
        });
        const includeTagIds = includeTags.map(t => t.id);
        
        if (includeTagIds.length > 0) {
        whereClause.tags = {
            [Op.overlap]: includeTagIds // 包含任一指定标签
        };
        } else {
          return 0; // 没有找到匹配的标签，返回0
        }
      }

      if (excludeTagNames.length > 0) {
        const excludeTags = await Tag.findAll({
          where: { name: { [Op.in]: excludeTagNames }, user_id: userId },
          attributes: ['id']
        });
          const excludeTagIds = excludeTags.map(t => t.id);
          
        if (excludeTagIds.length > 0) {
          whereClause.tags = {
            ...whereClause.tags,
                [Op.not]: {
              [Op.overlap]: excludeTagIds // 不包含任一排除标签
              }
            };
        }
      }

      const count = await Contact.count({ where: whereClause });
      return count;
    } catch (error) {
      logger.error('Error in ContactService.countContactsByTagNames:', { error: error.message, stack: error.stack, includeTagNames, excludeTagNames, userId });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to count contacts by tag names.', 500, error.message);
    }
  }
}

module.exports = new ContactService(); 