/**
 * 任务联系人选择服务
 * 处理基于标签的联系人选择、去重和统计
 */

const { Contact, Tag, sequelize } = require('../../models/index');
const { Op } = require('sequelize');
const logger = require('../../utils/logger');

class TaskContactSelectionService {
  /**
   * 基于标签选择联系人（支持包含和排除标签）
   * @param {Object} selectionCriteria - 选择条件
   * @param {string[]} selectionCriteria.includeTagIds - 包含的标签ID数组
   * @param {string[]} selectionCriteria.excludeTagIds - 排除的标签ID数组
   * @param {string[]} selectionCriteria.includeTagNames - 包含的标签名称数组
   * @param {string[]} selectionCriteria.excludeTagNames - 排除的标签名称数组
   * @param {string} userId - 用户ID
   * @returns {Promise<{contacts: Array, count: number}>} 选中的联系人和数量
   */
  async selectContactsByTags(selectionCriteria, userId) {
    try {
      const {
        includeTagIds = [],
        excludeTagIds = [],
        includeTagNames = [],
        excludeTagNames = []
      } = selectionCriteria;

      logger.info('开始基于标签选择联系人:', {
        includeTagIds,
        excludeTagIds,
        includeTagNames,
        excludeTagNames,
        userId
      });

      // 1. 将标签名称转换为ID
      let finalIncludeTagIds = [...includeTagIds];
      let finalExcludeTagIds = [...excludeTagIds];

      if (includeTagNames.length > 0) {
        const includeTags = await Tag.findAll({
          where: {
            name: { [Op.in]: includeTagNames },
            user_id: userId
          },
          attributes: ['id']
        });
        finalIncludeTagIds.push(...includeTags.map(t => t.id));
      }

      if (excludeTagNames.length > 0) {
        const excludeTags = await Tag.findAll({
          where: {
            name: { [Op.in]: excludeTagNames },
            user_id: userId
          },
          attributes: ['id']
        });
        finalExcludeTagIds.push(...excludeTags.map(t => t.id));
      }

      // 去重
      finalIncludeTagIds = [...new Set(finalIncludeTagIds)];
      finalExcludeTagIds = [...new Set(finalExcludeTagIds)];

      logger.info('标签ID转换完成:', {
        finalIncludeTagIds,
        finalExcludeTagIds
      });

      // 2. 构建查询条件
      const whereClause = { user_id: userId };

      // 包含标签条件
      if (finalIncludeTagIds.length > 0) {
        whereClause.tags = {
          [Op.or]: finalIncludeTagIds.map(tagId => ({ [Op.contains]: [tagId] }))
        };
      }

      // 排除标签条件
      if (finalExcludeTagIds.length > 0) {
        if (whereClause.tags) {
          // 既有包含又有排除
          whereClause[Op.and] = [
            { tags: whereClause.tags },
            {
              [Op.not]: {
                tags: {
                  [Op.or]: finalExcludeTagIds.map(tagId => ({ [Op.contains]: [tagId] }))
                }
              }
            }
          ];
          delete whereClause.tags;
        } else {
          // 只有排除
          whereClause[Op.not] = {
            tags: {
              [Op.or]: finalExcludeTagIds.map(tagId => ({ [Op.contains]: [tagId] }))
            }
          };
        }
      }

      // 3. 查询联系人
      const contacts = await Contact.findAll({
        where: whereClause,
        attributes: ['id', 'email', 'name', 'company', 'tags'],
        order: [['created_at', 'DESC']]
      });

      logger.info(`基于标签选择联系人完成: ${contacts.length} 个联系人`);

      return {
        contacts,
        count: contacts.length,
        criteria: {
          includeTagIds: finalIncludeTagIds,
          excludeTagIds: finalExcludeTagIds
        }
      };

    } catch (error) {
      logger.error('基于标签选择联系人失败:', error);
      throw error;
    }
  }

  /**
   * 计算基于标签的联系人数量（不返回具体联系人，仅统计）
   * @param {Object} selectionCriteria - 选择条件
   * @param {string} userId - 用户ID
   * @returns {Promise<number>} 联系人数量
   */
  async countContactsByTags(selectionCriteria, userId) {
    try {
      const {
        includeTagIds = [],
        excludeTagIds = [],
        includeTagNames = [],
        excludeTagNames = []
      } = selectionCriteria;

      // 1. 将标签名称转换为ID
      let finalIncludeTagIds = [...includeTagIds];
      let finalExcludeTagIds = [...excludeTagIds];

      if (includeTagNames.length > 0) {
        const includeTags = await Tag.findAll({
          where: {
            name: { [Op.in]: includeTagNames },
            user_id: userId
          },
          attributes: ['id']
        });
        finalIncludeTagIds.push(...includeTags.map(t => t.id));
      }

      if (excludeTagNames.length > 0) {
        const excludeTags = await Tag.findAll({
          where: {
            name: { [Op.in]: excludeTagNames },
            user_id: userId
          },
          attributes: ['id']
        });
        finalExcludeTagIds.push(...excludeTags.map(t => t.id));
      }

      // 去重
      finalIncludeTagIds = [...new Set(finalIncludeTagIds)];
      finalExcludeTagIds = [...new Set(finalExcludeTagIds)];

      // 2. 构建查询条件
      const whereClause = { user_id: userId };

      // 包含标签条件
      if (finalIncludeTagIds.length > 0) {
        whereClause.tags = {
          [Op.or]: finalIncludeTagIds.map(tagId => ({ [Op.contains]: [tagId] }))
        };
      }

      // 排除标签条件
      if (finalExcludeTagIds.length > 0) {
        if (whereClause.tags) {
          // 既有包含又有排除
          whereClause[Op.and] = [
            { tags: whereClause.tags },
            {
              [Op.not]: {
                tags: {
                  [Op.or]: finalExcludeTagIds.map(tagId => ({ [Op.contains]: [tagId] }))
                }
              }
            }
          ];
          delete whereClause.tags;
        } else {
          // 只有排除
          whereClause[Op.not] = {
            tags: {
              [Op.or]: finalExcludeTagIds.map(tagId => ({ [Op.contains]: [tagId] }))
            }
          };
        }
      }

      // 3. 统计联系人数量
      const count = await Contact.count({
        where: whereClause
      });

      logger.info('基于标签统计联系人数量:', {
        includeTagIds: finalIncludeTagIds,
        excludeTagIds: finalExcludeTagIds,
        count
      });

      return count;

    } catch (error) {
      logger.error('基于标签统计联系人数量失败:', error);
      throw error;
    }
  }

  /**
   * 合并多个标签的联系人（去重）
   * @param {string[]} tagIds - 标签ID数组
   * @param {string} userId - 用户ID
   * @returns {Promise<{contacts: Array, count: number}>} 去重后的联系人和数量
   */
  async mergeContactsFromTags(tagIds, userId) {
    try {
      if (!tagIds || tagIds.length === 0) {
        return { contacts: [], count: 0 };
      }

      logger.info('开始合并多个标签的联系人:', { tagIds, userId });

      // 使用JSONB数组重叠查询，自动去重
      const contacts = await Contact.findAll({
        where: {
          user_id: userId,
          tags: {
            [Op.or]: tagIds.map(tagId => ({ [Op.contains]: [tagId] }))
          }
        },
        attributes: ['id', 'email', 'name', 'company', 'tags'],
        order: [['created_at', 'DESC']]
      });

      logger.info(`合并标签联系人完成: ${contacts.length} 个去重联系人`);

      return {
        contacts,
        count: contacts.length
      };

    } catch (error) {
      logger.error('合并标签联系人失败:', error);
      throw error;
    }
  }

  /**
   * 获取标签的联系人详情（基于tags.contacts字段）
   * @param {string} tagId - 标签ID
   * @param {string} userId - 用户ID
   * @returns {Promise<{contacts: Array, count: number}>} 联系人详情和数量
   */
  async getTagContactDetails(tagId, userId) {
    try {
      const tag = await Tag.findOne({
        where: { id: tagId, user_id: userId }
      });

      if (!tag || !tag.contacts || tag.contacts.length === 0) {
        return { contacts: [], count: 0 };
      }

      const contacts = await Contact.findAll({
        where: {
          id: { [Op.in]: tag.contacts },
          user_id: userId
        },
        attributes: ['id', 'email', 'name', 'company', 'status'],
        order: [['created_at', 'DESC']]
      });

      return {
        contacts,
        count: contacts.length
      };

    } catch (error) {
      logger.error('获取标签联系人详情失败:', error);
      throw error;
    }
  }

  /**
   * 预览任务发送人数（基于选择条件）
   * @param {Object} taskConfig - 任务配置
   * @param {string} userId - 用户ID
   * @returns {Promise<{estimatedCount: number, breakdown: Object}>} 预估发送人数和详细分解
   */
  async previewTaskRecipients(taskConfig, userId) {
    try {
      const { recipient_rule, contacts: directContacts } = taskConfig;

      // 如果直接指定了联系人
      if (directContacts && directContacts.length > 0) {
        const validContacts = await Contact.findAll({
          where: {
            id: { [Op.in]: directContacts },
            user_id: userId
          },
          attributes: ['id']
        });

        return {
          estimatedCount: validContacts.length,
          breakdown: {
            type: 'direct',
            directContacts: validContacts.length
          }
        };
      }

      // 基于recipient_rule
      if (!recipient_rule) {
        return { estimatedCount: 0, breakdown: { type: 'none' } };
      }

      const { type, contact_ids, include_tags, exclude_tags } = recipient_rule;

      switch (type) {
        case 'specific':
          const specificCount = await Contact.count({
            where: {
              id: { [Op.in]: contact_ids || [] },
              user_id: userId
            }
          });
          return {
            estimatedCount: specificCount,
            breakdown: {
              type: 'specific',
              specificContacts: specificCount
            }
          };

        case 'tag_based':
          const tagBasedCount = await this.countContactsByTags({
            includeTagIds: include_tags,
            excludeTagIds: exclude_tags
          }, userId);
          return {
            estimatedCount: tagBasedCount,
            breakdown: {
              type: 'tag_based',
              includeTagIds: include_tags,
              excludeTagIds: exclude_tags,
              resultCount: tagBasedCount
            }
          };

        case 'all_contacts':
          const allCount = await Contact.count({
            where: { user_id: userId }
          });
          return {
            estimatedCount: allCount,
            breakdown: {
              type: 'all_contacts',
              totalContacts: allCount
            }
          };

        default:
          return { estimatedCount: 0, breakdown: { type: 'unknown' } };
      }

    } catch (error) {
      logger.error('预览任务发送人数失败:', error);
      throw error;
    }
  }
}

module.exports = new TaskContactSelectionService(); 