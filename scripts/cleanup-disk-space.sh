#!/bin/bash

# EDM项目磁盘空间清理脚本
# 用于清理Docker缓存、构建产物、日志文件等占用大量空间的文件

set -e

echo "🧹 EDM项目磁盘空间清理工具"
echo "=================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查Docker是否运行
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker未运行，请先启动Docker${NC}"
    exit 1
fi

# 显示清理前的空间使用情况
echo -e "${BLUE}📊 清理前的存储使用情况:${NC}"
echo "Docker系统存储:"
docker system df
echo ""
echo "项目目录大小:"
du -sh .
echo ""

# 询问用户确认
read -p "🤔 确定要开始清理吗? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 清理已取消"
    exit 0
fi

echo -e "${YELLOW}🚀 开始清理...${NC}"

# 1. 清理Docker构建缓存 (通常是最大的占用者)
echo -e "${BLUE}1. 清理Docker构建缓存...${NC}"
CACHE_BEFORE=$(docker system df --format "table {{.BuildCache}}" | tail -n +2 | awk '{print $1}' | head -1)
docker builder prune -a -f
echo -e "${GREEN}✅ Docker构建缓存清理完成${NC}"

# 2. 清理悬空镜像
echo -e "${BLUE}2. 清理悬空镜像...${NC}"
DANGLING_IMAGES=$(docker images --filter "dangling=true" -q)
if [ ! -z "$DANGLING_IMAGES" ]; then
    docker rmi $DANGLING_IMAGES
    echo -e "${GREEN}✅ 悬空镜像清理完成${NC}"
else
    echo -e "${YELLOW}ℹ️  没有悬空镜像需要清理${NC}"
fi

# 3. 清理未使用的Docker卷
echo -e "${BLUE}3. 清理未使用的Docker卷...${NC}"
docker volume prune -f
echo -e "${GREEN}✅ 未使用的Docker卷清理完成${NC}"

# 4. 清理项目内的临时文件和缓存
echo -e "${BLUE}4. 清理项目临时文件...${NC}"

# 清理测试报告和覆盖率文件
if [ -d "coverage" ] || [ -d "test-results" ] || [ -d "playwright-report" ]; then
    rm -rf coverage/ test-results/ playwright-report/
    echo -e "${GREEN}✅ 测试报告和覆盖率文件已清理${NC}"
fi

# 清理构建产物
if [ -d "src/frontend/build" ]; then
    rm -rf src/frontend/build
    echo -e "${GREEN}✅ 前端构建产物已清理${NC}"
fi

if [ -d "src/backend/dist" ]; then
    rm -rf src/backend/dist
    echo -e "${GREEN}✅ 后端构建产物已清理${NC}"
fi

# 清理日志文件
find . -name "*.log" -type f -size +10M -exec rm {} \; 2>/dev/null || true
if [ -d "src/backend/logs" ]; then
    rm -rf src/backend/logs/*
fi
if [ -d "src/frontend/logs" ]; then
    rm -rf src/frontend/logs/*
fi
if [ -d "logs" ]; then
    rm -rf logs/*
fi
echo -e "${GREEN}✅ 大型日志文件已清理${NC}"

# 清理临时文件
find . -name "*.tmp" -type f -delete 2>/dev/null || true
find . -name ".DS_Store" -type f -delete 2>/dev/null || true
echo -e "${GREEN}✅ 临时文件已清理${NC}"

# 5. Docker系统全面清理
echo -e "${BLUE}5. Docker系统全面清理...${NC}"
docker system prune -a -f --volumes
echo -e "${GREEN}✅ Docker系统全面清理完成${NC}"

# 6. 清理npm缓存 (可选)
read -p "🤔 是否清理npm缓存? 这会让下次构建变慢，但能节省更多空间 (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}6. 清理npm缓存...${NC}"
    if command -v npm >/dev/null 2>&1; then
        npm cache clean --force
        echo -e "${GREEN}✅ npm缓存已清理${NC}"
    else
        echo -e "${YELLOW}ℹ️  npm未安装，跳过npm缓存清理${NC}"
    fi
fi

echo ""
echo -e "${GREEN}🎉 清理完成！${NC}"
echo -e "${BLUE}📊 清理后的存储使用情况:${NC}"
echo "Docker系统存储:"
docker system df
echo ""
echo "项目目录大小:"
du -sh .
echo ""

echo -e "${YELLOW}💡 建议:${NC}"
echo "1. 定期运行此脚本 (建议每周一次)"
echo "2. 如果磁盘空间仍然不足，可以考虑:"
echo "   - 删除不需要的Docker镜像: docker rmi <image_id>"
echo "   - 清理node_modules后重新安装: rm -rf node_modules && npm install"
echo "   - 使用 Docker Desktop 的 'Clean / Purge data' 功能"
echo ""
echo -e "${GREEN}✨ 清理脚本执行完成！${NC}" 