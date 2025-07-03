#!/bin/bash

# EDM项目自动修正脚本
# 用途：根据验证结果自动修复常见的规范问题

set -e

echo "🔧 EDM自动修正脚本启动..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 计数器
FIXED_COUNT=0

# 1. 自动修正文件命名
fix_file_naming() {
    echo -e "${BLUE}🏷️  检查文件命名规范...${NC}"
    
    # 修正控制器文件命名
    find src/backend/src/controllers -name "*.js" | while read file; do
        basename=$(basename "$file" .js)
        if [[ ! "$basename" =~ \.controller$ ]]; then
            new_name="${basename}.controller.js"
            new_path="$(dirname "$file")/$new_name"
            if [[ "$file" != "$new_path" ]]; then
                mv "$file" "$new_path"
                echo -e "${GREEN}✅ 重命名: $(basename "$file") → $new_name${NC}"
                ((FIXED_COUNT++))
            fi
        fi
    done
    
    # 修正模型文件命名
    find src/backend/src/models -name "*.js" | while read file; do
        basename=$(basename "$file" .js)
        if [[ ! "$basename" =~ \.model$ ]]; then
            new_name="${basename}.model.js"
            new_path="$(dirname "$file")/$new_name"
            if [[ "$file" != "$new_path" ]]; then
                mv "$file" "$new_path"
                echo -e "${GREEN}✅ 重命名: $(basename "$file") → $new_name${NC}"
                ((FIXED_COUNT++))
            fi
        fi
    done
    
    # 修正服务文件命名
    find src/backend/src/services -name "*.js" | while read file; do
        basename=$(basename "$file" .js)
        if [[ ! "$basename" =~ \.service$ ]]; then
            new_name="${basename}.service.js"
            new_path="$(dirname "$file")/$new_name"
            if [[ "$file" != "$new_path" ]]; then
                mv "$file" "$new_path"
                echo -e "${GREEN}✅ 重命名: $(basename "$file") → $new_name${NC}"
                ((FIXED_COUNT++))
            fi
        fi
    done
}

# 2. 自动修正API路径
fix_api_routes() {
    echo -e "${BLUE}🛣️  检查API路径规范...${NC}"
    
    find src/backend/src/routes -name "*.js" | while read file; do
        # 检查是否缺少 /api/ 前缀
        if grep -q "app\.use('/" "$file" && ! grep -q "app\.use('/api/" "$file"; then
            # 创建备份
            cp "$file" "$file.backup"
            
            # 修正路径
            sed -i.tmp "s/app\.use('\//app.use('\/api\//g" "$file"
            rm "$file.tmp"
            
            echo -e "${GREEN}✅ 修正API路径: $(basename "$file")${NC}"
            ((FIXED_COUNT++))
        fi
    done
}

# 3. 自动添加错误处理
fix_error_handling() {
    echo -e "${BLUE}⚠️  检查错误处理...${NC}"
    
    find src/backend/src/controllers -name "*.controller.js" | while read file; do
        # 检查是否缺少try-catch
        if ! grep -q "try {" "$file" || ! grep -q "catch" "$file"; then
            echo -e "${YELLOW}⚠️  发现缺少错误处理: $(basename "$file")${NC}"
            echo -e "${YELLOW}   建议: 手动添加try-catch包装${NC}"
        fi
    done
}

# 4. 检查硬编码问题
fix_hardcoded_values() {
    echo -e "${BLUE}🔐 检查硬编码问题...${NC}"
    
    # 检查密码硬编码
    if grep -r "password.*=" src/backend/src/ --include="*.js" | grep -v "process.env"; then
        echo -e "${YELLOW}⚠️  发现可能的密码硬编码${NC}"
    fi
    
    # 检查API密钥硬编码
    if grep -r "api.*key.*=" src/backend/src/ --include="*.js" | grep -v "process.env"; then
        echo -e "${YELLOW}⚠️  发现可能的API密钥硬编码${NC}"
    fi
}

# 5. 修正前端组件命名
fix_frontend_naming() {
    echo -e "${BLUE}⚛️  检查前端组件命名...${NC}"
    
    # 检查组件文件是否使用PascalCase
    find src/frontend/src/components -name "*.tsx" -o -name "*.jsx" | while read file; do
        basename=$(basename "$file")
        # 检查首字母是否大写
        if [[ ! "$basename" =~ ^[A-Z] ]]; then
            echo -e "${YELLOW}⚠️  组件文件应使用PascalCase: $basename${NC}"
        fi
    done
}

# 6. 修正TypeScript类型定义
fix_typescript_types() {
    echo -e "${BLUE}📝 检查TypeScript类型...${NC}"
    
    find src/frontend/src -name "*.tsx" -o -name "*.ts" | while read file; do
        # 检查是否使用any类型
        if grep -q ": any" "$file"; then
            echo -e "${YELLOW}⚠️  发现any类型使用: $(basename "$file")${NC}"
            echo -e "${YELLOW}   建议: 使用具体类型定义${NC}"
        fi
    done
}

# 7. 修正测试文件结构
fix_test_structure() {
    echo -e "${BLUE}🧪 检查测试文件结构...${NC}"
    
    # 检查测试文件命名
    find tests -name "*.js" | while read file; do
        if [[ ! "$file" =~ \.test\.js$ ]] && [[ ! "$file" =~ \.spec\.js$ ]]; then
            echo -e "${YELLOW}⚠️  测试文件应使用.test.js或.spec.js后缀: $(basename "$file")${NC}"
        fi
    done
}

# 主执行流程
main() {
    echo -e "${GREEN}🚀 开始自动修正...${NC}"
    
    fix_file_naming
    fix_api_routes
    fix_error_handling
    fix_hardcoded_values
    fix_frontend_naming
    fix_typescript_types
    fix_test_structure
    
    echo -e "\n${GREEN}✅ 自动修正完成!${NC}"
    echo -e "${BLUE}📊 修正统计: ${FIXED_COUNT}个问题已自动修复${NC}"
    
    if [ $FIXED_COUNT -gt 0 ]; then
        echo -e "${YELLOW}💡 建议运行验证脚本确认修正结果${NC}"
        echo -e "${YELLOW}   ./scripts/ai-code-validator.sh${NC}"
    fi
}

# 执行主函数
main "$@" 