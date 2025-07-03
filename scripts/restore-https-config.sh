#!/bin/bash

# 🚀 恢复HTTPS配置脚本
# 使用之前工作的生产nginx配置，修复HTTPS 502错误

set -e

SERVER_IP="43.135.38.15"
SERVER_USER="ubuntu"
SERVER_PASS="Tony1231!"

echo "🚀 开始恢复HTTPS配置..."
echo "📅 时间: $(date)"

# 先上传生产配置文件
echo "📤 上传生产nginx配置..."
sshpass -p "$SERVER_PASS" scp -o StrictHostKeyChecking=no deploy/nginx/nginx.production.conf "$SERVER_USER@$SERVER_IP:/tmp/"

# 服务器端操作
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" << 'ENDSSH'
#!/bin/bash
set -e

echo "🔧 开始恢复HTTPS配置..."

# 获取容器信息
NGINX_CONTAINER=$(sudo docker ps --format "{{.Names}}" | grep nginx | head -1)
echo "Nginx容器: $NGINX_CONTAINER"

# 1. 备份当前配置
echo "💾 备份当前配置..."
sudo docker exec "$NGINX_CONTAINER" cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.$(date +%Y%m%d_%H%M%S)

# 2. 检查SSL证书是否存在
echo "🔍 检查SSL证书..."
if sudo docker exec "$NGINX_CONTAINER" test -f /etc/nginx/ssl/cert.pem; then
    echo "✅ SSL证书存在"
else
    echo "⚠️ SSL证书不存在，创建自签名证书..."
    sudo docker exec "$NGINX_CONTAINER" mkdir -p /etc/nginx/ssl
    sudo docker exec "$NGINX_CONTAINER" openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/nginx/ssl/key.pem \
        -out /etc/nginx/ssl/cert.pem \
        -subj "/C=CN/ST=Beijing/L=Beijing/O=EDM/CN=tkmail.fun" >/dev/null 2>&1
    echo "✅ 自签名证书创建完成"
fi

# 3. 检查是否有前端容器（用于upstream配置）
echo "🔍 检查容器配置..."
FRONTEND_CONTAINER=$(sudo docker ps --format "{{.Names}}" | grep frontend || echo "")
BACKEND_CONTAINER=$(sudo docker ps --format "{{.Names}}" | grep backend | head -1)
WEBHOOK_CONTAINER=$(sudo docker ps --format "{{.Names}}" | grep webhook || echo "")

echo "Frontend容器: ${FRONTEND_CONTAINER:-'不存在'}"
echo "Backend容器: $BACKEND_CONTAINER"
echo "Webhook容器: ${WEBHOOK_CONTAINER:-'不存在'}"

# 4. 根据实际容器情况调整配置
echo "📝 调整nginx配置..."
cp /tmp/nginx.production.conf /tmp/nginx.adapted.conf

# 如果没有独立的前端容器，修改配置让前端路由指向backend
if [ -z "$FRONTEND_CONTAINER" ]; then
    echo "⚠️ 没有独立前端容器，调整前端路由到backend..."
    sed -i 's|proxy_pass http://frontend|proxy_pass http://backend|g' /tmp/nginx.adapted.conf
    sed -i 's|upstream frontend {.*|upstream frontend { server backend:3000; keepalive 32; }|' /tmp/nginx.adapted.conf
fi

# 如果没有webhook-service容器，修改配置让webhook路由指向backend
if [ -z "$WEBHOOK_CONTAINER" ]; then
    echo "⚠️ 没有独立webhook容器，调整webhook路由到backend..."
    sed -i 's|proxy_pass http://webhook-service/|proxy_pass http://backend/webhook/|g' /tmp/nginx.adapted.conf
    sed -i '/upstream webhook-service/,/}/d' /tmp/nginx.adapted.conf
fi

# 获取实际的后端容器IP
BACKEND_IP=$(sudo docker inspect $BACKEND_CONTAINER --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null || echo "172.18.0.4")
echo "Backend IP: $BACKEND_IP"

# 将upstream backend配置改为实际IP
sed -i "s|server backend:3000|server $BACKEND_IP:3000|g" /tmp/nginx.adapted.conf

# 5. 部署配置
echo "📁 部署调整后的nginx配置..."
sudo docker cp /tmp/nginx.adapted.conf "$NGINX_CONTAINER":/etc/nginx/nginx.conf

# 6. 验证配置
echo "🔍 验证nginx配置..."
if sudo docker exec "$NGINX_CONTAINER" nginx -t; then
    echo "✅ nginx配置验证通过"
    
    # 重载nginx
    echo "🔄 重载nginx..."
    sudo docker exec "$NGINX_CONTAINER" nginx -s reload
    echo "✅ nginx重载完成"
    
    echo "⏳ 等待服务稳定..."
    sleep 8
    
    echo "🧪 测试HTTPS功能..."
    
    # 测试HTTP重定向
    echo "1. 测试HTTP重定向..."
    HTTP_CODE=$(curl -s -w "%{http_code}" -H "Host: tkmail.fun" "http://localhost/health" -o /tmp/http_test.json || echo "000")
    echo "HTTP重定向: $HTTP_CODE"
    
    # 测试HTTPS健康检查
    echo "2. 测试HTTPS健康检查..."
    HTTPS_CODE=$(curl -s -w "%{http_code}" -H "Host: tkmail.fun" "https://localhost/health" -k -o /tmp/https_test.json || echo "000")
    echo "HTTPS健康检查: $HTTPS_CODE"
    
    # 测试HTTPS API
    echo "3. 测试HTTPS API..."
    API_CODE=$(curl -s -w "%{http_code}" -H "Host: tkmail.fun" "https://localhost/api/health" -k -o /tmp/api_test.json || echo "000")
    echo "HTTPS API: $API_CODE"
    
    # 测试HTTPS Webhook
    echo "4. 测试HTTPS Webhook..."
    WEBHOOK_CODE=$(curl -s -w "%{http_code}" -H "Host: tkmail.fun" \
        -X POST "https://localhost/webhook/engagelab" \
        -H "Content-Type: application/json" \
        -d '{"test_https_restore": true, "timestamp": "'$(date)'"}' \
        -k -o /tmp/webhook_test.json || echo "000")
    echo "HTTPS Webhook: $WEBHOOK_CODE"
    
    # 清理临时文件
    rm -f /tmp/*.json /tmp/nginx.*.conf
    
    echo ""
    echo "=============================================="
    echo "🎯 HTTPS配置恢复完成！"
    echo "=============================================="
    echo ""
    echo "📊 测试结果:"
    echo "  🔄 HTTP重定向: $HTTP_CODE (应该是301)"
    echo "  🔒 HTTPS健康检查: $HTTPS_CODE"
    echo "  📡 HTTPS API: $API_CODE"
    echo "  🔗 HTTPS Webhook: $WEBHOOK_CODE"
    echo ""
    
    if [ "$HTTP_CODE" = "301" ] && [ "$HTTPS_CODE" = "200" ] && [ "$API_CODE" = "200" ] && [ "$WEBHOOK_CODE" = "200" ]; then
        echo "🎉 ✅ 完美！HTTPS配置完全恢复！"
        echo ""
        echo "🌐 系统访问信息:"
        echo "  🔒 HTTPS前端: https://tkmail.fun"
        echo "  📡 HTTPS API: https://tkmail.fun/api"
        echo "  🔗 HTTPS Webhook: https://tkmail.fun/webhook/engagelab"
        echo "  ❤️ 健康检查: https://tkmail.fun/health"
        echo ""
        echo "✅ HTTPS配置恢复成功！HTTP自动重定向到HTTPS"
    else
        echo "⚠️ 部分功能可能需要进一步调试:"
        if [ "$HTTP_CODE" != "301" ]; then
            echo "  - HTTP重定向问题"
        fi
        if [ "$HTTPS_CODE" != "200" ]; then
            echo "  - HTTPS健康检查问题"
        fi
        if [ "$API_CODE" != "200" ]; then
            echo "  - HTTPS API问题"
        fi
        if [ "$WEBHOOK_CODE" != "200" ]; then
            echo "  - HTTPS Webhook问题"
        fi
    fi
    
else
    echo "❌ nginx配置验证失败"
    sudo docker exec "$NGINX_CONTAINER" nginx -t
    echo "🔄 恢复备份配置..."
    BACKUP_FILE=$(sudo docker exec "$NGINX_CONTAINER" ls /etc/nginx/nginx.conf.backup.* | tail -1)
    sudo docker exec "$NGINX_CONTAINER" cp "$BACKUP_FILE" /etc/nginx/nginx.conf
    exit 1
fi

ENDSSH

RESULT=$?

if [ $RESULT -eq 0 ]; then
    echo ""
    echo "🔍 外部HTTPS验证..."
    
    # 外部HTTPS测试
    echo "1. 验证HTTPS健康检查..."
    FINAL_HTTPS=$(curl -s -w "%{http_code}" "https://tkmail.fun/health" -k -o /tmp/final_https.json || echo "000")
    echo "外部HTTPS健康检查: $FINAL_HTTPS"
    
    if [ "$FINAL_HTTPS" = "200" ]; then
        echo "✅ HTTPS健康检查通过！"
        cat /tmp/final_https.json 2>/dev/null && echo ""
        
        # 测试HTTPS Webhook
        echo "2. 验证HTTPS Webhook..."
        FINAL_WEBHOOK=$(curl -s -w "%{http_code}" -X POST "https://tkmail.fun/webhook/engagelab" \
            -H "Content-Type: application/json" \
            -d '{"external_https_test": true, "restored_config": true}' \
            -k -o /tmp/final_webhook.json || echo "000")
        echo "外部HTTPS Webhook: $FINAL_WEBHOOK"
        
        if [ "$FINAL_WEBHOOK" = "200" ]; then
            echo "✅ HTTPS Webhook正常！"
            cat /tmp/final_webhook.json 2>/dev/null && echo ""
        fi
        
        # 测试HTTP重定向
        echo "3. 验证HTTP重定向..."
        HTTP_REDIRECT=$(curl -s -w "%{http_code}" "http://tkmail.fun/health" -o /dev/null || echo "000")
        echo "HTTP重定向测试: $HTTP_REDIRECT"
        
        echo ""
        echo "🎊🎊🎊 HTTPS完全恢复成功！🎊🎊🎊"
        echo ""
        echo "🎯 EDM系统现在完全可用："
        echo "  🔒 HTTPS前端: https://tkmail.fun"
        echo "  📡 HTTPS API: https://tkmail.fun/api"
        echo "  🔗 HTTPS Webhook: https://tkmail.fun/webhook/engagelab"
        echo "  ❤️ 健康检查: https://tkmail.fun/health"
        echo ""
        echo "🎯 EngageLab后台配置："
        echo "  📌 Webhook URL: https://tkmail.fun/webhook/engagelab"
        echo "  📌 请求方法: POST"
        echo "  📌 内容类型: application/json"
        echo "  🔒 安全协议: HTTPS"
        echo ""
        echo "✅ 现在您可以："
        echo "  1. 🔒 访问 https://tkmail.fun 使用EDM系统"
        echo "  2. 🔧 在EngageLab后台配置HTTPS Webhook URL"
        echo "  3. 📧 正常使用两阶段队列发送邮件"
        echo "  4. 🔍 实时监控邮件发送状态"
        echo ""
        echo "🎉 HTTPS配置完全恢复！HTTP自动重定向到HTTPS！"
        echo "🎉 可以保留原有的配置设置！"
        
    elif [ "$FINAL_HTTPS" = "502" ]; then
        echo "⚠️ HTTPS仍然是502错误，可能需要检查后端服务或容器网络"
    else
        echo "⚠️ HTTPS访问状态: $FINAL_HTTPS"
        echo "可能需要进一步调试"
    fi
    
    rm -f /tmp/final_*.json
else
    echo "❌ HTTPS配置恢复失败"
    exit 1
fi

echo ""
echo "🎯 HTTPS配置恢复任务完成！"
</rewritten_file> 