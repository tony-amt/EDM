-- 创建群发任务模板关联表
-- 支持一个群发任务使用多个邮件模板

CREATE TABLE campaign_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    weight INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- 确保同一个群发任务中同一个模板不重复
    UNIQUE(campaign_id, template_id)
);

-- 添加索引
CREATE INDEX idx_campaign_templates_campaign_id ON campaign_templates(campaign_id);
CREATE INDEX idx_campaign_templates_template_id ON campaign_templates(template_id);
CREATE INDEX idx_campaign_templates_weight ON campaign_templates(weight);

-- 添加注释
COMMENT ON TABLE campaign_templates IS '群发任务模板关联表';
COMMENT ON COLUMN campaign_templates.id IS '关联唯一标识';
COMMENT ON COLUMN campaign_templates.campaign_id IS '群发任务ID';
COMMENT ON COLUMN campaign_templates.template_id IS '邮件模板ID';
COMMENT ON COLUMN campaign_templates.weight IS '模板权重，用于均匀分配';
COMMENT ON COLUMN campaign_templates.created_at IS '创建时间';

-- 添加约束
ALTER TABLE campaign_templates ADD CONSTRAINT chk_template_weight_positive 
CHECK (weight > 0); 