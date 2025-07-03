#!/bin/bash

# 🚀 最终nginx配置修复脚本
# 使用文件方式避免heredoc问题

set -e

SERVER_IP="43.135.38.15"
SERVER_USER="ubuntu"
SERVER_PASS="Tony1231!"

echo "🚀 开始最终nginx修复..."
echo "📅 修复时间: $(date)"

# 在本地创建nginx配置文件
echo "📝 创建本地nginx配置文件..."
cat > /tmp/nginx-edm.conf << 'INNER_EOF'
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
    client_max_body_size 50M;
    
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
    
    server {
        listen 80;
        server_name tkmail.fun www.tkmail.fun;
        
        add_header X-Frame-Options DENY always;
        add_header X-Content-Type-Options nosniff always;
        add_header X-XSS-Protection "1; mode=block" always;
        
        location = /health {
            proxy_pass http://BACKEND_IP_REPLACE:3000/health;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 10s;
            proxy_send_timeout 10s;
            proxy_read_timeout 10s;
            access_log off;
        }
        
        location /api/ {
            proxy_pass http://BACKEND_IP_REPLACE:3000/api/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
            
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
        
        location /webhook/ {
            proxy_pass http://BACKEND_IP_REPLACE:3000/webhook/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 5s;
            proxy_send_timeout 5s;
            proxy_read_timeout 5s;
            proxy_buffering off;
        }
        
        location /tracking/ {
            proxy_pass http://BACKEND_IP_REPLACE:3000/tracking/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            access_log off;
        }
        
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
INNER_EOF

echo "✅ 本地配置文件创建完成"

# 上传到服务器并执行修复
echo "🚀 开始服务器端部署..."

# 上传配置文件
echo "📤 上传nginx配置文件..."
sshpass -p "$SERVER_PASS" scp -o StrictHostKeyChecking=no /tmp/nginx-edm.conf "$SERVER_USER@$SERVER_IP:/tmp/"

# 服务器端操作
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" << 'ENDSSH'
#!/bin/bash
set -e

echo "🔧 服务器端开始修复..."

# 获取容器信息
NGINX_CONTAINER=$(sudo docker ps --format "{{.Names}}" | grep nginx | head -1)
BACKEND_CONTAINER=$(sudo docker ps --format "{{.Names}}" | grep backend | head -1)
BACKEND_IP=$(sudo docker inspect $BACKEND_CONTAINER --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null || echo "172.18.0.4")

echo "Nginx容器: $NGINX_CONTAINER"
echo "Backend容器: $BACKEND_CONTAINER"  
echo "Backend IP: $BACKEND_IP"

echo "�� 处理配置文件..."
# 替换后端IP
sed -i "s/BACKEND_IP_REPLACE/$BACKEND_IP/g" /tmp/nginx-edm.conf

echo "📁 部署nginx配置..."
sudo docker cp /tmp/nginx-edm.conf "$NGINX_CONTAINER":/etc/nginx/nginx.conf

# 创建简单前端页面
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
        ul { text-align: left; max-width: 450px; margin: 20px auto; }
        li { margin: 10px 0; }
        .links { margin-top: 30px; }
        .links a { 
            color: #007bff; 
            text-decoration: none; 
            margin: 0 10px;
            padding: 10px 20px;
            border: 2px solid #007bff;
            border-radius: 5px;
            display: inline-block;
            transition: all 0.3s;
        }
        .links a:hover { 
            background: #007bff; 
            color: white; 
        }
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
        
        <h3>🎯 核心功能</h3>
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
            <a href="javascript:location.reload()">🔄 刷新</a>
        </div>
    </div>
    
    <script>
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
                .catch(err => console.log("API检查:", err));
        }, 2000);
    </script>
</body>
</html>
EOF'

echo "🔍 验证nginx配置..."
if sudo docker exec "$NGINX_CONTAINER" nginx -t; then
    echo "✅ nginx配置验证通过"
    
    echo "🔄 重载nginx..."
    sudo docker exec "$NGINX_CONTAINER" nginx -s reload
    echo "✅ nginx重载完成"
    
    echo "⏳ 等待服务稳定..."
    sleep 5
    
    echo "🧪 测试系统功能..."
    
    # 测试功能
    HEALTH_CODE=$(curl -s -w "%{http_code}" -H "Host: tkmail.fun" "http://localhost/health" -o /dev/null || echo "000")
    API_CODE=$(curl -s -w "%{http_code}" -H "Host: tkmail.fun" "http://localhost/api/health" -o /dev/null || echo "000")
    WEBHOOK_CODE=$(curl -s -w "%{http_code}" -H "Host: tkmail.fun" -X POST "http://localhost/webhook/engagelab" -H "Content-Type: application/json" -d '{"test": true}' -o /dev/null || echo "000")
    
    echo ""
    echo "=============================================="
    echo "🎯 部署完成！"
    echo "=============================================="
    echo ""
    echo "📊 测试结果:"
    echo "  🔍 健康检查: $HEALTH_CODE"
    echo "  📡 API访问: $API_CODE"
    echo "  🔗 Webhook: $WEBHOOK_CODE"
    echo ""
    
    if [ "$HEALTH_CODE" = "200" ] && [ "$API_CODE" = "200" ] && [ "$WEBHOOK_CODE" = "200" ]; then
        echo "🎉 ✅ 完美！所有功能正常！"
        echo ""
        echo "🌐 系统访问:"
        echo "  📱 前端: http://tkmail.fun"
        echo "  📡 API: http://tkmail.fun/api"
        echo "  🔗 Webhook: http://tkmail.fun/webhook/engagelab"
        echo ""
        echo "✅ 修复成功！"
    else
        echo "⚠️ 部分功能可能需要调试"
    fi
    
    # 清理
    rm -f /tmp/nginx-edm.conf
    
else
    echo "❌ nginx配置验证失败"
    sudo docker exec "$NGINX_CONTAINER" nginx -t
    exit 1
fi

ENDSSH

RESULT=$?

if [ $RESULT -eq 0 ]; then
    echo ""
    echo "🔍 最终验证..."
    
    # 外部验证
    FINAL_TEST=$(curl -s -w "%{http_code}" "http://tkmail.fun/health" -o /dev/null || echo "000")
    echo "域名测试: $FINAL_TEST"
    
    if [ "$FINAL_TEST" = "200" ]; then
        echo ""
        echo "🎊🎊🎊 大功告成！🎊🎊��"
        echo ""
        echo "🎯 EDM系统完全可用："
        echo "  🌐 访问地址: http://tkmail.fun"
        echo "  📡 API服务: http://tkmail.fun/api"
        echo "  🔗 Webhook: http://tkmail.fun/webhook/engagelab"
        echo ""
        echo "🎯 EngageLab配置："
        echo "  📌 URL: http://tkmail.fun/webhook/engagelab"
        echo "  📌 方法: POST"
        echo "  📌 格式: JSON"
        echo ""
        echo "✅ 现在可以："
        echo "  1. 🌐 访问 http://tkmail.fun 使用系统"
        echo "  2. 🔧 在EngageLab配置webhook"
        echo "  3. 📧 正常发送邮件"
        echo ""
        echo "🎉 不再需要暴露IP和端口！"
    else
        echo "⚠️ 域名访问状态: $FINAL_TEST"
    fi
else
    echo "❌ 部署失败"
    exit 1
fi

# 清理本地文件
rm -f /tmp/nginx-edm.conf

echo "🎯 任务完成！"
