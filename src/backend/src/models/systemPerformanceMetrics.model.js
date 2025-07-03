/**
 * 系统性能指标模型
 * 用于监控系统整体性能
 */
module.exports = (sequelize, DataTypes) => {
  const SystemPerformanceMetrics = sequelize.define('SystemPerformanceMetrics', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    metric_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    metric_value: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false
    },
    metric_unit: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    service_name: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    additional_info: {
      type: DataTypes.JSONB,
      allowNull: true
    }
  }, {
    tableName: 'system_performance_metrics',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true
  });

  return SystemPerformanceMetrics;
}; 