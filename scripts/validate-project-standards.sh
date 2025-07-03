#!/bin/bash

# 项目规范验证脚本
# 验证项目是否符合企业级开发标准

echo "🔍 开始验证项目规范..."
echo "================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 计数器
PASSED=0
FAILED=0
WARNING=0

# 检查函数
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅ $1 存在${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}❌ $1 不存在${NC}"
        ((FAILED++))
        return 1
    fi
}

check_directory() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✅ $1 目录存在${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}❌ $1 目录不存在${NC}"
        ((FAILED++))
        return 1
    fi
}

check_content() {
    if grep -q "$2" "$1" 2>/dev/null; then
        echo -e "${GREEN}✅ $1 包含必要内容${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${YELLOW}⚠️ $1 可能缺少关键内容: $2${NC}"
        ((WARNING++))
        return 1
    fi
}

echo -e "${BLUE}📋 检查基础文件...${NC}"
check_file "README.md"
check_file "CHANGELOG.md"
check_file "LICENSE"
check_file "package.json"
check_file ".gitignore"

echo ""
echo -e "${BLUE}🔧 检查GitHub配置...${NC}"
check_directory ".github"
check_file ".github/workflows/ci.yml"
check_file ".github/workflows/deploy.yml"
check_file ".github/ISSUE_TEMPLATE/bug_report.md"
check_file ".github/ISSUE_TEMPLATE/feature_request.md"
check_file ".github/pull_request_template.md"

echo ""
echo -e "${BLUE}🛠️ 检查开发环境配置...${NC}"
check_directory ".vscode"
check_file ".vscode/settings.json"
check_file ".vscode/extensions.json"
check_directory ".husky"
check_file ".husky/pre-commit"
check_file ".husky/commit-msg"

echo ""
echo -e "${BLUE}📚 检查文档结构...${NC}"
check_directory "docs"
check_file "docs/README.md"
check_directory "docs/01-requirements"
check_directory "docs/02-specifications"
check_directory "docs/03-design"
check_directory "docs/04-development"
check_directory "docs/05-testing"
check_directory "docs/06-operation"
check_directory "docs/07-user"
check_directory "docs/08-changes"

echo ""
echo -e "${BLUE}📋 检查规范文档...${NC}"
check_file "docs/02-specifications/SPEC-006-生产环境管理规范.md"
check_file "docs/02-specifications/SPEC-007-GitHub版本管理与CICD规范.md"
check_file "docs/02-specifications/SPEC-008-项目管理与团队协作规范.md"
check_file "docs/06-operation/OPS-004-GitHub项目规范化建设完成报告.md"

echo ""
echo -e "${BLUE}🔍 检查README内容质量...${NC}"
check_content "README.md" "团队协作规范"
check_content "README.md" "分支保护规则"
check_content "README.md" "代码质量要求"
check_content "README.md" "CI/CD"
check_content "README.md" "版本管理"

echo ""
echo -e "${BLUE}🎯 检查项目结构...${NC}"
check_directory "src"
check_directory "src/frontend"
check_directory "src/backend"
check_directory "tests"
check_directory "scripts"
check_directory "config"

echo ""
echo -e "${BLUE}🚀 检查部署配置...${NC}"
check_file "docker-compose.yml"
check_file "scripts/deploy.sh"
check_file "scripts/health-check.sh"

echo ""
echo "================================="
echo -e "${BLUE}📊 验证结果统计${NC}"
echo "================================="

TOTAL=$((PASSED + FAILED + WARNING))
echo -e "总检查项: ${BLUE}$TOTAL${NC}"
echo -e "通过: ${GREEN}$PASSED${NC}"
echo -e "失败: ${RED}$FAILED${NC}"
echo -e "警告: ${YELLOW}$WARNING${NC}"

echo ""
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 恭喜！项目完全符合企业级开发标准！${NC}"
    if [ $WARNING -gt 0 ]; then
        echo -e "${YELLOW}💡 建议处理上述警告项以进一步提升项目质量${NC}"
    fi
    exit 0
else
    echo -e "${RED}❌ 项目还需要完善以下方面才能达到企业级标准${NC}"
    echo -e "${YELLOW}💡 请根据上述检查结果完善项目配置${NC}"
    exit 1
fi 