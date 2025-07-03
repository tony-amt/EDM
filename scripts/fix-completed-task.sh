#!/bin/bash

# 修复错误标记为completed的任务
echo "🔧 修复错误完成的任务状态..."

SERVER_IP="43.135.38.15"
TASK_ID="a1d9a977-356c-446a-a103-b091f64e6721"

ssh ubuntu@$SERVER_IP << 'ENDSSH'
set -e

cd /opt/edm

echo "🔍 分析任务状态..."

# 检查subtask状态统计
echo "=== SubTask状态统计 ==="
sudo docker exec edm-postgres psql -U postgres -d amt_mail_system -c "
SELECT 
  status, 
  COUNT(*) as count 
FROM sub_tasks 
WHERE task_id='a1d9a977-356c-446a-a103-b091f64e6721' 
GROUP BY status;
"

echo ""
echo "🔧 修复任务状态..."

# 将任务状态从completed改回sending
sudo docker exec edm-postgres psql -U postgres -d amt_mail_system -c "
UPDATE tasks 
SET 
  status = 'sending',
  completed_at = NULL,
  updated_at = NOW()
WHERE id = 'a1d9a977-356c-446a-a103-b091f64e6721' 
  AND status = 'completed';
"

echo "✅ 任务状态已修复为sending"

echo ""
echo "🔍 验证修复结果..."
sudo docker exec edm-postgres psql -U postgres -d amt_mail_system -c "
SELECT id, status, completed_at 
FROM tasks 
WHERE id='a1d9a977-356c-446a-a103-b091f64e6721';
"

echo ""
echo "🔄 重启后端以重新加载任务队列..."
sudo docker restart edm-backend

echo "⏳ 等待后端启动..."
sleep 20

echo ""
echo "🧪 检查调度器重新加载情况..."
sudo docker logs edm-backend --tail 15 | grep -E "队列调度器|任务队列|发信服务"

echo ""
echo "⏳ 等待调度器处理allocated任务..."
sleep 60

echo ""
echo "🔍 检查处理结果..."
echo "=== 最新SubTask状态 ==="
sudo docker exec edm-postgres psql -U postgres -d amt_mail_system -c "
SELECT 
  recipient_email,
  status, 
  service_id,
  scheduled_at,
  sent_at
FROM sub_tasks 
WHERE task_id='a1d9a977-356c-446a-a103-b091f64e6721' 
ORDER BY created_at;
"

echo ""
echo "=== 任务当前状态 ==="
sudo docker exec edm-postgres psql -U postgres -d amt_mail_system -c "
SELECT id, status, completed_at 
FROM tasks 
WHERE id='a1d9a977-356c-446a-a103-b091f64e6721';
"

ENDSSH

echo ""
echo "🎯 任务状态修复完成！"
echo ""
echo "📋 修复内容："
echo "  ✅ 将completed任务改回sending状态"
echo "  ✅ 重启调度器重新加载任务队列"
echo "  ✅ 等待处理剩余的allocated subtasks"
echo ""
echo "🎯 现在调度器应该会继续处理剩余的3个邮件"
</rewritten_file> 