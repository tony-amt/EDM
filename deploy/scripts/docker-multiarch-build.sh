#!/bin/bash

# EDM项目多架构Docker构建脚本
# 解决Docker架构兼容性问题

set -e

echo "🚀 开始多架构Docker构建..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 版本信息
VERSION=${1:-latest}
REGISTRY=${2:-edm}

echo -e "${BLUE}📦 构建版本: ${VERSION}${NC}"
echo -e "${BLUE}🏷️  镜像仓库: ${REGISTRY}${NC}"

# 1. 检查并创建buildx构建器
echo -e "${BLUE}🔧 检查Docker buildx构建器...${NC}"
if ! docker buildx ls | grep -q multiarch-builder; then
    echo -e "${YELLOW}⚙️  创建多架构构建器...${NC}"
    docker buildx create --name multiarch-builder --use --platform linux/amd64,linux/arm64
else
    echo -e "${GREEN}✅ 多架构构建器已存在${NC}"
    docker buildx use multiarch-builder
fi

# 2. 构建前端镜像（多架构支持）
build_frontend() {
    echo -e "${BLUE}🔨 构建前端镜像（多架构）...${NC}"
    cd src/frontend
    
    # 使用buildx进行多架构构建
    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        --tag ${REGISTRY}-frontend:${VERSION} \
        --tag ${REGISTRY}-frontend:latest \
        --file Dockerfile.prod \
        --load \
        .
    
    cd ../..
    echo -e "${GREEN}✅ 前端镜像构建完成${NC}"
}

# 3. 构建后端镜像（多架构支持）
build_backend() {
    echo -e "${BLUE}🔨 构建后端镜像（多架构）...${NC}"
    cd src/backend
    
    # 检查Dockerfile是否存在
    if [ ! -f "Dockerfile" ]; then
        echo -e "${RED}❌ 后端Dockerfile不存在${NC}"
        return 1
    fi
    
    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        --tag ${REGISTRY}-backend:${VERSION} \
        --tag ${REGISTRY}-backend:latest \
        --load \
        .
    
    cd ../..
    echo -e "${GREEN}✅ 后端镜像构建完成${NC}"
}

# 4. 构建服务镜像
build_services() {
    echo -e "${BLUE}🔨 构建微服务镜像...${NC}"
    
    for service in image-service tracking-service webhook-service; do
        if [ -d "services/${service}" ]; then
            echo -e "${YELLOW}📦 构建 ${service}...${NC}"
            cd services/${service}
            
            docker buildx build \
                --platform linux/amd64,linux/arm64 \
                --tag ${REGISTRY}-${service}:${VERSION} \
                --tag ${REGISTRY}-${service}:latest \
                --load \
                .
            
            cd ../..
            echo -e "${GREEN}✅ ${service} 构建完成${NC}"
        else
            echo -e "${YELLOW}⚠️  ${service} 目录不存在，跳过${NC}"
        fi
    done
}

# 5. 验证构建结果
verify_images() {
    echo -e "${BLUE}🧪 验证构建镜像...${NC}"
    
    # 检查镜像是否存在
    images=(
        "${REGISTRY}-frontend:${VERSION}"
        "${REGISTRY}-backend:${VERSION}"
    )
    
    for image in "${images[@]}"; do
        if docker images | grep -q "${image%:*}"; then
            echo -e "${GREEN}✅ ${image} 存在${NC}"
        else
            echo -e "${RED}❌ ${image} 不存在${NC}"
            return 1
        fi
    done
}

# 6. 生成docker-compose配置
generate_compose() {
    echo -e "${BLUE}📝 生成多架构docker-compose配置...${NC}"
    
    cat > docker-compose.multiarch.yml << EOF
version: '3.8'

services:
  frontend:
    image: ${REGISTRY}-frontend:${VERSION}
    container_name: edm-frontend-multiarch
    ports:
      - "80:80"
    restart: unless-stopped
    networks:
      - edm-network

  backend:
    image: ${REGISTRY}-backend:${VERSION}
    container_name: edm-backend-multiarch
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - REDIS_HOST=redis
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    networks:
      - edm-network

  postgres:
    image: postgres:13-alpine
    container_name: edm-postgres-multiarch
    environment:
      - POSTGRES_DB=edm
      - POSTGRES_USER=edm_user
      - POSTGRES_PASSWORD=edm_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - edm-network

  redis:
    image: redis:7-alpine
    container_name: edm-redis-multiarch
    restart: unless-stopped
    networks:
      - edm-network

networks:
  edm-network:
    driver: bridge

volumes:
  postgres_data:
EOF

    echo -e "${GREEN}✅ docker-compose.multiarch.yml 已生成${NC}"
}

# 7. 清理构建缓存
cleanup_build_cache() {
    echo -e "${BLUE}🧹 清理构建缓存...${NC}"
    docker buildx prune -f
    echo -e "${GREEN}✅ 构建缓存已清理${NC}"
}

# 主函数执行流程
main() {
    echo -e "${BLUE}🎯 开始EDM多架构构建流程...${NC}"
    
    # 检查Docker版本
    if ! docker buildx version >/dev/null 2>&1; then
        echo -e "${RED}❌ Docker buildx 不可用，请升级Docker版本${NC}"
        exit 1
    fi
    
    # 执行构建步骤
    build_frontend
    build_backend
    build_services
    verify_images
    generate_compose
    cleanup_build_cache
    
    echo -e "${GREEN}🎉 多架构构建完成！${NC}"
    echo -e "${BLUE}📋 使用以下命令启动服务：${NC}"
    echo -e "${YELLOW}   docker-compose -f docker-compose.multiarch.yml up -d${NC}"
}

# 错误处理
trap 'echo -e "${RED}❌ 构建过程中发生错误${NC}"; exit 1' ERR

# 执行主函数
main

echo -e "${GREEN}✨ EDM多架构Docker构建完成！${NC}" 