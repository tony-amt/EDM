# 📦 GitHub代码备份指南

## 🎯 **目标**
将EDM系统代码备份到GitHub，为部署做准备。

## 📋 **步骤说明**

### **1. 创建GitHub仓库**

#### **方法一：通过GitHub网站**
1. 访问 https://github.com
2. 点击右上角 "+" → "New repository"
3. 填写仓库信息：
   - Repository name: `EDM` 或 `edm-email-system`
   - Description: `EDM邮件营销系统 - 完整功能的邮件直销平台`
   - 选择 `Public` 或 `Private`（推荐Private）
   - **不要**勾选 "Add a README file"
   - **不要**勾选 "Add .gitignore"
   - **不要**勾选 "Choose a license"
4. 点击 "Create repository"

#### **方法二：通过GitHub CLI（如果已安装）**
```bash
gh repo create EDM --private --description "EDM邮件营销系统"
```

### **2. 推送代码到GitHub**

创建仓库后，GitHub会显示推送命令，类似：

```bash
# 添加远程仓库
git remote add origin https://github.com/YOUR_USERNAME/EDM.git

# 推送代码
git branch -M main
git push -u origin main
```

### **3. 验证推送成功**

推送完成后，访问您的GitHub仓库页面，应该能看到：
- ✅ 所有项目文件
- ✅ README.md 文件
- ✅ DEPLOYMENT.md 部署指南
- ✅ deploy/ 目录下的部署脚本
- ✅ 完整的项目结构

## 🔧 **如果遇到问题**

### **问题1：推送被拒绝**
```bash
# 如果遇到推送被拒绝，先拉取远程更改
git pull origin main --allow-unrelated-histories
git push -u origin main
```

### **问题2：认证失败**
- 确保GitHub用户名和密码正确
- 如果启用了2FA，需要使用Personal Access Token
- 生成Token：GitHub → Settings → Developer settings → Personal access tokens

### **问题3：仓库已存在内容**
```bash
# 强制推送（谨慎使用）
git push -u origin main --force
```

## 📝 **推送完成后**

代码成功推送到GitHub后，请提供以下信息：

```
GitHub仓库地址: https://github.com/YOUR_USERNAME/EDM
仓库访问权限: Public/Private
```

这样我就可以在部署时直接从GitHub克隆代码到服务器。

## 🚀 **下一步**

代码备份完成后，您可以：
1. 📖 查看 `DEPLOYMENT.md` 了解部署计划
2. 🛒 按照 `deploy/server-requirements.md` 购买服务器
3. 📞 提供服务器信息，开始一键部署

---

**代码备份是部署的第一步，让我们确保一切准备就绪！** ✨ 