#!/bin/bash

# AI上下文构建脚本
# 根据用户的开发意图，自动构建相关的项目规范和代码示例

echo "🧠 构建AI开发上下文..."

# 参数解析
INTENT="$1"  # 开发意图：backend, frontend, api, model, etc.
OUTPUT_FILE="ai-context.md"

# 清空输出文件
> $OUTPUT_FILE

echo "# EDM项目AI开发上下文" >> $OUTPUT_FILE
echo "生成时间: $(date)" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# 根据开发意图构建上下文
case $INTENT in
    "backend"|"api"|"controller"|"service")
        echo "## 🎯 后端开发上下文" >> $OUTPUT_FILE
        echo "" >> $OUTPUT_FILE
        
        # 添加后端规范
        echo "### 📋 后端开发规范" >> $OUTPUT_FILE
        cat .cursor/rules/edm-backend.mdc >> $OUTPUT_FILE
        echo "" >> $OUTPUT_FILE
        
        # 添加现有控制器示例
        echo "### 📂 现有控制器文件列表" >> $OUTPUT_FILE
        echo "\`\`\`" >> $OUTPUT_FILE
        find src/backend/src/controllers -name "*.controller.js" | head -5 >> $OUTPUT_FILE
        echo "\`\`\`" >> $OUTPUT_FILE
        echo "" >> $OUTPUT_FILE
        
        # 添加控制器示例代码
        if [ -f "src/backend/src/controllers/auth.controller.js" ]; then
            echo "### 📖 控制器代码示例 (auth.controller.js)" >> $OUTPUT_FILE
            echo "\`\`\`javascript" >> $OUTPUT_FILE
            head -50 src/backend/src/controllers/auth.controller.js >> $OUTPUT_FILE
            echo "\`\`\`" >> $OUTPUT_FILE
            echo "" >> $OUTPUT_FILE
        fi
        
        # 添加路由示例
        echo "### 🛤️ 现有路由文件" >> $OUTPUT_FILE
        echo "\`\`\`" >> $OUTPUT_FILE
        find src/backend/src/routes -name "*.routes.js" | head -5 >> $OUTPUT_FILE
        echo "\`\`\`" >> $OUTPUT_FILE
        echo "" >> $OUTPUT_FILE
        ;;
        
    "frontend"|"component"|"react")
        echo "## 🎯 前端开发上下文" >> $OUTPUT_FILE
        echo "" >> $OUTPUT_FILE
        
        # 添加前端规范
        echo "### 📋 前端开发规范" >> $OUTPUT_FILE
        if [ -f ".cursor/rules/edm-frontend.mdc" ]; then
            cat .cursor/rules/edm-frontend.mdc >> $OUTPUT_FILE
        else
            echo "- 使用TypeScript + React" >> $OUTPUT_FILE
            echo "- 组件命名：PascalCase" >> $OUTPUT_FILE
            echo "- 文件命名：kebab-case" >> $OUTPUT_FILE
            echo "- 使用Ant Design组件库" >> $OUTPUT_FILE
        fi
        echo "" >> $OUTPUT_FILE
        
        # 添加现有组件示例
        echo "### 📂 现有组件文件列表" >> $OUTPUT_FILE
        echo "\`\`\`" >> $OUTPUT_FILE
        find src/frontend/src/components -name "*.tsx" -o -name "*.jsx" | head -10 >> $OUTPUT_FILE
        echo "\`\`\`" >> $OUTPUT_FILE
        echo "" >> $OUTPUT_FILE
        ;;
        
    "database"|"model"|"migration")
        echo "## 🎯 数据库开发上下文" >> $OUTPUT_FILE
        echo "" >> $OUTPUT_FILE
        
        # 添加数据库规范
        echo "### 📋 数据库规范" >> $OUTPUT_FILE
        echo "- 表命名：复数形式，snake_case" >> $OUTPUT_FILE
        echo "- 字段命名：snake_case" >> $OUTPUT_FILE
        echo "- 主键：统一使用id，自增整数" >> $OUTPUT_FILE
        echo "- 时间戳：created_at, updated_at" >> $OUTPUT_FILE
        echo "- 软删除：deleted_at" >> $OUTPUT_FILE
        echo "" >> $OUTPUT_FILE
        
        # 添加现有模型示例
        echo "### 📂 现有模型文件" >> $OUTPUT_FILE
        echo "\`\`\`" >> $OUTPUT_FILE
        find src/backend/src/models -name "*.model.js" | head -5 >> $OUTPUT_FILE
        echo "\`\`\`" >> $OUTPUT_FILE
        echo "" >> $OUTPUT_FILE
        
        # 添加模型示例代码
        if [ -f "src/backend/src/models/user.model.js" ]; then
            echo "### 📖 模型代码示例 (user.model.js)" >> $OUTPUT_FILE
            echo "\`\`\`javascript" >> $OUTPUT_FILE
            head -30 src/backend/src/models/user.model.js >> $OUTPUT_FILE
            echo "\`\`\`" >> $OUTPUT_FILE
            echo "" >> $OUTPUT_FILE
        fi
        ;;
        
    "test"|"testing")
        echo "## 🎯 测试开发上下文" >> $OUTPUT_FILE
        echo "" >> $OUTPUT_FILE
        
        # 添加测试规范
        echo "### 📋 测试规范" >> $OUTPUT_FILE
        echo "- 测试文件命名：*.test.js 或 *.spec.js" >> $OUTPUT_FILE
        echo "- 使用Jest测试框架" >> $OUTPUT_FILE
        echo "- 测试覆盖率要求：≥80%" >> $OUTPUT_FILE
        echo "- 测试分类：unit, integration, e2e" >> $OUTPUT_FILE
        echo "" >> $OUTPUT_FILE
        
        # 添加现有测试文件
        echo "### 📂 现有测试文件" >> $OUTPUT_FILE
        echo "\`\`\`" >> $OUTPUT_FILE
        find . -name "*.test.js" -o -name "*.spec.js" | head -10 >> $OUTPUT_FILE
        echo "\`\`\`" >> $OUTPUT_FILE
        echo "" >> $OUTPUT_FILE
        ;;
        
    *)
        echo "## 🎯 通用开发上下文" >> $OUTPUT_FILE
        echo "" >> $OUTPUT_FILE
        
        # 添加项目概览
        echo "### 📋 项目概览" >> $OUTPUT_FILE
        if [ -f "README.md" ]; then
            echo "#### README.md摘要" >> $OUTPUT_FILE
            head -20 README.md >> $OUTPUT_FILE
            echo "" >> $OUTPUT_FILE
        fi
        
        # 添加目录结构
        echo "### 📁 项目目录结构" >> $OUTPUT_FILE
        echo "\`\`\`" >> $OUTPUT_FILE
        tree -L 3 -I 'node_modules|.git|data|logs' . >> $OUTPUT_FILE 2>/dev/null || {
            find . -type d -name "node_modules" -prune -o -type d -name ".git" -prune -o -type d -print | head -20
        } >> $OUTPUT_FILE
        echo "\`\`\`" >> $OUTPUT_FILE
        echo "" >> $OUTPUT_FILE
        ;;
esac

# 添加通用信息
echo "### 🔧 常用命令" >> $OUTPUT_FILE
echo "\`\`\`bash" >> $OUTPUT_FILE
echo "# 开发环境启动" >> $OUTPUT_FILE
echo "npm run dev" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "# 代码验证" >> $OUTPUT_FILE
echo "./scripts/ai-code-validator.sh" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "# 健康检查" >> $OUTPUT_FILE
echo "./scripts/check-scheduler-status.sh" >> $OUTPUT_FILE
echo "\`\`\`" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# 添加最近的变更
echo "### 📝 最近变更记录" >> $OUTPUT_FILE
if [ -d "docs/08-changes" ]; then
    echo "最近的变更文档：" >> $OUTPUT_FILE
    ls -lt docs/08-changes/*.md | head -3 | awk '{print "- " $9}' >> $OUTPUT_FILE
    echo "" >> $OUTPUT_FILE
fi

# 添加相关文档
echo "### 📚 相关文档" >> $OUTPUT_FILE
case $INTENT in
    "backend"|"api"|"controller"|"service")
        echo "- [后端开发规范](docs/02-specifications/)" >> $OUTPUT_FILE
        echo "- [API设计文档](docs/03-design/)" >> $OUTPUT_FILE
        echo "- [数据库设计](docs/03-design/)" >> $OUTPUT_FILE
        ;;
    "frontend"|"component"|"react")
        echo "- [前端开发规范](docs/02-specifications/)" >> $OUTPUT_FILE
        echo "- [UI设计规范](docs/03-design/)" >> $OUTPUT_FILE
        ;;
    "database"|"model"|"migration")
        echo "- [数据库设计文档](docs/03-design/)" >> $OUTPUT_FILE
        echo "- [数据库规范](docs/02-specifications/)" >> $OUTPUT_FILE
        ;;
esac
echo "" >> $OUTPUT_FILE

echo "✅ AI上下文已构建完成: $OUTPUT_FILE"
echo "📄 文件大小: $(wc -l < $OUTPUT_FILE) 行"

# 显示文件内容预览
echo ""
echo "📖 内容预览:"
echo "============"
head -20 $OUTPUT_FILE 