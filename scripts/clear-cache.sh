#!/bin/bash

echo "🧹 EDM系统缓存清理脚本"
echo "=========================="

# 1. 清理浏览器缓存的提示
echo "📱 浏览器缓存清理："
echo "   - Chrome/Edge: Ctrl+Shift+Delete 或 F12 -> Network -> Disable cache"
echo "   - Firefox: Ctrl+Shift+Delete"
echo "   - Safari: Cmd+Option+E"
echo "   - 或者使用无痕/隐私模式访问"
echo ""

# 2. 清理nginx缓存（如果有）
echo "🌐 清理服务器缓存..."
if command -v docker &> /dev/null; then
    echo "   - 重启nginx容器..."
    docker-compose restart nginx
else
    echo "   - 请手动重启nginx服务"
fi
echo ""

# 3. 强制刷新提示
echo "🔄 强制刷新方法："
echo "   - 普通刷新: F5 或 Ctrl+R"
echo "   - 强制刷新: Ctrl+F5 或 Ctrl+Shift+R"
echo "   - 完全重新加载: Shift+点击刷新按钮"
echo ""

# 4. 开发者工具方法
echo "🛠️  开发者工具清理："
echo "   1. 按F12打开开发者工具"
echo "   2. 右键点击刷新按钮"
echo "   3. 选择'清空缓存并硬性重新加载'"
echo ""

# 5. 检查当前构建文件
echo "📁 当前构建文件："
if [ -d "src/frontend/build/static/js" ]; then
    ls -la src/frontend/build/static/js/*.js | head -3
else
    echo "   构建文件不存在，请先运行 npm run build"
fi
echo ""

echo "✅ 缓存清理提示完成！"
echo "💡 提示：如果问题持续存在，请使用无痕模式访问 tkmail.fun" 