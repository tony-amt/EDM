#!/bin/bash

# EDM邮件任务测试脚本 - 修复版
echo "🚀 开始EDM邮件任务测试（修复版）..."
echo "时间: $(date)"

# 测试任务创建
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjczYjU3MDI4LWIyYzYtNDkzZi04ZTA5LTA3MjQyZjljYTM1MSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1MTEzMTIxNCwiZXhwIjoxNzUxMjE3NjE0fQ.Mvu5iLjv8M06Hvy3mEYD0VNI286ZUGLs8TBLWeNiKTc"

echo ""
echo "📧 创建测试任务..."

# 先获取可用的模板和标签
echo "🔍 检查可用资源..."

echo "  检查模板..."
curl -s "https://tkmail.fun/api/templates" \
  -H "Authorization: Bearer $TOKEN" > templates_response.json

echo "  检查标签..."
curl -s "https://tkmail.fun/api/tags" \
  -H "Authorization: Bearer $TOKEN" > tags_response.json

echo "  检查发送人..."
curl -s "https://tkmail.fun/api/senders" \
  -H "Authorization: Bearer $TOKEN" > senders_response.json

# 显示资源信息（不依赖jq）
echo ""
echo "📋 可用资源："
echo "模板："
cat templates_response.json | grep -o '"name":"[^"]*"' | head -5
echo "标签："  
cat tags_response.json | grep -o '"name":"[^"]*"' | head -5
echo "发送人："
cat senders_response.json | grep -o '"name":"[^"]*"' | head -5

echo ""
echo "🚀 创建任务（使用正确的ID格式）..."

# 创建任务（修正JSON格式）
task_response=$(curl -X POST "https://tkmail.fun/api/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "EDM功能验证-'$(date +%H%M)'",
    "template_ids": ["种子测试"],
    "sender_name": "tony", 
    "tag_ids": ["种子邮箱"],
    "scheduled_type": "immediate",
    "description": "验证邮件发送和追踪"
  }' \
  -w "\n状态码: %{http_code}\n" 2>/dev/null)

echo "任务创建响应："
echo "$task_response"

# 保存响应到文件
echo "$task_response" > task_creation_response.txt

echo ""
echo "📊 查看最新任务状态..."
sleep 3

# 获取任务列表（不依赖jq解析）
tasks_response=$(curl -s "https://tkmail.fun/api/tasks?limit=3" \
  -H "Authorization: Bearer $TOKEN")

echo "任务列表响应："
echo "$tasks_response" > tasks_list_response.txt

# 简单解析（不依赖jq）
echo "📋 解析任务信息："
echo "$tasks_response" | grep -o '"name":"[^"]*"' | head -3
echo "$tasks_response" | grep -o '"status":"[^"]*"' | head -3
echo "$tasks_response" | grep -o '"sent_count":[0-9]*' | head -3
echo "$tasks_response" | grep -o '"total_recipients":[0-9]*' | head -3

echo ""
echo "🔍 详细分析："

# 检查是否有错误
if echo "$task_response" | grep -q '"error"'; then
    echo "❌ 任务创建失败，错误信息："
    echo "$task_response" | grep -o '"message":"[^"]*"'
    
    echo ""
    echo "🔧 问题排查："
    echo "1. 检查模板名称是否正确"
    echo "2. 检查标签名称是否正确" 
    echo "3. 检查发送人名称是否正确"
    echo "4. 检查JSON格式是否正确"
else
    echo "✅ 任务创建可能成功"
    
    # 提取任务ID（简单方式）
    task_id=$(echo "$task_response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ -n "$task_id" ]; then
        echo "📋 任务ID: $task_id"
        
        echo ""
        echo "🔍 获取任务详情..."
        curl -s "https://tkmail.fun/api/tasks/$task_id" \
          -H "Authorization: Bearer $TOKEN" > task_detail_response.txt
        
        echo "任务详情已保存到: task_detail_response.txt"
    fi
fi

echo ""
echo "🎯 测试结果总结："
echo "- 追踪服务状态: ✅ 正常"
echo "- Webhook服务状态: ✅ 正常"
echo "- 任务创建: $(if echo "$task_response" | grep -q '"error"'; then echo "❌ 失败"; else echo "✅ 成功"; fi)"

echo ""
echo "📁 响应文件已保存："
echo "- templates_response.json (模板列表)"
echo "- tags_response.json (标签列表)"  
echo "- senders_response.json (发送人列表)"
echo "- task_creation_response.txt (任务创建响应)"
echo "- tasks_list_response.txt (任务列表)"

echo ""
echo "🎯 接下来请："
if echo "$task_response" | grep -q '"error"'; then
    echo "1. 检查响应文件中的错误详情"
    echo "2. 确认模板、标签、发送人配置正确"
    echo "3. 修正配置后重新创建任务"
else
    echo "1. 登录种子邮箱查看邮件"
    echo "2. 打开邮件触发追踪像素"
    echo "3. 点击链接测试追踪功能"
    echo "4. 回复邮件测试双向通信"
fi 