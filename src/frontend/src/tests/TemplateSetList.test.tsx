import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom'; // 导入扩展匹配器
import { BrowserRouter } from 'react-router-dom';
import TemplateSetList from '../pages/templates/TemplateSetList';
import axios from '../utils/axios';

// 模拟axios
jest.mock('../utils/axios');

// 模拟react-router-dom的useNavigate
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn()
}));

describe('模板集列表组件', () => {
  const mockTemplateSets = {
    items: [
      {
        id: '1',
        name: '测试模板集1',
        item_count: 2,
        items: [
          { template_id: '101', template_name: '模板A', order: 1 },
          { template_id: '102', template_name: '模板B', order: 2 }
        ],
        created_at: '2023-03-01T12:00:00Z'
      },
      {
        id: '2',
        name: '测试模板集2',
        item_count: 1,
        items: [
          { template_id: '103', template_name: '模板C', order: 1 }
        ],
        created_at: '2023-03-02T12:00:00Z'
      }
    ],
    current_page: 1,
    total_items: 2,
    total_pages: 1
  };

  beforeEach(() => {
    // 模拟axios.get返回数据
    (axios.get as jest.Mock).mockResolvedValue({ data: mockTemplateSets });
    // 模拟axios.delete
    (axios.delete as jest.Mock).mockResolvedValue({ data: { message: '删除成功' } });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('渲染模板集列表页面', async () => {
    render(
      <BrowserRouter>
        <TemplateSetList />
      </BrowserRouter>
    );

    // 验证标题
    expect(screen.getByText('模板集管理')).toBeInTheDocument();
    // 验证搜索框
    expect(screen.getByPlaceholderText('搜索模板集名称')).toBeInTheDocument();
    // 验证创建按钮
    expect(screen.getByText('创建模板集')).toBeInTheDocument();

    // 等待模板集数据加载
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/template-sets'), expect.any(Object));
    });

    // 验证模板集数据显示
    await waitFor(() => {
      expect(screen.getByText('测试模板集1')).toBeInTheDocument();
      expect(screen.getByText('测试模板集2')).toBeInTheDocument();
      // 验证模板数量显示
      expect(screen.getByText('2')).toBeInTheDocument(); // 第一个模板集的模板数量
      expect(screen.getByText('1')).toBeInTheDocument(); // 第二个模板集的模板数量
    });
  });

  test('搜索功能', async () => {
    render(
      <BrowserRouter>
        <TemplateSetList />
      </BrowserRouter>
    );

    // 等待初始数据加载
    await waitFor(() => {
      expect(screen.getByText('测试模板集1')).toBeInTheDocument();
    });

    // 清除mock调用记录
    (axios.get as jest.Mock).mockClear();

    // 输入搜索关键词
    const searchInput = screen.getByPlaceholderText('搜索模板集名称');
    fireEvent.change(searchInput, { target: { value: '测试关键词' } });
    
    // 点击搜索按钮
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
        expect.stringContaining('/template-sets'),
        expect.objectContaining({
          params: expect.objectContaining({
            name: '测试关键词'
          })
        })
      );
    });
  });

  test('删除模板集', async () => {
    render(
      <BrowserRouter>
        <TemplateSetList />
      </BrowserRouter>
    );

    // 等待模板集数据加载
    await waitFor(() => {
      expect(screen.getByText('测试模板集1')).toBeInTheDocument();
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
      expect(axios.delete).toHaveBeenCalledWith(expect.stringContaining('/template-sets/1'));
    });

    // 删除后应该重新加载数据
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(2);
    });
  });
}); 