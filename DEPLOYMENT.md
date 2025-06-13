# 🚀 EDM邮件营销系统 - 部署指南

## 📋 **执行计划总览**

### **阶段一：代码备份（✅ 已完成）**
- [x] 创建GitHub仓库
- [x] 备份当前代码
- [x] 创建部署脚本和文档

### **阶段二：购买服务器（您执行）**
1. 购买腾讯云服务器
2. 获取服务器信息
3. 提供SSH访问权限

### **阶段三：一键部署（我执行）**
1. 远程连接服务器
2. 环境配置
3. 代码部署
4. 域名配置
5. SSL证书
6. 测试验证

---

## 🛒 **服务器购买指南**

### **推荐配置**
- **CPU**: 2核心 (推荐4核心)
- **内存**: 4GB (推荐8GB)  
- **硬盘**: 40GB系统盘 + 100GB数据盘
- **带宽**: 5Mbps (推荐10Mbps)
- **地域**: 香港/新加坡 (海外用户访问更快)
- **系统**: Ubuntu 20.04 LTS 64位

### **预估费用**
- **2核4GB**: ¥280-350/月
- **4核8GB**: ¥520-680/月
- **带宽费用**: ¥30-60/月
- **数据盘**: ¥30-50/月
- **域名**: ¥50-100/年

**总计**: ¥350-520/月

### **购买步骤**
详细购买指南请查看：[`deploy/server-requirements.md`](deploy/server-requirements.md)

---

## 🔧 **购买完成后提供信息**

购买服务器后，请提供以下信息：

```bash
# 服务器信息
服务器公网IP: xxx.xxx.xxx.xxx
root密码: xxxxxxxxx

# 域名信息  
域名: yourdomain.com
邮箱: admin@yourdomain.com (用于SSL证书)

# 邮件服务配置
EngageLab API用户: your_api_user
EngageLab API密钥: your_api_key
```

---

## 🚀 **一键部署执行**

收到您的服务器信息后，我将执行以下步骤：

### **1. 环境准备**
```bash
# 设置环境变量
export DOMAIN=yourdomain.com
export EMAIL=admin@yourdomain.com
export GITHUB_REPO=https://github.com/username/edm.git

# 连接服务器
ssh root@xxx.xxx.xxx.xxx
```

### **2. 执行部署脚本**
```bash
# 下载部署脚本
curl -O https://raw.githubusercontent.com/username/edm/main/deploy/deploy.sh

# 执行一键部署
chmod +x deploy.sh
./deploy.sh
```

### **3. 部署内容**
- ✅ 系统环境更新
- ✅ Docker & Docker Compose安装
- ✅ Nginx安装配置
- ✅ 防火墙配置
- ✅ 项目代码克隆
- ✅ 环境变量配置
- ✅ SSL证书申请
- ✅ 服务启动
- ✅ 健康检查

### **4. 部署时间**
预计30-60分钟完成全部部署

---

## 🌐 **部署完成后**

### **访问地址**
- **管理界面**: https://yourdomain.com
- **API服务**: https://api.yourdomain.com  
- **追踪服务**: https://track.yourdomain.com
- **CDN服务**: https://cdn.yourdomain.com

### **默认账号**
- **用户名**: admin
- **密码**: admin123456

### **服务管理命令**
```bash
# 启动服务
edm-service start

# 停止服务  
edm-service stop

# 重启服务
edm-service restart

# 查看状态
edm-service status

# 查看日志
edm-service logs

# 更新代码
edm-service update

# 数据备份
edm-service backup
```

---

## 📊 **系统监控**

### **健康检查**
- 系统状态：`GET /health`
- 数据库连接：自动检测
- Redis连接：自动检测
- 邮件服务：自动检测

### **日志位置**
- 应用日志：`/opt/edm/logs/`
- Nginx日志：`/var/log/nginx/`
- 系统日志：`/var/log/syslog`

### **备份策略**
- 自动备份：每日凌晨2点
- 备份保留：7天
- 备份位置：`/opt/edm/backups/`

---

## 🔒 **安全配置**

### **防火墙规则**
- SSH (22): 允许
- HTTP (80): 允许 → 重定向HTTPS
- HTTPS (443): 允许
- 其他端口: 拒绝

### **SSL证书**
- 自动申请Let's Encrypt证书
- 自动续期设置
- 强制HTTPS访问

### **数据安全**
- 数据库密码随机生成
- JWT密钥随机生成
- 敏感信息环境变量存储

---

## 📞 **技术支持**

### **部署支持**
- 全程远程协助部署
- 问题实时解决
- 部署完成验证

### **后期维护**
- 系统监控指导
- 备份恢复指导
- 性能优化建议

### **联系方式**
部署过程中如有问题，请随时联系获得技术支持。

---

**准备好了吗？让我们开始部署您的EDM邮件营销系统！** 🎉 