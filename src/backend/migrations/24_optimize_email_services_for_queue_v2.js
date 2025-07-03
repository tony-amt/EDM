'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔧 开始优化EmailService表结构 - Phase 4.1');

    try {
      // 1. 移除旧的冻结相关字段
      console.log('📊 移除冻结相关字段...');

      // 检查字段是否存在再删除
      const tableDescription = await queryInterface.describeTable('email_services');

      if (tableDescription.is_frozen) {
        await queryInterface.removeColumn('email_services', 'is_frozen');
        console.log('✅ 移除 is_frozen 字段');
      }

      if (tableDescription.frozen_until) {
        await queryInterface.removeColumn('email_services', 'frozen_until');
        console.log('✅ 移除 frozen_until 字段');
      }

      // 2. 添加预计算字段
      console.log('📊 添加预计算字段...');

      if (!tableDescription.last_sent_at) {
        await queryInterface.addColumn('email_services', 'last_sent_at', {
          type: Sequelize.DATE,
          allowNull: true,
          comment: '最后发送时间'
        });
        console.log('✅ 添加 last_sent_at 字段');
      }

      if (!tableDescription.next_available_at) {
        await queryInterface.addColumn('email_services', 'next_available_at', {
          type: Sequelize.DATE,
          allowNull: true,
          comment: '下次可用时间（预计算）'
        });
        console.log('✅ 添加 next_available_at 字段');
      }

      if (!tableDescription.total_sent) {
        await queryInterface.addColumn('email_services', 'total_sent', {
          type: Sequelize.INTEGER,
          defaultValue: 0,
          allowNull: false,
          comment: '总发送数量'
        });
        console.log('✅ 添加 total_sent 字段');
      }

      if (!tableDescription.success_rate) {
        await queryInterface.addColumn('email_services', 'success_rate', {
          type: Sequelize.DECIMAL(5, 2),
          defaultValue: 100.00,
          allowNull: false,
          comment: '成功率百分比'
        });
        console.log('✅ 添加 success_rate 字段');
      }

      if (!tableDescription.avg_response_time) {
        await queryInterface.addColumn('email_services', 'avg_response_time', {
          type: Sequelize.INTEGER,
          defaultValue: 0,
          allowNull: false,
          comment: '平均响应时间（毫秒）'
        });
        console.log('✅ 添加 avg_response_time 字段');
      }

      // 3. 创建高效索引
      console.log('📊 创建高效索引...');

      try {
        await queryInterface.addIndex('email_services',
          ['next_available_at', 'is_enabled'],
          {
            name: 'idx_email_services_next_available_enabled',
            where: {
              is_enabled: true
            }
          }
        );
        console.log('✅ 创建 next_available_at + is_enabled 索引');
      } catch (error) {
        console.log('⚠️ 索引可能已存在:', error.message);
      }

      try {
        await queryInterface.addIndex('email_services',
          ['used_quota', 'daily_quota'],
          {
            name: 'idx_email_services_quota'
          }
        );
        console.log('✅ 创建配额相关索引');
      } catch (error) {
        console.log('⚠️ 索引可能已存在:', error.message);
      }

      // 4. 更新现有数据
      console.log('📊 更新现有数据...');

      await queryInterface.sequelize.query(`
        UPDATE email_services 
        SET 
          total_sent = COALESCE(used_quota, 0),
          success_rate = 100.00,
          avg_response_time = 0
        WHERE total_sent = 0
      `);

      console.log('✅ EmailService表结构优化完成');

    } catch (error) {
      console.error('❌ EmailService表结构优化失败:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 回滚EmailService表结构优化');

    try {
      // 移除新增字段
      await queryInterface.removeColumn('email_services', 'last_sent_at');
      await queryInterface.removeColumn('email_services', 'next_available_at');
      await queryInterface.removeColumn('email_services', 'total_sent');
      await queryInterface.removeColumn('email_services', 'success_rate');
      await queryInterface.removeColumn('email_services', 'avg_response_time');

      // 移除索引
      await queryInterface.removeIndex('email_services', 'idx_email_services_next_available_enabled');
      await queryInterface.removeIndex('email_services', 'idx_email_services_quota');

      // 恢复冻结字段
      await queryInterface.addColumn('email_services', 'is_frozen', {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      });

      await queryInterface.addColumn('email_services', 'frozen_until', {
        type: Sequelize.DATE,
        allowNull: true
      });

      console.log('✅ 回滚完成');

    } catch (error) {
      console.error('❌ 回滚失败:', error);
      throw error;
    }
  }
}; 