'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔧 创建任务等待监控表 - Phase 4.1');

    try {
      // 创建任务等待监控表
      await queryInterface.createTable('task_wait_metrics', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false
        },
        task_id: {
          type: Sequelize.UUID,
          allowNull: false,
          comment: '任务ID'
        },
        user_id: {
          type: Sequelize.UUID,
          allowNull: false,
          comment: '用户ID'
        },
        queue_entry_time: {
          type: Sequelize.DATE,
          allowNull: false,
          comment: '进入队列时间'
        },
        first_send_time: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: '首次发送时间'
        },
        wait_duration_seconds: {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: '等待时长（秒）'
        },
        status: {
          type: Sequelize.STRING(20),
          defaultValue: 'waiting',
          allowNull: false,
          comment: '状态: waiting, processing, completed'
        },
        created_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW,
          allowNull: false
        }
      });

      console.log('✅ task_wait_metrics 表创建成功');

      // 创建索引
      console.log('📊 创建索引...');

      try {
        await queryInterface.addIndex('task_wait_metrics', ['task_id'], {
          name: 'idx_task_wait_metrics_task_id'
        });
        console.log('✅ 创建 task_id 索引');
      } catch (error) {
        if (error.original && error.original.code === '42P07') {
          console.log('⚠️ 索引已存在: idx_task_wait_metrics_task_id');
        } else {
          throw error;
        }
      }

      try {
        await queryInterface.addIndex('task_wait_metrics', ['user_id'], {
          name: 'idx_task_wait_metrics_user_id'
        });
        console.log('✅ 创建 user_id 索引');
      } catch (error) {
        if (error.original && error.original.code === '42P07') {
          console.log('⚠️ 索引已存在: idx_task_wait_metrics_user_id');
        } else {
          throw error;
        }
      }

      try {
        await queryInterface.addIndex('task_wait_metrics', ['queue_entry_time'], {
          name: 'idx_task_wait_metrics_entry_time'
        });
        console.log('✅ 创建 queue_entry_time 索引');
      } catch (error) {
        if (error.original && error.original.code === '42P07') {
          console.log('⚠️ 索引已存在: idx_task_wait_metrics_entry_time');
        } else {
          throw error;
        }
      }

      try {
        await queryInterface.addIndex('task_wait_metrics', ['first_send_time'], {
          name: 'idx_task_wait_metrics_first_send'
        });
        console.log('✅ 创建 first_send_time 索引');
      } catch (error) {
        if (error.original && error.original.code === '42P07') {
          console.log('⚠️ 索引已存在: idx_task_wait_metrics_first_send');
        } else {
          throw error;
        }
      }

      try {
        await queryInterface.addIndex('task_wait_metrics', ['status', 'created_at'], {
          name: 'idx_task_wait_metrics_status_created'
        });
        console.log('✅ 创建 status_created 索引');
      } catch (error) {
        if (error.original && error.original.code === '42P07') {
          console.log('⚠️ 索引已存在: idx_task_wait_metrics_status_created');
        } else {
          throw error;
        }
      }

      try {
        await queryInterface.addIndex('task_wait_metrics', ['wait_duration_seconds'], {
          name: 'idx_task_wait_metrics_wait_duration'
        });
        console.log('✅ 创建 wait_duration 索引');
      } catch (error) {
        if (error.original && error.original.code === '42P07') {
          console.log('⚠️ 索引已存在: idx_task_wait_metrics_wait_duration');
        } else {
          throw error;
        }
      }

      console.log('✅ task_wait_metrics 索引创建成功');

      // 添加外键约束
      await queryInterface.addConstraint('task_wait_metrics', {
        fields: ['task_id'],
        type: 'foreign key',
        name: 'fk_task_wait_metrics_task_id',
        references: {
          table: 'tasks',
          field: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });

      await queryInterface.addConstraint('task_wait_metrics', {
        fields: ['user_id'],
        type: 'foreign key',
        name: 'fk_task_wait_metrics_user_id',
        references: {
          table: 'users',
          field: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });

      console.log('✅ task_wait_metrics 外键约束创建成功');

    } catch (error) {
      console.error('❌ task_wait_metrics 表创建失败:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 删除任务等待监控表');

    try {
      await queryInterface.dropTable('task_wait_metrics');
      console.log('✅ task_wait_metrics 表删除成功');
    } catch (error) {
      console.error('❌ task_wait_metrics 表删除失败:', error);
      throw error;
    }
  }
}; 