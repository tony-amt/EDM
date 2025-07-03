#!/bin/bash

# 设置环境变量
export NODE_ENV=test
export DB_HOST_TEST=localhost

# 显示测试开始
echo "🚀 开始运行EDM系统端到端测试..."

# 准备测试数据库
echo "⏳ 确保测试数据库存在..."
docker exec -it edm-postgres psql -U postgres -c "CREATE DATABASE IF NOT EXISTS amt_mail_test;" || true

# 进入项目目录
cd "$(dirname "$0")/../.."

# 确保服务已启动
echo "⏳ 检查后端服务是否已启动..."
if ! curl -s http://localhost:3001/api/health > /dev/null; then
  echo "⚠️ 后端服务未启动，正在启动..."
  
  # 启动后端服务
  npm run start:backend &
  BACKEND_PID=$!
  
  # 等待服务启动
  echo "⏳ 等待服务启动..."
  for i in {1..30}; do
    if curl -s http://localhost:3001/api/health > /dev/null; then
      echo "✅ 服务已启动！"
      break
    fi
    echo "⏳ 等待服务启动 ($i/30)..."
    sleep 1
  done
  
  # 检查服务是否成功启动
  if ! curl -s http://localhost:3001/api/health > /dev/null; then
    echo "❌ 服务启动失败"
    exit 1
  fi
  
  STARTED_BACKEND=true
fi

# 运行端到端测试
echo "⏳ 运行端到端测试..."
jest tests/e2e/email-sending-flow.test.js --forceExit

# 保存测试结果
TEST_RESULT=$?

# 如果我们启动了后端服务，需要关闭它
if [ "$STARTED_BACKEND" = true ]; then
  echo "⏳ 关闭后端服务..."
  kill $BACKEND_PID
fi

# 显示测试结果
if [ $TEST_RESULT -eq 0 ]; then
  echo "✅ 所有端到端测试通过！"
else
  echo "❌ 端到端测试失败"
fi

exit $TEST_RESULT 