import React, { useState, useEffect } from 'react';
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
import emailServiceService, { EmailService, UpdateEmailServiceData } from '../../services/email-service.service';

const { Option } = Select;

interface EditEmailServiceModalProps {
  visible: boolean;
  service: EmailService | null;
  onCancel: () => void;
  onSuccess: () => void;
}

const EditEmailServiceModal: React.FC<EditEmailServiceModalProps> = ({
  visible,
  service,
  onCancel,
  onSuccess
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  // 当Modal打开且有服务数据时，设置表单值
  useEffect(() => {
    if (visible && service) {
      console.log('设置表单数据:', service); // 调试日志
      // 延迟一帧确保Form组件完全渲染
      setTimeout(() => {
        form.setFieldsValue({
          name: service.name,
          provider: service.provider,
          domain: service.domain,
          api_key: service.api_key,
          api_secret: '',  // 编辑时不显示原密钥
          daily_quota: service.daily_quota,
          sending_rate: service.sending_rate,
          quota_reset_time: service.quota_reset_time || '00:00'
        });
      }, 0);
    }
  }, [visible, service, form]);

  // 当Modal关闭时清空表单
  useEffect(() => {
    if (!visible) {
      form.resetFields();
    }
  }, [visible, form]);

  // 测试服务连接
  const handleTestConnection = async () => {
    try {
      const values = await form.validateFields([
        'provider', 'domain', 'api_key', 'api_secret'
      ]);
      
      // 如果API密钥为空，使用原有的密钥
      const testData = {
        provider: values.provider,
        domain: values.domain,
        api_key: values.api_key || service?.api_key,
        api_secret: values.api_secret || service?.api_secret
      };

      if (!testData.api_key || !testData.api_secret) {
        message.error('请填写完整的API配置信息进行测试');
        return;
      }
      
      setTesting(true);
      
      const response = await fetch('/api/email-services/test-connection', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData),
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
  const handleSubmit = async (values: UpdateEmailServiceData) => {
    if (!service) return;

    setLoading(true);
    try {
      const response = await emailServiceService.update(service.id, values);
      if (response.success) {
        message.success('发信服务更新成功');
        onSuccess();
      } else {
        message.error(response.message || '更新失败');
      }
    } catch (error) {
      console.error('更新发信服务失败:', error);
      message.error('更新失败');
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
      title="编辑发信服务"
      open={visible}
      onCancel={handleCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width={700}
      destroyOnClose={false}
      forceRender={true}
    >
      <Alert
        message="服务配置说明"
        description="修改配置后，系统将自动验证服务的可用性。如不需要修改密钥，可留空。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        preserve={false}
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
              <Select placeholder="请选择服务商" disabled>
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
              extra="如不需要修改，可留空"
              rules={[
                { max: 500, message: 'API密钥长度不能超过500字符' }
              ]}
            >
              <Input.Password placeholder="留空表示不修改" />
            </Form.Item>
          </Col>
        </Row>

        <div style={{ marginBottom: 16 }}>
          <Button
            type="default"
            onClick={handleTestConnection}
            loading={testing}
            icon={<ExperimentOutlined />}
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
                placeholder="如：60"
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
            >
              <Input 
                placeholder="00:00"
                style={{ width: '100%' }}
                pattern="^([01]\d|2[0-3]):([0-5]\d)$"
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

export default EditEmailServiceModal; 