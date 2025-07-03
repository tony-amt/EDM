# EDM邮件营销系统 🚀

[![CI/CD Status](https://github.com/tony-amt/EDM/workflows/Continuous%20Integration/badge.svg)](https://github.com/tony-amt/EDM/actions)
[![Deploy Status](https://github.com/tony-amt/EDM/workflows/Deploy%20to%20Production/badge.svg)](https://github.com/tony-amt/EDM/actions)
[![Version](https://img.shields.io/badge/version-v1.1-blue.svg)](https://github.com/tony-amt/EDM/releases)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> 🎯 **企业级邮件直销(EDM)系统** - 支持批量邮件发送、智能追踪、数据分析的完整解决方案

**生产环境**: [https://tkmail.fun](https://tkmail.fun)

## 🧭 快速导航

**🤖 AI Coding入口**: [PROJECT-GUIDE.md](PROJECT-GUIDE.md) - 5分钟快速了解项目全貌  
**📚 完整文档中心**: [docs/README.md](docs/README.md) - 详细技术文档和规范  
**🛠️ 开发工具**: [tools/README.md](tools/README.md) - 开发和分析工具  
**🚀 部署配置**: [deploy/README.md](deploy/README.md) - 部署脚本和配置  

---

## 📋 项目概述

EDM邮件营销系统是一个功能完整的企业级邮件直销平台，采用现代化的微服务架构，支持高并发邮件发送、实时追踪统计、智能任务调度等核心功能。

### 🎯 核心价值
- **高性能**: 支持每小时10万+邮件发送
- **智能化**: AI驱动的发送优化和用户分析  
- **企业级**: 完整的权限管理和审计日志
- **可扩展**: 微服务架构，支持水平扩展

---

## ✨ 功能特性

### 📧 邮件发送
- ✅ 批量邮件发送，支持HTML/纯文本格式
- ✅ 多发信服务智能轮询和负载均衡
- ✅ 发送频率控制和反垃圾邮件优化
- ✅ 邮件模板管理和个性化变量替换

### 👥 联系人管理  
- ✅ 多级标签系统，支持复杂分组逻辑
- ✅ 联系人导入导出(CSV/Excel)
- ✅ 重复联系人智能去重
- ✅ 联系人生命周期管理

### 📊 数据分析
- ✅ 实时邮件追踪(打开/点击/退订)
- ✅ 详细的发送报告和转化分析
- ✅ A/B测试支持和效果对比
- ✅ 数据可视化Dashboard

### ⚙️ 系统管理
- ✅ 多用户权限管理
- ✅ 任务队列和智能调度
- ✅ 系统监控和告警
- ✅ 完整的操作审计日志

---

## 🏗️ 技术架构

### 后端技术栈
```bash
Node.js + Express.js     # 服务端框架
PostgreSQL              # 主数据库
Redis                   # 缓存和队列
Sequelize              # ORM框架
Docker                 # 容器化部署
JWT                    # 身份认证
```

### 前端技术栈
```bash
React + TypeScript     # 前端框架
Ant Design            # UI组件库
React Router          # 路由管理
Axios                 # HTTP客户端
Webpack               # 构建工具
```

### DevOps工具链
```bash
GitHub Actions        # CI/CD自动化
Docker Compose        # 本地开发环境
Nginx                 # 反向代理
Let's Encrypt         # SSL证书
```

---

## 🚀 快速开始

### 环境要求
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 13+
- Redis 6+

### 本地开发
```bash
# 1. 克隆项目
git clone https://github.com/tony-amt/EDM.git
cd EDM

# 2. 安装依赖
cd src/backend && npm install
cd ../frontend && npm install

# 3. 启动开发环境
docker-compose up -d

# 4. 访问系统
# 前端: http://localhost:3001
# 后端: http://localhost:3000
# API文档: http://localhost:3000/api-docs
```

### 默认管理员账号
```bash
用户名: admin
密码: admin123456
```

---

## 📦 部署指南

### 生产环境部署
```bash
# 1. 服务器要求
CPU: 2核+, 内存: 4GB+, 存储: 50GB+
系统: Ubuntu 20.04+ / CentOS 8+

# 2. 一键部署
git clone https://github.com/tony-amt/EDM.git
cd EDM
./scripts/deploy.sh

# 3. 健康检查
./scripts/health-check.sh
```

### 环境配置
```bash
# 生产环境变量 (.env.production)
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379
JWT_SECRET=your-secret-key
ENGAGELAB_API_KEY=your-api-key
```

---

## 🔄 版本管理与发布流程

### 分支策略 (GitFlow)
```bash
main                    # 🔒 生产环境 (受保护)
├── develop            # 🧪 开发环境
├── release/v1.x       # 🚀 发布准备
├── feature/xxx        # ✨ 功能开发
├── hotfix/xxx         # 🚨 紧急修复
└── bugfix/xxx         # 🐛 问题修复
```

### 发布流程
```bash
# 1. 功能开发
git checkout develop
git checkout -b feature/new-feature
# ... 开发和测试
git push origin feature/new-feature
# 创建PR到develop分支

# 2. 发布准备  
git checkout -b release/v1.2.0
# ... 最终测试和文档更新
git checkout main
git merge release/v1.2.0
git tag v1.2.0
git push origin main --tags

# 3. 自动部署
# GitHub Actions自动触发部署到生产环境
```

### 版本规范
- **v1.0.0**: 主版本.次版本.修订版本 (语义化版本控制)
- **标签触发**: 推送版本标签自动部署到生产环境
- **回滚支持**: 一键回滚到任意历史版本

---

## 📋 团队协作规范

> ⚠️ **重要**: 所有团队成员必须严格遵守以下开发规范，确保项目质量和团队协作效率

### 🔒 分支保护规则
```bash
✅ main分支受保护，禁止直接推送
✅ 必须通过Pull Request合并代码
✅ 需要至少1人代码审查通过
✅ 必须通过所有自动化测试
✅ 分支必须与main保持同步
```

### 📝 提交信息规范
```bash
格式: <type>(<scope>): <subject>

类型说明:
feat     # ✨ 新功能
fix      # 🐛 修复问题  
docs     # 📚 文档更新
style    # 💄 代码格式
refactor # ♻️ 重构代码
perf     # ⚡ 性能优化
test     # ✅ 测试相关
chore    # 🔧 构建/工具

示例:
feat(auth): 添加双因子认证功能
fix(email): 修复模板渲染问题
docs(api): 更新API文档
```

### 🧪 代码质量要求
```bash
✅ 代码必须通过ESLint检查
✅ 测试覆盖率不低于80%
✅ 所有API必须有文档说明
✅ 关键功能必须有单元测试
✅ 安全漏洞必须及时修复
```

### 🔄 工作流程
```bash
1. 📋 需求分析 → 创建Issue讨论
2. 🌿 创建分支 → feature/issue-123
3. 💻 编码开发 → 遵循代码规范
4. 🧪 自测验证 → 本地测试通过
5. 📤 提交PR → 详细描述变更
6. 👀 代码审查 → 团队成员Review
7. ✅ 合并代码 → 自动化测试通过
8. 🚀 发布部署 → 版本标签触发
```

### 📚 文档维护要求
```bash
✅ API变更必须更新文档
✅ 新功能必须有使用说明
✅ 配置变更必须更新README
✅ 重要决策必须记录在docs/
✅ 版本发布必须更新CHANGELOG
```

---

## 🛠️ 开发工具和规范

### 代码编辑器配置
```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.quoteStyle": "single"
}
```

### Git Hooks
```bash
# 提交前自动检查
pre-commit: 代码格式化 + ESLint检查
pre-push: 运行测试套件
commit-msg: 验证提交信息格式
```

---

## 📊 项目监控

### 系统状态
- 🟢 **生产环境**: https://tkmail.fun
- 📊 **监控面板**: 内置系统监控
- 📈 **性能指标**: 响应时间 < 200ms
- 🔍 **错误率**: < 0.1%

### CI/CD状态
- ✅ **自动化测试**: GitHub Actions
- 🚀 **自动部署**: 标签触发部署
- 🔄 **自动回滚**: 健康检查失败时触发
- 📦 **容器化**: Docker多阶段构建

---

## 🤝 贡献指南

### 参与贡献
1. 🍴 Fork项目到个人仓库
2. 🌿 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 💻 编写代码并添加测试
4. ✅ 确保所有测试通过
5. 📝 提交代码 (`git commit -m 'feat: add amazing feature'`)
6. 📤 推送分支 (`git push origin feature/amazing-feature`)
7. 🔄 创建Pull Request

### 代码审查检查清单
- [ ] 功能是否按预期工作
- [ ] 代码是否遵循项目规范
- [ ] 是否有足够的测试覆盖
- [ ] 是否更新了相关文档
- [ ] 是否考虑了安全性问题
- [ ] 性能是否有影响

---

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

---

## 📞 支持与联系

### 问题反馈
- 🐛 **Bug报告**: [创建Issue](https://github.com/tony-amt/EDM/issues/new?template=bug_report.md)
- 💡 **功能建议**: [创建Issue](https://github.com/tony-amt/EDM/issues/new?template=feature_request.md)
- ❓ **使用问题**: [查看Wiki](https://github.com/tony-amt/EDM/wiki)

### 开发团队
- 📧 **邮箱**: dev@tkmail.fun
- 💬 **讨论**: [GitHub Discussions](https://github.com/tony-amt/EDM/discussions)

---

## 📈 项目路线图

### v1.2.0 (计划中)
- [ ] 邮件模板可视化编辑器
- [ ] 高级A/B测试功能
- [ ] 微信集成支持

### v2.0.0 (规划中)  
- [ ] 多租户SaaS架构
- [ ] AI智能推荐系统
- [ ] 移动端APP

---

**⭐ 如果这个项目对您有帮助，请给我们一个Star！**

---
<div align="center">

**版本**: v1.1 | **更新**: 2025-01-13 | **状态**: 🟢 生产环境稳定运行

Made with ❤️ by [Tony](https://github.com/tony-amt)

</div>