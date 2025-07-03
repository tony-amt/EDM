#!/bin/bash

echo "🔧 在容器内修复所有模型导入..."

# 在容器内修复所有模型导入
docker exec edm-backend-debug find /app/src -name "*.js" -exec sed -i "s|require('../models')|require('../models/index.model')|g" {} \;
docker exec edm-backend-debug find /app/src -name "*.js" -exec sed -i "s|require('../../models')|require('../../models/index.model')|g" {} \;

# 修复validator导入
docker exec edm-backend-debug find /app/src -name "*.js" -exec sed -i "s|validator\.middleware|validation.middleware|g" {} \;

echo "✅ 容器内导入修复完成"

# 重启容器
echo "🔄 重启后端容器..."
docker restart edm-backend-debug 