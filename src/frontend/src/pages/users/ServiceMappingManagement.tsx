import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Select,
  Input,
  Row,
  Col,
  message,
  Modal,
  Transfer,
  Tooltip,
  Popconfirm
} from 'antd';
import {
  UserOutlined,
  SettingOutlined,
  LinkOutlined,
  DisconnectOutlined,
  SearchOutlined,
  ReloadOutlined,
  TeamOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { TransferDirection } from 'antd/es/transfer';

const { Option } = Select;

interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  remaining_quota: number;
  assigned_services: EmailService[];
}

interface EmailService {
  id: string;
  name: string;
  provider: string;
  domain: string;
  daily_quota: number;
  used_quota: number;
  status: 'active' | 'inactive' | 'frozen';
}

interface ServiceMapping {
  user_id: string;
  service_id: string;
  assigned_at: string;
  assigned_by: string;
}

const ServiceMappingManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [services, setServices] = useState<EmailService[]>([]);
  const [loading, setLoading] = useState(false);
  const [transferVisible, setTransferVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [transferData, setTransferData] = useState<string[]>([]);
  const [targetKeys, setTargetKeys] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    role: '',
    keyword: ''
  });

  // 获取用户列表
  const fetchUsers = async () => {
    setLoading(true);
    try {
      // 模拟API调用
      const mockUsers: User[] = Array.from({ length: 15 }, (_, index) => {
        const role = index < 5 ? 'admin' : 'user';
        const assignedServices = services.slice(0, Math.floor(Math.random() * 3) + 1);
        
        return {
          id: `user_${index + 1}`,
          username: `用户${index + 1}`,
          email: `user${index + 1}@example.com`,
          role,
          remaining_quota: Math.floor(Math.random() * 10000) + 1000,
          assigned_services: assignedServices
        };
      });
      setUsers(mockUsers);
    } catch (error) {
      console.error('获取用户列表失败:', error);
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取发信服务列表
  const fetchServices = async () => {
    try {
      // 模拟API调用
      const mockServices: EmailService[] = [
        {
          id: 'service_1',
          name: '阿里云邮件推送',
          provider: 'aliyun',
          domain: 'mail1.example.com',
          daily_quota: 10000,
          used_quota: 2500,
          status: 'active'
        },
        {
          id: 'service_2',
          name: '腾讯云邮件服务',
          provider: 'tencent',
          domain: 'mail2.example.com',
          daily_quota: 8000,
          used_quota: 1200,
          status: 'active'
        },
        {
          id: 'service_3',
          name: 'SendGrid邮件',
          provider: 'sendgrid',
          domain: 'mail3.example.com',
          daily_quota: 15000,
          used_quota: 8500,
          status: 'active'
        },
        {
          id: 'service_4',
          name: 'Mailgun服务',
          provider: 'mailgun',
          domain: 'mail4.example.com',
          daily_quota: 5000,
          used_quota: 4800,
          status: 'frozen'
        }
      ];
      setServices(mockServices);
    } catch (error) {
      console.error('获取服务列表失败:', error);
    }
  };

  // 打开服务分配弹窗
  const openServiceAssignment = (user: User) => {
    setSelectedUser(user);
    const userServiceIds = user.assigned_services.map(s => s.id);
    setTargetKeys(userServiceIds);
    setTransferData(services.map(s => s.id));
    setTransferVisible(true);
  };

  // 保存服务分配
  const saveServiceAssignment = async () => {
    if (!selectedUser) return;

    try {
      // 这里应该调用API保存服务分配
      message.success('服务分配保存成功');
      setTransferVisible(false);
      fetchUsers(); // 重新获取用户列表
    } catch (error) {
      console.error('保存服务分配失败:', error);
      message.error('保存服务分配失败');
    }
  };

  // 移除单个服务关联
  const removeServiceMapping = async (userId: string, serviceId: string) => {
    try {
      // 这里应该调用API移除服务关联
      message.success('服务关联移除成功');
      fetchUsers(); // 重新获取用户列表
    } catch (error) {
      console.error('移除服务关联失败:', error);
      message.error('移除服务关联失败');
    }
  };

  // Transfer组件的渲染函数
  const renderTransferItem = (item: any) => {
    const service = services.find(s => s.id === item.key);
    if (!service) return item.title;

    const usageRate = Math.round((service.used_quota / service.daily_quota) * 100);
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div>{service.name}</div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            {service.provider} | {service.domain}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Tag color={service.status === 'active' ? 'green' : 'red'}>
            {service.status === 'active' ? '正常' : '冻结'}
          </Tag>
          <div style={{ fontSize: '12px', color: '#666' }}>
            使用率: {usageRate}%
          </div>
        </div>
      </div>
    );
  };

  // 筛选用户列表
  const getFilteredUsers = () => {
    return users.filter(user => {
      const matchRole = !filters.role || user.role === filters.role;
      const matchKeyword = !filters.keyword || 
        user.username.toLowerCase().includes(filters.keyword.toLowerCase()) ||
        user.email.toLowerCase().includes(filters.keyword.toLowerCase());
      return matchRole && matchKeyword;
    });
  };

  useEffect(() => {
    fetchServices().then(() => {
      fetchUsers();
    });
  }, []);

  // 获取角色标签
  const getRoleTag = (role: string) => {
    return role === 'admin' ? 
      <Tag color="red">管理员</Tag> : 
      <Tag color="blue">普通用户</Tag>;
  };

  // 获取服务状态标签
  const getServiceStatusTag = (status: string) => {
    const statusConfig = {
      'active': { text: '正常', color: 'green' },
      'inactive': { text: '停用', color: 'default' },
      'frozen': { text: '冻结', color: 'red' }
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.inactive;
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 表格列定义
  const columns: ColumnsType<User> = [
    {
      title: '用户信息',
      key: 'user',
      width: 200,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>
            <UserOutlined style={{ marginRight: 8 }} />
            {record.username}
          </div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            {record.email}
          </div>
        </div>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role) => getRoleTag(role),
    },
    {
      title: '剩余额度',
      dataIndex: 'remaining_quota',
      key: 'remaining_quota',
      width: 120,
      render: (quota) => quota.toLocaleString(),
    },
    {
      title: '已分配服务',
      key: 'assigned_services',
      width: 300,
      render: (_, record) => (
        <div>
          {record.assigned_services.length === 0 ? (
            <Tag color="default">未分配服务</Tag>
          ) : (
            <Space size={4} wrap>
              {record.assigned_services.map(service => (
                <Tooltip
                  key={service.id}
                  title={
                    <div>
                      <div>服务商: {service.provider}</div>
                      <div>域名: {service.domain}</div>
                      <div>每日额度: {service.daily_quota.toLocaleString()}</div>
                      <div>已使用: {service.used_quota.toLocaleString()}</div>
                    </div>
                  }
                >
                  <Tag
                    color="blue"
                    closable
                    onClose={(e) => {
                      e.preventDefault();
                      Modal.confirm({
                        title: '确认移除',
                        content: `确定要移除用户 ${record.username} 的服务 ${service.name} 吗？`,
                        onOk: () => removeServiceMapping(record.id, service.id)
                      });
                    }}
                  >
                    {service.name}
                    {getServiceStatusTag(service.status)}
                  </Tag>
                </Tooltip>
              ))}
            </Space>
          )}
        </div>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<SettingOutlined />}
            onClick={() => openServiceAssignment(record)}
          >
            分配服务
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="service-mapping-management">
      <Card>
        {/* 筛选条件 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={4}>
            <Select
              placeholder="角色筛选"
              value={filters.role}
              onChange={(value) => setFilters({ ...filters, role: value })}
              allowClear
              style={{ width: '100%' }}
            >
              <Option value="admin">管理员</Option>
              <Option value="user">普通用户</Option>
            </Select>
          </Col>
          <Col span={6}>
            <Input
              placeholder="搜索用户名或邮箱"
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
              prefix={<SearchOutlined />}
              allowClear
            />
          </Col>
          <Col span={4}>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                setFilters({ role: '', keyword: '' });
                fetchUsers();
              }}
            >
              重置
            </Button>
          </Col>
        </Row>

        {/* 用户列表 */}
        <Table
          columns={columns}
          dataSource={getFilteredUsers()}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`,
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* 服务分配弹窗 */}
      <Modal
        title={
          <Space>
            <TeamOutlined />
            为用户 "{selectedUser?.username}" 分配发信服务
          </Space>
        }
        open={transferVisible}
        onCancel={() => setTransferVisible(false)}
        onOk={saveServiceAssignment}
        width={800}
        okText="保存分配"
        cancelText="取消"
      >
        {selectedUser && (
          <div style={{ marginBottom: 16 }}>
            <div>用户邮箱: {selectedUser.email}</div>
            <div>用户角色: {getRoleTag(selectedUser.role)}</div>
            <div>剩余额度: {selectedUser.remaining_quota.toLocaleString()}</div>
          </div>
        )}
        
        <Transfer
          dataSource={services.map(service => ({
            key: service.id,
            title: service.name,
            description: `${service.provider} | ${service.domain}`
          }))}
          targetKeys={targetKeys}
          onChange={(newTargetKeys) => setTargetKeys(newTargetKeys as string[])}
          render={renderTransferItem}
          titles={['可用服务', '已分配服务']}
          style={{ marginBottom: 16 }}
          listStyle={{
            width: 350,
            height: 300,
          }}
        />
      </Modal>
    </div>
  );
};

export default ServiceMappingManagement; 