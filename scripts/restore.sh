#!/bin/bash

# PostgreSQL数据库恢复脚本
# 作用：从备份文件恢复数据库

set -e

# 配置
BACKUP_DIR="/backups"
DB_HOST="postgres"
DB_USER="postgres"
DB_NAME="amt_mail_system"

# 检查参数
if [ $# -eq 0 ]; then
    echo "用法: $0 <backup_file>"
    echo "可用的备份文件:"
    ls -la $BACKUP_DIR/backup_*.sql.gz 2>/dev/null || echo "没有找到备份文件"
    exit 1
fi

BACKUP_FILE=$1

# 检查备份文件是否存在
if [ ! -f "$BACKUP_FILE" ]; then
    echo "错误: 备份文件不存在: $BACKUP_FILE"
    exit 1
fi

echo "开始恢复数据库: $DB_NAME"
echo "恢复时间: $(date)"
echo "备份文件: $BACKUP_FILE"

# 如果是压缩文件，先解压
if [[ $BACKUP_FILE == *.gz ]]; then
    echo "解压备份文件..."
    UNCOMPRESSED_FILE="${BACKUP_FILE%.gz}"
    gunzip -c "$BACKUP_FILE" > "$UNCOMPRESSED_FILE"
    RESTORE_FILE="$UNCOMPRESSED_FILE"
else
    RESTORE_FILE="$BACKUP_FILE"
fi

# 确认恢复操作
echo "警告: 此操作将删除现有数据库并从备份恢复!"
read -p "确认继续? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "恢复操作已取消"
    exit 1
fi

# 删除现有数据库
echo "删除现有数据库..."
dropdb -h $DB_HOST -U $DB_USER $DB_NAME --if-exists

# 创建新数据库
echo "创建新数据库..."
createdb -h $DB_HOST -U $DB_USER $DB_NAME

# 恢复数据
echo "从备份恢复数据..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME < "$RESTORE_FILE"

if [ $? -eq 0 ]; then
    echo "恢复成功!"
    
    # 清理临时文件
    if [[ $BACKUP_FILE == *.gz ]] && [ -f "$UNCOMPRESSED_FILE" ]; then
        rm "$UNCOMPRESSED_FILE"
        echo "临时文件已清理"
    fi
else
    echo "恢复失败"
    exit 1
fi

echo "数据库恢复完成: $(date)" 