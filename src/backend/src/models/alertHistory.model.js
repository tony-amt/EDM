/**
 * 告警历史模型
 * 用于记录所有告警事件的历史
 */
module.exports = (sequelize, DataTypes) => {
  const AlertHistory = sequelize.define('AlertHistory', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    rule_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'alert_rules',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    triggered_value: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false
    },
    severity: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    resolved_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    resolution_notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'alert_histories',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true
  });

  // 定义关联关系
  AlertHistory.associate = (models) => {
    AlertHistory.belongsTo(models.AlertRules, {
      foreignKey: 'rule_id',
      as: 'alertRule'
    });
  };

  return AlertHistory;
}; 