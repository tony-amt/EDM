const { DataTypes, Model } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
  class User extends Model {
    async isValidPassword(password) {
      return bcrypt.compare(password, this.password_hash);
    }
  }

  User.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    username: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: {
        name: 'users_username_unique',
        msg: 'Username already in use!',
      },
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: {
        name: 'users_email_unique',
        msg: 'Email already in use!',
      },
      validate: {
        isEmail: {
          args: true,
          msg: 'Please provide a valid email address'
        }
      },
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'operator',
      validate: {
        isIn: [[ 'admin', 'operator', 'read_only' ]],
      },
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    remaining_quota: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    // created_at and updated_at are automatically handled by Sequelize (timestamps: true)
  }, {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
    underscored: true,
    hooks: {
      beforeCreate: async (user) => {
        if (user.password_hash) {
          const salt = await bcrypt.genSalt(10);
          user.password_hash = await bcrypt.hash(user.password_hash, salt);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password_hash') && user.password_hash) {
          const salt = await bcrypt.genSalt(10);
          user.password_hash = await bcrypt.hash(user.password_hash, salt);
        }
      },
    },
  });

  User.associate = (models) => {
    User.hasMany(models.Contact, {
      foreignKey: {
        name: 'user_id',
        allowNull: false,
      },
      as: 'contacts',
      onDelete: 'CASCADE',
    });
    User.hasMany(models.Tag, {
      foreignKey: {
        name: 'user_id',
        allowNull: false,
      },
      as: 'tags',
      onDelete: 'CASCADE',
    });
    User.hasMany(models.UserQuotaLog, {
      foreignKey: 'user_id',
      as: 'quotaLogs',
      onDelete: 'CASCADE',
    });
    // Add other associations here if User creates other models like Templates, Tasks etc.
  };

  return User;
}; 