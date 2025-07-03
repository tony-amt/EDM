module.exports = (sequelize, DataTypes) => {
  const EventLog = sequelize.define('EventLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    event_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    payload: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    source: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    email_address: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    message_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    mail_service_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    provider_event_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    bounce_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    bounce_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    task_contact_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    task_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    contact_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  }, {
    tableName: 'event_logs',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['event_type']
      },
      {
        fields: ['created_at']
      },
      {
        fields: ['message_id']
      },
      {
        fields: ['task_id']
      },
      {
        fields: ['task_contact_id']
      },
      {
        fields: ['contact_id']
      },
      {
        fields: ['email_address']
      },
      {
        fields: ['source']
      },
      {
        fields: ['timestamp']
      }
    ]
  });

  EventLog.associate = (models) => {
    EventLog.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
    EventLog.belongsTo(models.Task, {
      foreignKey: 'task_id',
      as: 'task'
    });
    EventLog.belongsTo(models.SubTask, {
      foreignKey: 'task_contact_id',
      as: 'subTask'
    });
    EventLog.belongsTo(models.Contact, {
      foreignKey: 'contact_id',
      as: 'contact'
    });
    EventLog.belongsTo(models.EmailService, {
      foreignKey: 'mail_service_id',
      as: 'emailService'
    });
  };

  return EventLog;
}; 