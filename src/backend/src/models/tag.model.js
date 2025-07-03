module.exports = (sequelize, DataTypes) => {
  const Tag = sequelize.define('Tag', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    parent_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    color: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: '#007bff',
    },
    contacts: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: '标签关联的联系人ID数组'
    },
  }, {
    tableName: 'tags',
    timestamps: true,
    underscored: true,
  });

  Tag.associate = (models) => {
    Tag.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
    Tag.belongsTo(models.Tag, {
      as: 'parent',
      foreignKey: 'parent_id',
    });
    Tag.hasMany(models.Tag, {
      as: 'children',
      foreignKey: 'parent_id',
    });
  };

  return Tag;
};
