const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ServiceStatusLog = sequelize.define('ServiceStatusLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    service_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'email_services',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    status_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: [['enabled', 'disabled', 'frozen', 'quota_reset', 'config_update']],
      },
    },
    old_value: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    new_value: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    reason: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    operator_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'SET NULL',
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'service_status_logs',
    timestamps: false,
    indexes: [
      {
        fields: ['service_id'],
      },
      {
        fields: ['status_type'],
      },
      {
        fields: ['created_at'],
      },
    ],
  });

  return ServiceStatusLog;
}; 