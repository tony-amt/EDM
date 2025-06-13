#!/bin/bash

# EDM系统数据备份脚本
# 自动备份数据库和重要文件

set -e

# 配置
BACKUP_DIR="/opt/edm/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="edm_backup_${DATE}"
RETENTION_DAYS=7

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 创建备份目录
mkdir -p ${BACKUP_DIR}/${BACKUP_NAME}

log_info "开始备份EDM系统数据..."

# 1. 备份数据库
log_info "备份PostgreSQL数据库..."
docker exec edm-postgres-prod pg_dump -U edm_user -d amt_mail_system > ${BACKUP_DIR}/${BACKUP_NAME}/database.sql

# 2. 备份Redis数据
log_info "备份Redis数据..."
docker exec edm-redis-prod redis-cli BGSAVE
sleep 5
docker cp edm-redis-prod:/data/dump.rdb ${BACKUP_DIR}/${BACKUP_NAME}/redis.rdb

# 3. 备份配置文件
log_info "备份配置文件..."
cp /opt/edm/.env.production ${BACKUP_DIR}/${BACKUP_NAME}/
cp /opt/edm/docker-compose.prod.yml ${BACKUP_DIR}/${BACKUP_NAME}/
cp /etc/nginx/sites-available/edm ${BACKUP_DIR}/${BACKUP_NAME}/nginx.conf

# 4. 备份上传文件
log_info "备份上传文件..."
if [ -d "/opt/edm/uploads" ]; then
    tar -czf ${BACKUP_DIR}/${BACKUP_NAME}/uploads.tar.gz -C /opt/edm uploads/
fi

# 5. 备份日志文件
log_info "备份日志文件..."
if [ -d "/opt/edm/logs" ]; then
    tar -czf ${BACKUP_DIR}/${BACKUP_NAME}/logs.tar.gz -C /opt/edm logs/
fi

# 6. 创建备份信息文件
cat > ${BACKUP_DIR}/${BACKUP_NAME}/backup_info.txt << EOF
EDM系统备份信息
================
备份时间: $(date)
备份版本: ${BACKUP_NAME}
系统版本: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)
Docker版本: $(docker --version)
数据库版本: $(docker exec edm-postgres-prod psql -U edm_user -d amt_mail_system -c "SELECT version();" -t | head -1)

备份内容:
- database.sql: PostgreSQL数据库完整备份
- redis.rdb: Redis数据备份
- .env.production: 环境配置文件
- docker-compose.prod.yml: Docker编排文件
- nginx.conf: Nginx配置文件
- uploads.tar.gz: 上传文件备份
- logs.tar.gz: 日志文件备份

恢复说明:
1. 恢复数据库: docker exec -i edm-postgres-prod psql -U edm_user -d amt_mail_system < database.sql
2. 恢复Redis: docker cp redis.rdb edm-redis-prod:/data/dump.rdb && docker restart edm-redis-prod
3. 恢复配置: 复制配置文件到对应位置
4. 恢复文件: tar -xzf uploads.tar.gz -C /opt/edm/
EOF

# 7. 压缩备份
log_info "压缩备份文件..."
cd ${BACKUP_DIR}
tar -czf ${BACKUP_NAME}.tar.gz ${BACKUP_NAME}/
rm -rf ${BACKUP_NAME}/

# 8. 清理旧备份
log_info "清理${RETENTION_DAYS}天前的备份..."
find ${BACKUP_DIR} -name "edm_backup_*.tar.gz" -mtime +${RETENTION_DAYS} -delete

# 9. 显示备份信息
BACKUP_SIZE=$(du -h ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz | cut -f1)
log_info "备份完成！"
log_info "备份文件: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
log_info "备份大小: ${BACKUP_SIZE}"
log_info "备份保留: ${RETENTION_DAYS}天"

# 10. 可选：上传到云存储
if [ ! -z "$BACKUP_UPLOAD_CMD" ]; then
    log_info "上传备份到云存储..."
    eval $BACKUP_UPLOAD_CMD ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz
fi

log_info "备份任务完成！" 