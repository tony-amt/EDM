import React, { useState, useEffect } from 'react';
import {
  Button,
  Table,
  Card,
  message,
  Space,
  Tooltip,
  Tag,
  Input,
  Select,
  Modal
} from 'antd';
import {
  UserOutlined,
  CrownOutlined,
  SearchOutlined,
  EditOutlined,
  DollarOutlined
} from '@ant-design/icons';
import userManagementService, { UserInfo } from '../../services/user-management.service';
import AllocateQuotaModal from './AllocateQuotaModal';
import EditUserModal from './EditUserModal';

const { Search } = Input;
const { Option } = Select;

const UserList: React.FC = () => {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  const [searchText, setSearchText] = useState('');
  const [allocateModalVisible, setAllocateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null);

  // 获取用户列表
  const fetchUsers = async (page = 1, limit = 20, search?: string) => {
    setLoading(true);
    try {
      const response = await userManagementService.getList({
        page,
        limit,
        search
      });
      if (response.success && response.data) {
        setUsers(response.data.users);
        setPagination(prev => ({
          ...prev,
          current: response.data!.pagination.page,
          total: response.data!.pagination.total
        }));
      } else {
        message.error('获取用户列表失败');
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 搜索用户
  const handleSearch = (value: string) => {
    setSearchText(value);
    fetchUsers(1, pagination.pageSize, value);
  };

  // 分页变化
  const handleTableChange = (paginationInfo: any) => {
    fetchUsers(paginationInfo.current, paginationInfo.pageSize, searchText);
  };

  // 分配额度
  const handleAllocateQuota = (user: UserInfo) => {
    setSelectedUser(user);
    setAllocateModalVisible(true);
  };

  // 编辑用户
  const handleEditUser = (user: UserInfo) => {
    setSelectedUser(user);
    setEditModalVisible(true);
  };

  // 操作成功回调
  const handleSuccess = () => {
    setAllocateModalVisible(false);
    setEditModalVisible(false);
    setSelectedUser(null);
    fetchUsers(pagination.current, pagination.pageSize, searchText);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // 获取角色标签
  const getRoleTag = (role: string) => {
    return role === 'admin' ? (
      <Tag color="gold" icon={<CrownOutlined />}>管理员</Tag>
    ) : (
      <Tag color="blue" icon={<UserOutlined />}>普通用户</Tag>
    );
  };

  // 获取额度状态标签
  const getQuotaStatusTag = (quota: number) => {
    if (quota === 0) {
      return <Tag color="red">无额度</Tag>;
    }
    if (quota < 100) {
      return <Tag color="orange">额度不足</Tag>;
    }
    return <Tag color="green">额度充足</Tag>;
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (username: string, record: UserInfo) => (
        <Space>
          <UserOutlined />
          <span>{username}</span>
          {getRoleTag(record.role)}
        </Space>
      ),
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '剩余额度',
      dataIndex: 'remaining_quota',
      key: 'remaining_quota',
      render: (quota: number) => (
        <Space>
          <span style={{ fontWeight: 'bold' }}>
            {quota.toLocaleString()}
          </span>
          {getQuotaStatusTag(quota)}
        </Space>
      ),
    },
    {
      title: '群发统计',
      key: 'campaigns',
      render: (_: any, record: UserInfo) => (
        <div>
          <div>总计: {record.total_campaigns || 0}</div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            完成: {record.completed_campaigns || 0}
          </div>
        </div>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: UserInfo) => (
        <Space>
          <Tooltip title="编辑用户">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEditUser(record)}
            />
          </Tooltip>
          <Tooltip title="分配额度">
            <Button
              type="text"
              icon={<DollarOutlined />}
              onClick={() => handleAllocateQuota(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="user-list">
      <Card
        title="用户管理"
        extra={
          <Space>
            <Search
              placeholder="搜索用户名或邮箱"
              allowClear
              onSearch={handleSearch}
              style={{ width: 250 }}
            />
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`,
          }}
          onChange={handleTableChange}
        />
      </Card>

      <AllocateQuotaModal
        visible={allocateModalVisible}
        user={selectedUser}
        onCancel={() => {
          setAllocateModalVisible(false);
          setSelectedUser(null);
        }}
        onSuccess={handleSuccess}
      />

      <EditUserModal
        visible={editModalVisible}
        user={selectedUser}
        onCancel={() => {
          setEditModalVisible(false);
          setSelectedUser(null);
        }}
        onSuccess={handleSuccess}
      />
    </div>
  );
};

export default UserList; 