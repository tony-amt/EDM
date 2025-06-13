/**
 * 联系人和标签管理辅助函数
 * 用于同步contacts.tags和tags.contacts字段
 */

const { Contact, Tag, sequelize } = require('../models');
const logger = require('./logger');

class ContactTagManager {
  /**
   * 为联系人设置标签
   * @param {string} contactId - 联系人ID
   * @param {string[]} tagIds - 标签ID数组
   * @param {object} transaction - 数据库事务（可选）
   */
  static async setContactTags(contactId, tagIds = [], transaction = null) {
    try {
      const t = transaction || await sequelize.transaction();
      
      try {
        // 1. 获取联系人当前的标签
        const contact = await Contact.findByPk(contactId, { transaction: t });
        if (!contact) {
          throw new Error(`联系人 ${contactId} 不存在`);
        }
        
        const oldTagIds = contact.tags || [];
        const newTagIds = [...new Set(tagIds)]; // 去重
        
        // 2. 更新联系人的tags字段
        await Contact.update(
          { tags: newTagIds },
          { where: { id: contactId }, transaction: t }
        );
        
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
   * 删除联系人时清理相关标签
   * @param {string} contactId - 联系人ID
   * @param {object} transaction - 数据库事务（可选）
   */
  static async cleanupContactFromTags(contactId, transaction = null) {
    try {
      const t = transaction || await sequelize.transaction();
      
      try {
        // 获取联系人的标签
        const contact = await Contact.findByPk(contactId, { transaction: t });
        if (!contact || !contact.tags) {
          if (!transaction) await t.commit();
          return;
        }
        
        // 从所有相关标签中移除该联系人
        await this.removeContactFromTags(contactId, contact.tags, t);
        
        if (!transaction) {
          await t.commit();
        }
        
        logger.info(`联系人 ${contactId} 从相关标签中清理完成`);
        
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
   * 删除标签时清理相关联系人
   * @param {string} tagId - 标签ID
   * @param {object} transaction - 数据库事务（可选）
   */
  static async cleanupTagFromContacts(tagId, transaction = null) {
    try {
      const t = transaction || await sequelize.transaction();
      
      try {
        // 获取标签的联系人
        const tag = await Tag.findByPk(tagId, { transaction: t });
        if (!tag || !tag.contacts) {
          if (!transaction) await t.commit();
          return;
        }
        
        // 从所有相关联系人中移除该标签
        for (const contactId of tag.contacts) {
          await sequelize.query(`
            UPDATE contacts 
            SET tags = tags - :tagId
            WHERE id = :contactId
          `, {
            replacements: { 
              tagId: tagId,
              contactId 
            },
            transaction: t
          });
        }
        
        if (!transaction) {
          await t.commit();
        }
        
        logger.info(`标签 ${tagId} 从相关联系人中清理完成`);
        
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
   * 获取联系人的标签详情
   * @param {string} contactId - 联系人ID
   * @returns {Promise<Array>} 标签详情数组
   */
  static async getContactTagDetails(contactId) {
    try {
      const contact = await Contact.findByPk(contactId);
      if (!contact || !contact.tags || contact.tags.length === 0) {
        return [];
      }
      
      const tags = await Tag.findAll({
        where: {
          id: contact.tags
        },
        attributes: ['id', 'name', 'description']
      });
      
      return tags;
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