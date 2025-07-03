#!/bin/bash

# 生产环境前端构建优化脚本
# 解决4GB内存服务器构建卡死问题

set -e

echo "🔧 EDM生产环境构建优化器 v1.0"
echo "=================================="

# 1. 紧急优化：清理Docker缓存和添加Swap
optimize_server() {
    echo "📊 1. 服务器资源优化..."
    
    # 检查Swap状态
    echo "检查Swap配置..."
    SWAP_SIZE=$(swapon --show=SIZE --noheadings | head -1 | sed 's/[^0-9.]//g' || echo "0")
    
    if [ "$SWAP_SIZE" = "0" ] || [ -z "$SWAP_SIZE" ]; then
        echo "⚠️  警告：未检测到Swap，创建2GB Swap..."
        sudo fallocate -l 2G /swapfile
        sudo chmod 600 /swapfile
        sudo mkswap /swapfile
        sudo swapon /swapfile
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
        echo "✅ Swap已创建并启用"
    else
        echo "✅ Swap已存在: ${SWAP_SIZE}"
    fi
    
    # 清理Docker缓存
    echo "清理Docker构建缓存..."
    docker system prune -f --volumes
    docker builder prune -f --all
    
    # 清理未使用的镜像
    echo "清理无用镜像..."
    docker image prune -f
    
    echo "📊 优化后资源状态："
    free -h
    docker system df
}

# 2. 优化前端构建配置
optimize_frontend_build() {
    echo "🎯 2. 前端构建优化..."
    
    # 创建内存优化的Dockerfile
    cat > src/frontend/Dockerfile.memory-optimized << 'EOF'
# 内存优化版本 - 解决4GB服务器构建问题
FROM node:18-alpine as builder

# 设置内存限制和优化参数
ENV NODE_OPTIONS="--max-old-space-size=2048 --optimize-for-size"
ENV GENERATE_SOURCEMAP=false
ENV REACT_APP_GENERATE_SOURCEMAP=false

WORKDIR /app

# 只复制package文件，利用Docker缓存
COPY package*.json ./

# 安装依赖（生产环境优化）
RUN npm ci --only=production --silent --no-audit --no-fund

# 复制源代码
COPY . .

# 分阶段构建，减少内存峰值
RUN npm run build

# 最终镜像 - 只包含静态文件
FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html

# 优化的nginx配置
RUN echo 'server {' > /etc/nginx/conf.d/default.conf && \
    echo '    listen 80;' >> /etc/nginx/conf.d/default.conf && \
    echo '    root /usr/share/nginx/html;' >> /etc/nginx/conf.d/default.conf && \
    echo '    index index.html;' >> /etc/nginx/conf.d/default.conf && \
    echo '    gzip on;' >> /etc/nginx/conf.d/default.conf && \
    echo '    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;' >> /etc/nginx/conf.d/default.conf && \
    echo '    location / {' >> /etc/nginx/conf.d/default.conf && \
    echo '        try_files \$uri \$uri/ /index.html;' >> /etc/nginx/conf.d/default.conf && \
    echo '    }' >> /etc/nginx/conf.d/default.conf && \
    echo '}' >> /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
EOF

    echo "✅ 内存优化Dockerfile已创建"
}

# 3. 本地构建脚本
create_local_build_script() {
    echo "🏗️ 3. 创建本地构建脚本..."
    
    cat > scripts/local-build-deploy.sh << 'EOF'
#!/bin/bash
# 本地构建 + 生产部署脚本

set -e

echo "🏗️ 本地构建开始..."

# 进入前端目录
cd src/frontend

# 清理旧构建
rm -rf build/

# 设置生产环境变量
export REACT_APP_API_BASE_URL=/api
export REACT_APP_TRACKING_BASE_URL=https://tkmail.fun
export REACT_APP_IMAGE_BASE_URL=https://tkmail.fun/uploads
export GENERATE_SOURCEMAP=false

# 本地构建
npm run build

echo "📦 构建完成，准备部署到生产环境..."

# 打包构建结果
tar -czf build.tar.gz build/

# 上传到生产服务器
scp build.tar.gz ubuntu@43.135.38.15:/tmp/

# 在生产服务器上部署
ssh ubuntu@43.135.38.15 << 'REMOTE_EOF'
set -e

echo "🚀 生产环境部署..."

# 停止frontend-mount容器（如果存在）
docker stop edm-frontend-mount || true
docker rm edm-frontend-mount || true

# 备份现有构建
if [ -d "/home/ubuntu/EDM/frontend-build" ]; then
    cp -r /home/ubuntu/EDM/frontend-build /home/ubuntu/EDM/frontend-build.backup.$(date +%Y%m%d_%H%M%S)
fi

# 创建构建目录
mkdir -p /home/ubuntu/EDM/frontend-build

# 解压新构建
cd /home/ubuntu/EDM
tar -xzf /tmp/build.tar.gz -C frontend-build --strip-components=1

# 启动frontend-mount容器
cd /home/ubuntu/EDM
docker-compose -f deploy/docker/docker-compose.prod.yml --profile mount-mode up -d frontend-mount

# 清理临时文件
rm /tmp/build.tar.gz

echo "✅ 部署完成！"
echo "🌐 访问：https://tkmail.fun"

REMOTE_EOF

echo "✅ 本地构建部署完成！"
EOF

    chmod +x scripts/local-build-deploy.sh
    echo "✅ 本地构建脚本已创建"
}

# 4. 应急构建脚本（低内存模式）
create_emergency_build() {
    echo "🆘 4. 创建应急构建脚本..."
    
    cat > scripts/emergency-build.sh << 'EOF'
#!/bin/bash
# 应急构建脚本 - 在生产服务器上安全构建

set -e

echo "🆘 应急构建模式启动..."

# 停止所有非必要服务
echo "停止非必要服务..."
docker stop edm-tracking-service edm-webhook-service edm-image-service || true

# 清理内存
echo "清理内存..."
docker system prune -f
sync && echo 3 | sudo tee /proc/sys/vm/drop_caches

# 设置内存优化构建
echo "设置内存优化参数..."
export NODE_OPTIONS="--max-old-space-size=1536"

# 使用内存优化版本构建
docker build -f src/frontend/Dockerfile.memory-optimized -t edm-frontend-emergency src/frontend/

# 停止现有前端容器
docker stop edm-frontend-prod || true
docker rm edm-frontend-prod || true

# 启动新容器
docker run -d --name edm-frontend-prod --network edm-network edm-frontend-emergency

# 重启其他服务
echo "重启其他服务..."
docker start edm-tracking-service edm-webhook-service edm-image-service || true

echo "✅ 应急构建完成！"
EOF

    chmod +x scripts/emergency-build.sh
    echo "✅ 应急构建脚本已创建"
}

# 5. 监控脚本
create_monitoring_script() {
    echo "📊 5. 创建监控脚本..."
    
    cat > scripts/build-monitor.sh << 'EOF'
#!/bin/bash
# 构建过程监控脚本

monitor_build() {
    echo "📊 构建监控启动..."
    
    while true; do
        echo "=== $(date) ==="
        echo "内存使用："
        free -h
        echo "Docker资源："
        docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
        echo "磁盘空间："
        df -h /
        echo "------------------------"
        sleep 30
    done
}

# 后台运行监控
monitor_build &
MONITOR_PID=$!

echo "📊 监控进程启动: $MONITOR_PID"
echo "📊 使用 'kill $MONITOR_PID' 停止监控"
EOF

    chmod +x scripts/build-monitor.sh
    echo "✅ 监控脚本已创建"
}

# 主函数
main() {
    echo "🎯 选择执行模式："
    echo "1. 服务器优化（清理缓存、添加Swap）"
    echo "2. 创建本地构建脚本"
    echo "3. 创建应急构建脚本"
    echo "4. 全部执行"
    
    read -p "请选择 (1-4): " choice
    
    case $choice in
        1)
            optimize_server
            ;;
        2)
            optimize_frontend_build
            create_local_build_script
            ;;
        3)
            optimize_frontend_build
            create_emergency_build
            ;;
        4)
            optimize_server
            optimize_frontend_build
            create_local_build_script
            create_emergency_build
            create_monitoring_script
            ;;
        *)
            echo "无效选择"
            exit 1
            ;;
    esac
    
    echo ""
    echo "🎉 优化完成！"
    echo ""
    echo "📋 后续步骤："
    echo "1. 立即使用：./scripts/local-build-deploy.sh"
    echo "2. 应急情况：./scripts/emergency-build.sh"
    echo "3. 监控构建：./scripts/build-monitor.sh"
    echo ""
    echo "💡 建议使用本地构建方案，彻底避免生产服务器内存问题！"
}

# 如果直接运行此脚本
if [ "$0" = "${BASH_SOURCE[0]}" ]; then
    main "$@"
fi 