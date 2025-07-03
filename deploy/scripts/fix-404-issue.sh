#!/bin/bash

# 修复生产环境React路由404问题
# 用途：更新nginx配置并重启服务

set -e

echo "🔧 开始修复生产环境404问题..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 检查是否在项目根目录
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}❌ 请在项目根目录执行此脚本${NC}"
    exit 1
fi

# 1. 备份当前nginx配置
backup_config() {
    echo -e "${BLUE}📁 备份当前nginx配置...${NC}"
    
    timestamp=$(date +"%Y%m%d_%H%M%S")
    backup_file="deploy/nginx/nginx.production.conf.backup.${timestamp}"
    
    if [ -f "deploy/nginx/nginx.production.conf" ]; then
        cp "deploy/nginx/nginx.production.conf" "$backup_file"
        echo -e "${GREEN}✅ 配置已备份到: $backup_file${NC}"
    else
        echo -e "${YELLOW}⚠️  nginx配置文件不存在${NC}"
    fi
}

# 2. 验证nginx配置
validate_config() {
    echo -e "${BLUE}🔍 验证nginx配置...${NC}"
    
    # 使用docker临时容器验证配置
    docker run --rm -v "$(pwd)/deploy/nginx/nginx.production.conf:/etc/nginx/nginx.conf:ro" \
        nginx:alpine nginx -t
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ nginx配置验证通过${NC}"
    else
        echo -e "${RED}❌ nginx配置验证失败${NC}"
        exit 1
    fi
}

# 3. 重启nginx服务
restart_nginx() {
    echo -e "${BLUE}🔄 重启nginx服务...${NC}"
    
    # 检查容器是否运行
    if docker-compose ps nginx | grep -q "Up"; then
        echo -e "${YELLOW}📦 重启nginx容器...${NC}"
        docker-compose restart nginx
        
        # 等待服务启动
        sleep 5
        
        # 检查服务状态
        if docker-compose ps nginx | grep -q "Up"; then
            echo -e "${GREEN}✅ nginx服务重启成功${NC}"
        else
            echo -e "${RED}❌ nginx服务重启失败${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}⚠️  nginx容器未运行，启动所有服务...${NC}"
        docker-compose up -d
        
        # 等待服务启动
        sleep 10
        echo -e "${GREEN}✅ 服务启动完成${NC}"
    fi
}

# 4. 验证修复效果
verify_fix() {
    echo -e "${BLUE}🧪 验证修复效果...${NC}"
    
    # 获取服务URL
    if [ -f "config/ports.json" ]; then
        frontend_port=$(cat config/ports.json | grep -o '"frontend_port":[[:space:]]*[0-9]*' | grep -o '[0-9]*')
        if [ -n "$frontend_port" ]; then
            test_url="http://localhost:${frontend_port}"
        else
            test_url="http://localhost"
        fi
    else
        test_url="http://localhost"
    fi
    
    echo -e "${BLUE}📡 测试URL: $test_url${NC}"
    
    # 测试根路径
    if curl -s -o /dev/null -w "%{http_code}" "$test_url" | grep -q "200"; then
        echo -e "${GREEN}✅ 根路径访问正常${NC}"
    else
        echo -e "${YELLOW}⚠️  根路径访问异常，可能需要等待服务完全启动${NC}"
    fi
    
    # 提供测试建议
    echo -e "\n${BLUE}🧪 手动测试建议：${NC}"
    echo -e "1. 访问首页: $test_url"
    echo -e "2. 导航到任意页面（如用户管理、联系人等）"
    echo -e "3. 刷新页面，确认不出现404错误"
    echo -e "4. 测试前进/后退按钮功能"
}

# 5. 显示修复说明
show_fix_details() {
    echo -e "\n${BLUE}🔧 修复详情：${NC}"
    echo -e "问题: React单页应用路由刷新时出现404错误"
    echo -e "原因: nginx的try_files指令在proxy_pass模式下不生效"
    echo -e "解决: 使用proxy_intercept_errors和error_page指令"
    echo -e "     当前端容器返回404时，自动重定向到index.html"
    
    echo -e "\n${BLUE}📋 修复内容：${NC}"
    echo -e "1. 添加 proxy_intercept_errors on"
    echo -e "2. 设置 error_page 404 = @fallback"
    echo -e "3. 优化 @fallback 位置处理"
    echo -e "4. 确保静态资源正确缓存"
}

# 主执行流程
main() {
    echo -e "${GREEN}🎯 EDM生产环境404问题修复${NC}"
    echo -e "${GREEN}解决React路由刷新404问题${NC}\n"
    
    backup_config
    validate_config
    restart_nginx
    verify_fix
    show_fix_details
    
    echo -e "\n${GREEN}🎉 404问题修复完成！${NC}"
    echo -e "${BLUE}💡 如果问题仍然存在，请检查：${NC}"
    echo -e "   1. 前端容器是否正常运行"
    echo -e "   2. 前端应用是否正确构建"
    echo -e "   3. React Router配置是否正确"
    echo -e "   4. 浏览器缓存是否需要清理"
}

# 执行主函数
main "$@" 