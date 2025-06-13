import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Space, 
  Modal, 
  message, 
  Input, 
  Form, 
  Typography,
  Tooltip,
  Popconfirm,
  Card,
  Tag
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  EyeOutlined, 
  CopyOutlined 
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from '../../utils/axios';
import { API_URL } from '../../config/constants';

const { Title, Text } = Typography;
const { Search } = Input;

interface TemplateSetItem {
  template_id: string;
  template_name: string;
  order: number;
}

interface TemplateSet {
  id: string;
  name: string;
  item_count: number;
  items: TemplateSetItem[];
  created_at: string;
}

const TemplateSetList: React.FC = () => {
  const [templateSets, setTemplateSets] = useState<TemplateSet[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchText, setSearchText] = useState<string>('');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const navigate = useNavigate();

  // 获取模板集列表
  const fetchTemplateSets = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/templates/sets`, {
        params: { 
          page: pagination.current,
          limit: pagination.pageSize,
          name: searchText
        }
      });
      
      if (response.data && response.data.data) {
        setTemplateSets(response.data.data);
        setPagination({
          current: response.data.pagination?.page || 1,
          pageSize: response.data.pagination?.limit || 10,
          total: response.data.pagination?.total || response.data.data.length
        });
      }
    } catch (error) {
      console.error('获取模板集失败:', error);
      message.error('获取模板集列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplateSets();
  }, []);

  // 删除模板集
  const handleDelete = async (id: string) => {
    try {
      await axios.delete(`${API_URL}/templates/sets/${id}`);
      message.success('删除成功');
      fetchTemplateSets();
    } catch (error) {
      console.error('删除失败', error);
      message.error('删除失败');
    }
  };

  // 查看模板集详情
  const handleView = (templateSet: TemplateSet) => {
    navigate(`/template-sets/${templateSet.id}`);
  };

  // 编辑模板集
  const handleEdit = (templateSet: TemplateSet) => {
    navigate(`/template-sets/edit/${templateSet.id}`);
  };

  // 创建新模板集
  const handleCreate = () => {
    navigate('/template-sets/create');
  };

  // 复制模板集
  const handleCopy = async (templateSet: TemplateSet) => {
    try {
      const response = await axios.get(`${API_URL}/templates/sets/${templateSet.id}`);
      const fullTemplateSet = response.data;
      
      const newTemplateSet = {
        name: `${templateSet.name} (副本)`,
        items: fullTemplateSet.items.map((item: any) => ({
          template_id: item.template_id,
          order: item.order
        }))
      };
      
      await axios.post(`${API_URL}/templates/sets`, newTemplateSet);
      message.success('复制模板集成功');
      fetchTemplateSets();
    } catch (error) {
      console.error('复制模板集失败', error);
      message.error('复制模板集失败');
    }
  };

  // 搜索
  const handleSearch = (value: string) => {
    setSearchText(value);
    fetchTemplateSets();
  };

  // 分页变化
  const handleTableChange = (pagination: any) => {
    setPagination(pagination);
    fetchTemplateSets();
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
      title: '模板数量',
      dataIndex: 'item_count',
      key: 'item_count',
      align: 'center' as const,
      render: (count: number) => (
        <Tag color={count > 0 ? 'blue' : 'default'}>
          {count} 个模板
        </Tag>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => new Date(text).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: TemplateSet) => (
        <Space size="middle">
          <Tooltip title="查看详情">
            <Button 
              type="text" 
              icon={<EyeOutlined />} 
              onClick={() => handleView(record)} 
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={() => handleEdit(record)} 
            />
          </Tooltip>
          <Tooltip title="复制">
            <Button 
              type="text" 
              icon={<CopyOutlined />} 
              onClick={() => handleCopy(record)} 
            />
          </Tooltip>
          <Tooltip title="删除">
            <Popconfirm
              title="确定要删除这个模板集吗？"
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
        <Title level={4}>模板集管理</Title>
        <Space>
          <Search
            placeholder="搜索模板集名称"
            onSearch={handleSearch}
            style={{ width: 250 }}
            allowClear
          />
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            创建模板集
          </Button>
        </Space>
      </div>
      
      <Card>
        <Table
          columns={columns}
          dataSource={templateSets}
          rowKey="id"
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
        />
      </Card>
    </div>
  );
};

export default TemplateSetList; 