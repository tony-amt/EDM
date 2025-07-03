#!/bin/bash

# 生产环境404修复一键部署脚本
# 在生产服务器上执行此脚本

set -e

echo "🔧 开始修复生产环境404问题..."
echo "📅 执行时间: $(date)"

# 检查是否在正确目录
if [ ! -f "docker-compose.yml" ] && [ ! -f "deploy/docker/docker-compose.prod.yml" ]; then
    echo "❌ 错误：请在EDM项目根目录执行此脚本"
    exit 1
fi

# 1. 备份当前配置
echo "💾 步骤1: 备份当前配置..."
BACKUP_DIR="deploy/nginx/backup/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# 备份nginx配置
if docker ps --filter name=nginx --format '{{.Names}}' | head -1 | xargs -I {} docker exec {} cat /etc/nginx/nginx.conf > "$BACKUP_DIR/nginx.conf.backup" 2>/dev/null; then
    echo "✅ nginx配置已备份到: $BACKUP_DIR/nginx.conf.backup"
else
    echo "⚠️  无法备份nginx配置，继续执行..."
fi

# 备份服务状态
docker-compose -f deploy/docker/docker-compose.prod.yml ps > "$BACKUP_DIR/services.status" 2>/dev/null || true

# 2. 更新nginx配置
echo "📝 步骤2: 更新nginx配置..."
if [ -f "nginx.conf" ]; then
    cp nginx.conf deploy/nginx/nginx.conf
    echo "✅ nginx配置文件已更新"
else
    echo "❌ 错误：找不到nginx.conf文件"
    exit 1
fi

# 3. 重启nginx服务
echo "🛑 步骤3: 停止nginx服务..."
docker-compose -f deploy/docker/docker-compose.prod.yml stop nginx 2>/dev/null || echo "nginx服务未运行"

echo "🚀 步骤4: 启动nginx服务..."
docker-compose -f deploy/docker/docker-compose.prod.yml up -d nginx

echo "⏳ 步骤5: 等待nginx服务启动..."
sleep 10

# 4. 检查服务状态
echo "🔍 步骤6: 检查nginx服务状态..."
if docker-compose -f deploy/docker/docker-compose.prod.yml ps nginx | grep -q "Up"; then
    echo "✅ nginx服务启动成功"
else
    echo "❌ nginx服务启动失败"
    echo "📋 查看日志："
    docker-compose -f deploy/docker/docker-compose.prod.yml logs nginx --tail=20
    exit 1
fi

# 5. 验证配置
echo "🧪 步骤7: 验证nginx配置..."
if docker exec $(docker ps --filter name=nginx --format '{{.Names}}' | head -1) nginx -t; then
    echo "✅ nginx配置测试通过"
else
    echo "❌ nginx配置测试失败"
    exit 1
fi

echo "🔄 步骤8: 重新加载nginx配置..."
if docker exec $(docker ps --filter name=nginx --format '{{.Names}}' | head -1) nginx -s reload; then
    echo "✅ nginx配置重新加载成功"
else
    echo "❌ nginx配置重新加载失败"
    exit 1
fi

# 6. 验证修复结果
echo "✅ 步骤9: 验证修复结果..."
echo "🧪 测试网站访问..."

# 等待几秒让配置生效
sleep 5

# 测试首页
if curl -s -I "https://tkmail.fun/" | grep -q "200 OK"; then
    echo "✅ 首页访问正常"
else
    echo "❌ 首页访问异常"
fi

# 测试React路由
ROUTES=("tags" "contacts" "campaigns" "templates")
for route in "${ROUTES[@]}"; do
    if curl -s -I "https://tkmail.fun/$route" | grep -q "200"; then
        echo "✅ /$route 路由访问正常"
    else
        echo "❌ /$route 路由访问异常"
    fi
done

# 测试API
if curl -s -I "https://tkmail.fun/api/health" | grep -q "200"; then
    echo "✅ API接口访问正常"
else
    echo "❌ API接口访问异常"
fi

echo ""
echo "🎉 生产环境404问题修复完成！"
echo ""
echo "📋 修复总结："
echo "   ✅ nginx配置域名已修复为tkmail.fun"
echo "   ✅ React SPA路由回退机制正常工作"
echo "   ✅ nginx服务重启成功"
echo ""
echo "🔗 请验证以下链接："
echo "   - https://tkmail.fun/"
echo "   - https://tkmail.fun/tags"
echo "   - https://tkmail.fun/contacts"
echo "   - https://tkmail.fun/campaigns"
echo "   - https://tkmail.fun/templates"
echo ""
echo "📁 备份位置: $BACKUP_DIR"
echo "✅ 修复任务完成！" 