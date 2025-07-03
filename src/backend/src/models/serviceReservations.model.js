/**
 * 服务预留模型
 * 用于防止邮件服务的并发竞争，确保原子性分配
 */
module.exports = (sequelize, DataTypes) => {
  const ServiceReservations = sequelize.define('ServiceReservations', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    service_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'email_services',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
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
    reserved_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('active', 'expired', 'released'),
      allowNull: false,
      defaultValue: 'active'
    }
  }, {
    tableName: 'service_reservations',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true
  });

  // 定义关联关系
  ServiceReservations.associate = (models) => {
    ServiceReservations.belongsTo(models.EmailService, {
      foreignKey: 'service_id',
      as: 'emailService'
    });

    ServiceReservations.belongsTo(models.Task, {
      foreignKey: 'task_id',
      as: 'task'
    });
  };

  return ServiceReservations;
}; 