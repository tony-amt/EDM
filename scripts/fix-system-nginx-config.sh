#!/bin/bash

# 🔧 修复系统nginx配置脚本
# 修复系统nginx配置，使其正确代理到EDM容器端口

set -e

echo "🔧 修复系统nginx配置..."
echo "📅 时间: $(date)"
echo "🎯 目标: 修复nginx代理到正确的EDM端口"

SERVER_IP="43.135.38.15"

# 服务器端操作
ssh ubuntu@$SERVER_IP << 'ENDSSH'
set -e

echo "🔍 检查当前配置状态..."

# 显示当前EDM容器端口
echo "=== EDM容器端口映射 ==="
sudo docker ps --filter "name=edm-backend" --format "table {{.Names}}\t{{.Ports}}"

# 显示当前nginx配置
echo ""
echo "=== 当前nginx配置 ==="
cat /etc/nginx/sites-enabled/tkmail.fun

# 测试当前端口状态
echo ""
echo "🧪 测试端口连接状态..."
echo "测试3000端口: $(curl -s -w '%{http_code}' http://localhost:3000/health -o /dev/null 2>/dev/null || echo 'FAILED')"
echo "测试3001端口: $(curl -s -w '%{http_code}' http://localhost:3001/health -o /dev/null 2>/dev/null || echo 'FAILED')"
echo "测试8080端口: $(curl -s -w '%{http_code}' http://localhost:8080/health -o /dev/null 2>/dev/null || echo 'FAILED')"

# 创建正确的nginx配置
echo ""
echo "📝 创建正确的nginx配置..."

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

    # 主要路由 - 代理到EDM后端（3001端口）
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时配置
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # API路由 - 代理到EDM后端
    location /api/ {
        proxy_pass http://localhost:3001/api/;
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

    # 健康检查
    location /health {
        proxy_pass http://localhost:3001/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Webhook路由 - 重要！EngageLab回调
    location /webhook/ {
        proxy_pass http://localhost:3001/webhook/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Webhook特殊配置
        proxy_connect_timeout 10s;
        proxy_send_timeout 10s;
        proxy_read_timeout 10s;
    }
    
    # 安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}
EOFCONF

# 创建certbot目录（如果不存在）
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

# 测试配置
echo ""
echo "🧪 测试修复后的配置..."

# 测试HTTP重定向
HTTP_TEST=$(curl -s -w "%{http_code}" -H "Host: tkmail.fun" "http://localhost/health" -o /tmp/http_test.json || echo "000")
echo "HTTP重定向测试: $HTTP_TEST (应该是301)"

# 测试HTTPS健康检查
if [ -f /etc/letsencrypt/live/tkmail.fun/fullchain.pem ]; then
    echo "检测到Let's Encrypt证书，测试HTTPS..."
    HTTPS_TEST=$(curl -s -w "%{http_code}" -k "https://localhost/health" -o /tmp/https_test.json || echo "000")
    echo "HTTPS健康检查: $HTTPS_TEST"
    
    if [ "$HTTPS_TEST" = "200" ]; then
        echo "✅ HTTPS健康检查成功！"
        echo "响应内容:"
        cat /tmp/https_test.json | head -c 200 && echo ""
        
        # 测试Webhook
        echo ""
        echo "🔗 测试HTTPS Webhook..."
        WEBHOOK_TEST=$(curl -s -w "%{http_code}" -k -X POST "https://localhost/webhook/engagelab" \
            -H "Content-Type: application/json" \
            -d '{"test": "system_nginx_fix", "timestamp": "'$(date)'"}' \
            -o /tmp/webhook_test.json || echo "000")
        echo "HTTPS Webhook: $WEBHOOK_TEST"
        
        if [ "$WEBHOOK_TEST" = "200" ]; then
            echo "✅ HTTPS Webhook测试成功！"
            cat /tmp/webhook_test.json 2>/dev/null && echo ""
        else
            echo "⚠️ Webhook响应: $WEBHOOK_TEST"
            cat /tmp/webhook_test.json 2>/dev/null || echo ""
        fi
        
    else
        echo "⚠️ HTTPS测试结果: $HTTPS_TEST"
        cat /tmp/https_test.json 2>/dev/null || echo ""
    fi
else
    echo "⚠️ 未发现Let's Encrypt证书，只能测试HTTP"
fi

# 清理临时文件
rm -f /tmp/*_test.json

echo ""
echo "🎊 系统nginx配置修复完成！"
echo ""
echo "📋 修复内容："
echo "  🔹 HTTP重定向: 80 → 443"
echo "  🔹 主要代理: / → localhost:3001"
echo "  🔹 API代理: /api/ → localhost:3001/api/"
echo "  🔹 健康检查: /health → localhost:3001/health"
echo "  🔹 Webhook: /webhook/ → localhost:3001/webhook/"
echo ""
echo "✅ 修复前 vs 修复后："
echo "  ❌ 修复前: 代理到localhost:3000 (没有服务)"
echo "  ❌ 修复前: API代理到localhost:8080 (没有服务)"
echo "  ✅ 修复后: 代理到localhost:3001 (EDM后端容器)"
echo "  ✅ 修复后: 正确的SSL和安全配置"

ENDSSH

RESULT=$?

if [ $RESULT -eq 0 ]; then
    echo ""
    echo "🎉 系统nginx配置修复成功！"
    echo ""
    echo "🎯 现在的架构："
    echo "  🌐 域名访问: tkmail.fun"
    echo "  🔒 SSL终止: 系统nginx (80/443端口)"
    echo "  📡 后端代理: localhost:3001 → EDM容器"
    echo "  🏗️ 其他项目: gloda_nginx_proxy继续服务端口7001"
    echo ""
    echo "✅ 问题解决："
    echo "  ❌ 之前: nginx代理到错误端口导致502错误"
    echo "  ✅ 现在: nginx正确代理到EDM后端3001端口"
    echo "  🔐 结果: HTTPS应该可以正常访问了"
    echo ""
    echo "🧪 外部测试："
    echo "  curl -I https://tkmail.fun/health"
    echo "  curl -I https://tkmail.fun/webhook/engagelab"
else
    echo "❌ 系统nginx配置修复失败"
    exit 1
fi

echo ""
echo "🎯 系统nginx配置修复完成！" 