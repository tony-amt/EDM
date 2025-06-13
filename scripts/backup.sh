#!/bin/bash

# PostgreSQL数据库备份脚本
# 作用：定期备份数据库，防止数据丢失

set -e

# 配置
BACKUP_DIR="/backups"
DB_HOST="postgres"
DB_USER="postgres"
DB_NAME="amt_mail_system"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"

# 创建备份目录
mkdir -p $BACKUP_DIR

echo "开始备份数据库: $DB_NAME"
echo "备份时间: $(date)"
echo "备份文件: $BACKUP_FILE"

# 执行备份
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > $BACKUP_FILE

if [ $? -eq 0 ]; then
    echo "备份成功: $BACKUP_FILE"
    
    # 压缩备份文件
    gzip $BACKUP_FILE
    echo "备份文件已压缩: $BACKUP_FILE.gz"
    
    # 清理旧备份（保留7天）
    find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete
    echo "旧备份文件已清理"
    
else
    echo "备份失败"
    exit 1
fi

echo "备份完成: $(date)" 