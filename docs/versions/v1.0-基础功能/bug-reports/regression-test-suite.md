# 🧪 EDM系统回归测试套件

**创建时间**: 2025年6月4日  
**最后更新**: 2025年6月4日  
**文档版本**: v1.0  
**负责人**: AI项目控制中心  
**审核状态**: 已批准

---

## 📋 测试概述

回归测试套件用于确保系统核心功能在代码变更后仍能正常工作，包括主流程测试和历史bug回归验证。

### 🎯 测试目标
1. 验证系统核心业务流程功能完整性
2. 确保历史修复的bug不再重现
3. 验证新功能不影响现有功能
4. 保证系统整体稳定性

### 📊 测试覆盖范围
- ✅ **用户认证流程**: 登录、权限验证、Token管理
- ✅ **联系人管理**: 增删改查、批量操作、数据导入导出
- ✅ **标签管理**: 标签CRUD、层级关系、关联管理
- ✅ **活动管理**: 活动创建、编辑、状态管理
- ✅ **任务管理**: 任务创建、调度、执行状态
- ✅ **模板管理**: 模板CRUD、富文本编辑、预览
- ✅ **数据集成**: API接口、数据同步、缓存一致性

---

## 🚀 快速执行

### 一键执行所有回归测试
```bash
cd /Users/tony/Desktop/cursor/EDM
node docs/09-bugs/test-scripts/regression-test-suite.js
```

### 分模块执行
```bash
# 核心流程测试
node docs/09-bugs/test-scripts/core-workflow-test.js

# Bug回归测试
node docs/09-bugs/test-scripts/bug-regression-test.js

# API接口测试
node docs/09-bugs/test-scripts/api-integration-test.js

# 冒烟测试
node docs/09-bugs/test-scripts/smoke-test.js
```

---

## 📝 测试用例清单

### 🔐 1. 用户认证流程测试

#### TC-AUTH-001: 管理员登录
**测试步骤**:
1. 访问登录页面
2. 输入正确的管理员凭据 (admin/admin123456)
3. 验证登录成功和Token生成
4. 验证用户信息正确返回

**预期结果**: 
- 登录API返回200状态码
- 响应包含valid token和用户数据
- 前端正确处理登录状态

#### TC-AUTH-002: 权限验证
**测试步骤**:
1. 使用有效Token访问受保护资源
2. 使用无效Token访问受保护资源
3. 验证权限控制正确性

**预期结果**: 
- 有效Token可正常访问
- 无效Token返回401错误

### 👥 2. 联系人管理测试

#### TC-CONTACT-001: CRUD操作完整性
**测试步骤**:
1. 创建新联系人
2. 查询联系人详情
3. 更新联系人信息
4. 删除联系人
5. 验证删除后数据一致性

**预期结果**: 
- 所有CRUD操作成功
- 数据库状态与操作一致
- 缓存正确更新

#### TC-CONTACT-002: 标签关联功能
**测试步骤**:
1. 创建测试标签
2. 为联系人分配标签
3. 查询带标签的联系人
4. 验证标签数据来源于标签管理

**预期结果**: 
- 标签正确关联到联系人
- 前端标签选择器使用动态数据
- 标签数据格式一致

### 🏷️ 3. 标签管理测试

#### TC-TAG-001: 标签CRUD操作
**测试步骤**:
1. 创建标签
2. 编辑标签信息
3. 删除标签
4. 验证UUID格式支持

**预期结果**: 
- 所有操作使用正确的UUID验证
- API返回正确的状态码
- 数据库操作成功

### 📧 4. 模板管理测试

#### TC-TEMPLATE-001: 模板创建和编辑
**测试步骤**:
1. 创建HTML邮件模板
2. 使用富文本编辑器编辑
3. 预览模板效果
4. 保存模板

**预期结果**: 
- 模板字段使用正确的'body'字段名
- 富文本编辑器正常加载
- HTML内容正确保存

### 🎯 5. 活动和任务管理测试

#### TC-CAMPAIGN-001: 活动创建流程
**测试步骤**:
1. 访问活动创建页面
2. 填写活动信息
3. 选择目标标签和模板
4. 保存活动

**预期结果**: 
- 页面正常加载，无空白页
- 标签和模板数据正确获取
- 活动创建成功

#### TC-TASK-001: 任务创建流程
**测试步骤**:
1. 访问任务创建页面
2. 选择关联活动
3. 配置发送规则
4. 设置调度时间

**预期结果**: 
- 页面正常加载
- 活动数据正确获取
- 任务配置保存成功

---

## 🐛 历史Bug回归测试

### 已修复Bug验证清单

| Bug ID | 描述 | 验证步骤 | 状态 |
|--------|------|----------|------|
| BUG-001 | 登录跳转问题 | 验证API字段格式 | ✅ 已验证 |
| BUG-002 | 联系人标签关联 | 验证标签数据源 | ✅ 已验证 |
| BUG-003 | 联系人编辑数据加载 | 验证详情API | ✅ 已验证 |
| BUG-004 | 联系人删除缓存 | 验证删除生效 | ✅ 已验证 |
| BUG-005 | 标签删除报错 | 验证UUID支持 | ✅ 已验证 |
| BUG-006 | 标签编辑保存 | 验证编辑API | ✅ 已验证 |
| BUG-007 | 活动任务页面空白 | 验证页面加载 | ✅ 已验证 |
| BUG-008 | 模板创建报错 | 验证字段名 | ✅ 已验证 |
| BUG-009 | 富文本编辑器 | 验证组件加载 | ✅ 已验证 |

---

## 📊 测试执行和报告

### 执行频率
- **每日**: 冒烟测试
- **每周**: 完整回归测试
- **发布前**: 全量测试套件
- **紧急修复后**: 相关模块回归测试

### 测试环境要求
```bash
# 环境检查脚本
node docs/09-bugs/test-scripts/environment-check.js
```

**必要条件**:
- Node.js v18+
- PostgreSQL运行中
- 前端服务 (http://localhost:3001)
- 后端服务 (http://localhost:3000)
- 管理员账户可用

### 报告模板
```markdown
## 回归测试报告 - [YYYY-MM-DD]

### 测试概要
- **执行时间**: [开始时间] - [结束时间]
- **测试环境**: 本地开发环境
- **测试版本**: [Git Hash/版本号]
- **执行人**: [姓名]

### 测试结果
- **总用例数**: X
- **通过数量**: X 
- **失败数量**: X
- **成功率**: X%

### 失败用例详情
[详细描述失败的测试用例]

### 风险评估
[评估发现的问题对系统的影响]

### 建议措施
[针对发现问题的修复建议]
```

---

## 🔧 自动化工具

### 测试脚本结构
```
docs/09-bugs/test-scripts/
├── regression-test-suite.js     # 主回归测试套件
├── core-workflow-test.js        # 核心流程测试
├── bug-regression-test.js       # Bug回归测试
├── api-integration-test.js      # API集成测试
├── smoke-test.js                # 冒烟测试
├── environment-check.js         # 环境检查
└── utils/
    ├── test-helpers.js          # 测试辅助函数
    ├── api-client.js            # API客户端
    └── assertion-helpers.js     # 断言辅助函数
```

### CI/CD集成
```yaml
# .github/workflows/regression-test.yml
name: Regression Test
on:
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 2 * * *'  # 每日凌晨2点执行

jobs:
  regression-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm install
      - name: Start services
        run: ./run_local_all.sh &
      - name: Wait for services
        run: sleep 30
      - name: Run regression tests
        run: node docs/09-bugs/test-scripts/regression-test-suite.js
```

---

## 📈 持续改进

### 测试优化方向
1. **提高覆盖率**: 逐步增加边缘场景测试
2. **提升效率**: 优化测试执行时间
3. **增强稳定性**: 减少测试环境依赖
4. **扩展监控**: 添加性能和安全测试

### 规范更新机制
- **月度评审**: 分析测试执行情况
- **季度优化**: 更新测试用例和工具
- **年度升级**: 重构测试框架和策略

---

**维护团队**: AI项目控制中心  
**更新周期**: 每月评审，按需更新  
**相关文档**: 
- [Bug追踪记录](./bug-tracking.md)
- [文档命名规范](../02-specifications/SPEC-002-文档命名规范.md) 