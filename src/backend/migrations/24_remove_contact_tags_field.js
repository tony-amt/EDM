'use strict';

/**
 * Phase 4.2: 移除contact.tags字段迁移
 * 
 * 背景：
 * - 在Phase 3标签系统优化中，我们已经将标签数据迁移到tag.contacts字段
 * - contact.tags字段现在是冗余的双写字段，需要安全移除
 * - 此迁移将备份数据，然后移除字段和相关索引
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 开始Phase 4.2: 移除contact.tags字段迁移...');

      // 1. 检查contact.tags字段是否存在
      const tableDescription = await queryInterface.describeTable('contacts');
      const hasTagsField = tableDescription.hasOwnProperty('tags');

      if (!hasTagsField) {
        console.log('✅ contact.tags字段不存在，跳过迁移');
        await transaction.commit();
        return;
      }

      // 2. 备份现有的contact.tags数据（如果有数据）
      console.log('📋 检查并备份现有contact.tags数据...');

      const contactsWithTags = await queryInterface.sequelize.query(
        'SELECT COUNT(*) as count FROM contacts WHERE tags IS NOT NULL AND tags != \'[]\'::jsonb',
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );

      const tagCount = contactsWithTags[0].count;
      console.log(`发现 ${tagCount} 个联系人有tags数据`);

      if (tagCount > 0) {
        // 创建备份表
        console.log('💾 创建contact_tags_backup表...');
        await queryInterface.createTable('contact_tags_backup', {
          id: {
            type: Sequelize.UUID,
            primaryKey: true
          },
          contact_id: {
            type: Sequelize.UUID,
            allowNull: false
          },
          tags: {
            type: Sequelize.JSONB,
            allowNull: true
          },
          backed_up_at: {
            type: Sequelize.DATE,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
          }
        }, { transaction });

        // 备份数据
        await queryInterface.sequelize.query(`
          INSERT INTO contact_tags_backup (id, contact_id, tags, backed_up_at)
          SELECT gen_random_uuid(), id, tags, CURRENT_TIMESTAMP
          FROM contacts 
          WHERE tags IS NOT NULL AND tags != '[]'::jsonb
        `, { transaction });

        console.log(`✅ 已备份 ${tagCount} 个联系人的tags数据到contact_tags_backup表`);
      }

      // 3. 验证标签数据已正确迁移到tag.contacts
      console.log('🔍 验证标签数据迁移状态...');

      const tagContacts = await queryInterface.sequelize.query(
        'SELECT COUNT(*) as count FROM tags WHERE contacts IS NOT NULL AND jsonb_array_length(contacts) > 0',
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );

      const migratedTagCount = tagContacts[0].count;
      console.log(`发现 ${migratedTagCount} 个标签包含联系人数据`);

      if (migratedTagCount === 0 && tagCount > 0) {
        console.warn('⚠️ 警告：contact.tags有数据但tag.contacts为空，请检查数据迁移状态');
        // 不阻止迁移，因为可能是测试环境或数据已清理
      }

      // 4. 移除contact.tags字段的索引（如果存在）
      console.log('🗑️ 移除contact.tags相关索引...');

      try {
        await queryInterface.removeIndex('contacts', 'idx_contacts_tags', { transaction });
        console.log('✅ 已移除idx_contacts_tags索引');
      } catch (error) {
        if (error.message.includes('does not exist')) {
          console.log('ℹ️ idx_contacts_tags索引不存在，跳过');
        } else {
          console.warn('⚠️ 移除idx_contacts_tags索引失败:', error.message);
        }
      }

      // 5. 移除contact.tags字段
      console.log('🗑️ 移除contact.tags字段...');
      await queryInterface.removeColumn('contacts', 'tags', { transaction });
      console.log('✅ 已移除contact.tags字段');

      // 6. 记录迁移完成信息
      await queryInterface.sequelize.query(`
        INSERT INTO system_configs (key, value, category, description, created_at, updated_at)
        VALUES (
          'contact_tags_removal_completed',
          '{"completed_at": "${new Date().toISOString()}", "backup_count": ${tagCount}}',
          'migration',
          'Phase 4.2: contact.tags字段移除完成记录',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = CURRENT_TIMESTAMP
      `, { transaction });

      await transaction.commit();
      console.log('🎉 Phase 4.2: contact.tags字段移除迁移完成!');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Phase 4.2迁移失败:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 开始回滚Phase 4.2: 恢复contact.tags字段...');

      // 1. 重新添加contact.tags字段
      await queryInterface.addColumn('contacts', 'tags', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null
      }, { transaction });

      // 2. 恢复备份数据（如果存在）
      const backupTableExists = await queryInterface.sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'contact_tags_backup'
        )
      `, { type: Sequelize.QueryTypes.SELECT, transaction });

      if (backupTableExists[0].exists) {
        console.log('📋 从备份表恢复数据...');

        await queryInterface.sequelize.query(`
          UPDATE contacts 
          SET tags = backup.tags
          FROM contact_tags_backup backup
          WHERE contacts.id = backup.contact_id
        `, { transaction });

        console.log('✅ 已从备份恢复contact.tags数据');
      }

      // 3. 重新创建索引
      await queryInterface.addIndex('contacts', ['tags'], {
        name: 'idx_contacts_tags',
        using: 'gin',
        transaction
      });

      // 4. 移除迁移记录
      await queryInterface.sequelize.query(`
        DELETE FROM system_configs 
        WHERE key = 'contact_tags_removal_completed'
      `, { transaction });

      await transaction.commit();
      console.log('✅ Phase 4.2回滚完成: contact.tags字段已恢复');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Phase 4.2回滚失败:', error);
      throw error;
    }
  }
}; 