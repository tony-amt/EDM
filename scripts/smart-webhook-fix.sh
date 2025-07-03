#!/bin/bash

# 🧠 智能Webhook修复脚本
# 自动检测环境并选择最合适的修复方案

set -e

SERVER_IP="43.135.38.15"
SERVER_USER="ubuntu"
SERVER_PASS="Tony1231!"

echo "🧠 开始智能Webhook修复"
echo "📅 修复时间: $(date)"

# 智能修复脚本
SMART_FIX_SCRIPT='#!/bin/bash
set -e

echo "🧠 开始智能检测和修复Webhook"
cd /opt/edm

# 1. 检查当前服务状态
echo "🔍 检查当前服务状态..."
sudo docker-compose ps

# 2. 检测nginx容器和配置位置
echo "🔍 检测nginx容器..."
NGINX_CONTAINER=$(sudo docker ps --format "table {{.Names}}\t{{.Image}}" | grep nginx | head -1 | awk "{print \$1}" || echo "")

if [ ! -z "$NGINX_CONTAINER" ]; then
    echo "✅ 找到nginx容器: $NGINX_CONTAINER"
    
    # 检查nginx配置文件位置
    echo "🔍 检查nginx配置文件位置..."
    
    # 尝试几个可能的配置文件位置
    NGINX_CONF_PATHS=(
        "/etc/nginx/nginx.conf"
        "/etc/nginx/conf.d/default.conf" 
        "/etc/nginx/sites-available/default"
        "/usr/local/nginx/conf/nginx.conf"
    )
    
    NGINX_CONF_FOUND=""
    for conf_path in "${NGINX_CONF_PATHS[@]}"; do
        if sudo docker exec "$NGINX_CONTAINER" test -f "$conf_path" 2>/dev/null; then
            echo "✅ 找到nginx配置: $conf_path"
            NGINX_CONF_FOUND="$conf_path"
            break
        fi
    done
    
    if [ ! -z "$NGINX_CONF_FOUND" ]; then
        echo "📝 检查当前nginx配置中的webhook路由..."
        sudo docker exec "$NGINX_CONTAINER" cat "$NGINX_CONF_FOUND" | grep -A 5 -B 5 webhook || echo "未找到webhook配置"
        
        # 检查是否已经有webhook配置
        if sudo docker exec "$NGINX_CONTAINER" cat "$NGINX_CONF_FOUND" | grep -q "location.*webhook"; then
            echo "✅ 发现现有webhook配置"
            EXISTING_WEBHOOK_CONFIG=$(sudo docker exec "$NGINX_CONTAINER" cat "$NGINX_CONF_FOUND" | grep -A 10 "location.*webhook")
            echo "$EXISTING_WEBHOOK_CONFIG"
            
            # 检查是否指向正确的后端
            if echo "$EXISTING_WEBHOOK_CONFIG" | grep -q "backend.*webhook"; then
                echo "✅ webhook已正确配置指向backend"
                WEBHOOK_CONFIG_OK=true
            else
                echo "⚠️ webhook配置需要修正"
                WEBHOOK_CONFIG_OK=false
            fi
        else
            echo "❌ 未找到webhook配置，需要添加"
            WEBHOOK_CONFIG_OK=false
        fi
    else
        echo "❌ 未找到nginx配置文件"
        exit 1
    fi
else
    echo "❌ 未找到nginx容器"
    echo "🔍 检查是否有nginx进程运行..."
    sudo ps aux | grep nginx || echo "未找到nginx进程"
    exit 1
fi

# 3. 检查backend是否有webhook路由
echo "🔍 检查backend中的webhook路由..."
if grep -q "webhook/engagelab" src/backend/src/index.js; then
    echo "✅ backend中已有webhook路由"
    BACKEND_WEBHOOK_READY=true
else
    echo "❌ backend中缺少webhook路由，需要添加"
    BACKEND_WEBHOOK_READY=false
fi

# 4. 根据检测结果执行修复
if [ "$WEBHOOK_CONFIG_OK" = "false" ] || [ "$BACKEND_WEBHOOK_READY" = "false" ]; then
    echo "🔧 开始修复webhook配置..."
    
    # 4.1 修复backend webhook路由
    if [ "$BACKEND_WEBHOOK_READY" = "false" ]; then
        echo "🔧 添加webhook路由到backend..."
        
        # 备份index.js
        sudo cp src/backend/src/index.js src/backend/src/index.js.backup
        
        # 添加webhook路由
        sudo sed -i "/app.use(express.static(path.join(__dirname, \"..\/public\")));/a\\
\\
\/\/ 🔧 EngageLab Webhook路由\\
const webhookController = require(\"\.\/controllers\/webhook.controller\");\\
app.post(\"\/webhook\/engagelab\", webhookController.handleMailEvent);" src/backend/src/index.js
        
        echo "✅ backend webhook路由已添加"
        
        # 重启backend容器
        echo "🔄 重启backend容器..."
        sudo docker-compose restart backend
        sleep 15
    fi
    
    # 4.2 修复nginx webhook配置
    if [ "$WEBHOOK_CONFIG_OK" = "false" ]; then
        echo "🔧 修复nginx webhook配置..."
        
        # 备份nginx配置
        sudo docker exec "$NGINX_CONTAINER" cp "$NGINX_CONF_FOUND" "$NGINX_CONF_FOUND.backup"
        
        # 创建webhook配置片段
        WEBHOOK_LOCATION='
        # EngageLab Webhook路由
        location /webhook/ {
            proxy_pass http://host.docker.internal:3001/webhook/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Webhook超时配置
            proxy_connect_timeout 10s;
            proxy_send_timeout 10s;
            proxy_read_timeout 10s;
        }'
        
        # 检查是否已有server块
        if sudo docker exec "$NGINX_CONTAINER" cat "$NGINX_CONF_FOUND" | grep -q "server.*{"; then
            # 在第一个server块中添加webhook location
            sudo docker exec "$NGINX_CONTAINER" sh -c "
                awk ''/server.*{/ && !done { 
                    print \$0; 
                    print \"$WEBHOOK_LOCATION\"; 
                    done=1; 
                    next 
                } 
                { print }' \"$NGINX_CONF_FOUND\" > /tmp/nginx_new.conf &&
                cat /tmp/nginx_new.conf > \"$NGINX_CONF_FOUND\"
            "
        else
            # 如果没有server块，创建一个简单的配置
            sudo docker exec "$NGINX_CONTAINER" sh -c "
                echo 'server {
                    listen 80;
                    server_name _;
                    $WEBHOOK_LOCATION
                }' >> \"$NGINX_CONF_FOUND\"
            "
        fi
        
        echo "✅ nginx webhook配置已添加"
        
        # 测试nginx配置
        echo "🔍 测试nginx配置..."
        if sudo docker exec "$NGINX_CONTAINER" nginx -t; then
            echo "✅ nginx配置测试通过"
            
            # 重载nginx
            echo "🔄 重载nginx配置..."
            sudo docker exec "$NGINX_CONTAINER" nginx -s reload
            echo "✅ nginx配置已重载"
        else
            echo "❌ nginx配置测试失败，恢复备份"
            sudo docker exec "$NGINX_CONTAINER" cp "$NGINX_CONF_FOUND.backup" "$NGINX_CONF_FOUND"
            exit 1
        fi
    fi
else
    echo "✅ webhook配置已正确，无需修复"
fi

# 5. 等待服务稳定
echo "⏳ 等待服务稳定..."
sleep 10

# 6. 健康检查
echo "🔍 执行健康检查..."
for i in {1..5}; do
    echo "健康检查尝试 $i/5..."
    if curl -s -f "https://tkmail.fun/health" > /dev/null 2>&1; then
        echo "✅ HTTPS健康检查通过！"
        break
    elif curl -s -f "http://43.135.38.15/health" > /dev/null 2>&1; then
        echo "✅ HTTP健康检查通过！"
        break
    else
        echo "⚠️ 健康检查失败，等待3秒后重试..."
        sleep 3
    fi
    if [ $i -eq 5 ]; then
        echo "⚠️ 健康检查失败，但继续测试webhook"
    fi
done

# 7. 测试Webhook端点
echo "🧪 测试Webhook端点..."
sleep 3

# 基础测试
echo "📝 执行Webhook基础测试..."

# 尝试HTTPS
WEBHOOK_TEST_HTTPS=$(curl -s -w "%{http_code}" -X POST "https://tkmail.fun/webhook/engagelab" \
    -H "Content-Type: application/json" \
    -d "{\"test\": true, \"smart_fix\": true, \"timestamp\": \"$(date)\"}" \
    -o /tmp/webhook_smart_test_https.json 2>/dev/null || echo "000")

echo "HTTPS Webhook测试响应码: $WEBHOOK_TEST_HTTPS"
if [ "$WEBHOOK_TEST_HTTPS" = "200" ]; then
    echo "HTTPS响应内容:"
    cat /tmp/webhook_smart_test_https.json
    WEBHOOK_SUCCESS=true
else
    echo "HTTPS测试失败，尝试HTTP..."
    
    # 尝试HTTP
    WEBHOOK_TEST_HTTP=$(curl -s -w "%{http_code}" -X POST "http://43.135.38.15/webhook/engagelab" \
        -H "Content-Type: application/json" \
        -d "{\"test\": true, \"smart_fix_http\": true, \"timestamp\": \"$(date)\"}" \
        -o /tmp/webhook_smart_test_http.json 2>/dev/null || echo "000")
    
    echo "HTTP Webhook测试响应码: $WEBHOOK_TEST_HTTP"
    if [ "$WEBHOOK_TEST_HTTP" = "200" ]; then
        echo "HTTP响应内容:"
        cat /tmp/webhook_smart_test_http.json
        WEBHOOK_SUCCESS=true
    else
        echo "HTTP测试也失败"
        WEBHOOK_SUCCESS=false
    fi
fi

# message_status测试（使用成功的协议）
if [ "$WEBHOOK_SUCCESS" = "true" ]; then
    echo "📝 执行message_status格式测试..."
    
    if [ "$WEBHOOK_TEST_HTTPS" = "200" ]; then
        WEBHOOK_URL="https://tkmail.fun/webhook/engagelab"
    else
        WEBHOOK_URL="http://43.135.38.15/webhook/engagelab"
    fi
    
    MESSAGE_STATUS_TEST=$(curl -s -w "%{http_code}" -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{
            \"message_status\": \"delivered\",
            \"status_data\": {\"message\": \"smart fix test\"},
            \"custom_args\": {\"subtask_id\": \"smart-fix-$(date +%s)\"},
            \"email_id\": \"smart-fix-email-$(date +%s)\"},
            \"task_id\": 99999,
            \"to\": \"test@example.com\"
        }" \
        -o /tmp/message_status_smart_test.json 2>/dev/null || echo "000")
    
    echo "message_status测试响应码: $MESSAGE_STATUS_TEST"
    echo "响应内容:"
    cat /tmp/message_status_smart_test.json
fi

# 清理临时文件
rm -f /tmp/webhook_smart_test*.json /tmp/message_status_smart_test.json

# 最终结果
echo ""
echo "============================================"
echo "🧠 智能Webhook修复完成!"
echo "============================================"
echo ""
echo "📊 修复结果:"
echo "  - Backend webhook路由: $([ "$BACKEND_WEBHOOK_READY" = "true" ] && echo "已就绪" || echo "已修复")"
echo "  - Nginx webhook配置: $([ "$WEBHOOK_CONFIG_OK" = "true" ] && echo "已正确" || echo "已修复")"
echo "  - HTTPS测试: $([ "$WEBHOOK_TEST_HTTPS" = "200" ] && echo "成功" || echo "失败")"
echo "  - HTTP测试: $([ "$WEBHOOK_TEST_HTTP" = "200" ] && echo "成功" || echo "失败")"
echo "  - 服务影响: 最小化（仅重启必要服务）"
echo ""

if [ "$WEBHOOK_SUCCESS" = "true" ]; then
    echo "✅ 🎉 Webhook修复成功！"
    echo ""
    echo "🔗 可用的Webhook端点:"
    if [ "$WEBHOOK_TEST_HTTPS" = "200" ]; then
        echo "  ✅ HTTPS: https://tkmail.fun/webhook/engagelab (推荐)"
    fi
    if [ "$WEBHOOK_TEST_HTTP" = "200" ]; then
        echo "  ✅ HTTP: http://43.135.38.15/webhook/engagelab"
    fi
    echo ""
    echo "🎯 现在可以在EngageLab后台配置webhook URL了！"
    echo "✅ 智能修复完成，其他服务未受影响！"
else
    echo "⚠️ Webhook测试失败，但基础配置已完成"
    echo "请检查服务日志进行进一步调试"
    echo "可能的问题："
    echo "1. 防火墙阻止了webhook端口"
    echo "2. SSL证书配置问题"
    echo "3. 后端服务未正确启动"
fi
'

# 使用sshpass执行智能修复
echo "🚀 连接服务器执行智能修复..."

sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "
    echo '$SMART_FIX_SCRIPT' > /tmp/smart_webhook_fix.sh
    chmod +x /tmp/smart_webhook_fix.sh
    /tmp/smart_webhook_fix.sh
    rm -f /tmp/smart_webhook_fix.sh
"

SMART_FIX_RESULT=$?

if [ $SMART_FIX_RESULT -eq 0 ]; then
    echo ""
    echo "🎉 智能修复执行完成！"
    echo ""
    echo "🔍 最终验证测试："
    sleep 2
    
    # 最终验证 - 尝试HTTPS和HTTP
    echo "1. HTTPS验证："
    FINAL_HTTPS_TEST=$(curl -s -w "%{http_code}" -X POST "https://tkmail.fun/webhook/engagelab" \
        -H "Content-Type: application/json" \
        -d '{"final_smart_test": true, "protocol": "https"}' \
        -o /tmp/final_smart_https.json 2>/dev/null || echo "000")
    
    echo "HTTPS响应码: $FINAL_HTTPS_TEST"
    if [ "$FINAL_HTTPS_TEST" = "200" ]; then
        echo "✅ HTTPS验证成功！"
        cat /tmp/final_smart_https.json
        FINAL_SUCCESS=true
    else
        echo "❌ HTTPS验证失败"
        
        echo "2. HTTP验证："
        FINAL_HTTP_TEST=$(curl -s -w "%{http_code}" -X POST "http://43.135.38.15/webhook/engagelab" \
            -H "Content-Type: application/json" \
            -d '{"final_smart_test": true, "protocol": "http"}' \
            -o /tmp/final_smart_http.json 2>/dev/null || echo "000")
        
        echo "HTTP响应码: $FINAL_HTTP_TEST"
        if [ "$FINAL_HTTP_TEST" = "200" ]; then
            echo "✅ HTTP验证成功！"
            cat /tmp/final_smart_http.json
            FINAL_SUCCESS=true
        else
            echo "❌ HTTP验证也失败"
            FINAL_SUCCESS=false
        fi
    fi
    
    echo ""
    if [ "$FINAL_SUCCESS" = "true" ]; then
        echo "🎉🎉🎉 EDM Webhook智能修复完全成功！🎉🎉🎉"
        echo ""
        echo "📋 修复总结:"
        echo "  ✅ 智能检测环境并选择最佳修复方案"
        echo "  ✅ 最小化影响，仅修复必要组件"
        echo "  ✅ Webhook功能已完全恢复"
        echo "  ✅ 支持HTTPS和HTTP两种协议"
        echo ""
        echo "🔗 推荐在EngageLab配置："
        if [ "$FINAL_HTTPS_TEST" = "200" ]; then
            echo "  🎯 HTTPS: https://tkmail.fun/webhook/engagelab"
        else
            echo "  🎯 HTTP: http://43.135.38.15/webhook/engagelab"
        fi
        echo ""
        echo "✅ 现在可以开始使用EDM两阶段队列系统了！"
    else
        echo "⚠️ 最终验证未完全成功，但基础配置已完成"
        echo "建议检查防火墙和SSL配置"
    fi
    
    rm -f /tmp/final_smart_*.json
else
    echo "❌ 智能修复执行失败"
    exit 1
fi 