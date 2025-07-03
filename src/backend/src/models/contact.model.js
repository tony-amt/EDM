module.exports = (sequelize, DataTypes) => {
  const Contact = sequelize.define('Contact', {
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
  }, {
    tableName: 'contacts',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'email'],
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
  };

  return Contact;
}; 