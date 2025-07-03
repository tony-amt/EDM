module.exports = (sequelize, DataTypes) => {
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
      comment: '最后重置时间（用于排查问题）'
    },
    last_sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '最后发送时间'
    },
    // 🎯 Phase 4 新增预计算字段
    next_available_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '下次可用时间（预计算）'
    },
    total_sent: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: '总发送数量'
    },
    success_rate: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 100.00,
      allowNull: false,
      comment: '成功率百分比'
    },
    avg_response_time: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: '平均响应时间（毫秒）'
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
        fields: ['quota_reset_time'],
      },
      // 🎯 Phase 4 新增高效索引
      {
        fields: ['next_available_at', 'is_enabled'],
        name: 'idx_email_services_next_available_enabled',
        where: {
          is_enabled: true
        }
      },
      {
        fields: ['used_quota', 'daily_quota'],
        name: 'idx_email_services_quota'
      }
    ],
  });

  // 定义关联关系
  EmailService.associate = function (models) {
    // EmailService 可以有多个用户服务关联
    EmailService.hasMany(models.UserServiceMapping, {
      foreignKey: 'service_id',
      as: 'userMappings',
      onDelete: 'CASCADE'
    });
  };

  // 🎯 Phase 4 新增实例方法
  EmailService.prototype.isAvailable = function () {
    if (!this.is_enabled) return false;
    if (this.used_quota >= this.daily_quota) return false;
    if (this.next_available_at && new Date() < this.next_available_at) return false;
    return true;
  };

  EmailService.prototype.updateAfterSending = async function (success = true, responseTime = 0) {
    const now = new Date();
    const nextAvailableTime = new Date(now.getTime() + this.sending_rate * 1000);

    const updateData = {
      last_sent_at: now,
      next_available_at: nextAvailableTime,
      total_sent: this.total_sent + 1,
      used_quota: this.used_quota + 1,
      avg_response_time: Math.round((this.avg_response_time + responseTime) / 2)
    };

    if (success) {
      updateData.consecutive_failures = 0;
      // 更新成功率
      const totalAttempts = this.total_sent + 1;
      const currentSuccesses = Math.round(this.success_rate * this.total_sent / 100);
      updateData.success_rate = ((currentSuccesses + 1) / totalAttempts * 100).toFixed(2);
    } else {
      updateData.consecutive_failures = this.consecutive_failures + 1;
      // 更新成功率
      const totalAttempts = this.total_sent + 1;
      const currentSuccesses = Math.round(this.success_rate * this.total_sent / 100);
      updateData.success_rate = (currentSuccesses / totalAttempts * 100).toFixed(2);
    }

    await this.update(updateData);
    return this;
  };

  // 🎯 Phase 4 新增类方法
  EmailService.getReadyServices = async function () {
    const now = new Date();
    return await this.findAll({
      where: {
        is_enabled: true,
        [sequelize.Sequelize.Op.where]: sequelize.literal('used_quota < daily_quota'),
        [sequelize.Sequelize.Op.or]: [
          { next_available_at: null }, // 从未发送过
          { next_available_at: { [sequelize.Sequelize.Op.lte]: now } } // 已到可用时间
        ]
      },
      order: [
        ['used_quota', 'ASC'], // 优先使用余额多的服务
        ['success_rate', 'DESC'], // 优先使用成功率高的服务
        ['avg_response_time', 'ASC'] // 优先使用响应快的服务
      ]
    });
  };

  EmailService.getServiceStats = async function (serviceId = null, hours = 24) {
    const whereClause = {};

    if (serviceId) {
      whereClause.id = serviceId;
    }

    // 🔧 修复：移除时间限制，获取所有服务的统计，确保返回EmailService实例
    const services = await this.findAll({
      where: whereClause,
      attributes: [
        'id',
        'name',
        'total_sent',
        'success_rate',
        'avg_response_time',
        'used_quota',
        'daily_quota',
        'last_sent_at',
        'next_available_at',
        'is_enabled'
      ]
    });

    return services.map(service => ({
      id: service.id,
      name: service.name,
      total_sent: service.total_sent,
      success_rate: parseFloat(service.success_rate),
      avg_response_time: service.avg_response_time,
      quota_usage: `${service.used_quota}/${service.daily_quota}`,
      quota_percentage: Math.round((service.used_quota / service.daily_quota) * 100),
      last_sent_at: service.last_sent_at,
      next_available_at: service.next_available_at,
      is_available: service.isAvailable() // 现在可以正确调用实例方法
    }));
  };

  return EmailService;
}; 