#!/bin/bash

# 修复队列调度器的关键问题
echo "🔧 修复队列调度器问题..."

SERVER_IP="43.135.38.15"

# 创建修复后的QueueScheduler
cat > /tmp/queueScheduler-fix.js << 'EOFFIX'
// 修复任务完成判断逻辑
async checkTaskCompletion(taskId, stats = null) {
  if (!stats) {
    // 如果没有传入统计数据，重新获取
    const statusStats = await SubTask.findAll({
      where: { task_id: taskId },
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    stats = {
      pending: 0,
      allocated: 0,  // 🔧 添加allocated状态
      sent: 0,
      failed: 0,
      delivered: 0,
      total_recipients: 0
    };

    statusStats.forEach(stat => {
      const count = parseInt(stat.count);
      stats[stat.status] = count;
      stats.total_recipients += count;
    });
  }

  const pendingCount = stats.pending || 0;
  const allocatedCount = stats.allocated || 0;  // 🔧 添加allocated计数
  const sentCount = stats.sent || 0;
  const failedCount = stats.failed || 0;
  const deliveredCount = stats.delivered || 0;

  let newStatus = 'sending';
  
  // 🔧 修正：只有当pending和allocated都为0时，任务才算完成
  if (pendingCount === 0 && allocatedCount === 0) {
    // 所有SubTask都已完成最终处理
    newStatus = (sentCount > 0 || deliveredCount > 0) ? 'completed' : 'failed';

    // 从队列中移除
    this.taskQueues.delete(taskId);

    logger.info(`🎉 任务 ${taskId} 已完成，状态: ${newStatus}`);
    logger.info(`📊 最终统计: sent=${sentCount}, delivered=${deliveredCount}, failed=${failedCount}`);
  } else {
    // 还有pending或allocated的任务，继续sending状态
    logger.info(`⏳ 任务 ${taskId} 仍在进行中: pending=${pendingCount}, allocated=${allocatedCount}, sent=${sentCount}`);
  }

  await Task.update({
    status: newStatus,
    completed_at: newStatus === 'completed' ? new Date() : null
  }, {
    where: { id: taskId }
  });
}
EOFFIX

ssh ubuntu@$SERVER_IP << 'ENDSSH'
set -e

cd /opt/edm

echo "🔍 发现的关键问题："
echo "  ❌ 任务过早完成：只检查pending=0，忽略了allocated状态"
echo "  ❌ 显示发信邮箱：在allocated阶段就显示了具体邮箱"
echo "  ❌ 调度器停滞：3个allocated任务没有继续处理"

echo ""
echo "📝 备份并修复QueueScheduler..."

# 备份原文件
cp src/backend/src/services/infrastructure/queueScheduler.service.js src/backend/src/services/infrastructure/queueScheduler.service.js.backup.$(date +%Y%m%d_%H%M%S)

echo ""
echo "🔧 应用修复补丁..."

# 修复任务完成判断逻辑
sed -i 's/const pendingCount = stats.pending || 0;/const pendingCount = stats.pending || 0;\n    const allocatedCount = stats.allocated || 0;  \/\/ 🔧 添加allocated计数/' src/backend/src/services/infrastructure/queueScheduler.service.js

sed -i 's/if (pendingCount === 0) {/if (pendingCount === 0 \&\& allocatedCount === 0) {  \/\/ 🔧 修正：同时检查pending和allocated/' src/backend/src/services/infrastructure/queueScheduler.service.js

# 添加更详细的日志
sed -i 's/logger.info(`🎉 任务 ${taskId} 已完成，状态: ${newStatus}`);/logger.info(`🎉 任务 ${taskId} 已完成，状态: ${newStatus}`);\n      logger.info(`📊 最终统计: sent=${sentCount}, delivered=${deliveredCount}, failed=${failedCount}`);/' src/backend/src/services/infrastructure/queueScheduler.service.js

echo ""
echo "🔄 重启后端容器以应用修复..."
sudo docker restart edm-backend

echo "⏳ 等待后端启动..."
sleep 15

echo ""
echo "🧪 测试修复效果..."
echo "检查容器状态..."
sudo docker ps --filter "name=edm-backend" --format "table {{.Names}}\t{{.Status}}"

echo ""
echo "检查后端日志..."
sudo docker logs edm-backend --tail 10

echo ""
echo "🎯 修复完成！"
echo ""
echo "📋 修复内容："
echo "  ✅ 任务完成逻辑：现在同时检查pending和allocated状态"
echo "  ✅ 详细日志：添加任务完成时的详细统计"
echo ""
echo "⚠️ 仍需解决的问题："
echo "  🔧 发信邮箱显示：需要修改前端显示逻辑，在allocated之前不显示具体邮箱"
echo "  🔧 调度器恢复：需要重新启动任务调度，处理剩余的allocated子任务"

ENDSSH

echo ""
echo "🎯 队列调度器修复完成！"
echo "现在任务不会过早完成，allocated状态的subtask会继续等待处理" 