import React, { useState } from 'react';
import {
  Card,
  Avatar,
  Typography,
  Space,
  Button,
  Dropdown,
  Menu,
  Tooltip,
  notification,
  Tag
} from 'antd';
import {
  UserOutlined,
  MoreOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  CopyOutlined,
  MailOutlined,
  FlagOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { ConversationMessage } from '../../types/api';

const { Text } = Typography;

interface MessageItemProps {
  message: ConversationMessage;
  searchQuery?: string;
  onReply?: (message: ConversationMessage) => void;
  onDelete?: (messageId: string) => void;
  onFlag?: (messageId: string) => void;
}

const MessageItem: React.FC<MessageItemProps> = ({
  message,
  searchQuery,
  onReply,
  onDelete,
  onFlag
}) => {
  const [actionVisible, setActionVisible] = useState(false);
  const isOutbound = message.direction === 'outbound';
  const isHighlighted = searchQuery && (
    (message.content_text || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    message.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 高亮搜索文本
  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  };

  // 复制消息内容
  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message.content_text || '');
    notification.success({ message: '消息内容已复制到剪贴板' });
  };

  // 消息操作菜单
  const actionMenu = (
    <Menu>
      <Menu.Item key="copy" icon={<CopyOutlined />} onClick={handleCopyMessage}>
        复制内容
      </Menu.Item>
      {!isOutbound && (
        <Menu.Item key="reply" icon={<MailOutlined />} onClick={() => onReply?.(message)}>
          回复
        </Menu.Item>
      )}
      <Menu.Item key="flag" icon={<FlagOutlined />} onClick={() => onFlag?.(message.id)}>
        标记重要
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="delete" icon={<DeleteOutlined />} danger onClick={() => onDelete?.(message.id)}>
        删除消息
      </Menu.Item>
    </Menu>
  );

  // 获取状态显示
  const getStatusDisplay = () => {
    switch (message.status) {
      case 'sent':
        return { text: '已发送', color: 'blue' };
      case 'delivered':
        return { text: '已送达', color: 'green' };
      case 'read':
        return { text: '已读', color: 'cyan' };
      case 'failed':
        return { text: '发送失败', color: 'red' };
      case 'draft':
        return { text: '草稿', color: 'orange' };
      default:
        return { text: '未知', color: 'default' };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div
      style={{
        marginBottom: 16,
        display: 'flex',
        justifyContent: isOutbound ? 'flex-end' : 'flex-start',
        backgroundColor: isHighlighted ? '#fff7e6' : 'transparent',
        padding: isHighlighted ? '8px' : '0',
        borderRadius: isHighlighted ? '8px' : '0'
      }}
    >
      <div
        style={{
          maxWidth: '70%',
          backgroundColor: isOutbound ? '#1890ff' : '#f5f5f5',
          color: isOutbound ? 'white' : 'black',
          padding: '12px 16px',
          borderRadius: '12px',
          borderBottomRightRadius: isOutbound ? '4px' : '12px',
          borderBottomLeftRadius: isOutbound ? '12px' : '4px',
          position: 'relative'
        }}
        onMouseEnter={() => setActionVisible(true)}
        onMouseLeave={() => setActionVisible(false)}
      >
        {/* 消息状态指示器 */}
        <div style={{ 
          position: 'absolute', 
          top: '8px', 
          right: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          {isOutbound && message.status === 'read' && (
            <Tooltip title="已读">
              <CheckCircleOutlined style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px' }} />
            </Tooltip>
          )}
          {isOutbound && message.status !== 'read' && (
            <Tooltip title="未读">
              <SyncOutlined style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }} />
            </Tooltip>
          )}
          
          {/* 操作按钮 */}
          {actionVisible && (
            <Dropdown overlay={actionMenu} trigger={['click']} placement="bottomRight">
              <Button
                type="text"
                size="small"
                icon={<MoreOutlined />}
                style={{ 
                  color: isOutbound ? 'rgba(255,255,255,0.8)' : '#666',
                  minWidth: 'auto',
                  padding: '0 4px'
                }}
              />
            </Dropdown>
          )}
        </div>

        {/* 发件人信息 */}
        <div style={{ marginBottom: 8, marginRight: '30px' }}>
          <Space>
            <Avatar 
              size="small" 
              icon={<UserOutlined />} 
              style={{ backgroundColor: isOutbound ? '#096dd9' : '#87d068' }}
            />
            <Text strong style={{ color: isOutbound ? 'white' : 'black' }}>
              {isOutbound ? '我' : message.from_email}
            </Text>
            <Text 
              type="secondary" 
              style={{ 
                fontSize: '12px',
                color: isOutbound ? 'rgba(255,255,255,0.8)' : '#999'
              }}
            >
              {new Date(message.sent_at).toLocaleString()}
            </Text>
          </Space>
        </div>
        
        {/* 主题 */}
        {message.subject && (
          <div style={{ marginBottom: 8 }}>
            <Text strong style={{ color: isOutbound ? 'white' : 'black' }}>
              {searchQuery ? (
                <span dangerouslySetInnerHTML={{ 
                  __html: highlightText(message.subject, searchQuery) 
                }} />
              ) : message.subject}
            </Text>
          </div>
        )}
        
        {/* 消息内容 */}
        <div 
          style={{ 
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: isOutbound ? 'white' : 'black',
            lineHeight: '1.6',
            marginBottom: 8
          }}
        >
          {message.content_html ? (
            <div 
              dangerouslySetInnerHTML={{ 
                __html: searchQuery ? highlightText(message.content_html, searchQuery) : message.content_html 
              }} 
              style={{ 
                color: isOutbound ? 'white' : 'black' 
              }}
            />
          ) : (
            searchQuery && message.content_text ? (
              <span dangerouslySetInnerHTML={{ 
                __html: highlightText(message.content_text, searchQuery) 
              }} />
            ) : (message.content_text || '')
          )}
        </div>
        
        {/* 状态标签和时间信息 */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginTop: 8
        }}>
          <Tag color={statusDisplay.color}>
            {statusDisplay.text}
          </Tag>
          
          {message.delivered_at && (
            <Text 
              style={{ 
                fontSize: '11px',
                color: isOutbound ? 'rgba(255,255,255,0.6)' : '#999'
              }}
            >
              送达: {new Date(message.delivered_at).toLocaleString()}
            </Text>
          )}
          
          {message.read_at && (
            <Text 
              style={{ 
                fontSize: '11px',
                color: isOutbound ? 'rgba(255,255,255,0.6)' : '#999'
              }}
            >
              已读: {new Date(message.read_at).toLocaleString()}
            </Text>
          )}
        </div>
        
        {/* 错误信息 */}
        {message.error_message && (
          <div style={{ 
            marginTop: 8,
            padding: 8,
            backgroundColor: 'rgba(255,77,79,0.1)',
            borderRadius: 4,
            border: '1px solid rgba(255,77,79,0.3)'
          }}>
            <Text type="danger" style={{ fontSize: 12 }}>
              错误: {message.error_message}
            </Text>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageItem; 