#!/bin/bash

echo "🔧 开始全面修复所有模型导入路径..."

# 修复 '../models' 为 '../models/index.model'
find src/backend/src -name "*.js" -exec sed -i '' "s|require('../models')|require('../models/index.model')|g" {} \;

# 修复 '../../models' 为 '../../models/index.model'  
find src/backend/src -name "*.js" -exec sed -i '' "s|require('../../models')|require('../../models/index.model')|g" {} \;

# 修复直接导入模型文件的情况
find src/backend/src -name "*.js" -exec sed -i '' "s|require('../../models/\\([a-zA-Z]*\\)\\.model')|require('../../models/index.model')|g" {} \;

echo "✅ 所有模型导入路径修复完成"

# 检查修复结果
echo "📋 检查剩余的问题导入:"
remaining=$(grep -r "require.*models" src/backend/src/ | grep -v "index.model" | wc -l)
if [ "$remaining" -eq 0 ]; then
    echo "✅ 所有模型导入已修复"
else
    echo "⚠️ 还有 $remaining 个导入需要手动检查"
    grep -r "require.*models" src/backend/src/ | grep -v "index.model" | head -10
fi 