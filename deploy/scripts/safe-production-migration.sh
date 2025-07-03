#!/bin/bash

# EDM 生产环境安全迁移脚本
# 用途：Phase 3 和 Phase 4 的温和上线部署

set -e  # 遇到错误立即退出

# 配置变量
PROD_HOST="43.135.38.15"
PROD_USER="ubuntu" 
PROD_PASS="Tony1231!"
DB_CONTAINER="edm-postgres"
DB_NAME="amt_mail_system"
BACKUP_DIR="/opt/edm/backups/$(date +%Y%m%d_%H%M%S)"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查连接函数
check_connection() {
    log_info "检查生产服务器连接..."
    if sshpass -p "$PROD_PASS" ssh -o StrictHostKeyChecking=no "$PROD_USER@$PROD_HOST" "echo 'Connection OK'"; then
        log_success "生产服务器连接正常"
    else
        log_error "无法连接到生产服务器"
        exit 1
    fi
}

# 数据库备份函数
backup_database() {
    log_info "创建数据库备份..."
    
    sshpass -p "$PROD_PASS" ssh -o StrictHostKeyChecking=no "$PROD_USER@$PROD_HOST" "
        mkdir -p $BACKUP_DIR
        docker exec $DB_CONTAINER pg_dump -U postgres $DB_NAME > $BACKUP_DIR/full_backup.sql
        
        # 备份关键表
        docker exec $DB_CONTAINER pg_dump -U postgres $DB_NAME -t contacts > $BACKUP_DIR/contacts_backup.sql
        docker exec $DB_CONTAINER pg_dump -U postgres $DB_NAME -t tags > $BACKUP_DIR/tags_backup.sql
        docker exec $DB_CONTAINER pg_dump -U postgres $DB_NAME -t tasks > $BACKUP_DIR/tasks_backup.sql
        docker exec $DB_CONTAINER pg_dump -U postgres $DB_NAME -t sub_tasks > $BACKUP_DIR/sub_tasks_backup.sql
        docker exec $DB_CONTAINER pg_dump -U postgres $DB_NAME -t email_services > $BACKUP_DIR/email_services_backup.sql
    "
    
    log_success "数据库备份完成: $BACKUP_DIR"
}

# Phase 3 迁移函数
migrate_phase3() {
    log_info "开始执行 Phase 3 迁移..."
    
    # 上传迁移脚本
    scp -o StrictHostKeyChecking=no deploy/scripts/phase3-production-migration.sql "$PROD_USER@$PROD_HOST:/tmp/"
    
    # 执行迁移
    sshpass -p "$PROD_PASS" ssh -o StrictHostKeyChecking=no "$PROD_USER@$PROD_HOST" "
        echo '开始Phase 3数据迁移...'
        docker exec $DB_CONTAINER psql -U postgres $DB_NAME -f /tmp/phase3-production-migration.sql
        
        if [ \$? -eq 0 ]; then
            echo 'Phase 3迁移执行成功'
        else
            echo 'Phase 3迁移执行失败'
            exit 1
        fi
    "
    
    log_success "Phase 3 迁移完成"
}

# Phase 4 升级函数
upgrade_phase4() {
    log_info "开始执行 Phase 4 升级..."
    
    # 上传升级脚本
    scp -o StrictHostKeyChecking=no deploy/scripts/phase4-production-upgrade.sql "$PROD_USER@$PROD_HOST:/tmp/"
    
    # 执行升级
    sshpass -p "$PROD_PASS" ssh -o StrictHostKeyChecking=no "$PROD_USER@$PROD_HOST" "
        echo '开始Phase 4数据升级...'
        docker exec $DB_CONTAINER psql -U postgres $DB_NAME -f /tmp/phase4-production-upgrade.sql
        
        if [ \$? -eq 0 ]; then
            echo 'Phase 4升级执行成功'
        else
            echo 'Phase 4升级执行失败'
            exit 1
        fi
    "
    
    log_success "Phase 4 升级完成"
}

# 验证迁移结果
verify_migration() {
    log_info "验证迁移结果..."
    
    sshpass -p "$PROD_PASS" ssh -o StrictHostKeyChecking=no "$PROD_USER@$PROD_HOST" "
        docker exec $DB_CONTAINER psql -U postgres $DB_NAME -c \"
        SELECT 
            'Phase 3验证' as check_type,
            COUNT(*) as tags_with_contacts 
        FROM tags WHERE jsonb_array_length(contacts) > 0;
        
        SELECT 
            'Phase 4验证' as check_type,
            COUNT(*) as services_with_reset_time
        FROM email_services WHERE last_reset_at IS NOT NULL;
        
        SELECT 
            '任务统计验证' as check_type,
            COUNT(*) as tasks_with_correct_stats
        FROM tasks WHERE total_subtasks = (
            SELECT COUNT(*) FROM sub_tasks WHERE task_id = tasks.id
        );
        \"
    "
    
    log_success "迁移结果验证完成"
}

# 重启应用服务
restart_services() {
    log_info "重启应用服务..."
    
    sshpass -p "$PROD_PASS" ssh -o StrictHostKeyChecking=no "$PROD_USER@$PROD_HOST" "
        cd /opt/edm
        
        # 优雅重启后端服务
        docker-compose restart edm-backend
        sleep 10
        
        # 检查服务状态
        if docker ps | grep edm-backend | grep -q Up; then
            echo '后端服务重启成功'
        else
            echo '后端服务重启失败'
            exit 1
        fi
        
        # 重启前端服务
        docker-compose restart edm-frontend  
        sleep 5
        
        if docker ps | grep edm-frontend | grep -q Up; then
            echo '前端服务重启成功'
        else
            echo '前端服务重启失败'  
            exit 1
        fi
    "
    
    log_success "应用服务重启完成"
}

# 健康检查
health_check() {
    log_info "执行健康检查..."
    
    # 检查API健康状态
    if curl -s "https://tkmail.fun/api/health" | grep -q "OK"; then
        log_success "API健康检查通过"
    else
        log_warning "API健康检查异常，请手动验证"
    fi
    
    # 检查数据库连接
    sshpass -p "$PROD_PASS" ssh -o StrictHostKeyChecking=no "$PROD_USER@$PROD_HOST" "
        if docker exec $DB_CONTAINER psql -U postgres $DB_NAME -c 'SELECT 1;' > /dev/null 2>&1; then
            echo '数据库连接正常'
        else
            echo '数据库连接异常'
            exit 1
        fi
    "
    
    log_success "健康检查完成"
}

# 主函数
main() {
    echo "======================================================"
    echo "🚀 EDM系统 Phase 3 & Phase 4 生产环境温和迁移"
    echo "======================================================"
    echo "开始时间: $(date)"
    echo "目标服务器: $PROD_HOST"
    echo "======================================================"
    
    # 执行步骤
    check_connection
    backup_database
    
    # 询问用户确认
    echo ""
    read -p "数据备份完成，是否继续执行迁移？(y/N): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        migrate_phase3
        upgrade_phase4
        verify_migration
        restart_services
        health_check
        
        echo ""
        echo "======================================================"
        log_success "🎉 迁移完成！"
        echo "完成时间: $(date)"
        echo "备份位置: $BACKUP_DIR"
        echo "======================================================"
    else
        log_warning "用户取消迁移操作"
        exit 0
    fi
}

# 检查依赖
if ! command -v sshpass &> /dev/null; then
    log_error "需要安装 sshpass: brew install sshpass"
    exit 1
fi

# 执行主函数
main "$@"
