import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  message,
  Select,
  Space
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

const CampaignCreate: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tagsLoading, setTagsLoading] = useState<boolean>(false);
  const [templatesLoading, setTemplatesLoading] = useState<boolean>(false);
  const navigate = useNavigate();

  // 获取标签和模板数据
  useEffect(() => {
    fetchTags();
    fetchTemplates();
  }, []);

  // 获取标签列表
  const fetchTags = async () => {
    setTagsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/tags`, {
        params: { limit: 100 }
      });
      setTags(response.data.data || []);
    } catch (error) {
      console.error('获取标签列表失败', error);
      message.error('获取标签列表失败');
    } finally {
      setTagsLoading(false);
    }
  };

  // 获取模板列表
  const fetchTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const response = await axios.get(`${API_URL}/templates`, {
        params: { limit: 100 }
      });
      setTemplates(response.data.data || []);
    } catch (error) {
      console.error('获取模板列表失败', error);
      message.error('获取模板列表失败');
    } finally {
      setTemplatesLoading(false);
    }
  };

  // 提交表单
  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      await axios.post(`${API_URL}/campaigns`, values);
      message.success('创建活动成功');
      navigate('/campaigns');
    } catch (error) {
      console.error('创建活动失败', error);
      message.error('创建活动失败');
    } finally {
      setLoading(false);
    }
  };

  // 返回列表
  const handleBack = () => {
    navigate('/campaigns');
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Title level={4}>创建营销活动</Title>
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
          initialValues={{
            status: 'draft'
          }}
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
              loading={tagsLoading}
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
              loading={templatesLoading}
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
              <Button onClick={() => form.resetFields()}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default CampaignCreate; 