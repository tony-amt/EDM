#!/bin/bash

# 添加系统配置路由到主应用

echo "🔧 添加系统配置路由到 index.js..."

# 1. 添加路由引入
sed -i '/const trackingRoutes/a const systemConfigRoutes = require('\''./routes/systemConfig.routes'\'');' /opt/edm/src/backend/src/index.js

# 2. 添加路由使用
sed -i '/app.use('\''\/api\/tracking'\'', trackingRoutes);/a app.use('\''\/api\/system-config'\'', systemConfigRoutes);' /opt/edm/src/backend/src/index.js

echo "✅ 系统配置路由已添加到 index.js"

# 3. 重启后端容器
echo "🔄 重启后端容器..."
docker restart edm-backend-prod

echo "✅ 后端容器重启完成"

# 4. 验证路由是否生效
echo "🔍 验证系统配置API..."
sleep 5
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjczYjU3MDI4LWIyYzYtNDkzZi04ZTA5LTA3MjQyZjljYTM1MSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1MTEzMTIxNCwiZXhwIjoxNzUxMjE3NjE0fQ.Mvu5iLjv8M06Hvy3mEYD0VNI286ZUGLs8TBLWeNiKTc" \
  http://43.135.38.15:3001/api/system-config/queue

echo ""
echo "🎉 系统配置路由添加完成！" 