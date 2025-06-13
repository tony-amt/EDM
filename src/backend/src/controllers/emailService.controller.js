/**
 * V2.0 发信服务管理控制器
 */
const { EmailService, ServiceStatusLog, UserServiceMapping } = require('../models');
const logger = require('../utils/logger');
const MailServiceManager = require('../services/mailServiceManager.service');

/**
 * 获取发信服务列表
 */
const getEmailServices = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const whereCondition = {};
    if (status) whereCondition.status = status;
    
    const offset = (page - 1) * limit;
    
    const services = await EmailService.findAndCountAll({
      where: whereCondition,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: services.rows,
      pagination: {
        total: services.count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(services.count / limit)
      }
    });
  } catch (error) {
    logger.error('获取发信服务列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 获取发信服务详情
 */
const getEmailServiceById = async (req, res) => {
  try {
    const service = await EmailService.findByPk(req.params.id);
    
    if (!service) {
      return res.status(404).json({ success: false, error: '发信服务不存在' });
    }

    res.json({
      success: true,
      data: service
    });
  } catch (error) {
    logger.error('获取发信服务详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 创建发信服务
 */
const createEmailService = async (req, res) => {
  try {
    const {
      name,
      provider,
      api_key,
      api_secret,
      domain,
      daily_quota = 1000,
      sending_rate = 60,
      quota_reset_time = '00:00:00',
      is_enabled = true,
      is_frozen = false
    } = req.body;

    // 验证必需字段 - 与EmailService模型匹配
    if (!name || !provider || !api_key || !api_secret || !domain) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必需字段: name, provider, api_key, api_secret, domain' 
      });
    }

    const service = await EmailService.create({
      name,
      provider,
      api_key,
      api_secret,
      domain,
      daily_quota,
      sending_rate,
      quota_reset_time,
      is_enabled,
      is_frozen
    });

    logger.info(`发信服务创建成功: ${service.id}`);

    res.status(201).json({
      success: true,
      data: service
    });
  } catch (error) {
    logger.error('创建发信服务失败:', error);
    
    // 数据库约束错误处理
    if (error.name === 'SequelizeUniqueConstraintError') {
      if (error.fields && error.fields.name) {
        return res.status(400).json({ 
          success: false, 
          error: '服务名称已存在，请使用不同的名称' 
        });
      }
      if (error.fields && error.fields.domain) {
        return res.status(400).json({ 
          success: false, 
          error: '该域名已被其他服务使用，请使用不同的域名' 
        });
      }
      return res.status(400).json({ 
        success: false, 
        error: '数据重复，请检查输入信息' 
      });
    }
    
    // 数据验证错误
    if (error.name === 'SequelizeValidationError') {
      const errorMessages = error.errors.map(err => err.message).join(', ');
      return res.status(400).json({ 
        success: false, 
        error: `数据验证失败: ${errorMessages}` 
      });
    }
    
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 更新发信服务
 */
const updateEmailService = async (req, res) => {
  try {
    const service = await EmailService.findByPk(req.params.id);
    
    if (!service) {
      return res.status(404).json({ success: false, error: '发信服务不存在' });
    }

    // 允许更新的字段列表，与EmailService模型匹配
    const allowedFields = [
      'name', 'provider', 'api_key', 'api_secret', 'domain', 
      'daily_quota', 'sending_rate', 'quota_reset_time', 'is_enabled'
    ];
    
    const updateData = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        // 如果API密钥为空字符串，保持原有值
        if ((field === 'api_key' || field === 'api_secret') && req.body[field] === '') {
          return;
        }
        updateData[field] = req.body[field];
      }
    });

    await service.update(updateData);

    logger.info(`发信服务更新成功: ${service.id}`);

    res.json({
      success: true,
      data: service
    });
  } catch (error) {
    logger.error('更新发信服务失败:', error);
    
    // 数据库约束错误处理
    if (error.name === 'SequelizeUniqueConstraintError') {
      if (error.fields && error.fields.name) {
        return res.status(400).json({ 
          success: false, 
          error: '服务名称已存在，请使用不同的名称' 
        });
      }
      if (error.fields && error.fields.domain) {
        return res.status(400).json({ 
          success: false, 
          error: '该域名已被其他服务使用，请使用不同的域名' 
        });
      }
      return res.status(400).json({ 
        success: false, 
        error: '数据重复，请检查输入信息' 
      });
    }
    
    // 数据验证错误
    if (error.name === 'SequelizeValidationError') {
      const errorMessages = error.errors.map(err => err.message).join(', ');
      return res.status(400).json({ 
        success: false, 
        error: `数据验证失败: ${errorMessages}` 
      });
    }
    
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 删除发信服务
 */
const deleteEmailService = async (req, res) => {
  try {
    const service = await EmailService.findByPk(req.params.id);
    
    if (!service) {
      return res.status(404).json({ success: false, error: '发信服务不存在' });
    }

    // 检查是否有关联的用户映射
    const mappingCount = await UserServiceMapping.count({
      where: { service_id: service.id }
    });

    if (mappingCount > 0) {
      return res.status(400).json({ 
        success: false, 
        error: '该发信服务有关联的用户映射，无法删除' 
      });
    }

    await service.destroy();

    logger.info(`发信服务删除成功: ${service.id}`);

    res.json({
      success: true,
      message: '发信服务删除成功'
    });
  } catch (error) {
    logger.error('删除发信服务失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 测试发信服务连通性
 */
const testEmailService = async (req, res) => {
  try {
    const service = await EmailService.findByPk(req.params.id);
    
    if (!service) {
      return res.status(404).json({ success: false, error: '发信服务不存在' });
    }

    const startTime = Date.now();
    
    // 使用MailServiceManager进行真实的连接测试
    const isConnected = await MailServiceManager.testServiceConnection(service.id);
    
    const responseTime = Date.now() - startTime;

    if (isConnected) {
      const testResult = {
        success: true,
        message: '测试邮件发送成功！请检查邮箱 376101593@qq.com',
        response_time: responseTime,
        timestamp: new Date(),
        service_info: {
          name: service.name,
          provider: service.provider,
          domain: service.domain
        },
        test_email: '376101593@qq.com'
      };

      res.json({
        success: true,
        data: testResult
      });
    } else {
      res.status(400).json({
        success: false,
        error: '测试邮件发送失败，请检查API_KEY和API_SECRET配置或网络连接'
      });
    }
  } catch (error) {
    logger.error('测试发信服务失败:', error);
    res.status(500).json({ 
      success: false, 
      error: `连接测试失败: ${error.message}` 
    });
  }
};

/**
 * 测试邮件服务配置（创建前测试）
 */
const testEmailServiceConfig = async (req, res) => {
  try {
    const { provider, domain, api_key, api_secret } = req.body;
    
    if (!provider || !domain || !api_key || !api_secret) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必需的配置参数' 
      });
    }

    const startTime = Date.now();
    
    // 创建临时邮件服务客户端进行测试
    const MailService = require('../services/third-party/mail.service');
    
    const tempMailService = new MailService({
      api_key: api_key,     // 映射到apiUser
      api_secret: api_secret, // 映射到apiKey
      domain: domain,
      name: 'test-service'
    });
    
    // 测试连接（发送测试邮件）
    const testResult = await tempMailService.testConnection();
    
    const responseTime = Date.now() - startTime;

    if (testResult.success) {
      const successResult = {
        success: true,
        message: '测试邮件发送成功！请检查邮箱 376101593@qq.com',
        response_time: responseTime,
        timestamp: new Date(),
        service_info: {
          provider: provider,
          domain: domain,
          api_user: api_key
        },
        test_email: '376101593@qq.com',
        engagelab_response: testResult.response,
        status_code: testResult.statusCode
      };

      res.json({
        success: true,
        data: successResult
      });
    } else {
      // 返回详细的错误信息
      const errorResult = {
        success: false,
        error: testResult.error || '测试邮件发送失败',
        response_time: responseTime,
        timestamp: new Date(),
        service_info: {
          provider: provider,
          domain: domain,
          api_user: api_key
        },
        debug_info: {
          status_code: testResult.statusCode,
          engagelab_response: testResult.response,
          raw_response: testResult.rawResponse,
          exception: testResult.exception,
          error_stack: testResult.stack
        }
      };

      res.status(400).json(errorResult);
    }
  } catch (error) {
    logger.error('测试邮件服务配置时发生异常:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      debug_info: {
        exception: error.message,
        error_stack: error.stack
      }
    });
  }
};

module.exports = {
  getEmailServices,
  getEmailServiceById,
  createEmailService,
  updateEmailService,
  deleteEmailService,
  testEmailService,
  testEmailServiceConfig
};
