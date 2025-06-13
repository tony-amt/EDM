const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class Contact extends Model {}

  Contact.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    company: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    position: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    username: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    first_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    last_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    tiktok_unique_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    instagram_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    youtube_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'pending', 'archived'),
      allowNull: false,
      defaultValue: 'pending',
    },
    custom_field_1: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    custom_field_2: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    custom_field_3: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    custom_field_4: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    custom_field_5: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    source: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    imported_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    tags: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: '联系人关联的标签ID数组'
    },
    // created_at and updated_at are automatically handled
  }, {
    sequelize,
    modelName: 'Contact',
    tableName: 'contacts',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'email'], // Ensure email is unique per user
        name: 'contacts_user_id_email_unique',
      },
    ],
  });

  Contact.associate = (models) => {
    Contact.belongsTo(models.User, {
      foreignKey: {
        name: 'user_id',
        allowNull: false,
      },
      as: 'user',
    });
    // 移除ContactTag关联，现在使用contacts.tags JSONB字段
  };

  return Contact;
}; 