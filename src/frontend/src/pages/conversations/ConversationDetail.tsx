import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Input,
  Typography,
  Space,
  Avatar,
  Divider,
  Tag,
  List,
  Spin,
  message,
  Select,
  Modal,
  Tooltip,
  Row,
  Col,
  Alert,
  Affix,
  BackTop
} from 'antd';
import {
  ArrowLeftOutlined,
  MailOutlined,
  SendOutlined,
  UserOutlined,
  SettingOutlined,
  SearchOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  TagOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  MessageOutlined
} from '@ant-design/icons';
import MessageItem from '../../components/conversations/MessageItem';
import conversationService from '../../services/conversation.service';
import { 
  Conversation, 
  ConversationMessage,
  ConversationDetailResponse,
  SendReplyParams 
} from '../../types/api';

const { TextArea } = Input;
const { Text, Title } = Typography;
const { Option } = Select;

interface ConversationDetailProps {
  // 保留用于将来扩展
}

const ConversationDetail: React.FC<ConversationDetailProps> = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const messageListRef = useRef<HTMLDivElement>(null);
  
  // 状态管理
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredMessages, setFilteredMessages] = useState<ConversationMessage[]>([]);
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);

  // 模态框状态
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  // 加载会话详情
  const loadConversationDetail = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const response: ConversationDetailResponse = await conversationService.getConversationDetail(id);
      setConversation(response.data);
      setMessages(response.data.messages || []);
      setFilteredMessages(response.data.messages || []);
      
      // 自动标记为已读
      if (response.data.unread_count > 0) {
        await conversationService.markAsRead(id);
      }
    } catch (error) {
      console.error('加载会话详情失败:', error);
      message.error('加载会话详情失败');
    } finally {
      setLoading(false);
    }
  };

  // 发送回复
  const handleSendReply = async () => {
    if (!id || !replyContent.trim()) {
      message.warning('请输入回复内容');
      return;
    }

    setSending(true);
    try {
      const replyData: SendReplyParams = {
        content_text: replyContent,
        content_html: replyContent.replace(/\n/g, '<br>'),
        subject: replySubject || `Re: ${conversation?.subject}`,
        to_email: conversation?.sender_email || '',
        from_email: conversation?.recipient_email || ''
      };

      await conversationService.sendReply(id, replyData);
      message.success('回复发送成功');
      setReplyContent('');
      setReplySubject('');
      
      // 重新加载会话以获取最新消息
      loadConversationDetail();
    } catch (error) {
      console.error('发送回复失败:', error);
      message.error('发送回复失败');
    } finally {
      setSending(false);
    }
  };

  // 更新会话状态
  const handleStatusUpdate = async (status: 'active' | 'archived' | 'closed') => {
    if (!id) return;
    
    setStatusUpdateLoading(true);
    try {
      await conversationService.updateStatus(id, status);
      message.success('状态更新成功');
      loadConversationDetail();
    } catch (error) {
      console.error('更新状态失败:', error);
      message.error('更新状态失败');
    } finally {
      setStatusUpdateLoading(false);
    }
  };

  // 删除会话
  const handleDeleteConversation = async () => {
    if (!id) return;
    
    try {
      await conversationService.deleteConversation(id);
      message.success('会话删除成功');
      navigate('/conversations');
    } catch (error) {
      console.error('删除会话失败:', error);
      message.error('删除会话失败');
    }
  };

  // 搜索消息
  const handleSearchMessages = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredMessages(messages);
      return;
    }

    const filtered = messages.filter(msg => 
      (msg.content_text || '').toLowerCase().includes(query.toLowerCase()) ||
      msg.subject.toLowerCase().includes(query.toLowerCase()) ||
      msg.from_email.toLowerCase().includes(query.toLowerCase())
    );
    setFilteredMessages(filtered);
  };

  // 滚动到底部
  const scrollToBottom = () => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  };

  // 处理消息回复
  const handleMessageReply = (message: ConversationMessage) => {
    setReplySubject(`Re: ${message.subject}`);
    setReplyContent(`\n\n--- 原消息 ---\n发件人: ${message.from_email}\n时间: ${new Date(message.sent_at).toLocaleString()}\n内容: ${message.content_text}\n`);
  };

  // 删除消息
  const handleDeleteMessage = async (messageId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条消息吗？此操作无法撤销。',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await conversationService.deleteMessage(messageId);
          message.success('消息删除成功');
          loadConversationDetail();
        } catch (error) {
          console.error('删除消息失败:', error);
          message.error('删除消息失败');
        }
      }
    });
  };

  // 标记消息重要
  const handleFlagMessage = async (messageId: string) => {
    try {
      await conversationService.flagMessage(messageId);
      message.success('消息已标记为重要');
      loadConversationDetail();
    } catch (error) {
      console.error('标记消息失败:', error);
      message.error('标记消息失败');
    }
  };

  // 初始化
  useEffect(() => {
    loadConversationDetail();
  }, [id]);

  // 自动滚动到底部
  useEffect(() => {
    setTimeout(scrollToBottom, 100);
  }, [messages]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text>加载会话详情中...</Text>
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div style={{ textAlign: 'center', padding: '100px' }}>
        <Text type="secondary">会话不存在或已被删除</Text>
        <div style={{ marginTop: 16 }}>
        <Button onClick={() => navigate('/conversations')}>
          返回会话列表
        </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部工具栏 */}
      <Affix offsetTop={0}>
        <Card 
          size="small" 
          style={{ 
            borderRadius: 0,
            borderLeft: 0,
            borderRight: 0,
            borderTop: 0
          }}
        >
          <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <Button 
                icon={<ArrowLeftOutlined />} 
                onClick={() => navigate('/conversations')}
              >
                返回
              </Button>
                <Divider type="vertical" />
                <Avatar icon={<UserOutlined />} />
                <div>
                  <Title level={5} style={{ margin: 0 }}>
                    {conversation.subject || '无主题'}
              </Title>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {conversation.sender_email} ↔ {conversation.recipient_email}
                  </Text>
                </div>
            </Space>
          </Col>
            
          <Col>
            <Space>
                <Input.Search
                  placeholder="搜索消息..."
                  style={{ width: 200 }}
                  value={searchQuery}
                  onChange={(e) => handleSearchMessages(e.target.value)}
                  allowClear
                />
                
                <Select
                  value={conversation.status}
                  style={{ width: 100 }}
                  onChange={handleStatusUpdate}
                  loading={statusUpdateLoading}
                >
                  <Option value="active">活跃</Option>
                  <Option value="archived">归档</Option>
                  <Option value="closed">关闭</Option>
                </Select>
                
              <Button 
                icon={<ReloadOutlined />}
                  onClick={loadConversationDetail}
              >
                刷新
              </Button>
                
                <Button 
                  icon={<SettingOutlined />}
                  onClick={() => setSettingsModalVisible(true)}
                >
                  设置
                </Button>
                
                <Button 
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => setDeleteModalVisible(true)}
                >
                  删除
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>
      </Affix>

      {/* 会话信息展示 */}
      <Card size="small" style={{ margin: '0 0 16px 0' }}>
        <Row gutter={16}>
          <Col span={12}>
            <Space direction="vertical" size="small">
              <Text strong>会话统计</Text>
              <Space>
                <Tag color="blue">{conversation.message_count} 条消息</Tag>
                <Tag color="green">{conversation.unread_count} 条未读</Tag>
                <Tag color={
                  conversation.status === 'active' ? 'green' :
                  conversation.status === 'archived' ? 'orange' : 'red'
                }>
                  {conversation.status === 'active' ? '活跃' :
                   conversation.status === 'archived' ? '已归档' : '已关闭'}
                </Tag>
              </Space>
            </Space>
          </Col>
          <Col span={12}>
            <Space direction="vertical" size="small">
              <Text strong>时间信息</Text>
              <Text type="secondary">
                创建: {new Date(conversation.created_at).toLocaleString()}
              </Text>
              {conversation.last_message_at && (
                <Text type="secondary">
                  最后消息: {new Date(conversation.last_message_at).toLocaleString()}
                </Text>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 消息列表 */}
      <div style={{ 
        flex: 1, 
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
      <Card 
          title={
            <Space>
              <MessageOutlined />
              消息记录
              {searchQuery && (
                <Tag color="orange">
                  搜索: {searchQuery} ({filteredMessages.length} 条结果)
                </Tag>
              )}
            </Space>
          }
          size="small"
          style={{ 
            flex: 1,
            display: 'flex',
            flexDirection: 'column'
          }}
          bodyStyle={{ 
            flex: 1,
            overflow: 'auto',
            padding: '16px'
          }}
        >
          <div 
            ref={messageListRef}
        style={{ 
              height: '100%',
              overflow: 'auto',
              padding: '0 8px'
            }}
      >
            {filteredMessages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
                <Text type="secondary">
                  {searchQuery ? '没有找到匹配的消息' : '暂无消息记录'}
                </Text>
            </div>
          ) : (
            <div>
                {filteredMessages.map((message, index) => (
                  <MessageItem
                    key={message.id}
                    message={message}
                    searchQuery={searchQuery}
                    onReply={handleMessageReply}
                    onDelete={handleDeleteMessage}
                    onFlag={handleFlagMessage}
                  />
                ))}
            </div>
          )}
          </div>
      </Card>
      </div>

      {/* 回复区域 */}
      <Card size="small" style={{ margin: '16px 0 0 0' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input
            placeholder="回复主题 (可选)"
            value={replySubject}
            onChange={(e) => setReplySubject(e.target.value)}
            prefix={<TagOutlined />}
          />
          
          <TextArea
            placeholder="输入回复内容..."
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            rows={4}
            onPressEnter={(e) => {
              if (e.ctrlKey || e.metaKey) {
                handleSendReply();
              }
            }}
          />
          
          <Row justify="space-between" align="middle">
            <Col>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                按 Ctrl+Enter 快速发送
              </Text>
            </Col>
            <Col>
              <Space>
                <Button 
                  onClick={() => {
                    setReplyContent('');
                    setReplySubject('');
                  }}
                  disabled={!replyContent && !replySubject}
                >
                  清空
                </Button>
          <Button
            type="primary"
            icon={<SendOutlined />}
                  onClick={handleSendReply}
                  loading={sending}
                  disabled={!replyContent.trim()}
          >
                  发送回复
          </Button>
              </Space>
            </Col>
          </Row>
        </Space>
      </Card>

      {/* 设置模态框 */}
      <Modal
        title="会话设置"
        open={settingsModalVisible}
        onCancel={() => setSettingsModalVisible(false)}
        footer={null}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert
            message="会话设置"
            description="在这里可以配置会话的各种选项，如自动回复、通知设置等。"
            type="info"
            showIcon
          />
          
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Text type="secondary">功能开发中...</Text>
          </div>
        </Space>
      </Modal>

      {/* 删除确认模态框 */}
      <Modal
        title="删除会话"
        open={deleteModalVisible}
        onOk={handleDeleteConversation}
        onCancel={() => setDeleteModalVisible(false)}
        okText="确定删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
          >
        <Alert
          message="警告"
          description="删除会话将永久删除所有相关消息，此操作无法撤销。请确认是否继续？"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <Space direction="vertical">
          <Text>会话信息:</Text>
          <Text type="secondary">主题: {conversation.subject}</Text>
          <Text type="secondary">参与者: {conversation.sender_email} ↔ {conversation.recipient_email}</Text>
          <Text type="secondary">消息数量: {conversation.message_count} 条</Text>
            </Space>
      </Modal>

      {/* 回到顶部 */}
      <BackTop />
    </div>
  );
};

export default ConversationDetail; 