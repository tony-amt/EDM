import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  LinkOutlined,
  MailOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  TeamOutlined
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  message,
  Modal,
  Popconfirm,
  Row,
  Space,
  Spin,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography
} from 'antd';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API_URL } from '../../config/constants';
import axios from '../../utils/axios';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

// 定义任务状态类型和对应的展示样式
const taskStatusMap: Record<string, { color: string; text: string }> = {
  'draft': { color: 'default', text: '草稿' },
  'scheduled': { color: 'processing', text: '计划中' },
  'sending': { color: 'blue', text: '发送中' },
  'paused': { color: 'orange', text: '暂停中' },
  'completed': { color: 'success', text: '发送完成' },
  'failed': { color: 'error', text: '失败' },
  'cancelled': { color: 'default', text: '已取消' },
  'closed': { color: 'volcano', text: '已关闭' }
};

// 定义收件人类型
const recipientTypeMap: Record<string, string> = {
  'TAG_BASED': '基于标签',
  'tag_based': '基于标签',
  'ALL_CONTACTS': '所有联系人',
  'all_contacts': '所有联系人',
  'MANUAL_LIST': '手动选择',
  'specific': '手动选择'
};

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
  type: string;
  schedule_time: string;
  campaign_id: string;
  campaign_name: string;
  templates?: Array<{
    id: string;
    name: string;
    subject: string;
    weight: number;
  }>;
  recipient_rule: {
    type: string;
    include_tags?: string[];
    exclude_tags?: string[];
    contact_ids?: string[];
  };
  tags?: Tag[];
  created_at: string;
  updated_at: string;
}

interface TaskStats {
  total_contacts: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
}

// 🔧 新增：子任务接口定义
interface SubTask {
  id: string;
  task_id: string;
  contact_id: string;
  contact_name: string;
  contact_email: string;
  contact_username?: string;
  contact_first_name?: string;
  contact_last_name?: string;
  contact_company?: string;
  contact_phone?: string;
  contact_position?: string;
  template_id: string;
  template_name: string;
  sender_id: string;
  sender_name: string;
  sender_email?: string;
  status: string;
  scheduled_at: string;
  sent_at?: string;
  delivered_at?: string;
  opened_at?: string;
  clicked_at?: string;
  bounced_at?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

const TaskDetail: React.FC = () => {
  const [task, setTask] = useState<Task | null>(null);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [subTasks, setSubTasks] = useState<SubTask[]>([]); // 🔧 新增：子任务状态
  const [loading, setLoading] = useState<boolean>(true);
  const [statsLoading, setStatsLoading] = useState<boolean>(true);
  const [subTasksLoading, setSubTasksLoading] = useState<boolean>(false); // 🔧 新增：子任务加载状态
  const [statusLoading, setStatusLoading] = useState<boolean>(false);
  const [templateContentVisible, setTemplateContentVisible] = useState<boolean>(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [templateContent, setTemplateContent] = useState<any>(null);
  const [templateLoading, setTemplateLoading] = useState<boolean>(false);
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // 获取数据
  useEffect(() => {
    fetchTask();
    fetchStats();
    fetchSubTasks(); // 🔧 新增：获取子任务
  }, [id]);

  // 获取任务详情
  const fetchTask = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/tasks/${id}`);
      // 🔧 修复：正确解析API响应数据
      const taskData = response.data.data || response.data;

      setTask(taskData);
    } catch (error) {
      console.error('获取任务详情失败', error);
      message.error('获取任务详情失败');
      navigate('/tasks');
    } finally {
      setLoading(false);
    }
  };

  // 获取任务统计
  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/tasks/${id}/stats`);
      // 🔧 修复：正确解析API响应数据
      const statsData = response.data.data || response.data;
      setStats(statsData);
    } catch (error) {
      console.error('获取任务统计失败', error);
      message.error('获取任务统计失败');
    } finally {
      setStatsLoading(false);
    }
  };

  // 🔧 新增：获取子任务列表
  const fetchSubTasks = async () => {
    setSubTasksLoading(true);
    try {
      const response = await axios.get(`${API_URL}/tasks/${id}/subtasks`);
      const subTasksData = response.data.data?.items || [];

      // 🔧 修复：映射后端数据结构到前端期望的格式
      const mappedSubTasks = subTasksData.map((subTask: any) => ({
        ...subTask,
        contact_name: subTask.contact?.name || subTask.contact?.username || subTask.contact_name || '-',
        contact_email: subTask.contact?.email || subTask.recipient_email || subTask.contact_email || '-',
        // 🚀 新增：映射扩展联系人字段
        contact_username: subTask.contact?.username || '-',
        contact_first_name: subTask.contact?.first_name || '-',
        contact_last_name: subTask.contact?.last_name || '-',
        contact_company: subTask.contact?.company || '-',
        contact_phone: subTask.contact?.phone || '-',
        contact_position: subTask.contact?.position || '-',
        template_name: subTask.template?.name || subTask.template_name || '-',
        sender_name: subTask.sender?.name || subTask.sender_name || '-',
        sender_email: subTask.sender?.email || subTask.sender_email || '-'
      }));


      setSubTasks(mappedSubTasks);
    } catch (error) {
      console.error('获取子任务列表失败', error);
      message.error('获取子任务列表失败');
    } finally {
      setSubTasksLoading(false);
    }
  };

  // 更新任务状态
  const updateStatus = async (status: string) => {
    setStatusLoading(true);
    try {
      const response = await axios.patch(`${API_URL}/tasks/${id}/status`, { status });
      setTask(response.data);
      message.success(`任务状态已更新为${taskStatusMap[status].text}`);
    } catch (error) {
      console.error('更新任务状态失败', error);
      message.error('更新任务状态失败');
    } finally {
      setStatusLoading(false);
    }
  };

  // 删除任务
  const handleDelete = async () => {
    try {
      await axios.delete(`${API_URL}/tasks/${id}`);
      message.success('删除任务成功');
      if (task) {
        navigate('/tasks');
      }
    } catch (error) {
      console.error('删除任务失败', error);
      message.error('删除任务失败');
    }
  };

  // 编辑任务
  const handleEdit = () => {
    navigate(`/tasks/edit/${id}`);
  };

  // 返回列表
  const handleBack = () => {
    navigate('/tasks');
  };

  // 渲染状态标签
  const renderStatus = (status: string) => {
    const { color, text } = taskStatusMap[status] || { color: 'default', text: status };
    return <Tag color={color}>{text}</Tag>;
  };

  // 渲染状态操作按钮
  const renderStatusActions = () => {
    if (!task) return null;

    switch (task.status) {
      case 'draft':
        return (
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => updateStatus('scheduled')}
            loading={statusLoading}
          >
            调度
          </Button>
        );
      case 'scheduled':
        return (
          <Button
            type="primary"
            danger
            icon={<CloseCircleOutlined />}
            onClick={() => updateStatus('cancelled')}
            loading={statusLoading}
          >
            取消
          </Button>
        );
      case 'sending':
        return (
          <Button
            type="primary"
            icon={<PauseCircleOutlined />}
            onClick={() => updateStatus('paused')}
            loading={statusLoading}
          >
            暂停
          </Button>
        );
      case 'paused':
        return (
          <Space>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={() => updateStatus('sending')}
              loading={statusLoading}
            >
              恢复
            </Button>
            <Button
              type="primary"
              danger
              icon={<CheckCircleOutlined />}
              onClick={() => updateStatus('completed')}
              loading={statusLoading}
            >
              完成
            </Button>
          </Space>
        );
      default:
        return null;
    }
  };

  // 🔧 优化：渲染子任务状态 - 支持更多状态类型
  const renderSubTaskStatus = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      'pending': { color: 'default', text: '待发送' },
      'allocated': { color: 'processing', text: '已分配' },
      'sending': { color: 'processing', text: '发送中' },
      'sent': { color: 'success', text: '已发送' },
      'delivered': { color: 'success', text: '已送达' },
      'opened': { color: 'cyan', text: '已打开' },
      'clicked': { color: 'blue', text: '已点击' },
      'bounced': { color: 'orange', text: '退信' },
      'unsubscribed': { color: 'purple', text: '退订' },
      'complained': { color: 'red', text: '投诉' },
      'failed': { color: 'error', text: '发送失败' }
    };

    const { color, text } = statusMap[status] || { color: 'default', text: status };
    return <Tag color={color}>{text}</Tag>;
  };

  // 🔧 新增：渲染用户行为
  const renderUserBehavior = (record: SubTask) => {
    const behaviors = [];

    if (record.opened_at) {
      behaviors.push(
        <Tag key="opened" color="cyan" style={{ margin: '2px' }}>
          📖 已打开
        </Tag>
      );
    }

    if (record.clicked_at) {
      behaviors.push(
        <Tag key="clicked" color="blue" style={{ margin: '2px' }}>
          🖱️ 已点击
        </Tag>
      );
    }

    if (behaviors.length === 0) {
      return <Text type="secondary">-</Text>;
    }

    return <div style={{ display: 'flex', flexWrap: 'wrap' }}>{behaviors}</div>;
  };

  // 🔧 优化：子任务表格列定义 - 增加用户行为列
  const subTaskColumns = [
    {
      title: '收件人',
      dataIndex: 'contact_name',
      key: 'contact_name',
      width: 220,
      render: (text: string, record: SubTask) => (
        <div style={{ minWidth: '200px' }}>
          <div style={{ fontWeight: 500 }}>
            {record.contact_first_name && record.contact_first_name !== '-'
              ? `${record.contact_first_name} ${record.contact_last_name && record.contact_last_name !== '-' ? record.contact_last_name : ''}`.trim()
              : (record.contact_username && record.contact_username !== '-' ? record.contact_username : text)
            }
          </div>
          <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
            📧 {record.contact_email}
          </Text>
          {record.contact_company && record.contact_company !== '-' && (
            <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>
              🏢 {record.contact_company}
            </Text>
          )}
          {record.contact_position && record.contact_position !== '-' && (
            <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>
              💼 {record.contact_position}
            </Text>
          )}
        </div>
      )
    },
    {
      title: '模板',
      dataIndex: 'template_name',
      key: 'template_name',
      width: 120,
      render: (text: string, record: SubTask) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text || '-'}</div>
          {record.template_id && (
            <Button
              type="link"
              size="small"
              style={{ padding: 0, fontSize: '11px' }}
              onClick={() => viewTemplateContent(record.template_id, text)}
            >
              查看内容
            </Button>
          )}
        </div>
      )
    },
    {
      title: '发信人',
      dataIndex: 'sender_name',
      key: 'sender_name',
      width: 160,
      render: (text: string, record: SubTask) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text || '-'}</div>
          {record.sender_email && record.sender_email !== '-' && (
            <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
              📧 {record.sender_email}
            </Text>
          )}
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => renderSubTaskStatus(status)
    },
    {
      title: '用户行为',
      key: 'user_behavior',
      width: 120,
      render: (record: SubTask) => renderUserBehavior(record)
    },
    {
      title: '发送时间',
      dataIndex: 'sent_at',
      key: 'sent_at',
      width: 140,
      render: (text: string) => renderDateTime(text)
    },
    {
      title: '错误信息',
      dataIndex: 'error_message',
      key: 'error_message',
      width: 200,
      render: (text: string) => text ? (
        <Tooltip title={text}>
          <Text type="danger" style={{ fontSize: '12px' }} ellipsis>
            {text.length > 20 ? `${text.substring(0, 20)}...` : text}
          </Text>
        </Tooltip>
      ) : '-'
    }
  ];

  // 🔧 新增：安全的时间渲染函数
  const renderDateTime = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleString('zh-CN');
  };

  // 🔧 新增：安全的任务类型渲染函数
  const renderTaskType = (type?: string) => {
    if (!type) return '单次发送';
    return type === 'one_time' ? '单次发送' : '序列发送';
  };

  // 添加查看模板内容的方法
  const viewTemplateContent = async (templateId: string, templateName: string) => {
    try {
      setTemplateLoading(true);
      setSelectedTemplateId(templateId);
      setTemplateContentVisible(true);

      const response = await axios.get(`${API_URL}/templates/${templateId}`);
      if (response.data.success) {
        setTemplateContent(response.data.data);
      }
    } catch (error) {
      console.error('获取模板内容失败:', error);
      message.error('获取模板内容失败');
    } finally {
      setTemplateLoading(false);
    }
  };

  // 渲染模板内容tab
  const renderTemplatesTab = () => {
    if (!task?.templates || task.templates.length === 0) {
      return (
        <Card>
          <Typography.Text type="secondary">暂无关联模板</Typography.Text>
        </Card>
      );
    }

    // 限制最多显示10个模板
    const displayTemplates = task.templates.slice(0, 10);
    const hasMoreTemplates = task.templates.length > 10;

    return (
      <Card
        title={
          <Space>
            <span>邮件模板内容</span>
            <Tag color="blue">{task.templates.length} 个模板</Tag>
            {hasMoreTemplates && (
              <Tag color="orange">显示前10个</Tag>
            )}
          </Space>
        }
      >
        <Tabs
          defaultActiveKey={displayTemplates[0]?.id}
          type="card"
          size="small"
          tabPosition="top"
          style={{ maxHeight: '600px', overflow: 'auto' }}
          items={displayTemplates.map((template, index) => ({
            key: template.id,
            label: (
              <Tooltip title={`${template.subject} (权重: ${template.weight || 1})`}>
                <Space size="small">
                  <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {template.name}
                  </span>
                  {task.templates!.length > 1 && (
                    <Tag color="geekblue">
                      {template.weight || 1}
                    </Tag>
                  )}
                </Space>
              </Tooltip>
            ),
            children: (
              <div style={{ padding: '16px 0' }}>
                <Row gutter={[16, 16]}>
                  <Col span={24}>
                    <Card size="small" title="邮件主题">
                      <Typography.Text copyable>{template.subject}</Typography.Text>
                    </Card>
                  </Col>
                  <Col span={24}>
                    <Card
                      size="small"
                      title="邮件内容预览"
                      extra={
                        <Button
                          type="link"
                          size="small"
                          onClick={() => viewTemplateContent(template.id, template.name)}
                        >
                          查看完整内容
                        </Button>
                      }
                    >
                      <div
                        style={{
                          maxHeight: '300px',
                          overflow: 'auto',
                          border: '1px solid #f0f0f0',
                          padding: '12px',
                          borderRadius: '4px',
                          backgroundColor: '#fafafa'
                        }}
                        dangerouslySetInnerHTML={{
                          __html: (template as any).body?.substring(0, 500) + ((template as any).body?.length > 500 ? '...' : '') || '暂无内容'
                        }}
                      />
                    </Card>
                  </Col>
                  {template.weight && task.templates!.length > 1 && (
                    <Col span={24}>
                      <Card size="small" title="模板权重说明">
                        <Typography.Text type="secondary">
                          权重: {template.weight} - 在随机选择模板时，权重越高被选中的概率越大
                        </Typography.Text>
                      </Card>
                    </Col>
                  )}
                </Row>
              </div>
            )
          }))}
        />

        {hasMoreTemplates && (
          <Divider>
            <Typography.Text type="secondary">
              还有 {task.templates.length - 10} 个模板未显示，可在模板管理页面查看全部
            </Typography.Text>
          </Divider>
        )}
      </Card>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Title level={4}>任务详情</Title>
        <Space>
          <Button
            type="default"
            icon={<ArrowLeftOutlined />}
            onClick={handleBack}
          >
            返回
          </Button>
          {renderStatusActions()}
          {task && task.status === 'draft' && (
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={handleEdit}
            >
              编辑
            </Button>
          )}
          {task && ['draft', 'scheduled', 'paused', 'cancelled'].includes(task.status) && (
            <Popconfirm
              title="确定要删除这个任务吗？"
              onConfirm={handleDelete}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="primary"
                danger
                icon={<DeleteOutlined />}
              >
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      {task && (
        <Tabs defaultActiveKey="info">
          <TabPane tab="基本信息" key="info">
            <Card>
              <Descriptions bordered column={2}>
                <Descriptions.Item label="任务名称" span={2}>{task.name}</Descriptions.Item>
                <Descriptions.Item label="任务描述" span={2}>{task.description || '-'}</Descriptions.Item>
                <Descriptions.Item label="任务状态">{renderStatus(task.status)}</Descriptions.Item>
                <Descriptions.Item label="所属活动">
                  <a onClick={() => navigate(`/campaigns/${task.campaign_id}`)}>
                    {task.campaign_name}
                  </a>
                </Descriptions.Item>
                <Descriptions.Item label="计划发送时间">{renderDateTime(task.schedule_time)}</Descriptions.Item>
                <Descriptions.Item label="任务类型">{renderTaskType(task.type)}</Descriptions.Item>
                <Descriptions.Item label="使用模板" span={2}>
                  {task.templates && task.templates.length > 0 ? (
                    <div>
                      {task.templates.map((template, index) => (
                        <div key={template.id} style={{ marginBottom: index < task.templates!.length - 1 ? 8 : 0 }}>
                          <Text strong>{template.name}</Text>
                          <Text type="secondary" style={{ marginLeft: 8 }}>
                            ({template.subject})
                          </Text>
                          {task.templates!.length > 1 && (
                            <Text type="secondary" style={{ marginLeft: 8 }}>
                              权重: {template.weight}
                            </Text>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Text type="secondary">-</Text>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="收件人规则" span={2}>
                  <div>
                    <Text strong>类型: </Text>
                    {recipientTypeMap[task.recipient_rule?.type] || task.recipient_rule?.type || '-'}
                  </div>

                  {task.recipient_rule?.type === 'tag_based' && ( // 🔧 修复：使用后端返回的格式
                    <div style={{ marginTop: 8 }}>
                      <div>
                        <Text strong>包含标签: </Text>
                        <Space wrap>
                          {task.tags && task.tags
                            .filter(tag => task.recipient_rule.include_tags?.includes(tag.id))
                            .map(tag => (
                              <Tag key={tag.id} color={tag.color}>{tag.name}</Tag>
                            ))}
                        </Space>
                      </div>

                      {task.recipient_rule.exclude_tags && task.recipient_rule.exclude_tags.length > 0 && (
                        <div style={{ marginTop: 4 }}>
                          <Text strong>排除标签: </Text>
                          <Space wrap>
                            {task.tags && task.tags
                              .filter(tag => task.recipient_rule.exclude_tags?.includes(tag.id))
                              .map(tag => (
                                <Tag key={tag.id} color={tag.color}>{tag.name}</Tag>
                              ))}
                          </Space>
                        </div>
                      )}
                    </div>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">{renderDateTime(task.created_at)}</Descriptions.Item>
                <Descriptions.Item label="更新时间">{renderDateTime(task.updated_at)}</Descriptions.Item>
              </Descriptions>
            </Card>
          </TabPane>

          <TabPane tab={`邮件内容 (${task.templates?.length || 0})`} key="templates">
            {renderTemplatesTab()}
          </TabPane>

          <TabPane tab="统计数据" key="stats">
            <Card>
              {statsLoading ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <Spin />
                </div>
              ) : stats ? (
                <div>
                  {/* 基础统计 */}
                  <Row gutter={[16, 16]}>
                    <Col span={4}>
                      <Statistic
                        title="目标联系人"
                        value={stats.total_contacts}
                        prefix={<TeamOutlined />}
                        valueStyle={{ color: '#1890ff' }}
                      />
                    </Col>
                    <Col span={4}>
                      <Statistic
                        title="已发送"
                        value={stats.sent}
                        prefix={<MailOutlined />}
                        valueStyle={{ color: '#52c41a' }}
                      />
                    </Col>
                    <Col span={4}>
                      <Statistic
                        title="已送达"
                        value={stats.delivered}
                        prefix={<CheckCircleOutlined />}
                        valueStyle={{ color: '#13c2c2' }}
                      />
                    </Col>
                    <Col span={4}>
                      <Statistic
                        title="已打开"
                        value={stats.opened}
                        prefix={<EyeOutlined />}
                        valueStyle={{ color: '#722ed1' }}
                      />
                    </Col>
                    <Col span={4}>
                      <Statistic
                        title="已点击"
                        value={stats.clicked}
                        prefix={<LinkOutlined />}
                        valueStyle={{ color: '#1890ff' }}
                      />
                    </Col>
                    <Col span={4}>
                      <Statistic
                        title="退信"
                        value={stats.bounced}
                        prefix={<ExclamationCircleOutlined />}
                        valueStyle={{ color: '#fa8c16' }}
                      />
                    </Col>
                  </Row>

                  <Divider />

                  {/* 转化率统计 */}
                  <Row gutter={[16, 16]}>
                    <Col span={6}>
                      <Statistic
                        title="送达率"
                        value={stats.delivery_rate || 0}
                        precision={2}
                        suffix="%"
                        valueStyle={{ color: stats.delivery_rate >= 90 ? '#52c41a' : stats.delivery_rate >= 70 ? '#fa8c16' : '#ff4d4f' }}
                      />
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        已送达 / 已发送
                      </Text>
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="打开率"
                        value={stats.open_rate || 0}
                        precision={2}
                        suffix="%"
                        valueStyle={{ color: stats.open_rate >= 20 ? '#52c41a' : stats.open_rate >= 10 ? '#fa8c16' : '#ff4d4f' }}
                      />
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        已打开 / 已送达
                      </Text>
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="点击率"
                        value={stats.click_rate || 0}
                        precision={2}
                        suffix="%"
                        valueStyle={{ color: stats.click_rate >= 5 ? '#52c41a' : stats.click_rate >= 2 ? '#fa8c16' : '#ff4d4f' }}
                      />
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        已点击 / 已打开
                      </Text>
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="退信率"
                        value={stats.bounced && stats.sent ? ((stats.bounced / stats.sent) * 100) : 0}
                        precision={2}
                        suffix="%"
                        valueStyle={{ color: '#fa8c16' }}
                      />
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        退信 / 已发送
                      </Text>
                    </Col>
                  </Row>

                  <Divider />

                  {/* 详细说明 */}
                  <Card size="small" title="统计说明" style={{ backgroundColor: '#fafafa' }}>
                    <Row gutter={[16, 8]}>
                      <Col span={12}>
                        <Text strong>📊 统计口径说明：</Text>
                        <div style={{ marginTop: 8 }}>
                          <div>• <Text strong>送达率</Text>：邮件成功投递到收件箱的比例</div>
                          <div>• <Text strong>打开率</Text>：基于已送达邮件的打开比例</div>
                          <div>• <Text strong>点击率</Text>：基于已打开邮件的点击比例</div>
                          <div>• <Text strong>退信率</Text>：邮件被退回的比例</div>
                        </div>
                      </Col>
                      <Col span={12}>
                        <Text strong>🎯 行业基准参考：</Text>
                        <div style={{ marginTop: 8 }}>
                          <div>• <Text type="success">送达率 ≥ 90%</Text> 优秀</div>
                          <div>• <Text type="success">打开率 ≥ 20%</Text> 优秀</div>
                          <div>• <Text type="success">点击率 ≥ 5%</Text> 优秀</div>
                          <div>• <Text type="warning">退信率 ≤ 5%</Text> 可接受</div>
                        </div>
                      </Col>
                    </Row>
                  </Card>
                </div>
              ) : (
                <Typography.Text type="secondary">暂无统计数据</Typography.Text>
              )}
            </Card>
          </TabPane>

          {/* 🔧 新增：子任务标签页 */}
          <TabPane tab={`子任务分配 (${subTasks.length})`} key="subtasks">
            <Card
              title="子任务列表"
              extra={
                <Button
                  type="text"
                  icon={<ReloadOutlined />}
                  onClick={fetchSubTasks}
                  loading={subTasksLoading}
                >
                  刷新
                </Button>
              }
            >
              <Table
                columns={subTaskColumns}
                dataSource={subTasks}
                rowKey="id"
                loading={subTasksLoading}
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
                }}
                scroll={{ x: 800 }}
                size="small"
              />

              {subTasks.length === 0 && !subTasksLoading && (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <Text type="secondary">
                    {task?.status === 'draft' ? '任务尚未调度，暂无子任务' : '暂无子任务数据'}
                  </Text>
                </div>
              )}
            </Card>
          </TabPane>
        </Tabs>
      )}

      {/* 添加模板内容查看Modal */}
      <Modal
        title={`模板内容 - ${templateContent?.name || '模板详情'}`}
        open={templateContentVisible}
        onCancel={() => {
          setTemplateContentVisible(false);
          setTemplateContent(null);
          setSelectedTemplateId('');
        }}
        footer={null}
        width={800}
        style={{ top: 20 }}
      >
        <Spin spinning={templateLoading}>
          {templateContent && (
            <div>
              <Card size="small" style={{ marginBottom: 16 }}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="模板名称">{templateContent.name}</Descriptions.Item>
                  <Descriptions.Item label="邮件主题">{templateContent.subject}</Descriptions.Item>
                  <Descriptions.Item label="创建时间">
                    {templateContent.created_at ? new Date(templateContent.created_at).toLocaleString('zh-CN') : '-'}
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              <Card title="邮件内容" size="small">
                <div
                  style={{
                    border: '1px solid #eee',
                    padding: '16px',
                    borderRadius: '4px',
                    minHeight: '400px',
                    maxHeight: '600px',
                    overflow: 'auto',
                    backgroundColor: '#fff'
                  }}
                  dangerouslySetInnerHTML={{ __html: templateContent.body }}
                />
              </Card>
            </div>
          )}
        </Spin>
      </Modal>
    </div>
  );
};

export default TaskDetail; 