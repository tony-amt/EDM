#!/bin/bash

# EDM项目安全重启脚本
# 服务器重启后的安全恢复步骤

echo "🛡️ EDM项目安全重启"
echo "=================="

PRODUCTION_SERVER="43.135.38.15"
SERVER_USER="ubuntu"
SERVER_PASS="Tony1231!"

echo "📋 安全重启步骤："
echo "1. 检查Docker服务状态"
echo "2. 进入项目目录"
echo "3. 使用docker-compose启动服务"
echo "4. 验证服务状态"

echo -e "\n🔒 请在服务器上手动执行以下命令："
echo "----------------------------------------"
echo "# 1. SSH连接服务器"
echo "ssh ubuntu@43.135.38.15"
echo ""
echo "# 2. 检查Docker服务"
echo "sudo systemctl status docker"
echo "sudo systemctl start docker  # 如果未启动"
echo ""
echo "# 3. 进入项目目录"
echo "cd /home/ubuntu  # 或项目所在目录"
echo ""
echo "# 4. 检查项目文件"
echo "ls -la"
echo "ls -la docker-compose.yml"
echo ""
echo "# 5. 启动服务（安全方式）"
echo "docker-compose up -d"
echo ""
echo "# 6. 检查服务状态"
echo "docker ps"
echo ""
echo "# 7. 检查服务日志（如果有问题）"
echo "docker-compose logs -f"
echo "----------------------------------------"

echo -e "\n💡 建议操作顺序："
echo "1. 先执行上述手动命令确认一切正常"
echo "2. 再使用自动化脚本"
echo "3. 监控服务器资源使用率"

echo -e "\n⚠️ 注意事项："
echo "- 避免同时启动过多服务"
echo "- 监控内存使用率（避免超过80%）"
echo "- 逐步启动服务，不要一次性全部启动"

# 提供选择是否自动执行
read -p "是否要我尝试自动执行恢复？(y/N): " AUTO_EXEC

if [[ $AUTO_EXEC =~ ^[Yy]$ ]]; then
    echo "🚀 开始自动恢复..."
    
    # 使用非常短的超时，避免阻塞
    sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 $SERVER_USER@$PRODUCTION_SERVER << 'EOF'
    
    echo "✅ 连接成功"
    
    # 检查Docker状态
    if ! systemctl is-active --quiet docker; then
        echo "启动Docker服务..."
        sudo systemctl start docker
        sleep 2
    fi
    
    echo "Docker状态: $(systemctl is-active docker)"
    
    # 寻找项目目录
    if [ -f "/home/ubuntu/docker-compose.yml" ]; then
        cd /home/ubuntu
        echo "项目目录: /home/ubuntu"
    elif [ -f "/root/docker-compose.yml" ]; then
        cd /root
        echo "项目目录: /root"
    else
        echo "❌ 未找到docker-compose.yml文件"
        exit 1
    fi
    
    echo "启动EDM服务..."
    docker-compose up -d
    
    sleep 5
    echo "容器状态:"
    docker ps --format "table {{.Names}}\t{{.Status}}"
    
EOF
    
    if [ $? -eq 0 ]; then
        echo "✅ 自动恢复完成"
        echo "🌐 测试访问: http://43.135.38.15:3001"
    else
        echo "❌ 自动恢复失败，请手动执行上述步骤"
    fi
else
    echo "👋 请手动执行上述步骤，更加安全可靠"
fi 