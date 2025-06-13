const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class EmailRoute extends Model {}

  EmailRoute.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    domain_name: { // e.g., "example.com"
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true, // Usually one route configuration per domain
    },
    type: { // API, SMTP_RELAY, etc.
      type: DataTypes.ENUM('SMTP_RELAY', 'API_ENDPOINT', 'LOCAL_MTA'), // Extend as needed
      allowNull: false,
    },
    priority: { // For multiple routes of the same type, or fallback
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    config: { // JSONB for type-specific configuration
      type: DataTypes.JSONB,
      allowNull: false,
      /* Examples:
         SMTP_RELAY: {"host": "...", "port": 587, "username": "...", "password_ref": "...", "security": "TLS"}
         API_ENDPOINT: {"url": "...", "api_key_ref": "..."}
      */
    },
    is_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    // user_id for ownership if routes are user-specific (API spec implies admin-level config)
    // For now, assuming global/admin configuration.
  }, {
    sequelize,
    modelName: 'EmailRoute',
    tableName: 'email_routes',
    timestamps: true,
    underscored: true,
  });

  EmailRoute.associate = (models) => {
    // May associate with User if admin users manage these.
    // EmailRoute.belongsTo(models.User, { foreignKey: 'created_by_id', as: 'createdBy' });
  };

  return EmailRoute;
}; 