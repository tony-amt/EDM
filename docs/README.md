# 📚 EDM系统文档中心

欢迎来到EDM邮件营销系统的文档中心！这里包含了项目的完整文档，帮助您快速了解和使用系统。

## 🗂️ 文档目录结构

### 📋 需求与规范
- **[01-requirements/](01-requirements/)** - 需求文档
  - [REQ-002-任务状态管理规范](01-requirements/REQ-002-任务状态管理规范.md)

### 📖 技术规范  
- **[02-specifications/](02-specifications/)** - 技术规范文档
  - [SPEC-002-实体模型重构规范](02-specifications/SPEC-002-实体模型重构规范.md)
  - [SPEC-003-技术组长代码检查报告](02-specifications/SPEC-003-技术组长代码检查报告.md)
  - [SPEC-004-测试组长测试检查报告](02-specifications/SPEC-004-测试组长测试检查报告.md)
  - [SPEC-005-前端构建文件命名规范](02-specifications/SPEC-005-前端构建文件命名规范.md)
  - [SPEC-006-生产环境管理规范](02-specifications/SPEC-006-生产环境管理规范.md) ⭐
  - [SPEC-007-GitHub版本管理与CICD规范](02-specifications/SPEC-007-GitHub版本管理与CICD规范.md) ⭐

### 🎨 设计文档
- **[03-design/](03-design/)** - 系统设计文档
  - API设计文档
  - 数据库设计文档
  - 架构设计文档

### 💻 开发文档
- **[04-development/](04-development/)** - 开发相关文档
  - 开发环境搭建
  - 代码规范
  - 开发工具配置

### 🧪 测试文档
- **[05-testing/](05-testing/)** - 测试相关文档
  - [TEST-003-状态管理验证](05-testing/TEST-003-状态管理验证.js)

### 🚀 运维文档
- **[06-operation/](06-operation/)** - 运维相关文档
  - [OPS-001-EDM系统状态管理实现总结](06-operation/OPS-001-EDM系统状态管理实现总结.md)
  - [OPS-002-草稿任务问题修复总结](06-operation/OPS-002-草稿任务问题修复总结.md)
  - [OPS-003-生产环境规范化完成报告](06-operation/OPS-003-生产环境规范化完成报告.md) ⭐

### 👥 用户文档
- **[07-user/](07-user/)** - 用户使用文档
  - 用户手册
  - 功能说明
  - 常见问题

### 🔄 变更管理
- **[08-changes/](08-changes/)** - 变更记录文档
  - [EDM编辑器迁移完成报告](08-changes/EDM编辑器迁移完成报告.md)
  - [数据卷损坏问题分析与解决方案](08-changes/数据卷损坏问题分析与解决方案.md)
  - [系统优化和清理报告](08-changes/系统优化和清理报告.md)

## 🚀 快速导航

### 🆕 新用户入门
1. [项目概述](../README.md#项目概述)
2. [快速开始](../README.md#快速开始)
3. [环境配置](02-specifications/SPEC-006-生产环境管理规范.md)

### 👨‍💻 开发人员
1. [开发规范](../README.md#团队协作规范)
2. [版本管理](02-specifications/SPEC-007-GitHub版本管理与CICD规范.md)
3. [代码质量要求](../README.md#代码质量要求)

### 🔧 运维人员
1. [生产环境管理](02-specifications/SPEC-006-生产环境管理规范.md)
2. [部署指南](../README.md#部署指南)
3. [监控和告警](06-operation/)

### 🧪 测试人员
1. [测试规范](05-testing/)
2. [测试用例](current/testing/test-cases/)
3. [测试报告](current/testing/test-reports/)

## 📖 文档规范

### 📝 文档命名规范
```bash
格式: [类型前缀]-[编号]-[简短描述].[扩展名]

类型前缀:
- REQ: 需求文档
- SPEC: 规范文档  
- DESIGN: 设计文档
- DEV: 开发文档
- TEST: 测试文档
- OPS: 运维文档
- USER: 用户文档
- CHANGE: 变更文档

示例:
- REQ-001-用户认证需求.md
- SPEC-002-API设计规范.md
- OPS-003-部署指南.md
```

### ✅ 文档质量标准
- **完整性**: 文档内容完整，覆盖所有必要信息
- **准确性**: 信息准确无误，与实际实现一致
- **时效性**: 文档及时更新，反映最新状态
- **可读性**: 结构清晰，语言简洁，易于理解
- **可维护性**: 格式统一，便于维护和更新

### 🔄 文档更新流程
1. **创建/修改**: 按照规范创建或修改文档
2. **内部审查**: 团队成员审查文档内容
3. **提交PR**: 通过Pull Request提交文档变更
4. **代码审查**: 至少一人审查通过
5. **合并发布**: 合并到主分支并发布

## 🔗 相关链接

### 📚 外部文档
- [GitHub仓库](https://github.com/tony-amt/EDM)
- [生产环境](https://tkmail.fun)
- [API文档](https://tkmail.fun/api-docs)

### 🛠️ 开发工具
- [GitHub Actions](https://github.com/tony-amt/EDM/actions)
- [Issues跟踪](https://github.com/tony-amt/EDM/issues)
- [项目看板](https://github.com/tony-amt/EDM/projects)

### 📊 监控面板
- [系统监控](https://tkmail.fun/monitoring)
- [性能指标](https://tkmail.fun/metrics)
- [错误日志](https://tkmail.fun/logs)

---

## 📞 文档支持

如果您在使用文档过程中遇到问题，请：

1. 🔍 **搜索现有Issue**: [GitHub Issues](https://github.com/tony-amt/EDM/issues)
2. 💡 **提出建议**: [创建新Issue](https://github.com/tony-amt/EDM/issues/new)
3. 📧 **联系团队**: dev@tkmail.fun

---

<div align="center">

**📚 文档中心** | **更新时间**: 2025-01-13 | **版本**: v1.1

</div> 