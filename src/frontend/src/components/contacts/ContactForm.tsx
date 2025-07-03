import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Row, Col, Select, Space } from 'antd';
import { MailOutlined, UserOutlined } from '@ant-design/icons';
import axios from '../../utils/axios';
import { API_URL } from '../../config/constants';
import ParentTagSelector from './ParentTagSelector';

// 导入类型和服务将在实际项目中添加

interface ContactFormProps {
  initialValues?: any;
  onFinish: (values: any) => void;
  onCancel?: () => void;
  loading?: boolean;
  mode?: 'create' | 'edit';
}

const { Option } = Select;
const { TextArea } = Input;

const ContactForm: React.FC<ContactFormProps> = ({
  initialValues,
  onFinish,
  onCancel,
  loading = false,
  mode = 'create'
}) => {
  const [form] = Form.useForm();
  const [tags, setTags] = useState<any[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);

  // 🔧 修复初始值更新问题：监听initialValues变化并更新表单
  useEffect(() => {
    if (initialValues && mode === 'edit') {
      // 处理标签数据格式转换
      const formValues = {
        ...initialValues,
        // 如果标签是对象数组，转换为ID数组
        tags: initialValues.tags ? 
          (Array.isArray(initialValues.tags) ? 
            initialValues.tags.map((tag: any) => typeof tag === 'object' ? tag.id : tag) 
            : []) 
          : []
      };
      
      console.log('设置表单初始值:', formValues);
      console.log('原始标签数据:', initialValues.tags);
      form.setFieldsValue(formValues);
    }
  }, [initialValues, form, mode]);

  // 获取标签列表
  useEffect(() => {
    const fetchTags = async () => {
      setLoadingTags(true);
      try {
        const response = await axios.get(`${API_URL}/tags`);
        console.log('获取标签数据:', response.data);
        if (response.data && response.data.success && response.data.data) {
          setTags(response.data.data);
        } else if (response.data.data && Array.isArray(response.data.data)) {
          setTags(response.data.data);
        } else if (Array.isArray(response.data)) {
          setTags(response.data);
        } else {
          console.warn('标签数据格式不正确:', response.data);
          setTags([]);
        }
      } catch (error) {
        console.error('获取标签列表失败:', error);
        setTags([]);
      } finally {
        setLoadingTags(false);
      }
    };

    fetchTags();
  }, []);

  // 重置表单
  const handleReset = () => {
    form.resetFields();
  };

  // 处理表单提交，确保数据格式正确
  const handleFinish = (values: any) => {
    console.log('表单提交数据:', values);
    onFinish(values);
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initialValues || {
        status: 'active',
        source: 'manual',
        tags: []
      }}
      onFinish={handleFinish}
    >
      <Card title="基本信息" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="email"
              label="邮箱"
              rules={[
                { required: true, message: '请输入邮箱地址' },
                { type: 'email', message: '请输入有效的邮箱地址' }
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="请输入邮箱地址" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="username"
              label="用户名"
            >
              <Input prefix={<UserOutlined />} placeholder="请输入用户名" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="status"
              label="状态"
              rules={[{ required: true, message: '请选择状态' }]}
            >
              <Select placeholder="请选择状态">
                <Option value="active">正常</Option>
                <Option value="inactive">未激活</Option>
                <Option value="bounced">退信</Option>
                <Option value="unsubscribed">已退订</Option>
                <Option value="complained">投诉</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="source"
              label="来源"
              rules={[{ required: true, message: '请选择来源' }]}
            >
              <Select placeholder="请选择来源">
                <Option value="manual">手动添加</Option>
                <Option value="import">导入</Option>
                <Option value="api">API</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
      </Card>

      <Card title="社交媒体账号" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="tikTokId"
              label="TikTok ID"
            >
              <Input placeholder="请输入TikTok ID" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="insId"
              label="Instagram ID"
            >
              <Input placeholder="请输入Instagram ID" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="youtubeId"
              label="YouTube ID"
            >
              <Input placeholder="请输入YouTube ID" />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      <Card title="自定义字段" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="customField1"
              label="自定义字段1"
            >
              <Input placeholder="请输入自定义字段1" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="customField2"
              label="自定义字段2"
            >
              <Input placeholder="请输入自定义字段2" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="customField3"
              label="自定义字段3"
            >
              <Input placeholder="请输入自定义字段3" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="customField4"
              label="自定义字段4"
            >
              <Input placeholder="请输入自定义字段4" />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      <Card title="标签与备注" style={{ marginBottom: 16 }}>
        <Form.Item
          name="tags"
          label="标签"
          rules={[{ type: 'array' }]}
        >
          <ParentTagSelector
            value={form.getFieldValue('tags') || []}
            onChange={(selectedKeys: string[]) => {
              form.setFieldValue('tags', selectedKeys);
            }}
            maxTagCount={10}
            placeholder="请选择或输入标签名称（仅支持一级标签）"
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item
          name="notes"
          label="备注"
        >
          <TextArea
            placeholder="请输入备注信息"
            autoSize={{ minRows: 3, maxRows: 6 }}
          />
        </Form.Item>
      </Card>

      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={loading}>
            {mode === 'create' ? '创建联系人' : '保存修改'}
          </Button>
          <Button htmlType="button" onClick={handleReset}>
            重置
          </Button>
          {onCancel && (
            <Button htmlType="button" onClick={onCancel}>
              取消
            </Button>
          )}
        </Space>
      </Form.Item>
    </Form>
  );
};

export default ContactForm; 