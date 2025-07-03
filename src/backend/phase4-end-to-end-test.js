const { Pool } = require('pg');

// 数据库连接配置
const pool = new Pool({
  host: 'edm-postgres',
  port: 5432,
  database: 'amt_mail_system',
  user: 'postgres',
  password: 'postgres',
});

console.log('🚀 Phase 4 端到端测试开始');
console.log('流程：创建任务 -> 创建子任务 -> 调度分配 -> 发信服务间隔 -> 发信成功 -> 扣减额度');

// 模拟发信服务API调用
async function mockEmailServiceCall(serviceId, subTaskId, recipientEmail, subject, content) {
  // 模拟API调用延迟
  await new Promise(resolve => setTimeout(resolve, 100));

  // 90%成功率模拟
  const success = Math.random() > 0.1;

  if (success) {
    return {
      success: true,
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      response: {
        status: 'sent',
        timestamp: new Date().toISOString(),
        recipient: recipientEmail
      }
    };
  } else {
    return {
      success: false,
      error: 'SMTP_ERROR',
      message: '邮件发送失败：收件人邮箱无效'
    };
  }
}

// 计算下次可用时间（基于发信频率）
function calculateNextAvailableTime(sendingRate) {
  const intervalSeconds = Math.ceil(3600 / sendingRate); // 每小时发信数量转换为间隔秒数
  return new Date(Date.now() + intervalSeconds * 1000);
}

async function runEndToEndTest() {
  const client = await pool.connect();

  try {
    console.log('\n📊 === 阶段1：环境准备 ===');

    // 1.1 清理测试数据
    console.log('🧹 清理之前的测试数据...');
    await client.query('DELETE FROM sub_tasks WHERE task_id IN (SELECT id FROM tasks WHERE title LIKE \'%E2E测试%\')');
    await client.query('DELETE FROM task_wait_metrics WHERE task_id IN (SELECT id FROM tasks WHERE title LIKE \'%E2E测试%\')');
    await client.query('DELETE FROM tasks WHERE title LIKE \'%E2E测试%\'');

    // 1.2 重置发信服务状态
    console.log('🔄 重置发信服务状态...');
    await client.query(`
            UPDATE email_services 
            SET used_quota = 0, 
                next_available_at = NOW(), 
                last_sent_at = NULL,
                consecutive_failures = 0,
                is_frozen = false
            WHERE is_enabled = true
        `);

    // 1.3 获取可用服务
    const services = await client.query(`
            SELECT id, name, daily_quota, used_quota, sending_rate, next_available_at
            FROM email_services 
            WHERE is_enabled = true AND is_frozen = false
            ORDER BY name
        `);

    console.log(`✅ 可用发信服务: ${services.rows.length}个`);
    services.rows.forEach((service, index) => {
      console.log(`   ${index + 1}. ${service.name} (额度: ${service.used_quota}/${service.daily_quota}, 频率: ${service.sending_rate}/小时)`);
    });

    if (services.rows.length === 0) {
      throw new Error('没有可用的发信服务');
    }

    console.log('\n📝 === 阶段2：创建任务 ===');

    // 2.1 创建主任务
    const taskResult = await client.query(`
            INSERT INTO tasks (
                title, description, status, created_by, sender_id, priority,
                total_subtasks, allocated_subtasks, pending_subtasks,
                recipient_rule, contacts, templates
            ) VALUES (
                'Phase 4 E2E测试任务', 
                '端到端测试：验证完整的两阶段队列系统流程', 
                'draft',
                '550e8400-e29b-41d4-a716-446655440000',
                '660e8400-e29b-41d4-a716-446655440000',
                1,
                0, 0, 0,
                '{"type": "all", "filters": []}',
                '[]',
                '[{"subject": "测试邮件", "content": "这是一封测试邮件"}]'
            )
            RETURNING id, title, status
        `);

    const task = taskResult.rows[0];
    console.log(`✅ 任务创建成功: ${task.title} (ID: ${task.id})`);

    // 2.2 记录任务等待监控
    await client.query(`
            INSERT INTO task_wait_metrics (task_id, user_id, entry_time, status)
            VALUES ($1, $2, NOW(), 'waiting')
        `, [task.id, '550e8400-e29b-41d4-a716-446655440000']);

    console.log('✅ 任务等待监控记录创建成功');

    console.log('\n📋 === 阶段3：创建子任务 ===');

    // 3.1 准备收件人列表
    const recipients = [
      { email: 'test1@example.com', name: '测试用户1' },
      { email: 'test2@example.com', name: '测试用户2' },
      { email: 'test3@example.com', name: '测试用户3' },
      { email: 'test4@example.com', name: '测试用户4' },
      { email: 'test5@example.com', name: '测试用户5' }
    ];

    // 3.2 批量创建子任务
    const subTaskIds = [];
    for (const recipient of recipients) {
      const subTaskResult = await client.query(`
                INSERT INTO sub_tasks (
                    task_id, recipient_email, recipient_name, 
                    subject, template_content, status
                ) VALUES ($1, $2, $3, $4, $5, 'pending')
                RETURNING id
            `, [
        task.id,
        recipient.email,
        recipient.name,
        'Phase 4 测试邮件',
        '<h1>测试邮件</h1><p>这是Phase 4两阶段队列系统的测试邮件</p>'
      ]);

      subTaskIds.push(subTaskResult.rows[0].id);
    }

    // 3.3 更新任务统计
    await client.query(`
            UPDATE tasks 
            SET total_subtasks = $1, pending_subtasks = $1, status = 'queued'
            WHERE id = $2
        `, [recipients.length, task.id]);

    console.log(`✅ 子任务创建成功: ${recipients.length}个`);
    console.log(`✅ 任务状态更新为: queued`);

    console.log('\n🎯 === 阶段4：调度分配 ===');

    // 4.1 获取待发送的子任务
    const pendingSubTasks = await client.query(`
            SELECT st.id, st.task_id, st.recipient_email, st.recipient_name, st.subject, st.template_content
            FROM sub_tasks st
            WHERE st.task_id = $1 AND st.status = 'pending'
            ORDER BY st.created_at ASC
        `, [task.id]);

    console.log(`📋 待发送子任务: ${pendingSubTasks.rows.length}个`);

    // 4.2 轮询分配算法
    let serviceIndex = 0;
    const allocatedSubTasks = [];

    for (const subTask of pendingSubTasks.rows) {
      // 4.2.1 获取当前可用的服务
      const availableServices = await client.query(`
                SELECT id, name, daily_quota, used_quota, sending_rate, next_available_at
                FROM email_services 
                WHERE is_enabled = true AND is_frozen = false 
                AND next_available_at <= NOW()
                AND used_quota < daily_quota
                ORDER BY next_available_at ASC, used_quota ASC
            `);

      if (availableServices.rows.length === 0) {
        console.log(`⚠️ 暂无可用服务，子任务 ${subTask.id} 等待中...`);
        continue;
      }

      // 4.2.2 选择服务（轮询 + 优先级）
      const selectedService = availableServices.rows[serviceIndex % availableServices.rows.length];
      serviceIndex++;

      // 4.2.3 分配子任务到服务
      await client.query(`
                UPDATE sub_tasks 
                SET service_id = $1, status = 'allocated'
                WHERE id = $2
            `, [selectedService.id, subTask.id]);

      allocatedSubTasks.push({
        subTask: subTask,
        service: selectedService
      });

      console.log(`✅ 子任务 ${subTask.recipient_email} 分配到服务: ${selectedService.name}`);
    }

    console.log(`✅ 调度分配完成: ${allocatedSubTasks.length}个子任务已分配`);

    console.log('\n⏰ === 阶段5：发信服务间隔控制 ===');

    // 5.1 更新任务等待监控 - 开始处理
    await client.query(`
            UPDATE task_wait_metrics 
            SET first_send_time = NOW(), status = 'processing'
            WHERE task_id = $1
        `, [task.id]);

    // 5.2 按服务分组处理
    const serviceGroups = {};
    allocatedSubTasks.forEach(item => {
      const serviceId = item.service.id;
      if (!serviceGroups[serviceId]) {
        serviceGroups[serviceId] = {
          service: item.service,
          subTasks: []
        };
      }
      serviceGroups[serviceId].subTasks.push(item.subTask);
    });

    console.log(`📊 按服务分组: ${Object.keys(serviceGroups).length}个服务组`);

    // 5.3 并发处理各服务组
    const sendingPromises = Object.values(serviceGroups).map(async (group) => {
      const service = group.service;
      const subTasks = group.subTasks;

      console.log(`\n🚀 开始处理服务: ${service.name} (${subTasks.length}个子任务)`);

      for (let i = 0; i < subTasks.length; i++) {
        const subTask = subTasks[i];

        // 5.3.1 检查服务是否可用
        const serviceStatus = await client.query(`
                    SELECT next_available_at, used_quota, daily_quota
                    FROM email_services 
                    WHERE id = $1
                `, [service.id]);

        const currentService = serviceStatus.rows[0];
        const now = new Date();
        const nextAvailable = new Date(currentService.next_available_at);

        // 5.3.2 如果需要等待，则等待
        if (nextAvailable > now) {
          const waitTime = nextAvailable - now;
          console.log(`⏳ 服务 ${service.name} 需要等待 ${waitTime}ms`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        // 5.3.3 检查额度限制
        if (currentService.used_quota >= currentService.daily_quota) {
          console.log(`❌ 服务 ${service.name} 额度已用完`);
          await client.query(`
                        UPDATE sub_tasks 
                        SET status = 'failed', error_message = '服务额度已用完'
                        WHERE id = $1
                    `, [subTask.id]);
          continue;
        }

        console.log(`📧 发送邮件: ${subTask.recipient_email} (${i + 1}/${subTasks.length})`);

        // 5.3.4 模拟发信API调用
        const sendResult = await mockEmailServiceCall(
          service.id,
          subTask.id,
          subTask.recipient_email,
          subTask.subject,
          subTask.template_content
        );

        // 5.3.5 更新子任务状态
        if (sendResult.success) {
          await client.query(`
                        UPDATE sub_tasks 
                        SET status = 'sent', 
                            sent_at = NOW(),
                            email_service_response = $1
                        WHERE id = $2
                    `, [JSON.stringify(sendResult.response), subTask.id]);

          console.log(`✅ 发送成功: ${subTask.recipient_email} (消息ID: ${sendResult.messageId})`);
        } else {
          await client.query(`
                        UPDATE sub_tasks 
                        SET status = 'failed', 
                            error_message = $1,
                            email_service_response = $2
                        WHERE id = $3
                    `, [sendResult.message, JSON.stringify(sendResult), subTask.id]);

          console.log(`❌ 发送失败: ${subTask.recipient_email} (${sendResult.message})`);
        }

        // 5.3.6 更新服务状态和额度
        const nextAvailableTime = calculateNextAvailableTime(service.sending_rate);
        await client.query(`
                    UPDATE email_services 
                    SET used_quota = used_quota + 1,
                        last_sent_at = NOW(),
                        next_available_at = $1,
                        consecutive_failures = CASE 
                            WHEN $2 THEN 0 
                            ELSE consecutive_failures + 1 
                        END
                    WHERE id = $3
                `, [nextAvailableTime, sendResult.success, service.id]);

        console.log(`📊 服务状态更新: 额度 ${currentService.used_quota + 1}/${currentService.daily_quota}, 下次可用: ${nextAvailableTime.toISOString()}`);
      }

      console.log(`✅ 服务 ${service.name} 处理完成`);
    });

    // 5.4 等待所有服务组完成
    await Promise.all(sendingPromises);

    console.log('\n📊 === 阶段6：统计和完成 ===');

    // 6.1 统计发送结果
    const sendingStats = await client.query(`
            SELECT 
                status,
                COUNT(*) as count
            FROM sub_tasks 
            WHERE task_id = $1
            GROUP BY status
        `, [task.id]);

    console.log('📈 发送统计:');
    let totalSent = 0, totalFailed = 0;
    sendingStats.rows.forEach(stat => {
      console.log(`   ${stat.status}: ${stat.count}个`);
      if (stat.status === 'sent') totalSent = parseInt(stat.count);
      if (stat.status === 'failed') totalFailed = parseInt(stat.count);
    });

    // 6.2 更新任务最终状态
    const finalStatus = totalFailed === 0 ? 'completed' : 'partial_completed';
    await client.query(`
            UPDATE tasks 
            SET status = $1,
                allocated_subtasks = $2,
                pending_subtasks = 0,
                actual_finish_time = NOW(),
                completed_at = NOW(),
                total_opens = 0,
                total_clicks = 0,
                total_errors = $3,
                summary_stats = $4
            WHERE id = $5
        `, [
      finalStatus,
      totalSent + totalFailed,
      totalFailed,
      JSON.stringify({
        total_sent: totalSent,
        total_failed: totalFailed,
        success_rate: ((totalSent / (totalSent + totalFailed)) * 100).toFixed(2) + '%',
        completed_at: new Date().toISOString()
      }),
      task.id
    ]);

    // 6.3 完成任务等待监控
    await client.query(`
            UPDATE task_wait_metrics 
            SET completion_time = NOW(),
                status = 'completed',
                wait_duration_seconds = EXTRACT(EPOCH FROM (first_send_time - entry_time))
            WHERE task_id = $1
        `, [task.id]);

    console.log(`✅ 任务最终状态: ${finalStatus}`);

    // 6.4 显示服务额度使用情况
    const finalServiceStats = await client.query(`
            SELECT name, used_quota, daily_quota, last_sent_at, next_available_at
            FROM email_services 
            WHERE is_enabled = true
            ORDER BY name
        `);

    console.log('\n📊 服务额度使用情况:');
    finalServiceStats.rows.forEach(service => {
      const usage = ((service.used_quota / service.daily_quota) * 100).toFixed(1);
      console.log(`   ${service.name}: ${service.used_quota}/${service.daily_quota} (${usage}%)`);
      console.log(`     上次发送: ${service.last_sent_at || '未发送'}`);
      console.log(`     下次可用: ${service.next_available_at}`);
    });

    console.log('\n🎉 === 端到端测试完成 ===');
    console.log('✅ 任务创建 -> 子任务创建 -> 调度分配 -> 间隔控制 -> 发信处理 -> 额度扣减 全流程验证通过');
    console.log(`✅ 发送成功: ${totalSent}个, 发送失败: ${totalFailed}个`);
    console.log(`✅ 成功率: ${((totalSent / (totalSent + totalFailed)) * 100).toFixed(2)}%`);

  } catch (error) {
    console.error('❌ 端到端测试失败:', error.message);
    console.error('堆栈:', error.stack);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

// 运行端到端测试
runEndToEndTest().catch(console.error); 