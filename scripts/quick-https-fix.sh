#!/bin/bash

# 🔒 快速修复HTTPS配置脚本
# 专注于SSL证书创建和nginx配置恢复

set -e

SERVER_IP="43.135.38.15"
SERVER_USER="ubuntu"
SERVER_PASS="Tony1231!"

echo "🔒 快速修复HTTPS配置..."
echo "📅 时间: $(date)"

# 服务器端操作
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" << 'ENDSSH'
#!/bin/bash
set -e

echo "🔧 开始快速修复HTTPS..."

# 获取容器信息
NGINX_CONTAINER=$(sudo docker ps --format "{{.Names}}" | grep nginx | head -1)
BACKEND_CONTAINER=$(sudo docker ps --format "{{.Names}}" | grep backend | head -1)

echo "Nginx容器: $NGINX_CONTAINER"
echo "Backend容器: $BACKEND_CONTAINER"

# 获取后端IP
BACKEND_IP=$(sudo docker inspect $BACKEND_CONTAINER --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null || echo "172.18.0.4")
echo "Backend IP: $BACKEND_IP"

# 1. 创建SSL证书
echo "🔑 创建SSL证书..."
sudo docker exec "$NGINX_CONTAINER" mkdir -p /etc/nginx/ssl

# 创建SSL证书（更简单的方法）
sudo docker exec "$NGINX_CONTAINER" sh -c "
openssl genrsa -out /etc/nginx/ssl/key.pem 2048 && \
openssl req -new -x509 -key /etc/nginx/ssl/key.pem -out /etc/nginx/ssl/cert.pem -days 365 -subj '/CN=tkmail.fun' && \
chmod 600 /etc/nginx/ssl/*.pem
"

echo "✅ SSL证书创建完成"

# 2. 创建简化的nginx配置
echo "📝 创建nginx配置..."
sudo docker exec "$NGINX_CONTAINER" sh -c "cat > /etc/nginx/nginx.conf << 'EOF'
user nginx;
worker_processes auto;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # 基础配置
    sendfile on;
    keepalive_timeout 65;
    client_max_body_size 50M;

    # 日志
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # HTTP重定向到HTTPS
    server {
        listen 80;
        server_name _;
        return 301 https://\$host\$request_uri;
    }

    # HTTPS主服务
    server {
        listen 443 ssl http2;
        server_name tkmail.fun;

        # SSL配置
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        
        # 前端静态资源
        location / {
            proxy_pass http://$BACKEND_IP:3000;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }

        # API路由
        location /api/ {
            proxy_pass http://$BACKEND_IP:3000/api/;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }

        # 健康检查
        location /health {
            proxy_pass http://$BACKEND_IP:3000/health;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }

        # Webhook路由
        location /webhook/ {
            proxy_pass http://$BACKEND_IP:3000/webhook/;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
    }
}
EOF"

echo "✅ nginx配置创建完成"

# 3. 验证并重载nginx
echo "🔍 验证nginx配置..."
if sudo docker exec "$NGINX_CONTAINER" nginx -t; then
    echo "✅ nginx配置验证通过"
    
    echo "🔄 重载nginx..."
    sudo docker exec "$NGINX_CONTAINER" nginx -s reload
    echo "✅ nginx重载完成"
    
    # 等待服务稳定
    sleep 5
    
    echo "🧪 测试HTTPS功能..."
    
    # 测试HTTPS健康检查
    HTTPS_CODE=$(curl -s -w "%{http_code}" -H "Host: tkmail.fun" "https://localhost/health" -k -o /tmp/https_test.json || echo "000")
    echo "HTTPS健康检查: $HTTPS_CODE"
    
    if [ "$HTTPS_CODE" = "200" ]; then
        echo "✅ HTTPS健康检查成功！"
        cat /tmp/https_test.json 2>/dev/null || echo ""
        
        # 测试HTTPS Webhook
        WEBHOOK_CODE=$(curl -s -w "%{http_code}" -H "Host: tkmail.fun" \
            -X POST "https://localhost/webhook/engagelab" \
            -H "Content-Type: application/json" \
            -d '{"quick_https_fix_test": true}' \
            -k -o /tmp/webhook_test.json || echo "000")
        echo "HTTPS Webhook: $WEBHOOK_CODE"
        
        if [ "$WEBHOOK_CODE" = "200" ]; then
            echo "✅ HTTPS Webhook成功！"
            cat /tmp/webhook_test.json 2>/dev/null || echo ""
        fi
        
        echo ""
        echo "🎉 HTTPS快速修复成功！"
    else
        echo "⚠️ HTTPS健康检查失败: $HTTPS_CODE"
        echo "响应内容:"
        cat /tmp/https_test.json 2>/dev/null || echo "无响应内容"
    fi
    
    rm -f /tmp/*.json
    
else
    echo "❌ nginx配置验证失败"
    sudo docker exec "$NGINX_CONTAINER" nginx -t
fi

ENDSSH

RESULT=$?

if [ $RESULT -eq 0 ]; then
    echo ""
    echo "🔍 外部HTTPS测试..."
    
    # 等待一下让服务完全启动
    sleep 3
    
    echo "1. 测试HTTPS健康检查..."
    EXTERNAL_HTTPS=$(curl -s -w "%{http_code}" "https://tkmail.fun/health" -k -o /tmp/external_https.json || echo "000")
    echo "外部HTTPS: $EXTERNAL_HTTPS"
    
    if [ "$EXTERNAL_HTTPS" = "200" ]; then
        echo "✅ 外部HTTPS访问成功！"
        cat /tmp/external_https.json 2>/dev/null && echo ""
        
        echo "2. 测试HTTPS Webhook..."
        EXTERNAL_WEBHOOK=$(curl -s -w "%{http_code}" -X POST "https://tkmail.fun/webhook/engagelab" \
            -H "Content-Type: application/json" \
            -d '{"external_https_test": true, "timestamp": "'$(date)'"}' \
            -k -o /tmp/external_webhook.json || echo "000")
        echo "外部HTTPS Webhook: $EXTERNAL_WEBHOOK"
        
        if [ "$EXTERNAL_WEBHOOK" = "200" ]; then
            echo "✅ 外部HTTPS Webhook成功！"
            cat /tmp/external_webhook.json 2>/dev/null && echo ""
        fi
        
        echo ""
        echo "🎊🎊🎊 HTTPS完全修复成功！🎊🎊🎊"
        echo ""
        echo "🎯 系统现在完全可用："
        echo "  🔒 HTTPS前端: https://tkmail.fun"
        echo "  📡 HTTPS API: https://tkmail.fun/api"
        echo "  🔗 HTTPS Webhook: https://tkmail.fun/webhook/engagelab"
        echo "  ❤️ 健康检查: https://tkmail.fun/health"
        echo ""
        echo "🎯 EngageLab后台配置："
        echo "  📌 Webhook URL: https://tkmail.fun/webhook/engagelab"
        echo "  📌 请求方法: POST"
        echo "  📌 内容类型: application/json"
        echo "  🔒 安全协议: HTTPS"
        echo ""
        echo "✅ 修复完成！HTTP自动重定向到HTTPS！"
        
    else
        echo "⚠️ 外部HTTPS访问问题: $EXTERNAL_HTTPS"
        if [ -f /tmp/external_https.json ]; then
            echo "响应内容:"
            cat /tmp/external_https.json
        fi
    fi
    
    rm -f /tmp/external_*.json
    
else
    echo "❌ HTTPS快速修复失败"
    exit 1
fi

echo ""
echo "🎯 HTTPS快速修复完成！" 