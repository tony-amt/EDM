const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
const UserServiceMapping = sequelize.define('UserServiceMapping', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  service_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'email_services',
      key: 'id'
    }
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'user_service_mappings',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'service_id']
    }
  ]
});

// 定义关联关系
UserServiceMapping.associate = function(models) {
  // 用户服务关联属于用户
  UserServiceMapping.belongsTo(models.User, {
    foreignKey: 'user_id',
    as: 'user',
    onDelete: 'CASCADE'
  });
  
  // 用户服务关联属于发信服务
  UserServiceMapping.belongsTo(models.EmailService, {
    foreignKey: 'service_id',
    as: 'emailService',
    onDelete: 'CASCADE'
  });
};

  return UserServiceMapping;
}; 