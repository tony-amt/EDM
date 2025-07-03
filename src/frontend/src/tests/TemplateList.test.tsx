import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import TemplateList from '../pages/templates/TemplateList';
import axios from '../utils/axios';

// 模拟axios
jest.mock('../utils/axios');

// 模拟react-router-dom的useNavigate
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn()
}));

describe('模板列表组件', () => {
  const mockTemplates = {
    items: [
      {
        id: '1',
        name: '测试模板1',
        subject: '测试主题1',
        body: '<p>测试内容1</p>',
        created_at: '2023-03-01T12:00:00Z',
        updated_at: '2023-03-01T12:00:00Z'
      },
      {
        id: '2',
        name: '测试模板2',
        subject: '测试主题2',
        body: '<p>测试内容2</p>',
        created_at: '2023-03-02T12:00:00Z',
        updated_at: '2023-03-02T12:00:00Z'
      }
    ],
    current_page: 1,
    total_items: 2,
    total_pages: 1
  };

  beforeEach(() => {
    // 模拟axios.get返回数据
    (axios.get as jest.Mock).mockResolvedValue({ data: mockTemplates });
    // 模拟axios.delete
    (axios.delete as jest.Mock).mockResolvedValue({ data: { message: '删除成功' } });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('渲染模板列表页面', async () => {
    render(
      <BrowserRouter>
        <TemplateList />
      </BrowserRouter>
    );

    // 验证标题
    expect(screen.getByText('邮件模板管理')).toBeInTheDocument();
    // 验证搜索框
    expect(screen.getByPlaceholderText('搜索模板名称')).toBeInTheDocument();
    // 验证创建按钮
    expect(screen.getByText('创建模板')).toBeInTheDocument();

    // 等待模板数据加载
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/templates'), expect.any(Object));
    });

    // 验证模板数据显示
    await waitFor(() => {
      expect(screen.getByText('测试模板1')).toBeInTheDocument();
      expect(screen.getByText('测试模板2')).toBeInTheDocument();
    });
  });

  test('搜索功能', async () => {
    render(
      <BrowserRouter>
        <TemplateList />
      </BrowserRouter>
    );

    // 等待初始数据加载
    await waitFor(() => {
      expect(screen.getByText('测试模板1')).toBeInTheDocument();
    });

    // 清除mock调用记录
    (axios.get as jest.Mock).mockClear();

    // 输入搜索关键词
    const searchInput = screen.getByPlaceholderText('搜索模板名称');
    fireEvent.change(searchInput, { target: { value: '测试关键词' } });
    
    // 点击搜索按钮 (查找带搜索图标的按钮)
    const searchButtons = screen.getAllByRole('button');
    const searchButton = searchButtons.find(button => 
      button.className.includes('ant-input-search-button')
    );
    if (searchButton) {
      fireEvent.click(searchButton);
    }

    // 验证搜索请求
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/templates'),
        expect.objectContaining({
          params: expect.objectContaining({
            name: '测试关键词'
          })
        })
      );
    });
  });

  test('删除模板', async () => {
    render(
      <BrowserRouter>
        <TemplateList />
      </BrowserRouter>
    );

    // 等待模板数据加载
    await waitFor(() => {
      expect(screen.getByText('测试模板1')).toBeInTheDocument();
    });

    // 找到删除按钮并点击
    const deleteButtons = screen.getAllByRole('button').filter(
      button => button.className.includes('ant-btn-dangerous')
    );
    fireEvent.click(deleteButtons[0]);

    // 确认对话框应该出现，点击确认
    const confirmButton = await screen.findByText('确定');
    fireEvent.click(confirmButton);

    // 验证删除请求
    await waitFor(() => {
      expect(axios.delete).toHaveBeenCalledWith(expect.stringContaining('/templates/1'));
    });

    // 删除后应该重新加载数据
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(2);
    });
  });
}); 