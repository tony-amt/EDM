import {
  EditOutlined,
  PlusOutlined,
  SettingOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import {
  Button,
  Card,
  message,
  Modal,
  Progress,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography
} from 'antd';
import React, { useEffect, useState } from 'react';
import emailServiceService, { EmailService } from '../../services/email-service.service';
import CreateEmailServiceModal from './CreateEmailServiceModal';
import EditEmailServiceModal from './EditEmailServiceModal';

const { Title } = Typography;

const EmailServiceList: React.FC = () => {
  const [services, setServices] = useState<EmailService[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingService, setEditingService] = useState<EmailService | null>(null);

  // 获取服务列表
  const fetchServices = async () => {
    setLoading(true);
    try {
      const response = await emailServiceService.getList();
      if (response.success) {
        setServices(response.data || []);
      } else {
        message.error('获取发信服务列表失败');
      }
    } catch (error) {
      console.error('获取发信服务列表失败:', error);
      message.error('获取发信服务列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 切换服务状态
  const handleToggleStatus = async (service: EmailService) => {
    try {
      const response = await emailServiceService.toggleStatus(service.id);
      if (response.success) {
        message.success(`服务已${service.is_enabled ? '禁用' : '启用'}`);
        fetchServices();
      } else {
        message.error(response.message || '操作失败');
      }
    } catch (error) {
      console.error('切换服务状态失败:', error);
      message.error('操作失败');
    }
  };

  // 解冻服务
  const handleUnfreeze = async (service: EmailService) => {
    Modal.confirm({
      title: '确认解冻',
      content: `确定要解冻服务 "${service.name}" 吗？`,
      onOk: async () => {
        try {
          const response = await emailServiceService.unfreeze(service.id);
          if (response.success) {
            message.success('服务解冻成功');
            fetchServices();
          } else {
            message.error(response.message || '解冻失败');
          }
        } catch (error) {
          console.error('解冻服务失败:', error);
          message.error('解冻失败');
        }
      }
    });
  };

  // 编辑服务
  const handleEdit = (service: EmailService) => {
    setEditingService(service);
    setEditModalVisible(true);
  };

  // 创建成功回调
  const handleCreateSuccess = () => {
    setCreateModalVisible(false);
    fetchServices();
  };

  // 编辑成功回调
  const handleEditSuccess = () => {
    setEditModalVisible(false);
    setEditingService(null);
    fetchServices();
  };

  useEffect(() => {
    fetchServices();
  }, []);

  // 获取服务状态标签
  const getStatusTag = (service: EmailService) => {
    if (service.is_frozen) {
      return <Tag color="red">已冻结</Tag>;
    }
    if (!service.is_enabled) {
      return <Tag color="gray">已禁用</Tag>;
    }
    if (service.used_quota >= service.daily_quota) {
      return <Tag color="orange">额度用完</Tag>;
    }
    return <Tag color="green">正常</Tag>;
  };

  // 获取使用率进度条颜色
  const getUsageColor = (usageRate: number) => {
    if (usageRate >= 90) return '#ff4d4f';
    if (usageRate >= 70) return '#faad14';
    return '#52c41a';
  };

  const columns = [
    {
      title: '服务名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: EmailService) => (
        <Space>
          <SettingOutlined />
          <span>{name}</span>
          {getStatusTag(record)}
        </Space>
      ),
    },
    {
      title: '服务商',
      dataIndex: 'provider',
      key: 'provider',
      render: (provider: string) => <Tag color="blue">{provider}</Tag>,
    },
    {
      title: '域名',
      dataIndex: 'domain',
      key: 'domain',
    },
    {
      title: '每日额度',
      key: 'quota',
      render: (_: any, record: EmailService) => {
        const usageRate = (record.used_quota / record.daily_quota) * 100;
        return (
          <div style={{ minWidth: 120 }}>
            <div style={{ marginBottom: 4 }}>
              {record.used_quota} / {record.daily_quota}
            </div>
            <Progress
              percent={Math.round(usageRate)}
              size="small"
              strokeColor={getUsageColor(usageRate)}
              showInfo={false}
            />
          </div>
        );
      },
    },
    {
      title: '发送速率',
      dataIndex: 'sending_rate',
      key: 'sending_rate',
      render: (rate: number) => `${rate}/分钟`,
    },
    {
      title: '失败次数',
      dataIndex: 'consecutive_failures',
      key: 'consecutive_failures',
      render: (failures: number) => (
        <span style={{ color: failures > 0 ? '#ff4d4f' : '#52c41a' }}>
          {failures}
        </span>
      ),
    },
    {
      title: '上次重置时间',
      dataIndex: 'last_reset_at',
      key: 'last_reset_at',
      width: 180,
      render: (lastResetAt: string | null, record: EmailService) => {
        // 如果服务被禁用，显示不同的状态
        if (!record.is_enabled) {
          return <span style={{ color: '#666' }}>服务已禁用</span>;
        }

        if (!lastResetAt) {
          return <span style={{ color: '#faad14' }}>从未重置</span>;
        }

        const resetTime = new Date(lastResetAt);
        const now = new Date();
        const diffHours = Math.floor((now.getTime() - resetTime.getTime()) / (1000 * 60 * 60));

        // 如果超过25小时未重置，显示警告颜色
        const isOverdue = diffHours > 25;

        return (
          <div>
            <div style={{ color: isOverdue ? '#ff4d4f' : '#52c41a' }}>
              {resetTime.toLocaleDateString()} {resetTime.toLocaleTimeString()}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {diffHours > 0 ? `${diffHours}小时前` : '刚刚'}
            </div>
          </div>
        );
      },
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: EmailService) => (
        <Switch
          checked={record.is_enabled}
          onChange={() => handleToggleStatus(record)}
          disabled={record.is_frozen}
          checkedChildren="启用"
          unCheckedChildren="禁用"
        />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: EmailService) => (
        <Space>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          {record.is_frozen && (
            <Tooltip title="解冻">
              <Button
                type="text"
                icon={<ThunderboltOutlined />}
                onClick={() => handleUnfreeze(record)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>邮件服务管理</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalVisible(true)}
        >
          创建服务
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={services}
        rowKey="id"
        loading={loading}
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
      />

      <CreateEmailServiceModal
        visible={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onSuccess={handleCreateSuccess}
      />

      <EditEmailServiceModal
        visible={editModalVisible}
        service={editingService}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingService(null);
        }}
        onSuccess={handleEditSuccess}
      />
    </Card>
  );
};

export default EmailServiceList; 