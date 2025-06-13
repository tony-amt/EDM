import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Input,
  Space,
  Tag,
  Dropdown,
  Modal,
  message,
  Typography,
  Tooltip,
  Select,
  Card,
  Row,
  Col,
  Menu
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  DownloadOutlined,
  UploadOutlined,
  MoreOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { fetchContacts, deleteContact, batchDeleteContacts, setSelectedContactIds } from '../../store/contact.slice';
import { RootState } from '../../store';
import ContactImport from '../../components/contacts/ContactImport';
import contactService from '../../services/contact.service';
import tagService from '../../services/tag.service';

const { Title } = Typography;
const { confirm } = Modal;
const { Option } = Select;

// 模拟数据
const mockContacts = [
  {
    _id: '1',
    email: 'john.doe@example.com',
    username: 'johndoe',
    tikTokId: 'johndoe_tiktok',
    insId: 'johndoe_ins',
    youtubeId: '',
    tags: [{ _id: '1', name: '重要客户', color: 'red' }],
    status: 'active'
  },
  {
    _id: '2',
    email: 'jane.smith@example.com',
    username: 'janesmith',
    tikTokId: '',
    insId: 'janesmith_ins',
    youtubeId: 'UCxxx',
    tags: [{ _id: '2', name: '潜在客户', color: 'blue' }],
    status: 'inactive'
  }
];

const ContactList: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { contacts, isLoading, pagination, selectedContactIds } = useSelector((state: RootState) => state.contacts);
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [searchParams, setSearchParams] = useState({
    search: '',
    tags: '',
    status: '',
    page: 1,
    limit: 10
  });

  // 加载标签列表
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await tagService.getTagTree();
        // 扁平化标签树，只获取一级标签，按创建时间倒序排序
        const flatTags = response.data
          .filter((tag: any) => !tag.parent_id && !tag.parentId)
          .sort((a: any, b: any) => {
            const timeA = new Date(a.createdAt || 0).getTime();
            const timeB = new Date(b.createdAt || 0).getTime();
            return timeB - timeA; // 倒序排序
          });
        setAvailableTags(flatTags);
      } catch (error) {
        console.error('获取标签列表失败:', error);
      }
    };
    
    fetchTags();
  }, []);

  // 加载联系人列表
  useEffect(() => {
    dispatch(fetchContacts(searchParams) as any);
  }, [dispatch, searchParams]);

  // 处理查看联系人详情
  const handleViewContact = (id: string) => {
    navigate(`/contacts/${id}`);
  };

  // 处理编辑联系人
  const handleEditContact = (id: string) => {
    navigate(`/contacts/edit/${id}`);
  };

  // 处理删除联系人
  const handleDeleteContact = (id: string) => {
    confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: '确定要删除此联系人吗？此操作不可逆。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk() {
        dispatch(deleteContact(id) as any)
          .then(() => {
        message.success('联系人删除成功');
            dispatch(fetchContacts(searchParams) as any);
          })
          .catch((error: any) => {
            message.error('删除失败: ' + error.message);
          });
      }
    });
  };

  // 处理批量删除
  const handleBatchDelete = () => {
    if (selectedContactIds.length === 0) {
      message.warning('请选择至少一个联系人');
      return;
    }

    confirm({
      title: '确认批量删除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除选中的 ${selectedContactIds.length} 个联系人吗？此操作不可逆。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk() {
        dispatch(batchDeleteContacts(selectedContactIds) as any)
          .then(() => {
        message.success(`成功删除 ${selectedContactIds.length} 个联系人`);
            dispatch(setSelectedContactIds([]));
            dispatch(fetchContacts(searchParams) as any);
          })
          .catch((error: any) => {
            message.error('批量删除失败: ' + error.message);
          });
      }
    });
  };

  // 处理导出联系人
  const handleExport = () => {
    contactService.exportContacts(searchParams);
    message.success('导出任务已开始，请稍后');
  };

  // 处理导入完成
  const handleImportFinished = (result: any) => {
    setIsImportModalVisible(false);
    message.success(`成功导入 ${result.imported} 个联系人, 失败 ${result.failed} 个`);
    dispatch(fetchContacts(searchParams) as any);
  };

  // 处理导入联系人
  const handleImport = () => {
    setIsImportModalVisible(true);
  };

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchParams({
      ...searchParams,
      search: value,
      page: 1
    });
  };

  // 处理状态筛选
  const handleStatusChange = (value: string) => {
    setSearchParams({
      ...searchParams,
      status: value,
      page: 1
    });
  };

  // 处理标签筛选
  const handleTagsChange = (value: string[]) => {
    setSearchParams({
      ...searchParams,
      tags: value.join(','),
      page: 1
    });
  };

  // 处理分页变化
  const handlePageChange = (page: number, pageSize?: number) => {
    setSearchParams({
      ...searchParams,
      page,
      limit: pageSize || searchParams.limit
    });
  };

  // 表格列定义
  const columns = [
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      render: (text: string) => <a>{text}</a>,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '社交媒体ID',
      key: 'socialMedia',
      render: (_: any, record: any) => (
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          {record.tikTokId && (
            <div>
              <Tag color="magenta">TikTok</Tag> {record.tikTokId}
            </div>
          )}
          {record.insId && (
            <div>
              <Tag color="purple">Instagram</Tag> {record.insId}
            </div>
          )}
          {record.youtubeId && (
            <div>
              <Tag color="red">YouTube</Tag> {record.youtubeId}
            </div>
          )}
        </Space>
      ),
    },
    {
      title: '标签',
      key: 'tags',
      render: (_: any, record: any) => (
        <Space size={[0, 8]} wrap>
          {record.tags && record.tags.map((tag: any) => (
            <Tag color={tag.color} key={tag.id || tag._id}>
              {tag.name}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'green';
        let text = '正常';
        
        switch (status) {
          case 'active':
            color = 'green';
            text = '正常';
            break;
          case 'inactive':
            color = 'orange';
            text = '未激活';
            break;
          case 'bounced':
            color = 'red';
            text = '退信';
            break;
          case 'unsubscribed':
            color = 'gray';
            text = '已退订';
            break;
          case 'complained':
            color = 'volcano';
            text = '投诉';
            break;
        }
        
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="middle">
          <Tooltip title="查看">
            <Button icon={<EyeOutlined />} type="text" onClick={() => handleViewContact(record.id)} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button icon={<EditOutlined />} type="text" onClick={() => handleEditContact(record.id)} />
          </Tooltip>
          <Tooltip title="删除">
            <Button icon={<DeleteOutlined />} type="text" danger onClick={() => handleDeleteContact(record.id)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 批量操作菜单
  const batchActionItems = [
    {
      key: 'export',
      label: '导出所选',
      icon: <DownloadOutlined />,
      onClick: handleExport
    },
    {
      key: 'delete',
      label: '删除所选',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: handleBatchDelete
    }
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4}>联系人管理</Title>
        </Col>
        <Col>
          <Space>
            <Input
              placeholder="搜索联系人"
              prefix={<SearchOutlined />}
              style={{ width: 200 }}
              allowClear
              onChange={(e) => handleSearch(e.target.value)}
            />
            <Button
              icon={<UploadOutlined />}
              onClick={handleImport}
            >
              导入联系人
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/contacts/create')}
              data-testid="create-contact-btn"
              className="create-contact-button"
            >
              创建联系人
            </Button>
          </Space>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={8}>
            <Input
              placeholder="搜索邮箱、用户名或社交媒体ID"
              prefix={<SearchOutlined />}
              allowClear
              value={searchParams.search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </Col>
          <Col span={8}>
            <Select
              placeholder="按状态筛选"
              style={{ width: '100%' }}
              allowClear
              value={searchParams.status || undefined}
              onChange={handleStatusChange}
            >
              <Option value="active">正常</Option>
              <Option value="inactive">未激活</Option>
              <Option value="bounced">退信</Option>
              <Option value="unsubscribed">已退订</Option>
              <Option value="complained">投诉</Option>
            </Select>
          </Col>
          <Col span={8}>
            <Select
              placeholder="按标签筛选"
              style={{ width: '100%' }}
              allowClear
              mode="multiple"
              value={searchParams.tags ? searchParams.tags.split(',') : []}
              onChange={handleTagsChange}
            >
              {availableTags.map((tag) => (
                <Option key={tag.id} value={tag.id}>
                  <Space>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: tag.color || '#1677ff',
                        display: 'inline-block'
                      }}
                    />
                    {tag.name}
                  </Space>
                </Option>
              ))}
            </Select>
          </Col>
        </Row>
      </Card>

      <Table
        rowKey="id"
        dataSource={contacts}
        columns={columns}
        loading={isLoading}
        rowSelection={{
          selectedRowKeys: selectedContactIds,
          onChange: (selectedRowKeys) => {
            dispatch(setSelectedContactIds(selectedRowKeys as string[]));
          }
        }}
        pagination={{
          current: pagination.page,
          pageSize: pagination.limit,
          total: pagination.total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 个联系人`,
          onChange: handlePageChange,
          onShowSizeChange: (_, size) => {
            setSearchParams({
              ...searchParams,
              limit: size,
              page: 1
            });
          }
        }}
        footer={() => (
          <Row justify="space-between" align="middle">
            <Col>
              {selectedContactIds.length > 0 && (
                <Space>
                  <span>已选择 {selectedContactIds.length} 项</span>
                  <Dropdown menu={{ items: batchActionItems }}>
                    <Button>
                      批量操作 <MoreOutlined />
                    </Button>
                  </Dropdown>
                </Space>
              )}
            </Col>
          </Row>
        )}
      />

      {/* 导入联系人模态框 */}
      <ContactImport
        visible={isImportModalVisible}
        onCancel={() => setIsImportModalVisible(false)}
        onFinished={handleImportFinished}
      />
    </div>
  );
};

export default ContactList; 