import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Typography,
  Card,
  Button,
  Space,
  Descriptions,
  Tag,
  Spin,
  message,
  Tabs,
  Statistic,
  Row,
  Col,
  Popconfirm,
  Divider,
  List,
  Table
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  MailOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  TeamOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import axios from '../../utils/axios';
import { API_URL } from '../../config/constants';

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
  template_id: string;
  template_name: string;
  sender_id: string;
  sender_name: string;
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
      console.log('🔧 [DEBUG] 任务详情数据:', taskData); // 调试日志
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
        contact_name: subTask.contact?.name || subTask.contact_name || '-',
        contact_email: subTask.contact?.email || subTask.recipient_email || subTask.contact_email || '-',
        template_name: subTask.template?.name || subTask.template_name || '-',
        sender_name: subTask.sender?.name || subTask.sender_name || '-'
      }));
      
      console.log('🔧 [DEBUG] 子任务数据:', mappedSubTasks); // 调试日志
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

  // 🔧 新增：渲染子任务状态
  const renderSubTaskStatus = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      'pending': { color: 'default', text: '待发送' },
      'sending': { color: 'processing', text: '发送中' },
      'sent': { color: 'success', text: '发送成功' },
      'failed': { color: 'error', text: '发送失败' }
    };
    
    const { color, text } = statusMap[status] || { color: 'default', text: status };
    return <Tag color={color}>{text}</Tag>;
  };

  // 🔧 新增：子任务表格列定义
  const subTaskColumns = [
    {
      title: '收件人',
      dataIndex: 'contact_name',
      key: 'contact_name',
      render: (text: string, record: SubTask) => (
        <div>
          <div>{text}</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>{record.contact_email}</Text>
        </div>
      )
    },
    {
      title: '模板',
      dataIndex: 'template_name',
      key: 'template_name'
    },
    {
      title: '发信人',
      dataIndex: 'sender_name',
      key: 'sender_name'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => renderSubTaskStatus(status)
    },
    {
      title: '计划时间',
      dataIndex: 'scheduled_at',
      key: 'scheduled_at',
      render: (text: string) => renderDateTime(text)
    },
    {
      title: '发送时间',
      dataIndex: 'sent_at',
      key: 'sent_at',
      render: (text: string) => renderDateTime(text)
    },
    {
      title: '错误信息',
      dataIndex: 'error_message',
      key: 'error_message',
      render: (text: string) => text ? (
        <Text type="danger" style={{ fontSize: '12px' }}>{text}</Text>
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
          
          <TabPane tab="统计数据" key="stats">
            <Card>
              {statsLoading ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <Spin />
                </div>
              ) : stats ? (
                <div>
                  <Row gutter={[16, 16]}>
                    <Col span={6}>
                      <Statistic title="目标联系人" value={stats.total_contacts} prefix={<TeamOutlined />} />
                    </Col>
                    <Col span={6}>
                      <Statistic title="已发送" value={stats.sent} prefix={<MailOutlined />} />
                    </Col>
                    <Col span={6}>
                      <Statistic title="已送达" value={stats.delivered} prefix={<CheckCircleOutlined />} />
                    </Col>
                    <Col span={6}>
                      <Statistic title="已打开" value={stats.opened} />
                    </Col>
                  </Row>
                  
                  <Divider />
                  
                  <Row gutter={[16, 16]}>
                    <Col span={6}>
                      <Statistic
                        title="送达率"
                        value={stats.delivery_rate}
                        precision={2}
                        suffix="%"
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="打开率"
                        value={stats.open_rate}
                        precision={2}
                        suffix="%"
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="点击率"
                        value={stats.click_rate}
                        precision={2}
                        suffix="%"
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="退信数"
                        value={stats.bounced}
                      />
                    </Col>
                  </Row>
                </div>
              ) : (
                <Text type="secondary">暂无统计数据</Text>
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
    </div>
  );
};

export default TaskDetail; 