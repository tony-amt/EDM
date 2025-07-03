#!/bin/bash

echo "🚀 SystemConfig API 完整修复脚本"
echo "====================================="

# 检查容器状态
echo "📊 Step 1: 检查容器状态..."
docker ps | grep edm-backend-prod || {
    echo "❌ 后端容器未运行，启动容器..."
    docker start edm-backend-prod
    sleep 10
}

# 检查容器健康状态
echo -e "\n🔍 Step 2: 检查容器健康状态..."
docker exec edm-backend-prod ps aux | grep node || {
    echo "❌ Node.js进程未运行，重启容器..."
    docker restart edm-backend-prod
    sleep 15
}

# 验证所有必要文件存在
echo -e "\n📁 Step 3: 验证SystemConfig文件..."
echo "模型文件:"
docker exec edm-backend-prod ls -la /app/src/models/systemConfig.model.js || echo "❌ 模型文件缺失"

echo "控制器文件:"
docker exec edm-backend-prod ls -la /app/src/controllers/systemConfig.controller.js || echo "❌ 控制器文件缺失"

echo "路由文件:"
docker exec edm-backend-prod ls -la /app/src/routes/systemConfig.routes.js || echo "❌ 路由文件缺失"

# 验证index.js包含systemConfig路由
echo -e "\n🔍 Step 4: 验证index.js路由注册..."
docker exec edm-backend-prod grep -n "systemConfig" /app/src/index.js && echo "✅ index.js包含SystemConfig路由" || {
    echo "❌ index.js缺少SystemConfig路由，修复中..."
    
    # 备份原文件
    docker exec edm-backend-prod cp /app/src/index.js /app/src/index.js.backup.$(date +%Y%m%d_%H%M%S)
    
    # 添加require语句（在trackingRoutes之后）
    docker exec edm-backend-prod sed -i '/const trackingRoutes/a const systemConfigRoutes = require('\''./routes/systemConfig.routes'\'');' /app/src/index.js
    
    # 添加路由使用（在tracking路由之后）
    docker exec edm-backend-prod sed -i '/app.use('\''\/api\/tracking'\'', trackingRoutes);/a app.use('\''\/api\/system-config'\'', systemConfigRoutes);' /app/src/index.js
    
    echo "✅ SystemConfig路由已添加到index.js"
}

# 测试控制器和路由文件语法
echo -e "\n🔍 Step 5: 验证文件语法..."
docker exec edm-backend-prod node -c /app/src/controllers/systemConfig.controller.js && echo "✅ 控制器语法正确" || echo "❌ 控制器语法错误"
docker exec edm-backend-prod node -c /app/src/routes/systemConfig.routes.js && echo "✅ 路由语法正确" || echo "❌ 路由语法错误"

# 重启后端容器
echo -e "\n🔄 Step 6: 重启后端容器..."
docker restart edm-backend-prod
sleep 20

# 检查启动日志
echo -e "\n📋 Step 7: 检查启动日志..."
docker logs --tail=20 edm-backend-prod | grep -E "SystemConfig|系统配置|已加载模型|error|Error"

# 验证API可用性
echo -e "\n🎯 Step 8: 最终API验证..."
echo "测试队列配置API:"
curl -s -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjczYjU3MDI4LWIyYzYtNDkzZi04ZTA5LTA3MjQyZjljYTM1MSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1MTEzMTIxNCwiZXhwIjoxNzUxMjE3NjE0fQ.Mvu5iLjv8M06Hvy3mEYD0VNI286ZUGLs8TBLWeNiKTc" \
  http://localhost:8080/api/system-config/queue | head -10

echo -e "\n测试所有配置API:"
curl -s -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjczYjU3MDI4LWIyYzYtNDkzZi04ZTA5LTA3MjQyZjljYTM1MSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1MTEzMTIxNCwiZXhwIjoxNzUxMjE3NjE0fQ.Mvu5iLjv8M06Hvy3mEYD0VNI286ZUGLs8TBLWeNiKTc" \
  http://localhost:8080/api/system-config/ | head -10

echo -e "\n✅ SystemConfig API修复脚本执行完成！"
echo "如果仍有问题，请检查:"
echo "1. 数据库连接状态"
echo "2. 模型加载日志"
echo "3. 认证Token是否有效" 