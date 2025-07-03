#!/bin/bash
# 本地Docker构建 + 镜像上传 + 生产部署脚本
# 最专业的解决方案：零生产服务器内存消耗

set -e

echo "🐳 EDM前端Docker构建部署器 v1.0"
echo "=================================="

# 配置参数
PROD_SERVER="ubuntu@43.135.38.15"
IMAGE_NAME="edm-frontend"
REGISTRY_HOST=""  # 如果有私有仓库可以填写
BACKUP_DIR="/home/ubuntu/edm-backups"

# 获取版本标签
get_version_tag() {
    # 使用时间戳作为版本标签
    VERSION_TAG=$(date +%Y%m%d_%H%M%S)
    echo "📋 版本标签: ${VERSION_TAG}"
}

# 检查本地环境
check_local_env() {
    echo "🔍 1. 检查本地环境..."
    
    if [ ! -d "src/frontend" ]; then
        echo "❌ 错误：未找到前端目录 src/frontend"
        echo "💡 请在EDM项目根目录执行此脚本"
        exit 1
    fi
    
    # 检查Docker
    if ! command -v docker &> /dev/null; then
        echo "❌ 错误：Docker未安装"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        echo "❌ 错误：Docker服务未启动"
        exit 1
    fi
    
    echo "✅ 本地环境检查通过"
    echo "   - Docker: $(docker --version)"
    echo "   - 项目目录: $(pwd)"
}

# 构建生产优化的Dockerfile
create_optimized_dockerfile() {
    echo "📝 2. 创建生产优化Dockerfile..."
    
    cat > src/frontend/Dockerfile.prod-optimized << 'EOF'
# 多阶段构建：本地优化版本
FROM node:18-alpine as builder

# 设置构建优化参数
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV GENERATE_SOURCEMAP=false
ENV REACT_APP_GENERATE_SOURCEMAP=false

WORKDIR /app

# 复制package文件并安装依赖
COPY package*.json ./
RUN npm ci --only=production --silent --no-audit --no-fund

# 复制源代码
COPY . .

# 设置生产环境变量
ENV REACT_APP_API_BASE_URL=/api
ENV REACT_APP_TRACKING_BASE_URL=https://tkmail.fun
ENV REACT_APP_IMAGE_BASE_URL=https://tkmail.fun/uploads

# 构建生产版本
RUN npm run build

# 生产运行阶段 - 使用nginx
FROM nginx:alpine

# 复制构建结果
COPY --from=builder /app/build /usr/share/nginx/html

# 创建优化的nginx配置
RUN echo 'server {' > /etc/nginx/conf.d/default.conf && \
    echo '    listen 80;' >> /etc/nginx/conf.d/default.conf && \
    echo '    server_name localhost;' >> /etc/nginx/conf.d/default.conf && \
    echo '    root /usr/share/nginx/html;' >> /etc/nginx/conf.d/default.conf && \
    echo '    index index.html index.htm;' >> /etc/nginx/conf.d/default.conf && \
    echo '    # Gzip压缩优化' >> /etc/nginx/conf.d/default.conf && \
    echo '    gzip on;' >> /etc/nginx/conf.d/default.conf && \
    echo '    gzip_vary on;' >> /etc/nginx/conf.d/default.conf && \
    echo '    gzip_min_length 1024;' >> /etc/nginx/conf.d/default.conf && \
    echo '    gzip_comp_level 6;' >> /etc/nginx/conf.d/default.conf && \
    echo '    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript application/x-javascript;' >> /etc/nginx/conf.d/default.conf && \
    echo '    # 静态资源缓存' >> /etc/nginx/conf.d/default.conf && \
    echo '    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {' >> /etc/nginx/conf.d/default.conf && \
    echo '        expires 1y;' >> /etc/nginx/conf.d/default.conf && \
    echo '        add_header Cache-Control "public, immutable";' >> /etc/nginx/conf.d/default.conf && \
    echo '    }' >> /etc/nginx/conf.d/default.conf && \
    echo '    # SPA路由支持' >> /etc/nginx/conf.d/default.conf && \
    echo '    location / {' >> /etc/nginx/conf.d/default.conf && \
    echo '        try_files $uri $uri/ /index.html;' >> /etc/nginx/conf.d/default.conf && \
    echo '        add_header Cache-Control "no-cache, no-store, must-revalidate";' >> /etc/nginx/conf.d/default.conf && \
    echo '        add_header Pragma "no-cache";' >> /etc/nginx/conf.d/default.conf && \
    echo '        add_header Expires "0";' >> /etc/nginx/conf.d/default.conf && \
    echo '    }' >> /etc/nginx/conf.d/default.conf && \
    echo '    # 安全头' >> /etc/nginx/conf.d/default.conf && \
    echo '    add_header X-Frame-Options "SAMEORIGIN" always;' >> /etc/nginx/conf.d/default.conf && \
    echo '    add_header X-Content-Type-Options "nosniff" always;' >> /etc/nginx/conf.d/default.conf && \
    echo '    add_header X-XSS-Protection "1; mode=block" always;' >> /etc/nginx/conf.d/default.conf && \
    echo '}' >> /etc/nginx/conf.d/default.conf

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
EOF
    
    echo "✅ 优化Dockerfile已创建"
}

# 本地Docker构建
build_docker_image() {
    echo "🏗️ 3. 本地Docker构建..."
    
    cd src/frontend
    
    # 清理旧镜像（可选）
    echo "清理旧镜像..."
    docker rmi "${IMAGE_NAME}:latest" 2>/dev/null || true
    docker rmi "${IMAGE_NAME}:${VERSION_TAG}" 2>/dev/null || true
    
    # 开始构建
    echo "开始Docker构建..."
    BUILD_START=$(date +%s)
    
    docker build \
        -f Dockerfile.prod-optimized \
        -t "${IMAGE_NAME}:${VERSION_TAG}" \
        -t "${IMAGE_NAME}:latest" \
        .
    
    BUILD_END=$(date +%s)
    BUILD_DURATION=$((BUILD_END - BUILD_START))
    
    # 获取镜像信息
    IMAGE_SIZE=$(docker images "${IMAGE_NAME}:${VERSION_TAG}" --format "{{.Size}}")
    
    echo "✅ Docker构建完成！"
    echo "   - 构建时间: ${BUILD_DURATION}秒"
    echo "   - 镜像大小: ${IMAGE_SIZE}"
    echo "   - 镜像标签: ${IMAGE_NAME}:${VERSION_TAG}"
    
    cd ../../
}

# 保存镜像为tar文件
save_docker_image() {
    echo "💾 4. 保存Docker镜像..."
    
    TAR_FILE="${IMAGE_NAME}-${VERSION_TAG}.tar"
    
    echo "保存镜像到tar文件..."
    docker save "${IMAGE_NAME}:${VERSION_TAG}" -o "${TAR_FILE}"
    
    TAR_SIZE=$(du -sh "${TAR_FILE}" | cut -f1)
    echo "✅ 镜像保存完成"
    echo "   - 文件名: ${TAR_FILE}"
    echo "   - 文件大小: ${TAR_SIZE}"
}

# 上传镜像到生产服务器
upload_image() {
    echo "🚀 5. 上传镜像到生产服务器..."
    
    echo "上传tar文件..."
    scp "${TAR_FILE}" "${PROD_SERVER}:/tmp/"
    
    echo "✅ 上传完成"
}

# 在生产服务器上部署
deploy_on_production() {
    echo "🎯 6. 生产服务器部署..."
    
    ssh "${PROD_SERVER}" << EOF
set -e

echo "=== 生产服务器部署开始 ==="

# 加载Docker镜像
echo "加载Docker镜像..."
docker load -i /tmp/${TAR_FILE}

# 验证镜像加载
if docker images | grep -q "${IMAGE_NAME}.*${VERSION_TAG}"; then
    echo "✅ 镜像加载成功"
else
    echo "❌ 镜像加载失败"
    exit 1
fi

# 创建备份目录
mkdir -p ${BACKUP_DIR}

# 停止现有前端容器
echo "停止现有前端容器..."
OLD_CONTAINER=\$(docker ps -q --filter "name=edm-frontend")
if [ ! -z "\$OLD_CONTAINER" ]; then
    # 备份当前运行的镜像信息
    docker ps --filter "name=edm-frontend" --format "{{.Image}}" > ${BACKUP_DIR}/last-frontend-image.txt
    echo "备份镜像信息: \$(cat ${BACKUP_DIR}/last-frontend-image.txt)"
    
    docker stop edm-frontend-prod 2>/dev/null || true
    docker stop edm-frontend-mount 2>/dev/null || true
    docker rm edm-frontend-prod 2>/dev/null || true  
    docker rm edm-frontend-mount 2>/dev/null || true
fi

# 启动新的前端容器
echo "启动新前端容器..."
docker run -d \\
    --name edm-frontend-prod \\
    --network edm-network \\
    -p 3000:80 \\
    --restart unless-stopped \\
    --health-cmd="curl -f http://localhost/ || exit 1" \\
    --health-interval=30s \\
    --health-timeout=3s \\
    --health-retries=3 \\
    "${IMAGE_NAME}:${VERSION_TAG}"

# 等待容器启动
echo "等待容器启动..."
sleep 5

# 检查容器健康状态
HEALTH_STATUS=\$(docker inspect --format='{{.State.Health.Status}}' edm-frontend-prod 2>/dev/null || echo "no-health")
CONTAINER_STATUS=\$(docker inspect --format='{{.State.Status}}' edm-frontend-prod)

echo "容器状态: \$CONTAINER_STATUS"
echo "健康状态: \$HEALTH_STATUS"

if [ "\$CONTAINER_STATUS" = "running" ]; then
    echo "✅ 前端容器启动成功"
    
    # 等待健康检查通过
    echo "等待健康检查..."
    for i in {1..12}; do
        HEALTH=\$(docker inspect --format='{{.State.Health.Status}}' edm-frontend-prod 2>/dev/null || echo "starting")
        if [ "\$HEALTH" = "healthy" ]; then
            echo "✅ 健康检查通过"
            break
        elif [ "\$HEALTH" = "unhealthy" ]; then
            echo "❌ 健康检查失败"
            docker logs edm-frontend-prod --tail 20
            exit 1
        else
            echo "⏳ 健康检查中... (\$i/12)"
            sleep 5
        fi
    done
else
    echo "❌ 前端容器启动失败"
    docker logs edm-frontend-prod
    exit 1
fi

# 清理临时文件和旧镜像
echo "清理临时文件..."
rm /tmp/${TAR_FILE}

# 清理旧镜像（保留最近3个版本）
echo "清理旧镜像..."
docker images "${IMAGE_NAME}" --format "{{.Tag}}" | grep -v "latest" | tail -n +4 | xargs -r -I {} docker rmi "${IMAGE_NAME}:{}" 2>/dev/null || true

echo "=== 部署完成 ==="
echo "🌐 网站访问: https://tkmail.fun"

# 快速测试
echo "快速功能测试..."
curl -s -o /dev/null -w "本地响应时间: %{time_total}s\\n" http://localhost:3000 || echo "⚠️ 本地测试失败"

EOF
}

# 清理本地临时文件
cleanup() {
    echo "🧹 7. 清理本地临时文件..."
    
    # 删除tar文件
    rm -f "${TAR_FILE}"
    
    # 删除临时Dockerfile
    rm -f "src/frontend/Dockerfile.prod-optimized"
    
    # 可选：清理本地镜像（保留latest）
    read -p "是否清理本地构建镜像？(y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker rmi "${IMAGE_NAME}:${VERSION_TAG}" 2>/dev/null || true
        echo "✅ 本地镜像已清理"
    fi
    
    echo "✅ 清理完成"
}

# 验证部署结果
verify_deployment() {
    echo "🔍 8. 验证部署结果..."
    
    echo "测试网站访问..."
    RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" https://tkmail.fun)
    
    if [ $? -eq 0 ]; then
        echo "✅ 网站访问正常"
        echo "   响应时间: ${RESPONSE_TIME}s"
    else
        echo "⚠️ 网站访问测试失败，请手动检查"
    fi
    
    echo "检查生产服务器容器状态..."
    ssh "${PROD_SERVER}" "echo '容器状态:' && docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep frontend && echo '镜像信息:' && docker images ${IMAGE_NAME} | head -3"
}

# 回滚功能
rollback_function() {
    echo "🔄 回滚到上一版本..."
    
    ssh "${PROD_SERVER}" << 'EOF'
set -e

BACKUP_DIR="/home/ubuntu/edm-backups"
LAST_IMAGE_FILE="${BACKUP_DIR}/last-frontend-image.txt"

if [ -f "$LAST_IMAGE_FILE" ]; then
    LAST_IMAGE=$(cat "$LAST_IMAGE_FILE")
    echo "发现上一版本镜像: $LAST_IMAGE"
    
    # 停止当前容器
    docker stop edm-frontend-prod || true
    docker rm edm-frontend-prod || true
    
    # 启动上一版本
    docker run -d \
        --name edm-frontend-prod \
        --network edm-network \
        -p 3000:80 \
        --restart unless-stopped \
        "$LAST_IMAGE"
    
    echo "✅ 回滚完成"
else
    echo "❌ 未找到备份信息，无法回滚"
    exit 1
fi
EOF
}

# 主函数
main() {
    case "${1:-deploy}" in
        "deploy")
            echo "🎯 开始Docker构建部署流程..."
            echo ""
            
            # 记录开始时间
            START_TIME=$(date +%s)
            
            # 获取版本标签
            get_version_tag
            
            # 执行部署流程
            check_local_env
            create_optimized_dockerfile
            build_docker_image
            save_docker_image
            upload_image
            deploy_on_production
            cleanup
            verify_deployment
            
            # 计算总时间
            END_TIME=$(date +%s)
            DURATION=$((END_TIME - START_TIME))
            
            echo ""
            echo "🎉 Docker部署完成！"
            echo "================================="
            echo "✅ 总耗时: ${DURATION}秒"
            echo "✅ 构建方式: 本地Docker构建"
            echo "✅ 部署方式: Docker容器"
            echo "✅ 镜像版本: ${IMAGE_NAME}:${VERSION_TAG}"
            echo "✅ 网站地址: https://tkmail.fun"
            echo ""
            echo "💡 命令速查："
            echo "   部署: ./scripts/local-docker-build-deploy.sh"
            echo "   回滚: ./scripts/local-docker-build-deploy.sh rollback"
            echo "   查看: ssh ${PROD_SERVER} 'docker ps | grep frontend'"
            ;;
        "rollback")
            rollback_function
            ;;
        *)
            echo "用法: $0 [deploy|rollback]"
            echo "  deploy   - 构建并部署（默认）"
            echo "  rollback - 回滚到上一版本"
            ;;
    esac
}

# 错误处理
trap 'echo "❌ 脚本执行失败，请检查错误信息"; exit 1' ERR

# 执行主函数
main "$@" 