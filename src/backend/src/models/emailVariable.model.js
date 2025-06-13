const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class EmailVariable extends Model {}

  EmailVariable.init({
    id: { // API spec uses {variable_id_or_key} in path, so a UUID id might be good.
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    variable_key: { // e.g., "contact.first_name"
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true, // Key must be unique
    },
    display_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    source_type: { // CONTACT_FIELD, SYSTEM, CUSTOM_GENERATOR etc.
      type: DataTypes.ENUM('CONTACT_FIELD', 'SYSTEM', 'CUSTOM_GENERATOR', 'USER_DEFINED'), // Extend as needed
      allowNull: false,
    },
    source_details: { // JSONB to store specifics like field_name for CONTACT_FIELD
      type: DataTypes.JSONB,
      allowNull: true,
      /* Example for CONTACT_FIELD: {"field_name": "first_name"}
         Example for SYSTEM: {"generator": "current_year"} */
    },
    is_system_defined: { // To distinguish from user-added variables, if any
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    // user_id if variables can be user-specific (not in current API spec for creation)
  }, {
    sequelize,
    modelName: 'EmailVariable',
    tableName: 'email_variables',
    timestamps: true,
    underscored: true,
  });

  EmailVariable.associate = (models) => {
    // No direct associations in current API spec, but could link to User if admin-only creation.
  };

  return EmailVariable;
}; 