#!/bin/bash

# 系统健康检查脚本
echo "🔍 开始系统健康检查..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 检查Docker容器状态
echo -e "${BLUE}📦 检查Docker容器状态...${NC}"
docker-compose ps

# 检查服务健康状态
echo -e "${BLUE}🏥 检查服务健康状态...${NC}"

# 检查前端服务
if curl -f -s http://localhost:3001 > /dev/null; then
    echo -e "${GREEN}✅ 前端服务正常${NC}"
else
    echo -e "${RED}❌ 前端服务异常${NC}"
fi

# 检查后端API
if curl -f -s http://localhost:3000/health > /dev/null; then
    echo -e "${GREEN}✅ 后端API正常${NC}"
else
    echo -e "${RED}❌ 后端API异常${NC}"
fi

# 检查数据库连接
echo -e "${BLUE}🗄️ 检查数据库连接...${NC}"
if docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL连接正常${NC}"
else
    echo -e "${RED}❌ PostgreSQL连接异常${NC}"
fi

# 检查Redis连接
echo -e "${BLUE}📊 检查Redis连接...${NC}"
if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis连接正常${NC}"
else
    echo -e "${RED}❌ Redis连接异常${NC}"
fi

# 检查磁盘空间
echo -e "${BLUE}💾 检查磁盘空间...${NC}"
df -h | grep -E "^/dev"

# 检查内存使用
echo -e "${BLUE}🧠 检查内存使用...${NC}"
free -h

echo -e "${GREEN}✅ 健康检查完成${NC}" 