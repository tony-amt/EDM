import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  message,
  Space,
  Progress
} from 'antd';
import {
  UserOutlined,
  MailOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  DollarOutlined
} from '@ant-design/icons';
import userManagementService, { DashboardData } from '../../services/user-management.service';

const UserDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);

  // 获取Dashboard数据
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await userManagementService.getDashboard();
      if (response.success && response.data) {
        setDashboardData(response.data);
      } else {
        message.error('获取Dashboard数据失败');
      }
    } catch (error) {
      console.error('获取Dashboard数据失败:', error);
      message.error('获取Dashboard数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (!dashboardData) {
    return <div>加载中...</div>;
  }

  const { user, stats, recent_quota_logs, recent_campaigns } = dashboardData;

  // 额度日志表格列
  const quotaLogColumns = [
    {
      title: '操作时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作类型',
      dataIndex: 'operation_type',
      key: 'operation_type',
      render: (type: string) => {
        const typeMap: { [key: string]: { text: string; color: string } } = {
          'allocate': { text: '分配', color: 'green' },
          'deduct': { text: '扣减', color: 'red' },
          'refund': { text: '退还', color: 'blue' }
        };
        const config = typeMap[type] || { text: type, color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '变更数量',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number, record: any) => (
        <span style={{ 
          color: record.operation_type === 'deduct' ? '#ff4d4f' : '#52c41a',
          fontWeight: 'bold'
        }}>
          {record.operation_type === 'deduct' ? '-' : '+'}{amount}
        </span>
      ),
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      render: (reason: string) => reason || '-',
    },
  ];

  // 群发任务表格列
  const campaignColumns = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusMap: { [key: string]: { text: string; color: string } } = {
          'draft': { text: '草稿', color: 'default' },
          'pending': { text: '待发送', color: 'orange' },
          'sending': { text: '发送中', color: 'blue' },
          'completed': { text: '已完成', color: 'green' },
          'failed': { text: '失败', color: 'red' }
        };
        const config = statusMap[status] || { text: status, color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
  ];

  return (
    <div className="user-dashboard">
      {/* 用户信息卡片 */}
      <Card title="个人信息" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={8}>
            <Statistic
              title="用户名"
              value={user.username}
              prefix={<UserOutlined />}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="邮箱"
              value={user.email}
              prefix={<MailOutlined />}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="剩余额度"
              value={user.remaining_quota}
              prefix={<DollarOutlined />}
              formatter={(value) => (
                <span style={{ color: Number(value) > 100 ? '#52c41a' : '#ff4d4f' }}>
                  {Number(value).toLocaleString()}
                </span>
              )}
            />
          </Col>
        </Row>
      </Card>

      {/* 统计信息 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总群发任务"
              value={stats.total_campaigns}
              prefix={<MailOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已完成"
              value={stats.completed_campaigns}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="发送中"
              value={stats.sending_campaigns}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="失败"
              value={stats.failed_campaigns}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 完成率进度条 */}
      <Card title="任务完成率" style={{ marginBottom: 16 }}>
        <Progress
          percent={stats.total_campaigns > 0 ? Math.round((stats.completed_campaigns / stats.total_campaigns) * 100) : 0}
          status={stats.failed_campaigns > 0 ? 'exception' : 'success'}
          format={(percent) => `${percent}% (${stats.completed_campaigns}/${stats.total_campaigns})`}
        />
      </Card>

      {/* 最近记录 */}
      <Row gutter={16}>
        <Col span={12}>
          <Card title="最近额度变更" size="small">
            <Table
              columns={quotaLogColumns}
              dataSource={recent_quota_logs}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ y: 300 }}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="最近群发任务" size="small">
            <Table
              columns={campaignColumns}
              dataSource={recent_campaigns}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ y: 300 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default UserDashboard; 