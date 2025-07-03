#!/usr/bin/env node

/**
 * 🧪 Phase 5: 多用户多任务交叉发信服务测试
 * 模拟复杂生产环境：多用户、多任务、交叉服务权限、不同发信间隔
 */

const { EmailService, SubTask, Task, User, UserServiceMapping, sequelize } = require('../src/backend/src/models/index');
const QueueSchedulerV2 = require('../src/backend/src/services/core/queueSchedulerV2.service');
const logger = require('../src/backend/src/utils/logger');

class Phase5MultiUserCrossTest {
  constructor() {
    this.scheduler = null;
    this.testResults = [];
    this.testData = {
      users: [],
      services: [],
      tasks: [],
      subTasks: [],
      userServiceMappings: []
    };
    this.testStartTime = null;
    this.allocationHistory = [];
  }

  /**
   * 🚀 主测试流程
   */
  async runTests() {
    try {
      console.log('🧪 多用户多任务交叉发信服务测试开始');
      console.log('=' .repeat(60));
      
      this.testStartTime = Date.now();
      
      // 1. 设置测试环境
      await this.setupTestEnvironment();
      
      // 2. 创建复杂测试数据
      await this.createComplexTestData();
      
      // 3. 启动调度器
      await this.initializeScheduler();
      
      // 4. 执行交叉测试场景
      await this.runCrossTestScenarios();
      
      // 5. 分析测试结果
      await this.analyzeTestResults();
      
      // 6. 生成详细报告
      await this.generateDetailedReport();
      
      // 7. 清理测试数据
      await this.cleanupTestData();
      
      console.log('✅ 多用户多任务交叉测试完成');
      
    } catch (error) {
      console.error('❌ 测试执行失败:', error);
      throw error;
    }
  }

  /**
   * 🔧 设置测试环境
   */
  async setupTestEnvironment() {
    console.log('🔧 设置复杂测试环境...');
    
    // 设置测试模式
    process.env.NODE_ENV = 'test';
    process.env.QUEUE_TEST_MODE = 'true';
    
    // 清理可能存在的测试数据
    await this.cleanupExistingTestData();
    
    console.log('✅ 测试环境设置完成');
  }

  /**
   * 🏗️ 创建复杂测试数据
   */
  async createComplexTestData() {
    console.log('🏗️ 创建复杂测试数据...');
    
    // 创建6个测试用户（模拟不同业务场景）
    await this.createTestUsers();
    
    // 创建8个发信服务（不同间隔和配额）
    await this.createTestServices();
    
    // 创建复杂的用户服务映射关系
    await this.createComplexUserServiceMappings();
    
    // 创建多个并发任务
    await this.createMultipleTasks();
    
    // 创建大量子任务
    await this.createMassiveSubTasks();
    
    console.log('✅ 复杂测试数据创建完成');
    this.logTestDataSummary();
  }

  /**
   * 👥 创建测试用户
   */
  async createTestUsers() {
    const users = [
      { id: 5001, username: 'enterprise_user_1', email: 'enterprise1@test.com', user_type: 'enterprise' },
      { id: 5002, username: 'enterprise_user_2', email: 'enterprise2@test.com', user_type: 'enterprise' },
      { id: 5003, username: 'premium_user_1', email: 'premium1@test.com', user_type: 'premium' },
      { id: 5004, username: 'premium_user_2', email: 'premium2@test.com', user_type: 'premium' },
      { id: 5005, username: 'standard_user_1', email: 'standard1@test.com', user_type: 'standard' },
      { id: 5006, username: 'standard_user_2', email: 'standard2@test.com', user_type: 'standard' }
    ];

    for (const userData of users) {
      const user = await User.create(userData);
      this.testData.users.push(user);
    }

    console.log(`📊 创建用户: ${this.testData.users.length} 个`);
  }

  /**
   * 📧 创建测试发信服务（不同间隔）
   */
  async createTestServices() {
    const services = [
      { 
        id: 6001, 
        name: 'HighSpeed Service A', 
        daily_quota: 2000, 
        used_quota: 50, 
        is_enabled: true,
        next_available_at: new Date(),
        send_interval: 17000,  // 17秒间隔
        service_type: 'high_speed'
      },
      { 
        id: 6002, 
        name: 'HighSpeed Service B', 
        daily_quota: 1800, 
        used_quota: 80, 
        is_enabled: true,
        next_available_at: new Date(),
        send_interval: 21000,  // 21秒间隔
        service_type: 'high_speed'
      },
      { 
        id: 6003, 
        name: 'Premium Service A', 
        daily_quota: 1500, 
        used_quota: 120, 
        is_enabled: true,
        next_available_at: new Date(),
        send_interval: 24000,  // 24秒间隔
        service_type: 'premium'
      },
      { 
        id: 6004, 
        name: 'Premium Service B', 
        daily_quota: 1200, 
        used_quota: 200, 
        is_enabled: true,
        next_available_at: new Date(),
        send_interval: 19000,  // 19秒间隔
        service_type: 'premium'
      },
      { 
        id: 6005, 
        name: 'Standard Service A', 
        daily_quota: 1000, 
        used_quota: 300, 
        is_enabled: true,
        next_available_at: new Date(),
        send_interval: 26000,  // 26秒间隔
        service_type: 'standard'
      },
      { 
        id: 6006, 
        name: 'Standard Service B', 
        daily_quota: 800, 
        used_quota: 150, 
        is_enabled: true,
        next_available_at: new Date(),
        send_interval: 22000,  // 22秒间隔
        service_type: 'standard'
      },
      { 
        id: 6007, 
        name: 'Backup Service', 
        daily_quota: 500, 
        used_quota: 50, 
        is_enabled: true,
        next_available_at: new Date(),
        send_interval: 30000,  // 30秒间隔
        service_type: 'backup'
      },
      { 
        id: 6008, 
        name: 'Limited Service (Near Quota)', 
        daily_quota: 600, 
        used_quota: 580, 
        is_enabled: true,
        next_available_at: new Date(),
        send_interval: 18000,  // 18秒间隔
        service_type: 'limited'
      }
    ];

    for (const serviceData of services) {
      const service = await EmailService.create(serviceData);
      this.testData.services.push(service);
    }

    console.log(`📊 创建发信服务: ${this.testData.services.length} 个`);
    console.log('📋 服务间隔分布:');
    this.testData.services.forEach(service => {
      console.log(`  - ${service.name}: ${service.send_interval/1000}秒 (额度: ${service.used_quota}/${service.daily_quota})`);
    });
  }

  /**
   * 🔗 创建复杂的用户服务映射关系
   */
  async createComplexUserServiceMappings() {
    const mappings = [
      // Enterprise用户 - 可以使用高速和优质服务
      { user_id: 5001, email_service_id: 6001 }, // Enterprise1 -> HighSpeed A
      { user_id: 5001, email_service_id: 6002 }, // Enterprise1 -> HighSpeed B
      { user_id: 5001, email_service_id: 6003 }, // Enterprise1 -> Premium A
      { user_id: 5001, email_service_id: 6007 }, // Enterprise1 -> Backup
      
      { user_id: 5002, email_service_id: 6001 }, // Enterprise2 -> HighSpeed A
      { user_id: 5002, email_service_id: 6004 }, // Enterprise2 -> Premium B
      { user_id: 5002, email_service_id: 6008 }, // Enterprise2 -> Limited
      
      // Premium用户 - 可以使用优质和标准服务
      { user_id: 5003, email_service_id: 6003 }, // Premium1 -> Premium A
      { user_id: 5003, email_service_id: 6004 }, // Premium1 -> Premium B
      { user_id: 5003, email_service_id: 6005 }, // Premium1 -> Standard A
      
      { user_id: 5004, email_service_id: 6002 }, // Premium2 -> HighSpeed B
      { user_id: 5004, email_service_id: 6006 }, // Premium2 -> Standard B
      { user_id: 5004, email_service_id: 6007 }, // Premium2 -> Backup
      
      // Standard用户 - 只能使用标准和备用服务
      { user_id: 5005, email_service_id: 6005 }, // Standard1 -> Standard A
      { user_id: 5005, email_service_id: 6006 }, // Standard1 -> Standard B
      { user_id: 5005, email_service_id: 6007 }, // Standard1 -> Backup
      
      { user_id: 5006, email_service_id: 6006 }, // Standard2 -> Standard B
      { user_id: 5006, email_service_id: 6008 }  // Standard2 -> Limited
    ];

    for (const mappingData of mappings) {
      const mapping = await UserServiceMapping.create(mappingData);
      this.testData.userServiceMappings.push(mapping);
    }

    console.log(`📊 创建用户服务映射: ${this.testData.userServiceMappings.length} 个`);
  }

  /**
   * 📋 创建多个并发任务
   */
  async createMultipleTasks() {
    const tasks = [
      // Enterprise用户的大型任务
      { id: 7001, user_id: 5001, name: 'Enterprise Campaign A', status: 'scheduled', priority: 3, estimated_count: 500 },
      { id: 7002, user_id: 5001, name: 'Enterprise Newsletter', status: 'sending', priority: 2, estimated_count: 300 },
      { id: 7003, user_id: 5002, name: 'Enterprise Promotion', status: 'scheduled', priority: 3, estimated_count: 400 },
      
      // Premium用户的中型任务
      { id: 7004, user_id: 5003, name: 'Premium Campaign B', status: 'scheduled', priority: 2, estimated_count: 250 },
      { id: 7005, user_id: 5003, name: 'Premium Event Invite', status: 'sending', priority: 1, estimated_count: 150 },
      { id: 7006, user_id: 5004, name: 'Premium Product Launch', status: 'scheduled', priority: 2, estimated_count: 200 },
      
      // Standard用户的小型任务
      { id: 7007, user_id: 5005, name: 'Standard Weekly Newsletter', status: 'scheduled', priority: 1, estimated_count: 100 },
      { id: 7008, user_id: 5005, name: 'Standard Survey', status: 'sending', priority: 1, estimated_count: 80 },
      { id: 7009, user_id: 5006, name: 'Standard Announcement', status: 'scheduled', priority: 1, estimated_count: 60 }
    ];

    for (const taskData of tasks) {
      const task = await Task.create(taskData);
      this.testData.tasks.push(task);
    }

    console.log(`📊 创建任务: ${this.testData.tasks.length} 个`);
  }

  /**
   * 📨 创建大量子任务
   */
  async createMassiveSubTasks() {
    const subTasks = [];
    
    for (const task of this.testData.tasks) {
      const count = task.estimated_count || 100;
      
      for (let i = 1; i <= count; i++) {
        subTasks.push({
          task_id: task.id,
          recipient_email: `recipient${i}_task${task.id}@test.com`,
          status: 'pending',
          content: `Test email content for ${task.name}, recipient ${i}`,
          priority: task.priority,
          created_at: new Date(Date.now() - Math.random() * 3600000) // 随机创建时间
        });
      }
    }

    // 批量创建子任务
    const batchSize = 100;
    for (let i = 0; i < subTasks.length; i += batchSize) {
      const batch = subTasks.slice(i, i + batchSize);
      const createdBatch = await SubTask.bulkCreate(batch);
      this.testData.subTasks.push(...createdBatch);
    }

    console.log(`📊 创建子任务: ${this.testData.subTasks.length} 个`);
  }

  /**
   * 📊 记录测试数据摘要
   */
  logTestDataSummary() {
    console.log('\n📋 测试数据摘要:');
    console.log(`👥 用户: ${this.testData.users.length} 个`);
    console.log(`📧 发信服务: ${this.testData.services.length} 个`);
    console.log(`🔗 用户服务映射: ${this.testData.userServiceMappings.length} 个`);
    console.log(`📋 任务: ${this.testData.tasks.length} 个`);
    console.log(`📨 子任务: ${this.testData.subTasks.length} 个`);
    
    // 按用户统计子任务数量
    console.log('\n📊 按用户统计子任务:');
    this.testData.users.forEach(user => {
      const userTasks = this.testData.tasks.filter(t => t.user_id === user.id);
      const subTaskCount = userTasks.reduce((sum, task) => {
        return sum + this.testData.subTasks.filter(st => st.task_id === task.id).length;
      }, 0);
      console.log(`  - ${user.username}: ${subTaskCount} 个子任务`);
    });
  }

  /**
   * 🚀 初始化调度器
   */
  async initializeScheduler() {
    console.log('\n🚀 初始化队列调度器...');
    
    this.scheduler = new QueueSchedulerV2();
    
    // 设置测试配置（加速测试）
    this.scheduler.config = {
      task_supplement_interval: 8000,   // 8秒补充任务
      service_scan_interval: 3000,      // 3秒扫描服务
      service_max_queue_size: 15,       // 每服务最多15个队列
      queue_memory_optimization: true,
      failure_block_strategy: true,
      admin_manual_intervention: true
    };
    
    // 启动调度器
    await this.scheduler.start();
    
    console.log('✅ 队列调度器初始化完成');
    console.log(`📊 配置: 任务补充=${this.scheduler.config.task_supplement_interval}ms, 服务扫描=${this.scheduler.config.service_scan_interval}ms`);
  }

  /**
   * 🧪 执行交叉测试场景
   */
  async runCrossTestScenarios() {
    console.log('\n🧪 执行交叉测试场景...');
    
    const testDuration = 60000; // 60秒测试
    const checkInterval = 5000;  // 5秒检查一次
    const startTime = Date.now();
    
    console.log(`⏱️ 测试时长: ${testDuration/1000}秒, 检查间隔: ${checkInterval/1000}秒`);
    
    let checkCount = 0;
    const maxChecks = Math.floor(testDuration / checkInterval);
    
    while (Date.now() - startTime < testDuration) {
      checkCount++;
      const currentTime = Date.now();
      const elapsedTime = currentTime - startTime;
      
      console.log(`\n🔍 检查点 ${checkCount}/${maxChecks} (${Math.floor(elapsedTime/1000)}秒)`);
      
      // 获取当前队列状态
      const queueStatus = await this.scheduler.getQueueStatus();
      
      // 记录分配历史
      await this.recordAllocationSnapshot(queueStatus, elapsedTime);
      
      // 分析当前状态
      this.analyzeCurrentStatus(queueStatus);
      
      // 模拟一些服务变为不可用（测试故障恢复）
      if (checkCount === 3) {
        await this.simulateServiceFailures();
      }
      
      // 模拟服务恢复
      if (checkCount === 6) {
        await this.simulateServiceRecovery();
      }
      
      // 等待下一次检查
      await this.sleep(checkInterval);
    }
    
    console.log('\n✅ 交叉测试场景执行完成');
  }

  /**
   * 📸 记录分配快照
   */
  async recordAllocationSnapshot(queueStatus, elapsedTime) {
    const snapshot = {
      timestamp: new Date(),
      elapsedTime,
      metrics: queueStatus.metrics,
      queueDetails: queueStatus.queueDetails,
      serviceCount: Object.keys(queueStatus.queueDetails).length,
      totalQueuedTasks: queueStatus.metrics.totalQueuedTasks,
      activeServices: queueStatus.metrics.activeServices,
      blockedServices: queueStatus.metrics.blockedServices.length
    };
    
    this.allocationHistory.push(snapshot);
    
    console.log(`📊 快照: 总队列=${snapshot.totalQueuedTasks}, 活跃服务=${snapshot.activeServices}, 阻塞服务=${snapshot.blockedServices}`);
  }

  /**
   * 📈 分析当前状态
   */
  analyzeCurrentStatus(queueStatus) {
    // 检查队列分布是否均匀
    const queueLengths = Object.values(queueStatus.queueDetails).map(service => service.queueLength);
    if (queueLengths.length > 0) {
      const maxQueue = Math.max(...queueLengths);
      const minQueue = Math.min(...queueLengths);
      const avgQueue = queueLengths.reduce((sum, len) => sum + len, 0) / queueLengths.length;
      
      console.log(`📈 队列分布: 最大=${maxQueue}, 最小=${minQueue}, 平均=${avgQueue.toFixed(1)}`);
    }
    
    // 检查是否有服务达到最大队列
    Object.entries(queueStatus.queueDetails).forEach(([serviceId, details]) => {
      if (details.queueLength >= this.scheduler.config.service_max_queue_size) {
        console.log(`⚠️ 服务 ${details.serviceName} 队列已满 (${details.queueLength}/${this.scheduler.config.service_max_queue_size})`);
      }
    });
  }

  /**
   * 💥 模拟服务故障
   */
  async simulateServiceFailures() {
    console.log('\n💥 模拟服务故障...');
    
    // 模拟2个服务故障
    const failureServices = [6001, 6003]; // HighSpeed A, Premium A
    
    for (const serviceId of failureServices) {
      // 连续记录5次故障
      for (let i = 0; i < 5; i++) {
        this.scheduler.recordServiceFailure(serviceId);
      }
      
      const service = this.testData.services.find(s => s.id === serviceId);
      console.log(`❌ 模拟服务故障: ${service?.name || serviceId}`);
    }
  }

  /**
   * 🔧 模拟服务恢复
   */
  async simulateServiceRecovery() {
    console.log('\n🔧 模拟服务恢复...');
    
    // 清除所有阻塞状态
    this.scheduler.metrics.blockedServices.clear();
    this.scheduler.serviceStatus.clear();
    
    console.log('✅ 所有服务故障已恢复');
  }

  /**
   * 📊 分析测试结果
   */
  async analyzeTestResults() {
    console.log('\n📊 分析测试结果...');
    
    // 1. 分析队列分配效率
    this.analyzeQueueAllocationEfficiency();
    
    // 2. 分析用户公平性
    this.analyzeUserFairness();
    
    // 3. 分析服务利用率
    this.analyzeServiceUtilization();
    
    // 4. 分析故障恢复
    this.analyzeFailureRecovery();
    
    console.log('✅ 测试结果分析完成');
  }

  /**
   * 📈 分析队列分配效率
   */
  analyzeQueueAllocationEfficiency() {
    console.log('\n📈 队列分配效率分析:');
    
    const snapshots = this.allocationHistory;
    if (snapshots.length === 0) return;
    
    // 计算平均队列利用率
    const avgUtilization = snapshots.reduce((sum, snapshot) => {
      const totalPossibleQueue = snapshot.serviceCount * this.scheduler.config.service_max_queue_size;
      const utilization = totalPossibleQueue > 0 ? snapshot.totalQueuedTasks / totalPossibleQueue : 0;
      return sum + utilization;
    }, 0) / snapshots.length;
    
    console.log(`📊 平均队列利用率: ${(avgUtilization * 100).toFixed(2)}%`);
    
    // 分析队列稳定性
    const queueVariations = [];
    for (let i = 1; i < snapshots.length; i++) {
      const variation = Math.abs(snapshots[i].totalQueuedTasks - snapshots[i-1].totalQueuedTasks);
      queueVariations.push(variation);
    }
    
    if (queueVariations.length > 0) {
      const avgVariation = queueVariations.reduce((sum, v) => sum + v, 0) / queueVariations.length;
      console.log(`📊 队列变化稳定性: 平均变化=${avgVariation.toFixed(1)} 任务/检查点`);
    }
  }

  /**
   * ⚖️ 分析用户公平性
   */
  analyzeUserFairness() {
    console.log('\n⚖️ 用户公平性分析:');
    
    // 统计每个用户的任务分配情况
    const userStats = {};
    
    this.testData.users.forEach(user => {
      const userTasks = this.testData.tasks.filter(t => t.user_id === user.id);
      const totalSubTasks = userTasks.reduce((sum, task) => {
        return sum + this.testData.subTasks.filter(st => st.task_id === task.id).length;
      }, 0);
      
      userStats[user.id] = {
        username: user.username,
        userType: user.user_type,
        totalSubTasks,
        taskCount: userTasks.length
      };
    });
    
    // 按用户类型分组分析
    const typeGroups = {};
    Object.values(userStats).forEach(stat => {
      if (!typeGroups[stat.userType]) {
        typeGroups[stat.userType] = [];
      }
      typeGroups[stat.userType].push(stat);
    });
    
    Object.entries(typeGroups).forEach(([type, users]) => {
      const avgSubTasks = users.reduce((sum, u) => sum + u.totalSubTasks, 0) / users.length;
      console.log(`📊 ${type} 用户平均子任务: ${avgSubTasks.toFixed(1)} 个`);
    });
  }

  /**
   * 🔧 分析服务利用率
   */
  analyzeServiceUtilization() {
    console.log('\n🔧 服务利用率分析:');
    
    const lastSnapshot = this.allocationHistory[this.allocationHistory.length - 1];
    if (!lastSnapshot) return;
    
    // 按服务类型分析利用率
    const serviceTypes = {};
    
    this.testData.services.forEach(service => {
      const queueInfo = lastSnapshot.queueDetails[service.id];
      const queueLength = queueInfo ? queueInfo.queueLength : 0;
      
      if (!serviceTypes[service.service_type]) {
        serviceTypes[service.service_type] = {
          services: [],
          totalQueue: 0,
          totalCapacity: 0
        };
      }
      
      serviceTypes[service.service_type].services.push({
        name: service.name,
        queueLength,
        interval: service.send_interval,
        quota: `${service.used_quota}/${service.daily_quota}`
      });
      
      serviceTypes[service.service_type].totalQueue += queueLength;
      serviceTypes[service.service_type].totalCapacity += this.scheduler.config.service_max_queue_size;
    });
    
    Object.entries(serviceTypes).forEach(([type, info]) => {
      const utilization = info.totalCapacity > 0 ? (info.totalQueue / info.totalCapacity * 100) : 0;
      console.log(`📊 ${type} 服务利用率: ${utilization.toFixed(1)}% (${info.totalQueue}/${info.totalCapacity})`);
      
      info.services.forEach(service => {
        console.log(`  - ${service.name}: 队列=${service.queueLength}, 间隔=${service.interval/1000}s, 额度=${service.quota}`);
      });
    });
  }

  /**
   * 🔄 分析故障恢复
   */
  analyzeFailureRecovery() {
    console.log('\n🔄 故障恢复分析:');
    
    // 查找故障期间和恢复后的快照
    const failureSnapshot = this.allocationHistory[2]; // 故障前
    const duringFailureSnapshot = this.allocationHistory[4]; // 故障期间
    const recoverySnapshot = this.allocationHistory[7]; // 恢复后
    
    if (failureSnapshot && duringFailureSnapshot && recoverySnapshot) {
      console.log(`📊 故障前队列: ${failureSnapshot.totalQueuedTasks} 个任务`);
      console.log(`📊 故障期间队列: ${duringFailureSnapshot.totalQueuedTasks} 个任务`);
      console.log(`📊 恢复后队列: ${recoverySnapshot.totalQueuedTasks} 个任务`);
      
      console.log(`📊 故障期间阻塞服务: ${duringFailureSnapshot.blockedServices} 个`);
      console.log(`📊 恢复后阻塞服务: ${recoverySnapshot.blockedServices} 个`);
      
      // 计算恢复效率
      const recoveryEfficiency = recoverySnapshot.totalQueuedTasks / failureSnapshot.totalQueuedTasks;
      console.log(`📊 恢复效率: ${(recoveryEfficiency * 100).toFixed(1)}%`);
    }
  }

  /**
   * 📋 生成详细报告
   */
  async generateDetailedReport() {
    console.log('\n📋 生成详细测试报告...');
    
    const testDuration = Date.now() - this.testStartTime;
    
    const report = {
      testInfo: {
        testName: 'Phase 5 多用户多任务交叉发信服务测试',
        startTime: new Date(this.testStartTime).toISOString(),
        duration: `${Math.floor(testDuration/1000)}秒`,
        testDataSummary: {
          users: this.testData.users.length,
          services: this.testData.services.length,
          tasks: this.testData.tasks.length,
          subTasks: this.testData.subTasks.length,
          userServiceMappings: this.testData.userServiceMappings.length
        }
      },
      schedulerConfig: this.scheduler.config,
      allocationHistory: this.allocationHistory,
      finalStatus: await this.scheduler.getQueueStatus(),
      serviceDetails: this.testData.services.map(service => ({
        id: service.id,
        name: service.name,
        type: service.service_type,
        interval: service.send_interval,
        quota: `${service.used_quota}/${service.daily_quota}`
      })),
      userMapping: this.testData.users.map(user => ({
        id: user.id,
        username: user.username,
        type: user.user_type,
        serviceCount: this.testData.userServiceMappings.filter(m => m.user_id === user.id).length
      }))
    };
    
    // 保存报告
    const fs = require('fs');
    const reportPath = `tests/reports/phase5-multi-user-cross-test-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // 输出摘要报告
    console.log('\n' + '='.repeat(80));
    console.log('📊 多用户多任务交叉测试报告摘要');
    console.log('='.repeat(80));
    console.log(`⏱️ 测试时长: ${Math.floor(testDuration/1000)}秒`);
    console.log(`📊 数据规模: ${this.testData.users.length}用户, ${this.testData.services.length}服务, ${this.testData.subTasks.length}子任务`);
    console.log(`📈 检查点数: ${this.allocationHistory.length}个`);
    console.log(`📋 最终队列: ${report.finalStatus.metrics.totalQueuedTasks}个任务`);
    console.log(`🔧 活跃服务: ${report.finalStatus.metrics.activeServices}个`);
    console.log(`⚠️ 阻塞服务: ${report.finalStatus.metrics.blockedServices.length}个`);
    console.log('='.repeat(80));
    console.log(`📄 详细报告: ${reportPath}`);
    
    return report;
  }

  /**
   * 🧹 清理测试数据
   */
  async cleanupTestData() {
    console.log('\n🧹 清理测试数据...');
    
    try {
      // 停止调度器
      if (this.scheduler) {
        await this.scheduler.stop();
      }
      
      await this.cleanupExistingTestData();
      
      console.log('✅ 测试数据清理完成');
      
    } catch (error) {
      console.error('❌ 清理测试数据失败:', error);
    }
  }

  /**
   * 🗑️ 清理已存在的测试数据
   */
  async cleanupExistingTestData() {
    const { Op } = require('sequelize');
    
    // 清理子任务
    await SubTask.destroy({ 
      where: { 
        task_id: { [Op.in]: [7001, 7002, 7003, 7004, 7005, 7006, 7007, 7008, 7009] }
      } 
    });
    
    // 清理任务
    await Task.destroy({ 
      where: { 
        id: { [Op.in]: [7001, 7002, 7003, 7004, 7005, 7006, 7007, 7008, 7009] }
      } 
    });
    
    // 清理用户服务映射
    await UserServiceMapping.destroy({ 
      where: { 
        user_id: { [Op.in]: [5001, 5002, 5003, 5004, 5005, 5006] }
      } 
    });
    
    // 清理发信服务
    await EmailService.destroy({ 
      where: { 
        id: { [Op.in]: [6001, 6002, 6003, 6004, 6005, 6006, 6007, 6008] }
      } 
    });
    
    // 清理用户
    await User.destroy({ 
      where: { 
        id: { [Op.in]: [5001, 5002, 5003, 5004, 5005, 5006] }
      } 
    });
  }

  /**
   * 😴 等待指定时间
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 运行测试
if (require.main === module) {
  const test = new Phase5MultiUserCrossTest();
  test.runTests()
    .then(() => {
      console.log('\n🎉 多用户多任务交叉测试成功完成！');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 测试执行失败:', error);
      process.exit(1);
    });
}

module.exports = Phase5MultiUserCrossTest;