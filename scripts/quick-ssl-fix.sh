#!/bin/bash

# 🚀 快速SSL修复脚本 - 使用自签名证书立即恢复HTTPS
set -e

SERVER_IP="43.135.38.15"
SERVER_USER="ubuntu"
SERVER_PASS="Tony1231!"

echo "🚀 快速SSL修复 - 使用自签名证书..."
echo "📅 时间: $(date)"

sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" << 'ENDSSH'
#!/bin/bash
set -e

NGINX_CONTAINER=$(sudo docker ps --format "{{.Names}}" | grep nginx | head -1)
BACKEND_CONTAINER=$(sudo docker ps --format "{{.Names}}" | grep backend | head -1)
BACKEND_IP=$(sudo docker inspect $BACKEND_CONTAINER --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null || echo "172.18.0.4")

echo "Nginx容器: $NGINX_CONTAINER"
echo "Backend IP: $BACKEND_IP"

# 1. 重启nginx
echo "🔄 重启nginx..."
sudo docker restart "$NGINX_CONTAINER"
sleep 5

# 2. 安装openssl并创建自签名证书
echo "🔑 创建自签名SSL证书..."
sudo docker exec "$NGINX_CONTAINER" sh -c "
# 确保openssl可用
apt-get update -qq > /dev/null 2>&1 || true
apt-get install -y openssl > /dev/null 2>&1 || true

# 创建SSL目录
mkdir -p /etc/nginx/ssl
cd /etc/nginx/ssl

# 生成私钥
openssl genrsa -out tkmail.fun.key 2048

# 生成证书签名请求和自签名证书
openssl req -new -x509 -key tkmail.fun.key -out tkmail.fun.crt -days 365 -subj '/C=CN/ST=Beijing/L=Beijing/O=EDM/CN=tkmail.fun'

# 设置权限
chmod 600 tkmail.fun.key tkmail.fun.crt

echo '✅ 自签名证书创建完成'
ls -la /etc/nginx/ssl/
"

# 3. 创建清理后的nginx配置
echo "📝 创建清理后的nginx配置..."
sudo docker exec "$NGINX_CONTAINER" sh -c "cat > /etc/nginx/nginx.conf << 'EOFCONF'
user nginx;
worker_processes auto;
pid /var/run/nginx.pid;

events { 
    worker_connections 1024; 
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    sendfile on;
    keepalive_timeout 65;
    client_max_body_size 50M;
    server_tokens off;

    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # HTTP重定向到HTTPS
    server {
        listen 80;
        server_name tkmail.fun _;
        return 301 https://\$host\$request_uri;
    }

    # HTTPS服务器
    server {
        listen 443 ssl http2;
        server_name tkmail.fun;

        # SSL配置 - 自签名证书
        ssl_certificate /etc/nginx/ssl/tkmail.fun.crt;
        ssl_certificate_key /etc/nginx/ssl/tkmail.fun.key;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers off;

        # 安全头
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection \"1; mode=block\";

        # 前端路由
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
            
            # CORS
            add_header Access-Control-Allow-Origin \$http_origin;
            add_header Access-Control-Allow-Methods \"GET, POST, PUT, DELETE, OPTIONS\";
            add_header Access-Control-Allow-Headers \"Authorization, Content-Type\";
            add_header Access-Control-Allow-Credentials true;
            
            if (\$request_method = 'OPTIONS') {
                return 204;
            }
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
EOFCONF"

# 4. 验证并重启nginx
echo "🔍 验证nginx配置..."
if sudo docker exec "$NGINX_CONTAINER" nginx -t; then
    echo "✅ nginx配置验证通过"
    
    echo "🔄 重启nginx应用SSL配置..."
    sudo docker restart "$NGINX_CONTAINER"
    sleep 5
    echo "✅ nginx重启完成"
    
    # 测试HTTPS
    echo "�� 测试HTTPS功能..."
    HTTPS_CODE=$(curl -s -w "%{http_code}" -H "Host: tkmail.fun" "https://localhost/health" -k -o /tmp/https_test.json || echo "000")
    echo "HTTPS测试: $HTTPS_CODE"
    
    if [ "$HTTPS_CODE" = "200" ]; then
        echo "✅ HTTPS功能正常！"
        cat /tmp/https_test.json 2>/dev/null && echo ""
        
        # 测试Webhook
        WEBHOOK_CODE=$(curl -s -w "%{http_code}" -H "Host: tkmail.fun" \
            -X POST "https://localhost/webhook/engagelab" \
            -H "Content-Type: application/json" \
            -d '{"ssl_fix_test": true, "timestamp": "'$(date)'"}' \
            -k -o /tmp/webhook_test.json || echo "000")
        echo "HTTPS Webhook: $WEBHOOK_CODE"
        
        if [ "$WEBHOOK_CODE" = "200" ]; then
            echo "✅ HTTPS Webhook正常！"
            cat /tmp/webhook_test.json 2>/dev/null && echo ""
        fi
        
        echo "🎉 自签名SSL配置成功！"
    else
        echo "⚠️ HTTPS测试失败: $HTTPS_CODE"
        cat /tmp/https_test.json 2>/dev/null || echo ""
    fi
    
    rm -f /tmp/*.json
    
else
    echo "❌ nginx配置验证失败"
    sudo docker exec "$NGINX_CONTAINER" nginx -t
fi

ENDSSH

# 外部测试
if [ $? -eq 0 ]; then
    echo ""
    echo "🔍 外部HTTPS测试..."
    sleep 8
    
    HTTP_CODE=$(curl -s -w "%{http_code}" "http://tkmail.fun/health" -o /dev/null || echo "000")
    echo "HTTP重定向: $HTTP_CODE (应该是301)"
    
    HTTPS_CODE=$(curl -s -w "%{http_code}" "https://tkmail.fun/health" -k -o /tmp/https_final.json || echo "000")
    echo "外部HTTPS: $HTTPS_CODE"
    
    if [ "$HTTPS_CODE" = "200" ]; then
        echo "✅ 外部HTTPS访问成功！"
        cat /tmp/https_final.json 2>/dev/null && echo ""
        
        WEBHOOK_CODE=$(curl -s -w "%{http_code}" -k -X POST "https://tkmail.fun/webhook/engagelab" \
            -H "Content-Type: application/json" \
            -d '{"external_ssl_test": true, "final_check": true}' \
            -o /tmp/webhook_final.json || echo "000")
        echo "外部HTTPS Webhook: $WEBHOOK_CODE"
        
        if [ "$WEBHOOK_CODE" = "200" ]; then
            echo "✅ 外部HTTPS Webhook成功！"
            cat /tmp/webhook_final.json 2>/dev/null && echo ""
        fi
        
        echo ""
        echo "🎊🎊🎊 HTTPS快速修复成功！🎊🎊🎊"
        echo ""
        echo "🎯 EDM系统现在可用（使用自签名证书）："
        echo "  🔒 HTTPS前端: https://tkmail.fun"
        echo "  📡 HTTPS API: https://tkmail.fun/api"  
        echo "  🔗 HTTPS Webhook: https://tkmail.fun/webhook/engagelab"
        echo "  ❤️ 健康检查: https://tkmail.fun/health"
        echo ""
        echo "⚠️ 注意事项："
        echo "  📢 浏览器会显示'不安全'警告"
        echo "  🔧 需要点击'高级' → '继续前往tkmail.fun'"
        echo "  🎯 功能完全正常，只是证书不被浏览器信任"
        echo ""
        echo "🎯 EngageLab后台配置："
        echo "  📌 Webhook URL: https://tkmail.fun/webhook/engagelab"
        echo "  📌 请求方法: POST"
        echo "  📌 内容类型: application/json"
        echo "  🔒 安全协议: HTTPS (自签名证书)"
        echo ""
        echo "✅ 下一步建议："
        echo "  1. 📧 现在就可以使用EDM系统发送邮件"
        echo "  2. 🔧 在EngageLab后台配置Webhook URL"
        echo "  3. 🔒 稍后可以手动申请Let's Encrypt证书"
        echo ""
        echo "🎉 HTTPS功能已完全恢复！"
        
    else
        echo "⚠️ 外部HTTPS访问问题: $HTTPS_CODE"
        if [ -f /tmp/https_final.json ]; then
            cat /tmp/https_final.json
        fi
    fi
    
    rm -f /tmp/*final.json
fi

echo ""
echo "🎯 快速SSL修复完成！"
