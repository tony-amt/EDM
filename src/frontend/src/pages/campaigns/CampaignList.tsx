import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Input,
  Space,
  Tag,
  Popconfirm,
  message,
  Typography,
  Tooltip,
  Select
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  SearchOutlined
} from '@ant-design/icons';
import axios from '../../utils/axios';
import { API_URL } from '../../config/constants';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

// 定义活动状态类型和对应的展示样式
const campaignStatusMap: Record<string, { color: string; text: string }> = {
  'draft': { color: 'default', text: '草稿' },
  'active': { color: 'green', text: '活跃' },
  'paused': { color: 'orange', text: '暂停' },
  'completed': { color: 'blue', text: '已完成' },
  'cancelled': { color: 'red', text: '已取消' }
};

// 活动类型定义
interface Campaign {
  id: string;
  name: string;
  description: string;
  status: string;
  target_tags: string[];
  template_id: string;
  created_at: string;
  updated_at: string;
}

const CampaignList: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchText, setSearchText] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const navigate = useNavigate();

  // 获取活动列表
  const fetchCampaigns = async (page = 1, name = '', status = '') => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/campaigns`, {
        params: {
          page,
          limit: pagination.pageSize,
          name,
          status
        }
      });
      setCampaigns(response.data.items);
      setPagination({
        ...pagination,
        current: response.data.current_page,
        total: response.data.total_items
      });
    } catch (error) {
      console.error('获取活动列表失败', error);
      message.error('获取活动列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns(pagination.current, searchText, statusFilter);
  }, []);

  // 删除活动
  const handleDelete = async (id: string) => {
    try {
      await axios.delete(`${API_URL}/campaigns/${id}`);
      message.success('删除活动成功');
      fetchCampaigns(pagination.current, searchText, statusFilter);
    } catch (error) {
      console.error('删除活动失败', error);
      message.error('删除活动失败，可能该活动正在被使用');
    }
  };

  // 查看活动详情
  const handleView = (id: string) => {
    navigate(`/campaigns/${id}`);
  };

  // 编辑活动
  const handleEdit = (id: string) => {
    navigate(`/campaigns/edit/${id}`);
  };

  // 创建新活动
  const handleCreate = () => {
    navigate('/campaigns/create');
  };

  // 搜索
  const handleSearch = (value: string) => {
    setSearchText(value);
    fetchCampaigns(1, value, statusFilter);
  };

  // 状态筛选
  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    fetchCampaigns(1, searchText, value);
  };

  // 分页变化
  const handleTableChange = (pagination: any) => {
    setPagination(pagination);
    fetchCampaigns(pagination.current, searchText, statusFilter);
  };

  // 渲染状态标签
  const renderStatus = (status: string) => {
    const { color, text } = campaignStatusMap[status] || { color: 'default', text: status };
    return <Tag color={color}>{text}</Tag>;
  };

  // 表格列定义
  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => renderStatus(status)
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => new Date(text).toLocaleString('zh-CN')
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (text: string) => new Date(text).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Campaign) => (
        <Space size="middle">
          <Tooltip title="查看">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleView(record.id)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record.id)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Popconfirm
              title="确定要删除这个活动吗？"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}>营销活动管理</Title>
        <Space>
          <Select
            placeholder="状态筛选"
            allowClear
            style={{ width: 120 }}
            onChange={handleStatusChange}
            value={statusFilter || undefined}
          >
            {Object.entries(campaignStatusMap).map(([key, { text }]) => (
              <Option key={key} value={key}>{text}</Option>
            ))}
          </Select>
          <Search
            placeholder="搜索活动名称"
            onSearch={handleSearch}
            style={{ width: 250 }}
            allowClear
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            创建活动
          </Button>
        </Space>
      </div>
      
      <Table
        columns={columns}
        dataSource={campaigns}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
      />
    </div>
  );
};

export default CampaignList; 