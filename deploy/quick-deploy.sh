#!/bin/bash

# EDM系统快速部署脚本 - tkmail.fun
# 执行前请确保：
# 1. DNS已解析到服务器IP
# 2. 代码已推送到GitHub
# 3. 有服务器SSH访问权限

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置信息
SERVER_IP="43.135.38.15"
DOMAIN="tkmail.fun"
EMAIL="zhangton58@gmail.com"
GITHUB_REPO="https://github.com/tony-amt/EDM.git"

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

# 检查前置条件
check_prerequisites() {
    log_step "检查部署前置条件..."
    
    # 检查DNS解析
    log_info "检查DNS解析..."
    if ! nslookup $DOMAIN | grep -q $SERVER_IP; then
        log_warn "DNS解析可能还未生效，请确认域名已解析到服务器IP"
        read -p "是否继续部署？(y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    # 检查SSH连接
    log_info "检查SSH连接..."
    if ! ssh -o ConnectTimeout=5 -o BatchMode=yes root@$SERVER_IP exit 2>/dev/null; then
        log_error "无法连接到服务器，请检查SSH密钥或密码"
        log_info "请确保可以通过以下命令连接："
        log_info "ssh root@$SERVER_IP"
        exit 1
    fi
    
    log_info "前置条件检查完成！"
}

# 远程执行部署
deploy_remote() {
    log_step "开始远程部署..."
    
    ssh root@$SERVER_IP << 'ENDSSH'
        set -e
        
        # 更新系统
        echo "更新系统包..."
        apt update && apt upgrade -y
        
        # 安装基础工具
        echo "安装基础工具..."
        apt install -y curl wget git vim htop unzip
        
        # 安装Docker
        echo "安装Docker..."
        if ! command -v docker &> /dev/null; then
            curl -fsSL https://get.docker.com -o get-docker.sh
            sh get-docker.sh
            systemctl enable docker
            systemctl start docker
        fi
        
        # 安装Docker Compose
        echo "安装Docker Compose..."
        if ! command -v docker-compose &> /dev/null; then
            curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
            chmod +x /usr/local/bin/docker-compose
        fi
        
        # 安装Nginx
        echo "安装Nginx..."
        apt install -y nginx
        systemctl enable nginx
        
        # 安装Certbot
        echo "安装Certbot..."
        apt install -y certbot python3-certbot-nginx
        
        # 创建项目目录
        echo "创建项目目录..."
        mkdir -p /opt/edm
        cd /opt/edm
        
        # 克隆代码（需要替换为实际的GitHub仓库地址）
        echo "克隆项目代码..."
        if [ -d ".git" ]; then
            git pull
        else
            # 这里需要替换为实际的GitHub仓库地址
            echo "请手动克隆代码到 /opt/edm 目录"
            echo "git clone YOUR_GITHUB_REPO_URL ."
        fi
        
        echo "基础环境安装完成！"
ENDSSH
    
    log_info "远程部署完成！"
}

# 配置服务
configure_services() {
    log_step "配置服务..."
    
    # 复制配置文件到服务器
    scp deploy/production.env root@$SERVER_IP:/opt/edm/.env.production
    
    # 配置Nginx
    ssh root@$SERVER_IP << 'ENDSSH'
        # 创建Nginx配置
        cat > /etc/nginx/sites-available/tkmail.fun << 'EOF'
server {
    listen 80;
    server_name tkmail.fun www.tkmail.fun api.tkmail.fun track.tkmail.fun;
    
    # 重定向到HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tkmail.fun www.tkmail.fun;
    
    # SSL配置（Certbot会自动配置）
    
    # 前端
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl http2;
    server_name api.tkmail.fun;
    
    # API服务
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl http2;
    server_name track.tkmail.fun;
    
    # 追踪服务
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
        
        # 启用站点
        ln -sf /etc/nginx/sites-available/tkmail.fun /etc/nginx/sites-enabled/
        rm -f /etc/nginx/sites-enabled/default
        
        # 测试Nginx配置
        nginx -t
        systemctl reload nginx
        
        echo "Nginx配置完成！"
ENDSSH
    
    log_info "服务配置完成！"
}

# 申请SSL证书
setup_ssl() {
    log_step "申请SSL证书..."
    
    ssh root@$SERVER_IP << ENDSSH
        # 申请SSL证书
        certbot --nginx -d tkmail.fun -d www.tkmail.fun -d api.tkmail.fun -d track.tkmail.fun --email zhangton58@gmail.com --agree-tos --non-interactive
        
        # 设置自动续期
        echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
        
        echo "SSL证书配置完成！"
ENDSSH
    
    log_info "SSL证书申请完成！"
}

# 启动服务
start_services() {
    log_step "启动EDM服务..."
    
    ssh root@$SERVER_IP << 'ENDSSH'
        cd /opt/edm
        
        # 启动Docker服务
        docker-compose -f docker-compose.yml up -d
        
        # 等待服务启动
        sleep 30
        
        # 检查服务状态
        docker-compose ps
        
        echo "EDM服务启动完成！"
ENDSSH
    
    log_info "服务启动完成！"
}

# 验证部署
verify_deployment() {
    log_step "验证部署结果..."
    
    # 检查网站访问
    if curl -s -o /dev/null -w "%{http_code}" https://tkmail.fun | grep -q "200\|301\|302"; then
        log_info "✅ 网站访问正常"
    else
        log_warn "⚠️ 网站访问异常，请检查"
    fi
    
    # 检查API访问
    if curl -s -o /dev/null -w "%{http_code}" https://api.tkmail.fun/health | grep -q "200"; then
        log_info "✅ API服务正常"
    else
        log_warn "⚠️ API服务异常，请检查"
    fi
    
    log_info "部署验证完成！"
}

# 主函数
main() {
    echo "=========================================="
    echo "    EDM系统自动部署脚本 v1.0"
    echo "    域名: tkmail.fun"
    echo "    服务器: 43.135.38.15"
    echo "=========================================="
    
    check_prerequisites
    deploy_remote
    configure_services
    setup_ssl
    start_services
    verify_deployment
    
    echo "=========================================="
    echo "🎉 部署完成！"
    echo ""
    echo "访问地址："
    echo "  管理界面: https://tkmail.fun"
    echo "  API服务:  https://api.tkmail.fun"
    echo "  追踪服务: https://track.tkmail.fun"
    echo ""
    echo "默认账号："
    echo "  用户名: admin"
    echo "  密码: admin123456"
    echo "=========================================="
}

# 执行主函数
main "$@" 