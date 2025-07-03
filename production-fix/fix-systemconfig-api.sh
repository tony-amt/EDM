#!/bin/bash

echo "🚀 修复SystemConfig API完整部署脚本"
echo "========================================"

# 1. 检查生产服务器上的index文件名称
echo "🔍 Step 1: 检查models index文件..."
INDEX_FILE=""
if [ -f "/opt/edm/src/backend/src/models/index.js" ]; then
    INDEX_FILE="/opt/edm/src/backend/src/models/index.js"
    echo "✅ 找到 index.js"
elif [ -f "/opt/edm/src/backend/src/models/index.model.js" ]; then
    INDEX_FILE="/opt/edm/src/backend/src/models/index.model.js"
    echo "✅ 找到 index.model.js"
else
    echo "❌ 未找到index文件！"
    exit 1
fi

# 2. 确认systemConfig模型文件存在
echo "🔍 Step 2: 确认模型文件..."
ls -la /opt/edm/src/backend/src/models/systemConfig.model.js || echo "❌ 模型文件不存在"

# 3. 检查模型文件格式
echo "🔍 Step 3: 检查模型文件格式..."
head -20 /opt/edm/src/backend/src/models/systemConfig.model.js

# 4. 检查控制器是否正确导入模型
echo "🔍 Step 4: 检查控制器导入..."
grep -n "SystemConfig\|systemConfig" /opt/edm/src/backend/src/controllers/systemConfig.controller.js | head -5

# 5. 强制重启后端容器
echo "🔄 Step 5: 强制重启后端容器..."
docker stop edm-backend-prod
sleep 3
docker start edm-backend-prod

# 6. 等待容器启动
echo "⏳ Step 6: 等待后端启动..."
sleep 15

# 7. 检查容器日志中是否有SystemConfig加载信息
echo "🔍 Step 7: 检查模型加载日志..."
docker logs edm-backend-prod 2>&1 | grep -i "systemconfig\|模型.*System" | tail -5

# 8. 测试API
echo "🔍 Step 8: 测试SystemConfig API..."
curl -s -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjczYjU3MDI4LWIyYzYtNDkzZi04ZTA5LTA3MjQyZjljYTM1MSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1MTEzMTIxNCwiZXhwIjoxNzUxMjE3NjE0fQ.Mvu5iLjv8M06Hvy3mEYD0VNI286ZUGLs8TBLWeNiKTc" \
  http://localhost:8080/api/system-config/queue > /tmp/api_test.json

# 9. 分析API响应
echo "📋 Step 9: API响应分析..."
if grep -q "DOCTYPE html" /tmp/api_test.json; then
    echo "❌ API仍然返回HTML页面"
    echo "📋 HTML响应内容："
    head -5 /tmp/api_test.json
    
    # 检查容器内是否有错误
    echo "🔍 检查容器错误日志..."
    docker logs --tail=10 edm-backend-prod 2>&1 | grep -i "error\|fail"
else
    echo "✅ API返回JSON响应！"
    cat /tmp/api_test.json | head -10
fi

# 10. 最终状态检查
echo "📊 Step 10: 最终状态检查..."
echo "容器状态："
docker ps | grep edm-backend-prod
echo ""
echo "系统配置表数据："
docker exec edm-postgres-prod psql -U postgres -d amt_mail_system -c "SELECT config_key FROM system_configs;"

echo ""
echo "🎯 SystemConfig API修复脚本执行完成！" 