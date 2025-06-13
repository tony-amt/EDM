const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class UserQuotaLog extends Model {}

  UserQuotaLog.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    operation_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: [['allocate', 'deduct', 'refund', 'cancel']],
      },
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    balance_before: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    balance_after: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    task_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'tasks',
        key: 'id',
      },
      onDelete: 'SET NULL',
      comment: 'V3.0: 关联任务ID，替代campaign_id'
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'UserQuotaLog',
    tableName: 'user_quota_logs',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: 'idx_user_quota_logs_user_id',
        fields: ['user_id'],
      },
      {
        name: 'idx_user_quota_logs_task_id',
        fields: ['task_id'],
      },
      {
        name: 'idx_user_quota_logs_operation_type',
        fields: ['operation_type'],
      },
      {
        name: 'idx_user_quota_logs_created_at',
        fields: ['created_at'],
      },
    ],
  });

  UserQuotaLog.associate = (models) => {
    UserQuotaLog.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
    // Campaign模型已删除，移除关联
  };

  return UserQuotaLog;
}; 