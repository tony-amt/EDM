#!/bin/bash

# 批量修复控制器中的模型导入路径
echo "🔧 开始修复控制器中的模型导入路径..."

# 修复所有控制器文件中的 '../models' 为 '../models/index.model'
find src/backend/src/controllers -name "*.js" -exec sed -i '' "s|require('../models')|require('../models/index.model')|g" {} \;

echo "✅ 控制器模型导入路径修复完成"

# 检查修复结果
echo "📋 检查修复结果:"
grep -r "../models" src/backend/src/controllers/ | grep -v "index.model" || echo "✅ 所有导入已修复" 