-- =====================================================
-- EDM监控系统数据库表结构
-- 创建时间: 2025-07-02
-- 版本: V1.0
-- 描述: 为EDM系统架构优化创建监控相关表
-- =====================================================

-- 1. 任务处理监控表
CREATE TABLE IF NOT EXISTS task_processing_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL,
    user_id UUID NOT NULL,
    metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN ('created', 'first_sent', 'progress', 'completed', 'failed')),
    timestamp TIMESTAMP DEFAULT NOW(),
    subtasks_sent INTEGER DEFAULT 0,
    total_subtasks INTEGER DEFAULT 0,
    wait_time_seconds INTEGER DEFAULT 0,
    throughput_per_hour DECIMAL(10,2) DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- 外键约束
    CONSTRAINT fk_task_metrics_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    CONSTRAINT fk_task_metrics_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- 检查约束
    CONSTRAINT chk_subtasks_positive CHECK (subtasks_sent >= 0 AND total_subtasks >= 0),
    CONSTRAINT chk_wait_time_positive CHECK (wait_time_seconds >= 0),
    CONSTRAINT chk_throughput_positive CHECK (throughput_per_hour >= 0)
);

-- 任务处理监控表索引
CREATE INDEX IF NOT EXISTS idx_task_metrics_task_time ON task_processing_metrics(task_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_task_metrics_user_time ON task_processing_metrics(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_task_metrics_type_time ON task_processing_metrics(metric_type, timestamp);
CREATE INDEX IF NOT EXISTS idx_task_metrics_timestamp ON task_processing_metrics(timestamp);

-- 2. 系统性能监控表 (分区表)
CREATE TABLE IF NOT EXISTS system_performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(12,4) NOT NULL,
    metric_unit VARCHAR(20) DEFAULT '',
    tags JSONB DEFAULT '{}',
    timestamp TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- 检查约束
    CONSTRAINT chk_metric_name_not_empty CHECK (LENGTH(metric_name) > 0)
) PARTITION BY RANGE (timestamp);

-- 创建当前月份分区
CREATE TABLE IF NOT EXISTS system_performance_metrics_y2025m07 
PARTITION OF system_performance_metrics
FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');

-- 系统性能监控表索引
CREATE INDEX IF NOT EXISTS idx_perf_metrics_name_time ON system_performance_metrics(metric_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_perf_metrics_tags ON system_performance_metrics USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_perf_metrics_timestamp ON system_performance_metrics(timestamp);

-- 3. 告警规则表
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    metric_name VARCHAR(100) NOT NULL,
    condition_type VARCHAR(20) NOT NULL DEFAULT 'threshold' CHECK (condition_type IN ('threshold', 'rate', 'absence')),
    threshold_value DECIMAL(12,4),
    comparison_operator VARCHAR(10) NOT NULL CHECK (comparison_operator IN ('>', '<', '>=', '<=', '=', '!=')),
    time_window_minutes INTEGER DEFAULT 5 CHECK (time_window_minutes > 0),
    severity VARCHAR(20) DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
    notification_channels JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- 检查约束
    CONSTRAINT chk_alert_name_not_empty CHECK (LENGTH(name) > 0),
    CONSTRAINT chk_metric_name_not_empty CHECK (LENGTH(metric_name) > 0)
);

-- 告警规则表索引
CREATE INDEX IF NOT EXISTS idx_alert_rules_active ON alert_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_alert_rules_metric ON alert_rules(metric_name);

-- 4. 告警历史表
CREATE TABLE IF NOT EXISTS alert_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL,
    triggered_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'suppressed')),
    trigger_value DECIMAL(12,4),
    message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- 外键约束
    CONSTRAINT fk_alert_history_rule FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE,
    
    -- 检查约束
    CONSTRAINT chk_resolved_after_triggered CHECK (resolved_at IS NULL OR resolved_at >= triggered_at)
);

-- 告警历史表索引
CREATE INDEX IF NOT EXISTS idx_alert_history_rule ON alert_history(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_status ON alert_history(status);
CREATE INDEX IF NOT EXISTS idx_alert_history_triggered ON alert_history(triggered_at);

-- 5. 服务预留表 (用于并发控制)
CREATE TABLE IF NOT EXISTS service_reservations (
    service_id UUID PRIMARY KEY,
    reserved_by VARCHAR(255) NOT NULL,
    subtask_id UUID NOT NULL,
    reserved_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 seconds',
    
    -- 外键约束
    CONSTRAINT fk_service_reservations_service FOREIGN KEY (service_id) REFERENCES email_services(id) ON DELETE CASCADE,
    CONSTRAINT fk_service_reservations_subtask FOREIGN KEY (subtask_id) REFERENCES sub_tasks(id) ON DELETE CASCADE,
    
    -- 检查约束
    CONSTRAINT chk_expires_after_reserved CHECK (expires_at > reserved_at)
);

-- 服务预留表索引
CREATE INDEX IF NOT EXISTS idx_service_reservations_expires ON service_reservations(expires_at);
CREATE INDEX IF NOT EXISTS idx_service_reservations_reserved_by ON service_reservations(reserved_by);

-- =====================================================
-- 初始化数据
-- =====================================================

-- 插入默认告警规则
INSERT INTO alert_rules (name, description, metric_name, condition_type, threshold_value, comparison_operator, time_window_minutes, severity, notification_channels) VALUES
('任务卡顿告警', '检测10分钟无进展的任务', 'task_stuck_duration', 'threshold', 600, '>=', 10, 'warning', '[{"type": "email", "config": {"recipients": ["admin@example.com"]}}]'),
('高错误率告警', '系统错误率超过5%', 'api_error_rate', 'threshold', 5, '>', 5, 'critical', '[{"type": "email", "config": {"recipients": ["admin@example.com"]}}]'),
('低吞吐量告警', '队列处理吞吐量过低', 'queue_throughput', 'threshold', 100, '<', 15, 'warning', '[{"type": "email", "config": {"recipients": ["admin@example.com"]}}]'),
('服务不可用告警', '可用邮件服务过少', 'available_services_count', 'threshold', 5, '<', 5, 'critical', '[{"type": "email", "config": {"recipients": ["admin@example.com"]}}]'),
('内存使用率告警', '系统内存使用率过高', 'system_memory_usage_percent', 'threshold', 85, '>', 5, 'warning', '[{"type": "email", "config": {"recipients": ["admin@example.com"]}}]'),
('数据库连接池告警', '数据库连接池使用率过高', 'db_connection_pool_usage_percent', 'threshold', 90, '>', 5, 'critical', '[{"type": "email", "config": {"recipients": ["admin@example.com"]}}]')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 清理函数
-- =====================================================

-- 自动清理过期的服务预留
CREATE OR REPLACE FUNCTION cleanup_expired_reservations()
RETURNS void AS $$
BEGIN
    DELETE FROM service_reservations WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 清理旧的监控数据 (保留30天)
CREATE OR REPLACE FUNCTION cleanup_old_monitoring_data()
RETURNS void AS $$
BEGIN
    -- 清理旧的任务监控数据
    DELETE FROM task_processing_metrics 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- 清理旧的系统性能监控数据
    DELETE FROM system_performance_metrics 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- 清理旧的告警历史 (保留90天)
    DELETE FROM alert_history 
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 分区管理函数
-- =====================================================

-- 自动创建下个月的分区
CREATE OR REPLACE FUNCTION create_next_month_partition()
RETURNS void AS $$
DECLARE
    start_date date;
    end_date date;
    partition_name text;
BEGIN
    start_date := date_trunc('month', CURRENT_DATE + interval '1 month');
    end_date := start_date + interval '1 month';
    partition_name := 'system_performance_metrics_y' || extract(year from start_date) || 'm' || lpad(extract(month from start_date)::text, 2, '0');
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF system_performance_metrics FOR VALUES FROM (%L) TO (%L)', 
        partition_name, start_date, end_date);
    
    -- 创建索引
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_name_time ON %I(metric_name, timestamp)', 
        partition_name, partition_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tags ON %I USING GIN(tags)', 
        partition_name, partition_name);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 权限设置
-- =====================================================

-- 为应用用户授权 (假设应用用户名为 edm_app)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON task_processing_metrics TO edm_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON system_performance_metrics TO edm_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON alert_rules TO edm_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON alert_history TO edm_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON service_reservations TO edm_app;

-- =====================================================
-- 注释说明
-- =====================================================

COMMENT ON TABLE task_processing_metrics IS '任务处理监控表，记录任务执行过程中的关键指标';
COMMENT ON TABLE system_performance_metrics IS '系统性能监控表，记录系统各项性能指标';
COMMENT ON TABLE alert_rules IS '告警规则配置表，定义各种告警条件';
COMMENT ON TABLE alert_history IS '告警历史记录表，记录所有告警事件';
COMMENT ON TABLE service_reservations IS '服务预留表，用于防止并发竞争';

COMMENT ON COLUMN task_processing_metrics.metric_type IS '指标类型：created(创建), first_sent(首发), progress(进度), completed(完成), failed(失败)';
COMMENT ON COLUMN task_processing_metrics.wait_time_seconds IS '等待时长（秒）';
COMMENT ON COLUMN task_processing_metrics.throughput_per_hour IS '每小时处理量';

COMMENT ON COLUMN system_performance_metrics.metric_name IS '指标名称，如：queue_throughput, api_response_time等';
COMMENT ON COLUMN system_performance_metrics.metric_unit IS '指标单位，如：ms, count, percent, bytes等';
COMMENT ON COLUMN system_performance_metrics.tags IS 'JSON格式的标签，用于分组和筛选';

COMMENT ON COLUMN alert_rules.condition_type IS '条件类型：threshold(阈值), rate(变化率), absence(缺失)';
COMMENT ON COLUMN alert_rules.comparison_operator IS '比较操作符：>, <, >=, <=, =, !=';
COMMENT ON COLUMN alert_rules.time_window_minutes IS '时间窗口（分钟）';
COMMENT ON COLUMN alert_rules.notification_channels IS 'JSON格式的通知渠道配置';

-- =====================================================
-- 完成标记
-- =====================================================

-- 记录脚本执行
INSERT INTO system_performance_metrics (metric_name, metric_value, metric_unit, tags) 
VALUES ('monitoring_tables_created', 1, 'count', '{"script": "20_create_monitoring_tables.sql", "version": "1.0"}')
ON CONFLICT DO NOTHING; 