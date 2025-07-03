#!/bin/bash

# EDM生产环境系统清理脚本
# 用于清理调试残留、优化系统资源

set -e

SERVER="43.135.38.15"
USER="ubuntu"
PASS="Tony1231!"

echo "🧹 开始EDM生产环境系统清理..."

# 1. 检查系统状态
echo "📊 当前系统状态:"
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $USER@$SERVER << 'EOF'
echo "=== 系统负载 ==="
uptime
echo ""

echo "=== 内存使用 ==="
free -h
echo ""

echo "=== 磁盘使用 ==="
df -h
echo ""

echo "=== 进程数量 ==="
ps aux | wc -l
echo ""
EOF

# 2. 检查Docker容器状态
echo "🐳 Docker容器状态:"
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $USER@$SERVER << 'EOF'
echo "=== 运行中的容器 ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

echo "=== 容器资源使用 ==="
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
echo ""
EOF

# 3. 清理系统缓存和临时文件
echo "🗑️ 清理系统缓存:"
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $USER@$SERVER << 'EOF'
echo "清理系统缓存..."
sudo sync
echo 3 | sudo tee /proc/sys/vm/drop_caches > /dev/null

echo "清理临时文件..."
sudo rm -rf /tmp/* 2>/dev/null || true
sudo rm -rf /var/tmp/* 2>/dev/null || true

echo "清理日志文件..."
sudo find /var/log -name "*.log" -type f -size +100M -delete 2>/dev/null || true
sudo journalctl --vacuum-time=7d 2>/dev/null || true

echo "清理APT缓存..."
sudo apt-get clean 2>/dev/null || true
sudo apt-get autoclean 2>/dev/null || true
sudo apt-get autoremove -y 2>/dev/null || true

echo "✅ 系统缓存清理完成"
EOF

# 4. 清理Docker资源
echo "🐳 清理Docker资源:"
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $USER@$SERVER << 'EOF'
echo "清理停止的容器..."
docker container prune -f 2>/dev/null || true

echo "清理未使用的镜像..."
docker image prune -f 2>/dev/null || true

echo "清理未使用的网络..."
docker network prune -f 2>/dev/null || true

echo "清理未使用的卷..."
docker volume prune -f 2>/dev/null || true

echo "✅ Docker资源清理完成"
EOF

# 5. 检查EDM应用进程
echo "🔍 检查EDM应用状态:"
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $USER@$SERVER << 'EOF'
echo "=== EDM相关进程 ==="
ps aux | grep -E "(node|npm|docker)" | grep -v grep | head -10

echo ""
echo "=== EDM容器日志大小 ==="
for container in $(docker ps --format "{{.Names}}"); do
    log_size=$(docker logs $container 2>&1 | wc -c)
    echo "$container: $(echo $log_size | awk '{print $1/1024/1024 " MB"}')"
done
EOF

# 6. 重启EDM服务(如果需要)
echo "🔄 检查是否需要重启服务:"
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $USER@$SERVER << 'EOF'
# 检查容器运行时间，如果超过24小时则建议重启
echo "=== 容器运行时间 ==="
docker ps --format "table {{.Names}}\t{{.Status}}"

# 检查内存使用是否过高
memory_usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
echo ""
echo "当前内存使用率: ${memory_usage}%"

if [ $memory_usage -gt 80 ]; then
    echo "⚠️  内存使用率过高，建议重启服务"
else
    echo "✅ 内存使用正常"
fi
EOF

# 7. 优化系统参数
echo "⚙️ 优化系统参数:"
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $USER@$SERVER << 'EOF'
# 设置swap使用率
echo "设置swap使用率为10%..."
echo 10 | sudo tee /proc/sys/vm/swappiness > /dev/null

# 优化文件描述符限制
echo "检查文件描述符限制..."
ulimit -n

# 检查网络连接数
echo "当前网络连接数:"
ss -tuln | wc -l

echo "✅ 系统参数优化完成"
EOF

# 8. 最终状态检查
echo "📊 清理后系统状态:"
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $USER@$SERVER << 'EOF'
echo "=== 最终系统状态 ==="
echo "负载: $(uptime | awk -F'load average:' '{print $2}')"
echo "内存: $(free -h | grep Mem | awk '{print $3 "/" $2 " (" $3/$2*100 "%)"}')"
echo "磁盘: $(df -h / | tail -1 | awk '{print $3 "/" $2 " (" $5 ")"}')"
echo "进程数: $(ps aux | wc -l)"
echo ""

echo "=== EDM服务状态 ==="
if docker ps | grep -q edm; then
    echo "✅ EDM服务运行正常"
    docker ps --format "{{.Names}}: {{.Status}}" | grep edm || docker ps --format "{{.Names}}: {{.Status}}"
else
    echo "⚠️  未检测到EDM服务容器"
fi
EOF

echo ""
echo "🎉 生产环境清理完成！"
echo ""
echo "📋 建议后续操作:"
echo "1. 监控系统资源使用情况"
echo "2. 检查EDM服务是否正常"
echo "3. 测试邮件发送功能"
echo "4. 设置定期清理计划任务"
echo "" 