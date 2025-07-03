/**
 * 配置变更历史模型
 * Phase 2: 配置管理系统
 */

module.exports = (sequelize, DataTypes) => {
  const ConfigChangeHistory = sequelize.define('ConfigChangeHistory', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    configId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'config_id',
      references: {
        model: 'system_configs',
        key: 'id'
      },
      comment: '配置ID'
    },
    changeType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'change_type',
      comment: '变更类型'
    },
    oldValue: {
      type: DataTypes.TEXT,
      field: 'old_value',
      comment: '原值'
    },
    newValue: {
      type: DataTypes.TEXT,
      field: 'new_value',
      comment: '新值'
    },
    changeReason: {
      type: DataTypes.TEXT,
      field: 'change_reason',
      comment: '变更原因'
    },
    changeSource: {
      type: DataTypes.STRING(100),
      defaultValue: 'manual',
      field: 'change_source',
      comment: '变更来源'
    },
    ipAddress: {
      type: DataTypes.INET,
      field: 'ip_address',
      comment: '操作IP地址'
    },
    userAgent: {
      type: DataTypes.TEXT,
      field: 'user_agent',
      comment: '用户代理'
    },
    createdBy: {
      type: DataTypes.UUID,
      field: 'created_by',
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'config_change_history',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false, // 历史记录不需要更新时间
    indexes: [
      {
        fields: ['config_id']
      },
      {
        fields: ['created_at']
      },
      {
        fields: ['created_by']
      },
      {
        fields: ['change_type']
      }
    ]
  });

  // 关联关系
  ConfigChangeHistory.associate = function (models) {
    // 关联配置
    ConfigChangeHistory.belongsTo(models.SystemConfig, {
      foreignKey: 'configId',
      as: 'config'
    });

    // 关联操作用户
    ConfigChangeHistory.belongsTo(models.User, {
      foreignKey: 'createdBy',
      as: 'operator'
    });
  };

  // 类方法
  ConfigChangeHistory.recordChange = async function (configId, changeType, oldValue, newValue, userId, options = {}) {
    return await this.create({
      configId,
      changeType,
      oldValue: oldValue ? JSON.stringify(oldValue) : null,
      newValue: newValue ? JSON.stringify(newValue) : null,
      changeReason: options.reason,
      changeSource: options.source || 'manual',
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      createdBy: userId
    });
  };

  ConfigChangeHistory.getHistory = async function (configId, limit = 50) {
    return await this.findAll({
      where: { configId },
      include: [
        {
          model: sequelize.models.User,
          as: 'operator',
          attributes: ['id', 'username', 'email']
        }
      ],
      order: [['created_at', 'DESC']],
      limit
    });
  };

  return ConfigChangeHistory;
}; 