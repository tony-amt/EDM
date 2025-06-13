const { DataTypes, Model, Sequelize } = require('sequelize');

module.exports = (sequelizeInstance) => {
  class Tag extends Model {}

  Tag.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    // user_id is defined by the association in User.associate
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    // parent_id is defined by the self-association below
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    contacts: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: '标签关联的联系人ID数组'
    },
    // created_at and updated_at are automatically handled
  }, {
    sequelize: sequelizeInstance,
    modelName: 'Tag',
    tableName: 'tags',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'name', 'parent_id'],
        name: 'tags_user_id_name_parent_id_unique',
        where: { parent_id: { [Sequelize.Op.ne]: null } }
      },
      {
        unique: true,
        fields: ['user_id', 'name'],
        name: 'tags_user_id_name_unique_for_null_parent',
        where: { parent_id: null } // For parent_id IS NULL
      }
    ],
    scopes: {
      async hasDescendants() {
        const TagModel = this;
        const descendants = await TagModel.findAll({
          where: { parent_id: { [Sequelize.Op.ne]: null } }
        });
        return descendants.length > 0;
      }
    },
  });

  Tag.associate = (models) => {
    Tag.belongsTo(models.User, {
      foreignKey: {
        name: 'user_id',
        allowNull: false,
      },
      as: 'user',
    });
    // 移除ContactTag关联，现在使用tags.contacts JSONB字段
    Tag.belongsTo(models.Tag, {
      as: 'parent',
      foreignKey: 'parent_id',
      allowNull: true,
      onDelete: 'SET NULL',
    });
    Tag.hasMany(models.Tag, {
      as: 'children',
      foreignKey: 'parent_id',
      useJunctionTable: false, // Important for self-referencing hasMany
    });
  };

  return Tag;
}; 