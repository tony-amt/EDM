import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  message,
  Alert,
  Space,
  Tag
} from 'antd';
import { UserOutlined, CrownOutlined } from '@ant-design/icons';
import userManagementService, { UserInfo, UpdateUserData } from '../../services/user-management.service';

const { Option } = Select;

interface EditUserModalProps {
  visible: boolean;
  user: UserInfo | null;
  onCancel: () => void;
  onSuccess: () => void;
}

const EditUserModal: React.FC<EditUserModalProps> = ({
  visible,
  user,
  onCancel,
  onSuccess
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // 当用户数据变化时，更新表单
  useEffect(() => {
    if (user && visible) {
      form.setFieldsValue({
        role: user.role,
        email: user.email
      });
    }
  }, [user, visible, form]);

  // 提交表单
  const handleSubmit = async (values: UpdateUserData) => {
    if (!user) return;

    setLoading(true);
    try {
      const response = await userManagementService.update(user.id, values);
      if (response.success) {
        message.success('用户信息更新成功');
        onSuccess();
      } else {
        message.error(response.message || '更新失败');
      }
    } catch (error) {
      console.error('更新用户信息失败:', error);
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
      title={
        <Space>
          <UserOutlined />
          编辑用户信息
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
                  创建时间: {new Date(user.created_at).toLocaleString('zh-CN')}
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
          >
            <Form.Item
              label="用户角色"
              name="role"
              rules={[
                { required: true, message: '请选择用户角色' }
              ]}
            >
              <Select placeholder="请选择用户角色">
                <Option value="user">
                  <Space>
                    <UserOutlined />
                    普通用户
                  </Space>
                </Option>
                <Option value="admin">
                  <Space>
                    <CrownOutlined />
                    管理员
                  </Space>
                </Option>
              </Select>
            </Form.Item>

            <Form.Item
              label="邮箱地址"
              name="email"
              rules={[
                { required: true, message: '请输入邮箱地址' },
                { type: 'email', message: '请输入有效的邮箱地址' },
                { max: 255, message: '邮箱长度不能超过255字符' }
              ]}
            >
              <Input placeholder="请输入邮箱地址" />
            </Form.Item>
          </Form>
        </>
      )}
    </Modal>
  );
};

export default EditUserModal; 