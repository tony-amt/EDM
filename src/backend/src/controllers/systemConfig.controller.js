const { SystemConfig } = require('../models/index');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');

/**
 * 获取所有系统配置
 */
exports.getAllConfigs = catchAsync(async (req, res, next) => {
  const { category } = req.query;

  const whereClause = {};

  if (category) {
    whereClause.category = category;
  }

  const configs = await SystemConfig.findAll({
    where: whereClause,
    attributes: ['id', 'configKey', 'configValue', 'description', 'category', 'updated_at'],
    order: [['category', 'ASC'], ['configKey', 'ASC']]
  });

  // 格式化输出，确保向后兼容
  const formattedConfigs = configs.map(config => {
    let parsedValue;
    try {
      // 尝试解析JSON，如果失败则返回原值
      parsedValue = typeof config.getParsedValue === 'function'
        ? config.getParsedValue()
        : JSON.parse(config.configValue);
    } catch (error) {
      parsedValue = config.configValue;
    }

    return {
      id: config.id,
      config_key: config.configKey, // 向后兼容字段名
      configKey: config.configKey,  // 新字段名
      config_value: parsedValue,    // 向后兼容字段名
      configValue: config.configValue, // 新字段名
      description: config.description,
      category: config.category,
      updated_at: config.updated_at
    };
  });

  res.json({
    success: true,
    data: formattedConfigs,
    total: formattedConfigs.length
  });
});

/**
 * 获取队列相关配置
 */
exports.getQueueConfigs = catchAsync(async (req, res, next) => {
  const queueConfigKeys = [
    'queue_batch_size',
    'queue_interval_seconds',
    'scheduled_check_interval',
    'max_retry_attempts'
  ];

  const configs = await SystemConfig.findAll({
    where: {
      configKey: queueConfigKeys
    },
    attributes: ['configKey', 'configValue', 'description', 'updated_at']
  });

  const result = {};
  configs.forEach(config => {
    let parsedValue;
    try {
      parsedValue = typeof config.getParsedValue === 'function'
        ? config.getParsedValue()
        : JSON.parse(config.configValue);
    } catch (error) {
      parsedValue = config.configValue;
    }

    result[config.configKey] = {
      value: parsedValue,
      description: config.description,
      updated_at: config.updated_at
    };
  });

  res.json({
    success: true,
    data: result
  });
});

/**
 * 更新单个配置
 */
exports.updateConfig = catchAsync(async (req, res, next) => {
  const { key } = req.params;
  const { value, description } = req.body;

  if (value === undefined) {
    return next(new AppError('配置值不能为空', 400));
  }

  // 验证配置键是否存在
  const config = await SystemConfig.findOne({
    where: { configKey: key }
  });

  if (!config) {
    return next(new AppError('配置项不存在', 404));
  }

  // 基础值验证
  let validationResult = { valid: true };
  if (typeof config.validateValue === 'function') {
    validationResult = config.validateValue(value);
  }

  if (!validationResult.valid) {
    return next(new AppError(validationResult.error || '配置值验证失败', 400));
  }

  // 更新配置
  const updateData = {
    configValue: typeof value === 'string' ? value : JSON.stringify(value)
  };

  if (description !== undefined) {
    updateData.description = description;
  }

  if (req.user && req.user.id) {
    updateData.updatedBy = req.user.id;
  }

  await config.update(updateData);

  logger.info(`系统配置已更新: ${key} = ${value} by ${req.user?.username || 'system'}`);

  res.json({
    success: true,
    message: '配置更新成功',
    data: {
      config_key: config.configKey,
      config_value: value,
      description: config.description,
      updated_at: config.updated_at
    }
  });
});

/**
 * 批量更新配置
 */
exports.updateConfigs = catchAsync(async (req, res, next) => {
  const { configs } = req.body;

  if (!Array.isArray(configs) || configs.length === 0) {
    return next(new AppError('配置数据格式错误', 400));
  }

  const errors = [];
  const updates = [];
  const results = [];

  // 验证所有配置
  for (const { key, value } of configs) {
    if (!key || value === undefined) {
      errors.push(`配置项格式错误: ${key}`);
      continue;
    }

    // 获取配置项进行验证
    try {
      const config = await SystemConfig.findOne({
        where: { configKey: key }
      });

      if (!config) {
        errors.push(`配置项不存在: ${key}`);
        continue;
      }

      // 基础值验证
      let validationResult = { valid: true };
      if (typeof config.validateValue === 'function') {
        validationResult = config.validateValue(value);
      }

      if (!validationResult.valid) {
        errors.push(`${key}: ${validationResult.error || '配置值验证失败'}`);
        continue;
      }

      updates.push({ key, value, config });
    } catch (error) {
      errors.push(`验证配置失败 ${key}: ${error.message}`);
    }
  }

  if (errors.length > 0) {
    return next(new AppError(`配置验证失败: ${errors.join(', ')}`, 400));
  }

  // 执行批量更新
  for (const { key, value, config } of updates) {
    try {
      const updateData = {
        configValue: typeof value === 'string' ? value : JSON.stringify(value)
      };

      if (req.user && req.user.id) {
        updateData.updatedBy = req.user.id;
      }

      await config.update(updateData);

      results.push({
        config_key: key,
        config_value: value,
        status: 'updated'
      });

      logger.info(`批量更新配置: ${key} = ${value} by ${req.user?.username || 'system'}`);
    } catch (error) {
      errors.push(`更新失败 ${key}: ${error.message}`);
    }
  }

  res.json({
    success: true,
    message: `成功更新 ${results.length} 项配置`,
    data: results,
    errors: errors.length > 0 ? errors : undefined
  });
});

/**
 * 创建新配置
 */
exports.createConfig = catchAsync(async (req, res, next) => {
  const { config_key, config_value, description, category } = req.body;

  if (!config_key || config_value === undefined) {
    return next(new AppError('配置键和配置值不能为空', 400));
  }

  // 检查是否已存在
  const existingConfig = await SystemConfig.findOne({
    where: { configKey: config_key }
  });

  if (existingConfig) {
    return next(new AppError('配置项已存在', 409));
  }

  const createData = {
    configKey: config_key,
    configValue: typeof config_value === 'string' ? config_value : JSON.stringify(config_value),
    description: description || '',
    category: category || 'system'
  };

  if (req.user && req.user.id) {
    createData.createdBy = req.user.id;
    createData.updatedBy = req.user.id;
  }

  const config = await SystemConfig.create(createData);

  logger.info(`系统配置已创建: ${config_key} = ${config_value} by ${req.user?.username || 'system'}`);

  res.status(201).json({
    success: true,
    message: '配置创建成功',
    data: {
      config_key: config.configKey,
      config_value: config_value,
      description: config.description,
      category: config.category,
      created_at: config.created_at,
      updated_at: config.updated_at
    }
  });
});

/**
 * 删除配置
 */
exports.deleteConfig = catchAsync(async (req, res, next) => {
  const { key } = req.params;

  const deletedRows = await SystemConfig.destroy({
    where: { configKey: key }
  });

  if (deletedRows === 0) {
    return next(new AppError('配置项不存在', 404));
  }

  logger.info(`系统配置已删除: ${key} by ${req.user?.username || 'system'}`);

  res.json({
    success: true,
    message: '配置删除成功'
  });
});

/**
 * 重置配置为默认值
 */
exports.resetConfig = catchAsync(async (req, res, next) => {
  const { key } = req.params;

  const config = await SystemConfig.findOne({
    where: { configKey: key }
  });

  if (!config) {
    return next(new AppError('配置项不存在', 404));
  }

  // 获取默认值
  let defaultValue = null;
  if (config.defaultValue) {
    defaultValue = config.defaultValue;
  } else {
    // 硬编码的默认值作为fallback
    const defaultConfigs = {
      queue_batch_size: '10',
      queue_interval_seconds: '5',
      scheduled_check_interval: '30',
      max_retry_attempts: '3'
    };
    defaultValue = defaultConfigs[key];
  }

  if (!defaultValue) {
    return next(new AppError('该配置项没有默认值', 400));
  }

  const updateData = {
    configValue: defaultValue
  };

  if (req.user && req.user.id) {
    updateData.updatedBy = req.user.id;
  }

  await config.update(updateData);

  logger.info(`系统配置已重置: ${key} by ${req.user?.username || 'system'}`);

  res.json({
    success: true,
    message: '配置重置成功',
    data: {
      config_key: key,
      config_value: defaultValue,
      updated_at: config.updated_at
    }
  });
});

/**
 * 配置值验证函数
 */
function validateConfigValue(key, value) {
  switch (key) {
    case 'queue_batch_size':
      if (!Number.isInteger(value) || value < 1 || value > 100) {
        return { valid: false, message: '批处理大小必须是1-100之间的整数' };
      }
      break;
    case 'queue_interval_seconds':
      if (!Number.isInteger(value) || value < 1 || value > 300) {
        return { valid: false, message: '队列间隔必须是1-300秒之间的整数' };
      }
      break;
    case 'scheduled_check_interval':
      if (!Number.isInteger(value) || value < 10 || value > 3600) {
        return { valid: false, message: '定时检查间隔必须是10-3600秒之间的整数' };
      }
      break;
    case 'max_retry_attempts':
      if (!Number.isInteger(value) || value < 0 || value > 10) {
        return { valid: false, message: '最大重试次数必须是0-10之间的整数' };
      }
      break;
    default:
      // 对于其他配置项，执行基本验证
      if (value === null || value === undefined) {
        return { valid: false, message: '配置值不能为空' };
      }
  }

  return { valid: true };
} 