#!/bin/bash

# 手动触发队列处理
echo "🚀 手动触发队列处理..."

SERVER_IP="43.135.38.15"
TASK_ID="a1d9a977-356c-446a-a103-b091f64e6721"

ssh ubuntu@$SERVER_IP << 'ENDSSH'
set -e

cd /opt/edm

echo "🔍 当前任务和服务状态..."

# 检查任务状态
echo "=== 任务状态 ==="
sudo docker exec edm-postgres psql -U postgres -d amt_mail_system -c "
SELECT id, status, created_at 
FROM tasks 
WHERE status IN ('sending', 'scheduled')
ORDER BY created_at DESC;
"

# 检查发信服务状态
echo ""
echo "=== 发信服务状态 ==="
sudo docker exec edm-postgres psql -U postgres -d amt_mail_system -c "
SELECT id, name, status, is_frozen, freeze_until 
FROM email_services 
ORDER BY name;
"

# 检查allocated状态的subtask
echo ""
echo "=== Allocated SubTasks ==="
sudo docker exec edm-postgres psql -U postgres -d amt_mail_system -c "
SELECT 
  st.id,
  st.recipient_email,
  st.status,
  st.service_id,
  st.scheduled_at,
  es.name as service_name,
  es.status as service_status,
  es.is_frozen,
  es.freeze_until
FROM sub_tasks st
JOIN email_services es ON st.service_id = es.id
WHERE st.task_id = 'a1d9a977-356c-446a-a103-b091f64e6721'
  AND st.status = 'allocated'
ORDER BY st.scheduled_at;
"

echo ""
echo "🔄 尝试手动触发处理..."

# 方法1: 将allocated状态改回pending，让调度器重新分配
echo "=== 方法1: 重置allocated为pending ==="
sudo docker exec edm-postgres psql -U postgres -d amt_mail_system -c "
UPDATE sub_tasks 
SET 
  status = 'pending',
  service_id = NULL,
  scheduled_at = NULL,
  updated_at = NOW()
WHERE task_id = 'a1d9a977-356c-446a-a103-b091f64e6721'
  AND status = 'allocated';
"

echo "✅ 已将allocated状态重置为pending"

# 方法2: 触发scheduled任务检查
echo ""
echo "=== 方法2: 检查服务解冻时间 ==="
sudo docker exec edm-postgres psql -U postgres -d amt_mail_system -c "
SELECT 
  name,
  is_frozen,
  freeze_until,
  CASE 
    WHEN freeze_until IS NULL THEN '无冻结时间'
    WHEN freeze_until <= NOW() THEN '已解冻'
    ELSE '仍在冻结中'
  END as freeze_status
FROM email_services;
"

echo ""
echo "⏳ 等待30秒让调度器处理pending任务..."
sleep 30

echo ""
echo "🔍 检查处理结果..."
echo "=== 更新后的SubTask状态 ==="
sudo docker exec edm-postgres psql -U postgres -d amt_mail_system -c "
SELECT 
  recipient_email,
  status,
  service_id,
  scheduled_at,
  sent_at
FROM sub_tasks 
WHERE task_id = 'a1d9a977-356c-446a-a103-b091f64e6721'
ORDER BY created_at;
"

echo ""
echo "=== 任务当前状态 ==="
sudo docker exec edm-postgres psql -U postgres -d amt_mail_system -c "
SELECT id, status, completed_at 
FROM tasks 
WHERE id = 'a1d9a977-356c-446a-a103-b091f64e6721';
"

echo ""
echo "=== 最新后端日志 ==="
sudo docker logs edm-backend --tail 20 | grep -E "任务|发送|allocated|pending|调度"

ENDSSH

echo ""
echo "🎯 队列处理触发完成！"
echo ""
echo "📋 处理步骤："
echo "  ✅ 检查任务和服务状态"
echo "  ✅ 将allocated状态重置为pending"
echo "  ✅ 等待调度器自动处理"
echo ""
echo "🎯 如果服务未冻结，pending任务应该会被重新分配和发送" 