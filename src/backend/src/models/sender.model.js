const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Sender = sequelize.define('Sender', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 64],
        is: /^[a-zA-Z0-9._-]+$/,
      },
    },
    display_name: {
      type: DataTypes.STRING(200),
      allowNull: true,
      validate: {
        len: [0, 200],
      },
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'senders',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['name', 'user_id'],
      },
      {
        fields: ['user_id'],
      },
      {
        fields: ['created_at'],
      },
    ],
  });

  return Sender;
}; 