#!/bin/bash

# EDM系统配置检查脚本
# 用于部署前验证配置文件的正确性

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# 检查计数器
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# 检查函数
check_item() {
    local description="$1"
    local command="$2"
    local is_warning="${3:-false}"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    if eval "$command" &>/dev/null; then
        log_success "$description"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        if [ "$is_warning" = "true" ]; then
            log_warning "$description"
            WARNING_CHECKS=$((WARNING_CHECKS + 1))
        else
            log_error "$description"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
        fi
        return 1
    fi
}

echo "========================================"
echo "    EDM系统配置检查脚本 v1.0"
echo "========================================"
echo ""

# 1. 检查必要文件存在
log_info "检查必要文件..."
check_item "docker-compose.prod.yml 存在" "[ -f 'docker-compose.prod.yml' ]"
check_item "nginx/nginx.conf 存在" "[ -f 'nginx/nginx.conf' ]"
check_item "src/frontend/Dockerfile 存在" "[ -f 'src/frontend/Dockerfile' ]"
check_item "src/frontend/nginx.conf 存在" "[ -f 'src/frontend/nginx.conf' ]"
check_item "src/backend/Dockerfile 存在" "[ -f 'src/backend/Dockerfile' ]"
echo ""

# 2. 检查前端配置
log_info "检查前端配置..."
check_item "constants.ts 使用正确的API配置" "grep -q 'REACT_APP_API_BASE_URL.*||.*\"/api\"' src/frontend/src/config/constants.ts || grep -q \"REACT_APP_API_BASE_URL.*||.*'/api'\" src/frontend/src/config/constants.ts"
check_item "api.ts 无硬编码localhost:3000" "! grep -q 'localhost:3000' src/frontend/src/services/api.ts"
check_item "config/index.ts 无硬编码localhost:3000" "! grep -q 'localhost:3000' src/frontend/src/config/index.ts"
check_item "前端Dockerfile使用多阶段构建" "grep -q 'FROM.*AS builder' src/frontend/Dockerfile"
check_item "前端Dockerfile设置生产环境变量" "grep -q 'ENV REACT_APP_API_BASE_URL=/api' src/frontend/Dockerfile"
check_item "前端nginx配置正确" "grep -q 'try_files.*index.html' src/frontend/nginx.conf"
echo ""

# 3. 检查后端配置
log_info "检查后端配置..."
check_item "docker-compose包含CORS_ORIGIN配置" "grep -q 'CORS_ORIGIN' docker-compose.prod.yml"
check_item "后端端口配置为8080" "grep -q 'PORT: 8080' docker-compose.prod.yml"
check_item "生产环境NODE_ENV设置" "grep -q 'NODE_ENV: production' docker-compose.prod.yml"
check_item "数据库健康检查配置" "grep -q 'healthcheck:' docker-compose.prod.yml"
echo ""

# 4. 检查nginx配置
log_info "检查nginx反向代理配置..."
check_item "nginx代理前端到80端口" "grep -q 'proxy_pass http://frontend:80' nginx/nginx.conf"
check_item "nginx代理后端到8080端口" "grep -q 'proxy_pass http://backend:8080' nginx/nginx.conf"
check_item "nginx监听80端口" "grep -q 'listen 80' nginx/nginx.conf"
check_item "nginx配置正确的server_name" "grep -q 'server_name.*tkmail.fun' nginx/nginx.conf" true
echo ""

# 5. 检查Docker配置
log_info "检查Docker配置..."
check_item "前端容器不暴露端口" "! grep -A 10 'frontend:' docker-compose.prod.yml | grep -q 'ports:'"
check_item "后端容器不暴露端口" "! grep -A 10 'backend:' docker-compose.prod.yml | grep -q 'ports:'"
check_item "nginx容器暴露80/443端口" "grep -A 5 'nginx:' docker-compose.prod.yml | grep -q '80:80'"
check_item "PostgreSQL数据持久化配置" "grep -q './data/postgres' docker-compose.prod.yml"
echo ""

# 6. 检查安全配置
log_info "检查安全配置..."
check_item "JWT密钥已配置" "grep -q 'JWT_SECRET' docker-compose.prod.yml"
check_item "数据库密码已设置" "grep -q 'POSTGRES_PASSWORD' docker-compose.prod.yml"
check_item "Redis配置安全选项" "grep -q 'maxmemory' docker-compose.prod.yml" true
echo ""

# 7. 检查网络配置
log_info "检查网络配置..."
check_item "Docker网络已定义" "grep -q 'networks:' docker-compose.prod.yml"
check_item "服务使用统一网络" "grep -c 'edm-network' docker-compose.prod.yml | grep -q '[5-9]'"
echo ""

# 8. 检查构建配置
log_info "检查构建配置..."
check_item "前端使用no_cache构建" "grep -q 'no_cache: true' docker-compose.prod.yml" true
check_item "后端使用no_cache构建" "grep -q 'no_cache: true' docker-compose.prod.yml" true
echo ""

# 9. 特殊检查：确保没有开发环境残留
log_info "检查开发环境残留..."
check_item "前端源码无localhost:3000硬编码" "! grep -r 'localhost:3000' src/frontend/src/ --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --exclude-dir=test --exclude-dir=__tests__ --exclude='*.test.*' --exclude='*.spec.*' 2>/dev/null"
check_item "无npm start命令残留" "! grep -q 'npm start' docker-compose.prod.yml"
check_item "前端使用生产构建" "grep -q 'npm run build' src/frontend/Dockerfile"
echo ""

# 10. 检查环境变量完整性
log_info "检查环境变量..."
required_env_vars=(
    "NODE_ENV"
    "PORT"
    "DB_HOST"
    "DB_NAME"
    "POSTGRES_USER"
    "POSTGRES_PASSWORD"
    "CORS_ORIGIN"
)

for var in "${required_env_vars[@]}"; do
    check_item "环境变量 $var 已配置" "grep -q '$var' docker-compose.prod.yml"
done
echo ""

# 输出检查结果
echo "========================================"
echo "           检查结果汇总"
echo "========================================"
echo -e "总检查项: ${BLUE}$TOTAL_CHECKS${NC}"
echo -e "通过: ${GREEN}$PASSED_CHECKS${NC}"
echo -e "失败: ${RED}$FAILED_CHECKS${NC}"
echo -e "警告: ${YELLOW}$WARNING_CHECKS${NC}"
echo ""

if [ $FAILED_CHECKS -eq 0 ]; then
    if [ $WARNING_CHECKS -eq 0 ]; then
        log_success "🎉 所有检查项都通过！配置完全正确，可以安全部署。"
        exit 0
    else
        log_warning "⚠️  配置基本正确，但有 $WARNING_CHECKS 个警告项需要注意。"
        exit 0
    fi
else
    log_error "❌ 发现 $FAILED_CHECKS 个配置问题，请修复后再部署！"
    echo ""
    echo "修复建议："
    echo "1. 检查上述失败项的具体错误"
    echo "2. 参考 docs/deployment/PRODUCTION_DEPLOYMENT_GUIDE.md"
    echo "3. 修复后重新运行此脚本验证"
    exit 1
fi 