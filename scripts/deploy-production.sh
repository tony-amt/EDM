#!/bin/bash

# EDM系统生产环境部署脚本
# 使用方法: ./scripts/deploy-production.sh [服务器IP] [可选:服务名称]

set -e  # 遇到错误立即退出

# 配置变量
SERVER_IP=${1:-"43.135.38.15"}
SERVER_USER="ubuntu"
SSH_KEY="~/.ssh/edm_deploy_key"
DEPLOY_PATH="/opt/edm"
SERVICE_NAME=${2:-"all"}  # all, frontend, backend, nginx

# 颜色输出
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

# 检查必要工具
check_requirements() {
    log_info "检查部署环境..."
    
    if ! command -v ssh &> /dev/null; then
        log_error "SSH客户端未安装"
        exit 1
    fi
    
    if ! command -v scp &> /dev/null; then
        log_error "SCP客户端未安装"
        exit 1
    fi
    
    if [ ! -f "${SSH_KEY}" ]; then
        log_error "SSH密钥文件不存在: ${SSH_KEY}"
        exit 1
    fi
    
    log_success "环境检查通过"
}

# 配置验证
validate_config() {
    log_info "验证配置文件..."
    
    # 检查关键配置文件
    local files=(
        "docker-compose.prod.yml"
        "nginx/nginx.conf"
        "src/frontend/Dockerfile"
        "src/frontend/nginx.conf"
    )
    
    for file in "${files[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "配置文件缺失: $file"
            exit 1
        fi
    done
    
    # 检查前端配置
    if grep -q "localhost:3000" src/frontend/src/config/constants.ts; then
        log_error "前端配置包含硬编码URL: src/frontend/src/config/constants.ts"
        exit 1
    fi
    
    if grep -q "localhost:3000" src/frontend/src/services/api.ts; then
        log_error "前端配置包含硬编码URL: src/frontend/src/services/api.ts"
        exit 1
    fi
    
    # 检查CORS配置
    if ! grep -q "CORS_ORIGIN" docker-compose.prod.yml; then
        log_warning "docker-compose.prod.yml中未找到CORS_ORIGIN配置"
    fi
    
    log_success "配置验证通过"
}

# 备份当前版本
backup_current_version() {
    log_info "备份当前版本..."
    
    ssh -i "${SSH_KEY}" "${SERVER_USER}@${SERVER_IP}" \
        "sudo cp -r ${DEPLOY_PATH} ${DEPLOY_PATH}-backup-\$(date +%Y%m%d-%H%M%S) 2>/dev/null || true"
    
    log_success "备份完成"
}

# 上传代码
upload_code() {
    log_info "上传代码到服务器..."
    
    # 创建临时目录
    ssh -i "${SSH_KEY}" "${SERVER_USER}@${SERVER_IP}" "mkdir -p /tmp/edm-deploy"
    
    # 上传关键文件
    scp -i "${SSH_KEY}" docker-compose.prod.yml "${SERVER_USER}@${SERVER_IP}:/tmp/edm-deploy/"
    scp -i "${SSH_KEY}" -r nginx "${SERVER_USER}@${SERVER_IP}:/tmp/edm-deploy/"
    scp -i "${SSH_KEY}" -r src "${SERVER_USER}@${SERVER_IP}:/tmp/edm-deploy/"
    
    # 复制到部署目录
    ssh -i "${SSH_KEY}" "${SERVER_USER}@${SERVER_IP}" "
        sudo cp /tmp/edm-deploy/docker-compose.prod.yml ${DEPLOY_PATH}/
        sudo cp -r /tmp/edm-deploy/nginx/* ${DEPLOY_PATH}/nginx/
        sudo cp -r /tmp/edm-deploy/src/* ${DEPLOY_PATH}/src/
        sudo chown -R ubuntu:ubuntu ${DEPLOY_PATH}
        sudo rm -rf /tmp/edm-deploy
    "
    
    log_success "代码上传完成"
}

# 部署服务
deploy_service() {
    local service=$1
    log_info "部署服务: $service"
    
    ssh -i "${SSH_KEY}" "${SERVER_USER}@${SERVER_IP}" "
        cd ${DEPLOY_PATH}
        
        if [ '$service' = 'all' ]; then
            sudo docker compose -f docker-compose.prod.yml down
            sudo docker compose -f docker-compose.prod.yml build --no-cache
            sudo docker compose -f docker-compose.prod.yml up -d
        else
            sudo docker compose -f docker-compose.prod.yml build --no-cache $service
            sudo docker compose -f docker-compose.prod.yml up -d $service
        fi
    "
    
    log_success "服务部署完成: $service"
}

# 健康检查
health_check() {
    log_info "执行健康检查..."
    
    # 等待服务启动
    sleep 30
    
    # 检查容器状态
    log_info "检查容器状态..."
    ssh -i "${SSH_KEY}" "${SERVER_USER}@${SERVER_IP}" "
        docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
    "
    
    # 检查网站访问
    log_info "检查网站访问..."
    if curl -s -I "http://${SERVER_IP}/" | grep -q "200 OK"; then
        log_success "网站访问正常"
    else
        log_error "网站访问失败"
        return 1
    fi
    
    # 检查API
    log_info "检查API接口..."
    if curl -s "http://${SERVER_IP}/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"usernameOrEmail":"admin","password":"admin123456"}' | grep -q "token"; then
        log_success "API接口正常"
    else
        log_error "API接口异常"
        return 1
    fi
    
    log_success "健康检查通过"
}

# 清理临时文件
cleanup() {
    log_info "清理临时文件..."
    
    ssh -i "${SSH_KEY}" "${SERVER_USER}@${SERVER_IP}" "
        sudo rm -rf /tmp/edm-deploy /tmp/*.ts /tmp/Dockerfile /tmp/nginx.conf /tmp/docker-compose.prod.yml 2>/dev/null || true
    "
    
    log_success "清理完成"
}

# 回滚函数
rollback() {
    log_warning "开始回滚..."
    
    local backup_dir=$(ssh -i "${SSH_KEY}" "${SERVER_USER}@${SERVER_IP}" "ls -t ${DEPLOY_PATH}-backup-* 2>/dev/null | head -1")
    
    if [ -z "$backup_dir" ]; then
        log_error "未找到备份目录"
        exit 1
    fi
    
    ssh -i "${SSH_KEY}" "${SERVER_USER}@${SERVER_IP}" "
        cd ${DEPLOY_PATH}
        sudo docker compose -f docker-compose.prod.yml down
        sudo rm -rf ${DEPLOY_PATH}/src
        sudo cp -r $backup_dir/src ${DEPLOY_PATH}/
        sudo cp $backup_dir/docker-compose.prod.yml ${DEPLOY_PATH}/
        sudo docker compose -f docker-compose.prod.yml up -d
    "
    
    log_success "回滚完成"
}

# 显示帮助信息
show_help() {
    echo "EDM系统生产环境部署脚本"
    echo ""
    echo "使用方法:"
    echo "  $0 [服务器IP] [服务名称]"
    echo ""
    echo "参数:"
    echo "  服务器IP    目标服务器IP地址 (默认: 43.135.38.15)"
    echo "  服务名称    要部署的服务 (默认: all)"
    echo "             可选值: all, frontend, backend, nginx"
    echo ""
    echo "示例:"
    echo "  $0                          # 部署所有服务到默认服务器"
    echo "  $0 192.168.1.100           # 部署所有服务到指定服务器"
    echo "  $0 192.168.1.100 frontend  # 只部署前端服务"
    echo ""
    echo "环境变量:"
    echo "  ROLLBACK=1                  # 执行回滚操作"
    echo ""
    echo "回滚示例:"
    echo "  ROLLBACK=1 $0 192.168.1.100"
}

# 主函数
main() {
    echo "========================================"
    echo "    EDM系统生产环境部署脚本 v1.0"
    echo "========================================"
    echo ""
    
    # 检查帮助参数
    if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
        show_help
        exit 0
    fi
    
    # 检查回滚模式
    if [ "$ROLLBACK" = "1" ]; then
        rollback
        exit 0
    fi
    
    log_info "开始部署到服务器: $SERVER_IP"
    log_info "部署服务: $SERVICE_NAME"
    echo ""
    
    # 执行部署流程
    check_requirements
    validate_config
    backup_current_version
    upload_code
    deploy_service "$SERVICE_NAME"
    
    # 健康检查
    if health_check; then
        cleanup
        echo ""
        log_success "🎉 部署成功完成!"
        echo ""
        echo "访问地址: http://${SERVER_IP}/"
        echo "登录账号: admin"
        echo "登录密码: admin123456"
    else
        log_error "健康检查失败，建议检查日志或执行回滚"
        echo ""
        echo "回滚命令: ROLLBACK=1 $0 $SERVER_IP"
        exit 1
    fi
}

# 错误处理
trap 'log_error "部署过程中发生错误，请检查日志"; exit 1' ERR

# 执行主函数
main "$@" 