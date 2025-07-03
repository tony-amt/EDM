import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Form, Input, Button, Card, message, Typography, Layout } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { login, clearError } from '../store/auth.slice';
import { RootState } from '../store';

const { Title } = Typography;
const { Content } = Layout;

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { isLoggedIn, isLoading, error } = useSelector((state: RootState) => state.auth);
  const [form] = Form.useForm();

  // 获取重定向路径
  const from = (location.state as any)?.from?.pathname || '/contacts';

  useEffect(() => {
    // 如果已登录，重定向到主页
    if (isLoggedIn) {
      navigate(from, { replace: true });
    }
  }, [isLoggedIn, navigate, from]);

  useEffect(() => {
    // 显示错误信息
    if (error) {
      message.error(error);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  const onFinish = (values: any) => {
    dispatch(login(values) as any);
  };

  return (
    <Layout style={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
      <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Card style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Title level={2} style={{ marginBottom: 8 }}>A.MT 邮件系统</Title>
            <Typography.Text type="secondary">登录您的账户</Typography.Text>
          </div>

          <Form
            form={form}
            name="login"
            initialValues={{ remember: true }}
            onFinish={onFinish}
            size="large"
            layout="vertical"
          >
            <Form.Item
              name="usernameOrEmail"
              rules={[{ required: true, message: '请输入用户名或邮箱' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="用户名或邮箱" />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="密码" />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" style={{ width: '100%' }} loading={isLoading}>
                登录
              </Button>
            </Form.Item>

            <div style={{ textAlign: 'center' }}>
              <Typography.Text type="secondary">
                首次使用? 请联系管理员
              </Typography.Text>
            </div>
          </Form>
        </Card>
      </Content>
    </Layout>
  );
};

export default Login; 