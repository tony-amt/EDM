/**
 * 系统配置模型
 * Phase 2: 配置管理系统
 */

module.exports = (sequelize, DataTypes) => {
  const SystemConfig = sequelize.define('SystemConfig', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: '配置分类'
    },
    configKey: {
      type: DataTypes.STRING(200),
      allowNull: false,
      field: 'config_key',
      comment: '配置键名'
    },
    configValue: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'config_value',
      comment: '配置值'
    },
    dataType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'string',
      field: 'data_type',
      comment: '数据类型'
    },
    description: {
      type: DataTypes.TEXT,
      comment: '配置描述'
    },
    isSensitive: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_sensitive',
      comment: '是否敏感信息'
    },
    isEditable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_editable',
      comment: '是否可编辑'
    },
    validationRules: {
      type: DataTypes.JSONB,
      field: 'validation_rules',
      comment: '验证规则'
    },
    defaultValue: {
      type: DataTypes.TEXT,
      field: 'default_value',
      comment: '默认值'
    },
    environment: {
      type: DataTypes.STRING(50),
      defaultValue: 'all',
      comment: '环境限制'
    },
    createdBy: {
      type: DataTypes.UUID,
      field: 'created_by',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    updatedBy: {
      type: DataTypes.UUID,
      field: 'updated_by',
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'system_configs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['category', 'config_key', 'environment']
      },
      {
        fields: ['category']
      },
      {
        fields: ['config_key']
      },
      {
        fields: ['environment']
      },
      {
        fields: ['is_sensitive']
      },
      {
        fields: ['is_editable']
      }
    ]
  });

  // 关联关系
  SystemConfig.associate = function (models) {
    // 关联创建者
    SystemConfig.belongsTo(models.User, {
      foreignKey: 'createdBy',
      as: 'creator'
    });

    // 关联更新者
    SystemConfig.belongsTo(models.User, {
      foreignKey: 'updatedBy',
      as: 'updater'
    });

    // 临时注释掉ConfigChangeHistory关联，等系统稳定后再启用
    // SystemConfig.hasMany(models.ConfigChangeHistory, {
    //   foreignKey: 'configId',
    //   as: 'changeHistory'
    // });
  };

  // 实例方法
  SystemConfig.prototype.getParsedValue = function () {
    try {
      switch (this.dataType) {
        case 'number':
          return parseFloat(this.configValue);
        case 'boolean':
          return this.configValue === 'true';
        case 'json':
        case 'array':
          return JSON.parse(this.configValue);
        default:
          return this.configValue;
      }
    } catch (error) {
      console.error('Failed to parse config value:', error);
      return this.configValue;
    }
  };

  SystemConfig.prototype.validateValue = function (value) {
    if (!this.validationRules) {
      return { valid: true };
    }

    try {
      const rules = typeof this.validationRules === 'string'
        ? JSON.parse(this.validationRules)
        : this.validationRules;

      // 数值类型验证
      if (this.dataType === 'number') {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          return { valid: false, error: '值必须是数字' };
        }
        if (rules.min !== undefined && numValue < rules.min) {
          return { valid: false, error: `值不能小于 ${rules.min}` };
        }
        if (rules.max !== undefined && numValue > rules.max) {
          return { valid: false, error: `值不能大于 ${rules.max}` };
        }
      }

      // 字符串类型验证
      if (this.dataType === 'string') {
        if (rules.minLength && value.length < rules.minLength) {
          return { valid: false, error: `长度不能小于 ${rules.minLength}` };
        }
        if (rules.maxLength && value.length > rules.maxLength) {
          return { valid: false, error: `长度不能大于 ${rules.maxLength}` };
        }
        if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
          return { valid: false, error: '格式不正确' };
        }
      }

      // 布尔类型验证
      if (this.dataType === 'boolean') {
        if (!['true', 'false'].includes(value.toString().toLowerCase())) {
          return { valid: false, error: '值必须是 true 或 false' };
        }
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: '验证规则格式错误' };
    }
  };

  // 类方法
  SystemConfig.getByCategory = async function (category, environment = 'all') {
    return await this.findAll({
      where: {
        category,
        environment: ['all', environment]
      },
      order: [['configKey', 'ASC']]
    });
  };

  SystemConfig.getByKey = async function (category, configKey, environment = 'all') {
    return await this.findOne({
      where: {
        category,
        configKey,
        environment: ['all', environment]
      }
    });
  };

  SystemConfig.updateConfig = async function (category, configKey, newValue, userId, environment = 'all') {
    const config = await this.getByKey(category, configKey, environment);
    if (!config) {
      throw new Error('配置项不存在');
    }

    if (!config.isEditable) {
      throw new Error('此配置项不可编辑');
    }

    // 验证新值
    const validation = config.validateValue(newValue);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // 记录变更历史
    const oldValue = config.configValue;

    // 更新配置
    await config.update({
      configValue: newValue.toString(),
      updatedBy: userId
    });

    return config;
  };

  return SystemConfig;
}; 