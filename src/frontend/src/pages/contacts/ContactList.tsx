import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  MoreOutlined,
  PlusOutlined,
  SearchOutlined,
  UploadOutlined
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Dropdown,
  Input,
  message,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography
} from 'antd';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import ContactImport from '../../components/contacts/ContactImport';
import contactService, { Contact, QueryParams } from '../../services/contact.service';
import tagService from '../../services/tag.service';
import { RootState } from '../../store';
import { batchDeleteContacts, deleteContact, setSelectedContactIds } from '../../store/contact.slice';

const { Title } = Typography;
const { confirm } = Modal;
const { Option } = Select;

interface SearchParams {
  page: number;
  limit: number;
  search?: string;
  tags?: string;
  status?: string;
}

const ContactList: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // 使用本地状态管理联系人数据，而不是Redux
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  });

  const { selectedContactIds } = useSelector((state: RootState) => state.contacts);

  const [searchParams, setSearchParams] = useState<SearchParams>({
    page: 1,
    limit: 50
  });
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);

  // 加载联系人列表 - 使用直接API调用
  const loadContacts = async (params: SearchParams) => {
    try {
      setLoading(true);
      const queryParams: QueryParams = {
        ...params,
        include_child_tags: false // 联系人管理页面不显示二级标签
      };
      const response = await contactService.getContacts(queryParams);
      setContacts(response.data);
      setPagination(response.pagination);
    } catch (error) {
      console.error('获取联系人失败:', error);
      message.error('获取联系人失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取标签列表（只获取一级标签）
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await tagService.getTags({ include_child_tags: false });
        const tags = response.data
          .sort((a: any, b: any) => {
            const timeA = new Date(a.createdAt || a.created_at || 0).getTime();
            const timeB = new Date(b.createdAt || b.created_at || 0).getTime();
            return timeB - timeA; // 倒序排序
          });
        setAvailableTags(tags);
      } catch (error) {
        console.error('获取标签列表失败:', error);
      }
    };

    fetchTags();
  }, []);

  // 使用useEffect的依赖优化，避免无限循环
  useEffect(() => {
    loadContacts(searchParams);
  }, [searchParams.page, searchParams.limit, searchParams.search, searchParams.tags, searchParams.status]);

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
            loadContacts(searchParams); // 重新加载列表
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
            loadContacts(searchParams); // 重新加载列表
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
    loadContacts(searchParams); // 重新加载列表
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
      render: (_: any, record: any) => {
        if (!record.tags || record.tags.length === 0) {
          return <span style={{ color: '#999' }}>-</span>;
        }

        // 创建一个Set来去重标签名称，只显示1级标签
        const uniqueTagNames = new Set<string>();
        const displayTags: any[] = [];

        record.tags.forEach((tag: any) => {
          let displayName = '';
          let tagColor = '';
          let tagId = '';

          // 如果是子标签（有父标签），使用父标签信息
          if (tag.parent_name) {
            displayName = tag.parent_name;
            tagColor = tag.parent_color || tag.color;
            tagId = tag.parent_id || tag.id;
          }
          // 如果是1级标签（没有父标签），直接使用
          else if (!tag.parent_id && !tag.parentId) {
            displayName = tag.name;
            tagColor = tag.color;
            tagId = tag.id;
          }
          // 跳过其他情况（比如有parent_id但没有parent_name的标签）

          // 只有当标签名称存在且未添加过时才添加
          if (displayName && !uniqueTagNames.has(displayName)) {
            uniqueTagNames.add(displayName);
            displayTags.push({
              name: displayName,
              color: tagColor,
              id: tagId
            });
          }
        });

        return (
          <Space size={[0, 8]} wrap>
            {displayTags.map((displayTag, index) => (
              <Tag color={displayTag.color} key={`${displayTag.id}_${index}`}>
                {displayTag.name}
              </Tag>
            ))}
          </Space>
        );
      },
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
        loading={loading}
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