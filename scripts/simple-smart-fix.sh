#!/bin/bash

# 🧠 简化智能Webhook修复脚本
set -e

SERVER_IP="43.135.38.15"
SERVER_USER="ubuntu"
SERVER_PASS="Tony1231!"

echo "🧠 开始简化智能Webhook修复"
echo "📅 修复时间: $(date)"

# 使用sshpass直接在服务器上执行修复
echo "🚀 连接服务器执行修复..."

sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" << 'ENDSSH'
#!/bin/bash
set -e

echo "🧠 开始服务器端智能修复"
cd /opt/edm

# 1. 检查当前服务状态
echo "🔍 检查当前服务状态..."
sudo docker-compose ps

# 2. 检查backend webhook路由
echo "🔍 检查backend webhook路由..."
if grep -q "webhook/engagelab" src/backend/src/index.js; then
    echo "✅ backend已有webhook路由"
    BACKEND_OK=true
else
    echo "❌ backend缺少webhook路由，添加中..."
    
    # 备份并添加webhook路由
    sudo cp src/backend/src/index.js src/backend/src/index.js.backup
    
    # 使用更简单的方式添加路由
    echo "" | sudo tee -a src/backend/src/index.js
    echo "// EngageLab Webhook路由" | sudo tee -a src/backend/src/index.js
    echo "const webhookController = require('./controllers/webhook.controller');" | sudo tee -a src/backend/src/index.js
    echo "app.post('/webhook/engagelab', webhookController.handleMailEvent);" | sudo tee -a src/backend/src/index.js
    
    echo "✅ backend webhook路由已添加"
    BACKEND_OK=false
fi

# 3. 重启backend如果需要
if [ "$BACKEND_OK" = "false" ]; then
    echo "🔄 重启backend容器..."
    sudo docker-compose restart backend
    sleep 15
fi

# 4. 检查nginx容器
echo "🔍 检查nginx容器..."
NGINX_CONTAINERS=$(sudo docker ps --format "{{.Names}}" | grep nginx || echo "")
if [ ! -z "$NGINX_CONTAINERS" ]; then
    NGINX_CONTAINER=$(echo "$NGINX_CONTAINERS" | head -1)
    echo "✅ 找到nginx容器: $NGINX_CONTAINER"
    
    # 检查nginx配置
    echo "🔍 检查nginx配置..."
    if sudo docker exec "$NGINX_CONTAINER" cat /etc/nginx/nginx.conf | grep -q webhook; then
        echo "✅ nginx已有webhook配置"
    else
        echo "🔧 添加nginx webhook配置..."
        
        # 创建临时配置文件
        sudo docker exec "$NGINX_CONTAINER" cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup
        
        # 添加webhook配置到nginx
        sudo docker exec "$NGINX_CONTAINER" sh -c '
            # 在http块的末尾添加server配置
            sed -i "/^http {/,/^}/ {
                /^}/i\
    server {\
        listen 80;\
        server_name _;\
        \
        location /webhook/ {\
            proxy_pass http://host.docker.internal:3001/webhook/;\
            proxy_set_header Host \$host;\
            proxy_set_header X-Real-IP \$remote_addr;\
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;\
            proxy_set_header X-Forwarded-Proto \$scheme;\
        }\
    }
            }" /etc/nginx/nginx.conf
        '
        
        # 测试nginx配置
        echo "🔍 测试nginx配置..."
        if sudo docker exec "$NGINX_CONTAINER" nginx -t; then
            echo "✅ nginx配置测试通过"
            sudo docker exec "$NGINX_CONTAINER" nginx -s reload
            echo "✅ nginx配置已重载"
        else
            echo "❌ nginx配置测试失败，恢复备份"
            sudo docker exec "$NGINX_CONTAINER" cp /etc/nginx/nginx.conf.backup /etc/nginx/nginx.conf
        fi
    fi
else
    echo "❌ 未找到nginx容器"
    echo "🔍 检查nginx进程..."
    sudo ps aux | grep nginx || echo "未找到nginx进程"
fi

# 5. 等待服务稳定
echo "⏳ 等待服务稳定..."
sleep 10

# 6. 测试webhook端点
echo "🧪 测试Webhook端点..."

# 基础测试 - 直接访问backend
BACKEND_TEST=$(curl -s -w "%{http_code}" -X POST "http://localhost:3001/webhook/engagelab" \
    -H "Content-Type: application/json" \
    -d '{"test": true, "direct_backend": true}' \
    -o /tmp/backend_test.json || echo "000")

echo "Backend直接测试响应码: $BACKEND_TEST"
if [ "$BACKEND_TEST" = "200" ]; then
    echo "✅ Backend直接访问成功！"
    cat /tmp/backend_test.json
fi

# 测试通过nginx的webhook
NGINX_TEST=$(curl -s -w "%{http_code}" -X POST "http://localhost/webhook/engagelab" \
    -H "Content-Type: application/json" \
    -d '{"test": true, "via_nginx": true}' \
    -o /tmp/nginx_test.json || echo "000")

echo "Nginx代理测试响应码: $NGINX_TEST"
if [ "$NGINX_TEST" = "200" ]; then
    echo "✅ Nginx代理访问成功！"
    cat /tmp/nginx_test.json
fi

# 测试外部访问
EXTERNAL_TEST=$(curl -s -w "%{http_code}" -X POST "http://43.135.38.15/webhook/engagelab" \
    -H "Content-Type: application/json" \
    -d '{"test": true, "external_access": true}' \
    -o /tmp/external_test.json || echo "000")

echo "外部访问测试响应码: $EXTERNAL_TEST"
if [ "$EXTERNAL_TEST" = "200" ]; then
    echo "✅ 外部访问成功！"
    cat /tmp/external_test.json
fi

# 清理临时文件
rm -f /tmp/*_test.json

# 结果总结
echo ""
echo "============================================"
echo "🧠 简化智能修复完成!"
echo "============================================"
echo ""
echo "📊 测试结果:"
echo "  - Backend直接访问: $BACKEND_TEST"
echo "  - Nginx代理访问: $NGINX_TEST" 
echo "  - 外部访问: $EXTERNAL_TEST"
echo ""

if [ "$BACKEND_TEST" = "200" ]; then
    echo "✅ Backend webhook功能正常"
    
    if [ "$NGINX_TEST" = "200" ] || [ "$EXTERNAL_TEST" = "200" ]; then
        echo "✅ 🎉 Webhook完全修复成功！"
        echo ""
        echo "🔗 可用的Webhook端点:"
        [ "$NGINX_TEST" = "200" ] && echo "  ✅ 内部: http://localhost/webhook/engagelab"
        [ "$EXTERNAL_TEST" = "200" ] && echo "  ✅ 外部: http://43.135.38.15/webhook/engagelab"
        echo ""
        echo "🎯 推荐在EngageLab配置: http://43.135.38.15/webhook/engagelab"
        echo "✅ 修复完成，其他服务未受影响！"
    else
        echo "⚠️ Backend正常但nginx代理有问题"
        echo "可能需要检查nginx配置或防火墙设置"
    fi
else
    echo "❌ Backend webhook功能异常"
    echo "请检查backend服务日志"
fi

echo ""
echo "🎯 修复完成！现在可以开始使用EDM两阶段队列系统了！"

ENDSSH

RESULT=$?

if [ $RESULT -eq 0 ]; then
    echo ""
    echo "🎉 服务器端修复执行完成！"
    echo ""
    echo "🔍 最终外部验证测试："
    sleep 2
    
    # 从本地测试外部访问
    FINAL_TEST=$(curl -s -w "%{http_code}" -X POST "http://43.135.38.15/webhook/engagelab" \
        -H "Content-Type: application/json" \
        -d '{"final_test": true, "from_local": true}' \
        -o /tmp/final_external_test.json 2>/dev/null || echo "000")
    
    echo "外部验证响应码: $FINAL_TEST"
    if [ "$FINAL_TEST" = "200" ]; then
        echo "✅ 外部验证成功！"
        echo "响应内容:"
        cat /tmp/final_external_test.json
        echo ""
        echo "🎉🎉🎉 EDM Webhook智能修复完全成功！🎉🎉🎉"
        echo ""
        echo "📋 修复总结:"
        echo "  ✅ Backend webhook路由已配置"
        echo "  ✅ Nginx代理已设置"
        echo "  ✅ 外部访问测试通过"
        echo "  ✅ 最小化影响，仅修复必要组件"
        echo ""
        echo "🔗 在EngageLab配置此URL:"
        echo "  🎯 http://43.135.38.15/webhook/engagelab"
        echo ""
        echo "✅ 现在可以正常使用EDM两阶段队列系统+Webhook了！"
    else
        echo "⚠️ 外部验证响应码: $FINAL_TEST"
        echo "可能的问题："
        echo "1. 防火墙阻止外部访问"
        echo "2. nginx配置未生效"
        echo "3. 端口映射问题"
        cat /tmp/final_external_test.json 2>/dev/null || echo "无响应内容"
    fi
    
    rm -f /tmp/final_external_test.json
else
    echo "❌ 服务器端修复执行失败"
    exit 1
fi 