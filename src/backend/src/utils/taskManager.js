/**
 * 任务管理辅助函数
 * 用于管理tasks.contacts和tasks.templates字段
 */

const { Task, Contact, Template, SubTask, sequelize } = require('../models');
const logger = require('./logger');

class TaskManager {
  /**
   * 设置任务的联系人
   * @param {string} taskId - 任务ID
   * @param {string[]} contactIds - 联系人ID数组
   * @param {object} transaction - 数据库事务（可选）
   */
  static async setTaskContacts(taskId, contactIds = [], transaction = null) {
    try {
      const t = transaction || await sequelize.transaction();
      
      try {
        // 验证任务是否存在
        const task = await Task.findByPk(taskId, { transaction: t });
        if (!task) {
          throw new Error(`任务 ${taskId} 不存在`);
        }
        
        // 验证联系人是否存在
        if (contactIds.length > 0) {
          const existingContacts = await Contact.findAll({
            where: { id: contactIds },
            attributes: ['id'],
            transaction: t
          });
          
          const existingContactIds = existingContacts.map(c => c.id);
          const invalidContactIds = contactIds.filter(id => !existingContactIds.includes(id));
          
          if (invalidContactIds.length > 0) {
            throw new Error(`以下联系人不存在: ${invalidContactIds.join(', ')}`);
          }
        }
        
        // 去重并更新任务的contacts字段
        const uniqueContactIds = [...new Set(contactIds)];
        await Task.update(
          { contacts: uniqueContactIds },
          { where: { id: taskId }, transaction: t }
        );
        
        if (!transaction) {
          await t.commit();
        }
        
        logger.info(`任务 ${taskId} 联系人更新成功: ${uniqueContactIds.length} 个联系人`);
        
      } catch (error) {
        if (!transaction) {
          await t.rollback();
        }
        throw error;
      }
      
    } catch (error) {
      logger.error('设置任务联系人失败:', error);
      throw error;
    }
  }
  
  /**
   * 设置任务的模板
   * @param {string} taskId - 任务ID
   * @param {string[]} templateIds - 模板ID数组
   * @param {object} transaction - 数据库事务（可选）
   */
  static async setTaskTemplates(taskId, templateIds = [], transaction = null) {
    try {
      const t = transaction || await sequelize.transaction();
      
      try {
        // 验证任务是否存在
        const task = await Task.findByPk(taskId, { transaction: t });
        if (!task) {
          throw new Error(`任务 ${taskId} 不存在`);
        }
        
        // 验证模板是否存在
        if (templateIds.length > 0) {
          const existingTemplates = await Template.findAll({
            where: { id: templateIds },
            attributes: ['id'],
            transaction: t
          });
          
          const existingTemplateIds = existingTemplates.map(t => t.id);
          const invalidTemplateIds = templateIds.filter(id => !existingTemplateIds.includes(id));
          
          if (invalidTemplateIds.length > 0) {
            throw new Error(`以下模板不存在: ${invalidTemplateIds.join(', ')}`);
          }
        }
        
        // 去重并更新任务的templates字段
        const uniqueTemplateIds = [...new Set(templateIds)];
        await Task.update(
          { templates: uniqueTemplateIds },
          { where: { id: taskId }, transaction: t }
        );
        
        if (!transaction) {
          await t.commit();
        }
        
        logger.info(`任务 ${taskId} 模板更新成功: ${uniqueTemplateIds.length} 个模板`);
        
      } catch (error) {
        if (!transaction) {
          await t.rollback();
        }
        throw error;
      }
      
    } catch (error) {
      logger.error('设置任务模板失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取任务的联系人详情
   * @param {string} taskId - 任务ID
   * @returns {Promise<Array>} 联系人详情数组
   */
  static async getTaskContactDetails(taskId) {
    try {
      const task = await Task.findByPk(taskId);
      if (!task || !task.contacts || task.contacts.length === 0) {
        return [];
      }
      
      const contacts = await Contact.findAll({
        where: {
          id: task.contacts
        },
        attributes: ['id', 'name', 'email', 'company', 'status']
      });
      
      return contacts;
    } catch (error) {
      logger.error('获取任务联系人详情失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取任务的模板详情
   * @param {string} taskId - 任务ID
   * @returns {Promise<Array>} 模板详情数组
   */
  static async getTaskTemplateDetails(taskId) {
    try {
      const task = await Task.findByPk(taskId);
      if (!task || !task.templates || task.templates.length === 0) {
        return [];
      }
      
      const templates = await Template.findAll({
        where: {
          id: task.templates
        },
        attributes: ['id', 'name', 'subject', 'description']
      });
      
      return templates;
    } catch (error) {
      logger.error('获取任务模板详情失败:', error);
      throw error;
    }
  }
  
  /**
   * 根据任务配置生成SubTask
   * @param {string} taskId - 任务ID
   * @param {object} transaction - 数据库事务（可选）
   */
  static async generateSubTasks(taskId, transaction = null) {
    try {
      const t = transaction || await sequelize.transaction();
      
      try {
        // 获取任务详情
        const task = await Task.findByPk(taskId, { transaction: t });
        if (!task) {
          throw new Error(`任务 ${taskId} 不存在`);
        }
        
        const { contacts, templates } = task;
        
        if (!contacts || contacts.length === 0) {
          throw new Error('任务没有配置联系人');
        }
        
        if (!templates || templates.length === 0) {
          throw new Error('任务没有配置模板');
        }
        
        // 删除现有的SubTask（如果有）
        await SubTask.destroy({
          where: { task_id: taskId },
          transaction: t
        });
        
        // 为每个联系人和模板组合创建SubTask
        const subTasksToCreate = [];
        
        for (const contactId of contacts) {
          for (const templateId of templates) {
            subTasksToCreate.push({
              task_id: taskId,
              contact_id: contactId,
              template_id: templateId,
              status: 'pending',
              created_at: new Date(),
              updated_at: new Date()
            });
          }
        }
        
        // 批量创建SubTask
        await SubTask.bulkCreate(subTasksToCreate, { transaction: t });
        
        // 更新任务的统计信息
        await Task.update({
          total_subtasks: subTasksToCreate.length,
          pending_subtasks: subTasksToCreate.length,
          allocated_subtasks: 0
        }, {
          where: { id: taskId },
          transaction: t
        });
        
        if (!transaction) {
          await t.commit();
        }
        
        logger.info(`任务 ${taskId} 生成 ${subTasksToCreate.length} 个SubTask`);
        
        return subTasksToCreate.length;
        
      } catch (error) {
        if (!transaction) {
          await t.rollback();
        }
        throw error;
      }
      
    } catch (error) {
      logger.error('生成SubTask失败:', error);
      throw error;
    }
  }
  
  /**
   * 更新任务的汇总统计
   * @param {string} taskId - 任务ID
   * @param {object} transaction - 数据库事务（可选）
   */
  static async updateTaskStats(taskId, transaction = null) {
    try {
      const t = transaction || await sequelize.transaction();
      
      try {
        // 统计SubTask数据
        const stats = await SubTask.findOne({
          where: { task_id: taskId },
          attributes: [
            [sequelize.fn('COUNT', sequelize.col('id')), 'total_subtasks'],
            [sequelize.fn('SUM', sequelize.col('opens')), 'total_opens'],
            [sequelize.fn('SUM', sequelize.col('clicks')), 'total_clicks'],
            [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status = 'failed' THEN 1 END")), 'total_errors'],
            [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status = 'pending' THEN 1 END")), 'pending_subtasks'],
            [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status IN ('allocated', 'sending', 'sent', 'delivered') THEN 1 END")), 'allocated_subtasks']
          ],
          transaction: t,
          raw: true
        });
        
        // 更新任务统计
        await Task.update({
          total_subtasks: parseInt(stats.total_subtasks) || 0,
          total_opens: parseInt(stats.total_opens) || 0,
          total_clicks: parseInt(stats.total_clicks) || 0,
          total_errors: parseInt(stats.total_errors) || 0,
          pending_subtasks: parseInt(stats.pending_subtasks) || 0,
          allocated_subtasks: parseInt(stats.allocated_subtasks) || 0
        }, {
          where: { id: taskId },
          transaction: t
        });
        
        if (!transaction) {
          await t.commit();
        }
        
        logger.info(`任务 ${taskId} 统计更新完成`);
        
      } catch (error) {
        if (!transaction) {
          await t.rollback();
        }
        throw error;
      }
      
    } catch (error) {
      logger.error('更新任务统计失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取任务的完整信息（包含关联数据）
   * @param {string} taskId - 任务ID
   * @returns {Promise<Object>} 任务完整信息
   */
  static async getTaskFullInfo(taskId) {
    try {
      const task = await Task.findByPk(taskId);
      if (!task) {
        throw new Error(`任务 ${taskId} 不存在`);
      }
      
      // 获取关联的联系人和模板详情
      const [contactDetails, templateDetails] = await Promise.all([
        this.getTaskContactDetails(taskId),
        this.getTaskTemplateDetails(taskId)
      ]);
      
      return {
        ...task.toJSON(),
        contactDetails,
        templateDetails
      };
      
    } catch (error) {
      logger.error('获取任务完整信息失败:', error);
      throw error;
    }
  }
}

module.exports = TaskManager; 