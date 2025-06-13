import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  message,
  Select,
  Space,
  Spin
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import axios from '../../utils/axios';
import { API_URL } from '../../config/constants';

const { Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Template {
  id: string;
  name: string;
  subject: string;
}

interface Campaign {
  id: string;
  name: string;
  description: string;
  status: string;
  target_tags: string[];
  template_id: string;
  created_at: string;
  updated_at: string;
}

const CampaignEdit: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchLoading, setFetchLoading] = useState<boolean>(true);
  const [tags, setTags] = useState<Tag[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // 获取数据
  useEffect(() => {
    Promise.all([
      fetchCampaign(),
      fetchTags(),
      fetchTemplates()
    ]).finally(() => {
      setFetchLoading(false);
    });
  }, [id]);

  // 获取活动详情
  const fetchCampaign = async () => {
    try {
      const response = await axios.get(`${API_URL}/campaigns/${id}`);
      setCampaign(response.data);
      
      // 设置表单初始值
      form.setFieldsValue({
        name: response.data.name,
        description: response.data.description,
        status: response.data.status,
        target_tags: response.data.target_tags,
        template_id: response.data.template_id
      });
    } catch (error) {
      console.error('获取活动详情失败', error);
      message.error('获取活动详情失败');
      navigate('/campaigns');
    }
  };

  // 获取标签列表
  const fetchTags = async () => {
    try {
      const response = await axios.get(`${API_URL}/tags`, {
        params: { limit: 100 }
      });
      setTags(response.data.items);
    } catch (error) {
      console.error('获取标签列表失败', error);
      message.error('获取标签列表失败');
    }
  };

  // 获取模板列表
  const fetchTemplates = async () => {
    try {
      const response = await axios.get(`${API_URL}/templates`, {
        params: { limit: 100 }
      });
      setTemplates(response.data.items);
    } catch (error) {
      console.error('获取模板列表失败', error);
      message.error('获取模板列表失败');
    }
  };

  // 提交表单
  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      await axios.put(`${API_URL}/campaigns/${id}`, values);
      message.success('更新活动成功');
      navigate('/campaigns');
    } catch (error) {
      console.error('更新活动失败', error);
      message.error('更新活动失败');
    } finally {
      setLoading(false);
    }
  };

  // 返回列表
  const handleBack = () => {
    navigate('/campaigns');
  };

  if (fetchLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Title level={4}>编辑营销活动</Title>
        <Button
          type="default"
          icon={<ArrowLeftOutlined />}
          onClick={handleBack}
        >
          返回列表
        </Button>
      </div>
      
      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="活动名称"
            rules={[
              { required: true, message: '请输入活动名称' },
              { max: 100, message: '活动名称不能超过100个字符' }
            ]}
          >
            <Input placeholder="请输入活动名称" />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="活动描述"
            rules={[
              { max: 500, message: '活动描述不能超过500个字符' }
            ]}
          >
            <TextArea
              placeholder="请输入活动描述"
              rows={4}
              showCount
              maxLength={500}
            />
          </Form.Item>
          
          <Form.Item
            name="status"
            label="活动状态"
            rules={[{ required: true, message: '请选择活动状态' }]}
          >
            <Select placeholder="请选择活动状态">
              <Option value="draft">草稿</Option>
              <Option value="active">活跃</Option>
              <Option value="paused">暂停</Option>
              <Option value="completed">已完成</Option>
              <Option value="cancelled">已取消</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="target_tags"
            label="目标标签"
            rules={[{ required: true, message: '请选择至少一个目标标签' }]}
          >
            <Select
              mode="multiple"
              placeholder="请选择目标标签"
              optionFilterProp="children"
            >
              {tags.map(tag => (
                <Option key={tag.id} value={tag.id}>
                  {tag.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="template_id"
            label="邮件模板"
            rules={[{ required: true, message: '请选择邮件模板' }]}
          >
            <Select
              placeholder="请选择邮件模板"
              optionFilterProp="children"
            >
              {templates.map(template => (
                <Option key={template.id} value={template.id}>
                  {template.name} - {template.subject}
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>
                保存
              </Button>
              <Button onClick={() => fetchCampaign()}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default CampaignEdit; 