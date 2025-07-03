import React from 'react';
import { Layout, Typography } from 'antd';

const { Content, Footer } = Layout;
const { Title } = Typography;

/**
 * 认证页面布局组件
 * 用于登录和注册页面
 */
const AuthLayout = ({ children }) => {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Content style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center',
        padding: '50px 0',
        background: '#f0f2f5'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2}>EDM系统</Title>
          <p>电子邮件营销管理平台</p>
        </div>
        
        {children}
      </Content>
      
      <Footer style={{ textAlign: 'center' }}>
        EDM系统 ©{new Date().getFullYear()} - 电子邮件营销管理平台
      </Footer>
    </Layout>
  );
};

export default AuthLayout; 