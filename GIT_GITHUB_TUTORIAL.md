# Git 和 GitHub 完整使用教程

## 📚 目录
1. [Git基础概念](#git基础概念)
2. [常用Git命令](#常用git命令)
3. [Git分支管理](#git分支管理)
4. [提交规范](#提交规范)
5. [GitHub操作](#github操作)
6. [实际工作流程](#实际工作流程)
7. [常见问题解决](#常见问题解决)

---

## 1. Git基础概念

### 🔍 Git是什么？
- **版本控制系统**：记录文件变化，可以回到任何历史版本
- **分布式**：每个人都有完整的代码历史
- **分支管理**：可以同时开发多个功能

### 📊 Git的三个区域
```
工作区 (Working Directory)  →  暂存区 (Staging Area)  →  仓库 (Repository)
     ↓ git add                    ↓ git commit              ↓ git push
   修改文件                      准备提交                 GitHub远程仓库
```

### 🏗 Git项目结构
```
EDM/
├── .git/           # Git仓库信息（隐藏文件夹）
├── src/            # 源代码
├── docs/           # 文档
├── .gitignore      # 忽略文件列表
└── README.md       # 项目说明
```

---

## 2. 常用Git命令

### 📋 初始化和配置
```bash
# 初始化Git仓库
git init

# 配置用户信息
git config user.name "您的名字"
git config user.email "您的邮箱"

# 查看配置
git config --list
```

### 📂 基础操作
```bash
# 查看状态
git status

# 添加文件到暂存区
git add 文件名
git add .              # 添加所有文件
git add src/           # 添加整个目录

# 提交到仓库
git commit -m "提交信息"

# 查看提交历史
git log
git log --oneline      # 简洁版本
```

### 🔍 查看和比较
```bash
# 查看文件差异
git diff              # 工作区 vs 暂存区
git diff --staged     # 暂存区 vs 仓库
git diff HEAD~1       # 与上一次提交比较

# 查看文件状态
git status
git status -s         # 简洁版本
```

---

## 3. Git分支管理

### 🌿 分支基础概念
- **main/master**：主分支，稳定版本
- **feature/功能名**：功能开发分支
- **bugfix/问题名**：bug修复分支
- **hotfix/紧急修复**：生产环境紧急修复

### 📊 分支操作
```bash
# 查看分支
git branch              # 本地分支
git branch -a           # 所有分支（包括远程）

# 创建分支
git branch feature/user-management
git checkout -b feature/user-management    # 创建并切换

# 切换分支
git checkout main
git checkout feature/user-management

# 删除分支
git branch -d feature/user-management      # 安全删除
git branch -D feature/user-management      # 强制删除
```

### 🔄 分支合并
```bash
# 合并分支到当前分支
git merge feature/user-management

# 变基合并（保持历史线性）
git rebase main
```

---

## 4. 提交规范

### 📝 提交信息格式
```
<type>(<scope>): <subject>

<body>

<footer>
```

### 🏷 Type类型
- **feat**：新功能
- **fix**：修复bug
- **docs**：文档更新
- **style**：代码格式（不影响逻辑）
- **refactor**：重构代码
- **test**：测试相关
- **chore**：构建工具、辅助工具等

### ✅ 提交示例
```bash
# 好的提交
git commit -m "feat(auth): 添加用户登录功能

- 新增登录API接口
- 添加JWT token验证
- 实现密码加密存储

closes #123"

# 简单提交
git commit -m "fix(ui): 修复按钮样式问题"

# 文档更新
git commit -m "docs: 更新API文档说明"
```

---

## 5. GitHub操作

### 🔗 连接GitHub
```bash
# 添加远程仓库
git remote add origin https://github.com/tony-amt/EDM.git

# 查看远程仓库
git remote -v

# 推送到GitHub
git push origin main                    # 推送主分支
git push origin feature/user-management # 推送功能分支
git push origin --all                   # 推送所有分支
```

### 📥 从GitHub获取更新
```bash
# 获取远程更新（不合并）
git fetch origin

# 拉取并合并
git pull origin main

# 查看远程分支
git branch -r
```

### 🔄 同步流程
```bash
# 1. 获取最新代码
git checkout main
git pull origin main

# 2. 创建功能分支
git checkout -b feature/new-feature

# 3. 开发功能...
git add .
git commit -m "feat: 新功能开发"

# 4. 推送到GitHub
git push origin feature/new-feature

# 5. 在GitHub创建Pull Request
# 6. 代码审查后合并到main
```

---

## 6. 实际工作流程

### 🚀 EDM项目开发流程

#### 第一步：准备环境
```bash
# 切换到项目目录
cd /opt/edm

# 检查当前状态
git status
git branch

# 确保在main分支并获取最新代码
git checkout main
git pull origin main
```

#### 第二步：创建功能分支
```bash
# 创建新功能分支
git checkout -b feature/email-template-system

# 开始开发...
```

#### 第三步：开发过程中提交
```bash
# 频繁提交（小步快跑）
git add src/controllers/template.controller.js
git commit -m "feat(template): 添加模板控制器基础结构"

git add src/services/template.service.js
git commit -m "feat(template): 实现模板CRUD操作"

git add src/routes/template.routes.js
git commit -m "feat(template): 添加模板API路由"
```

#### 第四步：功能完成后整理
```bash
# 最终提交
git add .
git commit -m "feat(template): 完成邮件模板管理系统

- 支持模板CRUD操作
- 富文本编辑器集成
- 模板预览功能
- 变量替换机制

测试状态: ✅ 所有功能正常"

# 推送到GitHub
git push origin feature/email-template-system
```

#### 第五步：合并到主分支
```bash
# 切换到main分支
git checkout main

# 合并功能分支
git merge feature/email-template-system

# 推送更新的main分支
git push origin main

# 删除已合并的功能分支
git branch -d feature/email-template-system
git push origin --delete feature/email-template-system
```

---

## 7. 常见问题解决

### ❌ 常见错误

#### 1. 推送被拒绝
```bash
# 错误信息：Updates were rejected because the remote contains work...
# 解决方案：
git pull origin main          # 先拉取远程更新
git push origin main          # 再推送
```

#### 2. 合并冲突
```bash
# 出现冲突时：
git status                    # 查看冲突文件
# 手动编辑冲突文件，删除 <<<<<<< ======= >>>>>>> 标记
git add 冲突文件名
git commit -m "resolve: 解决合并冲突"
```

#### 3. 撤销操作
```bash
# 撤销工作区修改
git checkout -- 文件名

# 撤销暂存区
git reset HEAD 文件名

# 撤销最后一次提交（保留修改）
git reset HEAD~1

# 撤销最后一次提交（丢弃修改）
git reset --hard HEAD~1
```

### 🛠 实用技巧

#### 1. 查看图形化分支
```bash
git log --graph --oneline --all
```

#### 2. 暂存工作进度
```bash
git stash                     # 暂存当前修改
git stash pop                 # 恢复暂存的修改
git stash list                # 查看暂存列表
```

#### 3. 标签管理
```bash
git tag v1.0.0                # 创建标签
git tag -a v1.0.0 -m "版本1.0.0发布"  # 带注释的标签
git push origin --tags        # 推送标签到GitHub
```

---

## 🎯 EDM项目Git最佳实践

### 📋 分支命名规范
```
feature/功能名称               # 新功能开发
bugfix/bug描述                # bug修复  
hotfix/紧急修复描述           # 生产环境紧急修复
refactor/重构内容             # 代码重构
docs/文档更新内容             # 文档更新
```

### 📝 提交频率建议
- **小功能**：完成一个小功能就提交
- **大功能**：按逻辑模块分步提交
- **bug修复**：修复一个bug就提交
- **每日工作结束前**：确保当天工作已提交

### 🔄 合并策略
1. **feature分支**：开发完成后合并到main
2. **hotfix分支**：紧急修复直接合并到main
3. **main分支**：始终保持稳定可发布状态

### 📊 团队协作流程
1. **创建Issue**：在GitHub上描述需求或bug
2. **创建分支**：基于Issue创建对应分支
3. **开发功能**：在分支上开发并频繁提交
4. **推送分支**：推送到GitHub远程仓库
5. **创建PR**：创建Pull Request请求合并
6. **代码审查**：团队成员审查代码
7. **合并代码**：审查通过后合并到main
8. **部署发布**：从main分支部署到生产环境

---

## 🎓 学习建议

### 📚 学习路径
1. **Git基础**：理解工作区、暂存区、仓库概念
2. **分支操作**：熟练掌握分支创建、切换、合并
3. **远程操作**：学会与GitHub同步
4. **冲突解决**：学会处理合并冲突
5. **高级功能**：rebase、cherry-pick、bisect等

### 🛠 推荐工具
- **命令行**：Git Bash（Windows）或Terminal（Mac/Linux）
- **图形界面**：
  - SourceTree（免费，直观）
  - GitKraken（功能强大）
  - VS Code内置Git功能
  - GitHub Desktop（简单易用）

### 📖 学习资源
- 官方文档：https://git-scm.com/doc
- 交互式教程：https://learngitbranching.js.org/
- 廖雪峰Git教程：https://www.liaoxuefeng.com/wiki/896043488029600

---

## 🔗 快速参考

### 常用命令速查
```bash
# 状态查看
git status               # 查看状态
git log --oneline        # 查看提交历史
git branch -a            # 查看所有分支

# 分支操作
git checkout -b 分支名    # 创建并切换分支
git checkout main        # 切换到main分支
git merge 分支名         # 合并分支

# 远程操作  
git pull origin main     # 拉取远程更新
git push origin 分支名   # 推送分支
git fetch origin         # 获取远程信息

# 提交操作
git add .                # 添加所有文件
git commit -m "信息"     # 提交
git push                 # 推送到远程
```

---

## 💡 总结

Git和GitHub是现代软件开发的基础工具。掌握它们可以：

✅ **版本控制**：永远不会丢失代码，可以回到任何历史版本  
✅ **团队协作**：多人同时开发，不会冲突  
✅ **代码备份**：代码安全存储在云端  
✅ **功能隔离**：不同功能在不同分支开发，互不影响  
✅ **发布管理**：可以管理不同版本的发布  

记住：**小步快跑，频繁提交，保持main分支稳定！** 🚀 