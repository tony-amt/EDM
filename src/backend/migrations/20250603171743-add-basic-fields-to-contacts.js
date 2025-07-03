'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('contacts', 'name', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    
    await queryInterface.addColumn('contacts', 'phone', {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
    
    await queryInterface.addColumn('contacts', 'company', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    
    await queryInterface.addColumn('contacts', 'position', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('contacts', 'name');
    await queryInterface.removeColumn('contacts', 'phone');
    await queryInterface.removeColumn('contacts', 'company');
    await queryInterface.removeColumn('contacts', 'position');
  }
};
