#!/bin/bash
# 数据库备份脚本
# 用法: ./backup.sh [full|incremental] [test]

# 检查是否为测试模式
TEST_MODE=false
if [[ "$*" == *"test"* ]]; then
  TEST_MODE=true
  echo "运行在测试模式，只打印不执行实际操作"
fi

# 加载环境变量
if [ -f ../.env ]; then
  source ../.env
fi

# 默认配置
DB_HOST=${DB_HOST:-"localhost"}
DB_PORT=${DB_PORT:-"5432"}
DB_NAME=${DB_NAME:-"amt_mail_system"}
DB_USER=${DB_USER:-"postgres"}
DB_PASSWORD=${DB_PASSWORD:-"postgres"}
BACKUP_DIR=${BACKUP_DIR:-"../backup/database"}
UPLOAD_BACKUP_DIR=${UPLOAD_BACKUP_DIR:-"../backup/uploads"}
CONFIG_BACKUP_DIR=${CONFIG_BACKUP_DIR:-"../backup/config"}
LOG_FILE=${LOG_FILE:-"../logs/backup.log"}
BACKUP_RETAIN_DAYS=${BACKUP_RETAIN_DAYS:-30}

# 创建备份目录
mkdir_cmd() {
  if [ "$TEST_MODE" = true ]; then
    echo "将创建目录: $1"
  else
    mkdir -p "$1"
  fi
}

mkdir_cmd ${BACKUP_DIR}
mkdir_cmd ${UPLOAD_BACKUP_DIR}
mkdir_cmd ${CONFIG_BACKUP_DIR}
mkdir_cmd $(dirname ${LOG_FILE})

# 确保日志文件存在
if [ "$TEST_MODE" = false ]; then
  touch ${LOG_FILE}
fi

# 日志函数
log() {
  local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
  local message="[$timestamp] $1"
  echo "$message"
  
  if [ "$TEST_MODE" = false ]; then
    echo "$message" >> ${LOG_FILE}
  fi
}

# 错误处理
handle_error() {
  log "错误: $1"
  exit 1
}

# 检查依赖工具
check_dependencies() {
  if [ "$TEST_MODE" = true ]; then
    return 0
  fi
  
  command -v pg_dump >/dev/null 2>&1 || handle_error "需要pg_dump工具，请安装PostgreSQL客户端"
  command -v gzip >/dev/null 2>&1 || handle_error "需要gzip工具"
  command -v find >/dev/null 2>&1 || handle_error "需要find工具"
}

# 备份数据库
backup_database() {
  local type=$1
  local date_suffix=$(date +%Y%m%d_%H%M%S)
  local backup_file="${BACKUP_DIR}/${DB_NAME}_${type}_${date_suffix}.sql"

  log "开始${type}备份数据库 ${DB_NAME}..."
  
  if [ "$TEST_MODE" = true ]; then
    log "将执行备份命令: pg_dump -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -F c -f ${backup_file}"
    log "测试模式: 跳过实际执行"
    return 0
  fi
  
  # 设置环境变量避免密码在命令行中显示
  export PGPASSWORD="${DB_PASSWORD}"
  
  if [ "$type" == "full" ]; then
    pg_dump -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -F c -f ${backup_file} || handle_error "数据库备份失败"
  else
    # 增量备份 - 仅备份最近24小时修改的数据
    pg_dump -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} \
      --data-only \
      -t "$(psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -t -c "SELECT tablename FROM pg_tables WHERE schemaname='public'")" \
      -F c -f ${backup_file} || handle_error "增量数据库备份失败"
  fi
  
  # 清除环境变量
  unset PGPASSWORD
  
  # 压缩备份文件
  gzip ${backup_file} || handle_error "压缩备份文件失败"
  
  log "数据库${type}备份完成: ${backup_file}.gz ($(du -h ${backup_file}.gz | cut -f1))"
}

# 备份上传文件
backup_uploads() {
  local date_suffix=$(date +%Y%m%d_%H%M%S)
  local upload_dir="../public/uploads"
  local backup_file="${UPLOAD_BACKUP_DIR}/uploads_${date_suffix}.tar.gz"
  
  if [ -d "${upload_dir}" ]; then
    log "开始备份上传文件..."
    
    if [ "$TEST_MODE" = true ]; then
      log "将执行备份命令: tar -czf ${backup_file} -C $(dirname ${upload_dir}) $(basename ${upload_dir})"
      log "测试模式: 跳过实际执行"
    else
      tar -czf ${backup_file} -C $(dirname ${upload_dir}) $(basename ${upload_dir}) || handle_error "上传文件备份失败"
      log "上传文件备份完成: ${backup_file} ($(du -h ${backup_file} | cut -f1))"
    fi
  else
    log "警告: 上传目录不存在，跳过备份"
  fi
}

# 备份配置文件
backup_config() {
  local date_suffix=$(date +%Y%m%d_%H%M%S)
  local config_file="../.env"
  local backup_file="${CONFIG_BACKUP_DIR}/env_${date_suffix}.bak"
  
  if [ -f "${config_file}" ]; then
    log "开始备份配置文件..."
    
    if [ "$TEST_MODE" = true ]; then
      log "将执行备份命令: grep -v \"PASSWORD\\|SECRET\\|KEY\" ${config_file} > ${backup_file}"
      log "测试模式: 跳过实际执行"
    else
      # 复制配置文件，但排除敏感信息
      grep -v "PASSWORD\|SECRET\|KEY" ${config_file} > ${backup_file} || handle_error "配置文件备份失败"
      log "配置文件备份完成: ${backup_file}"
    fi
  else
    log "警告: 配置文件不存在，跳过备份"
  fi
}

# 清理旧备份
cleanup_old_backups() {
  log "清理${BACKUP_RETAIN_DAYS}天前的备份文件..."
  
  if [ "$TEST_MODE" = true ]; then
    log "将执行清理命令: find ${BACKUP_DIR} -name \"${DB_NAME}_*.gz\" -type f -mtime +${BACKUP_RETAIN_DAYS} -delete"
    log "将执行清理命令: find ${UPLOAD_BACKUP_DIR} -name \"uploads_*.tar.gz\" -type f -mtime +${BACKUP_RETAIN_DAYS} -delete"
    log "测试模式: 跳过实际执行"
    return 0
  fi
  
  # 清理数据库备份
  find ${BACKUP_DIR} -name "${DB_NAME}_*.gz" -type f -mtime +${BACKUP_RETAIN_DAYS} -delete
  
  # 清理上传文件备份
  find ${UPLOAD_BACKUP_DIR} -name "uploads_*.tar.gz" -type f -mtime +${BACKUP_RETAIN_DAYS} -delete
  
  # 清理配置文件备份，保留最近10个版本
  if [ $(find ${CONFIG_BACKUP_DIR} -name "env_*.bak" | wc -l) -gt 10 ]; then
    find ${CONFIG_BACKUP_DIR} -name "env_*.bak" -type f | sort | head -n -10 | xargs rm -f
  fi
  
  log "清理完成"
}

# 主函数
main() {
  check_dependencies
  
  # 确定备份类型
  backup_type=${1:-"full"}
  
  log "=== 开始 ${backup_type} 备份 ==="
  
  # 备份数据库
  backup_database ${backup_type}
  
  # 如果是完整备份，同时备份上传文件和配置
  if [ "$backup_type" == "full" ]; then
    backup_uploads
    backup_config
  fi
  
  # 清理旧备份
  cleanup_old_backups
  
  log "=== 备份过程完成 ==="
}

# 执行主函数
main $1 