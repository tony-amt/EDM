import React, { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Row,
  Col,
  Alert,
  Button
} from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';
import emailServiceService, { CreateEmailServiceData } from '../../services/email-service.service';

const { Option } = Select;

interface CreateEmailServiceModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

const CreateEmailServiceModal: React.FC<CreateEmailServiceModalProps> = ({
  visible,
  onCancel,
  onSuccess
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  // 测试服务连接
  const handleTestConnection = async () => {
    try {
      const values = await form.validateFields([
        'provider', 'domain', 'api_key', 'api_secret'
      ]);
      
      setTesting(true);
      
      const response = await fetch('/api/email-services/test-connection', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: values.provider,
          domain: values.domain,
          api_key: values.api_key,
          api_secret: values.api_secret
        }),
      });

      const result = await response.json();

      if (result.success) {
        message.success({
          content: `测试邮件发送成功！请检查邮箱 376101593@qq.com`,
          duration: 5
        });
      } else {
        message.error(result.error || '测试邮件发送失败，请检查API配置或网络连接');
      }
    } catch (error: any) {
      if (error.errorFields) {
        message.error('请先完成必填字段');
      } else {
        console.error('连接测试失败:', error);
        message.error('连接测试失败，请重试');
      }
    } finally {
      setTesting(false);
    }
  };

  // 提交表单
  const handleSubmit = async (values: CreateEmailServiceData) => {
    setLoading(true);
    try {
      const response = await emailServiceService.create(values);
      if (response.success) {
        message.success('发信服务创建成功');
        form.resetFields();
        onSuccess();
      } else {
        message.error(response.message || '创建失败');
      }
    } catch (error) {
      console.error('创建发信服务失败:', error);
      message.error('创建失败');
    } finally {
      setLoading(false);
    }
  };

  // 取消操作
  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title="添加发信服务"
      open={visible}
      onCancel={handleCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width={700}
      destroyOnClose
    >
      <Alert
        message="服务配置说明"
        description="请填写真实有效的EngageLab API配置。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        preserve={false}
        initialValues={{
          provider: 'engagelab',
          daily_quota: 1000,
          sending_rate: 60
        }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="服务名称"
              name="name"
              rules={[
                { required: true, message: '请输入服务名称' },
                { max: 100, message: '名称长度不能超过100字符' }
              ]}
            >
              <Input placeholder="如：阿里云邮件推送" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="服务商"
              name="provider"
              rules={[
                { required: true, message: '请选择服务商' }
              ]}
            >
              <Select placeholder="请选择服务商" defaultValue="engagelab">
                <Option value="engagelab">
                  <div>
                    <div style={{ fontWeight: 'bold' }}>EngageLab</div>
                  </div>
                </Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="发信域名"
              name="domain"
              rules={[
                { required: true, message: '请输入发信域名' },
                { max: 255, message: '域名长度不能超过255字符' },
                {
                  pattern: /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                  message: '请输入有效的域名格式'
                }
              ]}
            >
              <Input placeholder="如：mail.yourcompany.com" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="每日额度"
              name="daily_quota"
              rules={[
                { required: true, message: '请输入每日额度' },
                { type: 'number', min: 1, message: '额度必须大于0' }
              ]}
            >
              <InputNumber
                style={{ width: '100%' }}
                placeholder="如：10000"
                min={1}
                max={1000000}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="API用户名"
              name="api_key"
              rules={[
                { required: true, message: '请输入API用户名' },
                { max: 500, message: 'API用户名长度不能超过500字符' }
              ]}
            >
              <Input placeholder="请输入API用户名" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="API密钥"
              name="api_secret"
              rules={[
                { required: true, message: '请输入API密钥' },
                { max: 500, message: 'API密钥长度不能超过500字符' }
              ]}
            >
              <Input.Password placeholder="请输入API密钥" />
            </Form.Item>
          </Col>
        </Row>

        <div style={{ marginBottom: 16 }}>
          <Button
            type="default"
            onClick={handleTestConnection}
            loading={testing}
            style={{ marginTop: 16 }}
          >
            {testing ? '发送测试邮件中...' : '发送测试邮件'}
          </Button>
          <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
            点击后将向 376101593@qq.com 发送测试邮件
          </div>
        </div>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="发送速率(秒/封)"
              name="sending_rate"
              rules={[
                { required: true, message: '请输入发送频率' },
                { type: 'number', min: 1, max: 300, message: '发送频率范围为1-300秒' }
              ]}
              tooltip="两封邮件之间的时间间隔（秒）"
            >
              <InputNumber
                style={{ width: '100%' }}
                placeholder="间隔秒数"
                min={1}
                max={300}
                addonAfter="秒/封"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="额度重置时间"
              name="quota_reset_time"
              rules={[{ required: true, message: '请输入重置时间' }]}
              tooltip="每日额度重置的时间点，格式：HH:mm"
              initialValue="00:00"
            >
              <Input 
                placeholder="00:00"
                style={{ width: '100%' }}
                pattern="^([01]\d|2[0-3]):([0-5]\d)$"
              />
            </Form.Item>
          </Col>
        </Row>

        <Alert
          message="邮件服务配置说明"
          description={
            <div>
              <p>• <strong>每日发送额度</strong>：该服务每天最多可发送的邮件数量</p>
              <p>• <strong>发送频率</strong>：为避免被邮件服务商限制，每封邮件之间的间隔时间</p>
              <p>• <strong>额度重置时间</strong>：每天重置已用额度的时间点，重置后可继续发送邮件</p>
              <p>• <strong>当日剩余额度</strong>：服务创建后会显示实时剩余额度，帮助监控发送状态</p>
            </div>
          }
          type="info"
          showIcon
          style={{ marginTop: 16 }}
        />
      </Form>
    </Modal>
  );
};

export default CreateEmailServiceModal; 