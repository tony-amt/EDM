#!/bin/bash

# 🏗️ EDM项目nginx架构修复脚本
# 为EDM项目创建专门的nginx容器，不再依赖gloda_nginx_proxy

set -e

echo "🏗️ 修复EDM项目nginx架构..."
echo "📅 时间: $(date)"
echo "🎯 目标: 为EDM创建专门的nginx容器"

SERVER_IP="43.135.38.15"

# 服务器端操作
ssh ubuntu@$SERVER_IP << 'ENDSSH'
set -e

echo "🔍 检查当前容器状态..."
echo "=== EDM容器 ==="
sudo docker ps --filter "name=edm-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "=== Gloda容器 ==="
sudo docker ps --filter "name=gloda" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 获取EDM后端容器IP
EDM_BACKEND_IP=$(sudo docker inspect edm-backend --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null || echo "172.18.0.4")
echo ""
echo "🔍 EDM后端容器IP: $EDM_BACKEND_IP"

# 测试EDM后端健康状态
echo "🩺 测试EDM后端健康状态..."
HEALTH_CHECK=$(curl -s "http://$EDM_BACKEND_IP:3000/health" | head -c 100 || echo "FAILED")
echo "   健康检查: $HEALTH_CHECK"

# 创建EDM专用网络（如果不存在）
echo "🌐 确保EDM网络存在..."
sudo docker network create edm-network 2>/dev/null || echo "   EDM网络已存在"

# 停止旧的gloda_nginx_proxy（如果在使用中）
echo "⚠️ 检查gloda_nginx_proxy状态..."
if sudo docker ps | grep gloda_nginx_proxy >/dev/null; then
    echo "   发现gloda_nginx_proxy正在运行，但我们将为EDM创建专门容器"
    echo "   保留gloda_nginx_proxy给Gloda项目使用"
fi

# 创建EDM专用nginx容器
echo "🔧 创建EDM专用nginx容器..."

# 停止可能存在的旧EDM nginx容器
sudo docker rm -f edm-nginx-proxy 2>/dev/null || echo "   没有旧的EDM nginx容器"

# 创建EDM nginx配置
cat > /tmp/edm-nginx.conf << EOFCONF
user nginx;
worker_processes auto;
pid /var/run/nginx.pid;

events { worker_connections 1024; }

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    sendfile on;
    keepalive_timeout 65;

    # HTTP服务（用于Let's Encrypt验证）
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

        # SSL证书配置
        ssl_certificate /etc/ssl/certs/tkmail.fun.crt;
        ssl_certificate_key /etc/ssl/private/tkmail.fun.key;
        ssl_protocols TLSv1.2 TLSv1.3;

        # 代理到EDM后端
        location / {
            proxy_pass http://$EDM_BACKEND_IP:3000;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }

        # API路由
        location /api/ {
            proxy_pass http://$EDM_BACKEND_IP:3000/api/;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }

        # 健康检查
        location /health {
            proxy_pass http://$EDM_BACKEND_IP:3000/health;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
        }

        # Webhook路由
        location /webhook/ {
            proxy_pass http://$EDM_BACKEND_IP:3000/webhook/;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
    }
}
EOFCONF

# 创建EDM专用nginx容器
echo "🚀 启动EDM专用nginx容器..."
sudo docker run -d \
    --name edm-nginx-proxy \
    --restart unless-stopped \
    -p 80:80 \
    -p 443:443 \
    --network edm-network \
    -v /tmp/edm-nginx.conf:/etc/nginx/nginx.conf:ro \
    -v /var/www/certbot:/var/www/certbot \
    nginx:alpine

# 等待容器启动
sleep 3

# 检查容器状态
echo "✅ 检查EDM nginx容器状态..."
sudo docker ps --filter "name=edm-nginx-proxy" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 验证nginx配置
echo "🔍 验证nginx配置..."
if sudo docker exec edm-nginx-proxy nginx -t; then
    echo "✅ nginx配置验证通过"
else
    echo "❌ nginx配置有误"
    sudo docker logs edm-nginx-proxy --tail 20
    exit 1
fi

# 测试HTTP连接
echo "🧪 测试HTTP连接..."
sleep 2
HTTP_TEST=$(curl -s -w "%{http_code}" -H "Host: tkmail.fun" "http://localhost/health" -o /tmp/http_test.json || echo "000")
echo "   HTTP测试: $HTTP_TEST"

if [ "$HTTP_TEST" = "301" ]; then
    echo "✅ HTTP重定向正常工作"
elif [ "$HTTP_TEST" = "200" ]; then
    echo "✅ HTTP直接访问成功"
    cat /tmp/http_test.json 2>/dev/null && echo ""
else
    echo "⚠️ HTTP测试结果: $HTTP_TEST"
    cat /tmp/http_test.json 2>/dev/null || echo ""
fi

rm -f /tmp/http_test.json

echo ""
echo "🎊 EDM nginx架构修复完成！"
echo ""
echo "📋 新架构："
echo "  🔹 EDM专用nginx: edm-nginx-proxy (端口80,443)"
echo "  🔹 EDM后端: edm-backend ($EDM_BACKEND_IP:3000)"
echo "  🔹 Gloda项目: 继续使用gloda_nginx_proxy (端口7001)"
echo ""
echo "🎯 下一步："
echo "  1. 为edm-nginx-proxy配置SSL证书"
echo "  2. 测试 https://tkmail.fun 访问"
echo "  3. 验证 https://tkmail.fun/webhook/engagelab"

ENDSSH

RESULT=$?

if [ $RESULT -eq 0 ]; then
    echo ""
    echo "🎉 EDM nginx架构修复成功！"
    echo ""
    echo "📊 现在的架构："
    echo "  🏗️ EDM项目: 独立的edm-nginx-proxy容器"
    echo "  🏗️ Gloda项目: 独立的gloda_nginx_proxy容器"
    echo "  🔒 域名访问: tkmail.fun → EDM"
    echo "  🔒 端口访问: :7001 → Gloda"
    echo ""
    echo "✅ 问题解决："
    echo "  ❌ 之前: 错误使用gloda_nginx_proxy代理EDM"
    echo "  ✅ 现在: EDM有专门的nginx容器"
    echo "  🎯 结果: 架构清晰，职责分离"
else
    echo "❌ EDM nginx架构修复失败"
    exit 1
fi

echo ""
echo "🎯 EDM nginx架构修复完成！" 