import React, { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

interface LoginFormValues {
  username: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  token: string;
  data: any;
  message?: string;
}

const Login: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const navigate = useNavigate();
  
  const onFinish = async (values: LoginFormValues) => {
    try {
      setLoading(true);
      
      // 将 username 重命名为 usernameOrEmail 以匹配后端API
      const backendValues = {
        usernameOrEmail: values.username,
        password: values.password
      };
      
      const response = await api.post<LoginResponse>('/auth/login', backendValues);
      
      if (response.data.success) {
        // 保存令牌到本地存储
        localStorage.setItem('token', response.data.token);
        
        // 保存用户信息 (从 response.data.data 获取)
        localStorage.setItem('user', JSON.stringify(response.data.data));
        
        message.success('登录成功');
        
        // 🔧 修复页面跳转问题：使用window.location强制跳转
        // 确保页面完全重新加载，避免React路由的认证状态缓存问题
        setTimeout(() => {
          window.location.href = '/';
        }, 100);
      } else {
        message.error(response.data.message || '登录失败');
      }
    } catch (error) {
      console.error('登录错误:', error);
      message.error('登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      background: '#f0f2f5'
    }}>
      <Card 
        title="EDM系统登录" 
        style={{ width: 400 }}
        bordered={false}
      >
      <Form
        name="login"
        initialValues={{ remember: true }}
        onFinish={onFinish}
      >
        <Form.Item
          name="username"
          rules={[{ required: true, message: '请输入用户名或邮箱' }]}
        >
          <Input 
            prefix={<UserOutlined />} 
            placeholder="用户名或邮箱" 
            size="large"
          />
        </Form.Item>
        
        <Form.Item
          name="password"
          rules={[{ required: true, message: '请输入密码' }]}
        >
          <Input.Password 
            prefix={<LockOutlined />} 
            placeholder="密码" 
            size="large"
          />
        </Form.Item>
        
        <Form.Item>
          <Button 
            type="primary" 
            htmlType="submit" 
            loading={loading}
            style={{ width: '100%' }}
            size="large"
          >
            登录
          </Button>
        </Form.Item>
      </Form>
      </Card>
    </div>
  );
};

export default Login; 