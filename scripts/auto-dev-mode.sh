#!/bin/bash

# EDM自动开发模式启动脚本
# 用途：一键启动所有自动化功能，让用户专注业务

set -e

echo "🚀 EDM自动开发模式启动中..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# 1. 环境检查
check_environment() {
    echo -e "${BLUE}🔍 环境检查...${NC}"
    
    # 检查必要工具（非强制）
    if command -v node >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Node.js已安装: $(node --version)${NC}"
    else
        echo -e "${YELLOW}⚠️  Node.js未安装（开发时需要）${NC}"
    fi
    
    if command -v npm >/dev/null 2>&1; then
        echo -e "${GREEN}✅ npm已安装: $(npm --version)${NC}"
    else
        echo -e "${YELLOW}⚠️  npm未安装（开发时需要）${NC}"
    fi
    
    if command -v git >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Git已安装: $(git --version)${NC}"
    else
        echo -e "${YELLOW}⚠️  Git未安装（版本控制需要）${NC}"
    fi
    
    # 检查项目文件
    if [ -f "package.json" ]; then
        echo -e "${GREEN}✅ package.json存在${NC}"
    else
        echo -e "${YELLOW}⚠️  package.json不存在${NC}"
    fi
    
    if [ -d ".git" ]; then
        echo -e "${GREEN}✅ Git仓库已初始化${NC}"
    else
        echo -e "${YELLOW}⚠️  不是Git仓库${NC}"
    fi
    
    echo -e "${GREEN}✅ 环境检查完成${NC}"
}

# 2. 初始化自动化工具
setup_automation() {
    echo -e "${BLUE}⚙️  初始化自动化工具...${NC}"
    
    # 确保脚本可执行
    chmod +x scripts/*.sh 2>/dev/null || true
    
    # 设置Git Hooks
    if [ -d ".husky" ]; then
        echo -e "${GREEN}✅ Git Hooks已配置${NC}"
    else
        echo -e "${YELLOW}⚠️  Git Hooks未配置，建议运行: npx husky install${NC}"
    fi
    
    # 检查Cursor规则
    if [ -d ".cursor/rules" ]; then
        echo -e "${GREEN}✅ Cursor规则已配置${NC}"
    else
        echo -e "${YELLOW}⚠️  Cursor规则未配置${NC}"
    fi
}

# 3. 运行初始验证和修正
initial_check_and_fix() {
    echo -e "${BLUE}🔧 运行初始检查和自动修正...${NC}"
    
    # 自动修正
    if [ -f "scripts/ai-auto-fix.sh" ]; then
        echo -e "${PURPLE}🔧 执行自动修正...${NC}"
        ./scripts/ai-auto-fix.sh
    fi
    
    # 验证规范
    if [ -f "scripts/ai-code-validator.sh" ]; then
        echo -e "${PURPLE}✅ 验证项目规范...${NC}"
        ./scripts/ai-code-validator.sh
    fi
}

# 4. 启动监控模式
start_monitoring() {
    echo -e "${BLUE}👁️  启动文件监控模式...${NC}"
    
    # 创建监控脚本
    cat > temp/file-monitor.sh << 'EOF'
#!/bin/bash
# 文件变更监控脚本

echo "📁 文件监控启动中..."

# 使用fswatch监控文件变更（如果可用）
if command -v fswatch >/dev/null 2>&1; then
    fswatch -o src/ | while read num ; do
        echo "🔄 检测到文件变更，执行自动检查..."
        ./scripts/ai-auto-fix.sh >/dev/null 2>&1 &
    done
else
    echo "⚠️  fswatch未安装，跳过文件监控"
    echo "💡 建议安装: brew install fswatch (macOS) 或 apt-get install inotify-tools (Linux)"
fi
EOF

    chmod +x temp/file-monitor.sh
    
    # 在后台启动监控（如果fswatch可用）
    if command -v fswatch >/dev/null 2>&1; then
        echo -e "${GREEN}✅ 文件监控已启动${NC}"
        nohup ./temp/file-monitor.sh > temp/monitor.log 2>&1 &
        echo $! > temp/monitor.pid
    else
        echo -e "${YELLOW}⚠️  文件监控跳过（fswatch未安装）${NC}"
    fi
}

# 5. 设置开发环境
setup_dev_environment() {
    echo -e "${BLUE}🛠️  配置开发环境...${NC}"
    
    # 创建开发配置文件
    cat > temp/dev-config.json << EOF
{
    "autoMode": true,
    "autoFix": true,
    "autoValidate": true,
    "monitorFiles": true,
    "gitHooks": true,
    "cursorRules": true,
    "startedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

    echo -e "${GREEN}✅ 开发环境配置完成${NC}"
}

# 6. 显示使用指南
show_usage_guide() {
    echo -e "\n${PURPLE}🎯 EDM自动开发模式已启动！${NC}"
    echo -e "\n${BLUE}📋 现在您可以：${NC}"
    echo -e "  1. 专注于业务逻辑思考"
    echo -e "  2. 用自然语言描述需求"
    echo -e "  3. AI会自动处理技术实现"
    echo -e "  4. 代码自动符合项目规范"
    
    echo -e "\n${BLUE}🔧 可用命令：${NC}"
    echo -e "  ${GREEN}./scripts/ai-auto-fix.sh${NC}        - 手动运行自动修正"
    echo -e "  ${GREEN}./scripts/ai-code-validator.sh${NC}  - 手动验证规范"
    echo -e "  ${GREEN}./scripts/health-check.sh${NC}       - 系统健康检查"
    echo -e "  ${GREEN}npm run dev${NC}                     - 启动开发服务器"
    
    echo -e "\n${BLUE}📁 重要目录：${NC}"
    echo -e "  ${GREEN}src/backend/src/${NC}               - 后端代码"
    echo -e "  ${GREEN}src/frontend/src/${NC}              - 前端代码"
    echo -e "  ${GREEN}docs/${NC}                          - 项目文档"
    echo -e "  ${GREEN}temp/${NC}                          - 临时文件"
    
    echo -e "\n${BLUE}🎯 开发流程：${NC}"
    echo -e "  1. 描述业务需求 → AI理解并实现"
    echo -e "  2. 保存文件 → 自动验证和修正"
    echo -e "  3. 提交代码 → Git Hooks自动检查"
    echo -e "  4. 专注业务 → 技术细节全自动化"
    
    echo -e "\n${YELLOW}💡 提示：${NC}"
    echo -e "  - 使用 Ctrl+Shift+P → 'Tasks: Run Task' 快速执行验证"
    echo -e "  - Cursor会根据文件类型自动加载对应规则"
    echo -e "  - 所有技术规范都已自动化，无需手动操作"
    
    echo -e "\n${GREEN}🚀 准备就绪！开始您的业务创新之旅！${NC}\n"
}

# 7. 清理函数
cleanup() {
    echo -e "\n${YELLOW}🧹 清理自动开发模式...${NC}"
    
    # 停止文件监控
    if [ -f "temp/monitor.pid" ]; then
        kill $(cat temp/monitor.pid) 2>/dev/null || true
        rm temp/monitor.pid
    fi
    
    echo -e "${GREEN}✅ 清理完成${NC}"
}

# 捕获退出信号
trap cleanup EXIT

# 主执行流程
main() {
    echo -e "${PURPLE}🎯 EDM项目自动开发模式${NC}"
    echo -e "${PURPLE}让您专注业务，AI处理技术！${NC}\n"
    
    check_environment
    setup_automation
    initial_check_and_fix
    setup_dev_environment
    start_monitoring
    show_usage_guide
    
    # 如果传入了 --interactive 参数，保持运行
    if [[ "$1" == "--interactive" ]]; then
        echo -e "${BLUE}🔄 交互模式运行中...（按 Ctrl+C 退出）${NC}"
        while true; do
            sleep 60
            echo -e "${GREEN}✅ 自动开发模式运行中... $(date)${NC}"
        done
    fi
}

# 执行主函数
main "$@" 