/**
 * 任务处理指标模型
 * 用于监控任务处理状态和性能
 */
module.exports = (sequelize, DataTypes) => {
  const TaskProcessingMetrics = sequelize.define('TaskProcessingMetrics', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    task_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'tasks',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    total_emails: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    sent_emails: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    failed_emails: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    processing_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    avg_send_time: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true
    },
    current_status: {
      type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'paused'),
      allowNull: false,
      defaultValue: 'pending'
    },
    bottleneck_info: {
      type: DataTypes.JSONB,
      allowNull: true
    }
  }, {
    tableName: 'task_processing_metrics',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true
  });

  // 定义关联关系
  TaskProcessingMetrics.associate = (models) => {
    TaskProcessingMetrics.belongsTo(models.Task, {
      foreignKey: 'task_id',
      as: 'task'
    });
  };

  return TaskProcessingMetrics;
}; 