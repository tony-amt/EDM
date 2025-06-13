/**
 * V2.0 用户服务映射管理控制器
 */
const { UserServiceMapping, User, EmailService } = require('../models');
const logger = require('../utils/logger');

/**
 * 获取用户服务映射列表
 */
const getUserServiceMappings = async (req, res) => {
  try {
    const { page = 1, limit = 20, user_id, service_id } = req.query;
    
    const whereCondition = {};
    if (user_id) whereCondition.user_id = user_id;
    if (service_id) whereCondition.service_id = service_id;
    
    const offset = (page - 1) * limit;
    
    const mappings = await UserServiceMapping.findAndCountAll({
      where: whereCondition,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email']
        },
        {
          model: EmailService,
          as: 'emailService',
          attributes: ['id', 'name', 'provider', 'domain']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: mappings.rows,
      pagination: {
        total: mappings.count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(mappings.count / limit)
      }
    });
  } catch (error) {
    logger.error('获取用户服务映射失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 创建用户服务映射
 */
const createUserServiceMapping = async (req, res) => {
  try {
    const {
      user_id,
      service_id,
      daily_quota = 100,
      hourly_quota = 10,
      priority = 0,
      is_default = false
    } = req.body;

    // 验证必需字段
    if (!user_id || !service_id) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必需字段: user_id, service_id' 
      });
    }

    // 验证用户和服务是否存在
    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    const emailService = await EmailService.findByPk(service_id);
    if (!emailService) {
      return res.status(404).json({ success: false, error: '发信服务不存在' });
    }

    // 检查是否已存在相同的映射
    const existingMapping = await UserServiceMapping.findOne({
      where: { user_id, service_id }
    });

    if (existingMapping) {
      return res.status(400).json({ 
        success: false, 
        error: '该用户与发信服务的映射已存在' 
      });
    }

    // 如果设置为默认，先取消其他默认映射
    if (is_default) {
      await UserServiceMapping.update(
        { is_default: false },
        { where: { user_id, is_default: true } }
      );
    }

    const mapping = await UserServiceMapping.create({
      user_id,
      service_id,
      daily_quota,
      hourly_quota,
      priority,
      is_default,
      created_by: req.user.id
    });

    logger.info(`用户服务映射创建成功: ${mapping.id}`);

    // 返回包含关联信息的映射
    const mappingWithIncludes = await UserServiceMapping.findByPk(mapping.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email']
        },
        {
          model: EmailService,
          as: 'emailService',
          attributes: ['id', 'name', 'provider', 'domain']
        }
      ]
    });

    res.status(201).json({
      success: true,
      data: mappingWithIncludes
    });
  } catch (error) {
    logger.error('创建用户服务映射失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 更新用户服务映射
 */
const updateUserServiceMapping = async (req, res) => {
  try {
    const mapping = await UserServiceMapping.findByPk(req.params.id);
    
    if (!mapping) {
      return res.status(404).json({ success: false, error: '用户服务映射不存在' });
    }

    const allowedFields = ['daily_quota', 'hourly_quota', 'priority', 'is_default'];
    
    const updateData = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    // 如果设置为默认，先取消其他默认映射
    if (updateData.is_default) {
      await UserServiceMapping.update(
        { is_default: false },
        { where: { user_id: mapping.user_id, is_default: true } }
      );
    }

    await mapping.update(updateData);

    logger.info(`用户服务映射更新成功: ${mapping.id}`);

    res.json({
      success: true,
      data: mapping
    });
  } catch (error) {
    logger.error('更新用户服务映射失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 删除用户服务映射
 */
const deleteUserServiceMapping = async (req, res) => {
  try {
    const mapping = await UserServiceMapping.findByPk(req.params.id);
    
    if (!mapping) {
      return res.status(404).json({ success: false, error: '用户服务映射不存在' });
    }

    await mapping.destroy();

    logger.info(`用户服务映射删除成功: ${mapping.id}`);

    res.json({
      success: true,
      message: '用户服务映射删除成功'
    });
  } catch (error) {
    logger.error('删除用户服务映射失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 获取用户的发信服务
 */
const getUserEmailServices = async (req, res) => {
  try {
    const { user_id } = req.params;
    
    const mappings = await UserServiceMapping.findAll({
      where: { user_id },
      include: [
        {
          model: EmailService,
          as: 'emailService',
          attributes: ['id', 'name', 'provider', 'domain', 'status']
        }
      ],
      order: [['priority', 'DESC'], ['is_default', 'DESC']]
    });

    const services = mappings.map(mapping => ({
      ...mapping.emailService.toJSON(),
      mapping_info: {
        id: mapping.id,
        daily_quota: mapping.daily_quota,
        hourly_quota: mapping.hourly_quota,
        priority: mapping.priority,
        is_default: mapping.is_default
      }
    }));

    res.json({
      success: true,
      data: services
    });
  } catch (error) {
    logger.error('获取用户发信服务失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getUserServiceMappings,
  createUserServiceMapping,
  updateUserServiceMapping,
  deleteUserServiceMapping,
  getUserEmailServices
};
