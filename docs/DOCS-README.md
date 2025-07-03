# 📚 EDM系统文档管理中心

## 🎯 文档管理原则

### 版本化管理
- **current/**: 当前开发版本的所有文档
- **versions/**: 历史版本完整归档
- **standards/**: 跨版本通用规范和标准

### 文档生命周期
1. **开发期**: 文档在 `current/` 目录下持续更新
2. **版本发布**: 完整归档到 `versions/v[x.y]/` 目录
3. **规范沉淀**: 通用规范提取到 `standards/` 目录

## 📁 目录结构规范

```
docs/
├── DOCS-README.md              # 📚 文档管理中心（本文档）
├── current/                    # 🚧 当前v2.0开发文档
│   ├── CURRENT-README.md       # 当前版本开发指南
│   ├── requirements/           # 需求文档
│   ├── design/                 # 设计文档
│   ├── implementation/         # 实现文档
│   └── testing/               # 测试文档
│       ├── test-cases/        # 测试用例
│       ├── test-scripts/      # 测试脚本
│       └── test-reports/      # 测试报告
├── versions/                   # 📦 历史版本归档
│   └── v1.0-基础功能/         # v1.0版本完整归档
│       ├── V1.0-README.md     # v1.0版本信息
│       ├── requirements/      # v1.0需求文档
│       ├── design/           # v1.0设计文档
│       └── testing/          # v1.0测试文档
├── standards/                  # 📋 通用规范标准
│   ├── testing/              # 测试规范
│   │   ├── README.md         # 测试规范总览
│   │   ├── test-cases/       # 测试用例模板
│   │   ├── test-scripts/     # 测试脚本规范
│   │   └── test-reports/     # 测试报告模板
│   └── AI-CODING-CHECKLIST.md # AI开发检查清单
└── [其他临时目录]              # 待整理归档
```

## 🔄 版本归档流程

### 版本完成归档
当某个版本开发完成并通过UAT后：

1. **创建版本目录**: `versions/v[x.y]-[功能描述]/`
2. **移动文档**: 将 `current/` 下所有文档移动到版本目录
3. **创建版本README**: 包含版本信息、功能清单、技术栈等
4. **更新索引**: 在主README中更新版本索引

### 规范提取
开发过程中沉淀的通用规范：

1. **识别通用性**: 判断规范是否适用于多个版本
2. **提取到standards**: 移动到 `standards/` 相应目录
3. **建立引用**: 在版本文档中引用标准规范
4. **持续维护**: 随项目发展持续完善规范

## 📋 文档命名规范

### 文档类型前缀
- **REQ-**: 需求文档 (Requirements)
- **DESIGN-**: 设计文档 (Design)
- **API-**: 接口文档 (API Specification)
- **DATABASE-**: 数据库设计 (Database Design)
- **ARCHITECTURE-**: 架构设计 (Architecture)
- **PROTOTYPE-**: 原型设计 (Prototype)
- **TEST-**: 测试用例 (Test Cases)
- **UAT-**: 验收测试 (User Acceptance Test)
- **SCRIPT-**: 测试脚本 (Test Scripts)
- **REPORT-**: 测试报告 (Test Reports)
- **CHANGE-**: 变更记录 (Change Log)

### 版本号规范
- **v[主版本].[次版本]**: 如 v1.0, v2.0, v2.1
- **功能描述**: 简短的功能特性描述
- **示例**: `v1.0-基础功能`, `v2.0-群发调度`

## 🎯 当前状态

### v2.0 开发进度
- ✅ **需求分析**: 群发调度与发信服务管理需求已确认
- ✅ **用户故事**: 20个用户故事卡片已完成
- ✅ **原型设计**: 9个核心页面原型已设计
- ✅ **数据库设计**: 6个新表结构已设计，UUID类型已统一
- ✅ **架构设计**: 系统架构和技术选型已确定
- ✅ **API设计**: 19个接口已设计完成
- ✅ **测试用例**: 完整测试用例已设计
- 🚧 **代码实现**: 待开始（需先完成AI Coding检查清单）

### 待归档内容
- 当前 `current/` 目录下的v2.0文档将在版本完成后归档
- 部分临时目录需要清理和整理

## 📚 快速导航

### 主要入口
- 🎯 **项目总览**: [../README.md](../README.md)
- 🚧 **当前开发**: [current/CURRENT-README.md](current/CURRENT-README.md)
- 📦 **v1.0归档**: [versions/v1.0-基础功能/V1.0-README.md](versions/v1.0-基础功能/V1.0-README.md)

### 规范标准
- 🧪 **测试规范**: [standards/testing/README.md](standards/testing/README.md)
- ✅ **开发检查清单**: [standards/AI-CODING-CHECKLIST.md](standards/AI-CODING-CHECKLIST.md)

### 当前v2.0文档
- 📋 **需求文档**: [current/requirements/](current/requirements/)
- 🎨 **设计文档**: [current/design/](current/design/)
- 🧪 **测试文档**: [current/testing/](current/testing/)

---

**文档管理版本**: v2.0  
**维护责任**: 项目控制中心Agent  
**最后更新**: 2025-01-27 