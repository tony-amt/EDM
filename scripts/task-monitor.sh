#!/bin/bash

# EDM任务监控脚本
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjczYjU3MDI4LWIyYzYtNDkzZi04ZTA5LTA3MjQyZjljYTM1MSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1MTEzMTIxNCwiZXhwIjoxNzUxMjE3NjE0fQ.Mvu5iLjv8M06Hvy3mEYD0VNI286ZUGLs8TBLWeNiKTc"

echo "📊 EDM任务监控开始..."
echo "时间: $(date)"
echo ""

# 监控循环
for i in {1..20}; do
    echo "=== 第 $i 次检查 ($(date +%H:%M:%S)) ==="
    
    # 1. 获取最新任务状态
    echo "📋 最新任务状态:"
    curl -s "https://tkmail.fun/api/tasks?limit=5" \
      -H "Authorization: Bearer $TOKEN" | \
      jq -r '.data[] | "🎯 \(.name) | 状态:\(.status) | 发送:\(.sent_count)/\(.total_recipients) | 打开:\(.open_count) | 点击:\(.click_count)"' | \
      head -3
    
    echo ""
    
    # 2. 检查任务详情（获取最新任务ID）
    latest_task_id=$(curl -s "https://tkmail.fun/api/tasks?limit=1" \
      -H "Authorization: Bearer $TOKEN" | \
      jq -r '.data[0].id // empty')
    
    if [ -n "$latest_task_id" ]; then
        echo "🔍 最新任务 ($latest_task_id) 详细信息:"
        curl -s "https://tkmail.fun/api/tasks/$latest_task_id" \
          -H "Authorization: Bearer $TOKEN" | \
          jq -r '"  创建时间: \(.data.created_at // "N/A")
  总收件人: \(.data.total_recipients // 0)
  已发送: \(.data.sent_count // 0)
  打开数: \(.data.open_count // 0)
  点击数: \(.data.click_count // 0)
  失败数: \(.data.failed_count // 0)"'
    fi
    
    echo ""
    
    # 3. 测试追踪服务
    echo "🔗 追踪服务状态:"
    tracking_status=$(curl -s -o /dev/null -w "%{http_code}" "https://tkmail.fun/tracking/health" 2>/dev/null || echo "000")
    if [ "$tracking_status" = "200" ]; then
        echo "  ✅ 追踪服务正常 (HTTP $tracking_status)"
    else
        echo "  ❌ 追踪服务异常 (HTTP $tracking_status)"
    fi
    
    webhook_status=$(curl -s -o /dev/null -w "%{http_code}" "https://tkmail.fun/webhook/health" 2>/dev/null || echo "000")
    if [ "$webhook_status" = "200" ]; then
        echo "  ✅ Webhook服务正常 (HTTP $webhook_status)"
    else
        echo "  ⚠️  Webhook服务状态 (HTTP $webhook_status)"
    fi
    
    echo ""
    echo "---"
    
    # 每10秒检查一次
    sleep 10
done

echo ""
echo "🎉 任务监控完成！"
echo ""
echo "📋 接下来请："
echo "1. 📧 登录种子邮箱验证邮件接收"
echo "2. 👁️ 打开邮件触发追踪像素"
echo "3. 🖱️ 点击邮件中的链接"
echo "4. 💬 回复邮件测试双向通信"
echo "5. 📊 再次运行此脚本查看统计更新" 