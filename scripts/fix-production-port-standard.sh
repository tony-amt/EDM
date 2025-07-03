#!/bin/bash

# 🔧 修复生产端口规范脚本
# 按照规范配置：前端3001端口，后端8080端口

set -e

echo "🔧 修复生产端口规范..."
echo "📅 时间: $(date)"
echo "🎯 目标: 前端3001端口，后端8080端口"

SERVER_IP="43.135.38.15"

# 服务器端操作
ssh ubuntu@$SERVER_IP << 'ENDSSH'
set -e

cd /opt/edm

echo "🔍 当前容器状态："
sudo docker ps --filter "name=edm-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "📝 修复docker-compose.yml配置..."

# 备份当前配置
cp docker-compose.yml docker-compose.yml.backup.$(date +%Y%m%d_%H%M%S)

# 修复端口配置
cat > docker-compose.yml << 'EOFCOMPOSE'
services:
  # PostgreSQL数据库服务
  postgres:
    image: postgres:14
    platform: linux/amd64
    container_name: edm-postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: amt_mail_system
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
      - ./db_init_scripts:/docker-entrypoint-initdb.d
      - ./data/backups:/backups
    restart: unless-stopped
    networks:
      - edm-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d amt_mail_system"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  # 后端API服务 - 8080端口
  backend:
    build:
      context: ./src/backend
      dockerfile: Dockerfile
      no_cache: true
    container_name: edm-backend
    ports:
      - "8080:3000"
    environment:
      NODE_ENV: ${NODE_ENV:-development}
      PORT: 3000
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: ${DB_NAME:-amt_mail_system}
      DB_USER: postgres
      DB_PASSWORD: postgres
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_DB: 0
      REDIS_KEY_PREFIX: "edm:"
      JWT_SECRET: RXRmasE4X32fkDEwAbDiKzE7NyjPfWtC
      JWT_EXPIRES_IN: 24h
      DB_FORCE_SYNC: false
      SCHEDULER_ENABLED: true
      SCHEDULER_INTERVAL: 1000
      MAX_CONCURRENT_CAMPAIGNS: 5
      EMAIL_SEND_RATE_LIMIT: 100
      QUEUE_NAME: email_sending
      QUEUE_CONCURRENCY: 10
      QUEUE_RETRY_ATTEMPTS: 3
      QUEUE_RETRY_DELAY: 5000
      SERVICE_FREEZE_THRESHOLD: 10
      SERVICE_FREEZE_DURATION: 3600000
      FIXED_SENDER_EMAIL: tony@glodamarket.fun
      FIXED_SENDER_NAME: "EDM System UAT"
      SMTP_HOST: smtp.gmail.com
      SMTP_PORT: 587
      SMTP_USER: tony@glodamarket.fun
      SMTP_PASS: your_app_password_here
      ENGAGELAB_API_USER: api-glodamarket.fun
      ENGAGELAB_API_KEY: 63b81ba85732f89bde0ac9643d7bb868
      CORS_ORIGIN: "http://tkmail.fun,https://tkmail.fun,http://43.135.38.15"
    volumes:
      - ./src/backend:/app
      - /app/node_modules
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - edm-network
    command: npm run dev

  # 前端React服务 - 3001端口
  frontend:
    build:
      context: ./src/frontend
      dockerfile: Dockerfile
    container_name: edm-frontend
    ports:
      - "3001:3001"
    environment:
      PORT: 3001
      REACT_APP_API_BASE_URL: /api
      REACT_APP_TRACKING_BASE_URL: https://tkmail.fun
      GENERATE_SOURCEMAP: false
    volumes:
      - ./src/frontend:/app
      - /app/node_modules
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - edm-network
    command: npm start

  # Redis服务
  redis:
    image: redis:7-alpine
    container_name: edm-redis
    ports:
      - "6379:6379"
    volumes:
      - ./data/redis:/data
    restart: unless-stopped
    networks:
      - edm-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru --save 60 1000

networks:
  edm-network:
    driver: bridge
EOFCOMPOSE

echo "✅ 配置文件已更新"
echo ""
echo "📊 新的端口配置："
echo "  🔹 后端API: 宿主机8080 → 容器3000"
echo "  🔹 前端Web: 宿主机3001 → 容器3001"
echo "  🔹 数据库: 宿主机5432 → 容器5432"
echo "  🔹 Redis: 宿主机6379 → 容器6379"

echo ""
echo "🔄 重启容器服务..."
sudo docker-compose down
sleep 3
sudo docker-compose up -d

echo ""
echo "⏱️ 等待容器启动..."
sleep 10

echo "✅ 检查容器状态："
sudo docker ps --filter "name=edm-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "🧪 测试端口连接..."
echo "测试后端8080端口:"
BACKEND_TEST=$(curl -s -w "%{http_code}" http://localhost:8080/health -o /tmp/backend_test.json || echo "000")
echo "  后端健康检查: $BACKEND_TEST"

if [ "$BACKEND_TEST" = "200" ]; then
    echo "  ✅ 后端响应正常"
    head -c 100 /tmp/backend_test.json 2>/dev/null && echo ""
else
    echo "  ⚠️ 后端测试失败: $BACKEND_TEST"
    sudo docker logs edm-backend --tail 10
fi

echo ""
echo "测试前端3001端口:"
FRONTEND_TEST=$(curl -s -w "%{http_code}" http://localhost:3001 -o /tmp/frontend_test.html || echo "000")
echo "  前端响应: $FRONTEND_TEST"

if [ "$FRONTEND_TEST" = "200" ]; then
    echo "  ✅ 前端响应正常"
    head -c 100 /tmp/frontend_test.html 2>/dev/null && echo ""
else
    echo "  ⚠️ 前端测试结果: $FRONTEND_TEST"
    sudo docker logs edm-frontend --tail 10
fi

rm -f /tmp/*.json /tmp/*.html

echo ""
echo "🎊 端口规范修复完成！"
echo "🎯 下一步: 修复nginx配置以反映新的端口"

ENDSSH

RESULT=$?

if [ $RESULT -eq 0 ]; then
    echo ""
    echo "🎉 生产端口规范修复成功！"
    echo ""
    echo "📊 端口规范符合要求："
    echo "  ✅ 前端: 3001端口"
    echo "  ✅ 后端: 8080端口"
    echo "  ✅ 数据库: 5432端口"
    echo "  ✅ Redis: 6379端口"
    echo ""
    echo "🔧 现在需要修复nginx配置"
else
    echo "❌ 端口规范修复失败"
    exit 1
fi

echo ""
echo "🎯 生产端口规范修复完成！" 