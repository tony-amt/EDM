const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class SubTask extends Model {}

  SubTask.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    task_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'tasks',
        key: 'id'
      }
    },
    contact_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'contacts',
        key: 'id'
      }
    },
    // V2.0 核心字段：发信服务分配
    service_id: {
      type: DataTypes.UUID,
      allowNull: true, // 按需分配，初始可为空
      references: {
        model: 'email_services',
        key: 'id'
      },
      comment: 'V2.0按需分配的发信服务ID'
    },
    // V2.0 调度相关字段
    scheduled_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'V2.0调度时间'
    },
    allocated_quota: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'V2.0分配的额度'
    },
    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'V2.0优先级，数字越大优先级越高'
    },
    // V2.0: 发送信息
    sender_email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: '发信人@发信服务域名'
    },
    recipient_email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'contact的email字段'
    },
    // V2.0: 邮件内容
    template_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'email_templates',
        key: 'id'
      }
    },
    rendered_subject: {
      type: DataTypes.STRING(500),
      allowNull: false,
      comment: '渲染后的主题'
    },
    rendered_body: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: '渲染后的内容'
    },
    // V2.0: 状态跟踪 (更新状态枚举)
    status: {
      type: DataTypes.ENUM('pending', 'allocated', 'sending', 'sent', 'delivered', 'bounced', 'opened', 'clicked', 'failed'),
      allowNull: false,
      defaultValue: 'pending'
    },
    sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    delivered_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    opened_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    clicked_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    tracking_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      comment: '邮件跟踪唯一标识'
    },
    // V2.0: 额外字段
    email_service_response: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: '发信服务返回的响应信息'
    },
    retry_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: '重试次数'
    },
    next_retry_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '下次重试时间'
    },
    tracking_data: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'V2.0跟踪数据：打开次数、点击链接等'
    }
  }, {
    sequelize,
    modelName: 'SubTask',
    tableName: 'sub_tasks',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['task_id']
      },
      {
        fields: ['status']
      },
      {
        fields: ['service_id'] // V2.0新增索引
      },
      {
        fields: ['scheduled_at'] // V2.0新增索引
      },
      {
        fields: ['priority'] // V2.0新增索引
      },
      {
        fields: ['tracking_id'],
        unique: true
      },
      {
        fields: ['created_at']
      }
    ]
  });

  SubTask.associate = (models) => {
    SubTask.belongsTo(models.Task, {
      foreignKey: 'task_id',
      as: 'task',
    });

    SubTask.belongsTo(models.Contact, {
      foreignKey: 'contact_id',
      as: 'contact',
    });

    SubTask.belongsTo(models.Template, {
      foreignKey: 'template_id',
      as: 'template',
    });

    // V2.0新增：发信服务关联
    SubTask.belongsTo(models.EmailService, {
      foreignKey: 'service_id',
      as: 'emailService',
    });
  };

  return SubTask;
};
