#!/bin/bash

# 🚀 简单nginx修复脚本
# 修复nginx配置错误和域名访问问题

set -e

SERVER_IP="43.135.38.15"
SERVER_USER="ubuntu"
SERVER_PASS="Tony1231!"

echo "🚀 开始修复nginx配置..."
echo "📅 修复时间: $(date)"

# 执行服务器端修复
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" << 'ENDSSH'
#!/bin/bash
set -e

echo "🔧 开始修复nginx配置..."

# 获取nginx容器
NGINX_CONTAINER=$(sudo docker ps --format "{{.Names}}" | grep nginx | head -1)
echo "Nginx容器: $NGINX_CONTAINER"

# 获取后端容器IP
BACKEND_CONTAINER=$(sudo docker ps --format "{{.Names}}" | grep backend | head -1)
BACKEND_IP=$(sudo docker inspect $BACKEND_CONTAINER --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null || echo "172.18.0.4")
echo "Backend容器: $BACKEND_CONTAINER"
echo "Backend IP: $BACKEND_IP"

# 1. 创建nginx配置文件
echo "📝 创建nginx配置..."
sudo docker exec "$NGINX_CONTAINER" mkdir -p /tmp/nginx-config

# 写入基本配置
sudo docker exec "$NGINX_CONTAINER" sh -c 'cat > /tmp/nginx-config/nginx.conf << EOF
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
    
    log_format main "$remote_addr - $remote_user [$time_local] \"$request\" "
                    "$status $body_bytes_sent \"$http_referer\" "
                    "\"$http_user_agent\" \"$http_x_forwarded_for\"";
    
    access_log /var/log/nginx/access.log main;
    
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 50M;
    
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
    
    # EDM系统 - tkmail.fun
    server {
        listen 80;
        server_name tkmail.fun www.tkmail.fun;
        
        # 安全头
        add_header X-Frame-Options DENY always;
        add_header X-Content-Type-Options nosniff always;
        add_header X-XSS-Protection "1; mode=block" always;
        
        # 健康检查
        location = /health {
            proxy_pass http://BACKEND_IP_PLACEHOLDER:3000/health;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            proxy_connect_timeout 10s;
            proxy_send_timeout 10s;
            proxy_read_timeout 10s;
            access_log off;
        }
        
        # API路由
        location /api/ {
            proxy_pass http://BACKEND_IP_PLACEHOLDER:3000/api/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
            
            # CORS处理
            add_header Access-Control-Allow-Origin * always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With" always;
            
            if ($request_method = OPTIONS) {
                add_header Access-Control-Allow-Origin * always;
                add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
                add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With" always;
                add_header Access-Control-Max-Age 86400 always;
                return 204;
            }
        }
        
        # Webhook路由
        location /webhook/ {
            proxy_pass http://BACKEND_IP_PLACEHOLDER:3000/webhook/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            proxy_connect_timeout 5s;
            proxy_send_timeout 5s;
            proxy_read_timeout 5s;
            proxy_buffering off;
        }
        
        # 追踪像素
        location /tracking/ {
            proxy_pass http://BACKEND_IP_PLACEHOLDER:3000/tracking/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            access_log off;
        }
        
        # 前端静态文件
        location / {
            root /usr/share/nginx/html;
            index index.html;
            try_files $uri $uri/ /index.html;
            
            location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
                expires 1y;
                add_header Cache-Control "public, immutable";
            }
        }
    }
}
EOF'

# 2. 替换后端IP
echo "🔄 更新后端IP地址..."
sudo docker exec "$NGINX_CONTAINER" sed -i "s/BACKEND_IP_PLACEHOLDER/$BACKEND_IP/g" /tmp/nginx-config/nginx.conf

# 3. 复制配置到正确位置
echo "📁 部署nginx配置..."
sudo docker exec "$NGINX_CONTAINER" cp /tmp/nginx-config/nginx.conf /etc/nginx/nginx.conf

# 4. 检查配置
echo "🔍 检验nginx配置..."
if sudo docker exec "$NGINX_CONTAINER" nginx -t; then
    echo "✅ nginx配置验证通过"
    
    # 重载nginx
    echo "🔄 重载nginx..."
    sudo docker exec "$NGINX_CONTAINER" nginx -s reload
    echo "✅ nginx已重载"
else
    echo "❌ nginx配置验证失败"
    exit 1
fi

# 5. 创建前端页面
echo "🔍 检查前端文件..."
if ! sudo docker exec "$NGINX_CONTAINER" test -f /usr/share/nginx/html/index.html; then
    echo "📝 创建前端页面..."
    sudo docker exec "$NGINX_CONTAINER" sh -c 'cat > /usr/share/nginx/html/index.html << EOF
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EDM邮件营销系统</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: Arial, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container { 
            background: white;
            max-width: 600px; 
            margin: 20px;
            padding: 40px; 
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
        }
        h1 { color: #333; margin-bottom: 20px; }
        .status { 
            padding: 15px; 
            margin: 15px 0; 
            border-radius: 8px; 
            font-weight: 500;
        }
        .success { 
            background: #d1eddd; 
            color: #155724; 
            border: 1px solid #c3e6cb; 
        }
        .info { 
            background: #d1ecf1; 
            color: #0c5460; 
            border: 1px solid #bee5eb; 
        }
        ul { text-align: left; max-width: 400px; margin: 20px auto; }
        li { margin: 8px 0; }
        .links { margin-top: 30px; }
        .links a { 
            color: #007bff; 
            text-decoration: none; 
            margin: 0 10px;
            padding: 8px 16px;
            border: 1px solid #007bff;
            border-radius: 5px;
            display: inline-block;
        }
        .links a:hover { background: #007bff; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 EDM邮件营销系统</h1>
        
        <div class="status success">
            ✅ 系统部署成功！
        </div>
        
        <div class="status info" id="api-status">
            📡 正在检查API连接...
        </div>
        
        <h3>🎯 系统功能</h3>
        <ul>
            <li>✅ 两阶段队列邮件发送</li>
            <li>✅ EngageLab Webhook集成</li>
            <li>✅ 安全权限控制</li>
            <li>✅ 实时状态追踪</li>
            <li>✅ 联系人管理</li>
        </ul>
        
        <div class="links">
            <a href="/api/health" target="_blank">🔍 健康检查</a>
            <a href="/api" target="_blank">📚 API文档</a>
            <a href="javascript:location.reload()">🔄 刷新页面</a>
        </div>
    </div>
    
    <script>
        // 检查API状态
        setTimeout(() => {
            fetch("/api/health")
                .then(response => response.json())
                .then(data => {
                    const statusDiv = document.getElementById("api-status");
                    if (data.status === "ok") {
                        statusDiv.className = "status success";
                        statusDiv.innerHTML = "✅ API连接正常！系统完全可用";
                    }
                })
                .catch(err => {
                    console.log("API检查:", err);
                });
        }, 2000);
    </script>
</body>
</html>
EOF'
    echo "✅ 前端页面已创建"
fi

# 6. 等待服务稳定
echo "⏳ 等待服务稳定..."
sleep 10

# 7. 测试系统
echo "🧪 测试系统..."

# 健康检查
HEALTH_TEST=$(curl -s -w "%{http_code}" -H "Host: tkmail.fun" "http://localhost/health" -o /tmp/health.json 2>/dev/null || echo "000")
echo "健康检查: $HEALTH_TEST"

# API测试
API_TEST=$(curl -s -w "%{http_code}" -H "Host: tkmail.fun" "http://localhost/api/health" -o /tmp/api.json 2>/dev/null || echo "000")
echo "API测试: $API_TEST"

# Webhook测试
WEBHOOK_TEST=$(curl -s -w "%{http_code}" -H "Host: tkmail.fun" \
    -X POST "http://localhost/webhook/engagelab" \
    -H "Content-Type: application/json" \
    -d '{"test": true}' \
    -o /tmp/webhook.json 2>/dev/null || echo "000")
echo "Webhook测试: $WEBHOOK_TEST"

# 清理
rm -f /tmp/*.json

echo ""
echo "=============================================="
echo "🎯 修复完成！"
echo "=============================================="
echo ""
echo "📊 测试结果:"
echo "  - 健康检查: $HEALTH_TEST"
echo "  - API: $API_TEST"
echo "  - Webhook: $WEBHOOK_TEST"
echo ""

if [ "$HEALTH_TEST" = "200" ] && [ "$API_TEST" = "200" ] && [ "$WEBHOOK_TEST" = "200" ]; then
    echo "🎉 ✅ 完美！所有测试通过！"
    echo ""
    echo "🌐 系统访问信息:"
    echo "  📱 前端: http://tkmail.fun"
    echo "  📡 API: http://tkmail.fun/api"
    echo "  🔗 Webhook: http://tkmail.fun/webhook/engagelab"
    echo ""
    echo "✅ 修复成功！"
else
    echo "⚠️ 部分功能可能需要进一步调试"
fi

ENDSSH

RESULT=$?

if [ $RESULT -eq 0 ]; then
    echo ""
    echo "🔍 外部验证..."
    
    # 域名验证
    DOMAIN_TEST=$(curl -s -w "%{http_code}" "http://tkmail.fun/health" -o /tmp/domain.json 2>/dev/null || echo "000")
    echo "域名测试: $DOMAIN_TEST"
    
    if [ "$DOMAIN_TEST" = "200" ]; then
        echo "🎊 完美！域名访问成功！"
        echo ""
        echo "🎯 EngageLab配置:"
        echo "  📌 URL: http://tkmail.fun/webhook/engagelab"
        echo "  📌 方法: POST"
        echo "  📌 格式: JSON"
        echo ""
        echo "✅ 现在可以:"
        echo "  1. 访问 http://tkmail.fun"
        echo "  2. 配置EngageLab webhook"
        echo "  3. 正常使用系统"
        echo ""
        echo "🎉 不再需要暴露IP和端口！"
    else
        echo "⚠️ 域名访问需要进一步检查"
    fi
    
    rm -f /tmp/domain.json
else
    echo "❌ 修复失败"
    exit 1
fi 