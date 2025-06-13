import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  message,
  Row,
  Col,
  Alert,
  Divider,
  Space,
  Tag,
  Statistic
} from 'antd';
import {
  MailOutlined,
  UserOutlined,
  SendOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Option } = Select;
const { TextArea } = Input;

interface Template {
  id: string;
  name: string;
  subject: string;
}

interface Tag {
  id: string;
  name: string;
  contact_count: number;
}

interface Sender {
  id: string;
  name: string;
  email: string;
}

interface EstimateResult {
  total_contacts: number;
  estimated_cost: number;
  estimated_duration: string;
  available_quota: number;
}

const EnhancedCampaignCreate: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [estimate, setEstimate] = useState<EstimateResult | null>(null);

  // 模拟数据加载
  useEffect(() => {
    // 这里应该调用实际的API
    setTemplates([
      { id: '1', name: '营销模板1', subject: '特惠活动通知' },
      { id: '2', name: '营销模板2', subject: '新品发布' },
      { id: '3', name: '通知模板', subject: '系统维护通知' }
    ]);
    
    setTags([
      { id: '1', name: 'VIP客户', contact_count: 1500 },
      { id: '2', name: '普通客户', contact_count: 5000 },
      { id: '3', name: '潜在客户', contact_count: 2000 },
      { id: '4', name: '已退订', contact_count: 500 }
    ]);

    setSenders([
      { id: '1', name: 'EDM系统', email: 'noreply@example.com' },
      { id: '2', name: '营销部', email: 'marketing@example.com' }
    ]);
  }, []);

  // 计算预估统计
  const calculateEstimate = async () => {
    const values = form.getFieldsValue();
    if (!values.include_tag_ids || values.include_tag_ids.length === 0) {
      setEstimate(null);
      return;
    }

    // 模拟API调用
    const includeTags = tags.filter(tag => values.include_tag_ids.includes(tag.id));
    const excludeTags = tags.filter(tag => values.exclude_tag_ids?.includes(tag.id)) || [];
    
    const totalInclude = includeTags.reduce((sum, tag) => sum + tag.contact_count, 0);
    const totalExclude = excludeTags.reduce((sum, tag) => sum + tag.contact_count, 0);
    const finalCount = Math.max(0, totalInclude - totalExclude);

    setEstimate({
      total_contacts: finalCount,
      estimated_cost: finalCount,
      estimated_duration: `约 ${Math.ceil(finalCount / 100)} 分钟`,
      available_quota: 10000 // 模拟用户剩余额度
    });
  };

  // 表单值变化时重新计算预估
  const handleFormChange = () => {
    calculateEstimate();
  };

  // 提交表单
  const handleSubmit = async (values: any) => {
    if (!estimate || estimate.total_contacts === 0) {
      message.error('请选择有效的标签组合');
      return;
    }

    if (estimate.estimated_cost > estimate.available_quota) {
      message.error('额度不足，无法创建群发任务');
      return;
    }

    setLoading(true);
    try {
      // 这里应该调用实际的API
      console.log('创建群发任务:', values);
      message.success('群发任务创建成功');
      navigate('/campaigns');
    } catch (error) {
      console.error('创建群发任务失败:', error);
      message.error('创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="enhanced-campaign-create">
      <Card title="创建群发任务（增强版）">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          onValuesChange={handleFormChange}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="任务名称"
                name="name"
                rules={[
                  { required: true, message: '请输入任务名称' },
                  { max: 100, message: '名称长度不能超过100字符' }
                ]}
              >
                <Input placeholder="请输入任务名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="发信人"
                name="sender_id"
                rules={[{ required: true, message: '请选择发信人' }]}
              >
                <Select placeholder="请选择发信人">
                  {senders.map(sender => (
                    <Option key={sender.id} value={sender.id}>
                      {sender.name} ({sender.email})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="邮件模板（支持多选）"
            name="template_ids"
            rules={[{ required: true, message: '请选择至少一个邮件模板' }]}
          >
            <Select
              mode="multiple"
              placeholder="请选择邮件模板"
              optionLabelProp="label"
            >
              {templates.map(template => (
                <Option key={template.id} value={template.id} label={template.name}>
                  <div>
                    <div>{template.name}</div>
                    <div style={{ fontSize: '12px', color: '#999' }}>
                      {template.subject}
                    </div>
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="包含标签"
                name="include_tag_ids"
                rules={[{ required: true, message: '请选择至少一个包含标签' }]}
              >
                <Select
                  mode="multiple"
                  placeholder="请选择要包含的标签"
                  optionLabelProp="label"
                >
                  {tags.map(tag => (
                    <Option key={tag.id} value={tag.id} label={tag.name}>
                      <Space>
                        <span>{tag.name}</span>
                        <Tag color="blue">{tag.contact_count}人</Tag>
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="排除标签（可选）"
                name="exclude_tag_ids"
              >
                <Select
                  mode="multiple"
                  placeholder="请选择要排除的标签"
                  optionLabelProp="label"
                >
                  {tags.map(tag => (
                    <Option key={tag.id} value={tag.id} label={tag.name}>
                      <Space>
                        <span>{tag.name}</span>
                        <Tag color="orange">{tag.contact_count}人</Tag>
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="任务描述"
            name="description"
            rules={[{ max: 500, message: '描述长度不能超过500字符' }]}
          >
            <TextArea
              rows={3}
              placeholder="请输入任务描述（可选）"
              maxLength={500}
              showCount
            />
          </Form.Item>

          {/* 预估统计 */}
          {estimate && (
            <>
              <Divider>预估统计</Divider>
              <Alert
                message="任务预估信息"
                description={
                  <Row gutter={16} style={{ marginTop: 8 }}>
                    <Col span={6}>
                      <Statistic
                        title="目标联系人"
                        value={estimate.total_contacts}
                        prefix={<UserOutlined />}
                        suffix="人"
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="预估消耗额度"
                        value={estimate.estimated_cost}
                        prefix={<MailOutlined />}
                        suffix="个"
                        valueStyle={{ 
                          color: estimate.estimated_cost > estimate.available_quota ? '#ff4d4f' : '#52c41a' 
                        }}
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="预估耗时"
                        value={estimate.estimated_duration}
                        prefix={<SendOutlined />}
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="可用额度"
                        value={estimate.available_quota}
                        suffix="个"
                        valueStyle={{ color: '#1890ff' }}
                      />
                    </Col>
                  </Row>
                }
                type={estimate.estimated_cost > estimate.available_quota ? 'error' : 'info'}
                showIcon
                style={{ marginBottom: 16 }}
              />
            </>
          )}

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                disabled={!estimate || estimate.total_contacts === 0 || estimate.estimated_cost > estimate.available_quota}
              >
                创建群发任务
              </Button>
              <Button onClick={() => navigate('/campaigns')}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default EnhancedCampaignCreate; 