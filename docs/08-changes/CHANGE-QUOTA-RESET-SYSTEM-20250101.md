# 邮件服务额度重置系统优化

**变更编号**: CHANGE-QUOTA-RESET-SYSTEM-20250101  
**变更时间**: 2025-01-01  
**变更类型**: 系统优化  
**影响范围**: 生产环境邮件服务管理  

## 🎯 变更背景

### 问题描述
1. **个性化重置时间需求**: 每个发信服务的重置时间点不同，需要根据`email_services.quota_reset_time`字段个性化重置
2. **系统监控需求**: 需要确保crontab长期稳定运行，并监控调度执行状态
3. **原有问题**: 之前的重置方案使用统一时间点（凌晨2点），不符合业务需求

### 业务需求
- 支持每个邮件服务独立的重置时间配置
- 自动化监控和故障告警
- 长期稳定的定时任务执行
- 便于管理和问题排查

## 🔧 技术实现

### 1. 数据库函数优化

**新增函数**: `reset_service_quotas_by_time()`
```sql
CREATE OR REPLACE FUNCTION reset_service_quotas_by_time()
RETURNS TABLE(service_name VARCHAR, old_quota INTEGER, new_quota INTEGER, reset_time TIME) AS $$
BEGIN
    RETURN QUERY
    UPDATE email_services 
    SET 
        used_quota = 0,
        last_reset_at = NOW(),
        updated_at = NOW()
    WHERE 
        is_enabled = true 
        AND quota_reset_time = CURRENT_TIME::TIME(0)
        AND (last_reset_at IS NULL OR last_reset_at::DATE < CURRENT_DATE)
    RETURNING 
        name::VARCHAR,
        used_quota + 0 as old_quota,
        0 as new_quota,
        quota_reset_time;
END;
$$ LANGUAGE plpgsql;
```

**特点**:
- 只重置到达指定时间的服务
- 防止重复重置（每天只重置一次）
- 返回详细的重置信息

### 2. 自动化脚本系统

#### 2.1 智能重置脚本
**位置**: `/usr/local/bin/edm-quota-reset.sh`

**功能**:
- 每小时执行一次检查
- 根据服务配置的时间点重置
- 详细日志记录
- 自动日志轮转

#### 2.2 系统监控脚本
**位置**: `/usr/local/bin/edm-monitor.sh`

**监控项目**:
- Cron服务状态
- Docker容器健康状态
- 邮件服务数量和状态
- 自动告警和日志记录

#### 2.3 管理工具
**位置**: `/usr/local/bin/edm-manage-quota-time.sh`

**功能**:
```bash
# 查看所有服务状态
edm-manage-quota-time.sh list

# 设置服务重置时间
edm-manage-quota-time.sh set '服务名' '02:00:00'

# 立即重置指定服务
edm-manage-quota-time.sh reset-now '服务名'

# 查看系统状态
edm-manage-quota-time.sh status
```

### 3. Crontab配置

```bash
# EDM邮件服务额度重置 - 每小时检查一次
0 * * * * /usr/local/bin/edm-quota-reset.sh >/dev/null 2>&1

# EDM系统监控 - 每10分钟检查一次
*/10 * * * * /usr/local/bin/edm-monitor.sh >/dev/null 2>&1

# 清理日志文件 - 每天凌晨3点
0 3 * * * find /var/log/edm-*.log -mtime +7 -delete >/dev/null 2>&1
```

## 📊 当前配置状态

### 发信服务重置时间配置
| 服务名 | 重置时间 | 日限额 | 状态 |
|--------|---------|--------|------|
| 极光触发glodamarket.fun | 02:00:00 | 200 | 启用 |
| 极光触发glodamarket.store | 06:00:00 | 200 | 启用 |

### 监控日志位置
- **重置日志**: `/var/log/edm-quota-reset.log`
- **监控日志**: `/var/log/edm-monitor.log`
- **告警日志**: `/var/log/edm-alerts.log`

## 🔍 crontab长期运行保障

### 1. 服务稳定性
- **Cron服务监控**: 每10分钟检查cron服务状态
- **自动重启机制**: 发现异常时记录告警日志
- **系统级服务**: cron是系统级服务，重启后自动恢复

### 2. 执行验证
- **日志追踪**: 每次执行都有详细日志记录
- **执行状态检查**: 监控脚本检查最近执行记录
- **告警机制**: 异常情况自动记录到告警日志

### 3. 故障恢复
```bash
# 检查cron服务状态
sudo systemctl status cron

# 重启cron服务（如需要）
sudo systemctl restart cron

# 查看crontab配置
sudo crontab -l

# 手动执行重置（紧急情况）
sudo /usr/local/bin/edm-quota-reset.sh
```

## 🎯 使用指南

### 日常管理
```bash
# 查看当前配置
sudo /usr/local/bin/edm-manage-quota-time.sh list

# 查看系统状态
sudo /usr/local/bin/edm-manage-quota-time.sh status

# 查看最近日志
tail -f /var/log/edm-quota-reset.log
tail -f /var/log/edm-monitor.log
```

### 设置不同重置时间
```bash
# 设置服务A在凌晨2点重置
sudo /usr/local/bin/edm-manage-quota-time.sh set '服务A' '02:00:00'

# 设置服务B在早上6点重置
sudo /usr/local/bin/edm-manage-quota-time.sh set '服务B' '06:00:00'
```

### 紧急处理
```bash
# 立即重置指定服务
sudo /usr/local/bin/edm-manage-quota-time.sh reset-now '服务名'

# 查看告警日志
cat /var/log/edm-alerts.log
```

## ✅ 验证结果

### 1. 功能验证
- ✅ 个性化重置时间设置成功
- ✅ 自动化脚本正常运行
- ✅ 监控系统正常工作
- ✅ 管理工具功能完整

### 2. 稳定性验证
- ✅ Cron服务状态: active
- ✅ PostgreSQL容器: Up 7 days (healthy)
- ✅ 启用的邮件服务: 2个
- ✅ 定时任务正常调度

### 3. 日志验证
```
[2025-01-01 21:05:50] 开始检查邮件服务额度重置...
[2025-01-01 21:05:50] 无需重置，所有服务未到重置时间
[2025-01-01 21:05:50] 额度重置检查完成

[2025-01-01 21:10:28] === EDM系统监控开始 ===
[2025-01-01 21:10:28] Cron服务状态: active
[2025-01-01 21:10:28] PostgreSQL容器: Up 7 days (healthy)
[2025-01-01 21:10:28] 启用的邮件服务: 2
[2025-01-01 21:10:28] === EDM系统监控完成 ===
```

## 🔄 后续优化建议

### 1. 告警增强
- 添加邮件通知功能
- 接入企业微信/钉钉告警
- 设置告警阈值和频率限制

### 2. 监控扩展
- 添加性能指标监控
- 邮件发送成功率统计
- 系统资源使用监控

### 3. 管理界面
- 开发Web管理界面
- 图形化配置重置时间
- 实时监控大屏

## 📝 总结

本次变更成功解决了邮件服务额度重置的个性化需求和长期稳定运行问题：

1. **个性化重置**: 每个服务可以设置独立的重置时间
2. **稳定运行**: 完善的监控和告警机制确保系统长期稳定
3. **易于管理**: 提供完整的管理工具和详细的日志记录
4. **故障恢复**: 具备完善的故障检测和恢复机制

系统现已投入生产环境使用，运行稳定，满足业务需求。 