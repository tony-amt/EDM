#!/bin/bash

# 紧急调试日志清理脚本
# 解决生产环境性能问题 - 清理AUTH_MIDDLEWARE_DEBUG日志

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SERVER_IP="43.135.38.15"
SERVER_USER="ubuntu"
SERVER_PASS="Tony1231!"
CONTAINER_NAME="edm-backend-prod"

echo -e "${YELLOW}🚨 紧急修复：清理生产环境调试日志${NC}"
echo "目标服务器: $SERVER_IP"
echo "容器名称: $CONTAINER_NAME"
echo ""

# 1. 检查当前调试日志数量
echo "📊 检查当前调试日志数量..."
DEBUG_COUNT=$(sshpass -p "$SERVER_PASS" ssh -o ConnectTimeout=10 $SERVER_USER@$SERVER_IP \
  "docker logs --tail 1000 $CONTAINER_NAME | grep 'AUTH_MIDDLEWARE_DEBUG' | wc -l")
echo "当前1000行日志中有 $DEBUG_COUNT 条调试日志"

if [ "$DEBUG_COUNT" -lt 10 ]; then
    echo -e "${GREEN}✅ 调试日志数量正常，无需修复${NC}"
    exit 0
fi

echo -e "${RED}⚠️  调试日志过多，需要立即修复！${NC}"

# 2. 备份当前的auth.middleware.js
echo "💾 备份当前文件..."
sshpass -p "$SERVER_PASS" ssh -o ConnectTimeout=10 $SERVER_USER@$SERVER_IP \
  "docker exec $CONTAINER_NAME cp /app/src/middlewares/auth.middleware.js /app/src/middlewares/auth.middleware.js.backup.$(date +%Y%m%d_%H%M%S)"

# 3. 检查文件内容
echo "🔍 检查当前文件内容..."
sshpass -p "$SERVER_PASS" ssh -o ConnectTimeout=10 $SERVER_USER@$SERVER_IP \
  "docker exec $CONTAINER_NAME grep -n 'AUTH_MIDDLEWARE_DEBUG' /app/src/middlewares/auth.middleware.js" || echo "未找到调试日志"

# 4. 创建修复后的文件内容（移除调试日志）
echo "🔧 创建修复脚本..."
sshpass -p "$SERVER_PASS" ssh -o ConnectTimeout=10 $SERVER_USER@$SERVER_IP << 'EOF'
docker exec edm-backend-prod bash -c "
# 创建临时修复脚本
cat > /tmp/fix_auth_debug.js << 'SCRIPT_END'
const fs = require('fs');

// 读取文件
const filePath = '/app/src/middlewares/auth.middleware.js';
let content = fs.readFileSync(filePath, 'utf8');

// 移除调试日志行
const lines = content.split('\n');
const filteredLines = lines.filter(line => 
  !line.includes('AUTH_MIDDLEWARE_DEBUG') && 
  !line.trim().startsWith('console.log(\'ℹ️ [AUTH_MIDDLEWARE_DEBUG]')
);

// 写回文件
fs.writeFileSync(filePath, filteredLines.join('\n'));
console.log('✅ 调试日志已清理');
SCRIPT_END

# 执行修复
node /tmp/fix_auth_debug.js
"
EOF

# 5. 验证修复结果
echo "✅ 验证修复结果..."
DEBUG_LINES=$(sshpass -p "$SERVER_PASS" ssh -o ConnectTimeout=10 $SERVER_USER@$SERVER_IP \
  "docker exec $CONTAINER_NAME grep 'AUTH_MIDDLEWARE_DEBUG' /app/src/middlewares/auth.middleware.js | wc -l" || echo "0")

if [ "$DEBUG_LINES" -eq "0" ]; then
    echo -e "${GREEN}✅ 调试日志已成功清理${NC}"
else
    echo -e "${RED}❌ 调试日志清理失败，还有 $DEBUG_LINES 行${NC}"
    exit 1
fi

# 6. 重启容器以应用更改（可选，热更新）
echo "🔄 重启Node.js进程..."
sshpass -p "$SERVER_PASS" ssh -o ConnectTimeout=10 $SERVER_USER@$SERVER_IP \
  "docker exec $CONTAINER_NAME pkill -f 'node src/index.js' || true"

# 等待进程重启
sleep 3

# 检查进程是否重新启动
PROCESS_COUNT=$(sshpass -p "$SERVER_PASS" ssh -o ConnectTimeout=10 $SERVER_USER@$SERVER_IP \
  "docker exec $CONTAINER_NAME ps aux | grep 'node src/index.js' | grep -v grep | wc -l")

if [ "$PROCESS_COUNT" -eq "0" ]; then
    echo "🚀 重新启动Node.js进程..."
    sshpass -p "$SERVER_PASS" ssh -o ConnectTimeout=10 $SERVER_USER@$SERVER_IP \
      "docker exec -d $CONTAINER_NAME node src/index.js"
    sleep 5
fi

# 7. 最终验证
echo "🔍 最终验证..."
sleep 10

# 检查新日志中是否还有调试输出
NEW_DEBUG_COUNT=$(sshpass -p "$SERVER_PASS" ssh -o ConnectTimeout=10 $SERVER_USER@$SERVER_IP \
  "docker logs --tail 50 $CONTAINER_NAME | grep 'AUTH_MIDDLEWARE_DEBUG' | wc -l" || echo "0")

if [ "$NEW_DEBUG_COUNT" -eq "0" ]; then
    echo -e "${GREEN}🎉 修复成功！新日志中无调试输出${NC}"
else
    echo -e "${YELLOW}⚠️  新日志中仍有 $NEW_DEBUG_COUNT 条调试日志${NC}"
fi

# 8. 性能测试
echo "📈 快速性能测试..."
RESPONSE_TIME=$(sshpass -p "$SERVER_PASS" ssh -o ConnectTimeout=10 $SERVER_USER@$SERVER_IP \
  "curl -s -w '%{time_total}' -o /dev/null http://localhost:8080/api/health" || echo "timeout")

echo "API响应时间: ${RESPONSE_TIME}s"

echo ""
echo -e "${GREEN}✅ 紧急修复完成！${NC}"
echo -e "${GREEN}📋 修复摘要:${NC}"
echo "  - 清理前调试日志: $DEBUG_COUNT 条"
echo "  - 清理后调试日志: $NEW_DEBUG_COUNT 条" 
echo "  - API响应时间: ${RESPONSE_TIME}s"
echo "  - 备份文件已创建" 