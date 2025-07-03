module.exports = (sequelize, DataTypes) => {
  const EmailVariable = sequelize.define('EmailVariable', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    default_value: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_system: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
  }, {
    tableName: 'email_variables',
    timestamps: true,
    underscored: true,
  });

  EmailVariable.associate = (models) => {
    // Variables can be used in templates, tasks, etc.
  };

  return EmailVariable;
}; 