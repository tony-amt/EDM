#!/usr/bin/env node

const axios = require('axios');

// 生产环境配置
const BASE_URL = 'https://tkmail.fun/api';
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjczYjU3MDI4LWIyYzYtNDkzZi04ZTA5LTA3MjQyZjljYTM1MSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1MDkzMzY3OCwiZXhwIjoxNzUxMDIwMDc4fQ.zqezZQmP4kcMFgvJKAv551RGeE7XF4ca433PsIxuvUA';

// 创建axios实例
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${TEST_TOKEN}`,
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

// 性能测试函数
async function performanceTest(endpoint, description) {
  console.log(`\n🔍 测试: ${description}`);
  console.log(`📡 端点: ${endpoint}`);

  const startTime = Date.now();

  try {
    const response = await api.get(endpoint);
    const endTime = Date.now();
    const duration = endTime - startTime;

    const dataSize = JSON.stringify(response.data).length;
    const recordCount = Array.isArray(response.data.data) ? response.data.data.length : 1;

    console.log(`✅ 响应时间: ${duration}ms`);
    console.log(`📊 数据大小: ${(dataSize / 1024).toFixed(2)}KB`);
    console.log(`📋 记录数量: ${recordCount}`);
    console.log(`⚡ 平均每条记录: ${(duration / recordCount).toFixed(2)}ms`);

    // 性能评级
    let performance = '🟢 优秀';
    if (duration > 2000) performance = '🔴 严重';
    else if (duration > 1000) performance = '🟡 需优化';
    else if (duration > 500) performance = '🟠 一般';

    console.log(`🎯 性能评级: ${performance}`);

    return {
      endpoint,
      description,
      duration,
      dataSize,
      recordCount,
      performance: performance.split(' ')[1]
    };

  } catch (error) {
    console.log(`❌ 请求失败: ${error.message}`);
    return {
      endpoint,
      description,
      duration: -1,
      error: error.message
    };
  }
}

// 主测试函数
async function runPerformanceAnalysis() {
  console.log('🚀 === EDM系统深度性能分析 === 🚀');
  console.log(`🕐 开始时间: ${new Date().toLocaleString()}`);

  const tests = [
    // 管理页面API测试
    { endpoint: '/users', description: '用户管理页面' },
    { endpoint: '/templates', description: '模板管理页面' },
    { endpoint: '/senders', description: '发信人管理页面' },
    { endpoint: '/contacts', description: '联系人管理页面' },
    { endpoint: '/tags', description: '标签管理页面' },
    { endpoint: '/campaigns', description: '群发任务页面' },

    // 仪表盘相关
    { endpoint: '/dashboard/stats', description: '仪表盘统计' },

    // 分页测试
    { endpoint: '/contacts?page=1&limit=10', description: '联系人分页(10条)' },
    { endpoint: '/contacts?page=1&limit=50', description: '联系人分页(50条)' },
    { endpoint: '/contacts?page=1&limit=100', description: '联系人分页(100条)' },

    // 搜索测试
    { endpoint: '/contacts?search=test', description: '联系人搜索' },
    { endpoint: '/users?search=admin', description: '用户搜索' },
  ];

  const results = [];

  for (const test of tests) {
    const result = await performanceTest(test.endpoint, test.description);
    results.push(result);

    // 避免请求过于频繁
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // 生成性能报告
  console.log('\n📊 === 性能分析报告 === 📊');

  const slowApis = results.filter(r => r.duration > 1000).sort((a, b) => b.duration - a.duration);
  const fastApis = results.filter(r => r.duration > 0 && r.duration <= 500);
  const errorApis = results.filter(r => r.duration === -1);

  if (slowApis.length > 0) {
    console.log('\n🔴 需要紧急优化的API:');
    slowApis.forEach(api => {
      console.log(`  - ${api.description}: ${api.duration}ms (${api.recordCount}条记录)`);
    });
  }

  if (fastApis.length > 0) {
    console.log('\n🟢 性能良好的API:');
    fastApis.forEach(api => {
      console.log(`  - ${api.description}: ${api.duration}ms`);
    });
  }

  if (errorApis.length > 0) {
    console.log('\n❌ 请求失败的API:');
    errorApis.forEach(api => {
      console.log(`  - ${api.description}: ${api.error}`);
    });
  }

  // 计算平均性能
  const validResults = results.filter(r => r.duration > 0);
  const avgDuration = validResults.reduce((sum, r) => sum + r.duration, 0) / validResults.length;

  console.log(`\n📈 系统平均响应时间: ${avgDuration.toFixed(2)}ms`);
  console.log(`🎯 性能目标: <500ms (当前: ${avgDuration > 500 ? '未达标' : '达标'})`);

  // 优化建议
  console.log('\n💡 === 优化建议 === 💡');

  if (slowApis.length > 0) {
    console.log('🔧 后端优化:');
    console.log('  1. 添加数据库索引');
    console.log('  2. 实施查询缓存');
    console.log('  3. 优化N+1查询问题');
    console.log('  4. 减少不必要的关联查询');
  }

  const totalDataSize = validResults.reduce((sum, r) => sum + (r.dataSize || 0), 0);
  if (totalDataSize > 100 * 1024) { // 100KB
    console.log('📦 前端优化:');
    console.log('  1. 实施数据分页');
    console.log('  2. 启用响应压缩');
    console.log('  3. 减少返回字段');
    console.log('  4. 实施客户端缓存');
  }

  console.log(`\n🕐 结束时间: ${new Date().toLocaleString()}`);
}

// 执行分析
runPerformanceAnalysis().catch(console.error); 