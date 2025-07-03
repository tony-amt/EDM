/**
 * Phase 3 测试控制器
 * 用于验证标签系统JSONB优化的反向查询功能
 */

const ContactTagService = require('../services/core/contactTag.service');
const ContactService = require('../services/core/contact.service');
const { Contact, Tag } = require('../models/index');
const logger = require('../utils/logger');

/**
 * 测试反向查询功能
 * @route GET /api/test/phase3/reverse-query
 */
exports.testReverseQuery = async (req, res) => {
  try {
    const userId = req.user.id;
    const { contactLimit = 5 } = req.query;

    logger.info('开始Phase 3反向查询测试', { userId });

    // 1. 获取少量联系人进行测试
    const contacts = await Contact.findAll({
      where: { user_id: userId },
      limit: parseInt(contactLimit),
      attributes: ['id', 'email', 'name']
    });

    if (contacts.length === 0) {
      return res.json({
        success: true,
        message: '没有联系人数据可供测试',
        data: { contacts: [], tags: [] }
      });
    }

    // 2. 使用反向查询获取标签
    const contactIds = contacts.map(c => c.id);
    const startTime = Date.now();

    const contactTagMap = await ContactTagService.getContactsWithTagsBatch(
      contactIds,
      true, // 包含子标签
      userId
    );

    const queryTime = Date.now() - startTime;

    // 3. 构建测试结果
    const results = contacts.map(contact => ({
      id: contact.id,
      email: contact.email,
      name: contact.name,
      tags: contactTagMap.get(contact.id) || []
    }));

    // 4. 统计信息
    // 🚀 Phase 3修复: 使用反向查询计算标签数量
  const totalTags = await Tag.count({
    where: {
      user_id: userId,
      contacts: { [Op.ne]: null }
    }
  });
    const avgTagsPerContact = contacts.length > 0 ? (totalTags / contacts.length).toFixed(2) : 0;

    res.json({
      success: true,
      message: 'Phase 3反向查询测试完成',
      data: {
        contacts: results,
        performance: {
          queryTimeMs: queryTime,
          avgPerContact: queryTime / contacts.length,
          contactsCount: contacts.length,
          totalTags,
          avgTagsPerContact
        }
      }
    });

  } catch (error) {
    logger.error('Phase 3反向查询测试失败:', error);
    res.status(500).json({
      success: false,
      message: 'Phase 3反向查询测试失败',
      error: error.message
    });
  }
};

/**
 * 验证数据一致性
 * @route GET /api/test/phase3/data-consistency
 */
exports.testDataConsistency = async (req, res) => {
  try {
    const userId = req.user.id;

    logger.info('开始Phase 3数据一致性验证', { userId });

    // 🚀 Phase 3完成: 使用新的数据完整性验证
  const result = await ContactTagService.validateDataConsistency(userId);

    res.json({
      success: true,
      message: 'Phase 3数据一致性验证完成',
      data: result
    });

  } catch (error) {
    logger.error('Phase 3数据一致性验证失败:', error);
    res.status(500).json({
      success: false,
      message: 'Phase 3数据一致性验证失败',
      error: error.message
    });
  }
};

/**
 * 测试联系人列表功能（使用反向查询）
 * @route GET /api/test/phase3/contact-list
 */
exports.testContactList = async (req, res) => {
  try {
    const userId = req.user.id;
    const filters = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10,
      include_child_tags: req.query.include_child_tags === 'true'
    };

    logger.info('开始Phase 3联系人列表测试', { userId, filters });

    const startTime = Date.now();
    const result = await ContactService.getContacts(filters, userId);
    const queryTime = Date.now() - startTime;

    res.json({
      success: true,
      message: 'Phase 3联系人列表测试完成',
      data: {
        ...result,
        performance: {
          queryTimeMs: queryTime,
          avgPerContact: result.data.length > 0 ? queryTime / result.data.length : 0
        }
      }
    });

  } catch (error) {
    logger.error('Phase 3联系人列表测试失败:', error);
    res.status(500).json({
      success: false,
      message: 'Phase 3联系人列表测试失败',
      error: error.message
    });
  }
};

/**
 * 获取Phase 3优化状态概览
 * @route GET /api/test/phase3/status
 */
exports.getPhase3Status = async (req, res) => {
  try {
    const userId = req.user.id;

    // 统计基本信息
    const contactCount = await Contact.count({ where: { user_id: userId } });
    const tagCount = await Tag.count({ where: { user_id: userId } });

    // 统计有联系人的标签数量
    const tagsWithContacts = await Tag.count({
      where: {
        user_id: userId,
        contacts: { [require('sequelize').Op.not]: null }
      }
    });

    res.json({
      success: true,
      message: 'Phase 3状态获取成功',
      data: {
        phase: 'Phase 3 - 标签系统JSONB优化',
        status: '反向查询功能已实现',
        statistics: {
          totalContacts: contactCount,
          totalTags: tagCount,
          tagsWithContacts,
          migrationProgress: tagsWithContacts > 0 ? '数据已迁移到tag.contacts' : '暂无标签关联数据'
        },
        features: {
          reverseQuery: '✅ 已实现',
          batchQuery: '✅ 已实现',
          dataConsistency: '✅ 已实现',
          contactTagsField: '⚠️ 待移除',
          performanceOptimization: '✅ 已实现'
        }
      }
    });

  } catch (error) {
    logger.error('获取Phase 3状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取Phase 3状态失败',
      error: error.message
    });
  }
}; 