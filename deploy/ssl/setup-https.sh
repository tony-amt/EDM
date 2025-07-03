#!/bin/bash

echo "======================================"
echo "   EDM系统HTTPS配置脚本"
echo "======================================"

# 配置变量
DOMAIN="tkmail.fun"
EMAIL="tony@glodamarket.fun"

echo "1. 更新系统包..."
sudo apt update

echo "2. 安装Certbot..."
if ! command -v certbot &> /dev/null; then
    sudo apt install -y certbot python3-certbot-nginx
    echo "✅ Certbot安装完成"
else
    echo "✅ Certbot已安装"
fi

echo "3. 检查域名解析..."
if ping -c 1 $DOMAIN > /dev/null 2>&1; then
    echo "✅ 域名 $DOMAIN 解析正常"
else
    echo "⚠️  域名 $DOMAIN 可能未正确解析，继续使用IP地址"
fi
echo "4. 备份当前Nginx配置..."
sudo cp nginx/nginx.conf nginx/nginx.conf.backup.$(date +%Y%m%d_%H%M%S)
echo "5. 创建HTTPS版本的Nginx配置..."
cat > nginx/nginx.conf << 'EOF'
user nginx;
worker_processes auto;
pid /var/run/nginx.pid;
include /etc/nginx/modules-enabled/.conf;
events {
worker_connections 1024;
}
http {
sendfile on;
tcp_nopush on;
tcp_nodelay on;
keepalive_timeout 65;
types_hash_max_size 2048;
include /etc/nginx/mime.types;
default_type application/octet-stream;
# 上游服务配置
upstream frontend {
server edm-frontend-prod:3001;
}
upstream backend {
server edm-backend-prod:8080;
}
upstream image-service {
server image-service:8082;
}
upstream tracking-service {
server tracking-service:8081;
}
upstream webhook-service {
server webhook-service:8083;
}
# HTTP服务器 - 重定向到HTTPS
server {
listen 80;
server_name tkmail.fun 43.135.38.15;
# 重定向所有HTTP请求到HTTPS
return 301 https://$server_name$request_uri;
}
# HTTPS服务器
server {
listen 443 ssl http2;
server_name tkmail.fun 43.135.38.15;
# SSL证书配置（Certbot会自动添加）
# ssl_certificate /etc/letsencrypt/live/tkmail.fun/fullchain.pem;
# ssl_certificate_key /etc/letsencrypt/live/tkmail.fun/privkey.pem;
# SSL安全配置
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;
# 安全头部
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
# 前端静态资源
location / {
proxy_pass http://frontend;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
# WebSocket支持
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
}
# API路由
location /api/ {
proxy_pass http://backend/api/;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
# API超时配置
proxy_connect_timeout 30s;
proxy_send_timeout 30s;
proxy_read_timeout 30s;
}
# 健康检查路由
location /health {
proxy_pass http://backend/health;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
}
# EngageLab Webhook路由
location /webhook/ {
proxy_pass http://webhook-service/;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
# Webhook特殊配置
proxy_buffering off;
proxy_request_buffering off;
client_max_body_size 10m;
}
# 追踪像素路由
location /track/ {
proxy_pass http://tracking-service/;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
# 追踪像素缓存配置
expires 1d;
add_header Cache-Control "public, no-transform";
}
# 图片上传API路由
location /image-api/ {
proxy_pass http://image-service/;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
# 文件上传配置
client_max_body_size 10m;
proxy_connect_timeout 30s;
proxy_send_timeout 30s;
proxy_read_timeout 30s;
}
# 静态文件访问
location /uploads/ {
alias /var/www/uploads/;
expires 30d;
add_header Cache-Control "public, no-transform";
# 图片格式支持
location ~* \.(jpg|jpeg|png|gif|webp)$ {
expires 1y;
add_header Cache-Control "public, immutable";
}
}
# 安全配置
location ~ /\. {
deny all;
}
# 错误页面配置
error_page 404 /404.html;
error_page 500 502 503 504 /50x.html;
}
}
EOF
echo "6. 测试Nginx配置..."
sudo docker exec edm-nginx-prod nginx -t
echo "7. 重新加载Nginx配置..."
sudo docker exec edm-nginx-prod nginx -s reload
echo "8. 申请SSL证书..."
if [ "$DOMAIN" = "tkmail.fun" ]; then
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $EMAIL
else
echo "⚠️ 使用IP地址，跳过SSL证书申请"
fi
echo "9. 设置自动续期..."
sudo crontab -l | grep -q certbot || (crontab -l; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
echo "10. 测试HTTPS访问..."
curl -I https://tkmail.fun/ 2>/dev/null || curl -I https://43.135.38.15/ 2>/dev/null
echo "======================================"
echo "HTTPS配置完成！"
echo "访问地址："
echo "- HTTPS: https://tkmail.fun"
echo "- HTTP自动重定向到HTTPS"
echo "======================================"
