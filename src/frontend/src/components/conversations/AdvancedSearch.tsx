import React, { useState, useCallback, useEffect } from 'react';
import {
  Modal,
  Input,
  Form,
  Row,
  Col,
  Select,
  DatePicker,
  Button,
  List,
  Space,
  Typography,
  Tag,
  Badge,
  Card,
  Empty,
  Pagination
} from 'antd';
import {
  SearchOutlined,
  MailOutlined,
  MessageOutlined,
  UserOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import conversationService from '../../services/conversation.service';
import { Conversation, ConversationMessage } from '../../types/api';

const { Search } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { Text } = Typography;

// 搜索结果项接口
interface SearchResult {
  type: 'conversation' | 'message';
  id: string;
  conversation_id?: string;
  title: string;
  content: string;
  highlight: string;
  participants?: string[];
  created_at: string;
  is_read?: boolean;
  message_count?: number;
}

// 搜索过滤器接口
interface SearchFilters {
  search_in: 'conversations' | 'messages' | 'both';
  status?: 'active' | 'archived' | 'closed';
  date_from?: string;
  date_to?: string;
  page: number;
  limit: number;
}

// 组件属性接口
interface AdvancedSearchProps {
  visible: boolean;
  onClose: () => void;
  initialQuery?: string;
}

const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  visible,
  onClose,
  initialQuery = ''
}) => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<SearchFilters>({
    search_in: 'both',
    page: 1,
    limit: 20
  });

  // 执行搜索的核心方法
  const performSearch = useCallback(async (searchQuery: string, searchFilters: SearchFilters) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setTotal(0);
      return;
    }

    setLoading(true);
    try {
      const response = await conversationService.searchConversationsAndMessages(
        searchQuery,
        {
          status: searchFilters.status,
          date_from: searchFilters.date_from,
          date_to: searchFilters.date_to
        }
      );
      
      // 合并会话和消息结果
      const combinedResults: SearchResult[] = [];
      
      // 添加会话结果
      if (searchFilters.search_in === 'both' || searchFilters.search_in === 'conversations') {
        response.conversations.forEach(conv => {
          combinedResults.push({
            type: 'conversation',
            id: conv.id,
            title: conv.subject,
            content: conv.last_message?.content_text || '',
            highlight: '',
            participants: [conv.sender_email, conv.recipient_email],
            created_at: conv.created_at,
            is_read: conv.unread_count === 0,
            message_count: conv.message_count
          });
        });
      }
      
      // 添加消息结果
      if (searchFilters.search_in === 'both' || searchFilters.search_in === 'messages') {
        response.messages.forEach(msg => {
          combinedResults.push({
            type: 'message',
            id: msg.id,
            conversation_id: msg.conversation_id,
            title: msg.subject,
            content: msg.content_text || '',
            highlight: '',
            participants: [msg.from_email, msg.to_email],
            created_at: msg.sent_at,
            is_read: msg.status === 'read'
          });
        });
      }
      
      // 分页处理
      const startIndex = (searchFilters.page - 1) * searchFilters.limit;
      const paginatedResults = combinedResults.slice(startIndex, startIndex + searchFilters.limit);
      
      setResults(paginatedResults);
      setTotal(combinedResults.length);
    } catch (error) {
      console.error('搜索失败:', error);
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  // 处理搜索
  const handleSearch = (value: string) => {
    setQuery(value);
    setFilters(prev => ({ ...prev, page: 1 }));
    performSearch(value, { ...filters, page: 1 });
  };

  // 处理筛选器变化
  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    const newFilters = { ...filters, [key]: value, page: 1 };
    setFilters(newFilters);
    if (query.trim()) {
      performSearch(query, newFilters);
    }
  };

  // 处理日期范围变化
  const handleDateRangeChange = (dates: any) => {
    const newFilters = {
      ...filters,
      date_from: dates && dates[0] ? dates[0].format('YYYY-MM-DD') : undefined,
      date_to: dates && dates[1] ? dates[1].format('YYYY-MM-DD') : undefined,
      page: 1
    };
    setFilters(newFilters);
    if (query.trim()) {
      performSearch(query, newFilters);
    }
  };

  // 处理分页
  const handlePageChange = (page: number) => {
    const newFilters = { ...filters, page };
    setFilters(newFilters);
    performSearch(query, newFilters);
  };

  // 高亮搜索关键词
  const highlightText = (text: string, highlight: string) => {
    if (!highlight) return text;
    
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === highlight.toLowerCase() ? (
        <mark key={index} style={{ backgroundColor: '#fff566', padding: '0 2px' }}>
          {part}
        </mark>
      ) : part
    );
  };

  // 渲染搜索结果项
  const renderResultItem = (item: SearchResult) => {
    const isConversation = item.type === 'conversation';
    
    return (
      <List.Item
        key={`${item.type}-${item.id}`}
        style={{ cursor: 'pointer' }}
        onClick={() => {
          if (isConversation) {
            navigate(`/conversations/${item.id}`);
          } else {
            navigate(`/conversations/${item.conversation_id}`);
          }
          onClose();
        }}
      >
        <List.Item.Meta
          avatar={
            <div style={{ textAlign: 'center' }}>
              {isConversation ? (
                <MailOutlined style={{ fontSize: '20px', color: '#1890ff' }} />
              ) : (
                <MessageOutlined style={{ fontSize: '20px', color: '#52c41a' }} />
              )}
              {item.is_read === false && (
                <Badge 
                  status="processing" 
                  style={{ position: 'absolute', top: -2, right: -2 }} 
                />
              )}
            </div>
          }
          title={
            <div>
              <Space>
                <Text strong>{highlightText(item.title, query)}</Text>
                <Tag color={isConversation ? 'blue' : 'green'}>
                  {isConversation ? '会话' : '消息'}
                </Tag>
                {isConversation && item.message_count && (
                  <Tag>{item.message_count} 条消息</Tag>
                )}
              </Space>
            </div>
          }
          description={
            <div>
              <div style={{ marginBottom: 8 }}>
                {highlightText(item.content, query)}
              </div>
              <Space size="small">
                {item.participants && (
                  <Text type="secondary">
                    <UserOutlined /> {item.participants.join(', ')}
                  </Text>
                )}
                <Text type="secondary">
                  <CalendarOutlined /> {new Date(item.created_at).toLocaleString()}
                </Text>
              </Space>
            </div>
          }
        />
      </List.Item>
    );
  };

  // 重置搜索
  const handleReset = () => {
    setQuery('');
    setResults([]);
    setTotal(0);
    setFilters({
      search_in: 'both',
      page: 1,
      limit: 20
    });
    form.resetFields();
  };

  // 初始化时如果有查询词则执行搜索
  useEffect(() => {
    if (visible && initialQuery) {
      setQuery(initialQuery);
      performSearch(initialQuery, filters);
    }
  }, [visible, initialQuery, filters, performSearch]);

  return (
    <Modal
      title={
        <Space>
          <SearchOutlined />
          高级搜索
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={900}
      style={{ top: 20 }}
      bodyStyle={{ maxHeight: '80vh', overflow: 'auto' }}
    >
      {/* 搜索表单 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item label="搜索关键词" style={{ marginBottom: 12 }}>
                <Search
                  placeholder="输入关键词搜索会话和消息..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onSearch={handleSearch}
                  size="large"
                  allowClear
                />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="搜索范围" style={{ marginBottom: 8 }}>
                <Select
                  value={filters.search_in}
                  onChange={(value) => handleFilterChange('search_in', value)}
                  style={{ width: '100%' }}
                >
                  <Option value="both">会话和消息</Option>
                  <Option value="conversations">仅会话</Option>
                  <Option value="messages">仅消息</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="状态" style={{ marginBottom: 8 }}>
                <Select
                  placeholder="选择状态"
                  allowClear
                  value={filters.status}
                  onChange={(value) => handleFilterChange('status', value)}
                  style={{ width: '100%' }}
                >
                  <Option value="active">活跃</Option>
                  <Option value="archived">已归档</Option>
                  <Option value="closed">已关闭</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="日期范围" style={{ marginBottom: 8 }}>
                <RangePicker
                  style={{ width: '100%' }}
                  onChange={handleDateRangeChange}
                />
              </Form.Item>
            </Col>
          </Row>
          
          <Row>
            <Col span={24} style={{ textAlign: 'right' }}>
              <Space>
                <Button onClick={handleReset}>
                  重置
                </Button>
                <Button type="primary" onClick={() => handleSearch(query)}>
                  搜索
                </Button>
              </Space>
            </Col>
          </Row>
        </Form>
      </Card>

      {/* 搜索结果 */}
      <Card 
        title={`搜索结果 (${total})`}
        size="small"
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            搜索中...
          </div>
        ) : results.length === 0 ? (
          <Empty description="暂无搜索结果" />
          ) : (
            <>
              <List
                dataSource={results}
                renderItem={renderResultItem}
              style={{ marginBottom: 16 }}
            />
            
            {total > filters.limit && (
              <div style={{ textAlign: 'center' }}>
                <Pagination
                  current={filters.page}
                  pageSize={filters.limit}
                  total={total}
                  onChange={handlePageChange}
                  showSizeChanger={false}
                  showQuickJumper
                  showTotal={(total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`}
              />
              </div>
            )}
            </>
          )}
      </Card>
    </Modal>
  );
};

export default AdvancedSearch; 