#!/bin/bash

# 🔧 修复Webhook Nginx配置脚本
# 使用sshpass自动连接并修复nginx代理配置

set -e

# 配置
SERVER_IP="43.135.38.15"
SERVER_USER="ubuntu"  
SERVER_PASS="Tony1231!"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo "🔧 修复EDM Webhook Nginx配置"
echo "📅 修复时间: $(date)"
echo ""

# 创建修复脚本
NGINX_FIX_SCRIPT='#!/bin/bash

set -e

# 颜色定义
RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
BLUE="\033[0;34m"
NC="\033[0m"

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo "🔧 开始修复Nginx Webhook配置"

# 1. 检查当前nginx配置
log_info "检查当前nginx配置..."
NGINX_CONF="/etc/nginx/sites-available/tkmail.fun.conf"

if [ ! -f "$NGINX_CONF" ]; then
    log_error "nginx配置文件不存在: $NGINX_CONF"
    exit 1
fi

# 2. 备份现有配置
BACKUP_DIR="/opt/nginx-backups/webhook-fix-$(date +%Y%m%d_%H%M%S)"
sudo mkdir -p "$BACKUP_DIR"
sudo cp "$NGINX_CONF" "$BACKUP_DIR/"
log_success "nginx配置已备份到: $BACKUP_DIR"

# 3. 检查是否已有webhook配置
if grep -q "location /webhook" "$NGINX_CONF"; then
    log_info "发现现有webhook配置，将进行更新..."
else
    log_info "未发现webhook配置，将添加新配置..."
fi

# 4. 创建新的nginx配置内容
log_info "创建新的nginx配置..."

# 读取现有配置并添加webhook代理
sudo tee /tmp/nginx_webhook_fix.conf > /dev/null << "EOF"
server {
    listen 80;
    server_name tkmail.fun www.tkmail.fun;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tkmail.fun www.tkmail.fun;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/tkmail.fun/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tkmail.fun/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;

    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/css text/javascript text/xml text/plain application/javascript application/xml+rss application/json;

    # API代理到后端 (包含webhook)
    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_buffering off;
    }

    # Webhook专用代理配置 (优先级更高)
    location /webhook/ {
        proxy_pass http://localhost:3001/webhook/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Content-Type $content_type;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_buffering off;
        
        # 允许大的请求体（webhook可能包含大量数据）
        client_max_body_size 10M;
        
        # 记录访问日志
        access_log /var/log/nginx/webhook.access.log;
        error_log /var/log/nginx/webhook.error.log;
    }

    # 健康检查
    location /health {
        proxy_pass http://localhost:3001/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 静态文件服务（前端）
    location / {
        root /var/www/html;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
        
        # 静态资源缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        
        # HTML文件不缓存
        location ~* \.(html)$ {
            add_header Cache-Control "no-cache, no-store, must-revalidate";
            add_header Pragma "no-cache";
            add_header Expires "0";
        }
    }

    # 错误页面
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /var/www/html;
    }
}
EOF

# 5. 应用新配置
log_info "应用新的nginx配置..."
sudo cp /tmp/nginx_webhook_fix.conf "$NGINX_CONF"
sudo rm -f /tmp/nginx_webhook_fix.conf

# 6. 测试nginx配置
log_info "测试nginx配置语法..."
if sudo nginx -t; then
    log_success "nginx配置语法检查通过"
else
    log_error "nginx配置语法错误，恢复备份配置"
    sudo cp "$BACKUP_DIR/$(basename $NGINX_CONF)" "$NGINX_CONF"
    exit 1
fi

# 7. 重载nginx
log_info "重载nginx配置..."
sudo systemctl reload nginx

# 8. 检查nginx状态
if sudo systemctl is-active --quiet nginx; then
    log_success "nginx服务运行正常"
else
    log_error "nginx服务异常"
    sudo systemctl status nginx
    exit 1
fi

# 9. 测试webhook端点
log_info "测试webhook端点..."
sleep 3

# 测试基础连通性
WEBHOOK_TEST=$(curl -s -w "%{http_code}" -X POST "https://tkmail.fun/webhook/engagelab" \
    -H "Content-Type: application/json" \
    -d "{\"test\": true}" \
    -o /tmp/webhook_test.json)

echo "Webhook测试响应码: $WEBHOOK_TEST"

if [ "$WEBHOOK_TEST" -eq 200 ]; then
    log_success "✅ Webhook端点测试成功！"
    echo "响应内容:"
    cat /tmp/webhook_test.json
else
    log_warning "⚠️  Webhook端点响应码: $WEBHOOK_TEST"
    echo "响应内容:"
    cat /tmp/webhook_test.json
    
    # 检查错误日志
    log_info "检查nginx错误日志:"
    sudo tail -5 /var/log/nginx/error.log
    
    log_info "检查webhook错误日志:"
    sudo tail -5 /var/log/nginx/webhook.error.log 2>/dev/null || echo "webhook错误日志不存在"
fi

# 10. 清理临时文件
rm -f /tmp/webhook_test.json

# 修复总结
echo ""
echo "======================================================"
log_success "🔧 Nginx Webhook配置修复完成!"
echo "======================================================"
echo ""
echo "📊 修复信息:"
echo "  - 配置文件: $NGINX_CONF"
echo "  - 备份位置: $BACKUP_DIR"
echo "  - 修复时间: $(date)"
echo ""
echo "🔗 测试端点:"
echo "  - Webhook URL: https://tkmail.fun/webhook/engagelab"
echo "  - 健康检查: https://tkmail.fun/health"
echo "  - 前端地址: https://tkmail.fun"
echo ""
echo "✅ 测试结果:"
echo "  - Webhook端点: HTTP $WEBHOOK_TEST"
echo ""
if [ "$WEBHOOK_TEST" -eq 200 ]; then
    log_success "🎯 修复成功！现在可以配置EngageLab webhook了！"
    echo ""
    echo "📋 下一步:"
    echo "1. 在EngageLab后台设置webhook URL: https://tkmail.fun/webhook/engagelab"
    echo "2. 创建测试任务验证实际回调功能"
    echo "3. 监控 /var/log/nginx/webhook.access.log 查看回调日志"
else
    log_warning "⚠️  需要进一步调试，请检查后端服务和路由配置"
fi
'

# 使用sshpass连接服务器并执行修复
log_info "连接到生产服务器进行nginx修复..."

sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "
    echo '$NGINX_FIX_SCRIPT' > /tmp/fix_nginx_webhook.sh
    chmod +x /tmp/fix_nginx_webhook.sh
    sudo /tmp/fix_nginx_webhook.sh
    rm -f /tmp/fix_nginx_webhook.sh
"

FIX_RESULT=$?

if [ $FIX_RESULT -eq 0 ]; then
    log_success "🎉 Nginx Webhook配置修复成功！"
    
    echo ""
    echo "🔧 修复完成，现在重新测试webhook："
    sleep 2
    
    FINAL_TEST=$(curl -s -w "%{http_code}" -X POST "https://tkmail.fun/webhook/engagelab" \
        -H "Content-Type: application/json" \
        -d '{"test": "final_validation"}' \
        -o /tmp/final_webhook_test.json)
    
    echo "最终测试响应码: $FINAL_TEST"
    if [ "$FINAL_TEST" -eq 200 ]; then
        log_success "✅ Webhook端点现在工作正常！"
        echo "响应内容:"
        cat /tmp/final_webhook_test.json
        rm -f /tmp/final_webhook_test.json
        
        echo ""
        echo "🎯 所有修复完成！现在可以："
        echo "1. 在EngageLab后台配置 https://tkmail.fun/webhook/engagelab"
        echo "2. 创建测试任务验证完整流程"
        echo "3. 监控EventLog表确认数据正确记录"
    else
        log_warning "⚠️  还需要进一步调试，响应码: $FINAL_TEST"
        cat /tmp/final_webhook_test.json
        rm -f /tmp/final_webhook_test.json
    fi
else
    log_error "❌ 修复过程中出现错误"
    exit 1
fi 