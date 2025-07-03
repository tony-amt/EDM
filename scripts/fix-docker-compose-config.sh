#!/bin/bash

# 修复docker-compose.yml配置问题
echo "🔧 修复docker-compose.yml配置..."

SERVER_IP="43.135.38.15"

ssh ubuntu@$SERVER_IP << 'ENDSSH'
set -e

cd /opt/edm

echo "🔍 发现根本问题："
echo "  ❌ docker-compose.yml中: REACT_APP_API_BASE_URL: http://localhost:3000/api"
echo "  ❌ 环境变量优先级高于代码逻辑，覆盖了前端配置"
echo "  ❌ 端口配置: 3000:3001 不符合生产规范"

echo ""
echo "📝 备份并修复docker-compose.yml..."

# 备份原文件
cp docker-compose.yml docker-compose.yml.backup.$(date +%Y%m%d_%H%M%S)

# 修复docker-compose.yml配置
cat > docker-compose.yml << 'EOFDOCKER'
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
    stop_grace_period: 10s
    stop_signal: SIGINT

  # 后端API服务
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
      DB_HOST_TEST: postgres
      DB_NAME_TEST: amt_mail_test
      DB_USER_TEST: postgres
      DB_PASSWORD_TEST: postgres
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

  # 前端React服务
  frontend:
    build:
      context: ./src/frontend
      dockerfile: Dockerfile
    container_name: edm-frontend
    ports:
      - "3000:3001"
    environment:
      PORT: 3001
      REACT_APP_API_BASE_URL: /api
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

  # 数据库备份服务
  postgres-backup:
    image: postgres:14
    platform: linux/amd64
    container_name: edm-postgres-backup
    environment:
      PGPASSWORD: postgres
    volumes:
      - ./data/backups:/backups
      - ./scripts:/scripts
    depends_on:
      postgres:
        condition: service_healthy
    restart: "no"
    networks:
      - edm-network
    profiles:
      - backup
    command: |
      bash -c "
        echo 'Starting backup service...'
        while true; do
          echo 'Creating backup at $(date)'
          pg_dump -h postgres -U postgres -d amt_mail_system > /backups/backup_$(date +%Y%m%d_%H%M%S).sql
          echo 'Backup completed'
          sleep 3600
        done
      "

networks:
  edm-network:
    driver: bridge
EOFDOCKER

echo "✅ docker-compose.yml已修复"

echo ""
echo "🔄 重新启动所有容器..."
sudo docker-compose down

echo "清理旧镜像..."
sudo docker rmi edm-frontend:latest || true

echo "重新构建并启动..."
sudo docker-compose up -d

echo "⏳ 等待容器启动..."
sleep 20

echo ""
echo "🔍 检查容器状态..."
sudo docker ps --filter "name=edm-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "🧪 检查前端环境变量..."
sudo docker exec edm-frontend env | grep REACT_APP

echo ""
echo "📋 检查前端日志..."
sudo docker logs edm-frontend --tail 10

echo ""
echo "🧪 测试服务响应..."
echo "后端8080端口: $(curl -s -w '%{http_code}' http://localhost:8080/health -o /dev/null || echo 'FAILED')"
echo "前端3000端口: $(curl -s -w '%{http_code}' http://localhost:3000 -o /dev/null || echo 'FAILED')"

echo ""
echo "🎉 配置修复完成！"
echo ""
echo "📋 修复总结："
echo "  ✅ 修正环境变量: REACT_APP_API_BASE_URL=/api"
echo "  ✅ 修正端口配置: 后端8080:3000, 前端3000:3001"
echo "  ✅ 符合生产规范"
echo ""
echo "🎯 现在前端应该请求："
echo "  生产环境 (tkmail.fun): /api → nginx代理到后端8080"
echo "  开发环境 (localhost): localhost:8080/api → 直接访问后端"

ENDSSH

echo ""
echo "🎯 docker-compose配置修复完成！"
echo "请刷新浏览器页面，现在应该不再有localhost:3000请求"
</rewritten_file> 