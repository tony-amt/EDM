'use strict';
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const hashedPassword = await bcrypt.hash('admin123456', 10);
    return queryInterface.bulkInsert('users', [
      {
        id: uuidv4(),
        username: 'admin',
        email: 'admin@example.com',
        password_hash: hashedPassword,
        role: 'admin',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('users', { username: 'admin' });
  }
}; 