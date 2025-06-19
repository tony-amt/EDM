import React, { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, theme, Button, Space, Input } from 'antd';
import { 
  UserOutlined, 
  TagOutlined, 
  MailOutlined, 
  DashboardOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  CarryOutOutlined,
  SendOutlined,
  CloudServerOutlined,
  UsergroupAddOutlined,
  SettingOutlined,
  MessageOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import NotificationCenter from '../components/notifications/NotificationCenter';
import AdvancedSearch from '../components/conversations/AdvancedSearch';
import webSocketService from '../services/websocket.service';

const { Header, Sider, Content } = Layout;

/**
 * 应用主布局组件
 */
const AppLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  let user = {}; // Default to an empty object
  const userString = localStorage.getItem('user');
  if (userString) {
    try {
      const parsedUser = JSON.parse(userString);
      // Ensure parsedUser is an object, not null or other primitives if JSON.parse succeeded with such
      if (parsedUser && typeof parsedUser === 'object') {
        user = parsedUser;
      }
    } catch (e) {
      console.error('Error parsing user from localStorage:', e);
      // Optional: remove invalid item
      // localStorage.removeItem('user'); 
    }
  }
  
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };
  
  const userMenu = [
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
      onClick: handleLogout
    }
  ];

  // 检查用户权限
  const isAdmin = user.role === 'admin';

  // WebSocket连接管理 - 暂时禁用
  useEffect(() => {
    // 暂时禁用WebSocket连接，避免生产环境错误
    console.log('WebSocket功能暂时禁用');
    
    // const token = localStorage.getItem('token');
    // if (token && !webSocketService.isConnected()) {
    //   webSocketService.connect(token);
    //   webSocketService.requestNotificationPermission();
    //   webSocketService.startHeartbeat();
    // }

    return () => {
      // 组件卸载时断开连接
      // webSocketService.disconnect();
    };
  }, []);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed}>
        <div className="logo" style={{ 
          height: 32, 
          margin: 16, 
          color: 'white', 
          fontSize: 18,
          textAlign: 'center',
          overflow: 'hidden'
        }}>
          {collapsed ? 'EDM' : 'EDM系统'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={[
            {
              key: '/',
              icon: <DashboardOutlined />,
              label: <Link to="/">仪表盘</Link>,
            },
            {
              key: '/contacts',
              icon: <UserOutlined />,
              label: <Link to="/contacts">联系人管理</Link>,
            },
            {
              key: '/tags',
              icon: <TagOutlined />,
              label: <Link to="/tags">标签管理</Link>,
            },
            {
              key: '/tasks',
              icon: <CarryOutOutlined />,
              label: <Link to="/tasks">任务管理</Link>,
            },
            {
              key: '/templates',
              icon: <MailOutlined />,
              label: <Link to="/templates">模板管理</Link>,
            },
            {
              key: '/conversations',
              icon: <MessageOutlined />,
              label: <Link to="/conversations">会话管理</Link>,
            },
            // V2.0 新增功能菜单
            {
              key: 'email-management',
              icon: <SendOutlined />,
              label: '发件管理',
              children: [
                {
                  key: '/senders',
                  icon: <UserOutlined />,
                  label: <Link to="/senders">发信人管理</Link>,
                },
              ],
            },
            // 管理员专用菜单
            ...(isAdmin ? [
              {
                key: 'system-management',
                icon: <SettingOutlined />,
                label: '系统管理',
                children: [
                  {
                    key: '/email-services',
                    icon: <CloudServerOutlined />,
                    label: <Link to="/email-services">邮件服务</Link>,
                  },
                  {
                    key: '/user-management',
                    icon: <UsergroupAddOutlined />,
                    label: <Link to="/user-management">用户管理</Link>,
                  },
                  {
                    key: '/user-quotas',
                    icon: <MailOutlined />,
                    label: <Link to="/user-quotas">额度管理</Link>,
                  },
                  {
                    key: '/service-associations',
                    icon: <CloudServerOutlined />,
                    label: <Link to="/service-associations">服务关联</Link>,
                  },
                ],
              }
            ] : []),
          ]}
        />
      </Sider>
      <Layout>
        <Header style={{ 
          padding: 0, 
          background: colorBgContainer,
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            {React.createElement(collapsed ? MenuUnfoldOutlined : MenuFoldOutlined, {
              className: 'trigger',
              onClick: () => setCollapsed(!collapsed),
              style: { fontSize: 18, padding: '0 24px', cursor: 'pointer' }
            })}
          </div>
          <div style={{ marginRight: 24 }}>
            <Space>
              <Button 
                type="text" 
                icon={<SearchOutlined />}
                onClick={() => setSearchVisible(true)}
                style={{ fontSize: '16px' }}
              />
              <NotificationCenter />
            <Dropdown menu={{ items: userMenu }} placement="bottomRight">
              <span style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} /> 
                {!collapsed && <span style={{ marginLeft: 8 }}>{user.name || user.username || '用户'}</span>}
              </span>
          </Dropdown>
            </Space>
          </div>
        </Header>
        <Content
          style={{
            margin: '24px 16px',
            padding: 24, 
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            overflow: 'auto'
          }}
        >
            <Outlet />
        </Content>
      </Layout>
      
      {/* 高级搜索模态框 */}
      <AdvancedSearch 
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
      />
    </Layout>
  );
};

export default AppLayout;