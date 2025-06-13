# EDM系统阿里云部署指南

**文档版本**: v1.0  
**更新时间**: 2025-06-04  
**适用环境**: 阿里云生产环境  

## 📋 部署概览

### 架构概述
```
[用户] → [阿里云SLB] → [ECS服务器] → [RDS数据库]
                           ↓
                    [Engage Lab邮件API]
```

### 所需阿里云服务
- **ECS**: 云服务器（推荐2核4GB以上）
- **RDS**: PostgreSQL数据库
- **SLB**: 负载均衡器
- **域名服务**: 解析域名到服务器
- **SSL证书**: HTTPS安全连接

---

## 🛠️ 部署前准备

### 1. 阿里云资源准备

#### ECS云服务器
```bash
# 推荐配置
CPU: 2核
内存: 4GB
硬盘: 40GB SSD
操作系统: Ubuntu 20.04 LTS
地域: 按需选择
```

#### RDS数据库
```bash
# 数据库配置
引擎: PostgreSQL
版本: 13.x 或以上
规格: 1核2GB起
存储: 20GB起
```

#### 安全组配置
```bash
# 开放端口
HTTP: 80
HTTPS: 443
SSH: 22
PostgreSQL: 5432 (仅内网)
```

### 2. 域名和SSL证书
- 注册域名（如：`edm.yourcompany.com`）
- 申请SSL证书（推荐免费证书或阿里云证书）
- 配置域名解析指向ECS公网IP

---

## 🚀 服务器环境部署

### 1. 连接服务器
```bash
# SSH连接到ECS
ssh root@您的服务器IP
```

### 2. 系统环境准备
```bash
# 更新系统
apt update && apt upgrade -y

# 安装必要软件
apt install -y curl wget git vim nginx supervisor

# 安装Node.js (版本18+)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs

# 验证安装
node --version
npm --version
```

### 3. 安装PM2进程管理器
```bash
npm install -g pm2

# 设置PM2开机自启
pm2 startup
pm2 save
```

---

## 📦 项目部署

### 1. 部署项目代码
```bash
# 创建项目目录
mkdir -p /var/www/edm
cd /var/www/edm

# 克隆代码（或通过FTP上传）
git clone <your-repository-url> .

# 或者从本地上传项目文件
# scp -r ./EDM root@server-ip:/var/www/edm/
```

### 2. 后端部署
```bash
cd /var/www/edm/src/backend

# 安装依赖
npm install --production

# 创建生产环境配置
cp .env.example .env.production
```

### 3. 配置生产环境变量
```bash
# 编辑生产环境配置
vim .env.production
```

```env
# 生产环境配置示例
NODE_ENV=production
PORT=3000

# 数据库配置（使用RDS地址）
DB_HOST=您的RDS内网地址
DB_PORT=5432
DB_NAME=amt_mail_system
DB_USER=您的数据库用户名
DB_PASSWORD=您的数据库密码

# JWT密钥（生产环境请使用强密钥）
JWT_SECRET=生产环境强密钥_64位以上

# Engage Lab邮件服务
ENGAGE_LAB_API_USER=tapi-glodamarket.fun
ENGAGE_LAB_API_KEY=63b81ba85732f89bde0ac9643d7bb868
ENGAGE_LAB_BASE_URL=https://email.api.engagelab.cc/v1

# 日志配置
LOG_LEVEL=info
LOG_FILE=/var/log/edm/app.log
```

### 4. 前端构建和部署
```bash
cd /var/www/edm/src/frontend

# 安装依赖
npm install

# 构建生产版本
npm run build

# 复制构建文件到Nginx目录
cp -r build/* /var/www/html/
```

---

## 🗄️ 数据库设置

### 1. 连接RDS数据库
```bash
# 安装PostgreSQL客户端
apt install -y postgresql-client

# 连接到RDS数据库
psql -h RDS内网地址 -U 用户名 -d postgres
```

### 2. 创建数据库和用户
```sql
-- 创建数据库
CREATE DATABASE amt_mail_system;

-- 创建用户
CREATE USER edm_user WITH PASSWORD '强密码';

-- 授权
GRANT ALL PRIVILEGES ON DATABASE amt_mail_system TO edm_user;

-- 退出
\q
```

### 3. 初始化数据库
```bash
cd /var/www/edm/src/backend

# 运行数据库迁移
NODE_ENV=production npm run migrate

# 创建管理员账户
NODE_ENV=production node scripts/create-admin.js
```

---

## 🌐 Nginx配置

### 1. 创建Nginx配置文件
```bash
vim /etc/nginx/sites-available/edm
```

```nginx
server {
    listen 80;
    server_name 您的域名;
    
    # HTTP重定向到HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name 您的域名;
    
    # SSL证书配置
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    
    # SSL安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    
    # 前端静态文件
    location / {
        root /var/www/html;
        index index.html;
        try_files $uri $uri/ /index.html;
        
        # 缓存设置
        expires 1d;
        add_header Cache-Control "public, immutable";
    }
    
    # API代理到后端
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 超时设置
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    # 日志配置
    access_log /var/log/nginx/edm_access.log;
    error_log /var/log/nginx/edm_error.log;
}
```

### 2. 启用站点配置
```bash
# 创建软链接
ln -s /etc/nginx/sites-available/edm /etc/nginx/sites-enabled/

# 测试配置
nginx -t

# 重启Nginx
systemctl restart nginx
systemctl enable nginx
```

---

## 🔄 PM2进程管理

### 1. 创建PM2配置文件
```bash
cd /var/www/edm/src/backend
vim ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'edm-backend',
    script: 'src/index.js',
    cwd: '/var/www/edm/src/backend',
    instances: 2, // 启动2个进程
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_file: '.env.production',
    max_memory_restart: '1G',
    error_file: '/var/log/edm/err.log',
    out_file: '/var/log/edm/out.log',
    log_file: '/var/log/edm/combined.log',
    time: true,
    watch: false,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

### 2. 启动应用
```bash
# 创建日志目录
mkdir -p /var/log/edm

# 启动应用
pm2 start ecosystem.config.js

# 保存PM2配置
pm2 save

# 查看状态
pm2 status
pm2 logs edm-backend
```

---

## 🔒 安全配置

### 1. 防火墙设置
```bash
# 安装ufw防火墙
apt install -y ufw

# 配置防火墙规则
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 'Nginx Full'

# 启用防火墙
ufw enable
ufw status
```

### 2. 系统安全
```bash
# 创建专用用户
useradd -m -s /bin/bash edm
usermod -aG sudo edm

# 修改文件权限
chown -R edm:edm /var/www/edm
chmod -R 755 /var/www/edm

# 禁用root SSH登录（可选）
vim /etc/ssh/sshd_config
# PermitRootLogin no
systemctl restart ssh
```

---

## 📊 监控和日志

### 1. 系统监控
```bash
# 安装htop监控工具
apt install -y htop

# 设置logrotate日志轮转
vim /etc/logrotate.d/edm
```

```bash
/var/log/edm/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
}
```

### 2. 应用监控
```bash
# PM2监控
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# 设置监控脚本
vim /usr/local/bin/edm-health-check.sh
```

```bash
#!/bin/bash
# EDM健康检查脚本

# 检查应用状态
if ! pm2 list | grep -q "edm-backend.*online"; then
    echo "EDM应用异常，正在重启..."
    pm2 restart edm-backend
fi

# 检查数据库连接
if ! nc -z 数据库地址 5432; then
    echo "数据库连接异常"
    # 发送告警通知
fi

# 检查磁盘空间
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "磁盘空间不足: ${DISK_USAGE}%"
fi
```

```bash
# 设置定时任务
chmod +x /usr/local/bin/edm-health-check.sh
crontab -e
# 添加：*/5 * * * * /usr/local/bin/edm-health-check.sh
```

---

## 🔄 备份策略

### 1. 数据库备份
```bash
vim /usr/local/bin/db-backup.sh
```

```bash
#!/bin/bash
# 数据库备份脚本

BACKUP_DIR="/var/backups/edm"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="amt_mail_system"

mkdir -p $BACKUP_DIR

# 备份数据库
pg_dump -h RDS地址 -U 用户名 -d $DB_NAME > $BACKUP_DIR/db_$DATE.sql

# 压缩备份文件
gzip $BACKUP_DIR/db_$DATE.sql

# 删除7天前的备份
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "数据库备份完成: db_$DATE.sql.gz"
```

### 2. 代码备份
```bash
vim /usr/local/bin/code-backup.sh
```

```bash
#!/bin/bash
# 代码备份脚本

BACKUP_DIR="/var/backups/edm"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# 备份代码
tar -czf $BACKUP_DIR/code_$DATE.tar.gz -C /var/www edm

# 删除30天前的备份
find $BACKUP_DIR -name "code_*.tar.gz" -mtime +30 -delete

echo "代码备份完成: code_$DATE.tar.gz"
```

### 3. 自动备份计划
```bash
chmod +x /usr/local/bin/db-backup.sh
chmod +x /usr/local/bin/code-backup.sh

# 设置定时备份
crontab -e
# 添加以下行：
# 0 2 * * * /usr/local/bin/db-backup.sh  # 每天2点备份数据库
# 0 3 * * 0 /usr/local/bin/code-backup.sh  # 每周日3点备份代码
```

---

## 🔧 部署脚本

### 自动化部署脚本
```bash
vim /usr/local/bin/deploy-edm.sh
```

```bash
#!/bin/bash
# EDM自动部署脚本

set -e

echo "🚀 开始部署EDM系统..."

# 变量定义
PROJECT_DIR="/var/www/edm"
BACKEND_DIR="$PROJECT_DIR/src/backend"
FRONTEND_DIR="$PROJECT_DIR/src/frontend"

# 停止应用
echo "⏹️ 停止应用..."
pm2 stop edm-backend || true

# 更新代码
echo "📥 更新代码..."
cd $PROJECT_DIR
git pull origin main

# 后端部署
echo "🔧 部署后端..."
cd $BACKEND_DIR
npm install --production
npm run migrate

# 前端构建
echo "🎨 构建前端..."
cd $FRONTEND_DIR
npm install
npm run build
cp -r build/* /var/www/html/

# 重启应用
echo "🔄 重启应用..."
pm2 start edm-backend

# 重启Nginx
echo "🔄 重启Nginx..."
systemctl reload nginx

echo "✅ 部署完成！"

# 健康检查
echo "🔍 健康检查..."
sleep 5
if curl -f http://localhost:3000/api/auth/test; then
    echo "✅ 应用健康检查通过"
else
    echo "❌ 应用健康检查失败"
    exit 1
fi
```

```bash
chmod +x /usr/local/bin/deploy-edm.sh
```

---

## 📋 部署检查清单

### 部署前检查
- [ ] ECS服务器已准备就绪
- [ ] RDS数据库已创建并配置
- [ ] 域名已解析到服务器IP
- [ ] SSL证书已准备
- [ ] 安全组端口已开放

### 部署中检查
- [ ] Node.js环境已安装
- [ ] 项目代码已上传
- [ ] 环境变量已配置
- [ ] 数据库已初始化
- [ ] Nginx已配置
- [ ] PM2已启动应用

### 部署后验证
- [ ] 网站可以正常访问
- [ ] HTTPS正常工作
- [ ] 用户可以正常登录
- [ ] 邮件发送功能正常
- [ ] 数据库连接正常
- [ ] 监控和日志正常

---

## 🆘 故障排除

### 常见问题

#### 1. 应用无法启动
```bash
# 检查日志
pm2 logs edm-backend

# 检查端口占用
netstat -tulpn | grep :3000

# 检查进程状态
pm2 status
```

#### 2. 数据库连接失败
```bash
# 测试数据库连接
psql -h RDS地址 -U 用户名 -d amt_mail_system

# 检查安全组设置
# 确保ECS可以访问RDS的5432端口
```

#### 3. Nginx配置问题
```bash
# 测试配置文件
nginx -t

# 检查日志
tail -f /var/log/nginx/error.log
```

#### 4. SSL证书问题
```bash
# 检查证书有效期
openssl x509 -in /path/to/certificate.crt -text -noout

# 测试SSL
curl -I https://您的域名
```

---

## 📞 技术支持

**部署问题反馈**: 
- 请提供详细的错误日志
- 说明具体的部署步骤
- 提供服务器配置信息

**监控建议**:
- 建议使用阿里云云监控
- 设置关键指标告警
- 定期检查系统资源使用情况

---

**部署文档版本**: v1.0  
**最后更新**: 2025-06-04  
**维护负责人**: AI Assistant 