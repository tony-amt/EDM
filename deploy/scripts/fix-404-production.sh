#!/bin/bash

# 修复生产环境404问题的部署脚本
# 更新nginx配置并重启服务

set -e

echo "🔧 修复生产环境404问题..."

# 检查是否在EDM项目目录
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ 错误：请在EDM项目根目录执行此脚本"
    exit 1
fi

# 1. 备份当前nginx配置
echo "📋 备份当前nginx配置..."
BACKUP_DIR="deploy/nginx/backup/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# 尝试从生产环境备份配置
docker exec $(docker ps --filter name=nginx --format '{{.Names}}' | head -1) \
    cat /etc/nginx/nginx.conf > "$BACKUP_DIR/nginx.conf.backup" 2>/dev/null || \
    echo "⚠️  无法备份生产配置，继续执行..."

# 2. 停止nginx服务
echo "🛑 停止nginx服务..."
docker-compose stop nginx 2>/dev/null || echo "nginx服务未运行"

# 3. 更新nginx配置
echo "📝 更新nginx配置..."
cp deploy/nginx/nginx.production.conf deploy/nginx/nginx.conf

# 4. 重启nginx服务
echo "🚀 重启nginx服务..."
docker-compose up -d nginx

# 5. 等待服务启动
echo "⏳ 等待nginx服务启动..."
sleep 5

# 6. 检查服务状态
echo "🔍 检查服务状态..."
if docker-compose ps nginx | grep -q "Up"; then
    echo "✅ nginx服务启动成功"
else
    echo "❌ nginx服务启动失败"
    echo "📋 查看日志："
    docker-compose logs nginx --tail=20
    exit 1
fi

# 7. 测试配置
echo "🧪 测试nginx配置..."
docker exec $(docker ps --filter name=nginx --format '{{.Names}}' | head -1) \
    nginx -t && echo "✅ nginx配置测试通过" || {
    echo "❌ nginx配置测试失败"
    exit 1
}

# 8. 重新加载配置
echo "🔄 重新加载nginx配置..."
docker exec $(docker ps --filter name=nginx --format '{{.Names}}' | head -1) \
    nginx -s reload && echo "✅ nginx配置重新加载成功" || {
    echo "❌ nginx配置重新加载失败"
    exit 1
}

echo ""
echo "🎉 生产环境404问题修复完成！"
echo ""
echo "📋 修复内容："
echo "   - 更新server_name为tkmail.fun"
echo "   - 修复React SPA路由回退机制"
echo "   - 更新防盗链配置"
echo ""
echo "🔗 现在可以访问："
echo "   - https://tkmail.fun/"
echo "   - https://tkmail.fun/tags"
echo "   - https://tkmail.fun/contacts"
echo "   - 等等..."
echo ""
echo "📁 配置备份位置：$BACKUP_DIR" 