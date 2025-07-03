/**
 * 配置分类模型
 * Phase 2: 配置管理系统
 */

module.exports = (sequelize, DataTypes) => {
  const ConfigCategory = sequelize.define('ConfigCategory', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    categoryName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      field: 'category_name',
      comment: '分类名称'
    },
    categoryDisplayName: {
      type: DataTypes.STRING(200),
      allowNull: false,
      field: 'category_display_name',
      comment: '显示名称'
    },
    categoryDescription: {
      type: DataTypes.TEXT,
      field: 'category_description',
      comment: '分类描述'
    },
    categoryIcon: {
      type: DataTypes.STRING(100),
      field: 'category_icon',
      comment: '分类图标'
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'sort_order',
      comment: '排序顺序'
    },
    parentCategoryId: {
      type: DataTypes.UUID,
      field: 'parent_category_id',
      references: {
        model: 'config_categories',
        key: 'id'
      },
      comment: '父分类ID'
    },
    isSystem: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_system',
      comment: '系统分类(不可删除)'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active',
      comment: '是否激活'
    }
  }, {
    tableName: 'config_categories',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['is_active']
      },
      {
        fields: ['parent_category_id']
      },
      {
        fields: ['sort_order']
      },
      {
        fields: ['category_name']
      }
    ]
  });

  // 关联关系
  ConfigCategory.associate = function (models) {
    // 自关联 - 父子分类
    ConfigCategory.belongsTo(ConfigCategory, {
      foreignKey: 'parentCategoryId',
      as: 'parentCategory'
    });

    ConfigCategory.hasMany(ConfigCategory, {
      foreignKey: 'parentCategoryId',
      as: 'childCategories'
    });
  };

  // 类方法
  ConfigCategory.getActiveCategories = async function () {
    return await this.findAll({
      where: { isActive: true },
      order: [['sortOrder', 'ASC'], ['categoryDisplayName', 'ASC']]
    });
  };

  ConfigCategory.getCategoryTree = async function () {
    const categories = await this.findAll({
      where: { isActive: true },
      order: [['sortOrder', 'ASC']]
    });

    // 构建树形结构
    const categoryMap = new Map();
    const rootCategories = [];

    // 第一遍：创建映射
    categories.forEach(category => {
      categoryMap.set(category.id, {
        ...category.toJSON(),
        children: []
      });
    });

    // 第二遍：构建树形结构
    categories.forEach(category => {
      const categoryData = categoryMap.get(category.id);
      if (category.parentCategoryId) {
        const parent = categoryMap.get(category.parentCategoryId);
        if (parent) {
          parent.children.push(categoryData);
        }
      } else {
        rootCategories.push(categoryData);
      }
    });

    return rootCategories;
  };

  return ConfigCategory;
}; 