#!/bin/bash

# AI代码验证脚本
# 用于验证AI生成的代码是否符合EDM项目规范

echo "🔍 AI代码规范验证开始..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# 1. 检查文件命名规范
echo "1. 检查文件命名规范..."

# 后端文件命名检查
find src/backend/src -name "*.js" | while read file; do
    filename=$(basename "$file")
    dir=$(dirname "$file")
    
    # 控制器文件检查
    if [[ $dir == *"controllers"* ]]; then
        if [[ ! $filename =~ \.controller\.js$ ]]; then
            echo -e "${RED}❌ 控制器文件命名错误: $file${NC}"
            echo "   应该以 .controller.js 结尾"
            ((ERRORS++))
        fi
    fi
    
    # 模型文件检查
    if [[ $dir == *"models"* ]]; then
        if [[ ! $filename =~ \.model\.js$ ]]; then
            echo -e "${RED}❌ 模型文件命名错误: $file${NC}"
            echo "   应该以 .model.js 结尾"
            ((ERRORS++))
        fi
    fi
    
    # 服务文件检查
    if [[ $dir == *"services"* ]]; then
        if [[ ! $filename =~ \.service\.js$ ]]; then
            echo -e "${RED}❌ 服务文件命名错误: $file${NC}"
            echo "   应该以 .service.js 结尾"
            ((ERRORS++))
        fi
    fi
    
    # 路由文件检查
    if [[ $dir == *"routes"* ]]; then
        if [[ ! $filename =~ \.routes\.js$ ]]; then
            echo -e "${RED}❌ 路由文件命名错误: $file${NC}"
            echo "   应该以 .routes.js 结尾"
            ((ERRORS++))
        fi
    fi
done

# 2. 检查API路径规范
echo "2. 检查API路径规范..."
find src/backend/src/routes -name "*.routes.js" -exec grep -l "router\." {} \; | while read file; do
    # 检查是否使用RESTful路径
    if grep -q "app\.use.*\/api\/" "$file" 2>/dev/null; then
        echo -e "${GREEN}✅ $file 使用了标准API路径${NC}"
    else
        # 检查文件内容中的路由定义
        if grep -q "\/api\/" "$file"; then
            echo -e "${GREEN}✅ $file 包含API路径定义${NC}"
        else
            echo -e "${YELLOW}⚠️  $file 可能缺少标准API路径${NC}"
            ((WARNINGS++))
        fi
    fi
done

# 3. 检查数据库模型规范
echo "3. 检查数据库模型规范..."
find src/backend/src/models -name "*.model.js" | while read file; do
    # 检查是否包含timestamps
    if grep -q "timestamps.*true" "$file"; then
        echo -e "${GREEN}✅ $file 启用了时间戳${NC}"
    else
        echo -e "${YELLOW}⚠️  $file 可能缺少时间戳配置${NC}"
        ((WARNINGS++))
    fi
    
    # 检查是否有主键定义
    if grep -q "primaryKey.*true" "$file"; then
        echo -e "${GREEN}✅ $file 定义了主键${NC}"
    else
        echo -e "${YELLOW}⚠️  $file 可能缺少主键定义${NC}"
        ((WARNINGS++))
    fi
done

# 4. 检查控制器错误处理
echo "4. 检查控制器错误处理..."
find src/backend/src/controllers -name "*.controller.js" | while read file; do
    # 检查是否使用try-catch
    if grep -q "try.*{" "$file" && grep -q "catch.*error" "$file"; then
        echo -e "${GREEN}✅ $file 包含错误处理${NC}"
    else
        echo -e "${RED}❌ $file 缺少错误处理机制${NC}"
        ((ERRORS++))
    fi
    
    # 检查是否使用async/await
    if grep -q "async.*function\|async.*=>" "$file"; then
        echo -e "${GREEN}✅ $file 使用了async/await${NC}"
    else
        echo -e "${YELLOW}⚠️  $file 可能未使用async/await${NC}"
        ((WARNINGS++))
    fi
done

# 5. 检查安全规范
echo "5. 检查安全规范..."
find src/backend/src -name "*.js" | while read file; do
    # 检查是否有硬编码密码
    if grep -i "password.*=" "$file" | grep -v "req\." | grep -v "process\.env" | grep -q "\".*\""; then
        echo -e "${RED}❌ $file 可能包含硬编码密码${NC}"
        ((ERRORS++))
    fi
    
    # 检查是否有硬编码密钥
    if grep -i "secret.*=" "$file" | grep -v "process\.env" | grep -q "\".*\""; then
        echo -e "${RED}❌ $file 可能包含硬编码密钥${NC}"
        ((ERRORS++))
    fi
done

# 6. 检查前端组件规范
echo "6. 检查前端组件规范..."
find src/frontend/src -name "*.tsx" -o -name "*.jsx" | while read file; do
    # 检查组件命名（首字母大写）
    filename=$(basename "$file" .tsx)
    filename=$(basename "$filename" .jsx)
    
    if [[ $filename =~ ^[A-Z] ]]; then
        echo -e "${GREEN}✅ $file 组件命名符合规范${NC}"
    else
        echo -e "${RED}❌ $file 组件名应该首字母大写${NC}"
        ((ERRORS++))
    fi
done

# 7. 检查文档同步性
echo "7. 检查文档同步性..."

# 检查API文档是否存在
if [ -d "docs/03-design" ]; then
    api_files=$(find src/backend/src/routes -name "*.routes.js" | wc -l)
    doc_files=$(find docs/03-design -name "*API*" -o -name "*api*" | wc -l)
    
    if [ $doc_files -gt 0 ]; then
        echo -e "${GREEN}✅ 存在API设计文档${NC}"
    else
        echo -e "${YELLOW}⚠️  缺少API设计文档${NC}"
        ((WARNINGS++))
    fi
fi

# 8. 检查测试文件
echo "8. 检查测试覆盖..."
test_files=$(find . -name "*.test.js" -o -name "*.spec.js" | wc -l)
source_files=$(find src -name "*.js" -o -name "*.ts" -o -name "*.tsx" | wc -l)

if [ $test_files -gt 0 ]; then
    echo -e "${GREEN}✅ 项目包含测试文件 ($test_files 个)${NC}"
else
    echo -e "${YELLOW}⚠️  项目缺少测试文件${NC}"
    ((WARNINGS++))
fi

# 总结报告
echo ""
echo "📊 验证报告总结:"
echo "=================="
echo -e "错误数量: ${RED}$ERRORS${NC}"
echo -e "警告数量: ${YELLOW}$WARNINGS${NC}"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}🎉 所有检查通过！代码符合项目规范${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  有警告但无错误，建议修复警告项${NC}"
    exit 1
else
    echo -e "${RED}❌ 发现错误，请修复后重新验证${NC}"
    exit 2
fi 