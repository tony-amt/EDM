-- 创建服务额度重置触发器和服务冻结检查函数

-- 服务额度重置函数（定时任务调用）
CREATE OR REPLACE FUNCTION reset_service_quotas() RETURNS void AS $$
DECLARE
    service_record RECORD;
BEGIN
    -- 重置所有服务的已使用额度
    FOR service_record IN 
        SELECT id, name FROM email_services 
        WHERE is_enabled = TRUE
    LOOP
        UPDATE email_services 
        SET used_quota = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = service_record.id;
        
        -- 记录重置日志
        INSERT INTO service_status_logs (
            service_id, status_type, old_value, new_value, reason
        ) VALUES (
            service_record.id, 'quota_reset', 
            'daily quota reset', '0', 
            'Daily quota reset at ' || CURRENT_TIMESTAMP
        );
    END LOOP;
    
    RAISE NOTICE '服务额度重置完成，共重置 % 个服务', 
        (SELECT COUNT(*) FROM email_services WHERE is_enabled = TRUE);
END;
$$ LANGUAGE plpgsql;

-- 服务冻结检查函数
CREATE OR REPLACE FUNCTION check_and_freeze_service(
    p_service_id UUID,
    p_failure_reason TEXT DEFAULT 'API failure'
) RETURNS BOOLEAN AS $$
DECLARE
    current_failures INTEGER;
    service_name VARCHAR(100);
    freeze_threshold INTEGER := 3;  -- 连续失败3次就冻结
    freeze_duration INTERVAL := '30 minutes';  -- 冻结30分钟
BEGIN
    -- 获取当前连续失败次数
    SELECT consecutive_failures, name INTO current_failures, service_name
    FROM email_services 
    WHERE id = p_service_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- 增加失败次数
    UPDATE email_services 
    SET consecutive_failures = consecutive_failures + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_service_id;
    
    current_failures := current_failures + 1;
    
    -- 检查是否需要冻结
    IF current_failures >= freeze_threshold THEN
        UPDATE email_services 
        SET is_frozen = TRUE,
            frozen_until = CURRENT_TIMESTAMP + freeze_duration,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = p_service_id;
        
        -- 记录冻结日志
        INSERT INTO service_status_logs (
            service_id, status_type, old_value, new_value, reason
        ) VALUES (
            p_service_id, 'frozen', 'false', 'true',
            'Auto frozen due to ' || current_failures || ' consecutive failures: ' || p_failure_reason
        );
        
        RAISE WARNING '服务 % 已被自动冻结，连续失败 % 次', service_name, current_failures;
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 服务解冻检查函数（定时任务调用）
CREATE OR REPLACE FUNCTION check_and_unfreeze_services() RETURNS void AS $$
DECLARE
    unfrozen_count INTEGER := 0;
    service_record RECORD;
BEGIN
    -- 查找需要解冻的服务
    FOR service_record IN 
        SELECT id, name FROM email_services 
        WHERE is_frozen = TRUE 
        AND frozen_until IS NOT NULL 
        AND frozen_until <= CURRENT_TIMESTAMP
    LOOP
        -- 解冻服务并重置失败次数
        UPDATE email_services 
        SET is_frozen = FALSE,
            frozen_until = NULL,
            consecutive_failures = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = service_record.id;
        
        -- 记录解冻日志
        INSERT INTO service_status_logs (
            service_id, status_type, old_value, new_value, reason
        ) VALUES (
            service_record.id, 'frozen', 'true', 'false',
            'Auto unfrozen after freeze period expired'
        );
        
        unfrozen_count := unfrozen_count + 1;
    END LOOP;
    
    IF unfrozen_count > 0 THEN
        RAISE NOTICE '自动解冻了 % 个服务', unfrozen_count;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 手动解冻服务函数
CREATE OR REPLACE FUNCTION unfreeze_service(
    p_service_id UUID,
    p_operator_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    service_name VARCHAR(100);
BEGIN
    -- 检查服务是否存在且被冻结
    SELECT name INTO service_name
    FROM email_services 
    WHERE id = p_service_id AND is_frozen = TRUE;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- 手动解冻服务
    UPDATE email_services 
    SET is_frozen = FALSE,
        frozen_until = NULL,
        consecutive_failures = 0,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_service_id;
    
    -- 记录解冻日志
    INSERT INTO service_status_logs (
        service_id, status_type, old_value, new_value, 
        reason, operator_id
    ) VALUES (
        p_service_id, 'frozen', 'true', 'false',
        'Manual unfreeze by administrator', p_operator_id
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 重置服务失败计数函数
CREATE OR REPLACE FUNCTION reset_service_failures(p_service_id UUID) RETURNS void AS $$
BEGIN
    UPDATE email_services 
    SET consecutive_failures = 0,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_service_id;
    
    -- 记录重置日志
    INSERT INTO service_status_logs (
        service_id, status_type, old_value, new_value, reason
    ) VALUES (
        p_service_id, 'failure', 
        (SELECT consecutive_failures::TEXT FROM email_services WHERE id = p_service_id), 
        '0', 'Reset failure count'
    );
END;
$$ LANGUAGE plpgsql; 