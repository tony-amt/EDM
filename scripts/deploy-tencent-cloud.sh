#!/bin/bash

# =============================================================================
# EDM系统腾讯云自动化部署脚本
# 适用于：CentOS 8 / Ubuntu 20.04
# 作者：EDM系统开发团队
# 版本：v1.0
# =============================================================================

set -e  # 遇到错误时停止执行

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
        log_error "请使用root用户执行此脚本"
        exit 1
    fi
}

# 检测操作系统
detect_os() {
    if [[ -f /etc/redhat-release ]]; then
        OS="centos"
        log_info "检测到CentOS系统"
    elif [[ -f /etc/lsb-release ]]; then
        OS="ubuntu"
        log_info "检测到Ubuntu系统"
    else
        log_error "不支持的操作系统"
        exit 1
    fi
}

# 收集用户输入
collect_inputs() {
    log_step "收集部署参数..."
    
    read -p "请输入项目名称 (默认: edm-system): " PROJECT_NAME
    PROJECT_NAME=${PROJECT_NAME:-edm-system}
    
    read -p "请输入域名 (如: example.com): " DOMAIN_NAME
    if [[ -z "$DOMAIN_NAME" ]]; then
        log_error "域名不能为空"
        exit 1
    fi
    
    read -p "请输入数据库主机地址: " DB_HOST
    if [[ -z "$DB_HOST" ]]; then
        log_error "数据库主机地址不能为空"
        exit 1
    fi
    
    read -p "请输入数据库用户名 (默认: edm_admin): " DB_USER
    DB_USER=${DB_USER:-edm_admin}
    
    read -s -p "请输入数据库密码: " DB_PASS
    echo
    if [[ -z "$DB_PASS" ]]; then
        log_error "数据库密码不能为空"
        exit 1
    fi
    
    read -p "请输入JWT密钥 (留空自动生成): " JWT_SECRET
    if [[ -z "$JWT_SECRET" ]]; then
        JWT_SECRET=$(openssl rand -hex 32)
        log_info "已自动生成JWT密钥"
    fi
    
    read -p "请输入GitHub仓库地址: " REPO_URL
    if [[ -z "$REPO_URL" ]]; then
        REPO_URL="https://github.com/your-username/EDM.git"
        log_warn "使用默认仓库地址，请确保正确: $REPO_URL"
    fi
    
    # 显示配置信息确认
    echo
    log_info "部署配置确认："
    echo "项目名称: $PROJECT_NAME"
    echo "域名: $DOMAIN_NAME"
    echo "数据库主机: $DB_HOST"
    echo "数据库用户: $DB_USER"
    echo "仓库地址: $REPO_URL"
    echo
    
    read -p "确认开始部署? (y/N): " CONFIRM
    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
        log_info "部署已取消"
        exit 0
    fi
}

# 安装基础环境
install_basic_tools() {
    log_step "安装基础工具..."
    
    if [[ "$OS" == "centos" ]]; then
        yum update -y
        yum install -y wget curl git unzip vim htop
        yum install -y epel-release
    else
        apt update
        apt upgrade -y
        apt install -y wget curl git unzip vim htop
    fi
}

# 安装Node.js
install_nodejs() {
    log_step "安装Node.js 18..."
    
    # 检查是否已安装
    if command -v node >/dev/null 2>&1; then
        NODE_VERSION=$(node --version)
        log_info "Node.js已安装: $NODE_VERSION"
        return
    fi
    
    # 安装Node.js 18
    curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
    if [[ "$OS" == "centos" ]]; then
        yum install -y nodejs
    else
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
    fi
    
    # 验证安装
    node --version || {
        log_error "Node.js安装失败"
        exit 1
    }
    
    # 安装PM2
    npm install -g pm2
    log_info "Node.js和PM2安装完成"
}

# 安装Nginx
install_nginx() {
    log_step "安装Nginx..."
    
    if [[ "$OS" == "centos" ]]; then
        yum install -y nginx
    else
        apt install -y nginx
    fi
    
    systemctl enable nginx
    log_info "Nginx安装完成"
}

# 配置防火墙
configure_firewall() {
    log_step "配置防火墙..."
    
    if [[ "$OS" == "centos" ]]; then
        # 安装firewalld
        yum install -y firewalld
        systemctl enable firewalld
        systemctl start firewalld
        
        # 配置端口
        firewall-cmd --permanent --add-port=22/tcp
        firewall-cmd --permanent --add-port=80/tcp
        firewall-cmd --permanent --add-port=443/tcp
        firewall-cmd --reload
    else
        # Ubuntu使用ufw
        ufw --force enable
        ufw allow 22/tcp
        ufw allow 80/tcp
        ufw allow 443/tcp
    fi
    
    log_info "防火墙配置完成"
}

# 部署应用代码
deploy_application() {
    log_step "部署应用代码..."
    
    # 创建应用目录
    APP_DIR="/opt/$PROJECT_NAME"
    mkdir -p "$APP_DIR"
    cd "$APP_DIR"
    
    # 克隆代码
    if [[ -d ".git" ]]; then
        log_info "更新现有代码..."
        git pull
    else
        log_info "克隆代码仓库..."
        git clone "$REPO_URL" .
    fi
    
    # 进入后端目录
    cd src/backend
    
    # 安装依赖
    log_info "安装后端依赖..."
    npm install --production
    
    # 创建日志目录
    mkdir -p logs
    
    # 创建环境配置文件
    log_info "创建环境配置文件..."
    cat > .env.production << EOF
NODE_ENV=production
PORT=3000

# 数据库配置
DB_HOST=$DB_HOST
DB_PORT=5432
DB_NAME=amt_mail_system
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASS

# JWT配置
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=24h

# 日志配置
LOG_LEVEL=info
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5
LOG_DATE_PATTERN=YYYY-MM-DD

# 邮件配置 (后续配置)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

# 应用配置
CORS_ORIGIN=https://$DOMAIN_NAME
EOF
    
    chmod 600 .env.production
    chown root:root .env.production
    
    log_info "应用代码部署完成"
}

# 配置Nginx
configure_nginx() {
    log_step "配置Nginx..."
    
    # 备份默认配置
    cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup
    
    # 创建站点配置
    cat > /etc/nginx/conf.d/edm.conf << EOF
server {
    listen 80;
    server_name $DOMAIN_NAME www.$DOMAIN_NAME;
    
    # 重定向到HTTPS (备案完成后启用)
    # return 301 https://\$server_name\$request_uri;
    
    # 临时HTTP配置
    location / {
        root /opt/$PROJECT_NAME/frontend/build;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }
    
    # API代理
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # 健康检查
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
    
    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# HTTPS配置 (备案和SSL证书配置完成后启用)
# server {
#     listen 443 ssl http2;
#     server_name $DOMAIN_NAME www.$DOMAIN_NAME;
#     
#     ssl_certificate /path/to/cert.pem;
#     ssl_certificate_key /path/to/key.key;
#     ssl_protocols TLSv1.2 TLSv1.3;
#     ssl_ciphers ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256;
#     
#     # 其他配置同上...
# }
EOF
    
    # 测试配置
    nginx -t || {
        log_error "Nginx配置错误"
        exit 1
    }
    
    log_info "Nginx配置完成"
}

# 启动服务
start_services() {
    log_step "启动服务..."
    
    # 启动后端服务
    cd "/opt/$PROJECT_NAME/src/backend"
    pm2 start src/index.js --name "edm-backend" --env production
    pm2 startup
    pm2 save
    
    # 启动Nginx
    systemctl start nginx
    systemctl enable nginx
    
    log_info "服务启动完成"
}

# 设置监控和日志
setup_monitoring() {
    log_step "设置监控和日志..."
    
    # 创建日志轮转配置
    cat > /etc/logrotate.d/edm << EOF
/opt/$PROJECT_NAME/src/backend/logs/*.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
    create 644 root root
}
EOF
    
    # 创建系统监控脚本
    cat > /opt/monitor.sh << 'EOF'
#!/bin/bash
# 简单的系统监控脚本

# 检查服务状态
check_service() {
    if pm2 describe edm-backend >/dev/null 2>&1; then
        echo "✅ EDM后端服务正常"
    else
        echo "❌ EDM后端服务异常"
        pm2 restart edm-backend
    fi
    
    if systemctl is-active --quiet nginx; then
        echo "✅ Nginx服务正常"
    else
        echo "❌ Nginx服务异常"
        systemctl restart nginx
    fi
}

# 检查磁盘空间
check_disk() {
    DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [[ $DISK_USAGE -gt 90 ]]; then
        echo "⚠️ 磁盘使用率过高: ${DISK_USAGE}%"
    else
        echo "✅ 磁盘使用率正常: ${DISK_USAGE}%"
    fi
}

# 检查内存使用
check_memory() {
    MEM_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    if [[ $MEM_USAGE -gt 85 ]]; then
        echo "⚠️ 内存使用率过高: ${MEM_USAGE}%"
    else
        echo "✅ 内存使用率正常: ${MEM_USAGE}%"
    fi
}

echo "=== 系统监控报告 $(date) ==="
check_service
check_disk
check_memory
echo "================================"
EOF
    
    chmod +x /opt/monitor.sh
    
    # 设置定时监控 (每10分钟)
    (crontab -l 2>/dev/null; echo "*/10 * * * * /opt/monitor.sh >> /var/log/edm-monitor.log 2>&1") | crontab -
    
    log_info "监控和日志设置完成"
}

# 创建管理脚本
create_management_scripts() {
    log_step "创建管理脚本..."
    
    # 创建备份脚本
    cat > /opt/backup.sh << EOF
#!/bin/bash
# EDM系统备份脚本

DATE=\$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups"
mkdir -p "\$BACKUP_DIR"

echo "开始备份 EDM 系统..."

# 备份代码
tar -czf "\$BACKUP_DIR/edm-code-\$DATE.tar.gz" "/opt/$PROJECT_NAME"

# 备份配置
tar -czf "\$BACKUP_DIR/edm-config-\$DATE.tar.gz" /etc/nginx/conf.d/edm.conf

echo "备份完成: \$BACKUP_DIR"

# 清理7天前的备份
find "\$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete

# 如果配置了腾讯云COS，可以上传到云端
# coscmd upload "\$BACKUP_DIR/edm-code-\$DATE.tar.gz" /backups/
EOF
    
    chmod +x /opt/backup.sh
    
    # 创建重启脚本
    cat > /opt/restart.sh << EOF
#!/bin/bash
# EDM系统重启脚本

echo "重启 EDM 系统..."

# 重启后端服务
pm2 restart edm-backend

# 重启Nginx
systemctl restart nginx

# 检查服务状态
sleep 3
pm2 status
systemctl status nginx --no-pager -l

echo "EDM系统重启完成"
EOF
    
    chmod +x /opt/restart.sh
    
    # 创建状态检查脚本
    cat > /opt/status.sh << EOF
#!/bin/bash
# EDM系统状态检查脚本

echo "=== EDM系统状态检查 ==="

# 检查服务状态
echo "1. 服务状态:"
pm2 status
echo
systemctl status nginx --no-pager -l | grep -E "(Active|Main PID)"
echo

# 检查端口监听
echo "2. 端口监听:"
netstat -tlnp | grep -E ":80|:443|:3000"
echo

# 检查磁盘空间
echo "3. 磁盘空间:"
df -h /
echo

# 检查内存使用
echo "4. 内存使用:"
free -h
echo

# 检查最近日志
echo "5. 最近日志 (最后10行):"
pm2 logs edm-backend --lines 10 --nostream
echo

echo "=== 状态检查完成 ==="
EOF
    
    chmod +x /opt/status.sh
    
    log_info "管理脚本创建完成"
}

# 验证部署
verify_deployment() {
    log_step "验证部署..."
    
    # 等待服务启动
    sleep 5
    
    # 检查后端API
    if curl -s http://localhost:3000/health >/dev/null; then
        log_info "✅ 后端API服务正常"
    else
        log_error "❌ 后端API服务异常"
    fi
    
    # 检查Nginx
    if curl -s http://localhost/ >/dev/null; then
        log_info "✅ Nginx服务正常"
    else
        log_error "❌ Nginx服务异常"
    fi
    
    # 检查PM2服务
    if pm2 describe edm-backend >/dev/null 2>&1; then
        log_info "✅ PM2服务正常"
    else
        log_error "❌ PM2服务异常"
    fi
}

# 生成部署报告
generate_report() {
    log_step "生成部署报告..."
    
    REPORT_FILE="/opt/deployment-report-$(date +%Y%m%d_%H%M%S).txt"
    
    cat > "$REPORT_FILE" << EOF
====================================================
EDM邮件营销系统 - 腾讯云部署报告
====================================================

部署时间: $(date)
服务器IP: $(curl -s ifconfig.me 2>/dev/null || echo "获取失败")
域名: $DOMAIN_NAME

=== 部署配置 ===
项目名称: $PROJECT_NAME
应用目录: /opt/$PROJECT_NAME
数据库主机: $DB_HOST
数据库用户: $DB_USER

=== 服务状态 ===
$(pm2 status)

$(systemctl status nginx --no-pager -l | head -10)

=== 访问地址 ===
前端界面: http://$DOMAIN_NAME (备案后可用HTTPS)
API健康检查: http://$DOMAIN_NAME/health
管理界面: http://$DOMAIN_NAME (使用默认管理员账号)

=== 默认管理员账号 ===
用户名: admin
密码: admin123456
(⚠️ 请立即修改默认密码!)

=== 管理命令 ===
查看状态: /opt/status.sh
重启服务: /opt/restart.sh
备份系统: /opt/backup.sh
查看日志: pm2 logs edm-backend

=== 下一步操作 ===
1. 完成域名备案 (如果还未完成)
2. 配置SSL证书
3. 修改默认管理员密码
4. 配置邮件发送服务
5. 设置监控告警

=== 重要文件位置 ===
应用代码: /opt/$PROJECT_NAME
配置文件: /opt/$PROJECT_NAME/src/backend/.env.production
Nginx配置: /etc/nginx/conf.d/edm.conf
日志文件: /opt/$PROJECT_NAME/src/backend/logs/
备份目录: /opt/backups

=== 技术支持 ===
如遇问题，请查看日志文件或联系技术支持
日志命令: pm2 logs edm-backend
系统日志: tail -f /var/log/nginx/error.log

====================================================
部署完成! 🎉
====================================================
EOF
    
    log_info "部署报告已生成: $REPORT_FILE"
    echo
    cat "$REPORT_FILE"
}

# 主函数
main() {
    echo "========================================"
    echo "  EDM系统腾讯云自动化部署脚本"
    echo "========================================"
    echo
    
    check_root
    detect_os
    collect_inputs
    
    log_info "开始部署 EDM 系统到腾讯云..."
    
    install_basic_tools
    install_nodejs
    install_nginx
    configure_firewall
    deploy_application
    configure_nginx
    start_services
    setup_monitoring
    create_management_scripts
    verify_deployment
    generate_report
    
    echo
    log_info "🎉 EDM系统部署完成!"
    log_info "📊 部署报告: /opt/deployment-report-*.txt"
    log_info "🌐 访问地址: http://$DOMAIN_NAME"
    log_info "⚠️  请完成域名备案后配置HTTPS"
    log_info "🔐 默认管理员: admin / admin123456 (请立即修改)"
    echo
}

# 错误处理
trap 'log_error "部署过程中发生错误，请检查日志"; exit 1' ERR

# 执行主函数
main "$@" 