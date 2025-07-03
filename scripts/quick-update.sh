#!/bin/bash

# EDM前端快速更新脚本
# 只同步修改的文件，无需重新构建整个容器

echo "⚡ EDM前端快速更新"
echo "=================="

PRODUCTION_SERVER="43.135.38.15"
SERVER_USER="ubuntu"
SERVER_PASS="Tony1231!"

# 检查是否提供了文件路径参数
if [ $# -eq 0 ]; then
    echo "📝 用法: $0 <文件路径>"
    echo "📝 示例: $0 src/pages/email-services/EmailServiceList.tsx"
    echo "📝 示例: $0 src/services/email-service.service.ts"
    echo ""
    echo "🔍 或者自动检测最近修改的文件:"
    echo "最近10分钟修改的文件:"
    find src/frontend/src -name "*.tsx" -o -name "*.ts" -o -name "*.js" -o -name "*.jsx" | xargs ls -lt | head -5
    exit 1
fi

TARGET_FILE="$1"
FULL_PATH="src/frontend/$TARGET_FILE"

# 检查文件是否存在
if [ ! -f "$FULL_PATH" ]; then
    echo "❌ 文件不存在: $FULL_PATH"
    exit 1
fi

echo "📤 同步文件: $TARGET_FILE"

# 同步单个文件到生产服务器
scp -o StrictHostKeyChecking=no "$FULL_PATH" $SERVER_USER@$PRODUCTION_SERVER:/tmp/frontend-dev/$TARGET_FILE

# 在生产服务器触发热更新
echo "🔄 触发热更新..."
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no $SERVER_USER@$PRODUCTION_SERVER << EOF

echo "📱 检查开发环境容器状态..."
if docker ps | grep -q edm-frontend-dev; then
    echo "✅ 开发环境容器正在运行"
    echo "🔄 文件已更新，React将自动热更新"
    
    # 检查容器日志中的热更新信息
    echo "📋 最近的容器日志:"
    docker logs edm-frontend-dev --tail 5 --since 30s
    
    echo "🌐 访问地址: http://43.135.38.15:3002"
    echo "💡 在浏览器中检查更新是否生效"
else
    echo "❌ 开发环境容器未运行"
    echo "🚀 请先运行: ./scripts/dev-deploy.sh"
fi

EOF

echo "✅ 快速更新完成！"
echo "⏱️  耗时: 约5-10秒（vs 完整构建15-20分钟）" 