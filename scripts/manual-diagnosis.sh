#!/bin/bash

# EDM任务失败手动诊断脚本
# 由于AI终端问题，请您手动执行此脚本

echo "🔍 EDM任务失败诊断开始..."
echo "任务ID: b68d46e3-399e-4e8c-a949-dbd352c7530f"
echo "时间: $(date)"
echo ""

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjczYjU3MDI4LWIyYzYtNDkzZi04ZTA5LTA3MjQyZjljYTM1MSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1MTEzMTIxNCwiZXhwIjoxNzUxMjE3NjE0fQ.Mvu5iLjv8M06Hvy3mEYD0VNI286ZUGLs8TBLWeNiKTc"

echo "📊 1. 检查具体任务详情..."
curl -s "https://tkmail.fun/api/tasks/b68d46e3-399e-4e8c-a949-dbd352c7530f" \
  -H "Authorization: Bearer $TOKEN" | tee task_detail.json

echo -e "\n📋 2. 检查最近任务列表..."
curl -s "https://tkmail.fun/api/tasks?limit=5" \
  -H "Authorization: Bearer $TOKEN" | tee recent_tasks.json

echo -e "\n🏷️ 3. 验证标签配置..."
curl -s "https://tkmail.fun/api/tags" \
  -H "Authorization: Bearer $TOKEN" | tee tags_config.json

echo -e "\n📧 4. 验证模板配置..."
curl -s "https://tkmail.fun/api/templates" \
  -H "Authorization: Bearer $TOKEN" | tee templates_config.json

echo -e "\n👤 5. 验证发送人配置..."
curl -s "https://tkmail.fun/api/senders" \
  -H "Authorization: Bearer $TOKEN" | tee senders_config.json

echo -e "\n✉️ 6. 检查邮件服务状态..."
curl -s "https://tkmail.fun/api/email-services" \
  -H "Authorization: Bearer $TOKEN" | tee email_services.json

echo -e "\n👥 7. 检查联系人数据..."
curl -s "https://tkmail.fun/api/contacts?limit=5" \
  -H "Authorization: Bearer $TOKEN" | tee contacts_sample.json

echo -e "\n🔍 8. 检查系统健康状态..."
curl -s "https://tkmail.fun/api/health" | tee system_health.json

echo -e "\n📜 9. 检查子任务状态..."
curl -s "https://tkmail.fun/api/subtasks?task_id=b68d46e3-399e-4e8c-a949-dbd352c7530f" \
  -H "Authorization: Bearer $TOKEN" | tee subtasks_status.json

echo -e "\n📈 10. 检查用户额度..."
curl -s "https://tkmail.fun/api/users/quota" \
  -H "Authorization: Bearer $TOKEN" | tee user_quota.json

echo ""
echo "📁 诊断数据已保存到以下文件："
echo "- task_detail.json (任务详情)"
echo "- recent_tasks.json (最近任务)"
echo "- tags_config.json (标签配置)"
echo "- templates_config.json (模板配置)"
echo "- senders_config.json (发送人配置)"
echo "- email_services.json (邮件服务)"
echo "- contacts_sample.json (联系人样本)"
echo "- system_health.json (系统健康)"
echo "- subtasks_status.json (子任务状态)"
echo "- user_quota.json (用户额度)"

echo ""
echo "🔍 快速分析（请手动检查）："
echo "1. 检查 task_detail.json 中的 error_message 字段"
echo "2. 检查 tags_config.json 中是否有'种子邮箱'标签"
echo "3. 检查 templates_config.json 中是否有'种子测试'模板"
echo "4. 检查 senders_config.json 中'tony'发送人状态"
echo "5. 检查 email_services.json 中服务是否启用且有额度"
echo "6. 检查 contacts_sample.json 中是否有联系人数据"
echo "7. 检查 user_quota.json 中用户额度是否充足"

echo ""
echo "🎯 常见失败原因："
echo "❌ 标签下无联系人 → total_recipients = 0"
echo "❌ 邮件服务额度用完 → 无法发送"
echo "❌ 发送人未启用 → 验证失败"
echo "❌ 模板内容有误 → 渲染失败"
echo "❌ 系统服务异常 → 调度失败"

echo ""
echo "✅ 诊断完成！请查看生成的JSON文件内容分析具体问题。" 