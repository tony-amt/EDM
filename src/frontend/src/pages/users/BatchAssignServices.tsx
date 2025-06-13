import React, { useState, useEffect } from 'react';
import {
  Modal,
  Steps,
  Table,
  Transfer,
  Button,
  message,
  Tag,
  Space,
  Alert,
  Row,
  Col,
  Statistic,
  Checkbox,
  Input,
  Select,
  Tooltip,
  Progress
} from 'antd';
import {
  UserOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SearchOutlined,
  TeamOutlined,
  CloudServerOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Step } = Steps;
const { Option } = Select;

interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  remaining_quota: number;
  current_services: string[];
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

interface BatchAssignServicesProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

const BatchAssignServices: React.FC<BatchAssignServicesProps> = ({
  visible,
  onCancel,
  onSuccess
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [services, setServices] = useState<EmailService[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [filters, setFilters] = useState({
    role: '',
    keyword: ''
  });

  // 获取用户列表
  const fetchUsers = async () => {
    setLoading(true);
    try {
      // 模拟API调用
      const mockUsers: User[] = Array.from({ length: 20 }, (_, index) => ({
        id: `user_${index + 1}`,
        username: `用户${index + 1}`,
        email: `user${index + 1}@example.com`,
        role: index < 5 ? 'admin' : 'user',
        remaining_quota: Math.floor(Math.random() * 10000) + 1000,
        current_services: index % 3 === 0 ? ['service_1'] : index % 3 === 1 ? ['service_2'] : []
      }));
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

  // 下一步
  const nextStep = () => {
    if (currentStep === 0 && selectedUsers.length === 0) {
      message.warning('请至少选择一个用户');
      return;
    }
    if (currentStep === 1 && selectedServices.length === 0) {
      message.warning('请至少选择一个服务');
      return;
    }
    setCurrentStep(currentStep + 1);
  };

  // 上一步
  const prevStep = () => {
    setCurrentStep(currentStep - 1);
  };

  // 执行批量分配
  const executeBatchAssign = async () => {
    setProcessing(true);
    setProcessProgress(0);

    try {
      const totalOperations = selectedUsers.length * selectedServices.length;
      let completedOperations = 0;

      // 模拟批量分配过程
      for (let i = 0; i < selectedUsers.length; i++) {
        for (let j = 0; j < selectedServices.length; j++) {
          // 模拟API调用延迟
          await new Promise(resolve => setTimeout(resolve, 100));
          
          completedOperations++;
          const progress = Math.round((completedOperations / totalOperations) * 100);
          setProcessProgress(progress);
        }
      }

      message.success('批量分配完成');
      onSuccess();
    } catch (error) {
      console.error('批量分配失败:', error);
      message.error('批量分配失败');
    } finally {
      setProcessing(false);
    }
  };

  // 重置状态
  const resetState = () => {
    setCurrentStep(0);
    setSelectedUsers([]);
    setSelectedServices([]);
    setProcessProgress(0);
    setFilters({ role: '', keyword: '' });
  };

  // 关闭弹窗
  const handleCancel = () => {
    resetState();
    onCancel();
  };

  useEffect(() => {
    if (visible) {
      fetchUsers();
      fetchServices();
    }
  }, [visible]);

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

  // 用户表格列
  const userColumns: ColumnsType<User> = [
    {
      title: '用户信息',
      key: 'user',
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
      render: (role) => (
        <Tag color={role === 'admin' ? 'red' : 'blue'}>
          {role === 'admin' ? '管理员' : '普通用户'}
        </Tag>
      ),
    },
    {
      title: '剩余额度',
      dataIndex: 'remaining_quota',
      key: 'remaining_quota',
      render: (quota) => quota.toLocaleString(),
    },
    {
      title: '当前服务',
      key: 'current_services',
      render: (_, record) => (
        <div>
          {record.current_services.length === 0 ? (
            <Tag color="default">无</Tag>
          ) : (
            record.current_services.map(serviceId => {
              const service = services.find(s => s.id === serviceId);
              return service ? (
                <Tag key={serviceId} color="blue">
                  {service.name}
                </Tag>
              ) : null;
            })
          )}
        </div>
      ),
    },
  ];

  // 服务Transfer渲染
  const renderServiceItem = (item: any) => {
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

  // 渲染步骤内容
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div>
            <Alert
              message="选择目标用户"
              description="请选择需要分配发信服务的用户。支持多选和筛选功能。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            {/* 筛选条件 */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}>
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
              <Col span={8}>
                <Input
                  placeholder="搜索用户名或邮箱"
                  value={filters.keyword}
                  onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
                  prefix={<SearchOutlined />}
                  allowClear
                />
              </Col>
            </Row>

            <Table
              columns={userColumns}
              dataSource={getFilteredUsers()}
              rowKey="id"
              loading={loading}
              pagination={{
                pageSize: 8,
                size: 'small'
              }}
              rowSelection={{
                selectedRowKeys: selectedUsers,
                onChange: (selectedRowKeys) => setSelectedUsers(selectedRowKeys as string[]),
                getCheckboxProps: (record) => ({
                  name: record.username,
                }),
              }}
              size="small"
            />
          </div>
        );

      case 1:
        return (
          <div>
            <Alert
              message="选择发信服务"
              description="请选择要分配给用户的发信服务。只有状态正常的服务才能被分配。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Transfer
              dataSource={services
                .filter(service => service.status === 'active')
                .map(service => ({
                  key: service.id,
                  title: service.name,
                  description: `${service.provider} | ${service.domain}`
                }))}
              targetKeys={selectedServices}
              onChange={(targetKeys) => setSelectedServices(targetKeys as string[])}
              render={renderServiceItem}
              titles={['可用服务', '待分配服务']}
              listStyle={{
                width: 300,
                height: 300,
              }}
            />
          </div>
        );

      case 2:
        const selectedUserObjects = users.filter(user => selectedUsers.includes(user.id));
        const selectedServiceObjects = services.filter(service => selectedServices.includes(service.id));
        
        return (
          <div>
            <Alert
              message="确认批量分配"
              description="请确认以下分配信息。点击开始分配将为所选用户批量分配服务。"
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Statistic
                  title="选中用户数"
                  value={selectedUsers.length}
                  prefix={<UserOutlined />}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="选中服务数"
                  value={selectedServices.length}
                  prefix={<CloudServerOutlined />}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="总分配操作数"
                  value={selectedUsers.length * selectedServices.length}
                  prefix={<SettingOutlined />}
                />
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <h4>选中的用户:</h4>
                <div style={{ maxHeight: '200px', overflow: 'auto', border: '1px solid #f0f0f0', padding: '8px' }}>
                  {selectedUserObjects.map(user => (
                    <div key={user.id} style={{ marginBottom: '8px' }}>
                      <Tag color="blue">{user.username}</Tag>
                      <span style={{ fontSize: '12px', color: '#999' }}>{user.email}</span>
                    </div>
                  ))}
                </div>
              </Col>
              <Col span={12}>
                <h4>选中的服务:</h4>
                <div style={{ maxHeight: '200px', overflow: 'auto', border: '1px solid #f0f0f0', padding: '8px' }}>
                  {selectedServiceObjects.map(service => (
                    <div key={service.id} style={{ marginBottom: '8px' }}>
                      <Tag color="green">{service.name}</Tag>
                      <span style={{ fontSize: '12px', color: '#999' }}>
                        {service.provider} | {service.domain}
                      </span>
                    </div>
                  ))}
                </div>
              </Col>
            </Row>

            {processing && (
              <div style={{ marginTop: 16 }}>
                <Progress 
                  percent={processProgress} 
                  status={processProgress === 100 ? 'success' : 'active'}
                />
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  正在批量分配服务...
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      title={
        <Space>
          <TeamOutlined />
          批量分配发信服务
        </Space>
      }
      open={visible}
      onCancel={handleCancel}
      width={800}
      footer={null}
      destroyOnClose
    >
      <Steps current={currentStep} style={{ marginBottom: 24 }}>
        <Step title="选择用户" icon={<UserOutlined />} />
        <Step title="选择服务" icon={<CloudServerOutlined />} />
        <Step title="确认分配" icon={<CheckCircleOutlined />} />
      </Steps>

      <div style={{ minHeight: '400px' }}>
        {renderStepContent()}
      </div>

      <div style={{ textAlign: 'right', marginTop: 16 }}>
        <Space>
          {currentStep > 0 && (
            <Button onClick={prevStep} disabled={processing}>
              上一步
            </Button>
          )}
          
          {currentStep < 2 && (
            <Button type="primary" onClick={nextStep}>
              下一步
            </Button>
          )}
          
          {currentStep === 2 && (
            <Button 
              type="primary" 
              onClick={executeBatchAssign}
              loading={processing}
              disabled={selectedUsers.length === 0 || selectedServices.length === 0}
            >
              开始分配
            </Button>
          )}
          
          <Button onClick={handleCancel} disabled={processing}>
            取消
          </Button>
        </Space>
      </div>
    </Modal>
  );
};

export default BatchAssignServices; 