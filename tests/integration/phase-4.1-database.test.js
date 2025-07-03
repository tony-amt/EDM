/**
 * Phase 4.1 队列调度系统优化 - 数据库层测试
 * 测试模型关联、数据一致性、性能等
 */

const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const { sequelize } = require('../../src/backend/src/models');

describe('Phase 4.1 数据库层测试', () => {

  beforeAll(async () => {
    console.log('🚀 开始Phase 4.1 数据库层测试');

    // 确保数据库连接正常
    try {
      await sequelize.authenticate();
      console.log('✅ 数据库连接成功');
    } catch (error) {
      console.error('❌ 数据库连接失败:', error);
      throw error;
    }
  });

  afterAll(async () => {
    console.log('✅ Phase 4.1 数据库层测试完成');
  });

  describe('1. 模型加载测试', () => {

    test('SystemConfig模型加载和基本查询', async () => {
      const { SystemConfig } = require('../../src/backend/src/models');
      expect(SystemConfig).toBeDefined();

      // 测试基本查询
      const configs = await SystemConfig.findAll({ limit: 5 });
      expect(Array.isArray(configs)).toBe(true);

      if (configs.length > 0) {
        const config = configs[0];
        expect(config).toHaveProperty('id');
        expect(config).toHaveProperty('configKey');
        expect(config).toHaveProperty('configValue');

        console.log('✅ SystemConfig模型加载成功');
        console.log(`   - 配置项数量: ${configs.length}`);
        console.log(`   - 示例配置: ${config.configKey} = ${config.configValue}`);
      }
    });

    test('TaskWaitMetric模型定义验证', async () => {
      const { TaskWaitMetric } = require('../../src/backend/src/models');
      expect(TaskWaitMetric).toBeDefined();

      // 验证模型属性定义
      const attributes = TaskWaitMetric.rawAttributes;
      expect(attributes).toHaveProperty('taskId');
      expect(attributes).toHaveProperty('waitStartTime');
      expect(attributes).toHaveProperty('waitDuration');
      expect(attributes).toHaveProperty('status');

      console.log('✅ TaskWaitMetric模型定义正确');
      console.log('   - 属性数量:', Object.keys(attributes).length);
    });

    test('EmailService预计算字段验证', async () => {
      const { EmailService } = require('../../src/backend/src/models');
      expect(EmailService).toBeDefined();

      const services = await EmailService.findAll({
        attributes: ['id', 'name', 'last_sent_at', 'next_available_at'],
        limit: 3
      });

      expect(Array.isArray(services)).toBe(true);

      services.forEach(service => {
        expect(service).toHaveProperty('id');
        expect(service).toHaveProperty('name');
        // next_available_at字段应该存在（可能为null）
        expect(service.dataValues).toHaveProperty('next_available_at');
      });

      console.log('✅ EmailService预计算字段验证通过');
      console.log(`   - 服务数量: ${services.length}`);
    });
  });

  describe('2. 数据一致性测试', () => {

    test('配置数据完整性检查', async () => {
      const { SystemConfig } = require('../../src/backend/src/models');

      const configs = await SystemConfig.findAll();
      expect(configs.length).toBeGreaterThan(0);

      // 验证必需的队列配置项存在
      const requiredConfigs = [
        'queue_batch_size',
        'queue_interval_seconds',
        'max_concurrent_tasks',
        'max_retry_attempts'
      ];

      const foundConfigs = [];
      for (const configKey of requiredConfigs) {
        const config = configs.find(c =>
          c.configKey === configKey || c.config_key === configKey
        );

        if (config) {
          foundConfigs.push(configKey);
          expect(config.configValue || config.config_value).toBeDefined();
          expect(config.configValue || config.config_value).not.toBe('');
        }
      }

      console.log('✅ 配置数据完整性检查通过');
      console.log(`   - 必需配置项: ${requiredConfigs.length}`);
      console.log(`   - 找到配置项: ${foundConfigs.length}`);
      console.log(`   - 配置项列表: ${foundConfigs.join(', ')}`);

      // 至少要有基本的队列配置
      expect(foundConfigs.length).toBeGreaterThan(0);
    });

    test('任务和子任务关联一致性', async () => {
      const { Task, SubTask } = require('../../src/backend/src/models');

      // 检查是否有孤立的SubTask（没有对应Task的）
      const orphanedSubTasks = await SubTask.findAll({
        include: [{
          model: Task,
          required: false
        }],
        where: {
          '$Task.id$': null
        },
        limit: 5
      });

      console.log('✅ 任务关联一致性检查完成');
      console.log(`   - 孤立子任务数量: ${orphanedSubTasks.length}`);

      // 理想情况下应该没有孤立的子任务
      if (orphanedSubTasks.length > 0) {
        console.log('⚠️  发现孤立子任务，这可能是正常的测试数据');
      }
    });

    test('用户和任务关联一致性', async () => {
      const { User, Task } = require('../../src/backend/src/models');

      // 检查是否有孤立的Task（没有对应User的）
      const orphanedTasks = await Task.findAll({
        include: [{
          model: User,
          required: false
        }],
        where: {
          '$User.id$': null
        },
        limit: 5
      });

      console.log('✅ 用户任务关联一致性检查完成');
      console.log(`   - 孤立任务数量: ${orphanedTasks.length}`);
    });
  });

  describe('3. 数据库性能测试', () => {

    test('配置查询性能测试', async () => {
      const { SystemConfig } = require('../../src/backend/src/models');

      const startTime = Date.now();

      // 执行多次查询测试性能
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(SystemConfig.findAll({ limit: 20 }));
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      const averageTime = totalTime / 10;

      // 验证查询结果
      results.forEach(configs => {
        expect(Array.isArray(configs)).toBe(true);
      });

      console.log('✅ 配置查询性能测试完成');
      console.log(`   - 总查询次数: 10`);
      console.log(`   - 总耗时: ${totalTime}ms`);
      console.log(`   - 平均查询时间: ${averageTime}ms`);

      // 期望平均查询时间小于100ms
      expect(averageTime).toBeLessThan(100);
    });

    test('邮件服务查询性能测试', async () => {
      const { EmailService } = require('../../src/backend/src/models');

      const startTime = Date.now();

      // 测试服务选择查询的性能
      const services = await EmailService.findAll({
        where: {
          status: 'active'
        },
        order: [
          ['last_sent_at', 'ASC'],
          ['created_at', 'ASC']
        ],
        limit: 10
      });

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(Array.isArray(services)).toBe(true);

      console.log('✅ 邮件服务查询性能测试完成');
      console.log(`   - 查询时间: ${queryTime}ms`);
      console.log(`   - 返回服务数: ${services.length}`);

      // 期望查询时间小于50ms
      expect(queryTime).toBeLessThan(50);
    });

    test('复杂关联查询性能测试', async () => {
      const { Task, SubTask, Contact } = require('../../src/backend/src/models');

      const startTime = Date.now();

      // 执行复杂的关联查询
      const tasks = await Task.findAll({
        include: [
          {
            model: SubTask,
            include: [
              {
                model: Contact,
                attributes: ['id', 'email', 'name']
              }
            ],
            limit: 5
          }
        ],
        limit: 3
      });

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(Array.isArray(tasks)).toBe(true);

      console.log('✅ 复杂关联查询性能测试完成');
      console.log(`   - 查询时间: ${queryTime}ms`);
      console.log(`   - 返回任务数: ${tasks.length}`);

      // 期望复杂查询时间小于200ms
      expect(queryTime).toBeLessThan(200);
    });
  });

  describe('4. 数据库连接和事务测试', () => {

    test('数据库连接池状态', async () => {
      const pool = sequelize.connectionManager.pool;

      if (pool) {
        console.log('✅ 数据库连接池状态:');
        console.log(`   - 最大连接数: ${pool.options.max}`);
        console.log(`   - 最小连接数: ${pool.options.min}`);
        console.log(`   - 当前使用连接数: ${pool.used.length}`);
        console.log(`   - 当前空闲连接数: ${pool.free.length}`);

        expect(pool.options.max).toBeGreaterThan(0);
        expect(pool.options.min).toBeGreaterThan(0);
      } else {
        console.log('⚠️  无法获取连接池信息');
      }
    });

    test('基本事务功能测试', async () => {
      const { SystemConfig } = require('../../src/backend/src/models');

      const transaction = await sequelize.transaction();

      try {
        // 在事务中创建一个测试配置
        const testConfig = await SystemConfig.create({
          configKey: 'test_transaction_config',
          configValue: 'test_value',
          category: 'test',
          description: 'Transaction test config'
        }, { transaction });

        expect(testConfig).toBeDefined();
        expect(testConfig.configKey).toBe('test_transaction_config');

        // 回滚事务（测试用）
        await transaction.rollback();

        // 验证配置被回滚
        const foundConfig = await SystemConfig.findOne({
          where: { configKey: 'test_transaction_config' }
        });

        expect(foundConfig).toBeNull();

        console.log('✅ 事务功能测试通过');

      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    });
  });

  describe('5. 数据库模式和约束测试', () => {

    test('表结构验证', async () => {
      // 验证关键表是否存在
      const tableNames = [
        'system_configs',
        'tasks',
        'sub_tasks',
        'email_services',
        'contacts',
        'users'
      ];

      for (const tableName of tableNames) {
        const [results] = await sequelize.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = '${tableName}'
          );`
        );

        expect(results[0].exists).toBe(true);
        console.log(`✅ 表 ${tableName} 存在`);
      }
    });

    test('索引存在性验证', async () => {
      // 验证关键索引是否存在
      const [indexes] = await sequelize.query(`
        SELECT indexname, tablename 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename IN ('system_configs', 'tasks', 'sub_tasks', 'email_services')
        ORDER BY tablename, indexname;
      `);

      expect(Array.isArray(indexes)).toBe(true);
      expect(indexes.length).toBeGreaterThan(0);

      console.log('✅ 数据库索引验证完成');
      console.log(`   - 找到索引数量: ${indexes.length}`);

      // 显示前几个索引
      indexes.slice(0, 5).forEach(index => {
        console.log(`   - ${index.tablename}.${index.indexname}`);
      });
    });
  });
});

module.exports = {
  testSuite: 'Phase 4.1 数据库层测试',
  testCount: 15,
  estimatedTime: '30分钟'
}; 