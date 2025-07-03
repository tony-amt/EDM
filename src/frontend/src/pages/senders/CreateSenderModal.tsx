import React, { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  message,
  Row,
  Col,
  Alert
} from 'antd';
import senderService, { CreateSenderData } from '../../services/sender.service';

interface CreateSenderModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

const CreateSenderModal: React.FC<CreateSenderModalProps> = ({
  visible,
  onCancel,
  onSuccess
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // 提交表单
  const handleSubmit = async (values: CreateSenderData) => {
    setLoading(true);
    try {
      const response = await senderService.create(values);
      if (response.success) {
        message.success('发信人创建成功');
        form.resetFields();
        onSuccess();
      } else {
        message.error(response.message || '创建失败');
      }
    } catch (error) {
      console.error('创建发信人失败:', error);
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
      title="添加发信人"
      open={visible}
      onCancel={handleCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width={600}
      destroyOnClose
    >
      <Alert
        message="发信人说明"
        description="发信人将用作邮件的发送者身份。建议使用真实有效的邮箱地址，以提高邮件送达率。"
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
              label="发信人名称"
              name="name"
              rules={[
                { required: true, message: '请输入发信人名称' },
                { max: 100, message: '名称长度不能超过100字符' },
                {
                  pattern: /^[a-zA-Z0-9\u4e00-\u9fa5\s._-]+$/,
                  message: '名称只能包含字母、数字、中文、空格、点、下划线和横线'
                }
              ]}
            >
              <Input placeholder="如：EDM系统" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="邮箱地址"
              name="email"
              rules={[
                { required: true, message: '请输入邮箱地址' },
                { type: 'email', message: '请输入有效的邮箱地址' },
                { max: 255, message: '邮箱长度不能超过255字符' }
              ]}
            >
              <Input placeholder="如：noreply@example.com" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          label="自定义域名"
          name="domain"
          extra="可选项。如果填写，将使用 名称@域名 的格式作为发信地址"
          rules={[
            { max: 255, message: '域名长度不能超过255字符' },
            {
              pattern: /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
              message: '请输入有效的域名格式，如：example.com'
            }
          ]}
        >
          <Input placeholder="如：yourcompany.com（可选）" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateSenderModal; 