import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  message,
  Space,
  Progress,
  Button,
  Descriptions,
  Modal
} from 'antd';
import {
  MailOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';

interface CampaignInfo {
  id: string;
  name: string;
  description: string;
  status: string;
  sender_name: string;
  sender_email: string;
  total_contacts: number;
  sent_count: number;
  success_count: number;
  failed_count: number;
  pending_count: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  template_names: string[];
  include_tags: string[];
  exclude_tags: string[];
}

interface SubTask {
  id: string;
  contact_email: string;
  contact_name: string;
  template_name: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  sent_at?: string;
  error_message?: string;
  retry_count: number;
  service_name?: string;
}

const CampaignDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaignInfo, setCampaignInfo] = useState<CampaignInfo | null>(null);
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [subTasksLoading, setSubTasksLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });

  // 获取任务详情
  const fetchCampaignDetail = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      // 模拟API调用
      const mockData: CampaignInfo = {
        id: id,
        name: '春节营销活动',
        description: '2025年春节特惠活动推广',
        status: 'sending',
        sender_name: 'EDM系统',
        sender_email: 'noreply@example.com',
        total_contacts: 5000,
        sent_count: 3200,
        success_count: 3100,
        failed_count: 100,
        pending_count: 1800,
        created_at: '2025-01-27T10:00:00Z',
        started_at: '2025-01-27T10:30:00Z',
        template_names: ['春节模板1', '春节模板2'],
        include_tags: ['VIP客户', '普通客户'],
        exclude_tags: ['已退订']
      };
      setCampaignInfo(mockData);
    } catch (error) {
      console.error('获取任务详情失败:', error);
      message.error('获取任务详情失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取子任务列表
  const fetchSubTasks = async (page = 1, pageSize = 20) => {
    if (!id) return;
    
    setSubTasksLoading(true);
    try {
      // 模拟API调用
      const mockSubTasks: SubTask[] = Array.from({ length: pageSize }, (_, index) => ({
        id: `subtask_${page}_${index}`,
        contact_email: `user${(page - 1) * pageSize + index + 1}@example.com`,
        contact_name: `用户${(page - 1) * pageSize + index + 1}`,
        template_name: index % 2 === 0 ? '春节模板1' : '春节模板2',
        status: index < 5 ? 'sent' : index < 8 ? 'failed' : index < 15 ? 'sending' : 'pending',
        sent_at: index < 8 ? '2025-01-27T11:00:00Z' : undefined,
        error_message: index >= 5 && index < 8 ? '发送失败: 邮箱不存在' : undefined,
        retry_count: index >= 5 && index < 8 ? 1 : 0,
        service_name: index < 15 ? '阿里云邮件服务' : undefined
      }));

      setSubTasks(mockSubTasks);
      setPagination(prev => ({
        ...prev,
        current: page,
        total: 5000 // 模拟总数
      }));
    } catch (error) {
      console.error('获取子任务列表失败:', error);
      message.error('获取子任务列表失败');
    } finally {
      setSubTasksLoading(false);
    }
  };

  // 重试失败的子任务
  const handleRetryFailed = (subTaskId: string) => {
    Modal.confirm({
      title: '确认重试',
      content: '确定要重试这个失败的子任务吗？',
      onOk: async () => {
        try {
          // 这里应该调用重试API
          message.success('重试请求已提交');
          fetchSubTasks(pagination.current, pagination.pageSize);
        } catch (error) {
          message.error('重试失败');
        }
      }
    });
  };

  // 暂停/恢复任务
  const handleToggleTask = () => {
    const action = campaignInfo?.status === 'sending' ? '暂停' : '恢复';
    Modal.confirm({
      title: `确认${action}`,
      content: `确定要${action}这个群发任务吗？`,
      onOk: async () => {
        try {
          // 这里应该调用暂停/恢复API
          message.success(`任务${action}成功`);
          fetchCampaignDetail();
        } catch (error) {
          message.error(`${action}失败`);
        }
      }
    });
  };

  // 分页变化
  const handleTableChange = (paginationInfo: any) => {
    fetchSubTasks(paginationInfo.current, paginationInfo.pageSize);
  };

  useEffect(() => {
    fetchCampaignDetail();
    fetchSubTasks();
  }, [id]);

  if (!campaignInfo) {
    return <div>加载中...</div>;
  }

  // 获取状态标签
  const getStatusTag = (status: string) => {
    const statusMap: { [key: string]: { text: string; color: string } } = {
      'draft': { text: '草稿', color: 'default' },
      'pending': { text: '待发送', color: 'orange' },
      'sending': { text: '发送中', color: 'blue' },
      'completed': { text: '已完成', color: 'green' },
      'failed': { text: '失败', color: 'red' },
      'paused': { text: '已暂停', color: 'purple' }
    };
    const config = statusMap[status] || { text: status, color: 'default' };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 获取子任务状态标签
  const getSubTaskStatusTag = (status: string) => {
    const statusMap: { [key: string]: { text: string; color: string } } = {
      'pending': { text: '待发送', color: 'orange' },
      'sending': { text: '发送中', color: 'blue' },
      'sent': { text: '已发送', color: 'green' },
      'failed': { text: '失败', color: 'red' }
    };
    const config = statusMap[status] || { text: status, color: 'default' };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 计算发送进度
  const progress = Math.round((campaignInfo.sent_count / campaignInfo.total_contacts) * 100);
  const successRate = campaignInfo.sent_count > 0 ? 
    Math.round((campaignInfo.success_count / campaignInfo.sent_count) * 100) : 0;

  // 子任务表格列
  const subTaskColumns = [
    {
      title: '联系人',
      key: 'contact',
      render: (_: any, record: SubTask) => (
        <div>
          <div>{record.contact_name}</div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            {record.contact_email}
          </div>
        </div>
      ),
    },
    {
      title: '邮件模板',
      dataIndex: 'template_name',
      key: 'template_name',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getSubTaskStatusTag(status),
    },
    {
      title: '发送服务',
      dataIndex: 'service_name',
      key: 'service_name',
      render: (serviceName: string) => serviceName || '-',
    },
    {
      title: '发送时间',
      dataIndex: 'sent_at',
      key: 'sent_at',
      render: (date: string) => date ? new Date(date).toLocaleString('zh-CN') : '-',
    },
    {
      title: '重试次数',
      dataIndex: 'retry_count',
      key: 'retry_count',
    },
    {
      title: '错误信息',
      dataIndex: 'error_message',
      key: 'error_message',
      render: (error: string) => error || '-',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: SubTask) => (
        <Space>
          {record.status === 'failed' && (
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => handleRetryFailed(record.id)}
            >
              重试
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="campaign-detail">
      {/* 任务基本信息 */}
      <Card
        title={
          <Space>
            <MailOutlined />
            任务详情
          </Space>
        }
        extra={
          <Space>
            {campaignInfo.status === 'sending' && (
              <Button
                icon={<PauseCircleOutlined />}
                onClick={handleToggleTask}
              >
                暂停任务
              </Button>
            )}
            {campaignInfo.status === 'paused' && (
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleToggleTask}
              >
                恢复任务
              </Button>
            )}
            <Button onClick={() => navigate('/campaigns')}>
              返回列表
            </Button>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Descriptions column={2}>
          <Descriptions.Item label="任务名称">{campaignInfo.name}</Descriptions.Item>
          <Descriptions.Item label="任务状态">{getStatusTag(campaignInfo.status)}</Descriptions.Item>
          <Descriptions.Item label="发信人">
            {campaignInfo.sender_name} ({campaignInfo.sender_email})
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {new Date(campaignInfo.created_at).toLocaleString('zh-CN')}
          </Descriptions.Item>
          <Descriptions.Item label="开始时间">
            {campaignInfo.started_at ? new Date(campaignInfo.started_at).toLocaleString('zh-CN') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="完成时间">
            {campaignInfo.completed_at ? new Date(campaignInfo.completed_at).toLocaleString('zh-CN') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="邮件模板">
            {campaignInfo.template_names.map(name => (
              <Tag key={name} color="blue">{name}</Tag>
            ))}
          </Descriptions.Item>
          <Descriptions.Item label="包含标签">
            {campaignInfo.include_tags.map(tag => (
              <Tag key={tag} color="green">{tag}</Tag>
            ))}
          </Descriptions.Item>
          <Descriptions.Item label="排除标签">
            {campaignInfo.exclude_tags.map(tag => (
              <Tag key={tag} color="red">{tag}</Tag>
            ))}
          </Descriptions.Item>
          <Descriptions.Item label="任务描述" span={2}>
            {campaignInfo.description || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 发送统计 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总联系人"
              value={campaignInfo.total_contacts}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已发送"
              value={campaignInfo.sent_count}
              prefix={<MailOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="发送成功"
              value={campaignInfo.success_count}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="发送失败"
              value={campaignInfo.failed_count}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 发送进度 */}
      <Card title="发送进度" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <div style={{ marginBottom: 8 }}>发送进度</div>
            <Progress
              percent={progress}
              status={campaignInfo.status === 'failed' ? 'exception' : 'active'}
              format={(percent) => `${percent}% (${campaignInfo.sent_count}/${campaignInfo.total_contacts})`}
            />
          </Col>
          <Col span={12}>
            <div style={{ marginBottom: 8 }}>成功率</div>
            <Progress
              percent={successRate}
              strokeColor={successRate >= 90 ? '#52c41a' : successRate >= 70 ? '#faad14' : '#ff4d4f'}
              format={(percent) => `${percent}% (${campaignInfo.success_count}/${campaignInfo.sent_count})`}
            />
          </Col>
        </Row>
      </Card>

      {/* 子任务列表 */}
      <Card title="子任务详情">
        <Table
          columns={subTaskColumns}
          dataSource={subTasks}
          rowKey="id"
          loading={subTasksLoading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  );
};

export default CampaignDetail; 