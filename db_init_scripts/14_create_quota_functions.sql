-- 创建原子性额度扣减函数
-- 确保用户额度扣减的原子性操作

-- 原子性用户额度扣减函数
CREATE OR REPLACE FUNCTION deduct_user_quota(
    p_user_id UUID,
    p_amount INTEGER,
    p_campaign_id UUID DEFAULT NULL,
    p_reason TEXT DEFAULT 'Email sending'
) RETURNS BOOLEAN AS $$
DECLARE
    current_quota INTEGER;
    balance_before INTEGER;
BEGIN
    -- 使用行级锁防止并发问题
    SELECT remaining_quota INTO current_quota 
    FROM users 
    WHERE id = p_user_id 
    FOR UPDATE;
    
    -- 检查用户是否存在
    IF NOT FOUND THEN
        RAISE EXCEPTION '用户不存在: %', p_user_id;
    END IF;
    
    -- 检查额度是否充足
    IF current_quota < p_amount THEN
        RETURN FALSE;
    END IF;
    
    -- 记录操作前余额
    balance_before := current_quota;
    
    -- 扣减额度
    UPDATE users 
    SET remaining_quota = remaining_quota - p_amount,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_user_id;
    
    -- 记录日志
    INSERT INTO user_quota_logs (
        user_id, operation_type, amount, 
        balance_before, balance_after, 
        campaign_id, reason
    ) VALUES (
        p_user_id, 'deduct', -p_amount,
        balance_before, balance_before - p_amount,
        p_campaign_id, p_reason
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 原子性服务额度扣减函数
CREATE OR REPLACE FUNCTION deduct_service_quota(
    p_service_id UUID,
    p_amount INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    current_quota INTEGER;
    daily_limit INTEGER;
BEGIN
    -- 使用行级锁防止并发问题
    SELECT used_quota, daily_quota INTO current_quota, daily_limit
    FROM email_services 
    WHERE id = p_service_id 
    AND is_enabled = TRUE 
    AND is_frozen = FALSE
    FOR UPDATE;
    
    -- 检查服务是否存在且可用
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- 检查额度是否充足
    IF current_quota + p_amount > daily_limit THEN
        RETURN FALSE;
    END IF;
    
    -- 扣减额度
    UPDATE email_services 
    SET used_quota = used_quota + p_amount,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_service_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 用户额度回退函数
CREATE OR REPLACE FUNCTION refund_user_quota(
    p_user_id UUID,
    p_amount INTEGER,
    p_campaign_id UUID DEFAULT NULL,
    p_reason TEXT DEFAULT 'Campaign cancelled'
) RETURNS BOOLEAN AS $$
DECLARE
    current_quota INTEGER;
    balance_before INTEGER;
BEGIN
    -- 使用行级锁
    SELECT remaining_quota INTO current_quota 
    FROM users 
    WHERE id = p_user_id 
    FOR UPDATE;
    
    -- 检查用户是否存在
    IF NOT FOUND THEN
        RAISE EXCEPTION '用户不存在: %', p_user_id;
    END IF;
    
    -- 记录操作前余额
    balance_before := current_quota;
    
    -- 回退额度
    UPDATE users 
    SET remaining_quota = remaining_quota + p_amount,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_user_id;
    
    -- 记录日志
    INSERT INTO user_quota_logs (
        user_id, operation_type, amount, 
        balance_before, balance_after, 
        campaign_id, reason
    ) VALUES (
        p_user_id, 'refund', p_amount,
        balance_before, balance_before + p_amount,
        p_campaign_id, p_reason
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 分配用户额度函数（管理员用）
CREATE OR REPLACE FUNCTION allocate_user_quota(
    p_user_id UUID,
    p_amount INTEGER,
    p_reason TEXT DEFAULT 'Admin allocation'
) RETURNS BOOLEAN AS $$
DECLARE
    current_quota INTEGER;
    balance_before INTEGER;
BEGIN
    -- 使用行级锁
    SELECT remaining_quota INTO current_quota 
    FROM users 
    WHERE id = p_user_id 
    FOR UPDATE;
    
    -- 检查用户是否存在
    IF NOT FOUND THEN
        RAISE EXCEPTION '用户不存在: %', p_user_id;
    END IF;
    
    -- 记录操作前余额
    balance_before := current_quota;
    
    -- 分配额度
    UPDATE users 
    SET remaining_quota = remaining_quota + p_amount,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_user_id;
    
    -- 记录日志
    INSERT INTO user_quota_logs (
        user_id, operation_type, amount, 
        balance_before, balance_after, 
        campaign_id, reason
    ) VALUES (
        p_user_id, 'allocate', p_amount,
        balance_before, balance_before + p_amount,
        NULL, p_reason
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql; 