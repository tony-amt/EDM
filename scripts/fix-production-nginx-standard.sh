#!/bin/bash

# 🔧 按生产规范修复nginx配置脚本
# 根据docker-compose.prod.yml的端口规范修复nginx配置

set -e

echo "🔧 按生产规范修复nginx配置..."
echo "📅 时间: $(date)"
echo "🎯 按生产规范: 后端8080，前端3000，nginx代理"

SERVER_IP="43.135.38.15"

# 服务器端操作
ssh ubuntu@$SERVER_IP << 'ENDSSH'
set -e

echo "🔍 生产规范端口分配："
echo "  - 后端API: localhost:8080"
echo "  - 前端Web: localhost:3000" 
echo "  - nginx: 80/443端口处理域名"
echo ""

echo "🔍 检查当前端口占用..."
echo "=== 端口8080 (后端应该用) ==="
sudo netstat -tlnp | grep ':8080 ' || echo "端口8080空闲"

echo "=== 端口3000 (前端应该用) ==="
sudo netstat -tlnp | grep ':3000 ' || echo "端口3000空闲"

echo "=== 端口3001 (当前错误使用) ==="
sudo netstat -tlnp | grep ':3001 ' || echo "端口3001空闲"

echo ""
echo "📝 创建生产规范nginx配置..."

# 备份当前配置
sudo cp /etc/nginx/sites-enabled/tkmail.fun /etc/nginx/sites-enabled/tkmail.fun.backup.$(date +%Y%m%d_%H%M%S)

# 创建生产规范nginx配置
sudo tee /etc/nginx/sites-enabled/tkmail.fun > /dev/null << 'EOFCONF'
server {
    listen 80;
    server_name tkmail.fun www.tkmail.fun 43.135.38.15;
    
    # Let's Encrypt验证路径
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    # 其他请求重定向到HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name tkmail.fun www.tkmail.fun;

    # SSL证书配置
    ssl_certificate /etc/letsencrypt/live/tkmail.fun/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tkmail.fun/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # 前端静态资源 - 代理到前端容器 (生产规范: 3000端口)
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 前端专用配置
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # API路由 - 代理到后端容器 (生产规范: 8080端口)
    location /api/ {
        proxy_pass http://localhost:8080/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS头
        add_header Access-Control-Allow-Origin $http_origin;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
        add_header Access-Control-Allow-Headers "Authorization, Content-Type";
        add_header Access-Control-Allow-Credentials true;
        
        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }

    # 健康检查 - 后端API
    location /health {
        proxy_pass http://localhost:8080/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Webhook路由 - 后端API (EngageLab回调)
    location /webhook/ {
        proxy_pass http://localhost:8080/webhook/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Webhook特殊配置
        proxy_connect_timeout 10s;
        proxy_send_timeout 10s;
        proxy_read_timeout 10s;
    }
    
    # 上传文件访问 - 如果有的话
    location /uploads/ {
        proxy_pass http://localhost:8080/uploads/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # 安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}
EOFCONF

# 创建certbot目录
sudo mkdir -p /var/www/certbot

# 验证nginx配置
echo ""
echo "🔍 验证nginx配置..."
if sudo nginx -t; then
    echo "✅ nginx配置验证通过"
else
    echo "❌ nginx配置验证失败"
    exit 1
fi

# 重载nginx
echo "🔄 重载nginx..."
sudo systemctl reload nginx
echo "✅ nginx重载完成"

# 等待服务稳定
sleep 3

echo ""
echo "🧪 测试修复后的配置..."

# 测试HTTP重定向
echo "1. 测试HTTP重定向..."
HTTP_TEST=$(curl -s -w "%{http_code}" -H "Host: tkmail.fun" "http://localhost/health" -o /tmp/http_test.json || echo "000")
echo "   HTTP重定向: $HTTP_TEST (应该是301)"

# 测试后端端口
echo "2. 测试后端端口8080..."
BACKEND_TEST=$(curl -s -w "%{http_code}" http://localhost:8080/health -o /tmp/backend_test.json || echo "000")
echo "   后端8080端口: $BACKEND_TEST"

if [ "$BACKEND_TEST" = "200" ]; then
    echo "   ✅ 后端8080端口正常响应"
else
    echo "   ⚠️ 后端8080端口无响应，需要启动生产容器"
fi

# 测试前端端口
echo "3. 测试前端端口3000..."
FRONTEND_TEST=$(curl -s -w "%{http_code}" http://localhost:3000 -o /tmp/frontend_test.html || echo "000")
echo "   前端3000端口: $FRONTEND_TEST"

if [ "$FRONTEND_TEST" = "200" ]; then
    echo "   ✅ 前端3000端口正常响应"
else
    echo "   ⚠️ 前端3000端口无响应，需要启动生产容器"
fi

# 测试HTTPS（如果证书存在）
if [ -f /etc/letsencrypt/live/tkmail.fun/fullchain.pem ]; then
    echo "4. 测试HTTPS访问..."
    HTTPS_TEST=$(curl -s -w "%{http_code}" -k "https://localhost/health" -o /tmp/https_test.json || echo "000")
    echo "   HTTPS健康检查: $HTTPS_TEST"
    
    if [ "$HTTPS_TEST" = "200" ]; then
        echo "   ✅ HTTPS后端代理正常"
        
        # 测试HTTPS前端
        HTTPS_FRONTEND=$(curl -s -w "%{http_code}" -k "https://localhost/" -o /tmp/https_frontend.html || echo "000")
        echo "   HTTPS前端: $HTTPS_FRONTEND"
        
        if [ "$HTTPS_FRONTEND" = "200" ]; then
            echo "   ✅ HTTPS前端代理正常"
        else
            echo "   ⚠️ HTTPS前端响应: $HTTPS_FRONTEND"
        fi
    else
        echo "   ⚠️ HTTPS后端响应: $HTTPS_TEST"
    fi
fi

# 清理临时文件
rm -f /tmp/*_test.*

echo ""
echo "🎊 生产规范nginx配置完成！"
echo ""
echo "📋 配置总结（按生产规范）："
echo "  🔹 HTTP重定向: 80 → 443"
echo "  🔹 前端访问: / → localhost:3000 (前端容器)"
echo "  🔹 API访问: /api/ → localhost:8080 (后端容器)"
echo "  🔹 健康检查: /health → localhost:8080 (后端容器)"
echo "  🔹 Webhook: /webhook/ → localhost:8080 (后端容器)"
echo ""
echo "🎯 下一步检查："
echo "  1. 确保后端容器运行在8080端口"
echo "  2. 确保前端容器运行在3000端口"
echo "  3. 如需要，可切换到生产配置：docker-compose.prod.yml"

ENDSSH

RESULT=$?

if [ $RESULT -eq 0 ]; then
    echo ""
    echo "🎉 生产规范nginx配置修复成功！"
    echo ""
    echo "📊 生产规范端口分配："
    echo "  🔹 前端访问: https://tkmail.fun → localhost:3000"
    echo "  🔹 API访问: https://tkmail.fun/api → localhost:8080"
    echo "  🔹 Webhook: https://tkmail.fun/webhook/engagelab → localhost:8080"
    echo ""
    echo "✅ nginx配置已按生产规范修复"
    echo "🔧 如容器端口不符，需要调整容器配置到生产规范"
else
    echo "❌ 生产规范nginx配置修复失败"
    exit 1
fi

echo ""
echo "🎯 生产规范nginx配置修复完成！" 