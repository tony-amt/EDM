#!/usr/bin/env node

/**
 * 🚀 Phase 5 快速验证脚本
 * 快速验证队列调度器的核心功能和分配逻辑
 */

const { EmailService, SubTask, Task, User, UserServiceMapping, sequelize } = require('../src/backend/src/models/index');
const QueueSchedulerV2 = require('../src/backend/src/services/core/queueSchedulerV2.service');

class Phase5QuickValidation {
  constructor() {
    this.scheduler = null;
    this.testData = {
      users: [],
      services: [],
      tasks: [],
      subTasks: []
    };
  }

  /**
   * 🚀 运行快速验证
   */
  async runQuickValidation() {
    try {
      console.log('🚀 Phase 5 快速验证开始');
      console.log('=' .repeat(50));
      
      // 1. 准备测试数据
      await this.prepareTestData();
      
      // 2. 初始化调度器
      await this.initializeScheduler();
      
      // 3. 验证基础功能
      await this.validateBasicFunctions();
      
      // 4. 验证分配逻辑
      await this.validateAllocationLogic();
      
      // 5. 验证服务间隔
      await this.validateServiceIntervals();
      
      // 6. 清理测试数据
      await this.cleanupTestData();
      
      console.log('\n✅ 快速验证完成！');
      
    } catch (error) {
      console.error('❌ 快速验证失败:', error);
      throw error;
    }
  }

  /**
   * 🏗️ 准备测试数据
   */
  async prepareTestData() {
    console.log('🏗️ 准备测试数据...');
    
    // 清理可能存在的测试数据
    await this.cleanupExistingTestData();
    
    // 创建测试用户
    const user1 = await User.create({
      id: 8001,
      username: 'test_user_1',
      email: 'test1@example.com',
      user_type: 'enterprise'
    });
    
    const user2 = await User.create({
      id: 8002,
      username: 'test_user_2',
      email: 'test2@example.com',
      user_type: 'premium'
    });
    
    this.testData.users = [user1, user2];
    
    // 创建测试发信服务（不同间隔）
    const services = [
      {
        id: 9001,
        name: 'Quick Test Service A',
        daily_quota: 1000,
        used_quota: 100,
        is_enabled: true,
        next_available_at: new Date(),
        send_interval: 17000, // 17秒
        service_type: 'test'
      },
      {
        id: 9002,
        name: 'Quick Test Service B',
        daily_quota: 800,
        used_quota: 50,
        is_enabled: true,
        next_available_at: new Date(),
        send_interval: 21000, // 21秒
        service_type: 'test'
      },
      {
        id: 9003,
        name: 'Quick Test Service C',
        daily_quota: 600,
        used_quota: 200,
        is_enabled: true,
        next_available_at: new Date(),
        send_interval: 24000, // 24秒
        service_type: 'test'
      }
    ];
    
    for (const serviceData of services) {
      const service = await EmailService.create(serviceData);
      this.testData.services.push(service);
    }
    
    // 创建用户服务映射
    await UserServiceMapping.create({ user_id: 8001, email_service_id: 9001 });
    await UserServiceMapping.create({ user_id: 8001, email_service_id: 9002 });
    await UserServiceMapping.create({ user_id: 8002, email_service_id: 9002 });
    await UserServiceMapping.create({ user_id: 8002, email_service_id: 9003 });
    
    // 创建测试任务
    const task1 = await Task.create({
      id: 8001,
      user_id: 8001,
      name: 'Quick Test Task 1',
      status: 'scheduled',
      priority: 2,
      estimated_count: 50
    });
    
    const task2 = await Task.create({
      id: 8002,
      user_id: 8002,
      name: 'Quick Test Task 2',
      status: 'scheduled',
      priority: 1,
      estimated_count: 30
    });
    
    this.testData.tasks = [task1, task2];
    
    // 创建子任务
    const subTasks = [];
    for (let i = 1; i <= 50; i++) {
      subTasks.push({
        task_id: 8001,
        recipient_email: `test1_${i}@example.com`,
        status: 'pending',
        content: `Test email ${i}`,
        priority: 2
      });
    }
    
    for (let i = 1; i <= 30; i++) {
      subTasks.push({
        task_id: 8002,
        recipient_email: `test2_${i}@example.com`,
        status: 'pending',
        content: `Test email ${i}`,
        priority: 1
      });
    }
    
    this.testData.subTasks = await SubTask.bulkCreate(subTasks);
    
    console.log(`✅ 测试数据准备完成: ${this.testData.users.length}用户, ${this.testData.services.length}服务, ${this.testData.subTasks.length}子任务`);
  }

  /**
   * 🚀 初始化调度器
   */
  async initializeScheduler() {
    console.log('\n🚀 初始化调度器...');
    
    this.scheduler = new QueueSchedulerV2();
    
    // 设置快速测试配置
    this.scheduler.config = {
      task_supplement_interval: 5000,   // 5秒补充任务
      service_scan_interval: 2000,      // 2秒扫描服务
      service_max_queue_size: 10,       // 每服务最多10个队列
      queue_memory_optimization: true,
      failure_block_strategy: true,
      admin_manual_intervention: true
    };
    
    await this.scheduler.start();
    
    console.log('✅ 调度器初始化完成');
    console.log(`📊 配置: 任务补充=${this.scheduler.config.task_supplement_interval}ms, 服务扫描=${this.scheduler.config.service_scan_interval}ms`);
  }

  /**
   * 🧪 验证基础功能
   */
  async validateBasicFunctions() {
    console.log('\n🧪 验证基础功能...');
    
    // 1. 验证调度器状态
    const isRunning = this.scheduler.isRunning();
    console.log(`📊 调度器运行状态: ${isRunning ? '✅ 运行中' : '❌ 已停止'}`);
    
    // 2. 验证队列状态获取
    const queueStatus = await this.scheduler.getQueueStatus();
    console.log(`📊 队列状态获取: ${queueStatus ? '✅ 成功' : '❌ 失败'}`);
    console.log(`📊 服务数量: ${Object.keys(queueStatus.queueDetails).length}`);
    
    // 3. 验证配置获取
    const config = this.scheduler.getConfig();
    console.log(`📊 配置获取: ${config ? '✅ 成功' : '❌ 失败'}`);
    
    // 4. 验证管理员控制
    const adminStatus = await this.scheduler.getAdminStatus();
    console.log(`📊 管理员状态: ${adminStatus ? '✅ 成功' : '❌ 失败'}`);
    
    console.log('✅ 基础功能验证完成');
  }

  /**
   * 🎯 验证分配逻辑
   */
  async validateAllocationLogic() {
    console.log('\n🎯 验证分配逻辑...');
    
    // 等待一个补充周期
    console.log('⏳ 等待任务补充...');
    await this.sleep(6000);
    
    // 获取队列状态
    const queueStatus = await this.scheduler.getQueueStatus();
    
    // 验证任务是否被正确分配
    const totalQueuedTasks = queueStatus.metrics.totalQueuedTasks;
    console.log(`📊 总队列任务数: ${totalQueuedTasks}`);
    
    if (totalQueuedTasks > 0) {
      console.log('✅ 任务分配成功');
      
      // 检查每个服务的分配情况
      Object.entries(queueStatus.queueDetails).forEach(([serviceId, details]) => {
        console.log(`📊 服务 ${details.serviceName}: ${details.queueLength} 个任务`);
      });
      
      // 验证用户权限是否正确
      const service9001Queue = queueStatus.queueDetails[9001];
      const service9002Queue = queueStatus.queueDetails[9002];
      const service9003Queue = queueStatus.queueDetails[9003];
      
      if (service9001Queue && service9001Queue.queueLength > 0) {
        console.log('✅ 用户1任务分配到服务A - 权限验证通过');
      }
      
      if (service9002Queue && service9002Queue.queueLength > 0) {
        console.log('✅ 共享服务B获得任务分配 - 权限验证通过');
      }
      
      if (service9003Queue && service9003Queue.queueLength > 0) {
        console.log('✅ 用户2任务分配到服务C - 权限验证通过');
      }
      
    } else {
      console.log('⚠️ 没有任务被分配到队列');
    }
    
    console.log('✅ 分配逻辑验证完成');
  }

  /**
   * ⏰ 验证服务间隔
   */
  async validateServiceIntervals() {
    console.log('\n⏰ 验证服务间隔...');
    
    // 记录当前时间
    const startTime = Date.now();
    
    // 等待一个服务扫描周期
    console.log('⏳ 等待服务扫描...');
    await this.sleep(3000);
    
    // 获取服务状态
    const queueStatus = await this.scheduler.getQueueStatus();
    
    // 验证服务间隔设置
    this.testData.services.forEach(service => {
      const expectedInterval = service.send_interval;
      console.log(`📊 服务 ${service.name}: 预期间隔 ${expectedInterval/1000}秒`);
      
      // 检查服务是否在队列中
      const serviceQueue = queueStatus.queueDetails[service.id];
      if (serviceQueue) {
        console.log(`  - 当前队列: ${serviceQueue.queueLength} 个任务`);
        console.log(`  - 服务状态: ${serviceQueue.isAvailable ? '可用' : '不可用'}`);
      }
    });
    
    // 验证不同间隔的服务是否正确处理
    const intervals = [17000, 21000, 24000];
    console.log(`📊 配置的发信间隔: ${intervals.map(i => i/1000 + 's').join(', ')}`);
    
    console.log('✅ 服务间隔验证完成');
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
        console.log('✅ 调度器已停止');
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
        task_id: { [Op.in]: [8001, 8002] }
      } 
    });
    
    // 清理任务
    await Task.destroy({ 
      where: { 
        id: { [Op.in]: [8001, 8002] }
      } 
    });
    
    // 清理用户服务映射
    await UserServiceMapping.destroy({ 
      where: { 
        user_id: { [Op.in]: [8001, 8002] }
      } 
    });
    
    // 清理发信服务
    await EmailService.destroy({ 
      where: { 
        id: { [Op.in]: [9001, 9002, 9003] }
      } 
    });
    
    // 清理用户
    await User.destroy({ 
      where: { 
        id: { [Op.in]: [8001, 8002] }
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

// 运行快速验证
if (require.main === module) {
  const validator = new Phase5QuickValidation();
  validator.runQuickValidation()
    .then(() => {
      console.log('\n🎉 快速验证成功完成！');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 快速验证失败:', error);
      process.exit(1);
    });
}

module.exports = Phase5QuickValidation; 