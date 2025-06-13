import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Switch,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  message,
  Typography,
  Popconfirm,
  Avatar,
  Tooltip
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  ReloadOutlined,
  EyeOutlined,
  LockOutlined,
  UnlockOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'inactive';
  remainingQuota: number;
  totalQuotaUsed: number;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UserListResponse {
  success: boolean;
  data: {
    items: User[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  // 获取用户列表
  const fetchUsers = async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        ...(roleFilter && { role: roleFilter }),
        ...(statusFilter && { status: statusFilter })
      });

      const response = await fetch(`/api/users?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        // 转换用户数据格式
        const users = (result.data || []).map((user: any) => ({
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          status: user.is_active ? 'active' : 'inactive',
          remainingQuota: user.remaining_quota || 0,
          totalQuotaUsed: 0, // 可以后续计算
          lastLoginAt: user.last_login_at || null,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }));
        
        setUsers(users);
        setPagination({
          current: result.pagination?.page || 1,
          pageSize: result.pagination?.limit || 20,
          total: result.pagination?.total || users.length,
        });
      } else {
        message.error('获取用户列表失败');
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
      message.error('网络请求失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 创建用户
  const handleCreateUser = async (values: any) => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: values.username,
          email: values.email,
          password: values.password,
          role: values.role,
          initialQuota: values.initialQuota || 0
        }),
      });

      const result = await response.json();

      if (result.success) {
        message.success('用户创建成功');
        setCreateModalVisible(false);
        form.resetFields();
        fetchUsers(pagination.current, pagination.pageSize);
      } else {
        message.error(result.error?.message || '创建失败');
      }
    } catch (error) {
      console.error('创建用户失败:', error);
      message.error('操作失败，请重试');
    }
  };

  // 更新用户
  const handleUpdateUser = async (values: any) => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: values.username,
          email: values.email,
          role: values.role,
          ...(values.password && { password: values.password })
        }),
      });

      const result = await response.json();

      if (result.success) {
        message.success('用户更新成功');
        setEditModalVisible(false);
        setSelectedUser(null);
        editForm.resetFields();
        fetchUsers(pagination.current, pagination.pageSize);
      } else {
        message.error(result.error?.message || '更新失败');
      }
    } catch (error) {
      console.error('更新用户失败:', error);
      message.error('操作失败，请重试');
    }
  };

  // 切换用户状态
  const handleToggleStatus = async (userId: string, newStatus: 'active' | 'inactive') => {
    try {
      const response = await fetch(`/api/users/${userId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const result = await response.json();

      if (result.success) {
        message.success(`用户${newStatus === 'active' ? '启用' : '禁用'}成功`);
        fetchUsers(pagination.current, pagination.pageSize);
      } else {
        message.error(result.error?.message || '操作失败');
      }
    } catch (error) {
      console.error('用户状态切换失败:', error);
      message.error('操作失败，请重试');
    }
  };

  // 删除用户
  const handleDeleteUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        message.success('用户删除成功');
        fetchUsers(pagination.current, pagination.pageSize);
      } else {
        message.error(result.error?.message || '删除失败');
      }
    } catch (error) {
      console.error('删除用户失败:', error);
      message.error('操作失败，请重试');
    }
  };

  // 重置密码
  const handleResetPassword = async (userId: string) => {
    try {
      const response = await fetch(`/api/users/${userId}/reset-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        Modal.info({
          title: '密码重置成功',
          content: `新密码为：${result.data.newPassword}`,
          okText: '确定'
        });
      } else {
        message.error(result.error?.message || '重置失败');
      }
    } catch (error) {
      console.error('重置密码失败:', error);
      message.error('操作失败，请重试');
    }
  };

  // 编辑用户
  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    editForm.setFieldsValue({
      username: user.username,
      email: user.email,
      role: user.role
    });
    setEditModalVisible(true);
  };

  // 表格列配置
  const columns: ColumnsType<User> = [
    {
      title: '用户信息',
      key: 'userInfo',
      width: 200,
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Avatar icon={<UserOutlined />} style={{ marginRight: 8 }} />
          <div>
            <div style={{ fontWeight: 'bold' }}>{record.username}</div>
            <div style={{ fontSize: '12px', color: '#666' }}>{record.email}</div>
          </div>
        </div>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role) => (
        <Tag color={role === 'admin' ? 'red' : 'blue'}>
          {role === 'admin' ? '管理员' : '普通用户'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={status === 'active' ? 'success' : 'default'}>
          {status === 'active' ? '活跃' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '额度信息',
      key: 'quota',
      width: 150,
      render: (_, record) => (
        <div>
          <div>剩余: <Text strong style={{ color: '#52c41a' }}>{record.remainingQuota}</Text></div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            已用: {record.totalQuotaUsed}
          </div>
        </div>
      ),
    },
    {
      title: '最后登录',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      width: 150,
      render: (time) => time ? dayjs(time).format('MM-DD HH:mm') : '从未登录',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (time) => dayjs(time).format('MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEditUser(record)}
            />
          </Tooltip>
          
          <Tooltip title="重置密码">
            <Button
              type="link"
              icon={<LockOutlined />}
              onClick={() => handleResetPassword(record.id)}
            />
          </Tooltip>
          
          <Tooltip title={record.status === 'active' ? '禁用用户' : '启用用户'}>
            <Switch
              checked={record.status === 'active'}
              size="small"
              onChange={(checked) => handleToggleStatus(record.id, checked ? 'active' : 'inactive')}
            />
          </Tooltip>
          
          <Popconfirm
            title="确定要删除这个用户吗？"
            onConfirm={() => handleDeleteUser(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 表格分页处理
  const handleTableChange = (page: number, pageSize?: number) => {
    const newPageSize = pageSize || pagination.pageSize;
    setPagination(prev => ({ ...prev, current: page, pageSize: newPageSize }));
    fetchUsers(page, newPageSize);
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter, statusFilter]);

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Title level={4} style={{ margin: 0 }}>用户管理</Title>
            <Space>
              <Button 
                icon={<ReloadOutlined />}
                onClick={() => fetchUsers(pagination.current, pagination.pageSize)}
              >
                刷新
              </Button>
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                新增用户
              </Button>
            </Space>
          </div>

          {/* 筛选条件 */}
          <Space wrap style={{ marginBottom: 16 }}>
            <Select
              placeholder="用户角色"
              value={roleFilter}
              onChange={setRoleFilter}
              style={{ width: 120 }}
              allowClear
            >
              <Option value="admin">管理员</Option>
              <Option value="user">普通用户</Option>
            </Select>
            
            <Select
              placeholder="用户状态"
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 120 }}
              allowClear
            >
              <Option value="active">活跃</Option>
              <Option value="inactive">禁用</Option>
            </Select>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1000 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: handleTableChange,
            onShowSizeChange: handleTableChange,
          }}
        />
      </Card>

      {/* 创建用户Modal */}
      <Modal
        title="新增用户"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateUser}
        >
          <Form.Item
            label="用户名"
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, max: 50, message: '用户名长度为3-50个字符' }
            ]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>
          
          <Form.Item
            label="邮箱（可选）"
            name="email"
            rules={[
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input placeholder="请输入邮箱地址（可选）" />
          </Form.Item>
          
          <Form.Item
            label="密码"
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6个字符' }
            ]}
          >
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
          
          <Form.Item
            label="用户角色"
            name="role"
            rules={[{ required: true, message: '请选择用户角色' }]}
          >
            <Select placeholder="请选择用户角色">
              <Option value="operator">普通用户</Option>
              <Option value="admin">管理员</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            label="初始额度"
            name="initialQuota"
            rules={[{ type: 'number', min: 0, message: '额度不能为负数' }]}
          >
            <InputNumber 
              placeholder="请输入初始额度" 
              style={{ width: '100%' }}
              min={0}
            />
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                创建用户
              </Button>
              <Button onClick={() => {
                setCreateModalVisible(false);
                form.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑用户Modal */}
      <Modal
        title="编辑用户"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setSelectedUser(null);
          editForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleUpdateUser}
        >
          <Form.Item
            label="用户名"
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, max: 50, message: '用户名长度为3-50个字符' }
            ]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>
          
          <Form.Item
            label="邮箱（可选）"
            name="email"
            rules={[
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input placeholder="请输入邮箱地址（可选）" />
          </Form.Item>
          
          <Form.Item
            label="新密码（可选）"
            name="password"
            rules={[{ min: 6, message: '密码至少6个字符' }]}
          >
            <Input.Password placeholder="如需修改密码请输入新密码" />
          </Form.Item>
          
          <Form.Item
            label="用户角色"
            name="role"
            rules={[{ required: true, message: '请选择用户角色' }]}
          >
            <Select placeholder="请选择用户角色">
              <Option value="user">普通用户</Option>
              <Option value="admin">管理员</Option>
            </Select>
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                更新用户
              </Button>
              <Button onClick={() => {
                setEditModalVisible(false);
                setSelectedUser(null);
                editForm.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserManagement; 