const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const EmailService = sequelize.define('EmailService', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    provider: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'engagelab',
    },
    api_key: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    api_secret: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    domain: {
      type: DataTypes.STRING(255),
      allowNull: false,
      // unique: true, // 注释掉域名唯一约束，允许同一域名创建多个服务（群发、触发等不同通道）
    },
    daily_quota: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1000,
      validate: {
        min: 1,
      },
    },
    used_quota: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    sending_rate: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 60,
      validate: {
        min: 1,
      },
    },
    quota_reset_time: {
      type: DataTypes.TIME,
      allowNull: false,
      defaultValue: '00:00:00',
    },
    is_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    is_frozen: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    frozen_until: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    consecutive_failures: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    last_reset_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'email_services',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['name'],
      },
      {
        fields: ['is_enabled'],
      },
      {
        fields: ['is_frozen'],
      },
      {
        fields: ['quota_reset_time'],
      },
    ],
  });

  // 定义关联关系
  EmailService.associate = function(models) {
    // EmailService 可以有多个用户服务关联
    EmailService.hasMany(models.UserServiceMapping, {
      foreignKey: 'service_id',
      as: 'userMappings',
      onDelete: 'CASCADE'
    });
  };

  return EmailService;
}; 