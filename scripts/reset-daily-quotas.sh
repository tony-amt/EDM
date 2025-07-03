#!/bin/bash

# EDM系统每日额度重置脚本
# 建议在每日凌晨2-3点运行

LOG_FILE="/var/log/edm-quota-reset.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$DATE] 开始执行每日额度重置..." >> $LOG_FILE

# 1. 重置服务额度
echo "[$DATE] 重置发信服务额度..." >> $LOG_FILE
RESET_SERVICES=$(docker exec edm-postgres-debug psql -U postgres -d amt_mail_system -t -c "SELECT reset_service_quotas();" 2>&1)

if [ $? -eq 0 ]; then
    echo "[$DATE] ✅ 发信服务额度重置成功: $RESET_SERVICES" >> $LOG_FILE
else
    echo "[$DATE] ❌ 发信服务额度重置失败: $RESET_SERVICES" >> $LOG_FILE
fi

# 2. 重置用户每日额度（如果需要）
echo "[$DATE] 重置用户每日额度..." >> $LOG_FILE
RESET_USERS=$(docker exec edm-postgres-debug psql -U postgres -d amt_mail_system -t -c "
UPDATE users 
SET remaining_quota = daily_quota, updated_at = CURRENT_TIMESTAMP 
WHERE daily_quota > 0 AND daily_quota > remaining_quota;
SELECT ROW_COUNT();
" 2>&1)

if [ $? -eq 0 ]; then
    echo "[$DATE] ✅ 用户额度重置成功，影响用户数: $RESET_USERS" >> $LOG_FILE
else
    echo "[$DATE] ❌ 用户额度重置失败: $RESET_USERS" >> $LOG_FILE
fi

# 3. 清理过期日志（保留30天）
echo "[$DATE] 清理过期日志..." >> $LOG_FILE
CLEANUP_LOGS=$(docker exec edm-postgres-debug psql -U postgres -d amt_mail_system -t -c "
DELETE FROM user_quota_logs WHERE created_at < NOW() - INTERVAL '30 days';
DELETE FROM service_status_logs WHERE created_at < NOW() - INTERVAL '30 days';
SELECT 'Logs cleaned';
" 2>&1)

if [ $? -eq 0 ]; then
    echo "[$DATE] ✅ 过期日志清理成功: $CLEANUP_LOGS" >> $LOG_FILE
else
    echo "[$DATE] ❌ 过期日志清理失败: $CLEANUP_LOGS" >> $LOG_FILE
fi

# 4. 检查调度器状态
echo "[$DATE] 检查调度器状态..." >> $LOG_FILE
SCHEDULER_STATUS=$(docker logs edm-backend-debug 2>&1 | grep -E "(调度器|scheduler)" | tail -1)
echo "[$DATE] 调度器最新状态: $SCHEDULER_STATUS" >> $LOG_FILE

# 5. 发送状态报告（可选）
if command -v mail &> /dev/null; then
    echo "每日额度重置完成 - $(date)" | mail -s "EDM系统每日维护报告" admin@yourdomain.com
fi

echo "[$DATE] 每日额度重置任务完成" >> $LOG_FILE
echo "----------------------------------------" >> $LOG_FILE 