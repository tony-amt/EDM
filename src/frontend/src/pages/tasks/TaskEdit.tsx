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
  DatePicker,
  Radio,
  Divider,
  Spin
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import axios from '../../utils/axios';
import { API_URL } from '../../config/constants';
import dayjs from 'dayjs';

const { Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface Campaign {
  id: string;
  name: string;
}

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Task {
  id: string;
  name: string;
  description: string;
  status: string;
  campaign_id: string;
  template_ids: string[];
  schedule_time: string;
  recipient_rule: {
    type: string;
    include_tags?: string[];
    exclude_tags?: string[];
    contact_ids?: string[];
  };
}

const TaskEdit: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchLoading, setFetchLoading] = useState<boolean>(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [task, setTask] = useState<Task | null>(null);
  const [recipientType, setRecipientType] = useState<string>('TAG_BASED');
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // 获取数据
  useEffect(() => {
    Promise.all([
      fetchTask(),
      fetchCampaigns(),
      fetchTemplates(),
      fetchTags()
    ]).finally(() => {
      setFetchLoading(false);
    });
  }, [id]);

  // 获取任务详情
  const fetchTask = async () => {
    try {
      const response = await axios.get(`${API_URL}/tasks/${id}`);
      const taskData = response.data.data || response.data;
      
      
      setTask(taskData);
      setRecipientType(taskData.recipient_rule?.type || 'TAG_BASED');
      
      // 🔧 修复：安全处理时间格式和字段映射
      const formValues = {
        name: taskData.name,
        description: taskData.description,
        campaign_id: taskData.campaign_id,
        template_ids: taskData.template_ids || [],
        schedule_time: taskData.schedule_time ? dayjs(taskData.schedule_time) : null,
        recipient_type: taskData.recipient_rule?.type || 'TAG_BASED',
        include_tags: taskData.recipient_rule?.include_tags || [],
        exclude_tags: taskData.recipient_rule?.exclude_tags || [],
        contact_ids: taskData.recipient_rule?.contact_ids || []
      };
      
      
      form.setFieldsValue(formValues);
    } catch (error) {
      console.error('获取任务详情失败', error);
      message.error('获取任务详情失败');
      navigate('/tasks');
    }
  };

  // 获取活动列表 - 暂时禁用campaigns功能
  const fetchCampaigns = async () => {
    // campaigns功能暂未实现，设置空数组
    setCampaigns([]);
  };

  // 获取模板列表
  const fetchTemplates = async () => {
    try {
      const response = await axios.get(`${API_URL}/templates`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      // 🔧 修复：模板API使用分页格式 { items: [...] }
      const templateData = response.data.items || [];
      setTemplates(templateData);
    } catch (error) {
      console.error('获取模板列表失败', error);
      message.error('获取模板列表失败');
      setTemplates([]);
    }
  };

  // 获取标签列表
  const fetchTags = async () => {
    try {
      const response = await axios.get(`${API_URL}/tags`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: { limit: 100 }
      });
      
      // 🔧 修复：标签API使用 { success: true, data: [...] } 格式
      const tagData = response.data.data || [];
      setTags(tagData);
    } catch (error) {
      console.error('获取标签列表失败', error);
      message.error('获取标签列表失败');
    }
  };

  // 处理收件人类型变更
  const handleRecipientTypeChange = (e: any) => {
    setRecipientType(e.target.value);
  };

  // 提交表单
  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      // 准备收件人规则
      const recipientRule: {
        type: string;
        include_tags?: string[];
        exclude_tags?: string[];
        contact_ids?: string[];
      } = {
        type: values.recipient_type === 'TAG_BASED' ? 'tag_based' : 
              values.recipient_type === 'MANUAL_LIST' ? 'specific' : 
              values.recipient_type.toLowerCase()
      };

      if (values.recipient_type === 'TAG_BASED') {
        recipientRule.include_tags = values.include_tags;
        recipientRule.exclude_tags = values.exclude_tags || [];
      } else if (values.recipient_type === 'MANUAL_LIST') {
        recipientRule.contact_ids = values.contact_ids;
      }

      // 🔧 修复：安全处理时间格式
      let scheduleTime: string;
      if (values.schedule_time) {
        if (typeof values.schedule_time === 'string') {
          scheduleTime = values.schedule_time;
        } else if (values.schedule_time.format) {
          // dayjs对象
          scheduleTime = values.schedule_time.format('YYYY-MM-DDTHH:mm:ss');
        } else if (values.schedule_time instanceof Date) {
          // Date对象
          scheduleTime = values.schedule_time.toISOString().slice(0, 19);
        } else {
          // 其他情况，尝试转换为字符串
          scheduleTime = new Date(values.schedule_time).toISOString().slice(0, 19);
        }
      } else {
        throw new Error('请选择计划发送时间');
      }

      // 准备提交数据
      const putData = {
        name: values.name,
        description: values.description,
        template_ids: values.template_ids,
        schedule_time: scheduleTime,
        recipient_rule: recipientRule
      };

      

      const response = await axios.put(`${API_URL}/tasks/${id}`, putData);
      
      if (response.data.success) {
        message.success('任务更新成功');
        
        if (task) {
          navigate(`/tasks/${task.id}`); // 返回任务详情页面
        } else {
          navigate('/tasks');
        }
      } else {
        throw new Error(response.data.message || '更新失败');
      }
    } catch (error: any) {
      console.error('更新任务失败', error);
      
      // 🔧 显示更详细的错误信息
      let errorMessage = '更新任务失败';
      if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 返回列表
  const handleBack = () => {
    if (task) {
      navigate(`/campaigns/${task.campaign_id}`);
    } else {
      navigate('/tasks');
    }
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
        <Title level={4}>编辑邮件任务</Title>
        <Button
          type="default"
          icon={<ArrowLeftOutlined />}
          onClick={handleBack}
        >
          返回
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
            label="任务名称"
            rules={[
              { required: true, message: '请输入任务名称' },
              { max: 100, message: '任务名称不能超过100个字符' }
            ]}
          >
            <Input placeholder="请输入任务名称" />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="任务描述"
            rules={[
              { max: 500, message: '任务描述不能超过500个字符' }
            ]}
          >
            <TextArea
              placeholder="请输入任务描述"
              rows={3}
              showCount
              maxLength={500}
            />
          </Form.Item>
          
          <Form.Item
            name="campaign_id"
            label="所属活动"
          >
            <Select disabled>
              {campaigns.map(campaign => (
                <Option key={campaign.id} value={campaign.id}>{campaign.name}</Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="template_ids"
            label="使用模板"
            rules={[{ required: true, message: '请选择至少一个模板' }]}
          >
            <Select
              mode="multiple"
              placeholder="请选择使用的模板"
              loading={templates.length === 0}
            >
              {templates.map(template => (
                <Option key={template.id} value={template.id}>{template.name}</Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="schedule_time"
            label="计划发送时间"
            rules={[{ required: true, message: '请选择计划发送时间' }]}
          >
            <DatePicker
              showTime
              format="YYYY-MM-DD HH:mm:ss"
              disabledDate={(current) => current && current < dayjs().startOf('day')}
              placeholder="选择发送时间"
              style={{ width: '100%' }}
            />
          </Form.Item>
          
          <Divider orientation="left">收件人设置</Divider>
          
          <Form.Item
            name="recipient_type"
            label="收件人类型"
            rules={[{ required: true, message: '请选择收件人类型' }]}
          >
            <Radio.Group onChange={handleRecipientTypeChange}>
              <Radio value="TAG_BASED">基于标签</Radio>
              <Radio value="ALL_CONTACTS">所有联系人</Radio>
              <Radio value="MANUAL_LIST">手动选择</Radio>
            </Radio.Group>
          </Form.Item>
          
          {recipientType === 'TAG_BASED' && (
            <>
              <Form.Item
                name="include_tags"
                label="包含标签"
                rules={[{ required: true, message: '请选择至少一个包含标签' }]}
              >
                <Select
                  mode="multiple"
                  placeholder="请选择包含的标签"
                  loading={tags.length === 0}
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
                name="exclude_tags"
                label="排除标签"
              >
                <Select
                  mode="multiple"
                  placeholder="请选择排除的标签"
                  loading={tags.length === 0}
                  optionFilterProp="children"
                >
                  {tags.map(tag => (
                    <Option key={tag.id} value={tag.id}>
                      {tag.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </>
          )}
          
          {recipientType === 'MANUAL_LIST' && (
            <Form.Item
              name="contact_ids"
              label="选择联系人"
              rules={[{ required: true, message: '请选择至少一个联系人' }]}
            >
              <Select
                mode="multiple"
                placeholder="请选择联系人"
                optionFilterProp="children"
                style={{ width: '100%' }}
              >
                {/* 这里应该有联系人列表，但获取全部联系人可能会太多，需要使用搜索功能 */}
                {/* 此处简化处理，实际应该使用专门的联系人选择组件 */}
                <Option value="contact1">联系人1</Option>
                <Option value="contact2">联系人2</Option>
              </Select>
            </Form.Item>
          )}
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>
                保存
              </Button>
              <Button onClick={() => fetchTask()}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default TaskEdit; 