const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class EventLog extends Model {}

  EventLog.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    event_type: {
      type: DataTypes.ENUM('open', 'click', 'delivery_success', 'bounce', 'complaint', 'unsubscribe', 'send_attempt', 'failed_attempt'),
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
      comment: 'Event specific data like ip_address, user_agent, link_url etc.'
    },
    source: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'v2.0_tracking',
      comment: 'Event source identifier'
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    link_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    email_address: {
      type: DataTypes.STRING,
      allowNull: true, 
    },
    message_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    mail_service_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'email_services',
        key: 'id'
      }
    },
    provider_event_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    bounce_type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    bounce_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'EventLog',
    tableName: 'event_logs',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['task_contact_id'] },
      { fields: ['task_id'] },
      { fields: ['contact_id'] },
      { fields: ['event_type'] },
      { fields: ['email_address'] },
      { fields: ['message_id'] },
      { fields: ['provider_event_id'] },
      { fields: ['timestamp'] },
      { fields: ['source'] },
    ]
  });

  EventLog.associate = (models) => {
    EventLog.belongsTo(models.SubTask, {
      foreignKey: {
        name: 'task_contact_id',
        allowNull: true,
      },
      as: 'subTask',
    });
    
    EventLog.belongsTo(models.Task, {
      foreignKey: {
        name: 'task_id',
        allowNull: true, 
      },
      as: 'task',
    });
    
    EventLog.belongsTo(models.Contact, {
      foreignKey: {
        name: 'contact_id',
        allowNull: true,
      },
      as: 'contact',
    });
    
    EventLog.belongsTo(models.User, {
      foreignKey: {
        name: 'user_id',
        allowNull: true,
      },
      as: 'user',
    });
  };

  return EventLog;
}; 