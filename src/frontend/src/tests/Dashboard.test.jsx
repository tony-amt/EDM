import React from 'react';
import { render, screen } from '@testing-library/react';
import Dashboard from '../pages/Dashboard';

// 模拟AuthContext
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      name: '测试用户',
      username: 'testuser',
      email: 'test@example.com'
    }
  })
}));

// 模拟Ant Design组件
jest.mock('antd', () => {
  const antd = jest.requireActual('antd');
  const MockStatistic = ({ title, value }) => (
    <div data-testid="mock-statistic">
      <div>{title}</div>
      <div>{value}</div>
    </div>
  );
  return {
    ...antd,
    Card: ({ title, children }) => (
      <div data-testid="mock-card">
        <div>{title}</div>
        <div>{children}</div>
      </div>
    ),
    Row: ({ children }) => <div data-testid="mock-row">{children}</div>,
    Col: ({ children }) => <div data-testid="mock-col">{children}</div>,
    Statistic: MockStatistic
  };
});

describe('仪表板组件', () => {
  beforeEach(() => {
    render(<Dashboard />);
  });

  test('显示欢迎消息', () => {
    expect(screen.getByText(/测试用户/i)).toBeInTheDocument();
  });

  test('显示统计卡片', () => {
    const cards = screen.getAllByTestId('mock-card');
    expect(cards.length).toBeGreaterThan(0);
    
    // 检查统计标题是否存在
    expect(screen.getByText('联系人数量')).toBeInTheDocument();
    expect(screen.getByText('邮件发送量')).toBeInTheDocument();
  });

  test('应该显示统计卡片', () => {
    // 检查是否显示所有统计卡片标题
    expect(screen.getByText('联系人数量')).toBeInTheDocument();
    expect(screen.getByText('标签数量')).toBeInTheDocument();
    expect(screen.getByText('邮件发送量')).toBeInTheDocument();
    expect(screen.getByText('平均打开率')).toBeInTheDocument();
    expect(screen.getByText('总任务数')).toBeInTheDocument();
    expect(screen.getByText('已完成任务')).toBeInTheDocument();
    expect(screen.getByText('进行中任务')).toBeInTheDocument();
  });

  test('应该显示任务表格', () => {
    // 检查表格标题
    expect(screen.getByText('最近任务')).toBeInTheDocument();

    // 检查表格列标题
    expect(screen.getByText('任务名称')).toBeInTheDocument();
    expect(screen.getByText('状态')).toBeInTheDocument();
    expect(screen.getByText('发送数量')).toBeInTheDocument();
    expect(screen.getByText('打开率')).toBeInTheDocument();
    expect(screen.getByText('点击率')).toBeInTheDocument();
    expect(screen.getByText('计划日期')).toBeInTheDocument();

    // 检查任务数据
    expect(screen.getByText('新客户跟进邮件')).toBeInTheDocument();
    expect(screen.getByText('双十一活动推广')).toBeInTheDocument();
    expect(screen.getByText('新产品发布通知')).toBeInTheDocument();

    // 检查状态标签
    expect(screen.getByText('已完成')).toBeInTheDocument();
    expect(screen.getByText('进行中')).toBeInTheDocument();
    expect(screen.getByText('待执行')).toBeInTheDocument();
  });

  test('应该正确显示任务统计数据', () => {
    // 检查模拟数据中的任务数值是否正确显示
    const taskDates = screen.getAllByText(/2023-11-\d+/);
    expect(taskDates.length).toBe(3); // 应该有3个任务日期

    // 检查特定任务的发送数量
    expect(screen.getByText('156')).toBeInTheDocument(); // 第一个任务的发送数量
    expect(screen.getByText('78')).toBeInTheDocument();  // 第二个任务的发送数量
  });
}); 