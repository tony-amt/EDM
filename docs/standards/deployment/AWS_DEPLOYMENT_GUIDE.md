# EDM邮件营销系统 - AWS生产环境部署指引

> 🎯 **面向对象**: 产品经理/非技术人员
> 💰 **预估成本**: $50-100/月（基础配置）
> ⏰ **部署时间**: 2-4小时（首次部署）

---

## 📋 部署前准备清单

### ✅ 需要准备的账号和工具
1. **AWS账号** - [免费注册](https://aws.amazon.com)
2. **域名** (可选但推荐) - 如 yourdomain.com
3. **本地电脑工具**:
   - 安装Chrome浏览器
   - 安装VS Code (代码编辑器)

### ✅ 需要准备的信息
- [ ] AWS账号邮箱和密码
- [ ] 信用卡信息（AWS需要）
- [ ] 域名（如果有的话）
- [ ] 管理员邮箱（用于接收系统通知）

---

## 🏗️ 部署架构图

```
用户浏览器 → CloudFront (CDN) → S3 (前端静态文件)
                ↓
            ALB (负载均衡器) → EC2 (后端API服务)
                ↓
            RDS (PostgreSQL数据库)
```

---

## 📚 第一章：AWS账号设置（15分钟）

### 1.1 创建AWS账号
1. 访问 https://aws.amazon.com
2. 点击"创建AWS账号"
3. 填写邮箱、密码、账号名
4. 填写联系信息（选择"个人"账号类型）
5. 绑定信用卡（用于付费，有免费额度）
6. 电话验证
7. 选择"基本支持计划"（免费）

### 1.2 设置计费警报 ⚠️ **重要**
```bash
# 为什么要设置：防止意外高额账单
# 建议设置：每月$100警报
```

1. 登录AWS控制台
2. 右上角点击用户名 → "Billing Dashboard"
3. 左侧菜单"Budgets" → "Create budget"
4. 选择"Cost budget"
5. 设置每月$100预算
6. 添加邮箱警报（80%、90%、100%）

### 1.3 创建IAM用户（推荐）
```bash
# 为什么要创建：更安全的权限管理
# 创建一个专门用于部署的用户
```

1. 搜索"IAM" → 进入IAM控制台
2. 左侧"Users" → "Add users"
3. 用户名：`edm-deploy-user`
4. 访问类型：✅ AWS Management Console access
5. 权限：Attach existing policies directly
6. 搜索并勾选：
   - `PowerUserAccess` (推荐) 或
   - `AdministratorAccess` (如果需要完全权限)

---

## 📚 第二章：数据库部署（30分钟）

### 2.1 创建RDS PostgreSQL数据库

1. **进入RDS控制台**
   - 搜索"RDS" → 点击进入

2. **创建数据库**
   - 点击"Create database"
   - 选择"Standard create"
   - 引擎类型：**PostgreSQL**
   - 版本：**PostgreSQL 14** (推荐)

3. **模板选择**
   - ✅ **Production** (生产环境)
   - 或 ✅ **Free tier** (如果符合免费条件)

4. **数据库设置**
   ```
   DB instance identifier: edm-production-db
   Master username: edm_admin
   Master password: [设置强密码，记录保存！]
   确认密码: [再次输入]
   ```

5. **实例配置**
   ```
   DB instance class: db.t3.micro (免费层) 或 db.t3.small (生产推荐)
   ```

6. **存储设置**
   ```
   Storage type: gp2
   Allocated storage: 20 GB (起始)
   ✅ Enable storage autoscaling
   Maximum storage threshold: 100 GB
   ```

7. **连接设置** ⚠️ **重要**
   ```
   VPC: Default VPC
   Subnet group: default
   Public access: Yes (临时，后续可以改为No)
   VPC security groups: Create new
   New VPC security group name: edm-db-security-group
   ```

8. **数据库选项**
   ```
   Initial database name: amt_mail_system
   Port: 5432
   Parameter group: default
   ```

9. **备份设置**
   ```
   ✅ Enable automatic backups
   Backup retention period: 7 days
   Backup window: Select window (选择业务低峰期)
   ```

10. **点击"Create database"** (需要等待5-10分钟)

### 2.2 配置数据库安全组
1. 数据库创建完成后，点击数据库名称
2. 在"Connectivity & security"标签页找到"Security groups"
3. 点击安全组名称
4. "Inbound rules" → "Edit inbound rules"
5. 添加规则：
   ```
   Type: PostgreSQL
   Port: 5432
   Source: 0.0.0.0/0 (临时，后续改为EC2安全组)
   ```

### 2.3 记录数据库连接信息 📝
```bash
数据库端点: [从RDS控制台复制]
端口: 5432
数据库名: amt_mail_system
用户名: edm_admin
密码: [你设置的密码]
```

---

## 📚 第三章：后端API部署（45分钟）

### 3.1 创建EC2实例

1. **进入EC2控制台**
   - 搜索"EC2" → 点击进入

2. **启动实例**
   - 点击"Launch instances"
   - 名称：`edm-backend-server`

3. **选择镜像**
   - **Amazon Linux 2** (推荐) 或
   - **Ubuntu Server 22.04 LTS**

4. **实例类型**
   ```
   t2.micro (免费层) 或
   t3.small (生产推荐，$20/月)
   ```

5. **密钥对** ⚠️ **重要**
   - Create new key pair
   - 名称：`edm-backend-key`
   - 类型：RSA
   - 格式：.pem
   - **下载并保存密钥文件！**

6. **网络设置**
   ```
   VPC: default
   Subnet: default
   Auto-assign public IP: Enable
   
   Security group name: edm-backend-sg
   Description: EDM Backend Security Group
   
   Rules:
   - SSH (22) - My IP
   - HTTP (80) - Anywhere IPv4
   - HTTPS (443) - Anywhere IPv4
   - Custom TCP (3000) - Anywhere IPv4 (API端口)
   ```

7. **存储**
   ```
   8 GiB gp2 (免费层) 或
   20 GiB gp3 (生产推荐)
   ```

8. **点击"Launch instance"**

### 3.2 连接到EC2实例

#### Windows用户：
1. 下载 [PuTTY](https://www.putty.org/)
2. 使用PuTTYgen转换.pem为.ppk文件
3. 使用PuTTY连接：
   ```
   Host Name: ec2-user@[实例公网IP]
   Auth: 选择.ppk文件
   ```

#### Mac/Linux用户：
```bash
# 打开终端，进入密钥文件目录
chmod 400 edm-backend-key.pem
ssh -i edm-backend-key.pem ec2-user@[实例公网IP]
```

### 3.3 安装环境

连接到EC2后，执行以下命令：

```bash
# 更新系统
sudo yum update -y  # Amazon Linux
# 或
sudo apt update && sudo apt upgrade -y  # Ubuntu

# 安装Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs  # Amazon Linux
# 或
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs  # Ubuntu

# 安装PM2 (进程管理器)
sudo npm install -g pm2

# 安装Git
sudo yum install -y git  # Amazon Linux
# 或
sudo apt install -y git  # Ubuntu

# 验证安装
node --version
npm --version
pm2 --version
```

### 3.4 部署代码

```bash
# 克隆代码 (需要先上传到GitHub等)
git clone https://github.com/[你的用户名]/EDM.git
cd EDM/src/backend

# 安装依赖
npm install

# 创建环境配置文件
sudo nano .env.production
```

**环境配置文件内容**：
```env
NODE_ENV=production
PORT=3000

# 数据库配置 (使用第二章记录的信息)
DB_HOST=[RDS端点地址]
DB_PORT=5432
DB_NAME=amt_mail_system
DB_USER=edm_admin
DB_PASSWORD=[你设置的密码]

# JWT配置
JWT_SECRET=[生成一个强密码，32位随机字符串]
JWT_EXPIRES_IN=24h

# 日志配置
LOG_LEVEL=info
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5
LOG_DATE_PATTERN=YYYY-MM-DD

# 邮件配置 (后续配置)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

# 应用配置
CORS_ORIGIN=https://[你的前端域名]
```

### 3.5 数据库初始化

```bash
# 运行数据库迁移
npm run migrate

# 创建管理员用户
node src/utils/createAdmin.js
```

### 3.6 启动服务

```bash
# 使用PM2启动
pm2 start src/index.js --name "edm-backend"

# 设置开机自启
pm2 startup
pm2 save

# 查看状态
pm2 status
pm2 logs edm-backend
```

---

## 📚 第四章：前端部署（30分钟）

### 4.1 创建S3存储桶

1. **进入S3控制台**
   - 搜索"S3" → 点击进入

2. **创建存储桶**
   - 点击"Create bucket"
   - 存储桶名称：`edm-frontend-[随机数字]` (全球唯一)
   - 区域：选择与EC2相同区域

3. **权限设置**
   - ❌ 取消勾选"Block all public access"
   - ✅ 确认允许公共访问
   - 点击"Create bucket"

### 4.2 配置静态网站托管

1. **点击刚创建的存储桶**
2. **Properties标签页**
3. **Static website hosting**
   - 点击"Edit"
   - ✅ Enable
   - Index document: `index.html`
   - Error document: `index.html`
   - 点击"Save changes"

### 4.3 构建前端代码

在本地计算机上：

```bash
# 进入前端目录
cd EDM/src/frontend

# 安装依赖
npm install

# 修改API配置
# 编辑 src/config/constants.ts
export const API_URL = 'http://[EC2公网IP]:3000/api';

# 构建生产版本
npm run build
```

### 4.4 上传文件到S3

1. **方式一：使用AWS控制台**
   - 在S3控制台中，点击存储桶名称
   - 点击"Upload"
   - 选择`build`文件夹中的所有文件
   - 点击"Upload"

2. **方式二：使用AWS CLI** (推荐)
   ```bash
   # 安装AWS CLI
   # Windows: 下载安装包
   # Mac: brew install awscli
   # 配置凭证
   aws configure
   
   # 同步文件
   aws s3 sync build/ s3://edm-frontend-[你的存储桶名]/ --delete
   ```

### 4.5 设置存储桶策略

1. **Permissions标签页**
2. **Bucket policy**
3. **粘贴以下策略**：

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::edm-frontend-[你的存储桶名]/*"
        }
    ]
}
```

### 4.6 获取网站URL

在Properties标签页的Static website hosting部分，复制**Bucket website endpoint**

---

## 📚 第五章：域名和SSL配置（20分钟，可选）

### 5.1 购买域名（如果没有）

推荐域名注册商：
- AWS Route 53
- Namecheap
- GoDaddy
- 阿里云域名

### 5.2 创建SSL证书

1. **进入Certificate Manager**
   - 搜索"Certificate Manager"
   - **重要**：必须在**美国东部(弗吉尼亚北部) us-east-1**区域

2. **申请证书**
   - 点击"Request a certificate"
   - 选择"Request a public certificate"
   - 域名：
     ```
     yourdomain.com
     www.yourdomain.com
     api.yourdomain.com
     ```
   - 验证方法：DNS validation (推荐)
   - 点击"Request"

3. **DNS验证**
   - 点击证书ID
   - 每个域名会显示CNAME记录
   - 在域名DNS设置中添加这些记录

### 5.3 创建CloudFront分发

1. **进入CloudFront控制台**
2. **创建分发**
   - Origin Domain: S3存储桶的Website endpoint (不是普通域名)
   - Protocol: HTTP only
   - Viewer Protocol Policy: Redirect HTTP to HTTPS
   - Alternate Domain Names: www.yourdomain.com
   - SSL Certificate: 选择上一步创建的证书
   - Default Root Object: index.html

3. **错误页面配置**
   - Error Pages标签页
   - Create Custom Error Response:
     ```
     HTTP Error Code: 403, 404
     Customize Error Response: Yes
     Response Page Path: /index.html
     HTTP Response Code: 200
     ```

### 5.4 配置Route 53 DNS

1. **创建托管区域**
   - 搜索"Route 53"
   - Create Hosted Zone
   - 域名：yourdomain.com

2. **创建记录**
   ```
   # 前端
   名称: www.yourdomain.com
   类型: A
   别名: Yes
   别名目标: CloudFront分发域名
   
   # API
   名称: api.yourdomain.com
   类型: A
   值: EC2公网IP
   ```

---

## 📚 第六章：监控和维护（15分钟）

### 6.1 设置CloudWatch监控

1. **EC2监控**
   - EC2控制台 → 选择实例
   - Monitoring标签页
   - Enable detailed monitoring

2. **创建警报**
   ```
   CPU使用率 > 80% (持续5分钟)
   内存使用率 > 85%
   磁盘使用率 > 90%
   ```

### 6.2 自动备份设置

1. **RDS自动备份** (已在创建时设置)
2. **EC2快照**
   ```
   AWS Backup服务
   创建备份计划
   每日备份EC2实例
   保留7天
   ```

### 6.3 日志管理

```bash
# 在EC2上设置日志轮转
sudo nano /etc/logrotate.d/edm-backend

/home/ec2-user/EDM/src/backend/logs/*.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
}
```

---

## 📚 第七章：常见问题和故障排除

### 7.1 部署检查清单 ✅

**后端检查**：
- [ ] EC2实例正常运行
- [ ] 安全组配置正确（端口3000开放）
- [ ] 数据库连接正常
- [ ] PM2服务运行中
- [ ] API健康检查: `http://[EC2-IP]:3000/health`

**前端检查**：
- [ ] S3存储桶公开访问
- [ ] 静态网站托管已启用
- [ ] 文件上传完整
- [ ] API_URL配置正确

**域名检查**（如果配置）：
- [ ] DNS记录正确
- [ ] SSL证书验证通过
- [ ] CloudFront分发正常

### 7.2 常见错误解决

#### ❌ "Cannot connect to database"
```bash
# 检查数据库安全组
# 确保EC2可以访问RDS端口5432
# 检查数据库连接字符串
```

#### ❌ "CORS错误"
```bash
# 检查后端CORS配置
# 确保CORS_ORIGIN设置正确
# 检查前端API_URL配置
```

#### ❌ "502 Bad Gateway"
```bash
# 检查PM2服务状态
pm2 status
pm2 logs edm-backend

# 重启服务
pm2 restart edm-backend
```

#### ❌ "403 Forbidden" (S3)
```bash
# 检查S3存储桶策略
# 确保文件权限正确
# 检查CloudFront配置
```

### 7.3 性能优化建议

1. **数据库优化**
   ```
   - 升级到更大的实例类型
   - 启用读取副本
   - 配置连接池
   ```

2. **服务器优化**
   ```
   - 使用负载均衡器
   - 多可用区部署
   - 自动扩展组
   ```

3. **前端优化**
   ```
   - CloudFront缓存设置
   - 压缩静态资源
   - 使用CDN
   ```

---

## 💰 成本预估和优化

### 每月费用预估（美元）

| 服务 | 基础配置 | 生产配置 | 备注 |
|------|----------|----------|------|
| EC2 | $8 (t2.micro) | $25 (t3.small) | 后端服务器 |
| RDS | $15 (db.t3.micro) | $35 (db.t3.small) | 数据库 |
| S3 | $2 | $5 | 前端托管 |
| CloudFront | $1 | $5 | CDN (如果使用) |
| Route 53 | $0.5 | $0.5 | DNS托管 |
| **总计** | **$26.5** | **$70.5** | 每月 |

### 💡 成本优化建议

1. **使用Reserved Instances** (节省30-50%)
2. **设置自动关机** (开发环境)
3. **监控和清理未使用资源**
4. **使用Spot Instances** (非关键应用)

---

## 📞 支持和帮助

### 官方文档
- [AWS入门指南](https://aws.amazon.com/getting-started/)
- [EC2用户指南](https://docs.aws.amazon.com/ec2/)
- [RDS用户指南](https://docs.aws.amazon.com/rds/)

### 紧急支持
1. **AWS Support** (付费)
2. **AWS论坛** (免费)
3. **Stack Overflow** (社区)

### 部署后检查

部署完成后，访问以下URL确认：

1. **后端API健康检查**：
   ```
   http://[EC2-IP]:3000/health
   或
   https://api.yourdomain.com/health
   ```

2. **前端界面**：
   ```
   http://[S3-website-endpoint]
   或
   https://www.yourdomain.com
   ```

3. **完整功能测试**：
   - 用户注册/登录
   - 联系人管理
   - 邮件模板创建
   - 活动创建

---

## 🎉 部署完成！

恭喜！您已经成功将EDM邮件营销系统部署到AWS生产环境。

**下一步建议**：
1. 📚 熟悉AWS控制台
2. 📊 设置监控和警报
3. 🔐 加强安全配置
4. 📖 准备用户培训文档
5. 🚀 开始使用系统！

**记住保存重要信息**：
- AWS账号信息
- 数据库连接信息
- 域名DNS设置
- SSL证书信息
- EC2密钥文件

有任何问题，请参考故障排除部分或寻求技术支持。 