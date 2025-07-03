import React, { useState } from 'react';
import {
  Modal,
  Form,
  InputNumber,
  Input,
  message,
  Alert,
  Space,
  Tag
} from 'antd';
import { DollarOutlined, UserOutlined } from '@ant-design/icons';
import userManagementService, { UserInfo, AllocateQuotaData } from '../../services/user-management.service';

interface AllocateQuotaModalProps {
  visible: boolean;
  user: UserInfo | null;
  onCancel: () => void;
  onSuccess: () => void;
}

const AllocateQuotaModal: React.FC<AllocateQuotaModalProps> = ({
  visible,
  user,
  onCancel,
  onSuccess
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // 提交表单
  const handleSubmit = async (values: AllocateQuotaData) => {
    if (!user) return;

    setLoading(true);
    try {
      const response = await userManagementService.allocateQuota(user.id, values);
      if (response.success) {
        message.success(`成功为用户 ${user.username} 分配 ${values.amount} 个额度`);
        form.resetFields();
        onSuccess();
      } else {
        message.error(response.message || '额度分配失败');
      }
    } catch (error) {
      console.error('分配额度失败:', error);
      message.error('分配额度失败');
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
      title={
        <Space>
          <DollarOutlined />
          分配用户额度
        </Space>
      }
      open={visible}
      onCancel={handleCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width={500}
      destroyOnClose
    >
      {user && (
        <>
          <Alert
            message="用户信息"
            description={
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <UserOutlined /> 用户名: <strong>{user.username}</strong>
                </div>
                <div>
                  邮箱: {user.email}
                </div>
                <div>
                  当前额度: <Tag color="blue">{user.remaining_quota.toLocaleString()}</Tag>
                </div>
              </Space>
            }
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
              amount: 1000
            }}
          >
            <Form.Item
              label="分配额度数量"
              name="amount"
              rules={[
                { required: true, message: '请输入分配额度数量' },
                { type: 'number', min: 1, max: 1000000, message: '额度数量应在1-1000000之间' }
              ]}
            >
              <InputNumber
                style={{ width: '100%' }}
                placeholder="请输入额度数量"
                min={1}
                max={1000000}
                addonAfter="个"
              />
            </Form.Item>

            <Form.Item
              label="分配原因"
              name="reason"
              rules={[
                { max: 255, message: '原因长度不能超过255字符' }
              ]}
            >
              <Input.TextArea
                placeholder="请输入分配原因（可选）"
                rows={3}
                maxLength={255}
                showCount
              />
            </Form.Item>
          </Form>
        </>
      )}
    </Modal>
  );
};

export default AllocateQuotaModal; 