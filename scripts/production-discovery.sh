#!/bin/bash

# EDM生产环境发现脚本
# 找到项目实际路径和容器名称

set -e

SERVER="43.135.38.15"
USER="ubuntu"
PASS="Tony1231!"

echo "🔍 EDM生产环境发现开始..."
echo "时间: $(date)"
echo ""

# 1. 查找EDM项目目录
echo "📁 查找EDM项目目录..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $USER@$SERVER << 'EOF'
echo "=== 搜索EDM项目目录 ==="
find /home -name "*EDM*" -type d 2>/dev/null || true
find /home -name "*edm*" -type d 2>/dev/null || true
find /opt -name "*EDM*" -type d 2>/dev/null || true
find /opt -name "*edm*" -type d 2>/dev/null || true

echo ""
echo "=== 搜索docker-compose.yml文件 ==="
find /home -name "docker-compose.yml" 2>/dev/null | head -5

echo ""
echo "=== 当前目录内容 ==="
ls -la /home/ubuntu/

echo ""
echo "=== 检查常见项目目录 ==="
for dir in "/home/ubuntu/edm" "/home/ubuntu/tkmail" "/opt/edm" "/var/www/edm"; do
    if [ -d "$dir" ]; then
        echo "✅ 找到目录: $dir"
        ls -la "$dir" | head -10
    else
        echo "❌ 目录不存在: $dir"
    fi
done
EOF

# 2. 检查Docker容器详情
echo ""
echo "🐳 检查Docker容器详情..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $USER@$SERVER << 'EOF'
echo "=== 所有运行中的容器 ==="
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "=== EDM相关容器详情 ==="
docker ps --format "{{.Names}}" | grep -i edm | while read container; do
    echo "容器: $container"
    echo "  镜像: $(docker inspect --format='{{.Config.Image}}' $container)"
    echo "  工作目录: $(docker inspect --format='{{.Config.WorkingDir}}' $container)"
    echo "  挂载点: $(docker inspect --format='{{range .Mounts}}{{.Source}}:{{.Destination}} {{end}}' $container)"
    echo ""
done

echo ""
echo "=== 检查容器内部结构 ==="
backend_container=$(docker ps --format "{{.Names}}" | grep -E "(backend|edm)" | head -1)
if [ -n "$backend_container" ]; then
    echo "使用容器: $backend_container"
    docker exec $backend_container ls -la / 2>/dev/null || echo "无法访问容器内部"
    docker exec $backend_container ls -la /app 2>/dev/null || echo "无/app目录"
    docker exec $backend_container ls -la /home 2>/dev/null || echo "无/home目录"
    docker exec $backend_container pwd 2>/dev/null || echo "无法获取工作目录"
else
    echo "未找到后端容器"
fi
EOF

# 3. 检查Docker Compose配置
echo ""
echo "📋 检查Docker Compose配置..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $USER@$SERVER << 'EOF'
echo "=== 查找docker-compose文件 ==="
compose_files=$(find /home -name "docker-compose*.yml" 2>/dev/null)
if [ -n "$compose_files" ]; then
    for file in $compose_files; do
        echo "📄 发现配置文件: $file"
        echo "目录: $(dirname $file)"
        echo "内容预览:"
        head -20 "$file" | grep -E "(version|services|container_name|image|volumes)" || true
        echo "---"
    done
else
    echo "❌ 未找到docker-compose文件"
fi

echo ""
echo "=== 检查运行中的compose项目 ==="
docker compose ls 2>/dev/null || docker-compose ls 2>/dev/null || echo "无compose项目运行"
EOF

# 4. 检查EDM服务可访问性
echo ""
echo "🌐 检查EDM服务可访问性..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no $USER@$SERVER << 'EOF'
echo "=== 测试EDM服务端点 ==="

# 测试主要端口
echo "测试主要服务端口:"
for port in 3000 8080 8081 8082 8083 5000; do
    if netstat -tuln | grep -q ":$port "; then
        echo "✅ 端口 $port 正在监听"
    else
        echo "❌ 端口 $port 未监听"
    fi
done

echo ""
echo "测试EDM API访问:"
curl -I "http://localhost:3000/api/health" 2>/dev/null | head -2 || echo "本地API不可访问"
curl -I "https://tkmail.fun/api/health" 2>/dev/null | head -2 || echo "外部API不可访问"

echo ""
echo "测试追踪服务:"
curl -I "http://localhost:8081/health" 2>/dev/null | head -2 || echo "追踪服务不可访问"
curl -I "https://tkmail.fun/tracking/health" 2>/dev/null | head -2 || echo "外部追踪不可访问"
EOF

# 5. 生成发现报告
echo ""
echo "📊 生成发现报告..."

cat << 'EOF' > production_discovery_report.md
# EDM生产环境发现报告

## 🔍 发现摘要
- **发现时间**: $(date)
- **目标服务器**: 43.135.38.15
- **系统**: Ubuntu 22.04.5 LTS

## 📁 项目目录发现
[将由脚本填充]

## 🐳 Docker容器分析
[将由脚本填充]

## 🌐 服务端点验证
[将由脚本填充]

## 📋 下一步行动
1. [ ] 确认EDM项目实际路径
2. [ ] 修正脚本中的路径配置
3. [ ] 验证容器名称和服务
4. [ ] 更新优化脚本
5. [ ] 重新执行验证流程

EOF

echo "✅ 生产环境发现完成！"
echo ""
echo "📄 发现报告已生成: production_discovery_report.md"
echo ""
echo "🎯 根据发现结果，我们需要："
echo "1. 🔍 确认EDM项目的实际安装路径"
echo "2. 📝 修正脚本中的路径和容器名称"
echo "3. 🔄 使用正确配置重新执行验证"
echo "" 