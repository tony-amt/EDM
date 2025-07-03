#!/bin/bash

# 修复生产环境404问题的脚本
echo "🚨 修复生产环境404问题..."

SERVER="43.135.38.15"
USER="root"

echo "🔧 即将连接到生产服务器: $SERVER"
echo "📋 需要执行的修复步骤："
echo "1. 检查前端容器nginx配置"
echo "2. 更新nginx配置以支持SPA路由"  
echo "3. 重新加载nginx配置"
echo ""

# 创建修复命令
cat > /tmp/fix_commands.sh << 'EOF'
#!/bin/bash

echo "🔍 1. 检查前端容器状态..."
docker ps | grep frontend

echo ""
echo "📋 2. 检查当前nginx配置..."
docker exec edm-frontend-prod cat /etc/nginx/conf.d/default.conf

echo ""
echo "🔧 3. 更新nginx配置以支持React SPA路由..."
docker exec edm-frontend-prod sh -c '
cat > /etc/nginx/conf.d/default.conf << "NGINXEOF"
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html index.htm;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
NGINXEOF
'

echo ""
echo "🔄 4. 重新加载nginx配置..."
docker exec edm-frontend-prod nginx -s reload

echo ""
echo "🧪 5. 测试修复结果..."
echo "测试根路径:"
curl -I http://localhost/
echo ""
echo "测试/contacts路径:"  
curl -I http://localhost/contacts
echo ""
echo "测试/tags路径:"
curl -I http://localhost/tags

echo ""
echo "✅ 修复完成！请测试页面刷新功能"
EOF

echo "📁 修复命令已生成到 /tmp/fix_commands.sh"
echo ""
echo "🔑 请使用以下命令连接服务器并执行修复："
echo "scp /tmp/fix_commands.sh $USER@$SERVER:/tmp/"
echo "ssh $USER@$SERVER 'chmod +x /tmp/fix_commands.sh && /tmp/fix_commands.sh'"
echo ""
echo "或者手动连接："
echo "ssh $USER@$SERVER"
echo "然后复制粘贴修复命令执行" 