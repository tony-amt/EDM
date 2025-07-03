/**
 * 告警规则模型
 * 用于定义各种告警条件和通知配置
 */
module.exports = (sequelize, DataTypes) => {
  const AlertRules = sequelize.define('AlertRules', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    rule_name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      unique: true
    },
    metric_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    condition_operator: {
      type: DataTypes.ENUM('>', '<', '>=', '<=', '=', '!='),
      allowNull: false
    },
    threshold_value: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false
    },
    severity: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
      allowNull: false,
      defaultValue: 'medium'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    notification_config: {
      type: DataTypes.JSONB,
      allowNull: true
    }
  }, {
    tableName: 'alert_rules',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true
  });

  // 定义关联关系
  AlertRules.associate = (models) => {
    AlertRules.hasMany(models.AlertHistory, {
      foreignKey: 'rule_id',
      as: 'alertHistory'
    });
  };

  return AlertRules;
}; 