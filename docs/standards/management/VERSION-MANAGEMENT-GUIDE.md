# EDM系统版本管理指南

**文档版本**: v1.0  
**更新时间**: 2025-06-04  
**适用范围**: 项目全生命周期  

## 📋 版本管理概述

### 核心原则
- **语义化版本控制** (Semantic Versioning)
- **Git Flow工作流**
- **自动化CI/CD**
- **环境隔离部署**
- **回滚保障机制**

---

## 🏗️ 版本控制策略

### 语义化版本格式
```
版本格式: MAJOR.MINOR.PATCH

示例: v1.0.0, v1.1.0, v1.1.1

MAJOR: 不兼容的API修改
MINOR: 向下兼容的功能性新增
PATCH: 向下兼容的问题修正
```

### 版本号规则
- **主版本号 (MAJOR)**: 重大架构变更、不兼容更新
- **次版本号 (MINOR)**: 新功能添加、API扩展
- **修订号 (PATCH)**: Bug修复、安全补丁

### 预发布版本
```
alpha: v1.1.0-alpha.1 (内部测试)
beta:  v1.1.0-beta.1  (公开测试)
rc:    v1.1.0-rc.1    (发布候选)
```

---

## 🌿 Git分支策略 (Git Flow)

### 分支类型及用途

#### 主分支
```bash
main/master    # 生产环境代码，始终可部署
develop        # 开发分支，集成最新功能
```

#### 辅助分支
```bash
feature/*      # 功能开发分支
release/*      # 发布准备分支
hotfix/*       # 紧急修复分支
```

### 分支命名规范
```bash
# 功能分支
feature/contact-management
feature/email-template-editor
feature/user-authentication

# 发布分支
release/v1.1.0
release/v1.2.0

# 修复分支
hotfix/security-patch-v1.0.1
hotfix/email-send-bug-v1.1.1
```

### 工作流程示例

#### 1. 功能开发流程
```bash
# 从develop创建功能分支
git checkout develop
git pull origin develop
git checkout -b feature/new-dashboard

# 开发完成后合并回develop
git checkout develop
git merge feature/new-dashboard
git push origin develop
git branch -d feature/new-dashboard
```

#### 2. 发布流程
```bash
# 创建发布分支
git checkout develop
git checkout -b release/v1.1.0

# 发布准备（版本号更新、文档等）
# 合并到main
git checkout main
git merge release/v1.1.0
git tag v1.1.0
git push origin main --tags

# 合并回develop
git checkout develop
git merge release/v1.1.0
git push origin develop
```

#### 3. 紧急修复流程
```bash
# 从main创建hotfix分支
git checkout main
git checkout -b hotfix/v1.0.1

# 修复完成后
git checkout main
git merge hotfix/v1.0.1
git tag v1.0.1
git push origin main --tags

# 也要合并到develop
git checkout develop
git merge hotfix/v1.0.1
git push origin develop
```

---

## 🛠️ 推荐工具和平台

### 1. 代码托管平台

#### GitHub (推荐)
```bash
优势:
- 完善的协作功能
- GitHub Actions CI/CD
- 项目管理工具
- 社区生态丰富

特色功能:
- Pull Request审查
- Issues跟踪
- Projects看板
- Discussions讨论
```

#### GitLab
```bash
优势:
- 企业级功能
- 内置CI/CD
- 容器镜像仓库
- 安全扫描

适用场景:
- 企业内部部署
- 需要高级安全功能
- 完整DevOps流程
```

#### Gitee (码云)
```bash
优势:
- 国内访问速度快
- 中文界面友好
- 免费私有仓库

适用场景:
- 国内团队协作
- 对访问速度有要求
```

### 2. CI/CD工具推荐

#### GitHub Actions (强烈推荐)
```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    - name: Install dependencies
      run: npm ci
    - name: Run tests
      run: npm test
    - name: Run linting
      run: npm run lint

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
    - name: Deploy to production
      run: |
        # 部署脚本
```

#### Jenkins
```bash
特点:
- 插件丰富
- 自主部署
- 高度可定制

适用场景:
- 企业内部环境
- 复杂构建流程
- 需要高度定制
```

#### GitLab CI/CD
```yaml
# .gitlab-ci.yml
stages:
  - test
  - build
  - deploy

test:
  stage: test
  script:
    - npm install
    - npm test

deploy:
  stage: deploy
  script:
    - echo "Deploying to production"
  only:
    - main
```

### 3. 项目管理工具

#### GitHub Projects
```bash
功能:
- 看板管理
- 里程碑跟踪
- 自动化规则
- 与Issues集成

优势:
- 与代码仓库深度集成
- 免费使用
- 简单易用
```

#### Jira
```bash
功能:
- 敏捷项目管理
- 缺陷跟踪
- 报表分析
- 工作流定制

适用场景:
- 大型团队
- 复杂项目管理
- 需要详细报表
```

#### Notion
```bash
功能:
- 文档编写
- 项目规划
- 知识库管理
- 团队协作

适用场景:
- 小型团队
- 文档密集型项目
- 多功能整合需求
```

---

## 🔄 CI/CD最佳实践

### 1. 自动化测试策略
```bash
# 测试金字塔
单元测试 (Unit Tests)     # 70%
集成测试 (Integration)    # 20%
端到端测试 (E2E)         # 10%
```

### 2. 构建管道设计
```bash
阶段1: 代码检查
- ESLint代码规范
- Prettier格式化
- 安全漏洞扫描

阶段2: 测试执行
- 单元测试
- 集成测试
- 代码覆盖率检查

阶段3: 构建打包
- 前端构建
- 后端编译
- Docker镜像构建

阶段4: 部署发布
- 测试环境部署
- 生产环境部署
- 健康检查
```

### 3. 环境管理策略
```bash
开发环境 (Development)
- 本地开发
- 实时热更新
- 详细日志

测试环境 (Staging)
- 模拟生产配置
- 自动化测试
- 性能测试

生产环境 (Production)
- 高可用部署
- 监控告警
- 备份策略
```

---

## 📦 包管理和依赖版本控制

### 1. 包管理器选择

#### npm (推荐)
```json
{
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  },
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "test": "jest",
    "lint": "eslint .",
    "build": "webpack --mode production"
  }
}
```

#### Yarn
```bash
优势:
- 更快的安装速度
- 更好的缓存机制
- Workspaces支持

使用场景:
- 大型项目
- Monorepo架构
- 性能要求高
```

### 2. 依赖版本策略
```json
{
  "dependencies": {
    "express": "^4.18.0",      // 允许minor和patch更新
    "sequelize": "~6.32.0",    // 只允许patch更新
    "lodash": "4.17.21"        // 锁定版本
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "eslint": "^8.0.0"
  }
}
```

### 3. 锁文件管理
```bash
# package-lock.json 必须提交到版本控制
git add package-lock.json
git commit -m "chore: update package-lock.json"

# 确保团队使用相同的依赖版本
npm ci  # 而不是 npm install
```

---

## 🏷️ 版本发布流程

### 1. 发布前检查清单
```bash
- [ ] 所有测试通过
- [ ] 代码审查完成
- [ ] 更新变更日志
- [ ] 版本号确定
- [ ] 发布说明准备
- [ ] 回滚方案确认
```

### 2. 自动化发布脚本
```bash
#!/bin/bash
# scripts/release.sh

set -e

VERSION=$1
if [ -z "$VERSION" ]; then
  echo "请指定版本号: ./release.sh v1.1.0"
  exit 1
fi

echo "🚀 开始发布 $VERSION..."

# 检查工作目录是否干净
if [[ -n $(git status --porcelain) ]]; then
  echo "❌ 工作目录不干净，请先提交或暂存更改"
  exit 1
fi

# 确保在main分支
git checkout main
git pull origin main

# 运行测试
npm test

# 更新版本号
npm version $VERSION --no-git-tag-version

# 提交版本更新
git add package.json package-lock.json
git commit -m "chore: bump version to $VERSION"

# 创建标签
git tag $VERSION

# 推送到远程
git push origin main
git push origin $VERSION

echo "✅ 发布完成: $VERSION"
```

### 3. 变更日志管理
```markdown
# CHANGELOG.md

## [1.1.0] - 2025-06-04

### Added
- 新增联系人批量导入功能
- 添加邮件模板预览功能
- 支持邮件发送统计报表

### Changed
- 优化邮件发送性能
- 改进用户界面响应速度

### Fixed
- 修复联系人标签关联问题
- 解决邮件模板变量替换bug

### Security
- 加强JWT token安全性
- 更新依赖包安全版本
```

---

## 🔧 开发工具配置

### 1. Git配置优化
```bash
# 全局配置
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# 设置默认编辑器
git config --global core.editor "code --wait"

# 设置换行符处理
git config --global core.autocrlf input  # Linux/Mac
git config --global core.autocrlf true   # Windows

# 设置别名
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.st status
git config --global alias.lg "log --oneline --graph --decorate"
```

### 2. IDE/编辑器推荐配置

#### VS Code
```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.exclude": {
    "**/node_modules": true,
    "**/.git": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/build": true,
    "**/dist": true
  }
}
```

#### 推荐插件
```bash
- GitLens — Git supercharged
- ESLint
- Prettier - Code formatter
- Thunder Client (API测试)
- Git Graph
- Docker
```

### 3. 代码质量工具

#### ESLint配置
```json
// .eslintrc.js
module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended'
  ],
  rules: {
    'no-console': 'warn',
    'no-unused-vars': 'error',
    'prefer-const': 'error'
  }
};
```

#### Prettier配置
```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

---

## 📊 版本管理监控

### 1. 关键指标跟踪
```bash
发布频率: 平均每周/月发布次数
缺陷率: 每个版本的bug数量
回滚率: 需要回滚的发布比例
部署时间: 从代码提交到生产部署的时间
恢复时间: 发现问题到修复的时间
```

### 2. 版本质量评估
```bash
# 版本质量评分表
代码覆盖率 >= 80%     (25分)
0个高危安全漏洞       (25分)
通过所有自动化测试     (25分)
性能测试通过          (25分)

总分 >= 90分: 优秀
总分 >= 70分: 良好
总分 < 70分: 需要改进
```

---

## 🎯 团队协作规范

### 1. 代码审查标准
```bash
功能完整性:
- [ ] 功能按需求实现
- [ ] 边界条件处理
- [ ] 错误处理完善

代码质量:
- [ ] 代码可读性好
- [ ] 遵循编码规范
- [ ] 适当的注释

测试覆盖:
- [ ] 单元测试完整
- [ ] 测试用例有效
- [ ] 边界测试覆盖

安全考虑:
- [ ] 输入验证完整
- [ ] 权限控制正确
- [ ] 敏感信息保护
```

### 2. 提交信息规范
```bash
# 提交信息格式
<type>(<scope>): <subject>

<body>

<footer>

# 示例
feat(auth): add JWT token refresh mechanism

- Implement automatic token refresh
- Add refresh token validation
- Update token expiration handling

Closes #123
```

### 3. Pull Request模板
```markdown
## 变更说明
简要描述本次变更的内容和原因

## 变更类型
- [ ] 新功能 (feature)
- [ ] Bug修复 (bugfix)
- [ ] 性能优化 (performance)
- [ ] 重构 (refactor)
- [ ] 文档更新 (docs)
- [ ] 测试相关 (test)

## 测试情况
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 手动测试完成

## 检查清单
- [ ] 代码符合规范
- [ ] 添加/更新了测试
- [ ] 更新了文档
- [ ] 无破坏性变更
```

---

## 💡 进阶建议

### 1. Monorepo管理 (适合大型项目)
```bash
# 使用Lerna管理多包项目
npx lerna init

# 项目结构
edm-monorepo/
├── packages/
│   ├── frontend/
│   ├── backend/
│   ├── shared/
│   └── mobile/
├── tools/
└── docs/
```

### 2. 微服务版本管理
```bash
# 服务独立版本控制
user-service: v1.2.0
email-service: v1.1.3
template-service: v1.0.5

# API版本兼容性
GET /api/v1/users
GET /api/v2/users  # 向下兼容
```

### 3. 容器化版本管理
```dockerfile
# Dockerfile
FROM node:18-alpine

LABEL version="1.1.0"
LABEL description="EDM System Backend"

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
EXPOSE 3000

CMD ["npm", "start"]
```

---

## 📞 工具选择建议

### 小型团队 (1-5人)
```bash
代码托管: GitHub
项目管理: GitHub Projects
CI/CD: GitHub Actions
沟通: Discord/Slack
文档: GitHub Wiki + README
```

### 中型团队 (5-20人)
```bash
代码托管: GitHub/GitLab
项目管理: Jira + Confluence
CI/CD: GitHub Actions/GitLab CI
沟通: Slack + 定期会议
文档: Confluence + API文档
```

### 大型企业 (20+人)
```bash
代码托管: GitLab/企业GitHub
项目管理: Jira + 敏捷工具
CI/CD: Jenkins + Kubernetes
沟通: 企业IM + 视频会议
文档: 企业知识库 + API门户
```

---

**版本管理指南版本**: v1.0  
**最后更新**: 2025-06-04  
**适用版本**: EDM系统 v1.0+  
**维护负责人**: AI Assistant 