#!/bin/bash

# 生产配置验证脚本
# 用途: 验证 docker-compose.prod.yml 配置是否正确

set -e

echo "🔍 EDM生产配置验证开始..."
echo "=================================="

# 1. 检查配置文件是否存在
echo "📁 检查配置文件..."
if [ ! -f "docker-compose.prod.yml" ]; then
    echo "❌ docker-compose.prod.yml 不存在"
    exit 1
fi

if [ ! -f "nginx/nginx.conf" ]; then
    echo "❌ nginx/nginx.conf 不存在"
    exit 1
fi

echo "✅ 配置文件存在"

# 2. 验证docker-compose配置语法
echo ""
echo "🔧 验证Docker Compose配置语法..."
if docker compose -f docker-compose.prod.yml config > /dev/null 2>&1; then
    echo "✅ Docker Compose配置语法正确"
else
    echo "❌ Docker Compose配置语法错误:"
    docker compose -f docker-compose.prod.yml config
    exit 1
fi

# 3. 检查端口配置
echo ""
echo "🔌 检查端口配置..."
PORTS=$(docker compose -f docker-compose.prod.yml config | grep -E "^\s*-\s*[0-9]+:[0-9]+" | sed 's/.*- "//' | sed 's/".*//' | sort)
EXTERNAL_PORTS=$(echo "$PORTS" | cut -d: -f1 | sort)
DUPLICATES=$(echo "$EXTERNAL_PORTS" | uniq -d)

if [ -n "$DUPLICATES" ]; then
    echo "❌ 发现端口冲突: $DUPLICATES"
    exit 1
else
    echo "✅ 无端口冲突"
fi

echo "📋 端口分配情况:"
echo "$PORTS" | while read port; do
    if [ -n "$port" ]; then
        echo "   - $port"
    fi
done

# 4. 检查必要目录
echo ""
echo "📂 检查必要目录..."
REQUIRED_DIRS=("data" "data/postgres" "data/redis" "data/uploads" "logs" "nginx")

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        echo "⚠️  创建缺失目录: $dir"
        mkdir -p "$dir"
    fi
done
echo "✅ 目录结构正确"

# 5. 检查环境变量
echo ""
echo "🔧 检查关键环境变量..."
REQUIRED_VARS=("JWT_SECRET" "ENGAGELAB_API_USER" "ENGAGELAB_API_KEY")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "$var:" docker-compose.prod.yml; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -eq 0 ]; then
    echo "✅ 关键环境变量配置完整"
else
    echo "⚠️  缺少环境变量: ${MISSING_VARS[*]}"
fi

# 6. 检查服务依赖
echo ""
echo "🔗 检查服务依赖关系..."
SERVICES=(postgres redis backend frontend nginx image-service tracking-service webhook-service)
echo "📋 配置的服务:"
for service in "${SERVICES[@]}"; do
    if grep -q "^  $service:" docker-compose.prod.yml; then
        echo "   ✅ $service"
    else
        echo "   ❌ $service (缺失)"
    fi
done

# 7. 验证Nginx配置
echo ""
echo "🌐 验证Nginx配置..."
if nginx -t -c nginx/nginx.conf > /dev/null 2>&1; then
    echo "✅ Nginx配置语法正确"
else
    echo "⚠️  Nginx配置需要在容器中验证"
fi

# 8. 检查网络配置
echo ""
echo "🌍 检查网络配置..."
if grep -q "networks:" docker-compose.prod.yml; then
    echo "✅ 网络配置存在"
else
    echo "❌ 缺少网络配置"
fi

# 9. 生成部署摘要
echo ""
echo "📊 部署配置摘要"
echo "=================================="
echo "🗂️  配置文件: docker-compose.prod.yml"
echo "🌐 域名: $(grep -o 'tkmail\.fun' docker-compose.prod.yml | head -1)"
echo "🔗 服务数量: $(echo "${SERVICES[@]}" | wc -w)"
echo "🔌 端口映射: $(echo "$PORTS" | wc -l) 个"
echo "📁 数据目录: ./data/"
echo "📝 日志目录: ./logs/"

# 10. 给出建议
echo ""
echo "💡 部署建议"
echo "=================================="
echo "1. 确保服务器有足够资源:"
echo "   - 内存: 至少 4GB"
echo "   - 磁盘: 至少 20GB"
echo ""
echo "2. 部署前执行:"
echo "   docker compose -f docker-compose.prod.yml pull"
echo ""
echo "3. 部署命令:"
echo "   docker compose -f docker-compose.prod.yml up -d"
echo ""
echo "4. 检查服务状态:"
echo "   docker compose -f docker-compose.prod.yml ps"
echo ""
echo "5. 查看日志:"
echo "   docker compose -f docker-compose.prod.yml logs -f"

echo ""
echo "🎉 配置验证完成！"

# 询问是否立即部署
echo ""
read -p "是否立即部署到生产环境? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 开始部署..."
    docker compose -f docker-compose.prod.yml up -d
    
    echo ""
    echo "⏳ 等待服务启动..."
    sleep 10
    
    echo ""
    echo "📊 服务状态:"
    docker compose -f docker-compose.prod.yml ps
    
    echo ""
    echo "🔍 健康检查:"
    echo "- 网站访问: curl -I http://tkmail.fun/"
    echo "- API测试: curl -X POST http://tkmail.fun/api/auth/login"
    
else
    echo "📝 配置验证完成，可以稍后部署"
fi 