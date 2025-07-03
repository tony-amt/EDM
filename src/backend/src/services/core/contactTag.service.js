const { Tag, Contact, sequelize } = require('../../models/index');
const { Op } = require('sequelize');
const logger = require('../../utils/logger');

/**
 * ContactTagService - 联系人标签反向查询服务
 * Phase 3: JSONB优化完成版 - 完全使用反向查询
 */
class ContactTagService {
  /**
   * 🚀 Phase 3完成: 批量查询联系人标签（纯反向查询）
   * @param {Array} contactIds - 联系人ID数组
   * @param {boolean} includeChildTags - 是否包含子标签
   * @param {string} userId - 用户ID
   * @returns {Map} 联系人ID -> 标签数组的映射
   */
  static async getContactsWithTagsBatch(contactIds, includeChildTags = true, userId = null) {
    try {
      if (!contactIds || contactIds.length === 0) {
        return new Map();
      }

      logger.info('批量获取联系人标签:', {
        contactCount: contactIds.length,
        includeChildTags,
        userId
      });

      const contactTagMap = new Map();
      contactIds.forEach(id => contactTagMap.set(id, []));

      // 🚀 Phase 3优化：使用tag.contacts进行反向查询
      const whereClause = {
        contacts: sequelize.literal(`"Tag"."contacts" ?| array[${contactIds.map(id => `'${id}'`).join(',')}]`)
      };

      if (userId) {
        whereClause.user_id = userId;
      }

      const tags = await Tag.findAll({
        where: whereClause,
        attributes: ['id', 'name', 'description', 'parent_id', 'contacts'],
        include: includeChildTags ? [
          { model: Tag, as: 'parent', attributes: ['id', 'name'], required: false }
        ] : []
      });

      // 构建联系人-标签映射
      tags.forEach(tag => {
        const tagContacts = tag.contacts || [];
        tagContacts.forEach(contactId => {
          if (contactTagMap.has(contactId)) {
            contactTagMap.get(contactId).push({
              id: tag.id,
              name: tag.name,
              description: tag.description,
              parent_id: tag.parent_id,
              parent: tag.parent
            });
          }
        });
      });

      logger.info(`批量查询完成: ${tags.length}个标签, ${contactTagMap.size}个联系人`);

      return contactTagMap;

    } catch (error) {
      logger.error('批量获取联系人标签失败:', error);
      throw error;
    }
  }

  /**
   * 🚀 Phase 3完成: 根据标签获取联系人ID（纯反向查询）
   * @param {Array} tagIds - 标签ID数组
   * @param {string} userId - 用户ID
   * @param {Object} pagination - 分页参数
   * @returns {Object} 联系人ID数组和分页信息
   */
  static async getContactIdsByTags(tagIds, userId, pagination = {}) {
    try {
      if (!tagIds || tagIds.length === 0) {
        return { contactIds: [], total: 0, page: 1, limit: 50 };
      }

      const { page = 1, limit = 50 } = pagination;

      logger.info('根据标签获取联系人:', {
        tagIds,
        userId,
        page,
        limit
      });

      // 🚀 Phase 3优化：使用tag.contacts反向查询
      const whereClause = {
        id: { [Op.in]: tagIds },
        contacts: { [Op.ne]: null }
      };

      if (userId) {
        whereClause.user_id = userId;
      }

      const tags = await Tag.findAll({
        where: whereClause,
        attributes: ['contacts']
      });

      // 合并所有标签的联系人ID
      const allContactIds = new Set();
      tags.forEach(tag => {
        if (tag.contacts && Array.isArray(tag.contacts)) {
          tag.contacts.forEach(contactId => allContactIds.add(contactId));
        }
      });

      const contactIdsArray = Array.from(allContactIds);
      const total = contactIdsArray.length;

      // 应用分页
      const offset = (page - 1) * limit;
      const paginatedContactIds = contactIdsArray.slice(offset, offset + limit);

      logger.info(`标签查询完成: ${total}个联系人, 返回${paginatedContactIds.length}个`);

      return {
        contactIds: paginatedContactIds,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      };

    } catch (error) {
      logger.error('根据标签获取联系人失败:', error);
      throw error;
    }
  }

  /**
   * 🚀 Phase 3完成: 获取单个标签的联系人（纯反向查询）
   * @param {string} tagId - 标签ID
   * @param {string} userId - 用户ID
   * @returns {Array} 联系人数组
   */
  static async getContactsByTag(tagId, userId) {
    try {
      logger.info('获取标签联系人:', { tagId, userId });

      const whereClause = { id: tagId };
      if (userId) {
        whereClause.user_id = userId;
      }

      const tag = await Tag.findOne({
        where: whereClause,
        attributes: ['contacts']
      });

      if (!tag || !tag.contacts || tag.contacts.length === 0) {
        return [];
      }

      // 根据联系人ID获取联系人详情
      const contactWhereClause = {
        id: { [Op.in]: tag.contacts }
      };

      if (userId) {
        contactWhereClause.user_id = userId;
      }

      const contacts = await Contact.findAll({
        where: contactWhereClause,
        order: [['created_at', 'DESC']]
      });

      logger.info(`获取标签联系人完成: ${contacts.length}个联系人`);

      return contacts;

    } catch (error) {
      logger.error('获取标签联系人失败:', error);
      throw error;
    }
  }

  /**
   * 🚀 Phase 3完成: 为联系人添加标签（纯反向查询）
   * @param {string} contactId - 联系人ID
   * @param {string} tagId - 标签ID
   * @param {string} userId - 用户ID
   * @param {Object} transaction - 数据库事务
   */
  static async addContactToTag(contactId, tagId, userId, transaction = null) {
    try {
      const t = transaction || await sequelize.transaction();

      try {
        logger.info('添加联系人到标签:', { contactId, tagId, userId });

        // 验证联系人和标签存在
        const [contact, tag] = await Promise.all([
          Contact.findOne({
            where: { id: contactId, user_id: userId },
            transaction: t
          }),
          Tag.findOne({
            where: { id: tagId, user_id: userId },
            transaction: t
          })
        ]);

        if (!contact || !tag) {
          throw new Error('联系人或标签不存在');
        }

        // 检查是否已经关联
        const currentContacts = tag.contacts || [];
        if (currentContacts.includes(contactId)) {
          logger.info('联系人已在标签中，跳过添加');
          return;
        }

        // 添加联系人到标签
        const updatedContacts = [...currentContacts, contactId];
        await tag.update({ contacts: updatedContacts }, { transaction: t });

        if (!transaction) {
          await t.commit();
        }

        logger.info('添加联系人到标签成功');

      } catch (error) {
        if (!transaction) {
          await t.rollback();
        }
        throw error;
      }

    } catch (error) {
      logger.error('添加联系人到标签失败:', error);
      throw error;
    }
  }

  /**
   * 🚀 Phase 3完成: 从标签移除联系人（纯反向查询）
   * @param {string} contactId - 联系人ID
   * @param {string} tagId - 标签ID
   * @param {string} userId - 用户ID
   * @param {Object} transaction - 数据库事务
   */
  static async removeContactFromTag(contactId, tagId, userId, transaction = null) {
    try {
      const t = transaction || await sequelize.transaction();

      try {
        logger.info('从标签移除联系人:', { contactId, tagId, userId });

        const tag = await Tag.findOne({
          where: { id: tagId, user_id: userId },
          transaction: t
        });

        if (!tag) {
          throw new Error('标签不存在');
        }

        // 从标签中移除联系人
        const currentContacts = tag.contacts || [];
        const updatedContacts = currentContacts.filter(id => id !== contactId);
        
        await tag.update({ contacts: updatedContacts }, { transaction: t });

        if (!transaction) {
          await t.commit();
        }

        logger.info('从标签移除联系人成功');

      } catch (error) {
        if (!transaction) {
          await t.rollback();
        }
        throw error;
      }

    } catch (error) {
      logger.error('从标签移除联系人失败:', error);
      throw error;
    }
  }

  /**
   * 🚀 Phase 3完成: 获取联系人的所有标签（纯反向查询）
   * @param {string} contactId - 联系人ID
   * @param {string} userId - 用户ID
   * @returns {Array} 标签数组
   */
  static async getContactTags(contactId, userId) {
    try {
      logger.info('获取联系人标签:', { contactId, userId });

      const whereClause = {
        contacts: sequelize.literal(`contacts @> '[${JSON.stringify(contactId)}]'::jsonb`)
      };

      if (userId) {
        whereClause.user_id = userId;
      }

      const tags = await Tag.findAll({
        where: whereClause,
        attributes: ['id', 'name', 'description', 'parent_id'],
        include: [
          { model: Tag, as: 'parent', attributes: ['id', 'name'], required: false }
        ],
        order: [['name', 'ASC']]
      });

      logger.info(`获取联系人标签完成: ${tags.length}个标签`);

      return tags;

    } catch (error) {
      logger.error('获取联系人标签失败:', error);
      throw error;
    }
  }

  /**
   * 🚀 Phase 3完成: 验证数据完整性（纯反向查询）
   * @param {string} userId - 用户ID
   * @returns {Object} 验证结果
   */
  static async validateDataConsistency(userId = null) {
    try {
      logger.info('验证数据完整性:', { userId });

      const whereClause = userId ? { user_id: userId } : {};

      // 获取所有标签及其联系人
      const tags = await Tag.findAll({
        where: {
          ...whereClause,
          contacts: { [Op.ne]: null }
        },
        attributes: ['id', 'name', 'contacts']
      });

      // 获取所有联系人
      const contacts = await Contact.findAll({
        where: whereClause,
        attributes: ['id', 'email']
      });

      const contactIds = new Set(contacts.map(c => c.id));
      const inconsistencies = [];

      // 检查标签中的联系人是否存在
      tags.forEach(tag => {
        if (tag.contacts && Array.isArray(tag.contacts)) {
          tag.contacts.forEach(contactId => {
            if (!contactIds.has(contactId)) {
              inconsistencies.push({
                type: 'orphaned_contact_reference',
                tagId: tag.id,
                tagName: tag.name,
                contactId,
                description: `标签"${tag.name}"中引用了不存在的联系人${contactId}`
              });
            }
          });
        }
      });

      logger.info('数据完整性验证完成:', {
        tagsChecked: tags.length,
        contactsChecked: contacts.length,
        inconsistenciesFound: inconsistencies.length
      });

      return {
        isConsistent: inconsistencies.length === 0,
        tagsChecked: tags.length,
        contactsChecked: contacts.length,
        inconsistencies
      };

    } catch (error) {
      logger.error('数据完整性验证失败:', error);
      throw error;
    }
  }

  /**
   * 🚀 Phase 3完成: 系统状态检查（纯反向查询）
   * @param {string} userId - 用户ID
   * @returns {Object} 系统状态
   */
  static async getSystemStatus(userId = null) {
    try {
      logger.info('获取系统状态:', { userId });

      const whereClause = userId ? { user_id: userId } : {};

      const [tagStats, contactStats] = await Promise.all([
        Tag.findAll({
          where: whereClause,
          attributes: [
            [sequelize.fn('COUNT', sequelize.col('id')), 'totalTags'],
            [sequelize.fn('COUNT', sequelize.literal('CASE WHEN contacts IS NOT NULL THEN 1 END')), 'tagsWithContacts'],
            [sequelize.fn('COUNT', sequelize.literal('CASE WHEN parent_id IS NOT NULL THEN 1 END')), 'childTags']
          ],
          raw: true
        }),
        Contact.findAll({
          where: whereClause,
          attributes: [
            [sequelize.fn('COUNT', sequelize.col('id')), 'totalContacts']
          ],
          raw: true
        })
      ]);

      const status = {
        totalTags: parseInt(tagStats[0].totalTags) || 0,
        tagsWithContacts: parseInt(tagStats[0].tagsWithContacts) || 0,
        childTags: parseInt(tagStats[0].childTags) || 0,
        totalContacts: parseInt(contactStats[0].totalContacts) || 0,
        phase3Status: 'completed',
        queryMethod: 'reverse_query_only'
      };

      logger.info('系统状态获取完成:', status);

      return status;

    } catch (error) {
      logger.error('获取系统状态失败:', error);
      throw error;
    }
  }
}

module.exports = ContactTagService; 