import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Transfer,
  message,
  Typography,
  Row,
  Col,
  Statistic,
  Select,
  Avatar,
  Tooltip,
  Divider,
  Alert
} from 'antd';
import {
  ReloadOutlined,
  UserOutlined,
  SettingOutlined,
  LinkOutlined,
  DisconnectOutlined,
  MailOutlined,
  TeamOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { TransferDirection, TransferProps } from 'antd/es/transfer';

const { Title, Text } = Typography;
const { Option } = Select;

interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'inactive';
}

interface EmailService {
  id: string;
  name: string;
  provider: string;
  status: 'enabled' | 'disabled' | 'frozen' | 'active';
  dailyQuota?: number;
  remainingQuota?: number;
  domain?: string;
}

interface UserServiceAssociation {
  userId: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'inactive';
  associatedServices: {
    id: string;
    serviceName: string;
    serviceType: string;
    status: string;
    associatedAt: string;
  }[];
  totalServices: number;
}

interface ServiceUserAssociation {
  serviceId: string;
  serviceName: string;
  serviceType: string;
  status: 'enabled' | 'disabled' | 'frozen';
  associatedUsers: {
    id: string;
    username: string;
    email: string;
    role: string;
    associatedAt: string;
  }[];
  totalUsers: number;
}

interface TransferItem {
  key: string;
  title: string;
  description: string;
  disabled?: boolean;
}

const ServiceAssociation: React.FC = () => {
  const [userAssociations, setUserAssociations] = useState<UserServiceAssociation[]>([]);
  const [serviceAssociations, setServiceAssociations] = useState<ServiceUserAssociation[]>([]);
  const [loading, setLoading] = useState(false);
  const [associationModalVisible, setAssociationModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserServiceAssociation | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceUserAssociation | null>(null);
  const [viewMode, setViewMode] = useState<'user' | 'service'>('user');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allServices, setAllServices] = useState<EmailService[]>([]);
  const [transferData, setTransferData] = useState<TransferItem[]>([]);
  const [targetKeys, setTargetKeys] = useState<string[]>([]);
  const [transferMode, setTransferMode] = useState<'assign-services' | 'assign-users'>('assign-services');

  // 统计数据
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalServices: 0,
    totalAssociations: 0,
    activeUsers: 0,
    enabledServices: 0,
  });

  // 获取用户-服务关联数据
  const fetchUserAssociations = async () => {
    setLoading(true);
    try {
      // 获取所有用户和映射关系
      const [usersResponse, mappingsResponse] = await Promise.all([
        fetch('/api/users', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch('/api/user-service-mappings', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
        })
      ]);

      const usersResult = await usersResponse.json();
      const mappingsResult = await mappingsResponse.json();

      if (usersResult.success && mappingsResult.success) {
        // 组织用户-服务关联数据
        const userAssociations: UserServiceAssociation[] = usersResult.data.map((user: any) => {
          const userMappings = mappingsResult.data.filter((mapping: any) => mapping.user_id === user.id);
          return {
            userId: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            status: user.is_active ? 'active' : 'inactive',
            associatedServices: userMappings.map((mapping: any) => ({
              id: mapping.emailService.id,
              serviceName: mapping.emailService.name,
              serviceType: mapping.emailService.provider,
              status: mapping.emailService.status,
              associatedAt: mapping.created_at
            })),
            totalServices: userMappings.length
          };
        });

        setUserAssociations(userAssociations);
        setStats(prev => ({
          ...prev,
          totalUsers: userAssociations.length,
          totalAssociations: userAssociations.reduce((sum: number, user: UserServiceAssociation) => sum + user.totalServices, 0),
          activeUsers: userAssociations.filter((user: UserServiceAssociation) => user.status === 'active').length,
        }));
      } else {
        message.error('获取用户关联数据失败');
      }
    } catch (error) {
      console.error('获取用户关联数据失败:', error);
      message.error('网络请求失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取服务-用户关联数据
  const fetchServiceAssociations = async () => {
    setLoading(true);
    try {
      // 获取所有服务和映射关系
      const [servicesResponse, mappingsResponse] = await Promise.all([
        fetch('/api/email-services', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch('/api/user-service-mappings', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
        })
      ]);

      const servicesResult = await servicesResponse.json();
      const mappingsResult = await mappingsResponse.json();

      if (servicesResult.success && mappingsResult.success) {
        // 组织服务-用户关联数据
        const serviceAssociations: ServiceUserAssociation[] = servicesResult.data.items.map((service: any) => {
          const serviceMappings = mappingsResult.data.filter((mapping: any) => mapping.service_id === service.id);
          return {
            serviceId: service.id,
            serviceName: service.name,
            serviceType: service.provider,
            status: service.status === 'active' ? 'enabled' : service.status === 'frozen' ? 'frozen' : 'disabled',
            associatedUsers: serviceMappings.map((mapping: any) => ({
              id: mapping.user.id,
              username: mapping.user.username,
              email: mapping.user.email,
              role: mapping.user.role,
              associatedAt: mapping.created_at
            })),
            totalUsers: serviceMappings.length
          };
        });

        setServiceAssociations(serviceAssociations);
        setStats(prev => ({
          ...prev,
          totalServices: serviceAssociations.length,
          enabledServices: serviceAssociations.filter((service: ServiceUserAssociation) => service.status === 'enabled').length,
        }));
      } else {
        message.error('获取服务关联数据失败');
      }
    } catch (error) {
      console.error('获取服务关联数据失败:', error);
      message.error('网络请求失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取所有用户
  const fetchAllUsers = async () => {
    try {
      const response = await fetch('/api/users?pageSize=1000', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        // 转换用户数据格式以匹配接口
        const users = (result.data || []).map((user: any) => ({
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          status: user.is_active ? 'active' : 'inactive'
        }));
        setAllUsers(users);
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
    }
  };

  // 获取所有服务
  const fetchAllServices = async () => {
    try {
      const response = await fetch('/api/email-services', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        // 邮件服务API返回的是 result.data 数组，不是 result.data.items
        setAllServices(result.data || []);
      }
    } catch (error) {
      console.error('获取服务列表失败:', error);
    }
  };

  // 为用户分配服务
  const handleAssignServices = (user: UserServiceAssociation) => {
    setSelectedUser(user);
    setTransferMode('assign-services');
    
    // 准备Transfer数据
    const transferItems: TransferItem[] = allServices.map(service => ({
      key: service.id,
      title: service.name,
      description: `${service.provider} - ${service.status}`,
      disabled: service.status === 'frozen',
    }));
    
    setTransferData(transferItems);
    setTargetKeys(user.associatedServices.map(s => s.id));
    setAssociationModalVisible(true);
  };

  // 为服务分配用户
  const handleAssignUsers = (service: ServiceUserAssociation) => {
    setSelectedService(service);
    setTransferMode('assign-users');
    
    // 准备Transfer数据
    const transferItems: TransferItem[] = allUsers.map(user => ({
      key: user.id,
      title: user.username,
      description: `${user.email} - ${user.role}`,
      disabled: user.status === 'inactive',
    }));
    
    setTransferData(transferItems);
    setTargetKeys(service.associatedUsers.map(u => u.id));
    setAssociationModalVisible(true);
  };

  // 保存关联设置
  const handleSaveAssociations = async () => {
    try {
      if (transferMode === 'assign-services' && selectedUser) {
        // 为用户分配服务：删除现有映射，创建新映射
        const userId = selectedUser.userId;
        
        // 获取当前用户的所有映射
        const mappingsResponse = await fetch(`/api/user-service-mappings?user_id=${userId}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        });
        const mappingsResult = await mappingsResponse.json();
        
        if (mappingsResult.success) {
          // 删除现有映射
          for (const mapping of mappingsResult.data) {
            await fetch(`/api/user-service-mappings/${mapping.id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            });
          }
          
          // 创建新映射
          for (const serviceId of targetKeys) {
            await fetch('/api/user-service-mappings', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                user_id: userId,
                service_id: serviceId
              }),
            });
          }
        }
      } else if (transferMode === 'assign-users' && selectedService) {
        // 为服务分配用户：删除现有映射，创建新映射
        const serviceId = selectedService.serviceId;
        
        // 获取当前服务的所有映射
        const mappingsResponse = await fetch(`/api/user-service-mappings?service_id=${serviceId}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        });
        const mappingsResult = await mappingsResponse.json();
        
        if (mappingsResult.success) {
          // 删除现有映射
          for (const mapping of mappingsResult.data) {
            await fetch(`/api/user-service-mappings/${mapping.id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            });
          }
          
          // 创建新映射
          for (const userId of targetKeys) {
            await fetch('/api/user-service-mappings', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                user_id: userId,
                service_id: serviceId
              }),
            });
          }
        }
      }

      message.success('关联设置保存成功');
      setAssociationModalVisible(false);
      setSelectedUser(null);
      setSelectedService(null);
      
      // 刷新数据
      if (viewMode === 'user') {
        fetchUserAssociations();
      } else {
        fetchServiceAssociations();
      }
    } catch (error) {
      console.error('保存关联设置失败:', error);
      message.error('操作失败，请重试');
    }
  };

  // Transfer onChange
  const handleTransferChange: TransferProps['onChange'] = (nextTargetKeys, direction, moveKeys) => {
    setTargetKeys(nextTargetKeys.map(key => String(key)));
  };

  // 用户视图表格列
  const userColumns: ColumnsType<UserServiceAssociation> = [
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
      title: '关联服务',
      key: 'services',
      width: 300,
      render: (_, record) => (
        <div>
          <div style={{ marginBottom: 4 }}>
            <Text strong>共 {record.totalServices} 个服务</Text>
          </div>
          <div>
            {record.associatedServices.slice(0, 3).map(service => (
              <Tag key={service.id} color="blue" style={{ marginBottom: 4 }}>
                {service.serviceName}
              </Tag>
            ))}
            {record.totalServices > 3 && (
              <Tag color="default">+{record.totalServices - 3} 个</Tag>
            )}
          </div>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="分配服务">
            <Button
              type="link"
              icon={<SettingOutlined />}
              onClick={() => handleAssignServices(record)}
              disabled={record.status === 'inactive'}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 服务视图表格列
  const serviceColumns: ColumnsType<ServiceUserAssociation> = [
    {
      title: '服务信息',
      key: 'serviceInfo',
      width: 200,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{record.serviceName}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            <Tag color="blue">{record.serviceType}</Tag>
          </div>
        </div>
      ),
    },
    {
      title: '服务状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        const config = {
          enabled: { color: 'success', text: '启用中' },
          disabled: { color: 'default', text: '已禁用' },
          frozen: { color: 'error', text: '已冻结' }
        };
        return (
          <Tag color={config[status as keyof typeof config]?.color}>
            {config[status as keyof typeof config]?.text}
          </Tag>
        );
      },
    },
    {
      title: '关联用户',
      key: 'users',
      width: 300,
      render: (_, record) => (
        <div>
          <div style={{ marginBottom: 4 }}>
            <Text strong>共 {record.totalUsers} 个用户</Text>
          </div>
          <div>
            {record.associatedUsers.slice(0, 3).map(user => (
              <Tag key={user.id} color="green" style={{ marginBottom: 4 }}>
                {user.username}
              </Tag>
            ))}
            {record.totalUsers > 3 && (
              <Tag color="default">+{record.totalUsers - 3} 个</Tag>
            )}
          </div>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="分配用户">
            <Button
              type="link"
              icon={<TeamOutlined />}
              onClick={() => handleAssignUsers(record)}
              disabled={record.status === 'frozen'}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  useEffect(() => {
    fetchAllUsers();
    fetchAllServices();
    if (viewMode === 'user') {
      fetchUserAssociations();
    } else {
      fetchServiceAssociations();
    }
  }, [viewMode]);

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic 
              title="用户总数" 
              value={stats.totalUsers} 
              valueStyle={{ color: '#1890ff' }}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="服务总数" 
              value={stats.totalServices} 
              valueStyle={{ color: '#722ed1' }}
              prefix={<MailOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="关联总数" 
              value={stats.totalAssociations} 
              valueStyle={{ color: '#52c41a' }}
              prefix={<LinkOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="活跃用户" 
              value={stats.activeUsers} 
              valueStyle={{ color: '#fa8c16' }}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Title level={4} style={{ margin: 0 }}>服务关联管理</Title>
            <Space>
              <Button 
                icon={<ReloadOutlined />}
                onClick={() => {
                  if (viewMode === 'user') {
                    fetchUserAssociations();
                  } else {
                    fetchServiceAssociations();
                  }
                }}
              >
                刷新
              </Button>
            </Space>
          </div>

          {/* 视图切换 */}
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Text strong>查看方式：</Text>
              <Select
                value={viewMode}
                onChange={setViewMode}
                style={{ width: 150 }}
              >
                <Option value="user">按用户查看</Option>
                <Option value="service">按服务查看</Option>
              </Select>
            </Space>
          </div>

          <Alert
            message="关联管理说明"
            description={
              viewMode === 'user' 
                ? "在此页面可以为用户分配可使用的邮件服务。管理员可以使用所有服务，普通用户只能使用被分配的服务。"
                : "在此页面可以为邮件服务分配可使用的用户。只有被分配的用户才能使用该服务进行邮件发送。"
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        </div>

        {viewMode === 'user' ? (
          <Table
            columns={userColumns}
            dataSource={userAssociations}
            rowKey="userId"
            loading={loading}
            pagination={{
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            }}
          />
        ) : (
          <Table
            columns={serviceColumns}
            dataSource={serviceAssociations}
            rowKey="serviceId"
            loading={loading}
            pagination={{
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            }}
          />
        )}
      </Card>

      {/* 关联设置Modal */}
      <Modal
        title={
          transferMode === 'assign-services' 
            ? `为用户 "${selectedUser?.username}" 分配服务`
            : `为服务 "${selectedService?.serviceName}" 分配用户`
        }
        open={associationModalVisible}
        onOk={handleSaveAssociations}
        onCancel={() => {
          setAssociationModalVisible(false);
          setSelectedUser(null);
          setSelectedService(null);
        }}
        okText="保存设置"
        cancelText="取消"
        width={700}
      >
        <div style={{ marginBottom: 16 }}>
          <Alert
            message={
              transferMode === 'assign-services'
                ? "请选择用户可以使用的邮件服务"
                : "请选择可以使用此服务的用户"
            }
            type="info"
            showIcon
          />
        </div>

        <Transfer
          dataSource={transferData}
          titles={['可选项', '已选项']}
          targetKeys={targetKeys}
          onChange={handleTransferChange}
          render={(item) => (
            <div>
              <div style={{ fontWeight: 'bold' }}>{item.title}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>{item.description}</div>
            </div>
          )}
          listStyle={{
            width: 300,
            height: 400,
          }}
          operations={['添加', '移除']}
          showSearch
          filterOption={(inputValue, option) =>
            option.title.toLowerCase().includes(inputValue.toLowerCase()) ||
            option.description.toLowerCase().includes(inputValue.toLowerCase())
          }
        />
      </Modal>
    </div>
  );
};

export default ServiceAssociation; 