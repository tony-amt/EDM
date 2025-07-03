#!/bin/bash

# 🔒 重新申请Let's Encrypt证书脚本
set -e

SERVER_IP="43.135.38.15"
SERVER_USER="ubuntu"
SERVER_PASS="Tony1231!"

echo "🔒 开始申请Let's Encrypt证书..."
echo "📅 时间: $(date)"

# 服务器端操作
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" << 'ENDSSH'
#!/bin/bash
set -e

NGINX_CONTAINER=$(sudo docker ps --format "{{.Names}}" | grep nginx | head -1)
BACKEND_CONTAINER=$(sudo docker ps --format "{{.Names}}" | grep backend | head -1)
BACKEND_IP=$(sudo docker inspect $BACKEND_CONTAINER --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null || echo "172.18.0.4")

echo "Backend IP: $BACKEND_IP"

# 1. 创建临时HTTP配置
echo "📝 创建临时HTTP配置..."
sudo docker exec "$NGINX_CONTAINER" sh -c "cat > /etc/nginx/nginx.conf << 'EOFCONF'
user nginx;
worker_processes auto;
pid /var/run/nginx.pid;

events { worker_connections 1024; }

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    sendfile on;
    keepalive_timeout 65;

    server {
        listen 80;
        server_name tkmail.fun;
        
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        
        location / {
            proxy_pass http://$BACKEND_IP:3000;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
        }
    }
}
EOFCONF"

sudo docker exec "$NGINX_CONTAINER" mkdir -p /var/www/certbot
sudo docker exec "$NGINX_CONTAINER" nginx -t && sudo docker exec "$NGINX_CONTAINER" nginx -s reload

# 2. 安装certbot
echo "📦 安装Certbot..."
sudo docker exec "$NGINX_CONTAINER" sh -c "apt-get update -qq && apt-get install -y certbot"

# 3. 申请证书
echo "🔑 申请Let's Encrypt证书..."
sudo docker exec "$NGINX_CONTAINER" certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email admin@tkmail.fun \
    --agree-tos \
    --non-interactive \
    --domains tkmail.fun

# 4. 创建HTTPS配置
if sudo docker exec "$NGINX_CONTAINER" test -f /etc/letsencrypt/live/tkmail.fun/fullchain.pem; then
    echo "✅ 证书申请成功，创建HTTPS配置..."
    
    sudo docker exec "$NGINX_CONTAINER" sh -c "cat > /etc/nginx/nginx.conf << 'EOFCONF'
user nginx;
worker_processes auto;
pid /var/run/nginx.pid;

events { worker_connections 1024; }

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    sendfile on;
    keepalive_timeout 65;

    # HTTP重定向
    server {
        listen 80;
        server_name tkmail.fun;
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        location / {
            return 301 https://\$host\$request_uri;
        }
    }

    # HTTPS服务
    server {
        listen 443 ssl http2;
        server_name tkmail.fun;

        ssl_certificate /etc/letsencrypt/live/tkmail.fun/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/tkmail.fun/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;

        location / {
            proxy_pass http://$BACKEND_IP:3000;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }

        location /api/ {
            proxy_pass http://$BACKEND_IP:3000/api/;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }

        location /health {
            proxy_pass http://$BACKEND_IP:3000/health;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }

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

    sudo docker exec "$NGINX_CONTAINER" nginx -t && sudo docker exec "$NGINX_CONTAINER" nginx -s reload
    echo "🎉 Let's Encrypt HTTPS配置完成！"
else
    echo "❌ 证书申请失败"
    exit 1
fi

ENDSSH

# 测试
echo "🧪 测试HTTPS..."
sleep 5
HTTPS_TEST=$(curl -s -w "%{http_code}" "https://tkmail.fun/health" -o /dev/null || echo "000")
echo "HTTPS测试: $HTTPS_TEST"

if [ "$HTTPS_TEST" = "200" ]; then
    echo "🎉 Let's Encrypt证书申请成功！"
    echo "🔒 HTTPS网站: https://tkmail.fun"
    echo "🔗 HTTPS Webhook: https://tkmail.fun/webhook/engagelab"
else
    echo "⚠️ HTTPS测试失败: $HTTPS_TEST"
fi
