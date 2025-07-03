# SPEC-010-nginx配置管理规范

**文档编号**: SPEC-010  
**创建时间**: 2025-06-27  
**适用范围**: EDM系统生产环境nginx配置管理  
**维护状态**: 活跃  

## 📋 规范概述

本规范定义了EDM系统nginx配置文件的管理标准，防止配置文件冲突和混乱，确保系统稳定运行。

## 🚨 问题背景

### 配置文件串的问题
在EDM系统部署过程中发现nginx配置文件存在严重的"串"问题：

1. **多处定义冲突**: nginx.conf主配置文件中直接定义了server块，同时sites-enabled中也有相同域名的配置
2. **配置优先级混乱**: 主配置文件中的设置覆盖了sites-available中的配置
3. **维护困难**: 修改sites-available中的配置不生效，需要同时修改多个文件

### 具体表现
```bash
# 问题现象
/etc/nginx/nginx.conf 中包含:
server {
    server_name tkmail.fun;
    proxy_pass http://127.0.0.1:3002;  # 错误端口
}

# 同时 sites-enabled 中也有:
server {
    server_name tkmail.fun;
    proxy_pass http://127.0.0.1:8080;  # 正确端口
}

# 结果: nginx.conf中的配置生效，sites-enabled被忽略
```

## 🎯 标准配置架构

### 1. nginx.conf主配置文件
**职责**: 仅包含全局配置，不包含具体站点配置

```nginx
user www-data;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;

events {
    worker_connections 768;
    use epoll;
    multi_accept on;
}

http {
    # 全局HTTP配置
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    # 基本设置
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    
    # 日志设置
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;
    
    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    
    # 🎯 关键: 只包含sites-enabled，不直接定义server块
    include /etc/nginx/sites-enabled/*;
}
```

### 2. sites-available目录结构
**职责**: 存储所有可用的站点配置

```
/etc/nginx/sites-available/
├── tkmail.fun.conf          # 主站点配置
├── api.tkmail.fun.conf      # API子域名配置  
├── track.tkmail.fun.conf    # 跟踪子域名配置
└── default                  # 默认站点配置
```

### 3. sites-enabled目录结构
**职责**: 通过软链接启用需要的站点

```
/etc/nginx/sites-enabled/
├── tkmail.fun.conf -> /etc/nginx/sites-available/tkmail.fun.conf
├── api.tkmail.fun.conf -> /etc/nginx/sites-available/api.tkmail.fun.conf
└── track.tkmail.fun.conf -> /etc/nginx/sites-available/track.tkmail.fun.conf
```

## 📝 配置文件模板

### 主站点配置模板 (tkmail.fun.conf)
```nginx
# HTTPS服务器配置
server {
    listen 443 ssl http2;
    server_name tkmail.fun www.tkmail.fun;
    
    # SSL证书配置
    ssl_certificate /etc/letsencrypt/live/tkmail.fun/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tkmail.fun/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    
    # 反向代理到后端应用
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时设置
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    # 健康检查端点
    location /health {
        proxy_pass http://127.0.0.1:8080/health;
        access_log off;
    }
}

# HTTP重定向到HTTPS
server {
    listen 80;
    server_name tkmail.fun www.tkmail.fun;
    return 301 https://$server_name$request_uri;
}
```

## 🔧 配置管理流程

### 1. 新增站点配置
```bash
# 1. 创建配置文件
sudo nano /etc/nginx/sites-available/example.com.conf

# 2. 测试配置语法
sudo nginx -t

# 3. 启用站点
sudo ln -s /etc/nginx/sites-available/example.com.conf /etc/nginx/sites-enabled/

# 4. 重新加载nginx
sudo systemctl reload nginx
```

### 2. 修改现有配置
```bash
# 1. 备份当前配置
sudo cp /etc/nginx/sites-available/tkmail.fun.conf /etc/nginx/sites-available/tkmail.fun.conf.backup.$(date +%Y%m%d_%H%M%S)

# 2. 修改配置文件
sudo nano /etc/nginx/sites-available/tkmail.fun.conf

# 3. 测试配置
sudo nginx -t

# 4. 重新加载
sudo systemctl reload nginx
```

### 3. 禁用站点
```bash
# 1. 删除软链接
sudo rm /etc/nginx/sites-enabled/example.com.conf

# 2. 重新加载nginx
sudo systemctl reload nginx

# 注意: sites-available中的文件保留，方便以后重新启用
```

## 🚨 配置冲突规避规则

### 强制规则
1. **nginx.conf禁止包含server块**: 主配置文件只能包含全局设置和include指令
2. **一个域名一个配置文件**: 每个域名或子域名独立配置文件
3. **修改前必须备份**: 所有配置变更前必须创建带时间戳的备份
4. **测试后才生效**: 使用`nginx -t`测试通过后才能reload

### 检查清单
- [ ] nginx.conf中没有server块定义
- [ ] sites-enabled中没有重复的server_name
- [ ] 配置文件语法正确 (`nginx -t`通过)
- [ ] 备份文件已创建
- [ ] 变更记录已更新

## 🔍 故障排查指南

### 常见问题诊断

#### 1. 配置不生效
```bash
# 检查nginx实际加载的配置
sudo nginx -T | grep -A 10 -B 5 'server_name your-domain.com'

# 检查是否有多处定义
grep -r 'server_name your-domain.com' /etc/nginx/
```

#### 2. 502错误
```bash
# 检查代理目标是否可达
curl -I http://127.0.0.1:8080/health

# 检查nginx错误日志
sudo tail -f /var/log/nginx/error.log
```

#### 3. SSL证书问题
```bash
# 检查证书有效性
sudo certbot certificates

# 测试SSL连接
openssl s_client -connect localhost:443 -servername your-domain.com
```

### 配置验证脚本
```bash
#!/bin/bash
# nginx-config-check.sh

echo "🔍 nginx配置检查"

# 1. 检查nginx.conf中是否有server块
if grep -q "server {" /etc/nginx/nginx.conf; then
    echo "❌ nginx.conf中包含server块定义"
    grep -n "server {" /etc/nginx/nginx.conf
else
    echo "✅ nginx.conf结构正确"
fi

# 2. 检查重复的server_name
echo "🔍 检查重复的server_name:"
grep -r "server_name" /etc/nginx/sites-enabled/ | sort

# 3. 测试配置语法
echo "🔍 测试配置语法:"
sudo nginx -t

# 4. 检查端口监听
echo "🔍 检查端口监听:"
netstat -tlnp | grep -E ":80|:443"

echo "✅ 配置检查完成"
```

## 📊 配置管理最佳实践

### 1. 版本控制
```bash
# 将nginx配置纳入Git管理
cd /etc/nginx
sudo git init
sudo git add sites-available/ nginx.conf
sudo git commit -m "Initial nginx configuration"
```

### 2. 自动化部署
```bash
# 配置部署脚本
#!/bin/bash
# deploy-nginx-config.sh

SITE_NAME=$1
CONFIG_FILE="/etc/nginx/sites-available/${SITE_NAME}.conf"

# 备份现有配置
sudo cp $CONFIG_FILE ${CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)

# 部署新配置
sudo cp new-config.conf $CONFIG_FILE

# 测试配置
if sudo nginx -t; then
    sudo systemctl reload nginx
    echo "✅ 配置部署成功"
else
    echo "❌ 配置测试失败，回滚"
    sudo cp ${CONFIG_FILE}.backup.* $CONFIG_FILE
fi
```

### 3. 监控和告警
```bash
# 配置健康检查
*/5 * * * * curl -f https://tkmail.fun/health > /dev/null || echo "Site down" | mail admin@example.com
```

## 📋 变更记录模板

### 配置变更记录
```markdown
## nginx配置变更记录

**变更时间**: 2025-06-27 15:30  
**变更人员**: DevOps Team  
**变更类型**: 配置标准化  

### 变更内容
- 清理nginx.conf中的直接server定义
- 迁移站点配置到sites-available
- 建立标准的include结构

### 影响评估
- 影响域名: tkmail.fun
- 预期停机时间: 0秒 (热重载)
- 回滚方案: 恢复备份配置

### 验证结果
- [x] 配置语法测试通过
- [x] 站点正常访问
- [x] SSL证书正常
- [x] 性能无影响
```

## 🎯 EDM系统特定配置

### 当前生产环境配置
```nginx
# /etc/nginx/sites-available/tkmail.fun.conf
server {
    listen 443 ssl http2;
    server_name tkmail.fun www.tkmail.fun;
    
    ssl_certificate /etc/letsencrypt/live/tkmail.fun/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tkmail.fun/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    
    # 代理到EDM后端应用 (端口8080)
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name tkmail.fun www.tkmail.fun;
    return 301 https://$server_name$request_uri;
}
```

### Cloudflare集成注意事项
由于EDM系统使用Cloudflare CDN，需要注意：

1. **SSL/TLS模式**: 设置为"Full (strict)"
2. **代理状态**: 确认是否需要橙色云朵(代理)
3. **重定向规则**: 避免与nginx重定向冲突
4. **真实IP获取**: 使用Cloudflare的真实IP模块

## 📞 紧急联系和支持

### 配置问题紧急处理
1. **立即回滚**: 使用最近的备份配置
2. **检查日志**: 查看nginx错误日志
3. **联系团队**: 通知DevOps团队
4. **文档记录**: 记录问题和解决过程

---

**文档维护**: DevOps Team  
**审核状态**: 已通过  
**下次审核**: 2025-09-27 