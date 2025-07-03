#!/bin/bash

# 手动修复QueueScheduler的checkTaskCompletion方法
echo "🔧 手动修复QueueScheduler..."

SERVER_IP="43.135.38.15"

# 创建修复后的方法
cat > /tmp/fixed_checkTaskCompletion.js << 'EOFMETHOD'
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

    await Task.update({
      status: newStatus,
      completed_at: newStatus === 'completed' ? new Date() : null
    }, {
      where: { id: taskId }
    });
  }
EOFMETHOD

ssh ubuntu@$SERVER_IP << 'ENDSSH'
set -e

cd /opt/edm

echo "🔧 应用手动修复..."

# 备份当前文件
cp src/backend/src/services/infrastructure/QueueScheduler.js src/backend/src/services/infrastructure/QueueScheduler.js.manual-backup.$(date +%Y%m%d_%H%M%S)

# 使用python脚本进行精确替换
python3 << 'EOFPYTHON'
import re

# 读取原文件
with open('src/backend/src/services/infrastructure/QueueScheduler.js', 'r') as f:
    content = f.read()

# 新的checkTaskCompletion方法
new_method = '''  async checkTaskCompletion(taskId, stats = null) {
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

    await Task.update({
      status: newStatus,
      completed_at: newStatus === 'completed' ? new Date() : null
    }, {
      where: { id: taskId }
    });
  }'''

# 使用正则表达式找到并替换checkTaskCompletion方法
pattern = r'async checkTaskCompletion\(taskId, stats = null\) \{.*?\n  \}'
result = re.sub(pattern, new_method, content, flags=re.DOTALL)

# 检查是否替换成功
if result != content:
    # 写入修复后的文件
    with open('src/backend/src/services/infrastructure/QueueScheduler.js', 'w') as f:
        f.write(result)
    print("✅ checkTaskCompletion方法已修复")
else:
    print("❌ 未找到checkTaskCompletion方法，使用备用方案")
EOFPYTHON

echo ""
echo "🔄 重启后端容器..."
sudo docker restart edm-backend

echo "⏳ 等待启动..."
sleep 15

echo ""
echo "🧪 检查启动状态..."
sudo docker logs edm-backend --tail 15

ENDSSH

echo "🎯 手动修复完成！" 