import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Button, Typography, Badge } from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  TagsOutlined,
  FileTextOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  KeyOutlined,
  SettingOutlined,
  BellOutlined,
  FundOutlined,
  ScheduleOutlined,
  MailOutlined
} from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { logout } from '../store/auth.slice';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);

  const handleLogout = () => {
    dispatch(logout() as any);
    navigate('/login');
  };

  const items = [
    {
      key: '/profile',
      label: '个人资料',
      icon: <UserOutlined />,
      onClick: () => navigate('/profile')
    },
    {
      key: '/change-password',
      label: '修改密码',
      icon: <KeyOutlined />,
      onClick: () => navigate('/change-password')
    },
    { 
      type: 'divider' as const 
    },
    {
      key: 'logout',
      label: '退出登录',
      icon: <LogoutOutlined />,
      onClick: handleLogout
    }
  ];

  // 从路径中获取当前选择的菜单项
  const getSelectedKey = () => {
    const path = location.pathname;
    if (path.startsWith('/contacts')) return ['contacts'];
    if (path.startsWith('/tags')) return ['tags'];
    if (path.startsWith('/templates')) return ['templates'];
    if (path.startsWith('/template-sets')) return ['template-sets'];
    if (path.startsWith('/campaigns')) return ['campaigns'];
    if (path.startsWith('/tasks')) return ['tasks'];
    if (path.startsWith('/users')) return ['users'];
    return ['dashboard'];
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed} style={{ backgroundColor: '#001529' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px', color: 'white' }}>
          <MailOutlined style={{ fontSize: collapsed ? '24px' : '32px', marginRight: collapsed ? '0' : '8px' }} />
          {!collapsed && <Title level={4} style={{ margin: 0, color: 'white' }}>EDM系统</Title>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={getSelectedKey()}
          items={[
            {
              key: 'contacts',
              icon: <TeamOutlined />,
              label: <Link to="/contacts">联系人管理</Link>
            },
            {
              key: 'tags',
              icon: <TagsOutlined />,
              label: <Link to="/tags">标签管理</Link>
            },
            {
              key: 'templates',
              icon: <FileTextOutlined />,
              label: <Link to="/templates">模板管理</Link>
            },
            {
              key: 'template-sets',
              icon: <FileTextOutlined />,
              label: <Link to="/template-sets">模板集管理</Link>
            },
            {
              key: 'campaigns',
              icon: <FundOutlined />,
              label: <Link to="/campaigns">营销活动</Link>
            },
            {
              key: 'tasks',
              icon: <ScheduleOutlined />,
              label: <Link to="/tasks">邮件任务</Link>
            },
            user && user.role === 'admin' ? {
              key: 'users',
              icon: <SettingOutlined />,
              label: <Link to="/users">用户管理</Link>
            } : null,
          ].filter(Boolean)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Badge count={0} style={{ marginRight: 24 }}>
              <BellOutlined style={{ fontSize: 18 }} />
            </Badge>
            <Dropdown menu={{ items }} placement="bottomRight">
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <Avatar icon={<UserOutlined />} />
                <span style={{ marginLeft: 8 }}>{user?.name || '用户'}</span>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, background: '#fff', minHeight: 280, overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout; 