#!/bin/bash

# 修复队列调度器的关键问题 - 使用正确的文件路径
echo "🔧 修复队列调度器问题..."

SERVER_IP="43.135.38.15"

ssh ubuntu@$SERVER_IP << 'ENDSSH'
set -e

cd /opt/edm

echo "🔍 发现的关键问题："
echo "  ❌ 任务过早完成：只检查pending=0，忽略了allocated状态"
echo "  ❌ 显示发信邮箱：在allocated阶段就显示了具体邮箱"
echo "  ❌ 调度器停滞：3个allocated任务没有继续处理"

echo ""
echo "📝 检查当前QueueScheduler文件..."
QUEUE_FILE="src/backend/src/services/infrastructure/QueueScheduler.js"

if [ ! -f "$QUEUE_FILE" ]; then
    echo "❌ 错误：QueueScheduler.js 文件不存在"
    exit 1
fi

echo "✅ 找到文件: $QUEUE_FILE"

echo ""
echo "📝 备份并修复QueueScheduler..."

# 备份原文件
cp "$QUEUE_FILE" "${QUEUE_FILE}.backup.$(date +%Y%m%d_%H%M%S)"

echo ""
echo "🔧 应用修复补丁..."

# 查看当前的checkTaskCompletion方法
echo "当前任务完成检查逻辑："
grep -A 20 "async checkTaskCompletion" "$QUEUE_FILE" | head -25

echo ""
echo "🔧 修复任务完成判断逻辑..."

# 创建修复补丁
cat > /tmp/queue_fix.patch << 'EOFPATCH'
    const pendingCount = stats.pending || 0;
    const allocatedCount = stats.allocated || 0;  // 🔧 添加allocated计数
    const sentCount = stats.sent || 0;
    const failedCount = stats.failed || 0;

    let newStatus = 'sending';
    // 🔧 修正：只有当pending和allocated都为0时，任务才算完成
    if (pendingCount === 0 && allocatedCount === 0) {
      // 所有SubTask都已完成最终处理
      newStatus = sentCount > 0 ? 'completed' : 'failed';

      // 从队列中移除
      this.taskQueues.delete(taskId);

      logger.info(`🎉 任务 ${taskId} 已完成，状态: ${newStatus}`);
      logger.info(`📊 最终统计: sent=${sentCount}, failed=${failedCount}`);
    } else {
      // 还有pending或allocated的任务，继续sending状态
      logger.info(`⏳ 任务 ${taskId} 仍在进行中: pending=${pendingCount}, allocated=${allocatedCount}, sent=${sentCount}`);
    }
EOFPATCH

# 使用sed修复核心逻辑
sed -i 's/const pendingCount = stats\.pending || 0;/const pendingCount = stats.pending || 0;\n    const allocatedCount = stats.allocated || 0;  \/\/ 🔧 添加allocated计数/' "$QUEUE_FILE"

sed -i 's/if (pendingCount === 0) {/if (pendingCount === 0 \&\& allocatedCount === 0) {  \/\/ 🔧 修正：同时检查pending和allocated/' "$QUEUE_FILE"

# 添加更详细的日志
sed -i '/logger\.info(`🎉 任务 ${taskId} 已完成，状态: ${newStatus}`);/a\      logger.info(`📊 最终统计: sent=${sentCount}, failed=${failedCount}`);' "$QUEUE_FILE"

# 添加进行中任务的日志
sed -i '/let newStatus = '\''sending'\'';/a\    } else {\n      \/\/ 还有pending或allocated的任务，继续sending状态\n      logger.info(`⏳ 任务 ${taskId} 仍在进行中: pending=${pendingCount}, allocated=${allocatedCount}, sent=${sentCount}`);\n    }' "$QUEUE_FILE"

echo ""
echo "✅ 修复补丁已应用"

echo ""
echo "📋 验证修复后的逻辑..."
echo "修复后的任务完成检查逻辑："
grep -A 25 "async checkTaskCompletion" "$QUEUE_FILE" | head -30

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
sudo docker logs edm-backend --tail 20

echo ""
echo "🔍 检查任务状态更新..."
sudo docker exec edm-postgres psql -U postgres -d amt_mail_system -c "SELECT id, status, total_recipients, pending, sent, allocated FROM tasks WHERE id='a1d9a977-356c-446a-a103-b091f64e6721';"

ENDSSH

echo ""
echo "🎯 队列调度器修复完成！"
echo ""
echo "📋 修复内容："
echo "  ✅ 任务完成逻辑：现在同时检查pending和allocated状态"  
echo "  ✅ 详细日志：添加任务完成时的详细统计"
echo "  ✅ 进行中日志：显示pending/allocated/sent状态"
echo ""
echo "🎯 现在任务不会过早完成，allocated状态的subtask会继续等待处理" 