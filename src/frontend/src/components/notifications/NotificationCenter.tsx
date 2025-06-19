import React, { useState, useEffect } from 'react';
import {
  Badge,
  Dropdown,
  Button,
  List,
  Card,
  Typography,
  Space,
  Empty,
  Avatar,
  Divider,
  Tooltip,
  Tag
} from 'antd';
import {
  BellOutlined,
  MailOutlined,
  DeleteOutlined,
  EyeOutlined,
  SettingOutlined,
  ClearOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import webSocketService, { NotificationData } from '../../services/websocket.service';

const { Text, Title } = Typography;

interface NotificationItem extends NotificationData {
  read: boolean;
  createdAt: string;
}

const NotificationCenter: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [visible, setVisible] = useState(false);

  // 添加新通知
  const addNotification = (notification: NotificationData) => {
    const newNotification: NotificationItem = {
      ...notification,
      read: false,
      createdAt: new Date().toISOString()
    };

    setNotifications(prev => [newNotification, ...prev.slice(0, 49)]); // 最多保留50条
    setUnreadCount(prev => prev + 1);

    // 显示桌面通知
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.id,
      });
    }

    // 自动消失的通知
    if (notification.auto_dismiss && notification.dismiss_after) {
      setTimeout(() => {
        removeNotification(notification.id);
      }, notification.dismiss_after);
    }
  };

  // 标记通知为已读
  const markAsRead = (notificationId: string) => {
    setNotifications(prev => prev.map(n => 
      n.id === notificationId ? { ...n, read: true } : n
    ));
    
    // 更新未读计数
    const notification = notifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
    setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  // 删除通知
  const removeNotification = (notificationId: string) => {
    const notification = notifications.find(n => n.id === notificationId);
      if (notification && !notification.read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
      }
      
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  // 清空所有通知
  const clearAllNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  // 标记全部已读
  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  // 处理通知点击
  const handleNotificationClick = (notification: NotificationItem) => {
      markAsRead(notification.id);

    // 根据通知类型跳转到相应页面
    if (notification.conversation_id) {
      navigate(`/conversations/${notification.conversation_id}`);
    } else if (notification.message_id) {
      // 可以跳转到具体消息
      navigate(`/conversations/${notification.conversation_id}#${notification.message_id}`);
    }

    setVisible(false);
  };

  // 获取通知图标
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_message':
        return <MailOutlined style={{ color: '#1890ff' }} />;
      case 'success':
        return <Avatar size="small" style={{ backgroundColor: '#52c41a' }}>✓</Avatar>;
      case 'warning':
        return <Avatar size="small" style={{ backgroundColor: '#faad14' }}>!</Avatar>;
      case 'error':
        return <Avatar size="small" style={{ backgroundColor: '#ff4d4f' }}>✗</Avatar>;
      default:
        return <Avatar size="small" style={{ backgroundColor: '#1890ff' }}>i</Avatar>;
    }
  };

  // 获取通知颜色
  const getNotificationColor = (type: string) => {
    const colors = {
      info: '#1890ff',
      success: '#52c41a',
      warning: '#faad14',
      error: '#ff4d4f'
    };
    return colors[type as keyof typeof colors] || colors.info;
  };

  // 格式化时间
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return date.toLocaleDateString();
  };

  // WebSocket事件监听
  useEffect(() => {
    const handleNotification = (data: NotificationData) => {
      addNotification(data);
    };

    webSocketService.on('notification', handleNotification);

    return () => {
      webSocketService.off('notification', handleNotification);
    };
  }, []);

  // 通知列表内容
  const notificationContent = (
    <Card
      style={{ width: 400, maxHeight: 600, overflow: 'auto' }}
      bodyStyle={{ padding: 0 }}
    >
      <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={5} style={{ margin: 0 }}>
            通知中心
          </Title>
          <Space>
            {unreadCount > 0 && (
              <Button type="link" size="small" onClick={markAllAsRead}>
                全部已读
              </Button>
            )}
            <Button 
              type="text"
              size="small" 
              icon={<ClearOutlined />}
              onClick={clearAllNotifications}
              title="清空通知"
            />
          </Space>
        </div>
        {unreadCount > 0 && (
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {unreadCount} 条未读消息
          </Text>
        )}
      </div>

      {notifications.length === 0 ? (
          <Empty 
            description="暂无通知"
          style={{ padding: '40px 20px' }}
          />
      ) : (
        <List
          itemLayout="horizontal"
          dataSource={notifications}
          renderItem={(notification) => (
            <List.Item
              style={{ 
                padding: '12px 16px',
                backgroundColor: notification.read ? 'transparent' : '#f6ffed',
                borderLeft: notification.read ? 'none' : `3px solid ${getNotificationColor(notification.type)}`,
                cursor: 'pointer'
              }}
              onClick={() => handleNotificationClick(notification)}
              actions={[
                <Tooltip title="删除">
                <Button
                    type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                      removeNotification(notification.id);
                  }}
                />
                </Tooltip>
              ]}
            >
              <List.Item.Meta
                avatar={getNotificationIcon(notification.type)}
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong={!notification.read}>
                      {notification.title}
                    </Text>
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      {formatTime(notification.createdAt)}
                    </Text>
                  </div>
                }
                description={
                  <div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {notification.message}
                    </Text>
                                         {notification.type !== 'info' && (
                                             <Tag 
                         color={getNotificationColor(notification.type)}
                         style={{ marginTop: '4px', fontSize: '11px' }}
                       >
                         {notification.type}
                       </Tag>
                     )}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  );

  return (
    <Dropdown
      overlay={notificationContent}
      trigger={['click']}
      placement="bottomRight"
      visible={visible}
      onVisibleChange={setVisible}
    >
      <Badge count={unreadCount} size="small" offset={[-6, 6]}>
      <Button 
        type="text" 
          icon={<BellOutlined />}
          style={{ fontSize: '16px' }}
        />
          </Badge>
    </Dropdown>
  );
};

export default NotificationCenter; 