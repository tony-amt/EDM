module.exports = (sequelize, DataTypes) => {
  const UserQuotaLog = sequelize.define('UserQuotaLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    operation_type: {
      type: DataTypes.ENUM('increase', 'deduct', 'reset'),
      allowNull: false,
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    balance_before: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    balance_after: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    task_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // 移除不存在的字段：performed_by
  }, {
    tableName: 'user_quota_logs',
    timestamps: true,
    underscored: true,
  });

  UserQuotaLog.associate = (models) => {
    UserQuotaLog.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });

    UserQuotaLog.belongsTo(models.Task, {
      foreignKey: 'task_id',
      as: 'task'
    });
  };

  return UserQuotaLog;
}; 