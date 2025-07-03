import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Card, 
  Button, 
  Space, 
  Tag, 
  Avatar, 
  Input,
  DatePicker,
  Select,
  message,
  Tooltip, 
  Badge,
  Popconfirm,
  Modal,
  Typography,
  Row,
  Col,
  Statistic,
  List,
  Dropdown,
  Menu,
  Switch
} from 'antd';
import { 
  MailOutlined, 
  UserOutlined, 
  SearchOutlined, 
  ReloadOutlined,
  EyeOutlined,
  MessageOutlined,
  PlusOutlined,
  DeleteOutlined,
  InboxOutlined,
  MoreOutlined,
  CommentOutlined,
  AppstoreOutlined,
  UnorderedListOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import conversationService from '../../services/conversation.service';
import { 
  Conversation, 
  ConversationListParams,
  ConversationListResponse 
} from '../../types/api';

const { Search } = Input;
const { RangePicker } = DatePicker;
const { Option } = Select;
const { Title, Text } = Typography;

// 视图模式枚举
enum ViewMode {
  INBOX = 'inbox',     // 收信箱模式
  CONVERSATION = 'conversation'  // 会话模式
}

interface FilterState {
  search: string;
  status: string;
  dateRange: [dayjs.Dayjs, dayjs.Dayjs] | null;
}

const ConversationList: React.FC = () => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    archived: 0,
    closed: 0,
    unread: 0
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: '',
    dateRange: null
  });
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.CONVERSATION);

  // 加载会话统计
  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const response = await conversationService.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('加载统计信息失败:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // 加载会话列表
  const loadConversations = async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const params: ConversationListParams = {
        page,
        page_size: pageSize,
        ...(filters.search && { search: filters.search }),
        ...(filters.status && { status: filters.status }),
        ...(filters.dateRange && {
          start_date: filters.dateRange[0].format('YYYY-MM-DD'),
          end_date: filters.dateRange[1].format('YYYY-MM-DD')
        })
      };

      const response: any = await conversationService.getConversations(params);
      
      // 修复数据结构问题 - API返回的是 response.data.conversations
      const conversations = response.data?.conversations || response.data || [];
      const totalCount = response.data?.pagination?.total || response.total || 0;
      
      setConversations(conversations);
      setPagination({
        current: page,
        pageSize,
        total: totalCount
      });
    } catch (error) {
      console.error('加载会话列表失败:', error);
      message.error('加载会话列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    loadConversations();
    loadStats();
  }, []);

  // 搜索处理
  const handleSearch = (value: string) => {
    setFilters(prev => ({ ...prev, search: value }));
    setTimeout(() => loadConversations(1, pagination.pageSize), 0);
  };

  // 状态过滤处理
  const handleStatusFilter = (value: string) => {
    setFilters(prev => ({ ...prev, status: value || '' }));
    setTimeout(() => loadConversations(1, pagination.pageSize), 0);
  };

  // 日期范围过滤处理
  const handleDateRangeFilter = (dates: any) => {
    setFilters(prev => ({ ...prev, dateRange: dates as [dayjs.Dayjs, dayjs.Dayjs] | null }));
    setTimeout(() => loadConversations(1, pagination.pageSize), 0);
  };

  // 清除过滤器
  const handleClearFilters = () => {
    setFilters({ search: '', status: '', dateRange: null });
    setTimeout(() => loadConversations(1, pagination.pageSize), 0);
  };

  // 查看会话详情
  const handleViewConversation = (conversation: Conversation) => {
    navigate(`/conversations/${conversation.id}`);
  };

  // 创建新会话
  const handleCreateConversation = () => {
    navigate('/conversations/new');
  };

  // 更新会话状态
  const handleUpdateStatus = async (conversationId: string, status: 'active' | 'archived' | 'closed') => {
    try {
      await conversationService.updateStatus(conversationId, status);
      message.success('状态更新成功');
      loadConversations(pagination.current, pagination.pageSize);
      loadStats();
    } catch (error) {
      console.error('更新状态失败:', error);
      message.error('更新状态失败');
    }
  };

  // 删除会话
  const handleDeleteConversation = async (conversationId: string) => {
        try {
          await conversationService.deleteConversation(conversationId);
      message.success('会话删除成功');
      loadConversations(pagination.current, pagination.pageSize);
          loadStats();
        } catch (error) {
      console.error('删除会话失败:', error);
      message.error('删除会话失败');
        }
  };

  // 获取状态标签
  const getStatusTag = (status: string) => {
    const statusMap = {
      active: { color: 'green', text: '活跃' },
      archived: { color: 'orange', text: '已归档' },
      closed: { color: 'red', text: '已关闭' }
    };
    const config = statusMap[status as keyof typeof statusMap] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 格式化最后消息预览
  const formatLastMessage = (conversation: Conversation) => {
    if (!conversation.last_message) {
      return <span style={{ color: '#999' }}>暂无消息</span>;
    }

    const { content_text, direction } = conversation.last_message;
    const prefix = direction === 'inbound' ? '📩' : '📤';
    const truncated = content_text.length > 50 
      ? content_text.substring(0, 50) + '...' 
      : content_text;
    
    return (
      <Tooltip title={content_text}>
        <span>
          {prefix} {truncated}
        </span>
      </Tooltip>
    );
  };

  // 表格列定义
  const columns = [
    {
      title: '会话',
      key: 'conversation',
      width: 300,
      render: (record: Conversation) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar 
            icon={<UserOutlined />} 
            style={{ backgroundColor: '#1890ff' }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ 
              fontWeight: 500, 
              marginBottom: 4,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {record.subject || '无主题'}
            </div>
            <div style={{ 
              fontSize: 12, 
              color: '#666',
              display: 'flex',
              gap: 8
            }}>
              <span>{(record as any).sender_name || record.sender_email?.split('@')[0]}</span>
              <span>→</span>
              <span>{record.recipient_email}</span>
          </div>
          </div>
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => getStatusTag(status)
    },
    {
      title: '消息统计',
      key: 'message_stats',
      width: 120,
      render: (record: Conversation) => (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 500 }}>
            {record.unread_count > 0 ? (
              <Badge count={record.unread_count}>
                <MessageOutlined />
              </Badge>
            ) : (
              <MessageOutlined style={{ color: '#999' }} />
            )}
          </div>
          <div style={{ fontSize: 12, color: '#666' }}>
            共 {record.message_count} 条
          </div>
        </div>
      )
    },
    {
      title: '最后消息',
      key: 'last_message',
      render: (record: Conversation) => (
        <div>
          <div style={{ marginBottom: 4 }}>
            {formatLastMessage(record)}
          </div>
          <div style={{ fontSize: 12, color: '#999' }}>
            {dayjs(record.last_message_at).format('MM-DD HH:mm')}
          </div>
        </div>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date: string) => dayjs(date).format('MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (record: Conversation) => (
        <Space>
          <Button
            type="primary"
            size="small"
              icon={<EyeOutlined />}
            onClick={() => handleViewConversation(record)}
            >
            查看
          </Button>
          {record.status === 'active' && (
            <Button
              size="small"
              icon={<InboxOutlined />}
              onClick={() => handleUpdateStatus(record.id, 'archived')}
            >
              归档
            </Button>
          )}
          <Popconfirm
            title="确定要删除这个会话吗？"
            onConfirm={() => handleDeleteConversation(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // 模式切换处理
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
  };

  // 收信箱模式渲染
  const renderInboxMode = () => {
    const inboxColumns = [
      {
        title: '发件人',
        key: 'sender',
        width: 200,
        render: (record: Conversation) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Avatar 
              icon={<MailOutlined />} 
              style={{ backgroundColor: '#52c41a' }}
              size="small"
            />
            <div>
              <div style={{ fontWeight: 500 }}>
                {record.sender_email?.split('@')[0]}
              </div>
              <div style={{ fontSize: 12, color: '#666' }}>
                {record.sender_email}
              </div>
            </div>
          </div>
        )
      },
      {
        title: '收件人邮箱',
        dataIndex: 'recipient_email',
        key: 'recipient_email',
        width: 180,
      },
      {
        title: '主题',
        dataIndex: 'subject',
        key: 'subject',
        render: (subject: string, record: Conversation) => (
          <div>
            <div style={{ fontWeight: record.unread_count > 0 ? 600 : 400 }}>
              {subject || '无主题'}
            </div>
            {record.unread_count > 0 && (
              <Badge count={record.unread_count} size="small" style={{ marginTop: 4 }} />
            )}
          </div>
        )
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 150,
        render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm')
      },
      {
        title: '操作',
        key: 'actions',
        width: 120,
        render: (record: Conversation) => (
          <Space>
            <Button 
              type="link" 
              size="small"
              onClick={() => handleViewConversation(record)}
            >
              查看
            </Button>
            <Button 
              type="link" 
              size="small"
              onClick={() => navigate(`/conversations/${record.id}?mode=reply`)}
            >
              回复
            </Button>
          </Space>
        )
      }
    ];

    return (
      <Table
        dataSource={conversations}
        columns={inboxColumns}
        rowKey="id"
        loading={loading}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) =>
            `第 ${range[0]}-${range[1]} 条，共 ${total} 条邮件`,
          onChange: (page, pageSize) => loadConversations(page, pageSize),
        }}
        rowClassName={(record) => record.unread_count > 0 ? 'unread-email' : ''}
      />
    );
  };

  // 会话模式渲染 (IM风格)
  const renderConversationMode = () => {
    return (
      <Row gutter={16} style={{ height: 'calc(100vh - 300px)' }}>
        {/* 左侧联系人列表 */}
        <Col span={8}>
          <Card 
            title="联系人" 
            size="small" 
            style={{ height: '100%' }}
            bodyStyle={{ padding: 0, height: 'calc(100% - 40px)', overflow: 'auto' }}
          >
            <List
              dataSource={conversations}
              renderItem={(conversation) => (
                <List.Item
                  className={`conversation-item ${conversation.unread_count > 0 ? 'unread' : ''}`}
                  onClick={() => handleViewConversation(conversation)}
                  style={{ 
                    cursor: 'pointer', 
                    padding: '12px 16px',
                    borderBottom: '1px solid #f0f0f0'
                  }}
                >
                  <List.Item.Meta
                    avatar={
                      <Badge count={conversation.unread_count} size="small">
                        <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
                      </Badge>
                    }
                    title={
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: conversation.unread_count > 0 ? 600 : 400 }}>
                          {conversation.sender_email?.split('@')[0]}
                        </span>
                        <span style={{ fontSize: 12, color: '#999' }}>
                          {dayjs(conversation.last_message_at).format('MM-DD')}
                        </span>
                      </div>
                    }
                    description={
                      <div>
                        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                          {conversation.subject || '无主题'}
                        </div>
                        <div style={{ fontSize: 12, color: '#999' }}>
                          {conversation.message_count} 条消息
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        
        {/* 右侧会话详情 */}
        <Col span={16}>
          <Card 
            title="选择一个联系人开始对话" 
            size="small" 
            style={{ height: '100%', textAlign: 'center' }}
            bodyStyle={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              height: 'calc(100% - 40px)'
            }}
          >
            <div style={{ color: '#999' }}>
              <CommentOutlined style={{ fontSize: 48, marginBottom: 16 }} />
              <div>点击左侧联系人查看对话详情</div>
            </div>
          </Card>
        </Col>
      </Row>
    );
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* 统计卡片 */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
        <Card size="small" loading={statsLoading}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 500, color: '#1890ff' }}>{stats.total}</div>
            <div style={{ color: '#666' }}>总会话</div>
          </div>
          </Card>
        <Card size="small" loading={statsLoading}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 500, color: '#52c41a' }}>{stats.active}</div>
            <div style={{ color: '#666' }}>活跃</div>
          </div>
          </Card>
        <Card size="small" loading={statsLoading}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 500, color: '#faad14' }}>{stats.archived}</div>
            <div style={{ color: '#666' }}>已归档</div>
          </div>
          </Card>
        <Card size="small" loading={statsLoading}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 500, color: '#ff4d4f' }}>{stats.unread}</div>
            <div style={{ color: '#666' }}>未读</div>
          </div>
          </Card>
      </div>

      {/* 主表格 */}
      <Card 
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MailOutlined />
            <span>邮件会话</span>
          </div>
        }
        extra={
          <Space>
            {/* 模式切换按钮 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#666' }}>视图模式:</span>
              <Button.Group size="small">
                <Button 
                  type={viewMode === ViewMode.CONVERSATION ? 'primary' : 'default'}
                  icon={<CommentOutlined />}
                  onClick={() => handleViewModeChange(ViewMode.CONVERSATION)}
                >
                  会话
                </Button>
                <Button 
                  type={viewMode === ViewMode.INBOX ? 'primary' : 'default'}
                  icon={<UnorderedListOutlined />}
                  onClick={() => handleViewModeChange(ViewMode.INBOX)}
                >
                  收信箱
                </Button>
              </Button.Group>
            </div>
            <Button 
              type="primary"
              icon={<PlusOutlined />} 
              onClick={handleCreateConversation}
            >
              新建会话
            </Button>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={() => {
                loadConversations(pagination.current, pagination.pageSize);
                loadStats();
              }}
              loading={loading}
            >
              刷新
            </Button>
          </Space>
        }
      >
        {/* 搜索和过滤器 */}
        <div style={{ 
          marginBottom: 16,
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <Search
            placeholder="搜索邮件地址、主题..."
            allowClear
            style={{ width: 300 }}
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            onSearch={handleSearch}
            onPressEnter={(e) => handleSearch((e.target as HTMLInputElement).value)}
          />
        
          <Select
            placeholder="选择状态"
            allowClear
            style={{ width: 120 }}
            value={filters.status || undefined}
            onChange={handleStatusFilter}
          >
            <Option value="active">活跃</Option>
            <Option value="archived">已归档</Option>
            <Option value="closed">已关闭</Option>
          </Select>

          <RangePicker
            placeholder={['开始日期', '结束日期']}
            style={{ width: 240 }}
            value={filters.dateRange}
            onChange={handleDateRangeFilter}
          />

          {(filters.search || filters.status || filters.dateRange) && (
            <Button onClick={handleClearFilters}>
              清除过滤器
            </Button>
          )}
        </div>

        {/* 会话列表 */}
        {viewMode === ViewMode.INBOX ? renderInboxMode() : renderConversationMode()}
      </Card>
    </div>
  );
};

export default ConversationList;

// 添加样式定义
const styles = `
.unread-email {
  background-color: #f6ffed !important;
  font-weight: 500;
}

.conversation-item:hover {
  background-color: #f5f5f5;
}

.conversation-item.unread {
  background-color: #e6f7ff;
  border-left: 3px solid #1890ff;
}

.conversation-item.unread:hover {
  background-color: #bae7ff;
}
`;

// 注入样式
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
} 