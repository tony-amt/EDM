# EDM邮件营销系统 - 腾讯云生产环境部署指引

> 🎯 **面向对象**: 产品经理/非技术人员 (中国用户)
> 💰 **预估成本**: ¥200-500/月（基础配置）
> ⏰ **部署时间**: 2-4小时（首次部署）
> 🇨🇳 **优势**: 国内访问速度快，支持备案，中文服务

---

## 📋 部署前准备清单

### ✅ 需要准备的账号和工具
1. **腾讯云账号** - [免费注册](https://cloud.tencent.com)
2. **域名** (必需，用于备案) - 如 yourdomain.com
3. **企业资质** (备案需要)
   - 营业执照
   - 身份证
   - 授权书等
4. **本地电脑工具**:
   - 安装Chrome浏览器
   - 安装VS Code (代码编辑器)

### ✅ 需要准备的信息
- [ ] 腾讯云账号邮箱和密码
- [ ] 实名认证信息（个人/企业）
- [ ] 域名信息
- [ ] 备案相关资料
- [ ] 管理员邮箱（用于接收系统通知）

---

## 🏗️ 部署架构图

```
用户 → CDN加速 → COS对象存储 (前端静态文件)
         ↓
    CLB负载均衡 → CVM云服务器 (后端API服务)
         ↓
    CDB云数据库 (PostgreSQL)
         ↓
    监控告警 → CLS日志服务
```

---

## 📚 第一章：腾讯云账号设置（20分钟）

### 1.1 创建腾讯云账号
1. 访问 https://cloud.tencent.com
2. 点击"免费注册"
3. 填写手机号、邮箱、密码
4. 短信验证码验证
5. 完成注册

### 1.2 实名认证 ⚠️ **必需**
1. 登录腾讯云控制台
2. 右上角"账号信息" → "实名认证"
3. 选择认证类型：
   - **个人认证**: 身份证
   - **企业认证**: 营业执照（推荐）
4. 上传相关证件照片
5. 等待审核（通常1-3个工作日）

### 1.3 设置费用预警 ⚠️ **重要**
```bash
# 为什么要设置：防止意外高额账单
# 建议设置：每月¥1000预警
```

1. 控制台 → "费用中心" → "费用预警"
2. 新建预警策略
3. 设置预警金额：¥1000
4. 添加通知邮箱和手机号
5. 设置预警比例：80%、90%、100%

### 1.4 购买代金券（可选）
- 新用户通常有代金券赠送
- 建议先购买小额代金券测试
- 关注腾讯云官方活动

---

## 📚 第二章：域名和备案（3-7天）

### 2.1 域名购买 ⚠️ **必需备案**

1. **在腾讯云购买域名**（推荐）
   - 控制台 → "域名注册"
   - 搜索并购买域名
   - 建议选择 .com 或 .cn 域名

2. **使用已有域名**
   - 域名解析迁移到腾讯云DNS
   - 控制台 → "DNS解析"

### 2.2 备案申请 ⚠️ **法律要求**
```bash
# 备案是中国大陆服务器的法律要求
# 未备案域名无法绑定大陆服务器
# 备案时间通常需要7-20个工作日
```

1. **进入备案系统**
   - 控制台 → "域名与网站" → "网站备案"

2. **备案类型选择**
   - **首次备案**: 新域名新主体
   - **新增网站**: 已有备案主体，新增域名
   - **接入备案**: 域名已在其他服务商备案

3. **准备备案资料**
   ```
   个人备案：
   - 身份证正反面
   - 备案核验单
   - 网站负责人照片
   
   企业备案：
   - 营业执照
   - 法人身份证
   - 网站负责人身份证
   - 授权书（如负责人非法人）
   ```

4. **填写备案信息**
   - 主体信息：个人/企业信息
   - 网站信息：网站名称、内容描述
   - 负责人信息：网站负责人详细信息

5. **提交审核**
   - 腾讯云初审：1-3个工作日
   - 管局终审：7-20个工作日

**⚠️ 备案期间注意事项**：
- 服务器必须在腾讯云
- 域名实名认证必须通过
- 备案期间网站不能访问
- 保持手机畅通，配合核验

---

## 📚 第三章：数据库部署（30分钟）

### 3.1 创建CDB PostgreSQL数据库

1. **进入数据库控制台**
   - 搜索"云数据库" → "PostgreSQL"

2. **新建实例**
   - 点击"新建"
   - 计费模式：**包年包月**（推荐）或**按量计费**
   - 地域：选择**北京**、**上海**或**广州**（备案后可用）

3. **实例配置**
   ```
   数据库版本: PostgreSQL 12.4 或更高
   架构: 高可用版 (推荐)
   实例规格: 1核2GB (基础版) 或 2核4GB (标准版)
   存储类型: SSD云硬盘
   存储空间: 50GB (起始)
   ```

4. **网络配置**
   ```
   网络: 默认VPC
   子网: 默认子网
   安全组: 新建安全组 "edm-db-sg"
   ```

5. **参数设置**
   ```
   实例名称: edm-production-db
   管理员用户名: postgres
   管理员密码: [设置强密码，记录保存！]
   字符集: UTF8
   ```

6. **备份设置**
   ```
   自动备份: 开启
   备份时间: 02:00-06:00 (业务低峰期)
   备份保留: 7天
   ```

7. **购买确认**
   - 确认配置和费用
   - 勾选服务协议
   - 点击"立即购买"

### 3.2 配置数据库安全组

1. **找到数据库实例**
   - 实例列表 → 点击实例ID

2. **安全组配置**
   - "安全组"标签页 → "配置安全组"
   - 新建规则：
     ```
     类型: 自定义
     协议端口: TCP:5432
     授权对象: 0.0.0.0/0 (临时设置，后续改为CVM内网IP)
     策略: 允许
     备注: PostgreSQL访问
     ```

### 3.3 创建业务数据库

1. **连接数据库**
   - 使用数据库管理工具（如DBeaver、pgAdmin）
   - 或使用腾讯云的"数据库管理"功能

2. **创建数据库**
   ```sql
   CREATE DATABASE amt_mail_system;
   CREATE USER edm_admin WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE amt_mail_system TO edm_admin;
   ```

### 3.4 记录数据库连接信息 📝
```bash
数据库内网地址: [从CDB控制台复制]
端口: 5432
数据库名: amt_mail_system
用户名: edm_admin
密码: [你设置的密码]
```

---

## 📚 第四章：服务器部署（45分钟）

### 4.1 创建CVM云服务器

1. **进入CVM控制台**
   - 搜索"云服务器" → "实例"

2. **新建实例**
   - 计费模式：**包年包月**（推荐）
   - 地域和可用区：与数据库相同地域

3. **选择镜像**
   ```
   镜像类型: 公共镜像
   操作系统: CentOS 8.2 64位 或 Ubuntu 20.04 LTS 64位
   ```

4. **选择机型**
   ```
   实例族: 标准型S5
   实例规格: 
   - 基础: 1核2GB (s5.small2)
   - 推荐: 2核4GB (s5.medium4)
   ```

5. **选择存储**
   ```
   系统盘: SSD云硬盘 50GB
   数据盘: SSD云硬盘 50GB (可选)
   ```

6. **设置网络**
   ```
   网络: 默认VPC
   子网: 默认子网
   公网IP: 分配免费公网IP
   带宽计费模式: 按使用流量
   带宽上限: 5Mbps (可根据需要调整)
   
   安全组: 新建安全组
   安全组名称: edm-web-sg
   开放端口: 22, 80, 443, 3000
   ```

7. **设置主机**
   ```
   实例名称: edm-backend-server
   登录方式: 设置密码
   用户名: root (Linux) 或 Administrator (Windows)
   密码: [设置强密码]
   ```

8. **确认购买**
   - 购买数量: 1台
   - 购买时长: 1个月（测试）或更长
   - 确认配置和费用

### 4.2 连接服务器

#### 4.2.1 使用腾讯云控制台（推荐新手）
1. CVM实例列表 → 找到服务器
2. 点击"登录" → "标准登录"
3. 输入用户名和密码

#### 4.2.2 使用SSH客户端
**Windows用户**:
```bash
# 使用PowerShell或下载PuTTY
ssh root@[服务器公网IP]
```

**Mac/Linux用户**:
```bash
ssh root@[服务器公网IP]
```

### 4.3 安装环境

连接到服务器后，执行以下命令：

```bash
# 更新系统包
yum update -y  # CentOS
# 或
apt update && apt upgrade -y  # Ubuntu

# 安装基础工具
yum install -y wget curl git  # CentOS
# 或
apt install -y wget curl git  # Ubuntu

# 安装Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs  # CentOS
# 或
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs  # Ubuntu

# 安装PM2进程管理器
npm install -g pm2

# 安装Nginx (用于反向代理)
yum install -y nginx  # CentOS
# 或
apt install -y nginx  # Ubuntu

# 验证安装
node --version
npm --version
pm2 --version
nginx -v
```

### 4.4 部署代码

```bash
# 创建应用目录
mkdir -p /opt/edm-system
cd /opt/edm-system

# 克隆代码仓库
git clone https://github.com/[你的用户名]/EDM.git .

# 进入后端目录
cd src/backend

# 安装依赖
npm install --production

# 创建日志目录
mkdir -p logs

# 创建环境配置文件
cat > .env.production << EOF
NODE_ENV=production
PORT=3000

# 数据库配置
DB_HOST=[CDB内网地址]
DB_PORT=5432
DB_NAME=amt_mail_system
DB_USER=edm_admin
DB_PASSWORD=[数据库密码]

# JWT配置
JWT_SECRET=$(openssl rand -hex 32)
JWT_EXPIRES_IN=24h

# 日志配置
LOG_LEVEL=info
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5
LOG_DATE_PATTERN=YYYY-MM-DD

# 邮件配置（后续配置）
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

# 应用配置
CORS_ORIGIN=https://[你的域名]
EOF
```

### 4.5 配置Nginx反向代理

```bash
# 备份默认配置
cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup

# 创建站点配置
cat > /etc/nginx/conf.d/edm.conf << EOF
server {
    listen 80;
    server_name [你的域名];
    
    # 前端静态文件 (后续配置COS时更新)
    location / {
        root /opt/edm-system/frontend/build;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }
    
    # API代理
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # 健康检查
    location /health {
        proxy_pass http://localhost:3000/health;
    }
}
EOF

# 测试配置
nginx -t

# 启动Nginx
systemctl enable nginx
systemctl start nginx
```

### 4.6 启动应用服务

```bash
# 使用PM2启动后端服务
cd /opt/edm-system/src/backend
pm2 start src/index.js --name "edm-backend" --env production

# 设置开机自启
pm2 startup
pm2 save

# 查看服务状态
pm2 status
pm2 logs edm-backend
```

---

## 📚 第五章：前端部署（40分钟）

### 5.1 创建COS对象存储

1. **进入COS控制台**
   - 搜索"对象存储" → "存储桶列表"

2. **创建存储桶**
   ```
   名称: edm-frontend-[随机数字]
   所属地域: 与CVM相同
   访问权限: 公有读私有写
   ```

3. **配置静态网站**
   - 选择存储桶 → "基础配置" → "静态网站"
   - 开启静态网站功能
   - 索引文档: index.html
   - 错误文档: index.html

### 5.2 构建前端代码

在本地环境执行：

```bash
# 进入前端目录
cd src/frontend

# 安装依赖
npm install

# 修改API配置
# 编辑 src/config/constants.ts
export const API_URL = 'https://[你的域名]/api';

# 构建生产版本
npm run build
```

### 5.3 上传文件到COS

#### 5.3.1 使用控制台上传
1. 进入存储桶
2. 点击"上传文件"
3. 选择 build 目录下的所有文件
4. 上传

#### 5.3.2 使用COS工具（推荐）
```bash
# 安装COSCMD工具
pip install coscmd

# 配置COSCMD
coscmd config -a [SecretId] -s [SecretKey] -b [BucketName] -r [Region]

# 同步上传
coscmd upload -r build/ /
```

### 5.4 配置CDN加速

1. **创建CDN域名**
   - 控制台 → "内容分发网络" → "域名管理"
   - 添加域名: www.[你的域名]
   - 源站类型: COS源
   - 回源域名: 选择上面创建的COS存储桶

2. **SSL证书配置**
   - "高级配置" → "HTTPS配置"
   - 申请免费SSL证书或上传已有证书

3. **缓存配置**
   ```
   静态文件 (.css, .js, .png等): 缓存30天
   HTML文件: 缓存1小时
   API接口: 不缓存
   ```

---

## 📚 第六章：域名解析配置（15分钟）

### 6.1 DNS解析配置

1. **进入DNS解析控制台**
   - 控制台 → "域名与网站" → "DNS解析"

2. **添加解析记录**
   ```
   # 主域名
   主机记录: @
   记录类型: A
   记录值: [CVM公网IP]
   TTL: 600
   
   # www子域名 
   主机记录: www
   记录类型: CNAME
   记录值: [CDN分配的域名]
   TTL: 600
   
   # API子域名（可选）
   主机记录: api
   记录类型: A
   记录值: [CVM公网IP]
   TTL: 600
   ```

### 6.2 SSL证书申请

1. **申请免费证书**
   - 控制台 → "SSL证书" → "申请免费证书"
   - 域名: [你的域名], www.[你的域名]
   - 验证方式: DNS验证

2. **配置SSL证书到Nginx**
   ```bash
   # 下载证书到服务器
   # 更新Nginx配置
   cat > /etc/nginx/conf.d/edm-ssl.conf << EOF
   server {
       listen 443 ssl http2;
       server_name [你的域名];
       
       ssl_certificate /path/to/your/cert.pem;
       ssl_certificate_key /path/to/your/key.key;
       
       # 其他配置...
   }
   
   server {
       listen 80;
       server_name [你的域名];
       return 301 https://\$server_name\$request_uri;
   }
   EOF
   
   # 重新加载Nginx
   nginx -t && systemctl reload nginx
   ```

---

## 📚 第七章：监控和运维（20分钟）

### 7.1 设置云监控

1. **基础监控**
   - 控制台 → "云产品" → "云监控"
   - CVM监控: CPU、内存、磁盘、网络
   - CDB监控: 连接数、慢查询、QPS

2. **告警策略**
   ```
   CVM告警:
   - CPU使用率 > 80% (持续5分钟)
   - 内存使用率 > 85%
   - 磁盘使用率 > 90%
   
   CDB告警:
   - 连接数 > 80%
   - 慢查询数 > 10/分钟
   - 磁盘使用率 > 85%
   ```

### 7.2 日志服务配置

1. **开启CLS日志服务**
   - 控制台 → "日志服务" → "日志主题"
   - 创建日志集和日志主题

2. **配置日志采集**
   ```bash
   # 安装日志代理
   wget https://cloud.tencent.com/document/product/614/17414
   
   # 配置采集规则
   # 应用日志: /opt/edm-system/src/backend/logs/
   # Nginx访问日志: /var/log/nginx/access.log
   # Nginx错误日志: /var/log/nginx/error.log
   ```

### 7.3 自动备份策略

1. **数据库备份**
   - CDB控制台已配置自动备份
   - 可设置跨地域备份

2. **文件备份**
   ```bash
   # 创建备份脚本
   cat > /opt/backup.sh << EOF
   #!/bin/bash
   DATE=$(date +%Y%m%d_%H%M%S)
   
   # 备份代码
   tar -czf /tmp/edm-code-\$DATE.tar.gz /opt/edm-system
   
   # 上传到COS
   coscmd upload /tmp/edm-code-\$DATE.tar.gz /backups/
   
   # 清理本地备份
   rm -f /tmp/edm-code-\$DATE.tar.gz
   EOF
   
   chmod +x /opt/backup.sh
   
   # 设置定时任务
   echo "0 2 * * * /opt/backup.sh" | crontab -
   ```

---

## 📚 第八章：安全配置（25分钟）

### 8.1 网络安全

1. **安全组优化**
   ```
   CVM安全组 (edm-web-sg):
   - SSH (22): 仅管理员IP
   - HTTP (80): 0.0.0.0/0
   - HTTPS (443): 0.0.0.0/0
   - 应用端口 (3000): 仅内网访问
   
   CDB安全组 (edm-db-sg):
   - PostgreSQL (5432): 仅CVM内网IP
   ```

2. **DDoS防护**
   - 腾讯云默认提供基础DDoS防护
   - 如需高级防护，可购买DDoS高防

### 8.2 应用安全

1. **防火墙配置**
   ```bash
   # 安装防火墙
   yum install -y firewalld  # CentOS
   systemctl enable firewalld
   systemctl start firewalld
   
   # 配置规则
   firewall-cmd --permanent --add-port=22/tcp
   firewall-cmd --permanent --add-port=80/tcp
   firewall-cmd --permanent --add-port=443/tcp
   firewall-cmd --reload
   ```

2. **应用安全加固**
   ```bash
   # 更新系统补丁
   yum update -y
   
   # 禁用不必要的服务
   systemctl disable postfix
   systemctl disable sendmail
   
   # 设置文件权限
   chmod 600 /opt/edm-system/src/backend/.env.production
   chown -R root:root /opt/edm-system
   ```

### 8.3 WAF防护（可选）

1. **购买Web应用防火墙**
   - 控制台 → "安全" → "Web应用防火墙"
   - 选择合适版本（企业版推荐）

2. **配置防护规则**
   - SQL注入防护
   - XSS攻击防护
   - CC攻击防护
   - 自定义规则

---

## 💰 成本预估和优化

### 每月费用预估（人民币）

| 服务 | 基础配置 | 标准配置 | 企业配置 | 备注 |
|------|----------|----------|----------|------|
| CVM云服务器 | ¥65 (1核2G) | ¥127 (2核4G) | ¥254 (4核8G) | 包年包月更优惠 |
| CDB数据库 | ¥88 (1核2G) | ¥176 (2核4G) | ¥352 (4核8G) | 高可用版 |
| COS对象存储 | ¥10 | ¥20 | ¥50 | 存储量+流量 |
| CDN加速 | ¥15 | ¥30 | ¥80 | 流量计费 |
| SSL证书 | ¥0 | ¥0 | ¥888 | 免费/企业版 |
| 域名费用 | ¥55/年 | ¥55/年 | ¥55/年 | .com域名 |
| 备案服务 | ¥0 | ¥0 | ¥0 | 免费 |
| **月度总计** | **¥178** | **¥353** | **¥736** | 不含域名年费 |

### 💡 成本优化建议

1. **包年包月优惠**
   - 年付通常有10-15%折扣
   - 关注腾讯云官方活动

2. **竞价实例**
   - 开发测试环境可使用竞价实例
   - 成本可降低50-80%

3. **资源监控**
   - 使用云监控监控资源使用率
   - 根据实际使用调整配置

4. **CDN优化**
   - 合理设置缓存时间
   - 启用Gzip压缩
   - 选择合适的计费方式

---

## 📚 第九章：常见问题和故障排除

### 9.1 部署检查清单 ✅

**备案检查**：
- [ ] 域名备案已通过
- [ ] 备案信息与实际使用一致
- [ ] 网站内容符合备案要求

**服务器检查**：
- [ ] CVM实例正常运行
- [ ] 安全组配置正确
- [ ] Nginx配置正确
- [ ] PM2服务运行中
- [ ] SSL证书配置正确

**数据库检查**：
- [ ] CDB实例正常运行
- [ ] 数据库连接正常
- [ ] 安全组配置正确
- [ ] 自动备份已启用

**前端检查**：
- [ ] COS存储桶配置正确
- [ ] CDN加速正常
- [ ] 静态网站托管启用
- [ ] 域名解析正确

### 9.2 常见错误解决

#### ❌ "备案未通过"
```bash
# 检查备案信息是否准确
# 确保服务器在腾讯云
# 联系备案客服：4009-100-100
```

#### ❌ "数据库连接失败"
```bash
# 检查安全组规则
# 确保CVM和CDB在同一VPC
# 检查数据库用户权限
```

#### ❌ "网站访问慢"
```bash
# 启用CDN加速
# 优化数据库查询
# 检查带宽配置
# 启用Gzip压缩
```

#### ❌ "SSL证书问题"
```bash
# 检查证书是否过期
# 确认域名与证书匹配
# 检查Nginx配置
```

### 9.3 监控和告警

1. **关键指标监控**
   ```
   服务可用性: > 99.9%
   响应时间: < 2秒
   错误率: < 0.1%
   CPU使用率: < 80%
   内存使用率: < 85%
   ```

2. **告警通知渠道**
   - 短信通知（重要告警）
   - 邮件通知（所有告警）
   - 微信群通知（团队协作）

---

## 📚 第十章：合规和最佳实践

### 10.1 网络安全等级保护

如果是企业应用，建议考虑等保备案：

1. **等保评估**
   - 确定等保级别（通常为二级或三级）
   - 联系等保测评机构

2. **安全整改**
   - 根据等保要求进行安全整改
   - 部署必要的安全设备

3. **定期测评**
   - 每年进行等保测评
   - 及时修复安全漏洞

### 10.2 数据保护

1. **数据加密**
   ```bash
   # 传输加密: HTTPS/SSL
   # 存储加密: CDB透明加密
   # 应用加密: 敏感字段加密
   ```

2. **数据备份**
   - 本地备份 + 异地备份
   - 定期恢复测试
   - 备份数据加密

3. **隐私保护**
   - 遵循《个人信息保护法》
   - 制定隐私政策
   - 用户同意机制

---

## 🚀 部署完成后验证

### 验证清单

1. **域名访问**
   ```
   https://[你的域名] - 前端界面
   https://[你的域名]/api/health - API健康检查
   ```

2. **功能测试**
   - 用户注册/登录
   - 联系人管理
   - 邮件模板创建
   - 活动管理

3. **性能测试**
   - 页面加载速度
   - API响应时间
   - 并发测试

4. **安全测试**
   - SQL注入测试
   - XSS攻击测试
   - 权限验证测试

---

## 📞 技术支持和服务

### 腾讯云官方支持

1. **技术支持**
   - 在线工单：7x24小时
   - 电话支持：95716（收费）
   - 社区论坛：免费

2. **文档资源**
   - [腾讯云官方文档](https://cloud.tencent.com/document)
   - [最佳实践指南](https://cloud.tencent.com/developer)
   - [视频教程](https://cloud.tencent.com/edu)

### 第三方服务商

1. **备案服务**
   - 腾讯云备案服务：免费
   - 第三方代办：收费但更便捷

2. **运维服务**
   - 7x24小时运维托管
   - 安全防护代维
   - 性能优化咨询

---

## 🎉 部署完成！

恭喜！您已经成功将EDM邮件营销系统部署到腾讯云生产环境。

**中国用户选择腾讯云的优势**：
1. 🇨🇳 **访问速度快** - 国内多节点，低延迟
2. 🛡️ **合规保障** - 支持备案，符合法规要求  
3. 💬 **中文服务** - 7x24小时中文技术支持
4. 💰 **性价比高** - 相比海外云服务更有价格优势
5. 🔗 **生态完整** - 微信、QQ等生态系统集成

**下一步建议**：
1. 📚 完成网站备案
2. 📊 设置监控告警
3. 🔐 加强安全防护
4. 📖 准备用户培训
5. 🚀 开始邮件营销！

**记住保存重要信息**：
- 腾讯云账号信息
- 服务器登录密码
- 数据库连接信息
- 域名管理信息
- 备案号和备案密码

有任何问题，请参考故障排除部分或联系腾讯云技术支持。 