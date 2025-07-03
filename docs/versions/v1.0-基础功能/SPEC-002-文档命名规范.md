# 📚 EDM系统文档命名与管理规范

**规范版本**: v1.0  
**生效时间**: 2025年6月4日  
**适用范围**: EDM项目所有文档

---

## 📁 目录结构规范

```
/docs
├── 01-requirements/           # 需求相关文档
├── 02-specifications/         # 规范文档
├── 03-design/                 # 设计文档
├── 04-development/            # 开发文档
├── 05-testing/                # 测试文档
├── 06-operation/              # 运维文档
├── 07-user/                   # 用户文档
├── 08-changes/                # 需求变更管理
└── 09-bugs/                   # Bug管理与测试
```

---

## 📝 文档命名规范

### 基本格式
```
[类型前缀]-[编号]-[简短描述].[扩展名]
```

### 类型前缀对照表

| 目录 | 前缀 | 说明 | 示例 |
|------|------|------|------|
| 01-requirements | REQ | 需求文档 | `REQ-001-项目概述.md` |
| 02-specifications | SPEC | 规范文档 | `SPEC-001-开发规范.md` |
| 03-design | DESIGN | 设计文档 | `DESIGN-001-架构设计.md` |
| 04-development | DEV | 开发文档 | `DEV-001-API文档.md` |
| 05-testing | TEST | 测试文档 | `TEST-001-回归测试计划.md` |
| 06-operation | OPS | 运维文档 | `OPS-001-部署指南.md` |
| 07-user | USER | 用户文档 | `USER-001-使用手册.md` |
| 08-changes | CHANGE | 需求变更 | `CHANGE-001-功能优化.md` |
| 09-bugs | BUG | Bug管理 | `BUG-001-问题追踪.md` |

### 特殊文档命名

#### 测试相关
- **回归测试脚本**: `regression-test-[YYYYMMDD].js`
- **测试报告**: `test-report-[YYYYMMDD]-[HHmmss].md`
- **UAT报告**: `uat-report-[YYYYMMDD].md`
- **验收报告**: `acceptance-report-[YYYYMMDD].md`

#### 版本管理
- **变更日志**: `CHANGELOG-[YYYYMMDD].md`
- **版本发布**: `RELEASE-[版本号]-[YYYYMMDD].md`

#### 临时文档
- **会议纪要**: `meeting-[YYYYMMDD]-[主题].md`
- **临时方案**: `temp-[用途]-[YYYYMMDD].md`

---

## 📋 文档内容规范

### 标准文档头部
```markdown
# 文档标题

**创建时间**: YYYY年MM月DD日  
**最后更新**: YYYY年MM月DD日  
**文档版本**: v1.0  
**负责人**: [姓名]  
**审核状态**: [草稿/审核中/已批准]

---
```

### 版本控制
- 每次重大修改必须更新版本号
- 使用语义化版本号: `v主版本.次版本.修订版本`
- 在文档末尾记录变更历史

### 文档状态管理
- 🟡 **草稿**: 文档编写中
- 🔵 **审核中**: 等待审核
- 🟢 **已批准**: 正式生效
- 🔴 **已废弃**: 不再使用

---

## 🔄 归档管理流程

### 自动归档触发条件
1. 主目录下存在测试报告文件
2. 临时文档超过7天未更新
3. 项目阶段完成后的文档整理

### 归档命令示例
```bash
# 整理测试报告
mv *test-report*.md docs/09-bugs/

# 整理部署文档
mv *deployment*.md docs/06-operation/

# 整理变更文档
mv *change*.md docs/08-changes/
```

### 定期清理规则
- 临时文件每月清理一次
- 过期测试报告保留3个月
- 重要文档永久保留

---

## 🧪 测试文档特殊规范

### Bug相关文档结构
```
/docs/09-bugs/
├── bug-tracking.md              # Bug追踪总表
├── regression-test-suite.md     # 回归测试套件
├── test-scripts/                # 测试脚本目录
│   ├── regression-test-[date].js
│   ├── smoke-test.js
│   └── integration-test.js
├── test-reports/                # 测试报告目录
│   ├── daily/                   # 日常测试报告
│   ├── release/                 # 发布前测试报告
│   └── hotfix/                  # 热修复测试报告
└── uat-reports/                 # UAT验收报告
```

### 测试文档命名细则
- **回归测试**: `regression-test-[YYYYMMDD].js`
- **冒烟测试**: `smoke-test-[功能模块].js`
- **集成测试**: `integration-test-[接口/模块].js`
- **性能测试**: `performance-test-[场景].js`
- **安全测试**: `security-test-[模块].js`

---

## 📊 文档质量检查

### 必要内容检查
- [ ] 文档头部信息完整
- [ ] 目标和范围明确
- [ ] 步骤说明清晰
- [ ] 代码示例可运行
- [ ] 截图或图表准确
- [ ] 联系方式有效

### 定期审核
- **每月**: 检查文档时效性
- **每季度**: 整理归档过期文档
- **每半年**: 规范执行情况评估

---

## 🎯 执行要点

1. **强制性要求**: 所有项目文档必须遵循此规范
2. **工具支持**: 建议使用模板和脚本自动化
3. **培训普及**: 新成员必须学习此规范
4. **持续改进**: 根据实际使用情况调整规范

---

**规范制定**: AI项目控制中心  
**生效日期**: 2025年6月4日  
**下次评审**: 2025年9月4日 