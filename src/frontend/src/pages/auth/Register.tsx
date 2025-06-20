import React, { useState } from 'react';
import { Form, Input, Button, Divider, Alert } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, UserAddOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface RegisterFormValues {
  username: string;
  email: string;
  name: string;
  password: string;
  confirmPassword: string;
}

const Register: React.FC = () => {
  const [form] = Form.useForm<RegisterFormValues>();
  const { register } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  
  // 处理表单提交
  const handleSubmit = async (values: RegisterFormValues) => {
    try {
      setLoading(true);
      setError('');
      
      // 去除确认密码字段，只发送需要的数据
      const { confirmPassword, ...registerData } = values;
      
      const success = await register(registerData);
      if (success) {
        navigate('/login', { 
          state: { 
            message: '注册成功，请登录',
            type: 'success'
          } 
        });
      }
    } catch (error) {
      setError('注册失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      
      <Form
        form={form}
        name="register"
        onFinish={handleSubmit}
        size="large"
      >
        <Form.Item
          name="username"
          rules={[
            { required: true, message: '请输入用户名' },
            { min: 3, message: '用户名至少3个字符' },
            { max: 50, message: '用户名最多50个字符' }
          ]}
        >
          <Input 
            prefix={<UserOutlined />} 
            placeholder="用户名" 
          />
        </Form.Item>
        
        <Form.Item
          name="email"
          rules={[
            { required: true, message: '请输入邮箱' },
            { type: 'email', message: '请输入有效的邮箱地址' }
          ]}
        >
          <Input 
            prefix={<MailOutlined />} 
            placeholder="邮箱" 
          />
        </Form.Item>

        <Form.Item
          name="name"
          rules={[
            { required: true, message: '请输入姓名' },
            { min: 2, message: '姓名至少2个字符' }
          ]}
        >
          <Input 
            prefix={<UserAddOutlined />} 
            placeholder="姓名" 
          />
        </Form.Item>
        
        <Form.Item
          name="password"
          rules={[
            { required: true, message: '请输入密码' },
            { min: 6, message: '密码至少6个字符' }
          ]}
        >
          <Input.Password 
            prefix={<LockOutlined />} 
            placeholder="密码" 
          />
        </Form.Item>
        
        <Form.Item
          name="confirmPassword"
          dependencies={['password']}
          rules={[
            { required: true, message: '请确认密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('两次输入的密码不一致'));
              },
            }),
          ]}
        >
          <Input.Password 
            prefix={<LockOutlined />} 
            placeholder="确认密码" 
          />
        </Form.Item>
        
        <Form.Item>
          <Button 
            type="primary" 
            htmlType="submit" 
            loading={loading}
            block
          >
            注册
          </Button>
        </Form.Item>
        
        <Divider />
        
        <div style={{ textAlign: 'center' }}>
          已有账号？ <Link to="/login">立即登录</Link>
        </div>
      </Form>
    </div>
  );
};

export default Register; 