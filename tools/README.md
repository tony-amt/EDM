# 🛠️ 开发工具

本目录包含项目开发过程中使用的各种工具和实用脚本。

## 📂 目录结构

### 📊 analysis/ - 分析工具
- `performance-analysis.js` - 性能分析工具
- 代码质量分析工具
- 依赖关系分析工具

### 🏗️ generators/ - 代码生成器
- API接口生成器
- 数据模型生成器
- 测试用例生成器

### 🔧 utilities/ - 实用工具
- `test-tag-system.js` - 标签系统测试工具
- `update_password.js` - 密码更新工具
- 数据库操作工具
- 文件处理工具

## 📝 使用说明

### 运行分析工具
```bash
node tools/analysis/performance-analysis.js
```

### 使用实用工具
```bash
node tools/utilities/update_password.js
node tools/utilities/test-tag-system.js
```

## 🔧 工具开发规范

1. **命名规范**: 使用kebab-case命名文件
2. **文档要求**: 每个工具都要有使用说明
3. **参数验证**: 工具必须有参数验证和错误处理
4. **日志输出**: 使用统一的日志格式

## 📋 工具清单

| 工具名称 | 功能描述 | 使用频率 | 维护状态 |
|---------|---------|---------|---------|
| performance-analysis.js | 性能分析 | 每周 | ✅ 正常 |
| test-tag-system.js | 标签测试 | 按需 | ✅ 正常 |
| update_password.js | 密码更新 | 按需 | ✅ 正常 | 