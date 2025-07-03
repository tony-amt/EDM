'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // 1. 创建任务处理监控表
      await queryInterface.createTable('task_processing_metrics', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        task_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'tasks',
            key: 'id'
          },
          onDelete: 'CASCADE'
        },
        user_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          },
          onDelete: 'CASCADE'
        },
        metric_type: {
          type: Sequelize.ENUM('created', 'first_sent', 'progress', 'completed', 'failed'),
          allowNull: false
        },
        timestamp: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        },
        subtasks_sent: {
          type: Sequelize.INTEGER,
          defaultValue: 0,
          validate: {
            min: 0
          }
        },
        total_subtasks: {
          type: Sequelize.INTEGER,
          defaultValue: 0,
          validate: {
            min: 0
          }
        },
        wait_time_seconds: {
          type: Sequelize.INTEGER,
          defaultValue: 0,
          validate: {
            min: 0
          }
        },
        throughput_per_hour: {
          type: Sequelize.DECIMAL(10, 2),
          defaultValue: 0,
          validate: {
            min: 0
          }
        },
        metadata: {
          type: Sequelize.JSONB,
          defaultValue: {}
        },
        created_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // 创建任务监控表索引
      await queryInterface.addIndex('task_processing_metrics', ['task_id', 'timestamp'], {
        name: 'idx_task_metrics_task_time',
        transaction
      });
      await queryInterface.addIndex('task_processing_metrics', ['user_id', 'timestamp'], {
        name: 'idx_task_metrics_user_time',
        transaction
      });
      await queryInterface.addIndex('task_processing_metrics', ['metric_type', 'timestamp'], {
        name: 'idx_task_metrics_type_time',
        transaction
      });

      // 2. 创建系统性能监控表
      await queryInterface.createTable('system_performance_metrics', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        metric_name: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        metric_value: {
          type: Sequelize.DECIMAL(12, 4),
          allowNull: false
        },
        metric_unit: {
          type: Sequelize.STRING(20),
          defaultValue: ''
        },
        tags: {
          type: Sequelize.JSONB,
          defaultValue: {}
        },
        timestamp: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        },
        created_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // 创建系统性能监控表索引
      await queryInterface.addIndex('system_performance_metrics', ['metric_name', 'timestamp'], {
        name: 'idx_perf_metrics_name_time',
        transaction
      });
      await queryInterface.addIndex('system_performance_metrics', ['tags'], {
        name: 'idx_perf_metrics_tags',
        using: 'gin',
        transaction
      });

      // 3. 创建告警规则表
      await queryInterface.createTable('alert_rules', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        name: {
          type: Sequelize.STRING(100),
          allowNull: false,
          unique: true
        },
        description: {
          type: Sequelize.TEXT
        },
        metric_name: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        condition_type: {
          type: Sequelize.ENUM('threshold', 'rate', 'absence'),
          defaultValue: 'threshold'
        },
        threshold_value: {
          type: Sequelize.DECIMAL(12, 4)
        },
        comparison_operator: {
          type: Sequelize.ENUM('>', '<', '>=', '<=', '=', '!='),
          allowNull: false
        },
        time_window_minutes: {
          type: Sequelize.INTEGER,
          defaultValue: 5,
          validate: {
            min: 1
          }
        },
        severity: {
          type: Sequelize.ENUM('info', 'warning', 'critical'),
          defaultValue: 'warning'
        },
        notification_channels: {
          type: Sequelize.JSONB,
          defaultValue: []
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          defaultValue: true
        },
        created_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // 创建告警规则表索引
      await queryInterface.addIndex('alert_rules', ['is_active'], {
        name: 'idx_alert_rules_active',
        transaction
      });
      await queryInterface.addIndex('alert_rules', ['metric_name'], {
        name: 'idx_alert_rules_metric',
        transaction
      });

      // 4. 创建告警历史表
      await queryInterface.createTable('alert_history', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        rule_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'alert_rules',
            key: 'id'
          },
          onDelete: 'CASCADE'
        },
        triggered_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        },
        resolved_at: {
          type: Sequelize.DATE,
          allowNull: true
        },
        status: {
          type: Sequelize.ENUM('active', 'resolved', 'suppressed'),
          defaultValue: 'active'
        },
        trigger_value: {
          type: Sequelize.DECIMAL(12, 4)
        },
        message: {
          type: Sequelize.TEXT
        },
        metadata: {
          type: Sequelize.JSONB,
          defaultValue: {}
        },
        created_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // 创建告警历史表索引
      await queryInterface.addIndex('alert_history', ['rule_id'], {
        name: 'idx_alert_history_rule',
        transaction
      });
      await queryInterface.addIndex('alert_history', ['status'], {
        name: 'idx_alert_history_status',
        transaction
      });
      await queryInterface.addIndex('alert_history', ['triggered_at'], {
        name: 'idx_alert_history_triggered',
        transaction
      });

      // 5. 创建服务预留表
      await queryInterface.createTable('service_reservations', {
        service_id: {
          type: Sequelize.UUID,
          primaryKey: true,
          references: {
            model: 'email_services',
            key: 'id'
          },
          onDelete: 'CASCADE'
        },
        reserved_by: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        subtask_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'sub_tasks',
            key: 'id'
          },
          onDelete: 'CASCADE'
        },
        reserved_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        },
        expires_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal("NOW() + INTERVAL '30 seconds'")
        }
      }, { transaction });

      // 创建服务预留表索引
      await queryInterface.addIndex('service_reservations', ['expires_at'], {
        name: 'idx_service_reservations_expires',
        transaction
      });
      await queryInterface.addIndex('service_reservations', ['reserved_by'], {
        name: 'idx_service_reservations_reserved_by',
        transaction
      });

      // 插入默认告警规则
      await queryInterface.bulkInsert('alert_rules', [
        {
          id: Sequelize.UUIDV4,
          name: '任务卡顿告警',
          description: '检测10分钟无进展的任务',
          metric_name: 'task_stuck_duration',
          condition_type: 'threshold',
          threshold_value: 600,
          comparison_operator: '>=',
          time_window_minutes: 10,
          severity: 'warning',
          notification_channels: JSON.stringify([{
            type: 'email',
            config: { recipients: ['admin@example.com'] }
          }]),
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: Sequelize.UUIDV4,
          name: '高错误率告警',
          description: '系统错误率超过5%',
          metric_name: 'api_error_rate',
          condition_type: 'threshold',
          threshold_value: 5,
          comparison_operator: '>',
          time_window_minutes: 5,
          severity: 'critical',
          notification_channels: JSON.stringify([{
            type: 'email',
            config: { recipients: ['admin@example.com'] }
          }]),
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: Sequelize.UUIDV4,
          name: '低吞吐量告警',
          description: '队列处理吞吐量过低',
          metric_name: 'queue_throughput',
          condition_type: 'threshold',
          threshold_value: 100,
          comparison_operator: '<',
          time_window_minutes: 15,
          severity: 'warning',
          notification_channels: JSON.stringify([{
            type: 'email',
            config: { recipients: ['admin@example.com'] }
          }]),
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: Sequelize.UUIDV4,
          name: '服务不可用告警',
          description: '可用邮件服务过少',
          metric_name: 'available_services_count',
          condition_type: 'threshold',
          threshold_value: 5,
          comparison_operator: '<',
          time_window_minutes: 5,
          severity: 'critical',
          notification_channels: JSON.stringify([{
            type: 'email',
            config: { recipients: ['admin@example.com'] }
          }]),
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      ], { transaction });

      await transaction.commit();
      console.log('✅ 监控系统数据库表创建成功');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ 监控系统数据库表创建失败:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // 按依赖关系逆序删除表
      await queryInterface.dropTable('alert_history', { transaction });
      await queryInterface.dropTable('service_reservations', { transaction });
      await queryInterface.dropTable('alert_rules', { transaction });
      await queryInterface.dropTable('system_performance_metrics', { transaction });
      await queryInterface.dropTable('task_processing_metrics', { transaction });

      // 删除枚举类型
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_task_processing_metrics_metric_type"', { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_alert_rules_condition_type"', { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_alert_rules_comparison_operator"', { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_alert_rules_severity"', { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_alert_history_status"', { transaction });

      await transaction.commit();
      console.log('✅ 监控系统数据库表回滚成功');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ 监控系统数据库表回滚失败:', error);
      throw error;
    }
  }
}; 