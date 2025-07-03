import {
  ArrowLeftOutlined,
  SaveOutlined,
  SendOutlined,
  UserOutlined
} from '@ant-design/icons';
import {
  Button,
  Card,
  Divider,
  Form,
  Input,
  message,
  Radio,
  Select,
  Tag,
  Typography
} from 'antd';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ScheduleTimeModal from '../../components/ScheduleTimeModal';
import MultiLevelTagSelector from '../../components/tasks/MultiLevelTagSelector';
import { API_URL } from '../../config/constants';
import axios from '../../utils/axios';

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

interface Contact {
  id: string;
  name: string;
  email: string;
}

interface Sender {
  id: string;
  name?: string;
  display_name?: string;
  senderName?: string;
  createdByName?: string;
  usageCount?: number;
}

const TaskCreate: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [recipientType, setRecipientType] = useState<string>('TAG_BASED');
  const [planCount, setPlanCount] = useState<number>(0);
  const [scheduleModalVisible, setScheduleModalVisible] = useState<boolean>(false);
  const [pendingTaskData, setPendingTaskData] = useState<any>(null);
  const navigate = useNavigate();
  const { campaignId } = useParams<{ campaignId: string }>();

  // 获取数据
  useEffect(() => {
    fetchCampaigns();
    fetchTemplates();
    fetchTags();
    fetchSenders();
  }, []);

  // 当收件人规则变化时重新计算
  useEffect(() => {
    calculatePlanCount();
  }, [recipientType, form]);

  // 🔧 修复：添加对表单字段变化的监听，确保计划发送人数实时更新
  useEffect(() => {
    const subscription = form.getFieldsValue();
    if (recipientType === 'TAG_BASED' && subscription.include_tags) {
      calculatePlanCount();
    } else if (recipientType === 'MANUAL_LIST' && subscription.contact_ids) {
      calculatePlanCount();
    }
  }, [form.getFieldsValue(), recipientType]);

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
      console.error('获取模板失败', error);
      message.error('获取模板失败');
    }
  };

  // 获取标签列表
  const fetchTags = async () => {
    try {
      const response = await axios.get(`${API_URL}/tags`, {
        params: { limit: 100 }
      });
      // 按创建时间倒序排序
      const sortedTags = (response.data.data || []).sort((a: any, b: any) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA; // 倒序排序
      });
      setTags(sortedTags);
    } catch (error) {
      console.error('获取标签列表失败', error);
      message.error('获取标签列表失败');
    }
  };

  // 获取联系人列表（用于手动选择）
  const fetchContacts = async (search = '', page = 1, limit = 10) => {
    try {
      const response = await axios.get(`${API_URL}/contacts`, {
        params: {
          search,
          page,
          limit,
          include_child_tags: true // 群发任务时包含二级标签，支持A/B测试
        }
      });

      const contactList = response.data.data?.items || response.data.items || [];
      setContacts(contactList);
    } catch (error) {
      console.error('获取联系人列表失败', error);
      message.error('获取联系人列表失败');
    }
  };

  // 获取发信人列表
  const fetchSenders = async () => {
    try {
      const response = await axios.get(`${API_URL}/senders`);
      setSenders(response.data.data);
    } catch (error) {
      console.error('获取发信人列表失败', error);
      message.error('获取发信人列表失败');
    }
  };

  // 计算计划发送人数
  const calculatePlanCount = async () => {
    try {
      const values = form.getFieldsValue();

      if (recipientType === 'TAG_BASED' && values.include_tags?.length > 0) {
        const response = await axios.post(`${API_URL}/contacts/count-by-tags`, {
          include_tags: values.include_tags,
          exclude_tags: values.exclude_tags || []
        });
        setPlanCount(response.data.count || 0);
      } else if (recipientType === 'MANUAL_LIST' && values.contact_ids?.length > 0) {
        setPlanCount(values.contact_ids.length);
      } else if (recipientType === 'ALL_CONTACTS') {
        const response = await axios.get(`${API_URL}/contacts/count`);
        setPlanCount(response.data.count || 0);
      } else {
        setPlanCount(0);
      }
    } catch (error) {
      console.error('计算收件人数量失败', error);
      setPlanCount(0);
    }
  };

  // 处理收件人类型变更
  const handleRecipientTypeChange = (e: any) => {
    setRecipientType(e.target.value);
    form.setFieldsValue({
      include_tags: [],
      exclude_tags: [],
      contact_ids: []
    });
    setPlanCount(0);
  };

  // 处理标签变化 - 🔧 修复：确保在标签改变时立即更新计划发送人数
  const handleTagChange = (value?: string[]) => {
    // 立即更新表单字段值
    const currentValues = form.getFieldsValue();

    // 延迟执行计算，确保表单值已更新
    setTimeout(() => {
      calculatePlanCount();
    }, 100);
  };

  // 处理包含标签变化
  const handleIncludeTagChange = (value?: string[]) => {
    handleTagChange(value);
  };

  // 处理排除标签变化  
  const handleExcludeTagChange = (value?: string[]) => {
    handleTagChange(value);
  };

  // 处理联系人搜索
  const handleContactSearch = (value: string) => {
    if (value) {
      fetchContacts(value);
    }
  };

  // 处理联系人选择变化
  const handleContactChange = (value: string[]) => {
    setPlanCount(value.length);
  };

  // 🔧 新增：保存为草稿
  const handleSaveDraft = async () => {
    try {
      const values = await form.validateFields();
      await createTask(values, null, 'draft');
    } catch (error) {
      console.error('表单验证失败', error);
    }
  };

  // 🔧 新增：启动发送（弹出时间选择）
  const handleStartSending = async () => {
    try {
      const values = await form.validateFields();
      setPendingTaskData(values);
      setScheduleModalVisible(true);
    } catch (error) {
      console.error('表单验证失败', error);
    }
  };

  // 🔧 新增：处理时间选择确认
  const handleScheduleConfirm = async (scheduleTime: string, isImmediate: boolean) => {
    setScheduleModalVisible(false);
    if (pendingTaskData) {
      // 立即发送和定时发送都应该设置为scheduled状态，由调度器处理
      const status = 'scheduled';
      await createTask(pendingTaskData, scheduleTime, status);
      setPendingTaskData(null);
    }
  };

  // 🔧 新增：统一的任务创建方法
  const createTask = async (values: any, scheduleTime: string | null, status: 'draft' | 'scheduled' | 'sending') => {
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

      // 准备提交数据
      const postData: any = {
        name: values.name,
        description: values.description,
        sender_id: values.sender_id,
        template_ids: values.template_ids,
        recipient_rule: recipientRule,
        status: status
      };

      // 只有在调度时才设置时间
      if (scheduleTime) {
        postData.schedule_time = scheduleTime;
      }

      const response = await axios.post(`${API_URL}/tasks`, postData);

      if (response.data.success) {
        if (status === 'draft') {
          message.success('任务已保存为草稿');
        } else {
          message.success('任务创建并调度成功');
        }

        // 返回任务列表
        navigate('/tasks');
      } else {
        throw new Error(response.data.message || '创建失败');
      }
    } catch (error: any) {
      console.error('创建任务失败', error);

      // 显示详细错误信息
      let errorMessage = '创建任务失败';
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
    if (campaignId) {
      navigate(`/campaigns/${campaignId}`);
    } else {
      navigate('/tasks');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Title level={4}>创建邮件任务</Title>
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
          onFinish={handleSaveDraft}
          initialValues={{
            recipient_type: 'TAG_BASED',
            exclude_tags: []
          }}
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
            rules={[]}
            extra="营销活动功能正在优化中，可暂时跳过此字段"
          >
            <Select
              placeholder="请选择所属活动（可选）"
              disabled={!!campaignId}
              loading={campaigns.length === 0}
              allowClear
            >
              {campaigns.map(campaign => (
                <Option key={campaign.id} value={campaign.id}>{campaign.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="template_ids"
            label="选择模板"
            rules={[{ required: true, message: '请选择至少一个模板' }]}
            tooltip="选择一个或多个模板，系统将随机选择模板发送邮件"
          >
            <Select
              mode="multiple"
              placeholder="请选择模板（可多选）"
              loading={templates.length === 0}
            >
              {templates.map(template => (
                <Option key={template.id} value={template.id}>
                  <div>
                    <strong>{template.name}</strong>
                    <span style={{ color: '#999', marginLeft: 8 }}>
                      {template.subject}
                    </span>
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="sender_id"
            label="发信人"
            rules={[{ required: true, message: '请选择发信人' }]}
            tooltip="选择此任务使用的发信人身份"
          >
            <Select
              placeholder="请选择发信人"
              loading={senders.length === 0}
            >
              {senders.map(sender => (
                <Option key={sender.id} value={sender.id}>
                  <div>
                    <strong>{sender.name || sender.senderName}</strong>
                    <span style={{ color: '#999', marginLeft: 8 }}>
                      ({sender.display_name || '发信人'})
                    </span>
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Divider orientation="left">收件人设置</Divider>

          <Form.Item
            name="recipient_type"
            label="收件人类型"
            rules={[{ required: true, message: '请选择收件人类型' }]}
          >
            <Radio.Group onChange={handleRecipientTypeChange}>
              <Radio value="TAG_BASED">基于标签</Radio>
              <Radio value="MANUAL_LIST">手动选择</Radio>
            </Radio.Group>
          </Form.Item>

          {recipientType === 'TAG_BASED' && (
            <>
              <Form.Item
                name="include_tags"
                label="包含标签"
                rules={[{ required: true, message: '请选择至少一个标签' }]}
                tooltip="支持选择一级标签（包含所有子标签）或具体的二级标签"
              >
                <MultiLevelTagSelector
                  placeholder="选择要包含的标签（支持多级选择）"
                  onChange={handleIncludeTagChange}
                  maxTagCount={20}
                />
              </Form.Item>

              <Form.Item
                name="exclude_tags"
                label="排除标签"
                tooltip="选择要排除的标签，支持多级选择"
              >
                <MultiLevelTagSelector
                  placeholder="选择要排除的标签（可选）"
                  onChange={handleExcludeTagChange}
                  maxTagCount={10}
                />
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
                placeholder="搜索并选择联系人"
                showSearch
                filterOption={false}
                onSearch={handleContactSearch}
                onChange={handleContactChange}
                notFoundContent="请输入关键词搜索联系人"
              >
                {contacts.map(contact => (
                  <Option key={contact.id} value={contact.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong>{contact.name}</strong>
                      <span style={{ color: '#999' }}>{contact.email}</span>
                    </div>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {/* 🔧 计划发送人数显示 */}
          <div style={{
            background: '#f0f2f5',
            padding: 16,
            borderRadius: 6,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <UserOutlined />
            <span>计划发送人数: </span>
            <strong style={{ color: '#1890ff', fontSize: 16 }}>
              {planCount} 人
            </strong>
          </div>

          <Form.Item>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end' }}>
              <Button
                type="default"
                htmlType="submit"
                loading={loading}
                icon={<SaveOutlined />}
              >
                保存为草稿
              </Button>
              <Button
                type="primary"
                onClick={handleStartSending}
                loading={loading}
                icon={<SendOutlined />}
              >
                启动发送
              </Button>
              <Button
                type="default"
                onClick={handleBack}
              >
                取消
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Card>

      <ScheduleTimeModal
        visible={scheduleModalVisible}
        onCancel={() => setScheduleModalVisible(false)}
        onOk={handleScheduleConfirm}
      />
    </div>
  );
};

export default TaskCreate; 