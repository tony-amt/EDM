#!/bin/bash

# 修复队列调度器过早分配问题 - 让服务分配在消费时进行
# 2025-07-01

set -e

echo "🔧 开始修复队列调度器过早分配问题..."

# SSH配置
SSH_CMD="sshpass -p 'Tony1231!' ssh ubuntu@43.135.38.15"

# 1. 备份原始文件
echo "📋 备份原始队列调度器文件..."
$SSH_CMD "cd /opt/edm && cp src/backend/src/services/infrastructure/QueueScheduler.js src/backend/src/services/infrastructure/QueueScheduler.js.backup"

# 2. 修复generateTaskQueue方法 - 只创建SubTask，不分配服务
echo "🔧 修复generateTaskQueue方法..."
$SSH_CMD "cd /opt/edm && python3 << 'EOF'
import re

# 读取文件
with open('src/backend/src/services/infrastructure/QueueScheduler.js', 'r') as f:
    content = f.read()

# 修复generateTaskQueue方法 - 移除阶段2的立即分配
old_generate_queue = r'''// 7. 阶段2：分配发信服务
      await this.allocateSubTasks\(taskId, transaction\);

      // 8. 更新任务状态
      await task.update\(\{
        status: 'queued',
        total_subtasks: subTasks.length,
        pending_subtasks: 0,          // 阶段2后应该没有pending了
        allocated_subtasks: subTasks.length
      \}, \{ transaction \}\);'''

new_generate_queue = '''// 7. 🔧 修复：不在创建时分配服务，保持pending状态
      // await this.allocateSubTasks(taskId, transaction); // 移除立即分配

      // 8. 更新任务状态 - 保持pending状态
      await task.update({
        status: 'queued',
        total_subtasks: subTasks.length,
        pending_subtasks: subTasks.length,  // 🔧 修复：保持pending状态
        allocated_subtasks: 0               // 🔧 修复：暂时不分配
      }, { transaction });'''

content = re.sub(old_generate_queue, new_generate_queue, content, flags=re.DOTALL)

# 写回文件
with open('src/backend/src/services/infrastructure/QueueScheduler.js', 'w') as f:
    f.write(content)

print("✅ generateTaskQueue方法修复完成")
EOF"

# 3. 修复processTaskQueue方法 - 在消费时动态分配服务
echo "🔧 修复processTaskQueue方法..."
$SSH_CMD "cd /opt/edm && python3 << 'EOF'
import re

# 读取文件
with open('src/backend/src/services/infrastructure/QueueScheduler.js', 'r') as f:
    content = f.read()

# 找到processTaskQueue方法并修复
# 在处理SubTask之前添加动态分配逻辑
old_process_logic = r'''// 获取allocated状态的SubTask进行发送
      const allocatedSubTasks = await SubTask.findAll\(\{
        where: \{
          task_id: taskId,
          status: 'allocated'
        \},
        limit: Math.min\(batchSize, 10\) // 限制批量大小
      \}\);'''

new_process_logic = '''// 🔧 修复：先动态分配pending状态的SubTask
      await this.dynamicAllocateSubTasks(taskId, Math.min(batchSize, 10));
      
      // 获取allocated状态的SubTask进行发送
      const allocatedSubTasks = await SubTask.findAll({
        where: {
          task_id: taskId,
          status: 'allocated'
        },
        limit: Math.min(batchSize, 10) // 限制批量大小
      });'''

content = re.sub(old_process_logic, new_process_logic, content, flags=re.DOTALL)

# 写回文件
with open('src/backend/src/services/infrastructure/QueueScheduler.js', 'w') as f:
    f.write(content)

print("✅ processTaskQueue方法修复完成")
EOF"

# 4. 添加新的dynamicAllocateSubTasks方法
echo "🔧 添加动态分配方法..."
$SSH_CMD "cd /opt/edm && python3 << 'EOF'
import re

# 读取文件
with open('src/backend/src/services/infrastructure/QueueScheduler.js', 'r') as f:
    content = f.read()

# 在allocateSubTasks方法后添加新的动态分配方法
allocation_method = '''
  /**
   * 🔧 新增：动态分配SubTask到发信服务（消费时分配）
   * @param {string} taskId - 任务ID
   * @param {number} batchSize - 批量大小
   */
  async dynamicAllocateSubTasks(taskId, batchSize = 10) {
    try {
      // 1. 获取pending状态的SubTask
      const pendingSubTasks = await SubTask.findAll({
        where: {
          task_id: taskId,
          status: 'pending'
        },
        limit: batchSize
      });

      if (pendingSubTasks.length === 0) {
        return { allocated: 0, message: '无pending状态的SubTask' };
      }

      // 2. 获取当前可用的发信服务
      const availableServices = await this.getAvailableEmailServices();
      
      if (availableServices.length === 0) {
        logger.warn(\`⚠️ 动态分配失败：没有可用的发信服务，任务 \${taskId}\`);
        return { allocated: 0, message: '没有可用的发信服务' };
      }

      // 3. 使用轮询策略分配SubTask到服务
      let allocatedCount = 0;
      let serviceIndex = 0;

      for (const subTask of pendingSubTasks) {
        const service = availableServices[serviceIndex % availableServices.length];
        
        // 更新SubTask状态和分配信息
        await subTask.update({
          status: 'allocated',
          email_service_id: service.id,
          sender_email: service.sender_email,
          sender_name: service.sender_name,
          allocated_at: new Date()
        });

        allocatedCount++;
        serviceIndex++;
        
        logger.info(\`🎯 动态分配SubTask: \${subTask.id} → \${service.service_name}\`);
      }

      // 4. 更新任务统计
      const task = await Task.findByPk(taskId);
      if (task) {
        await task.update({
          pending_subtasks: task.pending_subtasks - allocatedCount,
          allocated_subtasks: task.allocated_subtasks + allocatedCount
        });
      }

      logger.info(\`✅ 动态分配完成：任务 \${taskId} 分配了 \${allocatedCount} 个SubTask到 \${availableServices.length} 个服务\`);
      
      return {
        allocated: allocatedCount,
        total_pending: pendingSubTasks.length,
        services_used: availableServices.length
      };

    } catch (error) {
      logger.error(\`❌ 动态分配失败：任务 \${taskId}\`, error);
      return { allocated: 0, error: error.message };
    }
  }
'''

# 在allocateSubTasks方法后插入新方法
insert_position = content.find('  /**\n   * 🔧 新增：获取可用发信服务（轮询策略）')
if insert_position != -1:
    content = content[:insert_position] + allocation_method + '\n' + content[insert_position:]
else:
    # 如果找不到插入位置，在文件末尾前插入
    insert_position = content.rfind('module.exports = QueueScheduler;')
    if insert_position != -1:
        content = content[:insert_position] + allocation_method + '\n' + content[insert_position:]

# 写回文件
with open('src/backend/src/services/infrastructure/QueueScheduler.js', 'w') as f:
    f.write(content)

print("✅ dynamicAllocateSubTasks方法添加完成")
EOF"

# 5. 重启后端容器应用修复
echo "🔄 重启后端容器应用修复..."
$SSH_CMD "cd /opt/edm && sudo docker restart edm-backend"

# 6. 等待容器启动
echo "⏳ 等待后端容器启动..."
sleep 8

# 7. 验证修复效果
echo "🧪 验证队列调度器修复效果..."
$SSH_CMD "cd /opt/edm && echo '=== 查看启动日志是否正常 ===' && sudo docker logs edm-backend --tail 10"

echo ""
echo "✅ 队列调度器过早分配问题修复完成！"
echo "🔧 主要修复："
echo "   - generateTaskQueue：只创建pending状态的SubTask，不立即分配服务"
echo "   - processTaskQueue：在消费时调用动态分配方法"
echo "   - dynamicAllocateSubTasks：新增动态分配方法，在消费时才分配服务"
echo ""
echo "📋 设计改进："
echo "   创建时：Task → SubTask(pending状态)"
echo "   消费时：动态查找可用服务 → 分配服务 → 发送邮件"
echo ""
echo "🎯 这样可以确保："
echo "   - 服务分配基于实时可用性"
echo "   - 避免服务状态变化导致的任务卡死"
echo "   - 更好的负载均衡效果" 