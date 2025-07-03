#!/bin/bash

# 🔍 检查SSL证书状态脚本

set -e

SERVER_IP="43.135.38.15"
SERVER_USER="ubuntu"
SERVER_PASS="Tony1231!"

echo "🔍 检查SSL证书状态..."
echo "📅 时间: $(date)"

# 服务器端操作
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" << 'ENDSSH'
#!/bin/bash
set -e

echo "🔧 开始检查SSL证书..."

# 获取容器信息
NGINX_CONTAINER=$(sudo docker ps --format "{{.Names}}" | grep nginx | head -1)
echo "Nginx容器: $NGINX_CONTAINER"

echo ""
echo "=== SSL证书检查报告 ==="
echo ""

# 1. 检查Let's Encrypt证书
echo "1. 🔍 检查Let's Encrypt证书..."
if sudo docker exec "$NGINX_CONTAINER" test -d /etc/letsencrypt/live/tkmail.fun/; then
    echo "✅ Let's Encrypt目录存在"
    
    if sudo docker exec "$NGINX_CONTAINER" test -f /etc/letsencrypt/live/tkmail.fun/fullchain.pem; then
        echo "✅ fullchain.pem 存在"
        CERT_INFO=$(sudo docker exec "$NGINX_CONTAINER" openssl x509 -in /etc/letsencrypt/live/tkmail.fun/fullchain.pem -text -noout 2>/dev/null | grep -A2 "Validity" || echo "无法读取证书信息")
        echo "   证书信息: $CERT_INFO"
        
        # 检查证书有效期
        EXPIRY=$(sudo docker exec "$NGINX_CONTAINER" openssl x509 -in /etc/letsencrypt/live/tkmail.fun/fullchain.pem -noout -enddate 2>/dev/null || echo "无法获取有效期")
        echo "   有效期: $EXPIRY"
    else
        echo "❌ fullchain.pem 不存在"
    fi
    
    if sudo docker exec "$NGINX_CONTAINER" test -f /etc/letsencrypt/live/tkmail.fun/privkey.pem; then
        echo "✅ privkey.pem 存在"
    else
        echo "❌ privkey.pem 不存在"
    fi
else
    echo "❌ Let's Encrypt目录不存在"
fi

echo ""

# 2. 检查自签名证书
echo "2. 🔍 检查自签名证书..."
if sudo docker exec "$NGINX_CONTAINER" test -d /etc/nginx/ssl/; then
    echo "✅ /etc/nginx/ssl/ 目录存在"
    
    if sudo docker exec "$NGINX_CONTAINER" test -f /etc/nginx/ssl/cert.pem; then
        echo "✅ cert.pem 存在"
        SELF_CERT_INFO=$(sudo docker exec "$NGINX_CONTAINER" openssl x509 -in /etc/nginx/ssl/cert.pem -text -noout 2>/dev/null | grep -A2 "Validity" || echo "无法读取证书信息")
        echo "   证书信息: $SELF_CERT_INFO"
        
        SELF_EXPIRY=$(sudo docker exec "$NGINX_CONTAINER" openssl x509 -in /etc/nginx/ssl/cert.pem -noout -enddate 2>/dev/null || echo "无法获取有效期")
        echo "   有效期: $SELF_EXPIRY"
    else
        echo "❌ cert.pem 不存在"
    fi
    
    if sudo docker exec "$NGINX_CONTAINER" test -f /etc/nginx/ssl/key.pem; then
        echo "✅ key.pem 存在"
    else
        echo "❌ key.pem 不存在"
    fi
else
    echo "❌ /etc/nginx/ssl/ 目录不存在"
fi

echo ""

# 3. 检查其他可能的证书路径
echo "3. 🔍 检查其他证书路径..."
if sudo docker exec "$NGINX_CONTAINER" test -d /etc/ssl/certs/; then
    echo "✅ /etc/ssl/certs/ 目录存在"
    CERT_FILES=$(sudo docker exec "$NGINX_CONTAINER" find /etc/ssl/certs/ -name "*nginx*" -o -name "*tkmail*" 2>/dev/null || echo "")
    if [ -n "$CERT_FILES" ]; then
        echo "   找到相关证书文件: $CERT_FILES"
    else
        echo "   未找到相关证书文件"
    fi
else
    echo "❌ /etc/ssl/certs/ 目录不存在"
fi

echo ""

# 4. 检查Certbot
echo "4. 🔍 检查Certbot状态..."
if sudo docker exec "$NGINX_CONTAINER" which certbot >/dev/null 2>&1; then
    echo "✅ Certbot已安装"
    CERTBOT_LIST=$(sudo docker exec "$NGINX_CONTAINER" certbot certificates 2>/dev/null || echo "无法获取证书列表")
    echo "   证书列表: $CERTBOT_LIST"
else
    echo "❌ Certbot未安装"
fi

echo ""

# 5. 检查当前nginx配置中的SSL设置
echo "5. 🔍 检查当前nginx配置中的SSL设置..."
SSL_CERT_LINE=$(sudo docker exec "$NGINX_CONTAINER" grep -n "ssl_certificate " /etc/nginx/nginx.conf 2>/dev/null || echo "")
SSL_KEY_LINE=$(sudo docker exec "$NGINX_CONTAINER" grep -n "ssl_certificate_key " /etc/nginx/nginx.conf 2>/dev/null || echo "")

if [ -n "$SSL_CERT_LINE" ]; then
    echo "   当前SSL证书配置: $SSL_CERT_LINE"
else
    echo "   未找到SSL证书配置"
fi

if [ -n "$SSL_KEY_LINE" ]; then
    echo "   当前SSL私钥配置: $SSL_KEY_LINE"
else
    echo "   未找到SSL私钥配置"
fi

echo ""
echo "=== 检查完成 ==="

ENDSSH

echo ""
echo "🎯 SSL证书检查完成！" 