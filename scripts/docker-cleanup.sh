#!/bin/bash

# Docker清理工具
# 用于定期清理Docker系统，释放磁盘空间

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🧹 Docker系统清理工具${NC}"
echo "========================="

# 检查当前使用情况
echo -e "\n${BLUE}📊 当前Docker磁盘使用情况:${NC}"
docker system df

echo -e "\n${BLUE}🗂️  当前镜像列表:${NC}"
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

echo -e "\n${YELLOW}清理选项:${NC}"
echo "1. 轻度清理 - 删除未使用的镜像和容器"
echo "2. 中度清理 - 删除所有停止的容器和未使用的镜像"
echo "3. 深度清理 - 删除所有未使用的Docker对象 (⚠️  会删除所有停止的容器)"
echo "4. 仅清理构建缓存"
echo "5. 查看详细占用情况"
echo "6. 退出"

read -p "请选择清理级别 (1-6): " choice

case $choice in
    1)
        echo -e "\n${BLUE}🧹 执行轻度清理...${NC}"
        docker image prune -f
        docker container prune -f
        echo -e "${GREEN}✅ 轻度清理完成${NC}"
        ;;
    2)
        echo -e "\n${BLUE}🧹 执行中度清理...${NC}"
        docker image prune -a -f
        docker container prune -f
        docker network prune -f
        echo -e "${GREEN}✅ 中度清理完成${NC}"
        ;;
    3)
        echo -e "\n${RED}⚠️  深度清理将删除所有未使用的Docker对象${NC}"
        read -p "确认继续? (y/N): " confirm
        if [[ $confirm =~ ^[Yy]$ ]]; then
            echo -e "${BLUE}🧹 执行深度清理...${NC}"
            # 保护EDM系统的镜像
            echo "保护EDM系统镜像..."
            docker tag edm-frontend:latest edm-frontend:protected 2>/dev/null || true
            docker tag edm-backend:latest edm-backend:protected 2>/dev/null || true
            
            # 执行深度清理
            docker system prune -a -f --volumes
            
            # 恢复保护的镜像
            docker tag edm-frontend:protected edm-frontend:latest 2>/dev/null || true
            docker tag edm-backend:protected edm-backend:latest 2>/dev/null || true
            docker rmi edm-frontend:protected edm-backend:protected 2>/dev/null || true
            
            echo -e "${GREEN}✅ 深度清理完成${NC}"
        else
            echo "清理已取消"
        fi
        ;;
    4)
        echo -e "\n${BLUE}🧹 清理构建缓存...${NC}"
        docker builder prune -a -f
        echo -e "${GREEN}✅ 构建缓存清理完成${NC}"
        ;;
    5)
        echo -e "\n${BLUE}📋 详细占用情况:${NC}"
        echo -e "\n${YELLOW}按大小排序的镜像:${NC}"
        docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | sort -k3 -h
        
        echo -e "\n${YELLOW}所有容器状态:${NC}"
        docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Size}}"
        
        echo -e "\n${YELLOW}卷使用情况:${NC}"
        docker volume ls
        
        echo -e "\n${YELLOW}网络列表:${NC}"
        docker network ls
        ;;
    6)
        echo "退出清理工具"
        exit 0
        ;;
    *)
        echo -e "${RED}无效选择${NC}"
        exit 1
        ;;
esac

# 显示清理后的情况
echo -e "\n${BLUE}📊 清理后Docker磁盘使用情况:${NC}"
docker system df

# 计算释放的空间
echo -e "\n${GREEN}✅ 清理完成！${NC}"
echo -e "${BLUE}💡 建议定期运行此脚本以保持系统清洁${NC}"

echo -e "\n${BLUE}🔧 其他清理命令:${NC}"
echo -e "  • 手动清理: ${YELLOW}npm run clean${NC}"
echo -e "  • 查看大小: ${YELLOW}docker system df${NC}"
echo -e "  • 查看镜像: ${YELLOW}docker images${NC}" 