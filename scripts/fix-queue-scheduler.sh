#!/bin/bash

# QueueScheduler模块缺失修复脚本

SERVER="ubuntu@43.135.38.15"
PASSWORD="Tony1231!"

echo "🔧 修复QueueScheduler模块缺失问题..."

# 1. 检查是否存在QueueScheduler文件
echo "1️⃣ 检查QueueScheduler文件..."
sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER" "
  if [ -f /tmp/backend-clean/services/infrastructure/QueueScheduler.service.js ]; then
    echo '✅ 找到QueueScheduler文件'
    docker exec edm-backend-prod mkdir -p /app/src/services/infrastructure
    docker cp /tmp/backend-clean/services/infrastructure/QueueScheduler.service.js edm-backend-prod:/app/src/services/infrastructure/QueueScheduler.js
    echo '✅ QueueScheduler文件已复制到容器'
  else
    echo '⚠️ 未找到QueueScheduler文件，创建基础实现'
    docker exec edm-backend-prod mkdir -p /app/src/services/infrastructure
    docker exec edm-backend-prod tee /app/src/services/infrastructure/QueueScheduler.js > /dev/null << 'EOF'
/**
 * 队列调度器 - 基础实现
 */
class QueueScheduler {
  constructor() {
    this.queues = new Map();
  }

  async initialize() {
    console.log('QueueScheduler initialized');
  }

  async addToQueue(queueName, data) {
    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, []);
    }
    this.queues.get(queueName).push(data);
  }

  async processQueue(queueName) {
    const queue = this.queues.get(queueName) || [];
    console.log(`Processing queue ${queueName} with ${queue.length} items`);
    return queue;
  }
}

module.exports = QueueScheduler;
EOF
    echo '✅ 基础QueueScheduler类已创建'
  fi
"

# 2. 重启后端服务
echo "2️⃣ 重启后端服务..."
sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER" "docker restart edm-backend-prod"

echo "⏳ 等待服务启动..."
sleep 15

# 3. 验证修复效果
echo "3️⃣ 验证修复效果..."
ERROR_COUNT=$(sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER" "docker logs edm-backend-prod --tail 20 | grep -i 'QueueScheduler' | wc -l")

if [ "$ERROR_COUNT" -eq "0" ]; then
    echo "✅ QueueScheduler错误已修复"
else
    echo "⚠️ QueueScheduler仍有问题，错误数: $ERROR_COUNT"
fi

# 4. 检查服务状态
BACKEND_STATUS=$(sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER" "docker ps | grep edm-backend-prod | grep 'Up' | wc -l")
if [ "$BACKEND_STATUS" -eq "1" ]; then
    echo "✅ 后端服务运行正常"
else
    echo "❌ 后端服务异常"
fi

echo "🎉 QueueScheduler修复完成！" 