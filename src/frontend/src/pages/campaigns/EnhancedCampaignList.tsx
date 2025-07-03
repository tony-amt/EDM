import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Select,
  Input,
  DatePicker,
  Row,
  Col,
  Progress,
  message,
  Modal,
  Tooltip
} from 'antd';
import {
  PlusOutlined,
  MailOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  SearchOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';

const { Option } = Select;
const { RangePicker } = DatePicker;

interface Sender {
  id: string;
  name: string;
  email: string;
}

interface Campaign {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'pending' | 'sending' | 'completed' | 'failed' | 'paused';
  sender_id: string;
  sender_name: string;
  sender_email: string;
  total_contacts: number;
  sent_count: number;
  success_count: number;
  failed_count: number;
  pending_count: number;
  template_names: string[];
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

interface FilterOptions {
  status?: string;
  sender_id?: string;
  keyword?: string;
  date_range?: [string, string];
}

const EnhancedCampaignList: React.FC = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({});
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });

  // 获取发信人列表
  const fetchSenders = async () => {
    try {
      // 模拟API调用
      const mockSenders: Sender[] = [
        { id: '1', name: 'EDM系统', email: 'noreply@example.com' },
        { id: '2', name: '客服中心', email: 'service@example.com' },
        { id: '3', name: '营销部门', email: 'marketing@example.com' }
      ];
      setSenders(mockSenders);
    } catch (error) {
      console.error('获取发信人列表失败:', error);
    }
  };

  // 获取群发任务列表
  const fetchCampaigns = async (page = 1, pageSize = 10, filterOptions: FilterOptions = {}) => {
    setLoading(true);
    try {
      // 模拟API调用
      const mockCampaigns: Campaign[] = Array.from({ length: pageSize }, (_, index) => {
        const statusList: Campaign['status'][] = ['draft', 'pending', 'sending', 'completed', 'failed', 'paused'];
        const status = statusList[index % statusList.length];
        const totalContacts = Math.floor(Math.random() * 5000) + 100;
        const sentCount = status === 'completed' ? totalContacts : Math.floor(Math.random() * totalContacts);
        const successCount = Math.floor(sentCount * (0.8 + Math.random() * 0.2));
        const failedCount = sentCount - successCount;
        const pendingCount = totalContacts - sentCount;

        return {
          id: `campaign_${(page - 1) * pageSize + index + 1}`,
          name: `营销活动${(page - 1) * pageSize + index + 1}`,
          description: `这是第${(page - 1) * pageSize + index + 1}个营销活动的描述`,
          status,
          sender_id: String((index % 3) + 1),
          sender_name: ['EDM系统', '客服中心', '营销部门'][index % 3],
          sender_email: ['noreply@example.com', 'service@example.com', 'marketing@example.com'][index % 3],
          total_contacts: totalContacts,
          sent_count: sentCount,
          success_count: successCount,
          failed_count: failedCount,
          pending_count: pendingCount,
          template_names: [`模板${index + 1}`, `模板${index + 2}`],
          created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
          started_at: status !== 'draft' ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString() : undefined,
          completed_at: status === 'completed' ? new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000).toISOString() : undefined
        };
      });

      setCampaigns(mockCampaigns);
      setPagination(prev => ({
        ...prev,
        current: page,
        total: 156 // 模拟总数
      }));
    } catch (error) {
      console.error('获取群发任务列表失败:', error);
      message.error('获取群发任务列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 应用筛选
  const applyFilters = () => {
    fetchCampaigns(1, pagination.pageSize, filters);
  };

  // 重置筛选
  const resetFilters = () => {
    setFilters({});
    fetchCampaigns(1, pagination.pageSize, {});
  };

  // 分页变化
  const handleTableChange = (paginationInfo: any) => {
    fetchCampaigns(paginationInfo.current, paginationInfo.pageSize, filters);
  };

  // 操作任务
  const handleTaskAction = async (id: string, action: 'start' | 'pause' | 'stop' | 'delete') => {
    const actionNames = {
      start: '启动',
      pause: '暂停',
      stop: '停止',
      delete: '删除'
    };

    Modal.confirm({
      title: `确认${actionNames[action]}`,
      content: `确定要${actionNames[action]}这个群发任务吗？`,
      onOk: async () => {
        try {
          // 这里应该调用相应的API
          message.success(`任务${actionNames[action]}成功`);
          fetchCampaigns(pagination.current, pagination.pageSize, filters);
        } catch (error) {
          message.error(`${actionNames[action]}失败`);
        }
      }
    });
  };

  useEffect(() => {
    fetchSenders();
    fetchCampaigns();
  }, []);

  // 获取状态标签
  const getStatusTag = (status: Campaign['status']) => {
    const statusConfig = {
      'draft': { text: '草稿', color: 'default' },
      'pending': { text: '待发送', color: 'orange' },
      'sending': { text: '发送中', color: 'blue' },
      'completed': { text: '已完成', color: 'green' },
      'failed': { text: '失败', color: 'red' },
      'paused': { text: '已暂停', color: 'purple' }
    };
    const config = statusConfig[status];
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 计算发送进度
  const getProgress = (campaign: Campaign) => {
    if (campaign.total_contacts === 0) return 0;
    return Math.round((campaign.sent_count / campaign.total_contacts) * 100);
  };

  // 计算成功率
  const getSuccessRate = (campaign: Campaign) => {
    if (campaign.sent_count === 0) return 0;
    return Math.round((campaign.success_count / campaign.sent_count) * 100);
  };

  // 表格列定义
  const columns: ColumnsType<Campaign> = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            {record.description}
          </div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => getStatusTag(status),
    },
    {
      title: '发信人',
      key: 'sender',
      width: 150,
      render: (_, record) => (
        <div>
          <div>{record.sender_name}</div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            {record.sender_email}
          </div>
        </div>
      ),
    },
    {
      title: '联系人统计',
      key: 'contacts',
      width: 120,
      render: (_, record) => (
        <div>
          <div>总数: {record.total_contacts.toLocaleString()}</div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            成功: {record.success_count.toLocaleString()} | 
            失败: {record.failed_count.toLocaleString()}
          </div>
        </div>
      ),
    },
    {
      title: '发送进度',
      key: 'progress',
      width: 150,
      render: (_, record) => {
        const progress = getProgress(record);
        const successRate = getSuccessRate(record);
        return (
          <div>
            <div style={{ marginBottom: 4 }}>
              <Progress
                percent={progress}
                size="small"
                format={() => `${progress}%`}
                status={record.status === 'failed' ? 'exception' : 'active'}
              />
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              成功率: {successRate}%
            </div>
          </div>
        );
      },
    },
    {
      title: '邮件模板',
      dataIndex: 'template_names',
      key: 'template_names',
      width: 150,
      render: (templates: string[]) => (
        <div>
          {templates.slice(0, 2).map((name, index) => (
            <Tag key={index} color="blue">
              {name}
            </Tag>
          ))}
          {templates.length > 2 && (
            <Tooltip title={templates.slice(2).join(', ')}>
              <Tag>+{templates.length - 2}</Tag>
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date) => new Date(date).toLocaleDateString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/campaigns/${record.id}`)}
          >
            详情
          </Button>
          
          {record.status === 'draft' && (
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/campaigns/${record.id}/edit`)}
            >
              编辑
            </Button>
          )}

          {record.status === 'pending' && (
            <Button
              type="text"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleTaskAction(record.id, 'start')}
            >
              启动
            </Button>
          )}

          {record.status === 'sending' && (
            <Button
              type="text"
              size="small"
              icon={<PauseCircleOutlined />}
              onClick={() => handleTaskAction(record.id, 'pause')}
            >
              暂停
            </Button>
          )}

          {record.status === 'paused' && (
            <Button
              type="text"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleTaskAction(record.id, 'start')}
            >
              恢复
            </Button>
          )}

          {['sending', 'paused'].includes(record.status) && (
            <Button
              type="text"
              size="small"
              icon={<StopOutlined />}
              onClick={() => handleTaskAction(record.id, 'stop')}
              danger
            >
              停止
            </Button>
          )}

          {['draft', 'completed', 'failed'].includes(record.status) && (
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => handleTaskAction(record.id, 'delete')}
              danger
            >
              删除
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="enhanced-campaign-list">
      <Card>
        {/* 筛选条件 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={4}>
            <Select
              placeholder="状态筛选"
              value={filters.status}
              onChange={(value) => setFilters({ ...filters, status: value })}
              allowClear
              style={{ width: '100%' }}
            >
              <Option value="draft">草稿</Option>
              <Option value="pending">待发送</Option>
              <Option value="sending">发送中</Option>
              <Option value="completed">已完成</Option>
              <Option value="failed">失败</Option>
              <Option value="paused">已暂停</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Select
              placeholder="发信人筛选"
              value={filters.sender_id}
              onChange={(value) => setFilters({ ...filters, sender_id: value })}
              allowClear
              style={{ width: '100%' }}
            >
              {senders.map(sender => (
                <Option key={sender.id} value={sender.id}>
                  {sender.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={6}>
            <Input
              placeholder="搜索任务名称"
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
              prefix={<SearchOutlined />}
              allowClear
            />
          </Col>
          <Col span={6}>
            <RangePicker
              placeholder={['开始日期', '结束日期']}
              onChange={(dates, dateStrings) => {
                setFilters({ 
                  ...filters, 
                  date_range: dateStrings[0] && dateStrings[1] ? [dateStrings[0], dateStrings[1]] : undefined 
                });
              }}
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={4}>
            <Space>
              <Button type="primary" onClick={applyFilters}>
                搜索
              </Button>
              <Button onClick={resetFilters} icon={<ReloadOutlined />}>
                重置
              </Button>
            </Space>
          </Col>
        </Row>

        {/* 操作栏 */}
        <div style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/campaigns/create')}
          >
            创建群发任务
          </Button>
        </div>

        {/* 任务列表 */}
        <Table
          columns={columns}
          dataSource={campaigns}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 1400 }}
        />
      </Card>
    </div>
  );
};

export default EnhancedCampaignList; 