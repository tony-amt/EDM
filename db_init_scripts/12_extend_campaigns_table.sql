-- 扩展campaigns表，添加发信人和状态管理字段

-- 添加发信人ID字段
ALTER TABLE campaigns ADD COLUMN sender_id UUID REFERENCES senders(id) ON DELETE SET NULL;

-- 添加排除标签字段
ALTER TABLE campaigns ADD COLUMN exclude_tag_ids UUID[];

-- 扩展状态字段，支持更多状态
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS chk_campaign_status;
ALTER TABLE campaigns ADD CONSTRAINT chk_campaign_status 
CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'cancelled', 'failed'));

-- 添加子任务统计字段
ALTER TABLE campaigns ADD COLUMN total_subtasks INTEGER DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN sent_subtasks INTEGER DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN failed_subtasks INTEGER DEFAULT 0;

-- 添加索引
CREATE INDEX idx_campaigns_sender_id ON campaigns(sender_id);
CREATE INDEX idx_campaigns_exclude_tag_ids ON campaigns USING GIN(exclude_tag_ids);
CREATE INDEX idx_campaigns_total_subtasks ON campaigns(total_subtasks);

-- 添加注释
COMMENT ON COLUMN campaigns.sender_id IS '发信人ID';
COMMENT ON COLUMN campaigns.exclude_tag_ids IS '排除的标签ID数组';
COMMENT ON COLUMN campaigns.total_subtasks IS '总子任务数';
COMMENT ON COLUMN campaigns.sent_subtasks IS '已发送子任务数';
COMMENT ON COLUMN campaigns.failed_subtasks IS '失败子任务数';

-- 添加约束
ALTER TABLE campaigns ADD CONSTRAINT chk_subtask_counts_positive 
CHECK (total_subtasks >= 0 AND sent_subtasks >= 0 AND failed_subtasks >= 0);

ALTER TABLE campaigns ADD CONSTRAINT chk_subtask_counts_valid 
CHECK (sent_subtasks + failed_subtasks <= total_subtasks); 