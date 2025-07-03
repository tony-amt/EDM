#!/bin/bash

# EDM邮件任务测试脚本
echo "🚀 开始EDM邮件任务测试..."
echo "时间: $(date)"

# 测试任务创建
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjczYjU3MDI4LWIyYzYtNDkzZi04ZTA5LTA3MjQyZjljYTM1MSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1MTEzMTIxNCwiZXhwIjoxNzUxMjE3NjE0fQ.Mvu5iLjv8M06Hvy3mEYD0VNI286ZUGLs8TBLWeNiKTc"

echo "📧 创建测试任务..."
curl -X POST "https://tkmail.fun/api/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "EDM功能验证-'"$(date +%H%M)"'",
    "template_ids": ["种子测试"],
    "sender_name": "tony", 
    "tag_ids": ["种子邮箱"],
    "scheduled_type": "immediate",
    "description": "验证邮件发送和追踪"
  }' && echo ""

echo ""
echo "📊 查看最新任务状态..."
sleep 3
curl -s "https://tkmail.fun/api/tasks?limit=3" \
  -H "Authorization: Bearer $TOKEN" | \
  jq -r '.data[] | "任务: \(.name) | 状态: \(.status) | 发送: \(.sent_count)/\(.total_recipients)"'

echo ""
echo "🎯 任务创建完成！请:"
echo "1. 登录种子邮箱查看邮件"
echo "2. 打开邮件触发追踪"
echo "3. 点击链接测试追踪"
echo "4. 回复邮件测试双向通信" 