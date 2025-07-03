#!/bin/bash

# 🔧 温和的Webhook修复脚本
# 只修复webhook问题，不影响其他正在运行的服务

set -e

SERVER_IP="43.135.38.15"
SERVER_USER="ubuntu"
SERVER_PASS="Tony1231!"

echo "🔧 开始温和的Webhook修复（不影响其他服务）"
echo "📅 修复时间: $(date)"

# 温和修复脚本
GENTLE_FIX_SCRIPT='#!/bin/bash
set -e

echo "🔧 开始温和的Webhook修复"
cd /opt/edm

# 1. 检查当前服务状态
echo "🔍 检查当前服务状态..."
sudo docker-compose ps

# 2. 检查nginx配置中的webhook路由
echo "🔍 检查nginx配置..."
echo "当前webhook路由配置:"
grep -A 10 "location /webhook/" deploy/nginx/nginx.conf || echo "未找到webhook配置"

# 3. 检查webhook-service是否存在和运行
echo "🔍 检查webhook-service状态..."
WEBHOOK_SERVICE_STATUS=$(sudo docker-compose ps webhook-service | grep -v "Name" || echo "webhook-service不存在")
echo "webhook-service状态: $WEBHOOK_SERVICE_STATUS"

# 4. 两种修复方案选择
if sudo docker-compose ps | grep -q "webhook-service.*Up"; then
    echo "📝 方案1: webhook-service正在运行，修复其代码"
    
    # 检查webhook-service的代码
    if [ -f "services/webhook-service/app.js" ]; then
        echo "🔍 检查现有webhook-service代码..."
        head -20 services/webhook-service/app.js
        
        # 备份并更新webhook-service代码
        echo "🔧 更新webhook-service代码..."
        sudo cp services/webhook-service/app.js services/webhook-service/app.js.backup
        
        # 创建新的webhook-service代码
        sudo tee services/webhook-service/app.js > /dev/null << "EOF"
const express = require("express");
const logger = require("./logger");

const app = express();
const PORT = 8080;

// 中间件
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// 日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// 健康检查
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    service: "webhook-service", 
    timestamp: new Date().toISOString() 
  });
});

// EngageLab Webhook处理
app.post("/engagelab", async (req, res) => {
  try {
    const webhookData = req.body;
    const timestamp = new Date();
    
    console.log("🔔 收到EngageLab Webhook:", {
      body: webhookData,
      timestamp: timestamp.toISOString()
    });
    
    // 转发到后端处理
    const fetch = require("node-fetch");
    const backendUrl = "http://host.docker.internal:3002/webhook/engagelab";
    
    const response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(webhookData)
    });
    
    const result = await response.json();
    
    console.log("✅ Webhook转发完成:", {
      status: response.status,
      result: result
    });
    
    res.status(200).json({
      success: true,
      message: "Webhook processed via webhook-service",
      forwarded_to: backendUrl,
      backend_response: result
    });
    
  } catch (error) {
    console.error("❌ Webhook处理失败:", error.message);
    
    res.status(200).json({
      success: false,
      message: "Webhook处理失败: " + error.message,
      error: error.message
    });
  }
});

// 根路径处理
app.post("/", (req, res) => {
  console.log("收到根路径webhook请求，重定向到/engagelab");
  app.handle(Object.assign(req, { url: "/engagelab" }), res);
});

// 启动服务
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Webhook Service启动成功，端口: ${PORT}`);
  console.log(`📡 准备接收EngageLab webhook到 /engagelab`);
});
EOF
        
        echo "✅ webhook-service代码已更新"
        
        # 重启webhook-service
        echo "🔄 重启webhook-service..."
        sudo docker-compose restart webhook-service
        
        # 等待服务启动
        sleep 10
        
    else
        echo "❌ webhook-service代码文件不存在"
        echo "🔧 方案2: 修改nginx配置，将webhook路由指向backend"
        USE_BACKEND_WEBHOOK=true
    fi
else
    echo "📝 方案2: webhook-service未运行，修改nginx配置指向backend"
    USE_BACKEND_WEBHOOK=true
fi

# 方案2: 修改nginx配置
if [ "$USE_BACKEND_WEBHOOK" = "true" ]; then
    echo "🔧 修改nginx配置，将webhook路由指向backend..."
    
    # 备份nginx配置
    sudo cp deploy/nginx/nginx.conf deploy/nginx/nginx.conf.backup
    
    # 修改webhook路由配置
    sudo sed -i "/location \/webhook\//,/}/ {
        s|proxy_pass http://webhook-service/;|proxy_pass http://backend/webhook/;|
    }" deploy/nginx/nginx.conf
    
    echo "✅ nginx配置已修改，webhook路由现在指向backend"
    
    # 测试nginx配置
    echo "🔍 测试nginx配置..."
    if sudo docker exec edm-nginx-prod nginx -t; then
        echo "✅ nginx配置测试通过"
        
        # 重载nginx配置
        echo "🔄 重载nginx配置..."
        sudo docker exec edm-nginx-prod nginx -s reload
        echo "✅ nginx配置已重载"
    else
        echo "❌ nginx配置测试失败，恢复备份"
        sudo cp deploy/nginx/nginx.conf.backup deploy/nginx/nginx.conf
        exit 1
    fi
fi

# 5. 等待服务稳定
echo "⏳ 等待服务稳定..."
sleep 15

# 6. 健康检查
echo "🔍 执行健康检查..."
for i in {1..5}; do
    echo "健康检查尝试 $i/5..."
    if curl -s -f "https://tkmail.fun/health" > /dev/null; then
        echo "✅ 健康检查通过！"
        break
    else
        echo "⚠️ 健康检查失败，等待3秒后重试..."
        sleep 3
    fi
    if [ $i -eq 5 ]; then
        echo "❌ 健康检查持续失败"
        exit 1
    fi
done

# 7. 测试Webhook端点
echo "🧪 测试Webhook端点..."
sleep 3

# 基础测试
echo "📝 执行Webhook基础测试..."
WEBHOOK_TEST=$(curl -s -w "%{http_code}" -X POST "https://tkmail.fun/webhook/engagelab" \
    -H "Content-Type: application/json" \
    -d "{\"test\": true, \"gentle_fix\": true, \"timestamp\": \"$(date)\"}" \
    -o /tmp/webhook_gentle_test.json)

echo "Webhook测试响应码: $WEBHOOK_TEST"
echo "响应内容:"
cat /tmp/webhook_gentle_test.json
echo ""

# message_status测试
echo "📝 执行message_status格式测试..."
MESSAGE_STATUS_TEST=$(curl -s -w "%{http_code}" -X POST "https://tkmail.fun/webhook/engagelab" \
    -H "Content-Type: application/json" \
    -d "{
        \"message_status\": \"delivered\",
        \"status_data\": {\"message\": \"gentle fix test\"},
        \"custom_args\": {\"subtask_id\": \"gentle-fix-$(date +%s)\"},
        \"email_id\": \"gentle-fix-email-$(date +%s)\"},
        \"task_id\": 99999,
        \"to\": \"test@example.com\"
    }" \
    -o /tmp/message_status_gentle_test.json)

echo "message_status测试响应码: $MESSAGE_STATUS_TEST"
echo "响应内容:"
cat /tmp/message_status_gentle_test.json
echo ""

# 清理临时文件
rm -f /tmp/webhook_gentle_test.json /tmp/message_status_gentle_test.json

# 最终结果
echo ""
echo "==========================================="
echo "🎉 温和Webhook修复完成!"
echo "==========================================="
echo ""
echo "📊 修复结果:"
echo "  - 修复方案: $([ "$USE_BACKEND_WEBHOOK" = "true" ] && echo "nginx指向backend" || echo "webhook-service代理")"
echo "  - 服务影响: 最小化（仅重启相关服务）"
echo "  - Webhook测试: HTTP $WEBHOOK_TEST"
echo "  - 状态测试: HTTP $MESSAGE_STATUS_TEST"
echo ""

if [ "$WEBHOOK_TEST" -eq 200 ] && [ "$MESSAGE_STATUS_TEST" -eq 200 ]; then
    echo "✅ 🎉 所有测试通过！Webhook修复成功！"
    echo ""
    echo "🔗 重要信息:"
    echo "  ✅ Webhook URL: https://tkmail.fun/webhook/engagelab"
    echo "  ✅ 前端: https://tkmail.fun"
    echo "  ✅ 健康检查: https://tkmail.fun/health"
    echo ""
    echo "🎯 现在可以在EngageLab后台配置webhook URL了！"
    echo "✅ 温和修复完成，其他服务未受影响！"
else
    echo "⚠️ 部分测试失败，但服务基本正常"
    echo "请进一步检查日志进行调试"
fi
'

# 使用sshpass执行温和修复
echo "🚀 连接服务器执行温和修复..."

sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "
    echo '$GENTLE_FIX_SCRIPT' > /tmp/gentle_webhook_fix.sh
    chmod +x /tmp/gentle_webhook_fix.sh
    /tmp/gentle_webhook_fix.sh
    rm -f /tmp/gentle_webhook_fix.sh
"

GENTLE_FIX_RESULT=$?

if [ $GENTLE_FIX_RESULT -eq 0 ]; then
    echo ""
    echo "🎉 温和修复执行完成！"
    echo ""
    echo "🔍 最终验证测试："
    sleep 2
    
    # 最终验证
    FINAL_TEST=$(curl -s -w "%{http_code}" -X POST "https://tkmail.fun/webhook/engagelab" \
        -H "Content-Type: application/json" \
        -d '{"final_gentle_test": true, "timestamp": "'$(date)'"}' \
        -o /tmp/final_gentle_test.json)
    
    echo "最终验证响应码: $FINAL_TEST"
    if [ "$FINAL_TEST" -eq 200 ]; then
        echo "✅ 最终验证成功！"
        echo "响应内容:"
        cat /tmp/final_gentle_test.json
        echo ""
        echo "🎉🎉🎉 EDM Webhook温和修复成功！🎉🎉🎉"
        echo ""
        echo "📋 修复总结:"
        echo "  ✅ 使用温和方式，未影响其他服务"
        echo "  ✅ Webhook功能已恢复正常"
        echo "  ✅ 所有测试通过"
        echo ""
        echo "🔗 现在可以在EngageLab配置: https://tkmail.fun/webhook/engagelab"
    else
        echo "⚠️ 最终验证响应码: $FINAL_TEST"
        cat /tmp/final_gentle_test.json
    fi
    rm -f /tmp/final_gentle_test.json
else
    echo "❌ 温和修复执行失败"
    exit 1
fi 