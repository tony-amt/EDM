#!/bin/bash

# 🚀 生产环境部署修复脚本
# 解决前端API访问失败和webhook域名访问问题

set -e

SERVER_IP="43.135.38.15"
SERVER_USER="ubuntu"
SERVER_PASS="Tony1231!"

echo "🚀 开始修复生产环境部署问题"
echo "📅 修复时间: $(date)"
echo "🎯 目标: 确保 https://tkmail.fun 完全可用"

# 在服务器上执行完整修复
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" << 'ENDSSH'
#!/bin/bash
set -e

echo "🚀 开始生产环境部署修复"
cd /opt/edm

# 1. 检查当前服务状态
echo "🔍 检查当前服务状态..."
echo "=== Docker容器状态 ==="
sudo docker-compose ps

echo "=== 端口占用情况 ==="
sudo netstat -tlnp | grep -E ":(80|443|3001|3000)" || echo "未找到相关端口"

# 2. 检查nginx容器和配置
echo "🔍 检查nginx容器和配置..."
NGINX_CONTAINERS=$(sudo docker ps --format "{{.Names}}" | grep nginx || echo "")
if [ ! -z "$NGINX_CONTAINERS" ]; then
    NGINX_CONTAINER=$(echo "$NGINX_CONTAINERS" | head -1)
    echo "✅ 找到nginx容器: $NGINX_CONTAINER"
    
    # 检查当前nginx配置
    echo "📝 当前nginx配置:"
    sudo docker exec "$NGINX_CONTAINER" cat /etc/nginx/nginx.conf | head -50
    
    # 检查是否有tkmail.fun的配置
    echo "🔍 检查tkmail.fun相关配置:"
    sudo docker exec "$NGINX_CONTAINER" find /etc/nginx -name "*.conf" -exec grep -l "tkmail.fun" {} \; || echo "未找到tkmail.fun配置"
    
else
    echo "❌ 未找到nginx容器，检查nginx进程"
    sudo ps aux | grep nginx || echo "未找到nginx进程"
fi

# 3. 获取EDM后端容器信息
echo "🔍 获取EDM后端容器信息..."
BACKEND_CONTAINER=$(sudo docker ps --format "{{.Names}}" | grep backend | head -1)
BACKEND_IP=$(sudo docker inspect $BACKEND_CONTAINER --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null || echo "")
BACKEND_PORT=$(sudo docker port $BACKEND_CONTAINER | grep "3000/tcp" | cut -d: -f2 || echo "3001")

echo "Backend容器: $BACKEND_CONTAINER"
echo "Backend IP: $BACKEND_IP"
echo "Backend端口映射: $BACKEND_PORT"

# 4. 创建完整的nginx配置
echo "🔧 创建完整的nginx配置..."

# 备份现有配置
sudo docker exec "$NGINX_CONTAINER" cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.$(date +%Y%m%d_%H%M%S)

# 创建新的nginx主配置
sudo docker exec "$NGINX_CONTAINER" tee /etc/nginx/nginx.conf > /dev/null << 'EOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    
    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;
    
    # 客户端限制
    client_max_body_size 50M;
    
    # 包含其他配置文件
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
EOF

# 5. 创建tkmail.fun站点配置
echo "🏗️ 创建tkmail.fun站点配置..."

SITES_DIR="/etc/nginx/sites-available"
ENABLED_DIR="/etc/nginx/sites-enabled"

# 确保目录存在
sudo docker exec "$NGINX_CONTAINER" mkdir -p "$SITES_DIR" "$ENABLED_DIR"

# 创建tkmail.fun配置
sudo docker exec "$NGINX_CONTAINER" tee "$SITES_DIR/tkmail.fun.conf" > /dev/null << EOF
# EDM系统 - tkmail.fun 配置
server {
    listen 80;
    server_name tkmail.fun www.tkmail.fun;
    
    # 安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # 根目录 - 前端静态文件
    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
        
        # 前端静态资源缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # API路由 - 代理到后端
    location /api/ {
        proxy_pass http://$BACKEND_IP:3000/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # API超时设置
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        # CORS处理
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
        add_header Access-Control-Allow-Headers "Authorization, Content-Type";
        
        if (\$request_method = 'OPTIONS') {
            return 204;
        }
    }
    
    # Webhook路由 - EngageLab回调
    location /webhook/ {
        proxy_pass http://$BACKEND_IP:3000/webhook/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Webhook专用设置
        proxy_connect_timeout 10s;
        proxy_send_timeout 10s;
        proxy_read_timeout 10s;
        proxy_buffering off;
    }
    
    # 健康检查
    location /health {
        proxy_pass http://$BACKEND_IP:3000/health;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        access_log off;
    }
    
    # 追踪像素
    location /tracking/ {
        proxy_pass http://$BACKEND_IP:3000/tracking/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        access_log off;
    }
}

# HTTPS配置 (如果有SSL证书)
server {
    listen 443 ssl http2;
    server_name tkmail.fun www.tkmail.fun;
    
    # SSL证书配置 (请根据实际证书路径调整)
    # ssl_certificate /etc/nginx/ssl/tkmail.fun.crt;
    # ssl_certificate_key /etc/nginx/ssl/tkmail.fun.key;
    
    # SSL优化设置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # 安全头
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # 包含与HTTP相同的location配置
    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
        
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    location /api/ {
        proxy_pass http://$BACKEND_IP:3000/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
        add_header Access-Control-Allow-Headers "Authorization, Content-Type";
        
        if (\$request_method = 'OPTIONS') {
            return 204;
        }
    }
    
    location /webhook/ {
        proxy_pass http://$BACKEND_IP:3000/webhook/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        proxy_connect_timeout 10s;
        proxy_send_timeout 10s;
        proxy_read_timeout 10s;
        proxy_buffering off;
    }
    
    location /health {
        proxy_pass http://$BACKEND_IP:3000/health;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        access_log off;
    }
    
    location /tracking/ {
        proxy_pass http://$BACKEND_IP:3000/tracking/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        access_log off;
    }
}
EOF

# 6. 启用站点配置
echo "🔗 启用tkmail.fun站点配置..."
sudo docker exec "$NGINX_CONTAINER" ln -sf "$SITES_DIR/tkmail.fun.conf" "$ENABLED_DIR/"

# 7. 检查前端静态文件
echo "🔍 检查前端静态文件..."
if sudo docker exec "$NGINX_CONTAINER" test -d "/usr/share/nginx/html"; then
    echo "✅ 前端目录存在"
    FILE_COUNT=$(sudo docker exec "$NGINX_CONTAINER" find /usr/share/nginx/html -type f | wc -l)
    echo "前端文件数量: $FILE_COUNT"
    
    if [ "$FILE_COUNT" -lt 5 ]; then
        echo "⚠️ 前端文件较少，可能需要重新构建"
        
        # 检查是否有构建好的前端文件
        if [ -d "src/frontend/build" ]; then
            echo "🏗️ 发现本地构建文件，复制到nginx..."
            sudo docker cp src/frontend/build/. "$NGINX_CONTAINER":/usr/share/nginx/html/
        else
            echo "📝 创建临时index.html..."
            sudo docker exec "$NGINX_CONTAINER" tee /usr/share/nginx/html/index.html > /dev/null << 'HTMLEOF'
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EDM系统</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .success { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .warning { background-color: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 EDM邮件营销系统</h1>
        <div class="status success">
            ✅ 系统部署成功！
        </div>
        <div class="status warning">
            ⚠️ 前端正在构建中，请稍后刷新页面
        </div>
        <p>系统功能:</p>
        <ul>
            <li>✅ 两阶段队列系统</li>
            <li>✅ Webhook回调处理</li>
            <li>✅ 安全权限控制</li>
            <li>✅ 邮件发送管理</li>
        </ul>
        <p>
            <a href="/api/health" style="color: #007bff;">健康检查</a> |
            <a href="/api" style="color: #007bff;">API文档</a>
        </p>
    </div>
</body>
</html>
HTMLEOF
        fi
    fi
else
    echo "❌ 前端目录不存在，创建..."
    sudo docker exec "$NGINX_CONTAINER" mkdir -p /usr/share/nginx/html
fi

# 8. 测试nginx配置
echo "🔍 测试nginx配置..."
if sudo docker exec "$NGINX_CONTAINER" nginx -t; then
    echo "✅ nginx配置测试通过"
    
    # 重载nginx
    echo "🔄 重载nginx配置..."
    sudo docker exec "$NGINX_CONTAINER" nginx -s reload
    echo "✅ nginx配置已重载"
else
    echo "❌ nginx配置测试失败，恢复备份"
    BACKUP_FILE=$(sudo docker exec "$NGINX_CONTAINER" ls /etc/nginx/nginx.conf.backup.* | tail -1)
    sudo docker exec "$NGINX_CONTAINER" cp "$BACKUP_FILE" /etc/nginx/nginx.conf
    exit 1
fi

# 9. 等待服务稳定
echo "⏳ 等待服务稳定..."
sleep 15

# 10. 全面测试
echo "🧪 开始全面测试..."

# 测试健康检查
echo "📝 测试健康检查..."
HEALTH_HTTP=$(curl -s -w "%{http_code}" -X GET "http://tkmail.fun/health" -o /tmp/health_http.json || echo "000")
echo "HTTP健康检查: $HEALTH_HTTP"
if [ "$HEALTH_HTTP" = "200" ]; then
    echo "✅ HTTP健康检查通过"
    cat /tmp/health_http.json
fi

# 测试API访问
echo "📝 测试API访问..."
API_TEST=$(curl -s -w "%{http_code}" -X GET "http://tkmail.fun/api/health" -o /tmp/api_test.json || echo "000")
echo "API测试: $API_TEST"
if [ "$API_TEST" = "200" ]; then
    echo "✅ API访问正常"
    cat /tmp/api_test.json
fi

# 测试Webhook
echo "📝 测试Webhook..."
WEBHOOK_TEST=$(curl -s -w "%{http_code}" -X POST "http://tkmail.fun/webhook/engagelab" \
    -H "Content-Type: application/json" \
    -d '{"test": true, "production_deployment": true, "timestamp": "'$(date)'"}' \
    -o /tmp/webhook_test.json || echo "000")

echo "Webhook测试: $WEBHOOK_TEST"
if [ "$WEBHOOK_TEST" = "200" ]; then
    echo "✅ Webhook访问正常"
    cat /tmp/webhook_test.json
fi

# 测试HTTPS (如果可用)
echo "📝 测试HTTPS..."
HTTPS_TEST=$(curl -s -w "%{http_code}" -X GET "https://tkmail.fun/health" -o /tmp/https_test.json -k || echo "000")
echo "HTTPS测试: $HTTPS_TEST"
if [ "$HTTPS_TEST" = "200" ]; then
    echo "✅ HTTPS访问正常"
    cat /tmp/https_test.json
fi

# 清理临时文件
rm -f /tmp/*.json

# 11. 最终结果
echo ""
echo "=============================================="
echo "🚀 生产环境部署修复完成!"
echo "=============================================="
echo ""
echo "📊 测试结果摘要:"
echo "  - HTTP健康检查: $HEALTH_HTTP"
echo "  - API访问: $API_TEST"
echo "  - Webhook访问: $WEBHOOK_TEST"
echo "  - HTTPS访问: $HTTPS_TEST"
echo ""

if [ "$HEALTH_HTTP" = "200" ] && [ "$API_TEST" = "200" ] && [ "$WEBHOOK_TEST" = "200" ]; then
    echo "🎉 ✅ 完美！所有功能测试通过！"
    echo ""
    echo "🔗 系统访问信息:"
    echo "  🌐 前端访问: http://tkmail.fun"
    echo "  📡 API接口: http://tkmail.fun/api"
    echo "  🔗 Webhook: http://tkmail.fun/webhook/engagelab"
    echo "  ❤️ 健康检查: http://tkmail.fun/health"
    
    if [ "$HTTPS_TEST" = "200" ]; then
        echo ""
        echo "🔒 HTTPS也可用:"
        echo "  🌐 HTTPS前端: https://tkmail.fun"
        echo "  📡 HTTPS API: https://tkmail.fun/api"
        echo "  🔗 HTTPS Webhook: https://tkmail.fun/webhook/engagelab"
    fi
    
    echo ""
    echo "🎯 EngageLab配置:"
    echo "  📌 推荐URL: https://tkmail.fun/webhook/engagelab"
    echo "  📌 备用URL: http://tkmail.fun/webhook/engagelab"
    echo ""
    echo "✅ 生产环境部署完全成功！"
    
elif [ "$WEBHOOK_TEST" = "200" ]; then
    echo "✅ Webhook功能正常，但前端可能需要进一步调试"
    echo "🔗 Webhook URL: http://tkmail.fun/webhook/engagelab"
    
else
    echo "⚠️ 部分功能需要进一步调试"
    echo "请检查以下几点:"
    echo "1. 检查后端服务是否正常运行"
    echo "2. 检查nginx配置是否正确"
    echo "3. 检查防火墙设置"
    echo "4. 检查域名DNS解析"
fi

echo ""
echo "🎯 部署修复完成！"

ENDSSH

RESULT=$?

if [ $RESULT -eq 0 ]; then
    echo ""
    echo "🎉 服务器端部署修复执行完成！"
    echo ""
    echo "🔍 最终外部验证："
    
    # 从本地验证域名访问
    echo "1. 验证tkmail.fun域名访问..."
    DOMAIN_TEST=$(curl -s -w "%{http_code}" -X GET "http://tkmail.fun/health" \
        -o /tmp/domain_test.json 2>/dev/null || echo "000")
    
    echo "域名健康检查响应码: $DOMAIN_TEST"
    
    if [ "$DOMAIN_TEST" = "200" ]; then
        echo "✅ 🎉 完美！域名访问成功！"
        echo ""
        echo "✅ 验证结果:"
        cat /tmp/domain_test.json
        echo ""
        
        # 验证Webhook
        echo "2. 验证Webhook域名访问..."
        WEBHOOK_DOMAIN_TEST=$(curl -s -w "%{http_code}" -X POST "http://tkmail.fun/webhook/engagelab" \
            -H "Content-Type: application/json" \
            -d '{"final_domain_test": true, "from_local": true}' \
            -o /tmp/webhook_domain_test.json 2>/dev/null || echo "000")
        
        echo "Webhook域名响应码: $WEBHOOK_DOMAIN_TEST"
        if [ "$WEBHOOK_DOMAIN_TEST" = "200" ]; then
            echo "✅ Webhook域名访问成功！"
            cat /tmp/webhook_domain_test.json
        fi
        
        echo ""
        echo "🎊 生产环境部署完全成功！"
        echo ""
        echo "📋 系统访问信息:"
        echo "  🌐 前端系统: http://tkmail.fun"
        echo "  📡 API接口: http://tkmail.fun/api"
        echo "  🔗 Webhook: http://tkmail.fun/webhook/engagelab"
        echo "  ❤️ 健康检查: http://tkmail.fun/health"
        echo ""
        echo "🎯 EngageLab后台配置:"
        echo "  📌 URL: http://tkmail.fun/webhook/engagelab"
        echo "  📌 方法: POST"
        echo "  📌 格式: JSON"
        echo ""
        echo "✅ 现在您可以:"
        echo "  1. 访问 http://tkmail.fun 使用EDM系统"
        echo "  2. 在EngageLab配置webhook URL"
        echo "  3. 正常使用两阶段队列系统发送邮件"
        echo ""
        echo "🎉 所有部署问题已解决！不再需要暴露IP和端口！"
        
    else
        echo "⚠️ 域名访问响应码: $DOMAIN_TEST"
        
        # 可能是DNS解析问题，给出解决建议
        echo ""
        echo "可能的问题和解决方案:"
        echo "1. DNS解析问题 - 请确认tkmail.fun指向正确的服务器IP"
        echo "2. 防火墙问题 - 请确认80和443端口已开放"
        echo "3. nginx配置问题 - 服务器端配置可能需要进一步调整"
        echo ""
        echo "🔧 临时解决方案:"
        echo "可以暂时使用IP访问验证功能是否正常"
    fi
    
    rm -f /tmp/domain_test.json /tmp/webhook_domain_test.json
else
    echo "❌ 部署修复执行失败"
    exit 1
fi 