#!/bin/bash

# EDM邮件营销系统 - 腾讯云一键部署脚本
# 作者：AI Assistant
# 版本：v1.0.0
# 日期：2025-06-13

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 检查是否为root用户
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "此脚本需要root权限运行"
        log_info "请使用: sudo $0"
        exit 1
    fi
}

# 检查系统版本
check_system() {
    log_step "检查系统环境..."
    
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
        log_info "检测到系统: $OS $VER"
    else
        log_error "无法检测系统版本"
        exit 1
    fi
    
    # 检查是否为Ubuntu
    if [[ $OS != *"Ubuntu"* ]]; then
        log_warn "推荐使用Ubuntu 20.04+，当前系统可能存在兼容性问题"
        read -p "是否继续？(y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# 更新系统
update_system() {
    log_step "更新系统包..."
    apt update -y
    apt upgrade -y
    apt install -y curl wget git vim htop unzip
}

# 安装Docker
install_docker() {
    log_step "安装Docker..."
    
    if command -v docker &> /dev/null; then
        log_info "Docker已安装，版本: $(docker --version)"
        return
    fi
    
    # 卸载旧版本
    apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    
    # 安装依赖
    apt install -y apt-transport-https ca-certificates curl gnupg lsb-release
    
    # 添加Docker官方GPG密钥
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # 添加Docker仓库
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # 安装Docker
    apt update -y
    apt install -y docker-ce docker-ce-cli containerd.io
    
    # 启动Docker服务
    systemctl start docker
    systemctl enable docker
    
    log_info "Docker安装完成: $(docker --version)"
}

# 安装Docker Compose
install_docker_compose() {
    log_step "安装Docker Compose..."
    
    if command -v docker-compose &> /dev/null; then
        log_info "Docker Compose已安装，版本: $(docker-compose --version)"
        return
    fi
    
    # 下载Docker Compose
    DOCKER_COMPOSE_VERSION="2.20.2"
    curl -L "https://github.com/docker/compose/releases/download/v${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    
    # 添加执行权限
    chmod +x /usr/local/bin/docker-compose
    
    # 创建软链接
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
    
    log_info "Docker Compose安装完成: $(docker-compose --version)"
}

# 安装Nginx
install_nginx() {
    log_step "安装Nginx..."
    
    if command -v nginx &> /dev/null; then
        log_info "Nginx已安装，版本: $(nginx -v 2>&1)"
        return
    fi
    
    apt install -y nginx
    systemctl start nginx
    systemctl enable nginx
    
    log_info "Nginx安装完成"
}

# 安装Certbot (Let's Encrypt)
install_certbot() {
    log_step "安装Certbot..."
    
    if command -v certbot &> /dev/null; then
        log_info "Certbot已安装"
        return
    fi
    
    apt install -y certbot python3-certbot-nginx
    log_info "Certbot安装完成"
}

# 配置防火墙
configure_firewall() {
    log_step "配置防火墙..."
    
    # 安装ufw
    apt install -y ufw
    
    # 重置防火墙规则
    ufw --force reset
    
    # 默认策略
    ufw default deny incoming
    ufw default allow outgoing
    
    # 允许SSH
    ufw allow ssh
    ufw allow 22
    
    # 允许HTTP和HTTPS
    ufw allow 80
    ufw allow 443
    
    # 启用防火墙
    ufw --force enable
    
    log_info "防火墙配置完成"
}

# 创建项目目录
create_project_dir() {
    log_step "创建项目目录..."
    
    PROJECT_DIR="/opt/edm"
    mkdir -p $PROJECT_DIR
    cd $PROJECT_DIR
    
    log_info "项目目录创建完成: $PROJECT_DIR"
}

# 克隆代码
clone_code() {
    log_step "克隆项目代码..."
    
    if [[ -z "$GITHUB_REPO" ]]; then
        log_error "请设置GITHUB_REPO环境变量"
        log_info "例如: export GITHUB_REPO=https://github.com/username/edm.git"
        exit 1
    fi
    
    if [[ -d ".git" ]]; then
        log_info "代码已存在，更新代码..."
        git pull origin main
    else
        log_info "克隆代码从: $GITHUB_REPO"
        git clone $GITHUB_REPO .
    fi
    
    log_info "代码克隆完成"
}

# 配置环境变量
configure_env() {
    log_step "配置环境变量..."
    
    # 生成随机密钥
    JWT_SECRET=$(openssl rand -hex 32)
    DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    
    # 创建生产环境配置
    cat > .env.production << EOF
# 环境配置
NODE_ENV=production
PORT=3000

# 数据库配置
DATABASE_URL=postgresql://edm_user:${DB_PASSWORD}@postgres:5432/amt_mail_system
DB_HOST=postgres
DB_PORT=5432
DB_NAME=amt_mail_system
DB_USER=edm_user
DB_PASSWORD=${DB_PASSWORD}

# Redis配置
REDIS_URL=redis://redis:6379
REDIS_HOST=redis
REDIS_PORT=6379

# JWT配置
JWT_SECRET=${JWT_SECRET}

# 服务器配置
SERVER_BASE_URL=https://${DOMAIN}
TRACKING_BASE_URL=https://track.${DOMAIN}
CDN_BASE_URL=https://cdn.${DOMAIN}

# 邮件服务配置 (需要手动配置)
ENGAGELAB_API_USER=your_api_user
ENGAGELAB_API_KEY=your_api_key
ENGAGELAB_BASE_URL=https://email.api.engagelab.cc/v1

# 日志配置
LOG_LEVEL=info
LOG_FILE=/app/logs/app.log
EOF

    log_info "环境变量配置完成"
    log_warn "请记住数据库密码: $DB_PASSWORD"
}

# 配置Docker Compose生产环境
configure_docker_compose() {
    log_step "配置Docker Compose生产环境..."
    
    cat > docker-compose.prod.yml << EOF
version: '3.8'

services:
  postgres:
    image: postgres:14
    container_name: edm-postgres-prod
    environment:
      POSTGRES_DB: amt_mail_system
      POSTGRES_USER: edm_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_INITDB_ARGS: "--encoding=UTF-8 --lc-collate=C --lc-ctype=C"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    ports:
      - "127.0.0.1:5432:5432"
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U edm_user -d amt_mail_system"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    container_name: edm-redis-prod
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  backend:
    build:
      context: .
      dockerfile: src/backend/Dockerfile
    container_name: edm-backend-prod
    env_file:
      - .env.production
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - ./logs:/app/logs
      - ./uploads:/app/uploads
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: .
      dockerfile: src/frontend/Dockerfile
      args:
        - REACT_APP_API_URL=https://${DOMAIN}/api
        - REACT_APP_TRACKING_URL=https://track.${DOMAIN}
    container_name: edm-frontend-prod
    ports:
      - "127.0.0.1:3001:3001"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
EOF

    log_info "Docker Compose生产配置完成"
}

# 配置Nginx
configure_nginx() {
    log_step "配置Nginx..."
    
    # 备份原配置
    cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup
    
    # 创建站点配置
    cat > /etc/nginx/sites-available/edm << EOF
# EDM邮件营销系统 - Nginx配置

# HTTP重定向到HTTPS
server {
    listen 80;
    server_name ${DOMAIN} api.${DOMAIN} track.${DOMAIN} cdn.${DOMAIN};
    return 301 https://\$server_name\$request_uri;
}

# 主站 - 前端界面
server {
    listen 443 ssl http2;
    server_name ${DOMAIN};
    
    # SSL配置 (将由Certbot自动配置)
    
    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # 前端静态文件
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # API代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # WebSocket支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass \$http_upgrade;
    }
}

# API服务
server {
    listen 443 ssl http2;
    server_name api.${DOMAIN};
    
    # SSL配置 (将由Certbot自动配置)
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

# 追踪服务
server {
    listen 443 ssl http2;
    server_name track.${DOMAIN};
    
    # SSL配置 (将由Certbot自动配置)
    
    # 追踪API - 优化响应速度
    location /api/tracking/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # 追踪优化
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
        
        # 快速响应
        proxy_connect_timeout 5s;
        proxy_send_timeout 5s;
        proxy_read_timeout 5s;
    }
    
    # 静态资源
    location /static/ {
        root /opt/edm/static;
        expires 30d;
        add_header Cache-Control "public, immutable";
        add_header Access-Control-Allow-Origin "*";
    }
}

# CDN服务
server {
    listen 443 ssl http2;
    server_name cdn.${DOMAIN};
    
    # SSL配置 (将由Certbot自动配置)
    
    location / {
        root /opt/edm/cdn;
        expires 30d;
        add_header Cache-Control "public, immutable";
        add_header Access-Control-Allow-Origin "*";
        
        # 图片优化
        location ~* \.(jpg|jpeg|png|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
EOF

    # 启用站点
    ln -sf /etc/nginx/sites-available/edm /etc/nginx/sites-enabled/
    
    # 删除默认站点
    rm -f /etc/nginx/sites-enabled/default
    
    # 测试配置
    nginx -t
    
    log_info "Nginx配置完成"
}

# 申请SSL证书
setup_ssl() {
    log_step "申请SSL证书..."
    
    if [[ -z "$EMAIL" ]]; then
        log_error "请设置EMAIL环境变量用于SSL证书申请"
        log_info "例如: export EMAIL=admin@yourdomain.com"
        exit 1
    fi
    
    # 申请证书
    certbot --nginx -d ${DOMAIN} -d api.${DOMAIN} -d track.${DOMAIN} -d cdn.${DOMAIN} \
        --email ${EMAIL} \
        --agree-tos \
        --no-eff-email \
        --non-interactive
    
    # 设置自动续期
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
    
    log_info "SSL证书配置完成"
}

# 启动服务
start_services() {
    log_step "启动服务..."
    
    # 创建必要目录
    mkdir -p logs uploads static cdn backups
    
    # 启动Docker服务
    docker-compose -f docker-compose.prod.yml up -d
    
    # 等待服务启动
    log_info "等待服务启动..."
    sleep 30
    
    # 检查服务状态
    docker-compose -f docker-compose.prod.yml ps
    
    # 重启Nginx
    systemctl reload nginx
    
    log_info "服务启动完成"
}

# 创建管理脚本
create_management_scripts() {
    log_step "创建管理脚本..."
    
    # 服务管理脚本
    cat > /usr/local/bin/edm-service << 'EOF'
#!/bin/bash
cd /opt/edm

case "$1" in
    start)
        docker-compose -f docker-compose.prod.yml up -d
        ;;
    stop)
        docker-compose -f docker-compose.prod.yml down
        ;;
    restart)
        docker-compose -f docker-compose.prod.yml restart
        ;;
    status)
        docker-compose -f docker-compose.prod.yml ps
        ;;
    logs)
        docker-compose -f docker-compose.prod.yml logs -f ${2:-}
        ;;
    update)
        git pull origin main
        docker-compose -f docker-compose.prod.yml build
        docker-compose -f docker-compose.prod.yml up -d
        ;;
    backup)
        ./deploy/backup.sh
        ;;
    *)
        echo "用法: $0 {start|stop|restart|status|logs|update|backup}"
        exit 1
        ;;
esac
EOF

    chmod +x /usr/local/bin/edm-service
    
    log_info "管理脚本创建完成"
    log_info "使用方法: edm-service {start|stop|restart|status|logs|update|backup}"
}

# 显示部署信息
show_deployment_info() {
    log_step "部署完成！"
    
    echo
    echo "=========================================="
    echo "🎉 EDM邮件营销系统部署成功！"
    echo "=========================================="
    echo
    echo "📱 访问地址："
    echo "  管理界面: https://${DOMAIN}"
    echo "  API服务:  https://api.${DOMAIN}"
    echo "  追踪服务: https://track.${DOMAIN}"
    echo "  CDN服务:  https://cdn.${DOMAIN}"
    echo
    echo "🔐 默认账号："
    echo "  用户名: admin"
    echo "  密码: admin123456"
    echo
    echo "📊 服务管理："
    echo "  启动服务: edm-service start"
    echo "  停止服务: edm-service stop"
    echo "  重启服务: edm-service restart"
    echo "  查看状态: edm-service status"
    echo "  查看日志: edm-service logs"
    echo "  更新代码: edm-service update"
    echo "  数据备份: edm-service backup"
    echo
    echo "📁 重要目录："
    echo "  项目目录: /opt/edm"
    echo "  日志目录: /opt/edm/logs"
    echo "  备份目录: /opt/edm/backups"
    echo
    echo "⚠️  重要提醒："
    echo "  1. 请修改 .env.production 中的邮件服务配置"
    echo "  2. 数据库密码: ${DB_PASSWORD}"
    echo "  3. 建议定期备份数据库"
    echo "  4. 监控服务器资源使用情况"
    echo
    echo "=========================================="
}

# 主函数
main() {
    log_info "开始部署EDM邮件营销系统..."
    
    # 检查必需的环境变量
    if [[ -z "$DOMAIN" ]]; then
        log_error "请设置DOMAIN环境变量"
        log_info "例如: export DOMAIN=yourdomain.com"
        exit 1
    fi
    
    # 执行部署步骤
    check_root
    check_system
    update_system
    install_docker
    install_docker_compose
    install_nginx
    install_certbot
    configure_firewall
    create_project_dir
    clone_code
    configure_env
    configure_docker_compose
    configure_nginx
    setup_ssl
    start_services
    create_management_scripts
    show_deployment_info
    
    log_info "部署完成！请访问 https://${DOMAIN} 开始使用"
}

# 运行主函数
main "$@" 