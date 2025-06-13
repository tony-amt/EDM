import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from '../pages/auth/Login';

// 模拟login函数
const mockLogin = jest.fn();

// 模拟AuthContext
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin
  })
}));

// 模拟react-router-dom
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useLocation: () => ({
    state: { from: { pathname: '/' } }
  })
}));

describe('登录组件', () => {
  beforeEach(() => {
    // 清除mock状态
    mockLogin.mockReset();
    
    // 配置login函数的行为
    mockLogin.mockImplementation((credentials) => {
      if (credentials.username === 'testuser' && credentials.password === 'password123') {
        return Promise.resolve(true);
      } else {
        return Promise.reject(new Error('登录失败'));
      }
    });
    
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
  });

  test('渲染登录表单', () => {
    // 验证表单元素存在
    expect(screen.getByPlaceholderText('用户名或邮箱')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('密码')).toBeInTheDocument();
    expect(screen.getByLabelText('记住我')).toBeInTheDocument();
    expect(screen.getByText('登 录')).toBeInTheDocument();
    expect(screen.getByText('立即注册')).toBeInTheDocument();
  });

  test('空表单提交应显示验证错误', async () => {
    // 点击登录按钮但不填写表单
    fireEvent.click(screen.getByText('登 录'));
    
    // 等待并验证错误消息 - 使用正则表达式匹配
    await waitFor(() => {
      expect(screen.getByText(/请输入用户名或邮箱/)).toBeInTheDocument();
      expect(screen.getByText(/请输入密码/)).toBeInTheDocument();
    });
  });

  test('提交有效凭据应调用登录函数', async () => {
    // 填写表单
    fireEvent.change(screen.getByPlaceholderText('用户名或邮箱'), {
      target: { value: 'testuser' }
    });
    
    fireEvent.change(screen.getByPlaceholderText('密码'), {
      target: { value: 'password123' }
    });
    
    // 点击登录按钮
    fireEvent.click(screen.getByText('登 录'));
    
    // 验证登录函数被调用
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled();
      expect(mockLogin).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'password123',
        remember: true
      });
    });
  });

  test('登录失败时应显示错误消息', async () => {
    // 填写错误的凭据
    fireEvent.change(screen.getByPlaceholderText('用户名或邮箱'), {
      target: { value: 'wronguser' }
    });
    
    fireEvent.change(screen.getByPlaceholderText('密码'), {
      target: { value: 'wrongpassword' }
    });
    
    // 点击登录按钮
    fireEvent.click(screen.getByText('登 录'));
    
    // 验证错误消息 - 使用正则表达式匹配
    await waitFor(() => {
      expect(screen.getByText(/登录失败/)).toBeInTheDocument();
    });
  });
}); 