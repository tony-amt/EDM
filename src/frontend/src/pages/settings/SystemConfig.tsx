import {
  InfoCircleOutlined,
  ReloadOutlined,
  SaveOutlined,
  SettingOutlined
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Form,
  InputNumber,
  message,
  Row,
  Space,
  Spin,
  Tooltip,
  Typography
} from 'antd';
import React, { useEffect, useState } from 'react';
import { API_URL } from '../../config/constants';
import axios from '../../utils/axios';

const { Title, Text } = Typography;

interface SystemConfig {
  queue_batch_size: { value: number; description: string };
  queue_interval_seconds: { value: number; description: string };
  scheduled_check_interval: { value: number; description: string };
  max_retry_attempts: { value: number; description: string };
}

interface ConfigFormData {
  queue_batch_size: number;
  queue_interval_seconds: number;
  scheduled_check_interval: number;
  max_retry_attempts: number;
}

const SystemConfig: React.FC = () => {
  const [form] = Form.useForm();
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  useEffect(() => {
    fetchSystemConfig();
  }, []);

  // 获取系统配置
  const fetchSystemConfig = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/system-config/queue`);
      if (response.data.success) {
        const configData = response.data.data;
        setConfig(configData);

        // 设置表单初始值
        form.setFieldsValue({
          queue_batch_size: configData.queue_batch_size.value,
          queue_interval_seconds: configData.queue_interval_seconds.value,
          scheduled_check_interval: configData.scheduled_check_interval.value,
          max_retry_attempts: configData.max_retry_attempts.value
        });

        setLastUpdated(new Date().toLocaleString('zh-CN'));
      }
    } catch (error) {
      console.error('获取系统配置失败:', error);
      message.error('获取系统配置失败');
    } finally {
      setLoading(false);
    }
  };

  // 保存配置
  const handleSave = async (values: ConfigFormData) => {
    setSaving(true);
    try {
      const updateData = {
        queue_batch_size: values.queue_batch_size,
        queue_interval_seconds: values.queue_interval_seconds,
        scheduled_check_interval: values.scheduled_check_interval,
        max_retry_attempts: values.max_retry_attempts
      };

      const response = await axios.put(`${API_URL}/system-config/batch`, updateData);

      if (response.data.success) {
        message.success('配置保存成功');
        await fetchSystemConfig(); // 重新获取最新配置
      } else {
        message.error(response.data.message || '配置保存失败');
      }
    } catch (error: any) {
      console.error('保存配置失败:', error);
      const errorMessage = error.response?.data?.error?.message || error.response?.data?.message || '配置保存失败';
      message.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // 重置为默认值
  const handleReset = () => {
    if (config) {
      form.setFieldsValue({
        queue_batch_size: config.queue_batch_size.value,
        queue_interval_seconds: config.queue_interval_seconds.value,
        scheduled_check_interval: config.scheduled_check_interval.value,
        max_retry_attempts: config.max_retry_attempts.value
      });
      message.info('已重置为当前保存的配置');
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>正在加载系统配置...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>
          <SettingOutlined /> 系统配置管理
        </Title>
        <Text type="secondary">
          管理邮件队列处理、发送间隔等系统级配置参数
        </Text>
      </div>

      <Alert
        message="配置说明"
        description="修改这些配置会影响整个系统的邮件发送性能和行为，请谨慎操作。配置保存后会在下次队列处理时生效。"
        type="info"
        icon={<InfoCircleOutlined />}
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Row gutter={24}>
        <Col span={16}>
          <Card
            title="队列处理配置"
            extra={
              <Space>
                <Text type="secondary">最后更新: {lastUpdated}</Text>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={fetchSystemConfig}
                  size="small"
                >
                  刷新
                </Button>
              </Space>
            }
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSave}
              style={{ maxWidth: 600 }}
            >
              <Form.Item
                label={
                  <Space>
                    <span>批量处理大小</span>
                    <Tooltip title="每次从队列中取出并处理的邮件数量，数值越大处理速度越快，但占用内存越多">
                      <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
                    </Tooltip>
                  </Space>
                }
                name="queue_batch_size"
                rules={[
                  { required: true, message: '请输入批量处理大小' },
                  { type: 'number', min: 1, max: 100, message: '批量大小必须在1-100之间' }
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="每批处理的邮件数量"
                  addonAfter="封邮件"
                />
              </Form.Item>

              <Form.Item
                label={
                  <Space>
                    <span>处理间隔时间</span>
                    <Tooltip title="队列处理程序每次执行的间隔时间，数值越小处理越频繁">
                      <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
                    </Tooltip>
                  </Space>
                }
                name="queue_interval_seconds"
                rules={[
                  { required: true, message: '请输入处理间隔时间' },
                  { type: 'number', min: 1, max: 300, message: '间隔时间必须在1-300秒之间' }
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="队列处理间隔"
                  addonAfter="秒"
                />
              </Form.Item>

              <Form.Item
                label={
                  <Space>
                    <span>定时任务检查间隔</span>
                    <Tooltip title="检查是否有新的定时任务需要执行的间隔时间">
                      <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
                    </Tooltip>
                  </Space>
                }
                name="scheduled_check_interval"
                rules={[
                  { required: true, message: '请输入检查间隔时间' },
                  { type: 'number', min: 10, max: 600, message: '检查间隔必须在10-600秒之间' }
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="定时任务检查间隔"
                  addonAfter="秒"
                />
              </Form.Item>

              <Form.Item
                label={
                  <Space>
                    <span>最大重试次数</span>
                    <Tooltip title="邮件发送失败时的最大重试次数">
                      <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
                    </Tooltip>
                  </Space>
                }
                name="max_retry_attempts"
                rules={[
                  { required: true, message: '请输入最大重试次数' },
                  { type: 'number', min: 0, max: 10, message: '重试次数必须在0-10之间' }
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="发送失败时的重试次数"
                  addonAfter="次"
                />
              </Form.Item>

              <Divider />

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    loading={saving}
                  >
                    保存配置
                  </Button>
                  <Button
                    onClick={handleReset}
                    disabled={saving}
                  >
                    重置
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col span={8}>
          <Card title="当前配置概览">
            {config && (
              <Descriptions column={1} size="small">
                <Descriptions.Item label="批量大小">
                  <Text strong>{config.queue_batch_size.value}</Text> 封邮件/批次
                </Descriptions.Item>
                <Descriptions.Item label="处理间隔">
                  <Text strong>{config.queue_interval_seconds.value}</Text> 秒
                </Descriptions.Item>
                <Descriptions.Item label="检查间隔">
                  <Text strong>{config.scheduled_check_interval.value}</Text> 秒
                </Descriptions.Item>
                <Descriptions.Item label="最大重试">
                  <Text strong>{config.max_retry_attempts.value}</Text> 次
                </Descriptions.Item>
              </Descriptions>
            )}
          </Card>

          <Card title="性能建议" style={{ marginTop: 16 }}>
            <div style={{ fontSize: '12px', lineHeight: 1.6 }}>
              <div style={{ marginBottom: 8 }}>
                <Text strong>📈 提升处理速度:</Text>
                <br />增大批量大小，减少处理间隔
              </div>
              <div style={{ marginBottom: 8 }}>
                <Text strong>💾 节省系统资源:</Text>
                <br />减小批量大小，增加处理间隔
              </div>
              <div style={{ marginBottom: 8 }}>
                <Text strong>⚡ 推荐配置:</Text>
                <br />批量大小: 10-20，间隔: 5-10秒
              </div>
              <div>
                <Text strong>🔄 重试建议:</Text>
                <br />一般设置为2-3次即可
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default SystemConfig; 