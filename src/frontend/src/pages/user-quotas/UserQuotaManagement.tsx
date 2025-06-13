import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Typography,
  Row,
  Col,
  Statistic,
  DatePicker,
  Progress,
  Tooltip,
  Alert
} from 'antd';
import {
  ReloadOutlined,
  PlusOutlined,
  MinusOutlined,
  HistoryOutlined,
  UserOutlined,
  DollarOutlined,
  UpCircleOutlined,
  DownCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

interface UserQuota {
  id: string;
  username: string;
  email: string;
  remainingQuota: number;
  totalQuotaUsed: number;
  quotaLimit: number;
  lastUsedAt: string | null;
  usageToday: number;
  usageThisWeek: number;
  usageThisMonth: number;
  status: 'active' | 'inactive';
}

interface QuotaHistory {
  id: string;
  userId: string;
  username: string;
  operation: 'add' | 'subtract' | 'set' | 'usage';
  amount: number;
  beforeQuota: number;
  afterQuota: number;
  reason: string;
  operatedBy: string;
  operatedAt: string;
}

interface UserQuotaListResponse {
  success: boolean;
  data: {
    items: UserQuota[];
    summary: {
      totalUsers: number;
      totalQuotaLimit: number;
      totalQuotaUsed: number;
      totalQuotaRemaining: number;
    };
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
}

const UserQuotaManagement: React.FC = () => {
  const [quotas, setQuotas] = useState<UserQuota[]>([]);
  const [quotaHistory, setQuotaHistory] = useState<QuotaHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [batchAdjustVisible, setBatchAdjustVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserQuota | null>(null);
  const [form] = Form.useForm();
  const [batchForm] = Form.useForm();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [summary, setSummary] = useState({
    totalUsers: 0,
    totalQuotaLimit: 0,
    totalQuotaUsed: 0,
    totalQuotaRemaining: 0,
  });

  // 获取用户额度列表
  const fetchUserQuotas = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        ...(statusFilter && { status: statusFilter })
      });

      const response = await fetch(`/api/quota/users?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      const result: UserQuotaListResponse = await response.json();

      if (result.success) {
        setQuotas(result.data.items);
        setSummary(result.data.summary);
      } else {
        message.error('获取用户额度失败');
      }
    } catch (error) {
      console.error('获取用户额度失败:', error);
      message.error('网络请求失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 获取额度历史记录
  const fetchQuotaHistory = async (userId?: string) => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        ...(userId && { userId }),
        limit: '100'
      });

      const response = await fetch(`/api/quota/history?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        setQuotaHistory(result.data);
      } else {
        message.error('获取历史记录失败');
      }
    } catch (error) {
      console.error('获取历史记录失败:', error);
      message.error('网络请求失败');
    } finally {
      setHistoryLoading(false);
    }
  };

  // 调整单个用户额度
  const handleAdjustQuota = async (values: any) => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`/api/quota/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: values.operation,
          amount: values.amount,
          reason: values.reason || '管理员调整'
        }),
      });

      const result = await response.json();

      if (result.success) {
        message.success('额度调整成功');
        setAdjustModalVisible(false);
        setSelectedUser(null);
        form.resetFields();
        fetchUserQuotas();
      } else {
        message.error(result.error?.message || '调整失败');
      }
    } catch (error) {
      console.error('额度调整失败:', error);
      message.error('操作失败，请重试');
    }
  };

  // 批量额度调整
  const handleBatchAdjust = async (values: any) => {
    try {
      const userIds = quotas.filter(quota => 
        !statusFilter || quota.status === statusFilter
      ).map(quota => quota.id);

      const response = await fetch('/api/users/batch-quota-adjust', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userIds,
          operation: values.operation,
          amount: values.amount,
          reason: values.reason || '批量调整'
        }),
      });

      const result = await response.json();

      if (result.success) {
        message.success(`成功调整 ${result.data.successCount} 个用户的额度`);
        setBatchAdjustVisible(false);
        batchForm.resetFields();
        fetchUserQuotas();
      } else {
        message.error(result.error?.message || '批量调整失败');
      }
    } catch (error) {
      console.error('批量调整失败:', error);
      message.error('操作失败，请重试');
    }
  };

  // 额度使用率计算
  const calculateUsageRate = (quota: UserQuota) => {
    if (quota.quotaLimit === 0) return 0;
    return Math.round((quota.totalQuotaUsed / quota.quotaLimit) * 100);
  };

  // 剩余额度状态
  const getQuotaStatus = (quota: UserQuota) => {
    const rate = quota.remainingQuota / quota.quotaLimit;
    if (rate <= 0.1) return { status: 'exception', text: '额度不足' };
    if (rate <= 0.3) return { status: 'active', text: '额度偏低' };
    return { status: 'success', text: '额度充足' };
  };

  // 用户额度表格列
  const quotaColumns: ColumnsType<UserQuota> = [
    {
      title: '用户信息',
      key: 'userInfo',
      width: 200,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{record.username}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>{record.email}</div>
        </div>
      ),
    },
    {
      title: '额度状态',
      key: 'quotaStatus',
      width: 120,
      render: (_, record) => {
        const status = getQuotaStatus(record);
        return (
          <Tag color={status.status === 'exception' ? 'red' : status.status === 'active' ? 'orange' : 'green'}>
            {status.text}
          </Tag>
        );
      },
    },
    {
      title: '剩余额度',
      dataIndex: 'remainingQuota',
      key: 'remainingQuota',
      width: 120,
      render: (quota, record) => (
        <div>
          <Text strong style={{ 
            color: quota < record.quotaLimit * 0.1 ? '#ff4d4f' : 
                  quota < record.quotaLimit * 0.3 ? '#faad14' : '#52c41a' 
          }}>
            {quota}
          </Text>
          <div style={{ fontSize: '12px', color: '#666' }}>
            / {record.quotaLimit}
          </div>
        </div>
      ),
    },
    {
      title: '使用率',
      key: 'usageRate',
      width: 120,
      render: (_, record) => {
        const rate = calculateUsageRate(record);
        return (
          <Progress 
            percent={rate} 
            size="small"
            status={rate >= 90 ? 'exception' : rate >= 70 ? 'active' : 'success'}
          />
        );
      },
    },
    {
      title: '使用统计',
      key: 'usageStats',
      width: 120,
      render: (_, record) => (
        <div style={{ fontSize: '12px' }}>
          <div>今日: {record.usageToday}</div>
          <div>本周: {record.usageThisWeek}</div>
          <div>本月: {record.usageThisMonth}</div>
        </div>
      ),
    },
    {
      title: '最后使用',
      dataIndex: 'lastUsedAt',
      key: 'lastUsedAt',
      width: 150,
      render: (time) => time ? dayjs(time).format('MM-DD HH:mm') : '未使用',
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="调整额度">
            <Button
              type="link"
              icon={<DollarOutlined />}
              onClick={() => {
                setSelectedUser(record);
                setAdjustModalVisible(true);
              }}
            />
          </Tooltip>
          
          <Tooltip title="查看历史">
            <Button
              type="link"
              icon={<HistoryOutlined />}
              onClick={() => {
                setSelectedUser(record);
                fetchQuotaHistory(record.id);
                setHistoryModalVisible(true);
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 历史记录表格列
  const historyColumns: ColumnsType<QuotaHistory> = [
    {
      title: '时间',
      dataIndex: 'operatedAt',
      key: 'operatedAt',
      width: 150,
      render: (time) => dayjs(time).format('MM-DD HH:mm:ss'),
    },
    {
      title: '操作类型',
      dataIndex: 'operation',
      key: 'operation',
      width: 100,
      render: (operation) => {
        const config = {
          add: { color: 'green', icon: <UpCircleOutlined />, text: '增加' },
          subtract: { color: 'red', icon: <DownCircleOutlined />, text: '减少' },
          set: { color: 'blue', icon: <DollarOutlined />, text: '设置' },
          usage: { color: 'orange', icon: <UserOutlined />, text: '使用' }
        };
        const conf = config[operation as keyof typeof config];
        return (
          <Tag color={conf.color} icon={conf.icon}>
            {conf.text}
          </Tag>
        );
      },
    },
    {
      title: '数量',
      dataIndex: 'amount',
      key: 'amount',
      width: 80,
    },
    {
      title: '变更前',
      dataIndex: 'beforeQuota',
      key: 'beforeQuota',
      width: 80,
    },
    {
      title: '变更后',
      dataIndex: 'afterQuota',
      key: 'afterQuota',
      width: 80,
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
    },
    {
      title: '操作人',
      dataIndex: 'operatedBy',
      key: 'operatedBy',
      width: 100,
    },
  ];

  useEffect(() => {
    fetchUserQuotas();
  }, [statusFilter]);

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic 
              title="用户总数" 
              value={summary.totalUsers} 
              valueStyle={{ color: '#1890ff' }}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="总额度限制" 
              value={summary.totalQuotaLimit} 
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="已使用额度" 
              value={summary.totalQuotaUsed} 
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="剩余额度" 
              value={summary.totalQuotaRemaining} 
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Title level={4} style={{ margin: 0 }}>用户额度管理</Title>
            <Space>
              <Button 
                icon={<HistoryOutlined />}
                onClick={() => {
                  fetchQuotaHistory();
                  setHistoryModalVisible(true);
                }}
              >
                全部历史
              </Button>
              <Button 
                icon={<ReloadOutlined />}
                onClick={fetchUserQuotas}
              >
                刷新
              </Button>
              <Button 
                type="primary" 
                icon={<DollarOutlined />}
                onClick={() => setBatchAdjustVisible(true)}
              >
                批量调整
              </Button>
            </Space>
          </div>

          {/* 筛选条件 */}
          <Space wrap style={{ marginBottom: 16 }}>
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

          {summary.totalQuotaRemaining < summary.totalQuotaLimit * 0.1 && (
            <Alert
              message="额度不足警告"
              description="系统总剩余额度不足10%，请及时为用户补充额度。"
              type="warning"
              showIcon
              closable
              style={{ marginBottom: 16 }}
            />
          )}
        </div>

        <Table
          columns={quotaColumns}
          dataSource={quotas}
          rowKey="id"
          loading={loading}
          scroll={{ x: 800 }}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
        />
      </Card>

      {/* 单个用户额度调整Modal */}
      <Modal
        title={`调整用户额度 - ${selectedUser?.username}`}
        open={adjustModalVisible}
        onCancel={() => {
          setAdjustModalVisible(false);
          setSelectedUser(null);
          form.resetFields();
        }}
        footer={null}
      >
        {selectedUser && (
          <div>
            <div style={{ marginBottom: 16, padding: 16, backgroundColor: '#f5f5f5', borderRadius: 6 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Text strong>当前剩余额度：</Text>
                  <Text style={{ color: '#1890ff', fontSize: '16px' }}>{selectedUser.remainingQuota}</Text>
                </Col>
                <Col span={12}>
                  <Text strong>额度限制：</Text>
                  <Text style={{ fontSize: '16px' }}>{selectedUser.quotaLimit}</Text>
                </Col>
              </Row>
            </div>

            <Form
              form={form}
              layout="vertical"
              onFinish={handleAdjustQuota}
            >
              <Form.Item
                label="操作类型"
                name="operation"
                rules={[{ required: true, message: '请选择操作类型' }]}
              >
                <Select placeholder="请选择操作类型">
                  <Option value="add">增加额度</Option>
                  <Option value="subtract">减少额度</Option>
                  <Option value="set">设置额度</Option>
                </Select>
              </Form.Item>
              
              <Form.Item
                label="调整数量"
                name="amount"
                rules={[
                  { required: true, message: '请输入调整数量' },
                  { type: 'number', min: 1, message: '数量必须大于0' }
                ]}
              >
                <InputNumber 
                  placeholder="请输入调整数量" 
                  style={{ width: '100%' }}
                  min={1}
                />
              </Form.Item>
              
              <Form.Item
                label="调整原因"
                name="reason"
                rules={[{ required: true, message: '请输入调整原因' }]}
              >
                <TextArea 
                  placeholder="请输入调整原因" 
                  rows={3}
                />
              </Form.Item>
              
              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit">
                    确定调整
                  </Button>
                  <Button onClick={() => {
                    setAdjustModalVisible(false);
                    setSelectedUser(null);
                    form.resetFields();
                  }}>
                    取消
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      {/* 批量调整Modal */}
      <Modal
        title="批量额度调整"
        open={batchAdjustVisible}
        onCancel={() => {
          setBatchAdjustVisible(false);
          batchForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Alert
          message="批量调整说明"
          description={`将对${statusFilter ? '筛选后的' : '所有'}用户进行批量额度调整，请谨慎操作。`}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form
          form={batchForm}
          layout="vertical"
          onFinish={handleBatchAdjust}
        >
          <Form.Item
            label="操作类型"
            name="operation"
            rules={[{ required: true, message: '请选择操作类型' }]}
          >
            <Select placeholder="请选择操作类型">
              <Option value="add">增加额度</Option>
              <Option value="subtract">减少额度</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            label="调整数量"
            name="amount"
            rules={[
              { required: true, message: '请输入调整数量' },
              { type: 'number', min: 1, message: '数量必须大于0' }
            ]}
          >
            <InputNumber 
              placeholder="请输入调整数量" 
              style={{ width: '100%' }}
              min={1}
            />
          </Form.Item>
          
          <Form.Item
            label="调整原因"
            name="reason"
            rules={[{ required: true, message: '请输入调整原因' }]}
          >
            <TextArea 
              placeholder="请输入调整原因" 
              rows={3}
            />
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                确定批量调整
              </Button>
              <Button onClick={() => {
                setBatchAdjustVisible(false);
                batchForm.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 历史记录Modal */}
      <Modal
        title={selectedUser ? `${selectedUser.username} 的额度历史` : '所有用户额度历史'}
        open={historyModalVisible}
        onCancel={() => {
          setHistoryModalVisible(false);
          setSelectedUser(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setHistoryModalVisible(false);
            setSelectedUser(null);
          }}>
            关闭
          </Button>
        ]}
        width={800}
      >
        <Table
          columns={historyColumns}
          dataSource={quotaHistory}
          rowKey="id"
          loading={historyLoading}
          size="small"
          pagination={{ pageSize: 10 }}
        />
      </Modal>
    </div>
  );
};

export default UserQuotaManagement; 