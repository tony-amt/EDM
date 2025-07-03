#!/bin/bash

echo "🧹 开始清理调试代码..."

# 1. 清理前端代码中的调试console.log
echo "🎨 清理前端调试代码..."

# 清理前端页面中的调试console.log
sed -i '' '/console\.log.*调试日志/d' src/frontend/src/pages/email-services/EditEmailServiceModal.tsx
sed -i '' '/console\.log.*创建群发任务/d' src/frontend/src/pages/campaigns/EnhancedCampaignCreate.tsx
sed -i '' '/console\.log.*提交数据/d' src/frontend/src/pages/templates/components/TemplateForm.tsx
sed -i '' '/console\.log.*模式切换/d' src/frontend/src/pages/templates/components/TemplateForm.tsx
sed -i '' '/console\.log.*正在获取联系人详情/d' src/frontend/src/pages/contacts/ContactDetail.tsx

# 清理API服务中的调试console.log
sed -i '' '/console\.log.*API请求/d' src/frontend/src/services/api.js
sed -i '' '/console\.log.*API响应/d' src/frontend/src/services/api.js

# 清理WebSocket服务中的调试console.log
sed -i '' '/console\.log.*WebSocket服务暂时禁用/d' src/frontend/src/services/websocket.service.ts
sed -i '' '/console\.log.*WebSocket服务已禁用/d' src/frontend/src/services/websocket.service.ts
sed -i '' '/console\.log.*WebSocket连接已建立/d' src/frontend/src/services/websocket.service.ts

# 2. 清理后端服务中的调试console.log
echo "⚙️ 清理后端调试代码..."

# 清理任务服务中的DEBUG console.log
sed -i '' '/console\.log.*\[DEBUG\]/d' src/backend/src/services/core/task.service.js

# 清理联系人服务中的DEBUG console.log
sed -i '' '/console\.log.*\[DEBUG\]/d' src/backend/src/services/core/contact.service.js

# 3. 清理临时测试文件
echo "🗑️ 清理临时测试文件..."
rm -f temp_model_test.js
rm -f phase4-*.js
rm -f *-test.js

# 4. 清理注释的调试代码
echo "💬 清理注释的调试代码..."
find src/ -name "*.js" -o -name "*.ts" -o -name "*.tsx" | xargs sed -i '' '/^[[:space:]]*\/\/ console\.log/d'

# 5. 保留必要的生产日志
echo "📋 保留生产环境必要的日志..."
echo "保留以下日志："
echo "- 服务器启动日志 (src/index.js)"
echo "- 管理员创建日志 (src/utils/createAdmin.js)"
echo "- 监控系统日志 (src/backend/src/services/core/监控相关)"

echo "✅ 代码清理完成！" 