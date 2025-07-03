# SPEC-009 项目目录结构规范

## 📋 文档信息
- **文档编号**: SPEC-009
- **文档标题**: 项目目录结构规范
- **创建时间**: 2025-01-13
- **版本**: v1.0
- **负责人**: 项目主控Agent
- **状态**: 生效中

## 🎯 规范目标

建立清晰、标准化的项目目录结构，让AI Coding和团队成员能够快速理解项目信息，提高开发效率。

## 📂 标准项目结构

```
EDM/                                    # 项目根目录
├── README.md                          # 项目主要说明文档
├── CHANGELOG.md                       # 版本变更记录
├── LICENSE                            # 开源许可证
├── package.json                       # 项目配置和脚本
├── .gitignore                         # Git忽略文件配置
├── docker-compose.yml                 # 主要的Docker编排文件
│
├── .github/                           # GitHub配置
│   ├── workflows/                     # GitHub Actions工作流
│   ├── ISSUE_TEMPLATE/               # Issue模板
│   └── pull_request_template.md      # PR模板
│
├── .vscode/                          # VSCode工作区配置
│   ├── settings.json                 # 编辑器设置
│   └── extensions.json               # 推荐扩展
│
├── .husky/                           # Git Hooks配置
│   ├── pre-commit                    # 提交前检查
│   └── commit-msg                    # 提交信息验证
│
├── src/                              # 源代码目录
│   ├── frontend/                     # 前端代码
│   └── backend/                      # 后端代码
│
├── docs/                             # 文档中心
│   ├── README.md                     # 文档导航
│   ├── 01-requirements/             # 需求文档
│   ├── 02-specifications/           # 技术规范
│   ├── 03-design/                   # 设计文档
│   ├── 04-development/              # 开发文档
│   ├── 05-testing/                  # 测试文档
│   ├── 06-operation/                # 运维文档
│   ├── 07-user/                     # 用户文档
│   └── 08-changes/                  # 变更记录
│
├── scripts/                          # 脚本工具
│   ├── deploy.sh                     # 部署脚本
│   ├── health-check.sh              # 健康检查
│   ├── backup.sh                    # 备份脚本
│   └── validate-project-standards.sh # 项目规范验证
│
├── config/                           # 配置文件
│   ├── frontend.env.development      # 前端开发环境配置
│   ├── frontend.env.production       # 前端生产环境配置
│   └── ports.json                   # 端口配置
│
├── deploy/                           # 部署相关
│   ├── docker/                      # Docker配置文件
│   ├── nginx/                       # Nginx配置
│   ├── ssl/                         # SSL证书
│   └── scripts/                     # 部署脚本
│
├── tests/                            # 测试文件
│   ├── unit/                        # 单元测试
│   ├── integration/                 # 集成测试
│   ├── e2e/                         # 端到端测试
│   └── performance/                 # 性能测试
│
├── tools/                           # 开发工具
│   ├── analysis/                    # 分析工具
│   ├── generators/                  # 代码生成器
│   └── utilities/                   # 实用工具
│
├── data/                            # 数据目录 (开发环境)
│   ├── postgres/                    # PostgreSQL数据
│   ├── redis/                       # Redis数据
│   └── uploads/                     # 上传文件
│
└── temp/                            # 临时文件 (Git忽略)
    ├── logs/                        # 临时日志
    ├── cache/                       # 缓存文件
    └── downloads/                   # 临时下载
```

## 🧹 清理原则

### 📋 根目录保留文件
**只保留以下必要文件：**
- `README.md` - 项目主要说明
- `CHANGELOG.md` - 版本变更记录
- `LICENSE` - 开源许可证
- `package.json` - 项目配置
- `.gitignore` - Git配置
- `docker-compose.yml` - 主要Docker配置

### 🗂️ 文件分类规则
1. **配置文件** → `config/`
2. **部署相关** → `deploy/`
3. **脚本工具** → `scripts/tools/`
4. **测试文件** → `tests/`
5. **文档资料** → `docs/`
6. **临时文件** → `temp/` (Git忽略)

### 🚫 清理目标
- 删除重复文件
- 移动错位文件
- 合并相似功能
- 清理临时文件

## 📝 命名规范

### 📁 目录命名
- 使用小写字母和连字符
- 避免空格和特殊字符
- 使用英文命名
- 保持简洁明了

### 📄 文件命名
- 配置文件：`service.env.environment`
- 脚本文件：`action-description.sh`
- 文档文件：`TYPE-NUMBER-description.md`
- 工具文件：`tool-name.js`

## 🔍 AI Coding友好设计

### 📖 快速理解设计
1. **README.md** - 5分钟了解项目全貌
2. **docs/README.md** - 完整文档导航
3. **src/README.md** - 代码结构说明
4. **标准化命名** - 一看就懂的文件名

### 🎯 信息层级
```
Level 1: README.md          (项目概览)
Level 2: docs/README.md     (详细文档)
Level 3: 具体功能文档        (实现细节)
```

### 🔗 关联关系
- 每个目录都有README.md说明
- 文档之间有清晰的链接关系
- 代码和文档保持同步

## ✅ 实施步骤

### 阶段1: 创建新目录结构
- [ ] 创建标准目录
- [ ] 添加目录说明文件

### 阶段2: 文件分类整理
- [ ] 移动配置文件到config/
- [ ] 整理部署文件到deploy/
- [ ] 归类脚本到scripts/tools/

### 阶段3: 清理和优化
- [ ] 删除重复文件
- [ ] 更新文档链接
- [ ] 验证项目结构

### 阶段4: 文档完善
- [ ] 更新README.md
- [ ] 完善目录说明
- [ ] 建立导航体系

## 📊 效果评估

### 🎯 预期收益
- **AI理解时间**: 从30分钟降低到5分钟
- **新人上手时间**: 从2小时降低到30分钟
- **文件查找效率**: 提升80%
- **沟通歧义**: 减少70%

### 📈 评估指标
- 目录层级深度 ≤ 3层
- 根目录文件数量 ≤ 10个
- 每个目录都有说明文档
- 文档链接完整性 100%

## 🛠️ 维护规范

### 📋 日常维护
- 新文件必须放在正确目录
- 定期清理临时文件
- 及时更新文档链接
- 保持命名规范一致

### 🔍 定期检查
- 每月检查目录结构
- 季度优化组织方式
- 年度重构评估

---

**文档版本**: v1.0  
**最后更新**: 2025-01-13  
**审核状态**: ✅ 已审核通过 