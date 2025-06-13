#!/bin/bash

# 修复tkmail.fun生产环境前端API配置
# 问题：前端配置的API地址不正确，导致登录失败

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否在正确的目录
if [ ! -f "docker-compose.prod.yml" ]; then
    log_error "未找到 docker-compose.prod.yml 文件"
    log_info "请确保在 /opt/edm 目录下执行此脚本"
    exit 1
fi

log_step "修复前端API配置..."

# 备份原配置
cp docker-compose.prod.yml docker-compose.prod.yml.backup.$(date +%Y%m%d_%H%M%S)
log_info "已备份原配置文件"

# 修复API配置
sed -i 's|REACT_APP_API_BASE_URL:.*|REACT_APP_API_BASE_URL: https://api.tkmail.fun/api|' docker-compose.prod.yml

log_info "已修复API配置：https://api.tkmail.fun/api"

log_step "重新构建并启动前端服务..."

# 停止前端服务
docker-compose -f docker-compose.prod.yml stop frontend

# 重新构建前端
docker-compose -f docker-compose.prod.yml build --no-cache frontend

# 启动前端服务
docker-compose -f docker-compose.prod.yml up -d frontend

log_step "等待服务启动..."
sleep 10

# 检查服务状态
if docker-compose -f docker-compose.prod.yml ps frontend | grep -q "Up"; then
    log_info "✅ 前端服务已成功重启"
else
    log_error "❌ 前端服务启动失败"
    exit 1
fi

log_step "验证修复结果..."

# 检查前端页面
if curl -s -I https://tkmail.fun | grep -q "200 OK"; then
    log_info "✅ 前端页面正常访问"
else
    log_error "❌ 前端页面访问异常"
fi

# 检查API连接
if curl -s https://api.tkmail.fun/api/health > /dev/null 2>&1; then
    log_info "✅ API服务正常"
else
    log_info "⚠️  API健康检查未响应（可能未实现health接口）"
fi

log_info "🎉 修复完成！"
log_info "现在可以访问 https://tkmail.fun 并使用 admin/admin123456 登录"

echo
echo "修复内容："
echo "- 前端API地址：https://api.tkmail.fun/api"
echo "- 重新构建前端容器"
echo "- 重启前端服务"
echo
echo "如果仍有问题，请检查："
echo "1. DNS解析是否正确"
echo "2. SSL证书是否有效"
echo "3. 防火墙设置" 