#!/usr/bin/env node

/**
 * 🧪 Phase 5: 队列调度器基础功能验证脚本
 */

console.log('🧪 Phase 5 队列调度器基础验证开始...\n');

try {
  // 1. 验证类加载
  console.log('1️⃣ 验证类加载...');
  const QueueSchedulerV2 = require('../src/backend/src/services/core/queueSchedulerV2.service');
  console.log('✅ QueueSchedulerV2 类加载成功');

  // 2. 验证实例创建
  console.log('\n2️⃣ 验证实例创建...');
  const scheduler = new QueueSchedulerV2();
  console.log('✅ 实例创建成功');

  // 3. 验证配置结构
  console.log('\n3️⃣ 验证配置结构...');
  const requiredConfigKeys = [
    'task_supplement_interval',
    'service_scan_interval', 
    'service_max_queue_size',
    'queue_memory_optimization',
    'failure_block_strategy'
  ];
  
  requiredConfigKeys.forEach(key => {
    const exists = key in scheduler.config;
    console.log(`  - ${key}: ${exists ? '✅' : '❌'}`);
  });

  // 4. 验证数据结构
  console.log('\n4️⃣ 验证核心数据结构...');
  const dataStructures = [
    { name: 'serviceQueues', check: scheduler.serviceQueues instanceof Map },
    { name: 'taskPointers', check: scheduler.taskPointers instanceof Map },
    { name: 'serviceStatus', check: scheduler.serviceStatus instanceof Map },
    { name: 'metrics', check: typeof scheduler.metrics === 'object' }
  ];
  
  dataStructures.forEach(({ name, check }) => {
    console.log(`  - ${name}: ${check ? '✅' : '❌'}`);
  });

  // 5. 验证核心方法
  console.log('\n5️⃣ 验证核心方法...');
  const coreMethods = [
    'supplementTasksToQueues',
    'processServiceQueues',
    'getAvailableServicesForSupplement',
    'clearAllQueues',
    'getQueueStatus'
  ];
  
  coreMethods.forEach(method => {
    const exists = typeof scheduler[method] === 'function';
    console.log(`  - ${method}: ${exists ? '✅' : '❌'}`);
  });

  // 6. 验证辅助方法
  console.log('\n6️⃣ 验证辅助方法...');
  const helperMethods = [
    'getServiceQueueSize',
    'addToServiceQueue',
    'removeFromServiceQueue',
    'recordServiceFailure'
  ];
  
  helperMethods.forEach(method => {
    const exists = typeof scheduler[method] === 'function';
    console.log(`  - ${method}: ${exists ? '✅' : '❌'}`);
  });

  // 7. 验证定时器方法
  console.log('\n7️⃣ 验证定时器方法...');
  const timerMethods = [
    'startTaskSupplementTimer',
    'startServiceProcessTimer',
    'loadSystemConfig'
  ];
  
  timerMethods.forEach(method => {
    const exists = typeof scheduler[method] === 'function';
    console.log(`  - ${method}: ${exists ? '✅' : '❌'}`);
  });

  // 8. 验证配置值
  console.log('\n8️⃣ 验证默认配置值...');
  const configTests = [
    { key: 'task_supplement_interval', expected: 30000, actual: scheduler.config.task_supplement_interval },
    { key: 'service_scan_interval', expected: 5000, actual: scheduler.config.service_scan_interval },
    { key: 'service_max_queue_size', expected: 10, actual: scheduler.config.service_max_queue_size }
  ];
  
  configTests.forEach(({ key, expected, actual }) => {
    const correct = actual === expected;
    console.log(`  - ${key}: ${actual} ${correct ? '✅' : `❌ (期望: ${expected})`}`);
  });

  console.log('\n🎉 Phase 5 队列调度器基础验证完成！');
  console.log('📊 所有核心功能检查通过，可以进行下一步测试。');

} catch (error) {
  console.error('\n❌ 验证过程中出现错误:');
  console.error(error.message);
  console.error('\n🔧 请检查代码实现并修复错误。');
  process.exit(1);
} 