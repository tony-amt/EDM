#!/bin/bash

# EDM生产环境紧急修复脚本
# 版本：v1.0.0
# 日期：2025-01-18

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 服务器配置
PROD_SERVER="43.135.38.15"
PROD_USER="ubuntu"
PROD_PASS="Tony1231!"

echo "======================================"
echo "   EDM生产环境紧急修复脚本"
echo "======================================"

log_step "1. 测试SSH连接"
# 尝试SSH连接
if sshpass -p "$PROD_PASS" ssh -o ConnectTimeout=30 -o StrictHostKeyChecking=no $PROD_USER@$PROD_SERVER 'echo "SSH连接成功"'; then
    log_info "SSH连接正常"
    SSH_OK=true
else
    log_error "SSH连接失败，尝试其他方法"
    SSH_OK=false
fi

if [ "$SSH_OK" = true ]; then
    log_step "2. 检查服务状态"
    sshpass -p "$PROD_PASS" ssh -o StrictHostKeyChecking=no $PROD_USER@$PROD_SERVER << 'EOF'
        echo "=== 系统状态 ==="
        uptime
        echo ""
        
        echo "=== 磁盘使用情况 ==="
        df -h
        echo ""
        
        echo "=== Docker服务状态 ==="
        sudo docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        echo ""
        
        echo "=== Nginx状态 ==="
        sudo systemctl status nginx || echo "Nginx未安装或未运行"
        echo ""
        
        echo "=== 端口监听情况 ==="
        sudo netstat -tlnp | grep -E "(80|443|22|8080)"
        echo ""
EOF

    log_step "3. 修复Nginx配置"
    sshpass -p "$PROD_PASS" ssh -o StrictHostKeyChecking=no $PROD_USER@$PROD_SERVER << 'EOF'
        echo "=== 修复Nginx配置 ==="
        
        # 检查项目目录
        cd /opt/edm || { echo "项目目录不存在，尝试其他位置"; cd /home/ubuntu/edm || exit 1; }
        
        # 备份当前配置
        sudo cp nginx/nginx.conf nginx/nginx.conf.backup.$(date +%Y%m%d_%H%M%S)
        
        # 修复后端端口配置
        sed -i 's/server edm-backend-prod:3000;/server edm-backend-prod:8080;/' nginx/nginx.conf
        
        echo "Nginx配置已修复"
EOF

    log_step "4. 重启Docker服务"
    sshpass -p "$PROD_PASS" ssh -o StrictHostKeyChecking=no $PROD_USER@$PROD_SERVER << 'EOF'
        echo "=== 重启Docker服务 ==="
        
        cd /opt/edm || cd /home/ubuntu/edm
        
        # 停止现有服务
        sudo docker-compose -f docker-compose.prod.yml down
        
        # 清理资源
        sudo docker system prune -f
        
        # 重新启动服务
        sudo docker-compose -f docker-compose.prod.yml up -d
        
        # 等待服务启动
        sleep 30
        
        echo "=== 服务状态检查 ==="
        sudo docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
EOF

    log_step "5. 测试HTTP访问"
    if curl -I http://43.135.38.15; then
        log_info "HTTP访问正常"
    else
        log_error "HTTP访问失败"
    fi

    log_step "6. 配置HTTPS（可选）"
    read -p "是否配置HTTPS/SSL证书？(y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sshpass -p "$PROD_PASS" ssh -o StrictHostKeyChecking=no $PROD_USER@$PROD_SERVER << 'EOF'
            echo "=== 安装Certbot ==="
            sudo apt update
            sudo apt install -y certbot python3-certbot-nginx
            
            echo "=== 申请SSL证书 ==="
            sudo certbot --nginx -d tkmail.fun --non-interactive --agree-tos --email tony@glodamarket.fun
            
            echo "SSL证书配置完成"
EOF
    fi

else
    log_warn "SSH连接失败，提供手动修复指令"
    echo ""
    echo "=== 手动修复指令 ==="
    echo "1. 登录服务器："
    echo "   ssh ubuntu@43.135.38.15"
    echo ""
    echo "2. 检查Docker服务："
    echo "   sudo docker ps"
    echo ""
    echo "3. 重启服务："
    echo "   cd /opt/edm"
    echo "   sudo docker-compose -f docker-compose.prod.yml down"
    echo "   sudo docker-compose -f docker-compose.prod.yml up -d"
    echo ""
    echo "4. 修复Nginx配置："
    echo "   nano nginx/nginx.conf"
    echo "   # 将 server edm-backend-prod:3000; 改为 server edm-backend-prod:8080;"
    echo ""
fi

log_info "修复脚本执行完成" 