import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Button,
  Space,
  Descriptions,
  Tag,
  Progress,
  Row,
  Col,
  Statistic,
  Alert,
  Table,
  Modal,
  Input,
  message,
  Switch,
  Tooltip
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  ReloadOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  LineChartOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface EmailServiceDetail {
  id: string;
  serviceName: string;
  serviceType: string;
  sendingDomain: string;
  apiCredentials: {
    apiUser: string;
    apiKey: string; // 已加密显示
  };
  dailyQuota: number;
  remainingQuota: number;
  sendingRate: number;
  quotaResetTime: string;
  timezone: string;
  status: 'enabled' | 'disabled' | 'frozen';
  connectionStatus: 'connected' | 'disconnected' | 'testing';
  lastHealthCheck: string;
  totalSentToday: number;
  failureRate: string;
  consecutiveFailures: number;
  createdAt: string;
  updatedAt: string;
  nextResetTime: string;
  frozenUntil: string | null;
}

interface UsageHistory {
  date: string;
  sent: number;
  success: number;
  failed: number;
  successRate: number;
}

interface ServiceLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  event: string;
  message: string;
  details?: any;
}

const EmailServiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [serviceDetail, setServiceDetail] = useState<EmailServiceDetail | null>(null);
  const [usageHistory, setUsageHistory] = useState<UsageHistory[]>([]);
  const [serviceLogs, setServiceLogs] = useState<ServiceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [quotaAdjustVisible, setQuotaAdjustVisible] = useState(false);
  const [quotaAdjustValue, setQuotaAdjustValue] = useState<number>(0);

  // 状态配置
  const statusConfig = {
    enabled: { color: 'success', text: '启用中', icon: <CheckCircleOutlined /> },
    disabled: { color: 'default', text: '已禁用', icon: <ExclamationCircleOutlined /> },
    frozen: { color: 'error', text: '已冻结', icon: <ClockCircleOutlined /> }
  };

  const connectionConfig = {
    connected: { color: 'success', text: '连接正常' },
    disconnected: { color: 'error', text: '连接失败' },
    testing: { color: 'processing', text: '测试中' }
  };

  const logLevelConfig = {
    info: { color: 'blue', text: '信息' },
    warning: { color: 'orange', text: '警告' },
    error: { color: 'red', text: '错误' }
  };

  // 获取服务详情
  const fetchServiceDetail = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/email-services/${id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        setServiceDetail(result.data);
      } else {
        message.error('获取服务详情失败');
        navigate('/email-services');
      }
    } catch (error) {
      console.error('获取服务详情失败:', error);
      message.error('网络请求失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 获取使用历史
  const fetchUsageHistory = async () => {
    if (!id) return;
    
    try {
      const response = await fetch(`/api/email-services/${id}/usage-history?days=7`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        setUsageHistory(result.data);
      }
    } catch (error) {
      console.error('获取使用历史失败:', error);
    }
  };

  // 获取服务日志
  const fetchServiceLogs = async () => {
    if (!id) return;
    
    try {
      const response = await fetch(`/api/email-services/${id}/logs?limit=50`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        setServiceLogs(result.data);
      }
    } catch (error) {
      console.error('获取服务日志失败:', error);
    }
  };

  // 切换服务状态
  const handleToggleStatus = async (newStatus: 'enabled' | 'disabled') => {
    if (!serviceDetail) return;
    
    try {
      const response = await fetch(`/api/email-services/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const result = await response.json();

      if (result.success) {
        message.success(`服务${newStatus === 'enabled' ? '启用' : '禁用'}成功`);
        fetchServiceDetail();
      } else {
        message.error(result.error?.message || '操作失败');
      }
    } catch (error) {
      console.error('服务状态切换失败:', error);
      message.error('操作失败，请重试');
    }
  };

  // 手动调整剩余额度
  const handleQuotaAdjust = async () => {
    if (!serviceDetail || quotaAdjustValue === 0) {
      message.error('请输入有效的调整数值');
      return;
    }

    try {
      const response = await fetch(`/api/email-services/${id}/quota`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          operation: quotaAdjustValue > 0 ? 'add' : 'subtract',
          amount: Math.abs(quotaAdjustValue),
          reason: '管理员手动调整'
        }),
      });

      const result = await response.json();

      if (result.success) {
        message.success('额度调整成功');
        setQuotaAdjustVisible(false);
        setQuotaAdjustValue(0);
        fetchServiceDetail();
      } else {
        message.error(result.error?.message || '调整失败');
      }
    } catch (error) {
      console.error('额度调整失败:', error);
      message.error('操作失败，请重试');
    }
  };

  // 恢复冻结状态
  const handleUnfreeze = async () => {
    try {
      const response = await fetch(`/api/email-services/${id}/unfreeze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        message.success('服务恢复成功');
        fetchServiceDetail();
      } else {
        message.error(result.error?.message || '恢复失败');
      }
    } catch (error) {
      console.error('服务恢复失败:', error);
      message.error('操作失败，请重试');
    }
  };

  // 测试连接
  const handleTestConnection = async () => {
    try {
      const response = await fetch(`/api/email-services/${id}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        message.success('连接测试通过');
        fetchServiceDetail();
      } else {
        message.error(result.error?.message || '连接测试失败');
      }
    } catch (error) {
      console.error('连接测试失败:', error);
      message.error('测试失败，请重试');
    }
  };

  // 使用历史表格列
  const historyColumns: ColumnsType<UsageHistory> = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      render: (date) => dayjs(date).format('MM-DD'),
    },
    {
      title: '发送总量',
      dataIndex: 'sent',
      key: 'sent',
    },
    {
      title: '成功',
      dataIndex: 'success',
      key: 'success',
      render: (count) => <Text style={{ color: '#52c41a' }}>{count}</Text>,
    },
    {
      title: '失败',
      dataIndex: 'failed',
      key: 'failed',
      render: (count) => <Text style={{ color: '#ff4d4f' }}>{count}</Text>,
    },
    {
      title: '成功率',
      dataIndex: 'successRate',
      key: 'successRate',
      render: (rate) => (
        <Text style={{ color: rate >= 95 ? '#52c41a' : rate >= 90 ? '#faad14' : '#ff4d4f' }}>
          {rate}%
        </Text>
      ),
    },
  ];

  // 日志表格列
  const logColumns: ColumnsType<ServiceLog> = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 150,
      render: (time) => dayjs(time).format('MM-DD HH:mm:ss'),
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 80,
      render: (level: keyof typeof logLevelConfig) => (
        <Tag color={logLevelConfig[level]?.color}>
          {logLevelConfig[level]?.text}
        </Tag>
      ),
    },
    {
      title: '事件',
      dataIndex: 'event',
      key: 'event',
      width: 120,
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
    },
  ];

  useEffect(() => {
    fetchServiceDetail();
    fetchUsageHistory();
    fetchServiceLogs();
    
    // 设置定时刷新（每30秒）
    const interval = setInterval(() => {
      fetchServiceDetail();
      fetchUsageHistory();
      fetchServiceLogs();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [id]);

  if (loading || !serviceDetail) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        加载中...
      </div>
    );
  }

  const quotaUsage = serviceDetail.dailyQuota > 0 
    ? Math.round(((serviceDetail.dailyQuota - serviceDetail.remainingQuota) / serviceDetail.dailyQuota) * 100)
    : 0;

  return (
    <div>
      {/* 返回按钮 */}
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/email-services')}>
          返回服务列表
        </Button>
      </div>

      {/* 服务状态警告 */}
      {serviceDetail.status === 'frozen' && (
        <Alert
          message="服务冻结提醒"
          description={
            <div>
              服务因连续失败{serviceDetail.consecutiveFailures}次而被冻结。
              {serviceDetail.frozenUntil && (
                <>冻结至：{dayjs(serviceDetail.frozenUntil).format('YYYY-MM-DD HH:mm:ss')}</>
              )}
            </div>
          }
          type="error"
          showIcon
          action={
            <Button size="small" onClick={handleUnfreeze}>
              立即恢复
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 基本信息卡片 */}
      <Card 
        title="服务基本信息" 
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchServiceDetail}>
              刷新
            </Button>
            <Button 
              type="primary" 
              icon={<EditOutlined />}
              onClick={() => navigate(`/email-services/edit/${id}`)}
            >
              编辑服务
            </Button>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Statistic 
              title="日发送额度" 
              value={serviceDetail.dailyQuota} 
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="剩余额度" 
              value={serviceDetail.remainingQuota} 
              valueStyle={{ 
                color: serviceDetail.remainingQuota < serviceDetail.dailyQuota * 0.1 ? '#ff4d4f' : '#52c41a' 
              }}
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="今日已发送" 
              value={serviceDetail.totalSentToday} 
              valueStyle={{ color: '#722ed1' }}
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="失败率" 
              value={serviceDetail.failureRate} 
              valueStyle={{ 
                color: parseFloat(serviceDetail.failureRate.replace('%', '')) > 5 ? '#ff4d4f' : '#52c41a' 
              }}
            />
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={12}>
            <div>
              <div style={{ marginBottom: 8 }}>今日额度使用率</div>
              <Progress 
                percent={quotaUsage} 
                status={quotaUsage >= 90 ? 'exception' : quotaUsage >= 80 ? 'active' : 'success'}
              />
            </div>
          </Col>
          <Col span={12}>
            <div>
              <div style={{ marginBottom: 8 }}>服务状态控制</div>
              <Space>
                <Tag 
                  color={statusConfig[serviceDetail.status]?.color} 
                  icon={statusConfig[serviceDetail.status]?.icon}
                  style={{ fontSize: '14px', padding: '4px 8px' }}
                >
                  {statusConfig[serviceDetail.status]?.text}
                </Tag>
                
                <Tag color={connectionConfig[serviceDetail.connectionStatus]?.color}>
                  {connectionConfig[serviceDetail.connectionStatus]?.text}
                </Tag>
                
                <Switch
                  checked={serviceDetail.status === 'enabled'}
                  onChange={(checked) => handleToggleStatus(checked ? 'enabled' : 'disabled')}
                  disabled={serviceDetail.status === 'frozen'}
                />
                
                <Button size="small" onClick={handleTestConnection}>
                  测试连接
                </Button>
                
                <Button 
                  size="small" 
                  icon={<SettingOutlined />}
                  onClick={() => setQuotaAdjustVisible(true)}
                >
                  调整额度
                </Button>
              </Space>
            </div>
          </Col>
        </Row>

        <Descriptions column={2}>
          <Descriptions.Item label="服务名称">{serviceDetail.serviceName}</Descriptions.Item>
          <Descriptions.Item label="服务类型">{serviceDetail.serviceType}</Descriptions.Item>
          <Descriptions.Item label="发信域名">{serviceDetail.sendingDomain}</Descriptions.Item>
          <Descriptions.Item label="发送频率">{serviceDetail.sendingRate}秒/封</Descriptions.Item>
          <Descriptions.Item label="API用户">{serviceDetail.apiCredentials.apiUser}</Descriptions.Item>
          <Descriptions.Item label="API密钥">{'*'.repeat(20)}</Descriptions.Item>
          <Descriptions.Item label="额度重置时间">每日 {serviceDetail.quotaResetTime}</Descriptions.Item>
          <Descriptions.Item label="时区">{serviceDetail.timezone}</Descriptions.Item>
          <Descriptions.Item label="下次重置时间">
            {dayjs(serviceDetail.nextResetTime).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="最后检查时间">
            {dayjs(serviceDetail.lastHealthCheck).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {dayjs(serviceDetail.createdAt).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {dayjs(serviceDetail.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 使用历史 */}
      <Card 
        title={
          <Space>
            <LineChartOutlined />
            <span>使用历史（最近7天）</span>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Table
          columns={historyColumns}
          dataSource={usageHistory}
          rowKey="date"
          pagination={false}
          size="small"
        />
      </Card>

      {/* 服务日志 */}
      <Card title="服务日志（最近50条）">
        <Table
          columns={logColumns}
          dataSource={serviceLogs}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          size="small"
        />
      </Card>

      {/* 额度调整Modal */}
      <Modal
        title="调整服务额度"
        open={quotaAdjustVisible}
        onOk={handleQuotaAdjust}
        onCancel={() => {
          setQuotaAdjustVisible(false);
          setQuotaAdjustValue(0);
        }}
        okText="确定调整"
        cancelText="取消"
      >
        <div>
          <div style={{ marginBottom: 16 }}>
            <Text strong>当前剩余额度：</Text>
            <Text style={{ color: '#1890ff', fontSize: '16px' }}>{serviceDetail.remainingQuota}</Text>
          </div>
          <div style={{ marginBottom: 16 }}>
            <Text strong>调整数值：</Text>
            <Input
              type="number"
              value={quotaAdjustValue}
              onChange={(e) => setQuotaAdjustValue(Number(e.target.value))}
              placeholder="正数增加，负数减少"
              style={{ marginTop: 8 }}
              addonAfter="额度"
            />
            <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
              调整后剩余额度：{serviceDetail.remainingQuota + quotaAdjustValue}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default EmailServiceDetail; 