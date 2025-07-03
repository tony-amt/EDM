# SPEC-007 GitHub版本管理与CI/CD规范

## 📋 概述

本文档规定了EDM系统基于GitHub的版本管理、分支策略、自动化部署和回滚流程。

## 🌳 分支管理策略

### 分支类型
```bash
main                    # 生产环境分支（受保护）
├── develop            # 开发环境分支
├── release/v1.x       # 发布准备分支
├── feature/xxx        # 功能开发分支
├── hotfix/xxx         # 紧急修复分支
└── bugfix/xxx         # 问题修复分支
```

### 分支规则
```bash
# main分支（生产环境）
- 只能通过PR合并
- 需要代码审查
- 必须通过所有测试
- 自动部署到生产环境
- 禁止直接推送

# develop分支（开发环境）
- 日常开发的主分支
- 功能分支合并目标
- 自动部署到测试环境
- 定期合并到release分支

# feature分支（功能开发）
- 从develop分支创建
- 命名：feature/功能描述
- 开发完成后合并回develop
- 删除已合并的feature分支
```

### 分支命名规范
```bash
# 功能开发
feature/user-management
feature/email-template-editor
feature/campaign-analytics

# 问题修复
bugfix/login-validation
bugfix/email-sending-error

# 紧急修复
hotfix/security-patch
hotfix/critical-bug-fix

# 发布准备
release/v1.1.0
release/v2.0.0
```

## 🏷️ 版本标签规范

### 语义化版本控制
```bash
# 版本格式：MAJOR.MINOR.PATCH
v1.0.0    # 主版本.次版本.修订版本

# 版本递增规则
MAJOR     # 不兼容的API修改
MINOR     # 向下兼容的功能性新增
PATCH     # 向下兼容的问题修正
```

### 标签示例
```bash
v1.0.0    # 首个生产版本
v1.0.1    # 修复版本
v1.1.0    # 功能更新版本
v2.0.0    # 重大版本更新
```

### 预发布版本
```bash
v1.1.0-alpha.1    # 内部测试版本
v1.1.0-beta.1     # 公开测试版本
v1.1.0-rc.1       # 发布候选版本
```

## 🚀 CI/CD流程设计

### GitHub Actions工作流

#### 1. 持续集成（CI）
```yaml
# .github/workflows/ci.yml
name: Continuous Integration

on:
  push:
    branches: [ develop, main ]
  pull_request:
    branches: [ develop, main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: |
        cd src/backend && npm ci
        cd ../frontend && npm ci
    
    - name: Run backend tests
      run: cd src/backend && npm test
      
    - name: Run frontend tests
      run: cd src/frontend && npm test -- --coverage --watchAll=false
    
    - name: Build frontend
      run: cd src/frontend && npm run build
    
    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
```

#### 2. 自动部署（CD）
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    tags:
      - 'v*.*.*'

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Build frontend
      run: |
        cd src/frontend
        npm ci
        npm run build
    
    - name: Build Docker images
      run: |
        docker build -t edm-frontend:${{ github.ref_name }} src/frontend/
        docker build -t edm-backend:${{ github.ref_name }} src/backend/
    
    - name: Deploy to server
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.HOST }}
        username: ${{ secrets.USERNAME }}
        key: ${{ secrets.SSH_KEY }}
        script: |
          # 备份当前版本
          ./scripts/backup.sh
          
          # 拉取新代码
          cd /opt/edm
          git fetch --tags
          git checkout ${{ github.ref_name }}
          
          # 部署新版本
          ./scripts/deploy.sh ${{ github.ref_name }}
          
          # 健康检查
          ./scripts/health-check.sh
```

#### 3. 质量检查
```yaml
# .github/workflows/quality.yml
name: Code Quality

on:
  pull_request:
    branches: [ develop, main ]

jobs:
  quality:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: |
        cd src/backend && npm ci
        cd ../frontend && npm ci
    
    - name: Run ESLint
      run: |
        cd src/backend && npm run lint
        cd ../frontend && npm run lint
    
    - name: Run security audit
      run: |
        cd src/backend && npm audit --audit-level moderate
        cd ../frontend && npm audit --audit-level moderate
    
    - name: Check dependencies
      run: |
        cd src/backend && npm outdated || true
        cd ../frontend && npm outdated || true
```

## 📦 发布流程

### 1. 功能开发流程
```bash
# 1. 创建功能分支
git checkout develop
git pull origin develop
git checkout -b feature/new-feature

# 2. 开发和提交
git add .
git commit -m "feat: 添加新功能"
git push origin feature/new-feature

# 3. 创建Pull Request
# - 目标分支：develop
# - 添加描述和截图
# - 请求代码审查

# 4. 合并后清理
git checkout develop
git pull origin develop
git branch -d feature/new-feature
```

### 2. 发布准备流程
```bash
# 1. 创建发布分支
git checkout develop
git pull origin develop
git checkout -b release/v1.1.0

# 2. 更新版本号
# 更新package.json中的版本号
# 更新CHANGELOG.md

# 3. 测试和修复
# 在发布分支上进行最终测试
# 修复发现的问题

# 4. 合并到main
git checkout main
git merge release/v1.1.0
git tag v1.1.0
git push origin main --tags

# 5. 回合并到develop
git checkout develop
git merge release/v1.1.0
git push origin develop

# 6. 删除发布分支
git branch -d release/v1.1.0
```

### 3. 紧急修复流程
```bash
# 1. 从main创建hotfix分支
git checkout main
git pull origin main
git checkout -b hotfix/critical-fix

# 2. 修复问题
git add .
git commit -m "fix: 修复关键问题"
git push origin hotfix/critical-fix

# 3. 快速合并到main
git checkout main
git merge hotfix/critical-fix
git tag v1.0.1
git push origin main --tags

# 4. 回合并到develop
git checkout develop
git merge hotfix/critical-fix
git push origin develop

# 5. 清理分支
git branch -d hotfix/critical-fix
```

## 🔄 自动化回滚机制

### 回滚触发条件
```bash
# 自动回滚条件
- 健康检查失败
- API错误率 > 5%
- 响应时间 > 10秒
- 服务不可用 > 2分钟

# 手动回滚条件
- 发现严重功能问题
- 安全漏洞
- 数据完整性问题
```

### 回滚脚本
```bash
#!/bin/bash
# scripts/rollback.sh

set -e

PREVIOUS_TAG=${1:-$(git describe --tags --abbrev=0 HEAD~1)}

echo "🔄 开始回滚到版本: $PREVIOUS_TAG"

# 1. 备份当前状态
./scripts/backup.sh

# 2. 停止当前服务
docker stop edm-frontend-prod edm-backend-prod

# 3. 启动前一版本
docker run -d --name edm-frontend-prod \
  --network edm_edm-network \
  --restart unless-stopped \
  edm-frontend:$PREVIOUS_TAG

docker run -d --name edm-backend-prod \
  --network edm_edm-network \
  --restart unless-stopped \
  edm-backend:$PREVIOUS_TAG

# 4. 健康检查
sleep 30
./scripts/health-check.sh

echo "✅ 回滚完成到版本: $PREVIOUS_TAG"
```

### 自动回滚工作流
```yaml
# .github/workflows/auto-rollback.yml
name: Auto Rollback

on:
  workflow_run:
    workflows: ["Deploy to Production"]
    types:
      - completed

jobs:
  health-check:
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    
    steps:
    - name: Wait for deployment
      run: sleep 120
    
    - name: Health check
      run: |
        for i in {1..5}; do
          if curl -f https://tkmail.fun/api/health; then
            echo "Health check passed"
            exit 0
          fi
          sleep 30
        done
        echo "Health check failed"
        exit 1
    
    - name: Rollback on failure
      if: failure()
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.HOST }}
        username: ${{ secrets.USERNAME }}
        key: ${{ secrets.SSH_KEY }}
        script: |
          cd /opt/edm
          ./scripts/rollback.sh
```

## 📋 提交信息规范

### 提交信息格式
```bash
<type>(<scope>): <subject>

<body>

<footer>
```

### 类型说明
```bash
feat     # 新功能
fix      # 修复问题
docs     # 文档变更
style    # 代码格式（不影响功能）
refactor # 重构（不是新增功能，也不是修复问题）
perf     # 性能优化
test     # 增加测试
chore    # 构建过程或辅助工具的变动
```

### 提交示例
```bash
feat(auth): 添加双因子认证功能

- 实现TOTP验证
- 添加备用恢复码
- 更新用户设置页面

Closes #123
```

## 🔐 安全配置

### GitHub仓库设置
```bash
# 分支保护规则
- main分支：
  ✅ 需要PR审查
  ✅ 需要状态检查通过
  ✅ 需要分支为最新
  ✅ 包括管理员
  ✅ 限制推送

# Secrets管理
HOST                # 服务器地址
USERNAME           # 服务器用户名
SSH_KEY            # SSH私钥
DOCKER_USERNAME    # Docker Hub用户名
DOCKER_PASSWORD    # Docker Hub密码
```

### 访问控制
```bash
# 团队权限
- Admin: 项目负责人
- Write: 核心开发者
- Read: 其他协作者

# 审查要求
- 至少1人审查
- 代码所有者审查
- 状态检查必须通过
```

## 📊 监控与告警

### 部署监控
```bash
# GitHub Actions通知
- 部署成功/失败通知
- 测试结果报告
- 安全扫描结果

# 服务监控
- 部署后自动健康检查
- 性能指标监控
- 错误率监控
```

### 告警配置
```bash
# 告警渠道
- GitHub Issues自动创建
- 邮件通知
- 即时消息通知

# 告警条件
- 构建失败
- 部署失败
- 健康检查失败
- 安全漏洞发现
```

## 🔗 相关文档
- [生产环境管理规范](./SPEC-006-生产环境管理规范.md)
- [代码规范](../standards/development/DEVELOPMENT-STANDARDS.md)
- [测试规范](../standards/testing/README.md)

---
**文档版本**：v1.0  
**创建日期**：2025-01-13  
**最后更新**：2025-01-13  
**维护人员**：开发团队 