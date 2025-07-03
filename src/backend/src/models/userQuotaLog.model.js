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
      type: DataTypes.ENUM('increase', 'decrease', 'reset'),
      allowNull: false,
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    reason: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    performed_by: {
      type: DataTypes.UUID,
      allowNull: true,
    },
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
  };

  return UserQuotaLog;
};
