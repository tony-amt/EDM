/**
 * EmailServiceResponse 模型
 * 记录邮件服务的发送响应和状态
 */

module.exports = (sequelize, DataTypes) => {
  const EmailServiceResponse = sequelize.define('EmailServiceResponse', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    sub_task_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'sub_tasks',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    request_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: '请求ID，用于追踪'
    },
    service_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: '邮件服务名称'
    },
    domain: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: '发送域名'
    },
    success: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: '是否发送成功'
    },
    status_code: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'HTTP状态码'
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '请求耗时（毫秒）'
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
      comment: '响应时间戳'
    },
    api_call: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'API调用类型'
    },
    request_data: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: '请求数据'
    },
    response_data: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: '响应数据'
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '错误信息'
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'email_service_response',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['sub_task_id']
      },
      {
        fields: ['success']
      },
      {
        fields: ['timestamp']
      },
      {
        fields: ['service_name']
      }
    ]
  });

  EmailServiceResponse.associate = function(models) {
    // 关联到SubTask
    EmailServiceResponse.belongsTo(models.SubTask, {
      foreignKey: 'sub_task_id',
      as: 'subTask',
      onDelete: 'CASCADE'
    });
  };

  return EmailServiceResponse;
}; 