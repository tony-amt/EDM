const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  // Changed class name to EmailTemplate for clarity, though modelName will be 'Template' if file is template.model.js
  // For consistency with other new models, should be EmailTemplate if we rename the file.
  // If keeping template.model.js, then class should be Template and modelName 'Template'
  class Template extends Model {} 

  Template.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING,
      defaultValue: ''
    },
    subject: { // As per API spec
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    body: { // API spec uses 'body' for HTML content, was htmlContent
      type: DataTypes.TEXT,
      allowNull: false,
    },
    previewText: {
      type: DataTypes.STRING,
      defaultValue: ''
    },
    variables: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    isAiGenerated: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    aiPrompt: {
      type: DataTypes.TEXT,
      defaultValue: ''
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id'
    },
    links: { // Stores mapping of unique_id to original_url for trackable links
        type: DataTypes.JSONB,
        allowNull: true, // Can be null if no links are tracked or pre-processed
        defaultValue: {},
    },
  }, {
    sequelize,
    modelName: 'Template', // If file remains template.model.js, this should be Template
    tableName: 'email_templates', // Explicitly set table name to avoid issues with model name vs file name
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ['name', 'user_id'] }
    ]
  });

  Template.associate = (models) => {
    Template.belongsTo(models.User, {
      foreignKey: {
        name: 'user_id',
        allowNull: false,
      },
      as: 'user',
    });
    
    // V3.0: 不再使用TaskTemplate关联表
    // 模板关系通过task.templates JSONB字段管理
  };

  return Template;
}; 