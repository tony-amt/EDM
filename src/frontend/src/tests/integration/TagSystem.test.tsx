import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { message } from 'antd';
import TagManagement from '../../pages/tags/TagManagement';
import TagTreeSelector from '../../components/tags/TagTreeSelector';
import ABTestModal from '../../components/tags/ABTestModal';
import tagService from '../../services/tag.service';

// Mock services
jest.mock('../../services/tag.service');
const mockTagService = tagService as jest.Mocked<typeof tagService>;

// Mock antd message
jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  message: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock data
const mockTagTree = [
  {
    id: '1',
    name: '客户分类',
    color: '#1890ff',
    description: '客户分类标签',
    contact_count: 10,
    parent_id: null,
    children: [
      {
        id: '2',
        name: 'VIP客户',
        color: '#f50',
        description: 'VIP客户标签',
        contact_count: 5,
        parent_id: '1',
        children: []
      },
      {
        id: '3',
        name: '普通客户',
        color: '#87d068',
        description: '普通客户标签',
        contact_count: 5,
        parent_id: '1',
        children: []
      }
    ]
  }
];

describe('标签系统集成测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock responses
    mockTagService.getTagTree.mockResolvedValue({
      success: true,
      data: mockTagTree
    });
    
    mockTagService.createTag.mockResolvedValue({
      success: true,
      data: { id: '4', name: '新标签', color: '#1890ff' }
    });
    
    mockTagService.updateTag.mockResolvedValue({
      success: true,
      data: { id: '1', name: '更新的标签', color: '#1890ff' }
    });
    
    mockTagService.deleteTag.mockResolvedValue({
      success: true
    });
  });

  const renderWithRouter = (component: React.ReactElement) => {
    return render(
      <BrowserRouter>
        {component}
      </BrowserRouter>
    );
  };

  describe('TagManagement 组件测试', () => {
    test('应该正确渲染标签管理', async () => {
      renderWithRouter(<TagManagement />);

      await waitFor(() => {
        expect(screen.getByText('标签管理')).toBeInTheDocument();
      });

      expect(mockTagService.getTagTree).toHaveBeenCalledTimes(1);
    });

    test('应该显示创建标签按钮', async () => {
      renderWithRouter(<TagManagement />);

      await waitFor(() => {
        expect(screen.getByText('创建标签')).toBeInTheDocument();
      });
    });
  });

  describe('TagTreeSelector 组件测试', () => {
    test('应该正确渲染标签选择器', async () => {
      const mockOnChange = jest.fn();

      render(
        <TagTreeSelector
          value={[]}
          onChange={mockOnChange}
          multiple={true}
          showSearch={true}
          showCount={true}
        />
      );

      expect(mockTagService.getTagTree).toHaveBeenCalledTimes(1);
    });
  });

  describe('ABTestModal 组件测试', () => {
    test('应该正确渲染A/B测试模态框', () => {
      const mockOnCancel = jest.fn();
      const mockOnFinish = jest.fn();

      render(
        <ABTestModal
          visible={true}
          tagId="1"
          tagName="测试标签"
          contactCount={5}
          onCancel={mockOnCancel}
          onSuccess={mockOnFinish}
        />
      );

      expect(screen.getByText('A/B 测试分组')).toBeInTheDocument();
    });
  });
}); 