# EDM系统手动部署步骤

## 🔧 第一步：连接服务器并更新系统

```bash
# 1. 连接服务器
ssh ubuntu@43.135.38.15
# 密码：TkMail2025!

# 2. 更新系统
sudo apt update && sudo apt upgrade -y

# 3. 安装基础工具
sudo apt install -y curl wget git vim htop unzip tree
```

## 🐳 第二步：安装Docker和Docker Compose

```bash
# 1. 安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 2. 将ubuntu用户添加到docker组
sudo usermod -aG docker ubuntu

# 3. 启动Docker服务
sudo systemctl enable docker
sudo systemctl start docker

# 4. 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 5. 验证安装
docker --version
docker-compose --version
```

## 🌐 第三步：安装Nginx和SSL证书工具

```bash
# 1. 安装Nginx
sudo apt install -y nginx

# 2. 启动Nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# 3. 安装Certbot（SSL证书）
sudo apt install -y certbot python3-certbot-nginx

# 4. 验证Nginx运行
sudo systemctl status nginx
```

## 📁 第四步：克隆项目代码

```bash
# 1. 创建项目目录
sudo mkdir -p /opt/edm
sudo chown ubuntu:ubuntu /opt/edm
cd /opt/edm

# 2. 克隆代码
git clone https://github.com/tony-amt/EDM.git .

# 3. 查看项目结构
ls -la
```

## ⚙️ 第五步：配置生产环境

```bash
# 1. 复制生产环境配置
cp deploy/production.env .env.production

# 2. 查看配置文件
cat .env.production

# 3. 创建数据目录
mkdir -p data/postgres data/redis data/backups
sudo chown -R ubuntu:ubuntu data/
```

## 🔧 第六步：配置Nginx

```bash
# 1. 创建Nginx配置文件
sudo tee /etc/nginx/sites-available/tkmail.fun > /dev/null << 'EOF'
server {
    listen 80;
    server_name tkmail.fun www.tkmail.fun api.tkmail.fun track.tkmail.fun;
    
    # 临时配置，SSL证书申请后会自动更新
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# 2. 启用站点配置
sudo ln -sf /etc/nginx/sites-available/tkmail.fun /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# 3. 测试Nginx配置
sudo nginx -t

# 4. 重载Nginx
sudo systemctl reload nginx
```

## 🚀 第七步：启动EDM服务

```bash
# 1. 回到项目目录
cd /opt/edm

# 2. 创建生产环境Docker Compose配置
cp docker-compose.yml docker-compose.prod.yml

# 3. 修改生产环境配置（使用生产环境变量）
# 这一步需要编辑docker-compose.prod.yml文件

# 4. 启动服务
docker-compose -f docker-compose.prod.yml up -d

# 5. 查看服务状态
docker-compose -f docker-compose.prod.yml ps

# 6. 查看日志
docker-compose -f docker-compose.prod.yml logs -f
```

## 🔒 第八步：申请SSL证书

```bash
# 1. 申请SSL证书（确保域名已解析）
sudo certbot --nginx -d tkmail.fun -d www.tkmail.fun -d api.tkmail.fun -d track.tkmail.fun --email zhangton58@gmail.com --agree-tos --non-interactive

# 2. 设置自动续期
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -

# 3. 验证SSL证书
sudo certbot certificates
```

## ✅ 第九步：验证部署

```bash
# 1. 检查服务状态
docker-compose -f docker-compose.prod.yml ps

# 2. 检查端口监听
sudo netstat -tlnp | grep -E ':(80|443|3000|3001|5432|6379)'

# 3. 测试网站访问
curl -I http://tkmail.fun
curl -I https://tkmail.fun

# 4. 测试API
curl -I https://api.tkmail.fun/health
```

## 🎉 部署完成

如果所有步骤都成功，您应该能够访问：

- **管理界面**: https://tkmail.fun
- **API服务**: https://api.tkmail.fun  
- **追踪服务**: https://track.tkmail.fun

**默认登录账号**：
- 用户名：admin
- 密码：admin123456

## 🔧 故障排除

如果遇到问题，请检查：

```bash
# 查看Docker服务日志
docker-compose -f docker-compose.prod.yml logs backend
docker-compose -f docker-compose.prod.yml logs frontend
docker-compose -f docker-compose.prod.yml logs postgres
docker-compose -f docker-compose.prod.yml logs redis

# 查看Nginx日志
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# 重启服务
docker-compose -f docker-compose.prod.yml restart
sudo systemctl restart nginx
``` 