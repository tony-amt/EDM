import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Typography,
  Input,
  Tooltip,
  Popconfirm,
  message,
  Tag,
  Modal,
  Card,
  Badge
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  CopyOutlined,
  FileDoneOutlined,
  PictureOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from '../../utils/axios';
import { API_URL } from '../../config/constants';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  created_at: string;
  updated_at: string;
}

const TemplateList: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchText, setSearchText] = useState<string>('');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [previewVisible, setPreviewVisible] = useState<boolean>(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const navigate = useNavigate();

  // 获取模板列表
  const fetchTemplates = async (page = 1, searchName = '') => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/templates`, {
        params: {
          page,
          limit: pagination.pageSize,
          name: searchName
        }
      });
      setTemplates(response.data.items);
      setPagination({
        ...pagination,
        current: response.data.current_page,
        total: response.data.total_items
      });
    } catch (error) {
      console.error('获取模板列表失败', error);
      message.error('获取模板列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates(pagination.current, searchText);
  }, []);

  // 删除模板
  const handleDelete = async (id: string) => {
    try {
      await axios.delete(`${API_URL}/templates/${id}`);
      message.success('删除模板成功');
      fetchTemplates(pagination.current, searchText);
    } catch (error) {
      console.error('删除模板失败', error);
      message.error('删除模板失败，可能该模板正在被使用');
    }
  };

  // 查看模板详情
  const handleView = (id: string) => {
    navigate(`/templates/${id}`);
  };

  // 编辑模板
  const handleEdit = (id: string) => {
    navigate(`/templates/edit/${id}`);
  };

  // 创建新模板
  const handleCreate = () => {
    navigate('/templates/create');
  };

  // 搜索
  const handleSearch = (value: string) => {
    setSearchText(value);
    fetchTemplates(1, value);
  };

  // 分页变化
  const handleTableChange = (pagination: any) => {
    setPagination(pagination);
    fetchTemplates(pagination.current, searchText);
  };

  // 复制模板
  const handleCopy = async (template: Template) => {
    try {
      const newTemplate = {
        name: `${template.name} (副本)`,
        subject: template.subject,
        body: template.body
      };
      await axios.post(`${API_URL}/templates`, newTemplate);
      message.success('复制模板成功');
      fetchTemplates(pagination.current, searchText);
    } catch (error) {
      console.error('复制模板失败', error);
      message.error('复制模板失败');
    }
  };

  // 预览模板
  const handlePreview = (template: Template) => {
    setPreviewTemplate(template);
    setPreviewVisible(true);
  };

  // 表格列定义
  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
      width: '20%'
    },
    {
      title: '邮件主题',
      dataIndex: 'subject',
      key: 'subject',
      ellipsis: true,
      width: '30%'
    },
    {
      title: '内容预览',
      dataIndex: 'body',
      key: 'body',
      ellipsis: true,
      render: (html: string) => (
        <Tooltip title="点击预览完整内容">
          <div 
            style={{ cursor: 'pointer', color: '#1890ff' }}
            onClick={() => handlePreview({ body: html } as Template)}
          >
            {html.replace(/<[^>]+>/g, '').substring(0, 50)}...
          </div>
        </Tooltip>
      ),
      width: '20%'
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
      width: '15%'
    },
    {
      title: '操作',
      key: 'action',
      width: '15%',
      render: (_: any, record: Template) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleView(record.id)}
            />
          </Tooltip>
          <Tooltip title="预览">
            <Button
              type="text"
              icon={<PictureOutlined />}
              onClick={() => handlePreview(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record.id)}
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
              title="确定要删除这个模板吗？"
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
        <Title level={4}>邮件模板管理</Title>
        <Space>
          <Search
            placeholder="搜索模板名称"
            onSearch={handleSearch}
            style={{ width: 250 }}
            allowClear
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
            data-testid="create-template-btn"
            className="create-template-button"
          >
            创建模板
          </Button>
        </Space>
      </div>
      
      <Card>
        <Table
          columns={columns}
          dataSource={templates}
          rowKey="id"
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
        />
      </Card>

      <Modal
        title="模板预览"
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        width={700}
      >
        {previewTemplate && (
          <div>
            {previewTemplate.subject && (
              <div style={{ marginBottom: 16 }}>
                <Text strong>邮件主题：</Text> {previewTemplate.subject}
              </div>
            )}
            <div
              style={{ 
                border: '1px solid #eee', 
                padding: 16, 
                borderRadius: 4, 
                minHeight: 300,
                maxHeight: 600,
                overflow: 'auto'
              }}
              dangerouslySetInnerHTML={{ __html: previewTemplate.body }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TemplateList; 