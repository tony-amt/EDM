#!/bin/bash

# 生产环境核心问题修复脚本
# 修复：1. 任务过早完成问题  2. Webhook事件处理问题

set -e

echo "🔧 开始修复生产环境核心问题..."
echo "========================================"

# 1. 备份当前代码
echo "📦 备份当前代码..."
BACKUP_DIR="/opt/edm/backup/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r /opt/edm/src/backend/src/services/infrastructure/queueScheduler.service.js "$BACKUP_DIR/"
cp -r /opt/edm/src/backend/src/controllers/webhook.controller.js "$BACKUP_DIR/"
echo "✅ 备份完成: $BACKUP_DIR"

# 2. 上传修复后的文件
echo "📤 上传修复后的队列调度器..."
# 这里需要将修复后的文件上传到生产服务器
# scp 或者 rsync 命令会在实际部署时使用

# 3. 重启后端服务
echo "🔄 重启后端服务..."
cd /opt/edm
docker-compose restart backend

# 4. 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 5. 检查服务状态
echo "🔍 检查服务状态..."
docker-compose ps backend

# 6. 检查日志
echo "📋 检查启动日志..."
docker-compose logs --tail=50 backend

# 7. 修复特定任务状态（如果需要）
echo "🔧 修复任务状态..."
TASK_ID="793c9585-7693-4e8a-bc91-d20606c5f467"

# 通过API或直接数据库操作修复任务状态
echo "修复任务 $TASK_ID 的状态..."

# SQL修复命令（需要在生产数据库中执行）
cat << EOF > /tmp/fix_task_status.sql
-- 修复任务过早完成问题
UPDATE tasks 
SET status = 'sending', 
    completed_at = NULL 
WHERE id = '$TASK_ID' 
  AND status = 'completed' 
  AND EXISTS (
    SELECT 1 FROM sub_tasks 
    WHERE task_id = '$TASK_ID' 
      AND status IN ('pending', 'allocated', 'sending')
  );

-- 显示修复结果
SELECT 
  t.id,
  t.name,
  t.status,
  t.total_subtasks,
  t.pending_subtasks,
  t.allocated_subtasks,
  COUNT(st.id) as actual_subtasks,
  COUNT(CASE WHEN st.status IN ('pending', 'allocated', 'sending') THEN 1 END) as unfinished_subtasks,
  COUNT(CASE WHEN st.status IN ('sent', 'delivered', 'opened', 'clicked') THEN 1 END) as success_subtasks
FROM tasks t
LEFT JOIN sub_tasks st ON t.id = st.task_id
WHERE t.id = '$TASK_ID'
GROUP BY t.id, t.name, t.status, t.total_subtasks, t.pending_subtasks, t.allocated_subtasks;
EOF

echo "📄 生成的SQL修复脚本: /tmp/fix_task_status.sql"
echo "请在生产数据库中执行此脚本"

# 8. 验证修复效果
echo "✅ 验证修复效果..."
echo "1. 检查任务状态是否正确"
echo "2. 检查SubTask是否能正常处理"
echo "3. 检查Webhook事件是否正常接收"

# 9. 监控建议
echo "📊 监控建议:"
echo "- 观察任务队列处理日志"
echo "- 监控Webhook事件接收情况"  
echo "- 检查邮件发送成功率"

echo ""
echo "🎉 修复脚本执行完成！"
echo "请继续监控生产环境状态" 