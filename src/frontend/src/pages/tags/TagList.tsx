import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Input,
  Space,
  Tag,
  Modal,
  Form,
  message,
  Typography,
  Tooltip,
  Card,
  Row,
  Col,
  ColorPicker,
  List,
  Avatar
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  UserOutlined
} from '@ant-design/icons';
import type { Color } from 'antd/es/color-picker';
import tagService, { Tag as TagType } from '../../services/tag.service';
import axios from '../../utils/axios';
import { API_URL } from '../../config/constants';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;
const { confirm } = Modal;

const TagList: React.FC = () => {
  const [tags, setTags] = useState<TagType[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isContactsModalVisible, setIsContactsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editingTag, setEditingTag] = useState<TagType | null>(null);
  const [colorHex, setColorHex] = useState<string>('#1677ff');
  const [tagContacts, setTagContacts] = useState<any[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [selectedTagName, setSelectedTagName] = useState<string>('');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total: number, range: [number, number]) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条标签`
  });

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async (page: number = 1, pageSize: number = 10) => {
    setLoading(true);
    try {
      const response = await tagService.getTags();
      const allTags = response.data;
      
      // 实现分页
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const pagedTags = allTags.slice(startIndex, endIndex);
      
      // 🔧 使用后端返回的contact_count字段
      const tagsWithCount = pagedTags.map((tag: any) => ({
        ...tag,
        count: parseInt(tag.contact_count) || 0
      }));
      
      // 更新分页信息
      setTags(tagsWithCount);
      setPagination({
        current: page,
        pageSize: pageSize,
        total: allTags.length,
        showSizeChanger: true,
        showQuickJumper: true,
        showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条标签`
      });
    } catch (error) {
      console.error('获取标签失败:', error);
      message.error('获取标签列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 🔧 修复：查看标签关联的联系人
  const handleViewContacts = async (tag: TagType) => {
    setSelectedTagName(tag.name);
    setContactsLoading(true);
    setIsContactsModalVisible(true);
    
    try {
      const response = await axios.get(`${API_URL}/tags/${tag.id}/contacts`);
      setTagContacts(response.data.data?.contacts || []);
    } catch (error) {
      console.error('获取标签联系人失败:', error);
      message.error('获取标签联系人失败');
      setTagContacts([]);
    } finally {
      setContactsLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
  };

  const filteredTags = tags.filter(tag => 
    tag.name.toLowerCase().includes(searchText.toLowerCase()) ||
    (tag.description && tag.description.toLowerCase().includes(searchText.toLowerCase()))
  );

  const showModal = (tag?: TagType) => {
    if (tag) {
      setEditingTag(tag);
      setColorHex(tag.color || '#1677ff');
      form.setFieldsValue({
        name: tag.name,
        description: tag.description || '',
        color: tag.color || '#1677ff'
      });
    } else {
      setEditingTag(null);
      setColorHex('#1677ff');
      form.resetFields();
    }
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      values.color = colorHex;
      
      setLoading(true);
      if (editingTag) {
        await tagService.updateTag(editingTag.id, values);
        message.success('标签更新成功');
      } else {
        await tagService.createTag(values);
        message.success('标签创建成功');
      }
      
      setIsModalVisible(false);
      form.resetFields();
      fetchTags(pagination.current, pagination.pageSize);
    } catch (error: any) {
      console.error('保存标签失败:', error);
      message.error('保存标签失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: '确定要删除此标签吗？删除后将影响已关联的联系人。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setLoading(true);
        try {
          await tagService.deleteTag(id);
          message.success('标签删除成功');
          fetchTags(pagination.current, pagination.pageSize);
        } catch (error: any) {
          console.error('删除标签失败:', error);
          message.error('删除标签失败: ' + (error.response?.data?.message || error.message));
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleColorChange = (color: Color) => {
    setColorHex(color.toHexString());
  };

  const columns = [
    {
      title: '标签颜色',
      dataIndex: 'color',
      key: 'color',
      width: 100,
      render: (color: string) => (
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: color,
            display: 'inline-block'
          }}
        />
      ),
    },
    {
      title: '标签名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: TagType) => (
        <Tag color={record.color}>{text}</Tag>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => text || '-',
    },
    {
      title: '使用数量',
      dataIndex: 'count',
      key: 'count',
      render: (count: number, record: TagType) => (
        <Space>
          <span>{count || 0}</span>
          {(count || 0) > 0 && (
            <Tooltip title="查看关联联系人">
              <Button 
                icon={<EyeOutlined />} 
                type="text" 
                size="small"
                onClick={() => handleViewContacts(record)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: TagType) => (
        <Space size="middle">
          <Tooltip title="编辑">
            <Button icon={<EditOutlined />} type="text" onClick={() => showModal(record)} />
          </Tooltip>
          <Tooltip title="删除">
            <Button 
              icon={<DeleteOutlined />} 
              type="text" 
              danger 
              onClick={() => handleDelete(record.id)} 
              disabled={(record.count || 0) > 0}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Title level={4}>标签管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => showModal()}>
          创建标签
        </Button>
      </div>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <Input
            placeholder="搜索标签名称或描述"
            prefix={<SearchOutlined />}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ width: 300 }}
          />
        </div>

        <Table
          columns={columns}
          dataSource={filteredTags}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            onChange: (page, pageSize) => {
              fetchTags(page, pageSize);
            },
            onShowSizeChange: (current, size) => {
              fetchTags(1, size);
            }
          }}
        />
      </Card>

      {/* 创建/编辑标签模态框 */}
      <Modal
        title={editingTag ? '编辑标签' : '创建标签'}
        open={isModalVisible}
        onOk={handleSubmit}
        onCancel={handleCancel}
        confirmLoading={loading}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="标签名称"
            rules={[{ required: true, message: '请输入标签名称' }]}
          >
            <Input placeholder="请输入标签名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea placeholder="请输入标签描述" rows={3} />
          </Form.Item>

          <Form.Item label="标签颜色">
            <ColorPicker
              value={colorHex}
              onChange={handleColorChange}
              showText
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 🔧 新增：查看联系人模态框 */}
      <Modal
        title={`标签「${selectedTagName}」关联的联系人`}
        open={isContactsModalVisible}
        onCancel={() => setIsContactsModalVisible(false)}
        footer={null}
        width={600}
      >
        <List
          loading={contactsLoading}
          dataSource={tagContacts}
          renderItem={(contact: any) => (
            <List.Item>
              <List.Item.Meta
                avatar={<Avatar icon={<UserOutlined />} />}
                title={contact.email}
                description={
                  <Space>
                    <span>用户名: {contact.username || '未设置'}</span>
                    <span>创建时间: {contact.created_at ? new Date(contact.created_at).toLocaleString('zh-CN') : '未知'}</span>
                  </Space>
                }
              />
            </List.Item>
          )}
          locale={{ emptyText: '暂无关联的联系人' }}
        />
      </Modal>
    </div>
  );
};

export default TagList; 