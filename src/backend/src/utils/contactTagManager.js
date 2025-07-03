/**
 * 联系人和标签管理辅助函数
 * 用于同步contacts.tags和tags.contacts字段
 */

const { Contact, Tag, sequelize } = require('../models/index');
const logger = require('./logger');

/**
 * 🚀 Phase 3: 联系人标签管理器（重构版）
 * 只使用tag.contacts字段，不再使用contact.tags（已移除）
 */
class ContactTagManager {

  /**
   * 🚀 Phase 3修复: 设置联系人标签（只更新tag.contacts）
   * @param {string} contactId - 联系人ID
   * @param {string[]} tagIds - 标签ID数组
   * @param {object} transaction - 数据库事务（可选）
   */
  static async setContactTags(contactId, tagIds = [], transaction = null) {
    try {
      const t = transaction || await sequelize.transaction();

      try {
        // 1. 验证联系人存在
        const contact = await Contact.findByPk(contactId, { transaction: t });
        if (!contact) {
          throw new Error(`联系人 ${contactId} 不存在`);
        }

        const newTagIds = [...new Set(tagIds)]; // 去重

        // 2. 获取当前联系人关联的标签（通过反向查询）
        const currentTags = await Tag.findAll({
          where: {
            user_id: contact.user_id,
            contacts: sequelize.literal(`contacts @> '[${JSON.stringify(contactId)}]'::jsonb`)
          },
          attributes: ['id'],
          transaction: t
        });

        const oldTagIds = currentTags.map(tag => tag.id);

        // 3. 计算需要添加和移除的标签
        const tagsToAdd = newTagIds.filter(id => !oldTagIds.includes(id));
        const tagsToRemove = oldTagIds.filter(id => !newTagIds.includes(id));

        // 4. 更新相关标签的contacts字段
        if (tagsToAdd.length > 0) {
          await this.addContactToTags(contactId, tagsToAdd, t);
        }

        if (tagsToRemove.length > 0) {
          await this.removeContactFromTags(contactId, tagsToRemove, t);
        }

        // 如果没有传入事务，则提交
        if (!transaction) {
          await t.commit();
        }

        logger.info(`联系人 ${contactId} 标签更新成功: ${newTagIds.join(', ')}`);

      } catch (error) {
        if (!transaction) {
          await t.rollback();
        }
        throw error;
      }

    } catch (error) {
      logger.error('设置联系人标签失败:', error);
      throw error;
    }
  }

  /**
   * 将联系人添加到标签的contacts字段中
   * @param {string} contactId - 联系人ID
   * @param {string[]} tagIds - 标签ID数组
   * @param {object} transaction - 数据库事务
   */
  static async addContactToTags(contactId, tagIds, transaction) {
    for (const tagId of tagIds) {
      await sequelize.query(`
        UPDATE tags 
        SET contacts = COALESCE(contacts, '[]'::jsonb) || :contactId::jsonb
        WHERE id = :tagId 
        AND NOT (contacts @> :contactId::jsonb)
      `, {
        replacements: {
          contactId: JSON.stringify([contactId]),
          tagId
        },
        transaction
      });
    }
  }

  /**
   * 从标签的contacts字段中移除联系人
   * @param {string} contactId - 联系人ID
   * @param {string[]} tagIds - 标签ID数组
   * @param {object} transaction - 数据库事务
   */
  static async removeContactFromTags(contactId, tagIds, transaction) {
    for (const tagId of tagIds) {
      await sequelize.query(`
        UPDATE tags 
        SET contacts = contacts - :contactId
        WHERE id = :tagId
      `, {
        replacements: {
          contactId: contactId,
          tagId
        },
        transaction
      });
    }
  }

  /**
   * 🚀 Phase 3修复: 删除联系人时清理相关标签（只更新tag.contacts）
   * @param {string} contactId - 联系人ID
   * @param {object} transaction - 数据库事务（可选）
   */
  static async cleanupContactFromTags(contactId, transaction = null) {
    try {
      const t = transaction || await sequelize.transaction();

      try {
        // 获取包含该联系人的所有标签（通过反向查询）
        const relatedTags = await Tag.findAll({
          where: {
            contacts: sequelize.literal(`contacts @> '[${JSON.stringify(contactId)}]'::jsonb`)
          },
          attributes: ['id'],
          transaction: t
        });

        if (relatedTags.length === 0) {
          if (!transaction) await t.commit();
          return;
        }

        const tagIds = relatedTags.map(tag => tag.id);

        // 从所有相关标签中移除该联系人
        await this.removeContactFromTags(contactId, tagIds, t);

        if (!transaction) {
          await t.commit();
        }

        logger.info(`联系人 ${contactId} 从 ${tagIds.length} 个标签中清理完成`);

      } catch (error) {
        if (!transaction) {
          await t.rollback();
        }
        throw error;
      }

    } catch (error) {
      logger.error('清理联系人标签关联失败:', error);
      throw error;
    }
  }

  /**
   * 🚀 Phase 3修复: 删除标签时清理相关联系人（不再需要更新contact.tags）
   * @param {string} tagId - 标签ID
   * @param {object} transaction - 数据库事务（可选）
   */
  static async cleanupTagFromContacts(tagId, transaction = null) {
    try {
      const t = transaction || await sequelize.transaction();

      try {
        // 获取标签的联系人
        const tag = await Tag.findByPk(tagId, { transaction: t });
        if (!tag || !tag.contacts || tag.contacts.length === 0) {
          if (!transaction) await t.commit();
          return;
        }

        // 🚀 Phase 3修复: 不再需要更新contact.tags字段（已移除）
        // 标签删除时，只需删除标签本身，不需要更新联系人记录

        if (!transaction) {
          await t.commit();
        }

        logger.info(`标签 ${tagId} 清理完成（${tag.contacts.length} 个关联联系人）`);

      } catch (error) {
        if (!transaction) {
          await t.rollback();
        }
        throw error;
      }

    } catch (error) {
      logger.error('清理标签联系人关联失败:', error);
      throw error;
    }
  }

  /**
   * 🚀 Phase 3修复: 获取联系人的标签详情（使用反向查询）
   * @param {string} contactId - 联系人ID
   * @returns {Promise<Array>} 标签详情数组
   */
  static async getContactTagDetails(contactId) {
    try {
      const contact = await Contact.findByPk(contactId);
      if (!contact) {
        return [];
      }

      // 使用反向查询获取联系人的标签
      const tags = await Tag.findAll({
        where: {
          user_id: contact.user_id,
          contacts: sequelize.literal(`contacts @> '[${JSON.stringify(contactId)}]'::jsonb`)
        },
        attributes: ['id', 'name', 'description', 'parent_id', 'contacts'],
        include: [
          { model: Tag, as: 'parent', attributes: ['id', 'name'], required: false }
        ]
      });

      return tags.map(tag => ({
        id: tag.id,
        name: tag.name,
        description: tag.description,
        parent_id: tag.parent_id,
        parent: tag.parent,
        contactCount: (tag.contacts || []).length
      }));

    } catch (error) {
      logger.error('获取联系人标签详情失败:', error);
      throw error;
    }
  }

  /**
   * 获取标签的联系人详情
   * @param {string} tagId - 标签ID
   * @returns {Promise<Array>} 联系人详情数组
   */
  static async getTagContactDetails(tagId) {
    try {
      const tag = await Tag.findByPk(tagId);
      if (!tag || !tag.contacts || tag.contacts.length === 0) {
        return [];
      }

      const contacts = await Contact.findAll({
        where: {
          id: tag.contacts
        },
        attributes: ['id', 'name', 'email', 'company']
      });

      return contacts;
    } catch (error) {
      logger.error('获取标签联系人详情失败:', error);
      throw error;
    }
  }
}

module.exports = ContactTagManager; 