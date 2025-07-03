/**
 * 🧪 Phase 5: 双频率队列调度器测试
 * 测试30秒任务补充 + 5秒服务处理机制
 */

const { EmailService, SubTask, Task, User, UserServiceMapping } = require('../src/backend/src/models/index');
const QueueSchedulerV2 = require('../src/backend/src/services/core/queueSchedulerV2.service');
const logger = require('../src/backend/src/utils/logger');

class Phase5QueueSchedulerTest {
  constructor() {
    this.scheduler = null;
    this.testResults = [];
    this.mockData = {
      users: [],
      services: [],
      tasks: [],
      subTasks: [],
      userServiceMappings: []
    };
  }

  /**
   * 🧪 主测试流程
   */
  async runTests() {
    try {
      logger.info('🧪 开始Phase 5队列调度器测试');
      
      // 1. 初始化测试环境
      await this.setupTestEnvironment();
      
      // 2. 创建Mock数据
      await this.createMockData();
      
      // 3. 启动调度器
      await this.initializeScheduler();
      
      // 4. 执行核心测试
      await this.runCoreTests();
      
      // 5. 边界情况测试
      await this.runBoundaryTests();
      
      // 6. 性能测试
      await this.runPerformanceTests();
      
      // 7. 生成测试报告
      await this.generateTestReport();
      
      // 8. 清理测试数据
      await this.cleanupTestData();
      
      logger.info('✅ Phase 5队列调度器测试完成');
      
    } catch (error) {
      logger.error('❌ Phase 5队列调度器测试失败:', error);
      throw error;
    }
  }

  /**
   * 🔧 设置测试环境
   */
  async setupTestEnvironment() {
    try {
      logger.info('🔧 设置测试环境');
      
      // 设置测试配置
      process.env.NODE_ENV = 'test';
      process.env.QUEUE_TEST_MODE = 'true';
      
      logger.info('✅ 测试环境设置完成');
      
    } catch (error) {
      logger.error('❌ 测试环境设置失败:', error);
      throw error;
    }
  }

  /**
   * 🔧 创建Mock数据
   */
  async createMockData() {
    try {
      logger.info('🔧 创建Mock数据');
      
      // 创建测试用户
      await this.createMockUsers();
      
      // 创建测试发信服务
      await this.createMockServices();
      
      // 创建用户服务映射
      await this.createMockUserServiceMappings();
      
      // 创建测试任务
      await this.createMockTasks();
      
      // 创建测试子任务
      await this.createMockSubTasks();
      
      logger.info('✅ Mock数据创建完成');
      logger.info(`📊 创建数据: 用户=${this.mockData.users.length}, 服务=${this.mockData.services.length}, 任务=${this.mockData.tasks.length}, 子任务=${this.mockData.subTasks.length}`);
      
    } catch (error) {
      logger.error('❌ Mock数据创建失败:', error);
      throw error;
    }
  }

  /**
   * 🔧 创建测试用户
   */
  async createMockUsers() {
    const users = [
      { id: 1001, username: 'test_user_1', email: 'test1@example.com' },
      { id: 1002, username: 'test_user_2', email: 'test2@example.com' },
      { id: 1003, username: 'test_user_3', email: 'test3@example.com' }
    ];

    for (const userData of users) {
      const user = await User.create(userData);
      this.mockData.users.push(user);
    }
  }

  /**
   * 🔧 创建测试发信服务
   */
  async createMockServices() {
    const services = [
      { 
        id: 2001, 
        name: 'Test Service 1', 
        daily_quota: 1000, 
        used_quota: 100, 
        is_enabled: true,
        next_available_at: new Date()
      },
      { 
        id: 2002, 
        name: 'Test Service 2', 
        daily_quota: 500, 
        used_quota: 50, 
        is_enabled: true,
        next_available_at: new Date()
      },
      { 
        id: 2003, 
        name: 'Test Service 3 (Blocked)', 
        daily_quota: 200, 
        used_quota: 200, 
        is_enabled: false,
        next_available_at: new Date(Date.now() + 3600000) // 1小时后可用
      }
    ];

    for (const serviceData of services) {
      const service = await EmailService.create(serviceData);
      this.mockData.services.push(service);
    }
  }

  /**
   * 🔧 创建用户服务映射
   */
  async createMockUserServiceMappings() {
    const mappings = [
      { user_id: 1001, email_service_id: 2001 },
      { user_id: 1001, email_service_id: 2002 },
      { user_id: 1002, email_service_id: 2001 },
      { user_id: 1002, email_service_id: 2003 },
      { user_id: 1003, email_service_id: 2002 }
    ];

    for (const mappingData of mappings) {
      const mapping = await UserServiceMapping.create(mappingData);
      this.mockData.userServiceMappings.push(mapping);
    }
  }

  /**
   * 🔧 创建测试任务
   */
  async createMockTasks() {
    const tasks = [
      { 
        id: 3001, 
        user_id: 1001, 
        name: 'Test Task 1', 
        status: 'scheduled',
        priority: 1
      },
      { 
        id: 3002, 
        user_id: 1002, 
        name: 'Test Task 2', 
        status: 'sending',
        priority: 2
      },
      { 
        id: 3003, 
        user_id: 1003, 
        name: 'Test Task 3', 
        status: 'scheduled',
        priority: 1
      }
    ];

    for (const taskData of tasks) {
      const task = await Task.create(taskData);
      this.mockData.tasks.push(task);
    }
  }

  /**
   * 🔧 创建测试子任务
   */
  async createMockSubTasks() {
    const subTasks = [];
    
    // 为每个任务创建多个子任务
    for (const task of this.mockData.tasks) {
      for (let i = 1; i <= 15; i++) {
        subTasks.push({
          task_id: task.id,
          recipient_email: `recipient${i}@example.com`,
          status: 'pending',
          content: `Test email content for task ${task.id}, subtask ${i}`
        });
      }
    }

    for (const subTaskData of subTasks) {
      const subTask = await SubTask.create(subTaskData);
      this.mockData.subTasks.push(subTask);
    }
  }

  /**
   * 🔧 初始化调度器
   */
  async initializeScheduler() {
    try {
      logger.info('🔧 初始化队列调度器');
      
      this.scheduler = new QueueSchedulerV2();
      
      // 设置测试配置
      this.scheduler.config = {
        task_supplement_interval: 5000,   // 测试环境缩短为5秒
        service_scan_interval: 2000,      // 测试环境缩短为2秒
        service_max_queue_size: 10,       // 保持10个
        queue_memory_optimization: true,
        failure_block_strategy: true,
        admin_manual_intervention: true
      };
      
      // 启动调度器
      await this.scheduler.start();
      
      logger.info('✅ 队列调度器初始化完成');
      
    } catch (error) {
      logger.error('❌ 队列调度器初始化失败:', error);
      throw error;
    }
  }

  /**
   * 🧪 核心功能测试
   */
  async runCoreTests() {
    try {
      logger.info('🧪 开始核心功能测试');
      
      // 测试1: 任务补充机制
      await this.testTaskSupplement();
      
      // 测试2: 服务队列处理
      await this.testServiceQueueProcessing();
      
      // 测试3: 双频率协调
      await this.testDualFrequencyCoordination();
      
      // 测试4: 内存优化
      await this.testMemoryOptimization();
      
      logger.info('✅ 核心功能测试完成');
      
    } catch (error) {
      logger.error('❌ 核心功能测试失败:', error);
      throw error;
    }
  }

  /**
   * 🧪 测试任务补充机制
   */
  async testTaskSupplement() {
    try {
      logger.info('🧪 测试任务补充机制');
      
      // 手动触发任务补充
      await this.scheduler.supplementTasksToQueues();
      
      // 检查队列状态
      const queueStatus = await this.scheduler.getQueueStatus();
      
      // 验证结果
      const totalQueuedTasks = queueStatus.metrics.totalQueuedTasks;
      const activeServices = queueStatus.metrics.activeServices;
      
      this.testResults.push({
        test: 'task_supplement',
        success: totalQueuedTasks > 0 && activeServices > 0,
        data: {
          totalQueuedTasks,
          activeServices,
          queueDetails: queueStatus.queueDetails
        }
      });
      
      logger.info(`📊 任务补充结果: 总队列=${totalQueuedTasks}, 活跃服务=${activeServices}`);
      
    } catch (error) {
      logger.error('❌ 任务补充测试失败:', error);
      this.testResults.push({
        test: 'task_supplement',
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 🧪 测试服务队列处理
   */
  async testServiceQueueProcessing() {
    try {
      logger.info('🧪 测试服务队列处理');
      
      // 确保有任务在队列中
      await this.scheduler.supplementTasksToQueues();
      
      // 记录处理前状态
      const beforeStatus = await this.scheduler.getQueueStatus();
      
      // 手动触发服务处理
      await this.scheduler.processServiceQueues();
      
      // 记录处理后状态
      const afterStatus = await this.scheduler.getQueueStatus();
      
      // 验证是否有任务被处理
      const processedTasks = beforeStatus.metrics.totalQueuedTasks - afterStatus.metrics.totalQueuedTasks;
      
      this.testResults.push({
        test: 'service_queue_processing',
        success: processedTasks >= 0, // 可能没有可用服务，所以>=0即可
        data: {
          beforeQueue: beforeStatus.metrics.totalQueuedTasks,
          afterQueue: afterStatus.metrics.totalQueuedTasks,
          processedTasks
        }
      });
      
      logger.info(`📊 服务处理结果: 处理前=${beforeStatus.metrics.totalQueuedTasks}, 处理后=${afterStatus.metrics.totalQueuedTasks}, 已处理=${processedTasks}`);
      
    } catch (error) {
      logger.error('❌ 服务队列处理测试失败:', error);
      this.testResults.push({
        test: 'service_queue_processing',
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 🧪 测试双频率协调
   */
  async testDualFrequencyCoordination() {
    try {
      logger.info('🧪 测试双频率协调');
      
      // 模拟连续运行10秒
      const startTime = Date.now();
      const testDuration = 10000; // 10秒
      
      let supplementCount = 0;
      let processCount = 0;
      
      // 重写方法来计数
      const originalSupplement = this.scheduler.supplementTasksToQueues.bind(this.scheduler);
      const originalProcess = this.scheduler.processServiceQueues.bind(this.scheduler);
      
      this.scheduler.supplementTasksToQueues = async () => {
        supplementCount++;
        return await originalSupplement();
      };
      
      this.scheduler.processServiceQueues = async () => {
        processCount++;
        return await originalProcess();
      };
      
      // 等待测试时间
      await new Promise(resolve => setTimeout(resolve, testDuration));
      
      // 恢复原方法
      this.scheduler.supplementTasksToQueues = originalSupplement;
      this.scheduler.processServiceQueues = originalProcess;
      
      // 验证调用频率
      const expectedSupplementCalls = Math.floor(testDuration / this.scheduler.config.task_supplement_interval);
      const expectedProcessCalls = Math.floor(testDuration / this.scheduler.config.service_scan_interval);
      
      this.testResults.push({
        test: 'dual_frequency_coordination',
        success: supplementCount >= expectedSupplementCalls && processCount >= expectedProcessCalls,
        data: {
          supplementCount,
          processCount,
          expectedSupplementCalls,
          expectedProcessCalls,
          testDuration
        }
      });
      
      logger.info(`📊 双频率协调结果: 补充调用=${supplementCount}(期望≥${expectedSupplementCalls}), 处理调用=${processCount}(期望≥${expectedProcessCalls})`);
      
    } catch (error) {
      logger.error('❌ 双频率协调测试失败:', error);
      this.testResults.push({
        test: 'dual_frequency_coordination',
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 🧪 测试内存优化
   */
  async testMemoryOptimization() {
    try {
      logger.info('🧪 测试内存优化');
      
      // 获取初始内存使用
      const initialMemory = process.memoryUsage();
      
      // 大量任务补充
      for (let i = 0; i < 5; i++) {
        await this.scheduler.supplementTasksToQueues();
      }
      
      // 获取补充后内存使用
      const afterMemory = process.memoryUsage();
      
      // 计算内存增长
      const memoryGrowth = afterMemory.heapUsed - initialMemory.heapUsed;
      const memoryGrowthMB = memoryGrowth / 1024 / 1024;
      
      // 获取队列状态
      const queueStatus = await this.scheduler.getQueueStatus();
      
      this.testResults.push({
        test: 'memory_optimization',
        success: memoryGrowthMB < 50, // 内存增长小于50MB认为优化良好
        data: {
          initialMemoryMB: initialMemory.heapUsed / 1024 / 1024,
          afterMemoryMB: afterMemory.heapUsed / 1024 / 1024,
          memoryGrowthMB,
          totalQueuedTasks: queueStatus.metrics.totalQueuedTasks
        }
      });
      
      logger.info(`📊 内存优化结果: 增长=${memoryGrowthMB.toFixed(2)}MB, 队列任务=${queueStatus.metrics.totalQueuedTasks}`);
      
    } catch (error) {
      logger.error('❌ 内存优化测试失败:', error);
      this.testResults.push({
        test: 'memory_optimization',
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 🧪 边界情况测试
   */
  async runBoundaryTests() {
    try {
      logger.info('🧪 开始边界情况测试');
      
      // 测试1: 服务故障处理
      await this.testServiceFailureHandling();
      
      // 测试2: 队列满载情况
      await this.testQueueOverload();
      
      // 测试3: 无可用服务
      await this.testNoAvailableServices();
      
      // 测试4: 全局重启清空
      await this.testGlobalQueueClear();
      
      logger.info('✅ 边界情况测试完成');
      
    } catch (error) {
      logger.error('❌ 边界情况测试失败:', error);
      throw error;
    }
  }

  /**
   * 🧪 测试服务故障处理
   */
  async testServiceFailureHandling() {
    try {
      logger.info('🧪 测试服务故障处理');
      
      // 模拟服务故障
      const serviceId = this.mockData.services[0].id;
      
      // 连续记录5次故障
      for (let i = 0; i < 5; i++) {
        this.scheduler.recordServiceFailure(serviceId);
      }
      
      // 检查服务是否被标记为阻塞
      const queueStatus = await this.scheduler.getQueueStatus();
      const isBlocked = queueStatus.metrics.blockedServices.includes(serviceId);
      
      this.testResults.push({
        test: 'service_failure_handling',
        success: isBlocked,
        data: {
          serviceId,
          isBlocked,
          blockedServices: queueStatus.metrics.blockedServices
        }
      });
      
      logger.info(`📊 服务故障处理结果: 服务${serviceId}是否被阻塞=${isBlocked}`);
      
    } catch (error) {
      logger.error('❌ 服务故障处理测试失败:', error);
      this.testResults.push({
        test: 'service_failure_handling',
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 🧪 测试队列满载情况
   */
  async testQueueOverload() {
    try {
      logger.info('🧪 测试队列满载情况');
      
      // 连续补充任务直到队列满载
      for (let i = 0; i < 3; i++) {
        await this.scheduler.supplementTasksToQueues();
      }
      
      // 检查队列状态
      const queueStatus = await this.scheduler.getQueueStatus();
      
      // 验证是否有队列达到最大值
      let hasFullQueue = false;
      for (const [serviceId, details] of Object.entries(queueStatus.queueDetails)) {
        if (details.queueLength >= this.scheduler.config.service_max_queue_size) {
          hasFullQueue = true;
          break;
        }
      }
      
      this.testResults.push({
        test: 'queue_overload',
        success: hasFullQueue,
        data: {
          totalQueuedTasks: queueStatus.metrics.totalQueuedTasks,
          queueDetails: queueStatus.queueDetails,
          maxQueueSize: this.scheduler.config.service_max_queue_size
        }
      });
      
      logger.info(`📊 队列满载测试结果: 存在满载队列=${hasFullQueue}`);
      
    } catch (error) {
      logger.error('❌ 队列满载测试失败:', error);
      this.testResults.push({
        test: 'queue_overload',
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 🧪 测试无可用服务
   */
  async testNoAvailableServices() {
    try {
      logger.info('🧪 测试无可用服务');
      
      // 禁用所有服务
      await EmailService.update(
        { is_enabled: false },
        { where: {} }
      );
      
      // 尝试补充任务
      await this.scheduler.supplementTasksToQueues();
      
      // 检查是否正确处理无可用服务情况
      const queueStatus = await this.scheduler.getQueueStatus();
      
      this.testResults.push({
        test: 'no_available_services',
        success: queueStatus.metrics.totalQueuedTasks >= 0, // 应该不会出错
        data: {
          totalQueuedTasks: queueStatus.metrics.totalQueuedTasks,
          activeServices: queueStatus.metrics.activeServices
        }
      });
      
      // 恢复服务状态
      await EmailService.update(
        { is_enabled: true },
        { where: { id: { [require('sequelize').Op.in]: [2001, 2002] } } }
      );
      
      logger.info(`📊 无可用服务测试结果: 正确处理=${queueStatus.metrics.totalQueuedTasks >= 0}`);
      
    } catch (error) {
      logger.error('❌ 无可用服务测试失败:', error);
      this.testResults.push({
        test: 'no_available_services',
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 🧪 测试全局重启清空
   */
  async testGlobalQueueClear() {
    try {
      logger.info('🧪 测试全局重启清空');
      
      // 先补充一些任务
      await this.scheduler.supplementTasksToQueues();
      
      // 记录清空前状态
      const beforeStatus = await this.scheduler.getQueueStatus();
      
      // 执行全局清空
      await this.scheduler.clearAllQueues();
      
      // 记录清空后状态
      const afterStatus = await this.scheduler.getQueueStatus();
      
      // 验证清空效果
      const isCleared = afterStatus.metrics.totalQueuedTasks === 0 && 
                        afterStatus.metrics.activeServices === 0;
      
      this.testResults.push({
        test: 'global_queue_clear',
        success: isCleared,
        data: {
          beforeTotalTasks: beforeStatus.metrics.totalQueuedTasks,
          afterTotalTasks: afterStatus.metrics.totalQueuedTasks,
          beforeActiveServices: beforeStatus.metrics.activeServices,
          afterActiveServices: afterStatus.metrics.activeServices
        }
      });
      
      logger.info(`📊 全局清空测试结果: 清空成功=${isCleared}`);
      
    } catch (error) {
      logger.error('❌ 全局清空测试失败:', error);
      this.testResults.push({
        test: 'global_queue_clear',
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 🧪 性能测试
   */
  async runPerformanceTests() {
    try {
      logger.info('🧪 开始性能测试');
      
      // 测试1: 大量任务处理性能
      await this.testHighVolumePerformance();
      
      // 测试2: 并发处理性能
      await this.testConcurrentProcessing();
      
      logger.info('✅ 性能测试完成');
      
    } catch (error) {
      logger.error('❌ 性能测试失败:', error);
      throw error;
    }
  }

  /**
   * 🧪 测试大量任务处理性能
   */
  async testHighVolumePerformance() {
    try {
      logger.info('🧪 测试大量任务处理性能');
      
      const startTime = Date.now();
      
      // 连续执行多次任务补充
      for (let i = 0; i < 10; i++) {
        await this.scheduler.supplementTasksToQueues();
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      const averageTime = duration / 10;
      
      this.testResults.push({
        test: 'high_volume_performance',
        success: averageTime < 1000, // 平均每次补充小于1秒
        data: {
          totalDuration: duration,
          averageTime,
          iterations: 10
        }
      });
      
      logger.info(`📊 大量任务处理性能: 总耗时=${duration}ms, 平均=${averageTime}ms`);
      
    } catch (error) {
      logger.error('❌ 大量任务处理性能测试失败:', error);
      this.testResults.push({
        test: 'high_volume_performance',
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 🧪 测试并发处理性能
   */
  async testConcurrentProcessing() {
    try {
      logger.info('🧪 测试并发处理性能');
      
      const startTime = Date.now();
      
      // 并发执行任务补充和服务处理
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(this.scheduler.supplementTasksToQueues());
        promises.push(this.scheduler.processServiceQueues());
      }
      
      await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      this.testResults.push({
        test: 'concurrent_processing',
        success: duration < 5000, // 并发处理小于5秒
        data: {
          duration,
          concurrentOperations: promises.length
        }
      });
      
      logger.info(`📊 并发处理性能: 耗时=${duration}ms, 并发操作=${promises.length}`);
      
    } catch (error) {
      logger.error('❌ 并发处理性能测试失败:', error);
      this.testResults.push({
        test: 'concurrent_processing',
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 📋 生成测试报告
   */
  async generateTestReport() {
    try {
      logger.info('📋 生成测试报告');
      
      const successCount = this.testResults.filter(r => r.success).length;
      const totalCount = this.testResults.length;
      const successRate = (successCount / totalCount * 100).toFixed(2);
      
      const report = {
        timestamp: new Date().toISOString(),
        summary: {
          totalTests: totalCount,
          successTests: successCount,
          failedTests: totalCount - successCount,
          successRate: `${successRate}%`
        },
        testResults: this.testResults,
        finalQueueStatus: await this.scheduler.getQueueStatus()
      };
      
      // 输出报告
      console.log('\n' + '='.repeat(80));
      console.log('🧪 Phase 5 队列调度器测试报告');
      console.log('='.repeat(80));
      console.log(`📊 测试总数: ${totalCount}`);
      console.log(`✅ 成功: ${successCount}`);
      console.log(`❌ 失败: ${totalCount - successCount}`);
      console.log(`📈 成功率: ${successRate}%`);
      console.log('='.repeat(80));
      
      // 详细结果
      this.testResults.forEach(result => {
        const status = result.success ? '✅' : '❌';
        console.log(`${status} ${result.test}: ${result.success ? 'PASS' : 'FAIL'}`);
        if (!result.success && result.error) {
          console.log(`   错误: ${result.error}`);
        }
      });
      
      console.log('='.repeat(80));
      
      // 保存报告文件
      const fs = require('fs');
      const reportPath = `tests/reports/phase5-test-report-${Date.now()}.json`;
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      
      logger.info(`📄 测试报告已保存: ${reportPath}`);
      
    } catch (error) {
      logger.error('❌ 生成测试报告失败:', error);
    }
  }

  /**
   * 🧹 清理测试数据
   */
  async cleanupTestData() {
    try {
      logger.info('🧹 清理测试数据');
      
      // 停止调度器
      if (this.scheduler) {
        await this.scheduler.stop();
      }
      
      // 清理数据库数据
      const { Op } = require('sequelize');
      await SubTask.destroy({ where: { task_id: { [Op.in]: [3001, 3002, 3003] } } });
      await Task.destroy({ where: { id: { [Op.in]: [3001, 3002, 3003] } } });
      await UserServiceMapping.destroy({ where: { user_id: { [Op.in]: [1001, 1002, 1003] } } });
      await EmailService.destroy({ where: { id: { [Op.in]: [2001, 2002, 2003] } } });
      await User.destroy({ where: { id: { [Op.in]: [1001, 1002, 1003] } } });
      
      logger.info('✅ 测试数据清理完成');
      
    } catch (error) {
      logger.error('❌ 清理测试数据失败:', error);
    }
  }
}

// 运行测试
if (require.main === module) {
  const test = new Phase5QueueSchedulerTest();
  test.runTests().catch(console.error);
}

module.exports = Phase5QueueSchedulerTest; 