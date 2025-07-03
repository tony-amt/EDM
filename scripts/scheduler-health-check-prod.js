const { Pool } = require('pg');
const config = require('../src/backend/src/config/config.js');

// 数据库连接池
const pool = new Pool({
  host: config.development.host,
  port: config.development.port,
  database: config.development.database,
  username: config.development.username,
  password: config.development.password,
});

// 查询辅助函数
async function query(sql, params = []) {
  try {
    const result = await pool.query(sql, params);
    return result.rows;
  } catch (error) {
    throw error;
  }
}

// 健康检查主函数
async function performHealthCheck() {
  console.log('🏥 开始系统健康检查...\n');
  
  const issues = [];
  const warnings = [];

  // 1. 数据库连接检查
  try {
    await query('SELECT 1');
    console.log('✅ 数据库连接正常');
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    issues.push('数据库连接失败');
    return; // 如果数据库连接失败，不继续其他检查
  }

  // 2. 调度器基础状态检查
  try {
    const schedulerStatus = await query(`
      SELECT key, value 
      FROM system_settings 
      WHERE key IN ('scheduler_status', 'last_scheduler_run')
    `);
    
    const statusMap = {};
    schedulerStatus.forEach(row => {
      statusMap[row.key] = row.value;
    });
    
    if (statusMap.scheduler_status === 'running') {
      console.log('✅ 调度器状态正常');
    } else {
      console.error('❌ 调度器未运行');
      issues.push('调度器未运行');
    }
    
    if (statusMap.last_scheduler_run) {
      const lastRun = new Date(statusMap.last_scheduler_run);
      const now = new Date();
      const diffMinutes = (now - lastRun) / (1000 * 60);
      
      if (diffMinutes > 10) {
        console.error(`❌ 调度器上次运行时间过久: ${Math.round(diffMinutes)}分钟前`);
        issues.push(`调度器上次运行时间过久: ${Math.round(diffMinutes)}分钟前`);
      } else {
        console.log(`✅ 调度器最近运行时间: ${Math.round(diffMinutes)}分钟前`);
      }
    }
  } catch (error) {
    console.error('❌ 调度器状态检查失败:', error.message);
    issues.push('调度器状态检查失败');
  }

  // 3. 发信服务状态检查
  try {
    const emailServices = await query(`
      SELECT id, name, status, domain, daily_limit, used_count 
      FROM email_services 
      WHERE status = 'active'
    `);
    
    console.log(`✅ 发信服务检查: ${emailServices.length} 个可用服务`);
    
    if (emailServices.length < 3) {
      warnings.push(`可用发信服务较少: ${emailServices.length}个`);
      console.log(`⚠️ 可用发信服务数量较少: ${emailServices.length}个`);
    }
    
    // 检查每日限额使用情况
    emailServices.forEach(service => {
      const usagePercent = (service.used_count / service.daily_limit) * 100;
      if (usagePercent > 80) {
        warnings.push(`${service.name} 使用率过高: ${usagePercent.toFixed(1)}%`);
        console.log(`⚠️ ${service.name} 使用率过高: ${usagePercent.toFixed(1)}%`);
      }
    });
    
  } catch (error) {
    console.error('❌ 发信服务检查失败:', error.message);
    issues.push('发信服务检查失败');
  }

  // 4. 用户额度情况检查
  try {
    const userQuotas = await query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN total_quota IS NOT NULL THEN 1 END) as users_with_quota,
        AVG(CASE WHEN total_quota IS NOT NULL THEN total_quota END) as avg_quota,
        SUM(CASE WHEN total_quota IS NOT NULL THEN used_quota END) as total_used
      FROM users
    `);
    
    if (userQuotas.length > 0) {
      const quota = userQuotas[0];
      console.log(`✅ 用户额度检查: ${quota.total_users} 个用户, ${quota.users_with_quota} 个有额度配置`);
      
      if (quota.users_with_quota == 0) {
        warnings.push('用户表缺少total_quota字段或无用户配置额度');
        console.log('⚠️ 用户表缺少total_quota字段或无用户配置额度');
      }
    }
  } catch (error) {
    console.error('❌ 用户额度检查失败:', error.message);
    warnings.push('用户表可能缺少quota相关字段');
  }

  // 5. 子任务处理效率检查
  try {
    const pendingSubtasks = await query(`
      SELECT COUNT(*) as count 
      FROM subtasks 
      WHERE status = 'pending'
    `);
    
    if (pendingSubtasks.length > 0 && pendingSubtasks[0].count > 0) {
      console.error(`❌ 有 ${pendingSubtasks[0].count} 个待处理子任务`);
      issues.push(`有 ${pendingSubtasks[0].count} 个待处理子任务`);
    } else {
      console.log('✅ 无待处理子任务');
    }
  } catch (error) {
    console.error('❌ 子任务检查失败:', error.message);
    warnings.push('子任务表可能不存在或结构异常');
  }

  // 6. 定时任务处理检查
  try {
    const expiredTasks = await query(`
      SELECT COUNT(*) as count 
      FROM tasks 
      WHERE status IN ('scheduled', 'running') 
      AND scheduled_time < NOW() - INTERVAL '1 hour'
    `);
    
    if (expiredTasks.length > 0 && expiredTasks[0].count > 0) {
      console.error(`❌ 有 ${expiredTasks[0].count} 个过期定时任务`);
      issues.push(`有 ${expiredTasks[0].count} 个过期定时任务`);
    } else {
      console.log('✅ 无过期定时任务');
    }
  } catch (error) {
    console.error('❌ 定时任务检查失败:', error.message);
    if (error.message.includes('invalid input value for enum')) {
      warnings.push('tasks表status字段enum类型配置可能有问题');
    } else {
      warnings.push('定时任务检查失败');
    }
  }

  // 7. 发信人配置检查
  try {
    const sendersResult = await query(`
      SELECT 
        s.id, 
        s.name, 
        s.status,
        es.domain,
        CONCAT(s.name, '@', es.domain) as email_address
      FROM senders s
      LEFT JOIN email_services es ON s.service_id = es.id
      WHERE s.status = 'active'
    `);
    
    console.log(`✅ 发信人配置检查: ${sendersResult.length} 个可用发信人`);
    if (sendersResult.length > 0) {
      console.log('📋 可用发信人列表:');
      sendersResult.forEach(sender => {
        console.log(`   - ${sender.name} (${sender.email_address}) [${sender.status}]`);
      });
    }
  } catch (error) {
    console.error('❌ 发信人配置检查失败:', error.message);
    issues.push('发信人配置检查失败');
  }

  // 8. 调度器运行状态检查
  try {
    // 检查是否有调度器进程在运行
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    
    try {
      const { stdout } = await execPromise('ps aux | grep "node.*scheduler" | grep -v grep');
      if (stdout.trim()) {
        console.log('✅ 调度器进程正在运行');
      } else {
        console.error('❌ 未找到调度器进程');
        issues.push('未找到调度器进程');
      }
    } catch (error) {
      console.error('❌ 调度器进程检查失败');
      issues.push('调度器进程检查失败');
    }
  } catch (error) {
    console.error('❌ 调度器运行状态检查失败:', error.message);
    issues.push('调度器运行状态检查失败');
  }

  // 汇总报告
  console.log('\n📊 健康检查报告汇总:');
  console.log('='.repeat(50));
  
  if (issues.length === 0) {
    console.log('🎉 所有检查项目均正常!');
  } else {
    console.log('🚨 发现以下严重问题:');
    issues.forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue}`);
    });
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️ 发现以下警告:');
    warnings.forEach((warning, index) => {
      console.log(`   ${index + 1}. ${warning}`);
    });
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`检查完成时间: ${new Date().toLocaleString()}`);
  
  // 根据问题数量返回不同的退出码
  if (issues.length > 0) {
    process.exit(1); // 有严重问题
  } else if (warnings.length > 0) {
    process.exit(2); // 只有警告
  } else {
    process.exit(0); // 一切正常
  }
}

// 处理未捕获的异常
process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  process.exit(1);
});

// 确保在退出时关闭数据库连接
process.on('SIGINT', async () => {
  console.log('\n正在关闭数据库连接...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n正在关闭数据库连接...');
  await pool.end();
  process.exit(0);
});

// 运行健康检查
if (require.main === module) {
  performHealthCheck().catch(error => {
    console.error('健康检查失败:', error);
    process.exit(1);
  });
}

module.exports = { performHealthCheck }; 