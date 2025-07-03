#!/bin/bash

# EDM系统快速回滚脚本
# 使用方法: ./scripts/rollback.sh [版本号]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 获取目标版本
TARGET_VERSION=${1}

if [ -z "$TARGET_VERSION" ]; then
    # 获取当前版本之前的版本
    CURRENT_VERSION=$(docker image inspect edm-frontend-prod --format='{{.Config.Labels.version}}' 2>/dev/null || echo "unknown")
    
    log_info "当前版本: $CURRENT_VERSION"
    log_info "获取可用的回滚版本..."
    
    # 列出可用的镜像版本
    AVAILABLE_VERSIONS=$(docker images edm-frontend --format "{{.Tag}}" | grep -E "^v[0-9]+\.[0-9]+\.[0-9]+$" | head -5)
    
    if [ -z "$AVAILABLE_VERSIONS" ]; then
        log_error "未找到可用的回滚版本"
        exit 1
    fi
    
    echo "可用版本:"
    echo "$AVAILABLE_VERSIONS" | nl
    
    read -p "请选择要回滚的版本号 (直接输入版本号，如 v1.0.0): " TARGET_VERSION
    
    if [ -z "$TARGET_VERSION" ]; then
        log_error "未指定版本号"
        exit 1
    fi
fi

log_info "开始回滚到版本: $TARGET_VERSION"

# 检查目标版本是否存在
if ! docker images edm-frontend:$TARGET_VERSION --format "{{.Tag}}" | grep -q "$TARGET_VERSION"; then
    log_error "版本 $TARGET_VERSION 不存在"
    log_info "可用版本:"
    docker images edm-frontend --format "table {{.Tag}}\t{{.CreatedAt}}"
    exit 1
fi

# 备份当前状态
log_info "备份当前状态..."
BACKUP_DIR="/tmp/edm-rollback-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# 导出当前容器配置
docker inspect edm-frontend-prod > "$BACKUP_DIR/container-config.json" 2>/dev/null || true
log_success "备份完成: $BACKUP_DIR"

# 停止当前容器
log_info "停止当前前端容器..."
docker stop edm-frontend-prod 2>/dev/null || log_warning "容器可能已经停止"

# 删除当前容器
log_info "删除当前前端容器..."
docker rm edm-frontend-prod 2>/dev/null || log_warning "容器可能已经删除"

# 启动目标版本容器
log_info "启动版本 $TARGET_VERSION..."
docker run -d \
    --name edm-frontend-prod \
    --network edm_edm-network \
    --restart unless-stopped \
    edm-frontend:$TARGET_VERSION

if [ $? -ne 0 ]; then
    log_error "启动容器失败"
    exit 1
fi

# 等待服务启动
log_info "等待服务启动..."
sleep 30

# 健康检查
log_info "执行健康检查..."
HEALTH_CHECK_PASSED=false

for i in {1..10}; do
    if curl -f -s -o /dev/null https://tkmail.fun; then
        HEALTH_CHECK_PASSED=true
        break
    else
        log_info "健康检查 $i/10 - 等待服务响应..."
        sleep 10
    fi
done

if [ "$HEALTH_CHECK_PASSED" = true ]; then
    log_success "✅ 回滚成功完成！"
    log_success "当前版本: $TARGET_VERSION"
    log_success "服务地址: https://tkmail.fun"
    log_info "备份位置: $BACKUP_DIR"
else
    log_error "❌ 健康检查失败"
    log_error "回滚可能未成功完成，请手动检查服务状态"
    
    # 显示容器状态
    log_info "容器状态:"
    docker ps -f name=edm-frontend-prod
    
    # 显示容器日志
    log_info "容器日志 (最后20行):"
    docker logs --tail 20 edm-frontend-prod
    
    exit 1
fi

# 清理旧的备份（保留最近5个）
log_info "清理旧备份..."
find /tmp -name "edm-rollback-backup-*" -type d -mtime +7 -exec rm -rf {} \; 2>/dev/null || true

log_success "🎉 回滚操作完成！" 