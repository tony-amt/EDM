#!/bin/bash

# 🐳 Phase 5 Docker 测试脚本
# 在Docker容器环境中运行多用户多任务交叉发信服务测试

set -e

echo "🐳 Phase 5 Docker 测试开始"
echo "=" | head -c 60 | tr '\n' '='
echo

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查Docker是否运行
check_docker() {
    echo -e "${BLUE}🔍 检查Docker环境...${NC}"
    
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker未运行，请启动Docker Desktop${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Docker环境正常${NC}"
}

# 停止并清理现有容器
cleanup_containers() {
    echo -e "${BLUE}🧹 清理现有容器...${NC}"
    
    # 停止可能运行的容器
    docker-compose -f docker-compose.test.yml down > /dev/null 2>&1 || true
    
    # 清理测试相关的容器
    docker ps -a --filter "name=edm" --format "table {{.Names}}" | grep -v NAMES | xargs -r docker rm -f > /dev/null 2>&1 || true
    
    echo -e "${GREEN}✅ 容器清理完成${NC}"
}

# 构建测试环境
build_test_environment() {
    echo -e "${BLUE}🏗️ 准备测试环境...${NC}"
    
    # 检查是否有现有的EDM镜像
    if docker images | grep -q "edm-backend-latest"; then
        echo -e "${GREEN}✅ 发现现有EDM镜像，跳过构建${NC}"
    else
        echo -e "${YELLOW}⚠️ 未发现现有镜像，开始构建...${NC}"
        # 构建后端镜像
        docker-compose -f docker-compose.test.yml build backend
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ 测试环境构建成功${NC}"
        else
            echo -e "${RED}❌ 测试环境构建失败${NC}"
            exit 1
        fi
    fi
}

# 启动基础服务
start_base_services() {
    echo -e "${BLUE}🚀 启动基础服务...${NC}"
    
    # 启动数据库和Redis
    docker-compose -f docker-compose.test.yml up -d db redis
    
    # 等待数据库启动
    echo -e "${YELLOW}⏳ 等待数据库启动...${NC}"
    sleep 15
    
    # 检查容器状态
    docker-compose -f docker-compose.test.yml ps
    
    # 检查数据库连接
    for i in {1..5}; do
        if docker-compose -f docker-compose.test.yml exec -T db pg_isready -U edm_user -d edm_db; then
            break
        fi
        echo -e "${YELLOW}⏳ 数据库未就绪，等待5秒后重试...${NC}"
        sleep 5
    done
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 数据库启动成功${NC}"
    else
        echo -e "${RED}❌ 数据库启动失败${NC}"
        exit 1
    fi
}

# 运行数据库迁移
run_migrations() {
    echo -e "${BLUE}🗃️ 运行数据库迁移...${NC}"
    
    # 运行迁移
    docker-compose -f docker-compose.test.yml run --rm backend npm run migrate
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 数据库迁移完成${NC}"
    else
        echo -e "${RED}❌ 数据库迁移失败${NC}"
        exit 1
    fi
}

# 运行快速验证测试
run_quick_validation() {
    echo -e "${BLUE}🧪 运行快速验证测试...${NC}"
    
    # 运行快速验证
    docker-compose -f docker-compose.test.yml run --rm backend node /app/scripts/test-phase5-quick-validation.js
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 快速验证测试通过${NC}"
    else
        echo -e "${RED}❌ 快速验证测试失败${NC}"
        return 1
    fi
}

# 运行多用户交叉测试
run_multi_user_cross_test() {
    echo -e "${BLUE}🧪 运行多用户交叉测试...${NC}"
    
    # 运行完整的多用户交叉测试
    docker-compose -f docker-compose.test.yml run --rm backend node /app/tests/phase5-multi-user-cross-test.js
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 多用户交叉测试通过${NC}"
    else
        echo -e "${RED}❌ 多用户交叉测试失败${NC}"
        return 1
    fi
}

# 收集测试报告
collect_test_reports() {
    echo -e "${BLUE}📊 收集测试报告...${NC}"
    
    # 创建本地报告目录
    mkdir -p tests/reports/docker-$(date +%Y%m%d-%H%M%S)
    
    # 从容器中复制测试报告
    CONTAINER_ID=$(docker-compose -f docker-compose.test.yml ps -q backend)
    if [ ! -z "$CONTAINER_ID" ]; then
        docker cp $CONTAINER_ID:/app/tests/reports/. tests/reports/docker-$(date +%Y%m%d-%H%M%S)/ 2>/dev/null || true
    fi
    
    echo -e "${GREEN}✅ 测试报告收集完成${NC}"
}

# 显示测试结果摘要
show_test_summary() {
    echo
    echo -e "${BLUE}📋 测试结果摘要${NC}"
    echo "=" | head -c 50 | tr '\n' '='
    echo
    
    echo -e "${GREEN}✅ 测试项目:${NC}"
    echo "  - Docker环境检查"
    echo "  - 容器构建和启动"
    echo "  - 数据库迁移"
    echo "  - Phase5快速验证"
    echo "  - 多用户交叉测试"
    
    echo
    echo -e "${BLUE}📊 测试配置:${NC}"
    echo "  - 发信服务间隔: 17s, 21s, 24s"
    echo "  - 任务补充间隔: 8s (快速验证) / 8s (交叉测试)"
    echo "  - 服务扫描间隔: 2s (快速验证) / 3s (交叉测试)"
    echo "  - 每服务最大队列: 10 (快速验证) / 15 (交叉测试)"
    
    echo
    echo -e "${GREEN}🎉 Phase 5 Docker测试完成！${NC}"
}

# 清理测试环境
cleanup_test_environment() {
    echo -e "${BLUE}🧹 清理测试环境...${NC}"
    
    # 停止所有服务
    docker-compose -f docker-compose.test.yml down
    
    echo -e "${GREEN}✅ 测试环境清理完成${NC}"
}

# 主函数
main() {
    # 捕获退出信号进行清理
    trap cleanup_test_environment EXIT
    
    # 检查命令行参数
    TEST_TYPE=${1:-"all"}
    
    case $TEST_TYPE in
        "quick")
            echo -e "${YELLOW}🚀 运行快速验证测试${NC}"
            ;;
        "cross")
            echo -e "${YELLOW}🚀 运行多用户交叉测试${NC}"
            ;;
        "all")
            echo -e "${YELLOW}🚀 运行完整测试套件${NC}"
            ;;
        *)
            echo -e "${RED}❌ 无效的测试类型: $TEST_TYPE${NC}"
            echo "使用方法: $0 [quick|cross|all]"
            exit 1
            ;;
    esac
    
    # 执行测试流程
    check_docker
    cleanup_containers
    build_test_environment
    start_base_services
    run_migrations
    
    # 根据测试类型运行相应测试
    TEST_SUCCESS=true
    
    if [ "$TEST_TYPE" = "quick" ] || [ "$TEST_TYPE" = "all" ]; then
        if ! run_quick_validation; then
            TEST_SUCCESS=false
        fi
    fi
    
    if [ "$TEST_TYPE" = "cross" ] || [ "$TEST_TYPE" = "all" ]; then
        if ! run_multi_user_cross_test; then
            TEST_SUCCESS=false
        fi
    fi
    
    # 收集测试报告
    collect_test_reports
    
    # 显示测试结果
    show_test_summary
    
    # 返回测试结果
    if [ "$TEST_SUCCESS" = true ]; then
        echo -e "${GREEN}🎉 所有测试通过！${NC}"
        exit 0
    else
        echo -e "${RED}❌ 部分测试失败！${NC}"
        exit 1
    fi
}

# 运行主函数
main "$@" 