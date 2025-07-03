'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🚀 Phase 4: 升级 sub_tasks 表结构');

    const transaction = await queryInterface.sequelize.transaction();

    try {
      // 1. 更改现有字段类型
      console.log('📝 更新现有字段类型...');

      // 将id从integer改为UUID
      await queryInterface.changeColumn('sub_tasks', 'id', {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      }, { transaction });

      // 将task_id从integer改为UUID  
      await queryInterface.changeColumn('sub_tasks', 'task_id', {
        type: Sequelize.UUID,
        allowNull: false
      }, { transaction });

      // 将service_id从integer改为UUID
      await queryInterface.changeColumn('sub_tasks', 'service_id', {
        type: Sequelize.UUID,
        allowNull: true
      }, { transaction });

      // 2. 添加Phase 4新字段
      console.log('➕ 添加Phase 4新字段...');

      await queryInterface.addColumn('sub_tasks', 'template_id', {
        type: Sequelize.UUID,
        allowNull: true // 暂时设为可空，稍后更新数据后改为不可空
      }, { transaction });

      await queryInterface.addColumn('sub_tasks', 'scheduled_at', {
        type: Sequelize.DATE,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('sub_tasks', 'allocated_quota', {
        type: Sequelize.INTEGER,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('sub_tasks', 'priority', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      }, { transaction });

      await queryInterface.addColumn('sub_tasks', 'sender_email', {
        type: Sequelize.STRING(255),
        allowNull: true // 暂时可空，稍后更新
      }, { transaction });

      await queryInterface.addColumn('sub_tasks', 'recipient_email', {
        type: Sequelize.STRING(255),
        allowNull: true // 暂时可空，稍后更新
      }, { transaction });

      await queryInterface.addColumn('sub_tasks', 'rendered_subject', {
        type: Sequelize.STRING(500),
        allowNull: true // 暂时可空，稍后更新
      }, { transaction });

      await queryInterface.addColumn('sub_tasks', 'rendered_body', {
        type: Sequelize.TEXT,
        allowNull: true // 暂时可空，稍后更新
      }, { transaction });

      await queryInterface.addColumn('sub_tasks', 'sent_at', {
        type: Sequelize.DATE,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('sub_tasks', 'delivered_at', {
        type: Sequelize.DATE,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('sub_tasks', 'opened_at', {
        type: Sequelize.DATE,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('sub_tasks', 'clicked_at', {
        type: Sequelize.DATE,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('sub_tasks', 'error_message', {
        type: Sequelize.TEXT,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('sub_tasks', 'tracking_id', {
        type: Sequelize.UUID,
        allowNull: true, // 暂时可空，稍后添加唯一约束
        unique: false
      }, { transaction });

      await queryInterface.addColumn('sub_tasks', 'email_service_response', {
        type: Sequelize.JSONB,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('sub_tasks', 'retry_count', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      }, { transaction });

      await queryInterface.addColumn('sub_tasks', 'next_retry_at', {
        type: Sequelize.DATE,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('sub_tasks', 'tracking_data', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {}
      }, { transaction });

      // 3. 更新status枚举以匹配Phase 4
      console.log('🔄 更新status枚举...');

      // 添加新的状态值
      await queryInterface.sequelize.query(
        "ALTER TYPE enum_sub_tasks_status ADD VALUE IF NOT EXISTS 'processing';",
        { transaction }
      );
      await queryInterface.sequelize.query(
        "ALTER TYPE enum_sub_tasks_status ADD VALUE IF NOT EXISTS 'failed';",
        { transaction }
      );
      await queryInterface.sequelize.query(
        "ALTER TYPE enum_sub_tasks_status ADD VALUE IF NOT EXISTS 'cancelled';",
        { transaction }
      );

      // 4. 创建新的索引
      console.log('📊 创建Phase 4索引...');

      await queryInterface.addIndex('sub_tasks', ['template_id'], {
        name: 'idx_sub_tasks_template_id',
        transaction
      });

      await queryInterface.addIndex('sub_tasks', ['scheduled_at'], {
        name: 'idx_sub_tasks_scheduled_at',
        transaction
      });

      await queryInterface.addIndex('sub_tasks', ['priority', 'status'], {
        name: 'idx_sub_tasks_priority_status',
        transaction
      });

      await queryInterface.addIndex('sub_tasks', ['sent_at'], {
        name: 'idx_sub_tasks_sent_at',
        transaction
      });

      await queryInterface.addIndex('sub_tasks', ['tracking_id'], {
        name: 'idx_sub_tasks_tracking_id',
        transaction
      });

      // 5. 设置默认值（为现有记录）
      console.log('🔧 设置现有记录的默认值...');

      // 为现有记录生成tracking_id
      await queryInterface.sequelize.query(
        `UPDATE sub_tasks SET tracking_id = gen_random_uuid() WHERE tracking_id IS NULL;`,
        { transaction }
      );

      // 为现有记录设置默认邮件内容（可以稍后通过API更新）
      await queryInterface.sequelize.query(
        `UPDATE sub_tasks SET 
          sender_email = 'noreply@tkmail.fun',
          recipient_email = COALESCE((SELECT email FROM contacts WHERE id = sub_tasks.contact_id), 'unknown@example.com'),
          rendered_subject = 'Default Subject',
          rendered_body = '<p>Default Email Body</p>'
        WHERE sender_email IS NULL;`,
        { transaction }
      );

      await transaction.commit();
      console.log('✅ Phase 4 sub_tasks 表升级完成');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Phase 4 sub_tasks 表升级失败:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 回滚 Phase 4 sub_tasks 表升级');

    const transaction = await queryInterface.sequelize.transaction();

    try {
      // 删除Phase 4添加的字段
      const fieldsToRemove = [
        'template_id', 'scheduled_at', 'allocated_quota', 'priority',
        'sender_email', 'recipient_email', 'rendered_subject', 'rendered_body',
        'sent_at', 'delivered_at', 'opened_at', 'clicked_at', 'error_message',
        'tracking_id', 'email_service_response', 'retry_count', 'next_retry_at',
        'tracking_data'
      ];

      for (const field of fieldsToRemove) {
        try {
          await queryInterface.removeColumn('sub_tasks', field, { transaction });
        } catch (error) {
          console.log(`⚠️ 字段 ${field} 可能不存在，跳过删除`);
        }
      }

      // 恢复原始字段类型（这步比较复杂，在实际环境中要谨慎）
      console.log('⚠️ 注意：字段类型回滚需要手动处理');

      await transaction.commit();
      console.log('✅ Phase 4 sub_tasks 表回滚完成');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Phase 4 sub_tasks 表回滚失败:', error);
      throw error;
    }
  }
}; 