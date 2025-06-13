import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Button,
  Space,
  Table,
  Select,
  InputNumber,
  message
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from '../../../utils/axios';
import { API_URL } from '../../../config/constants';

interface Template {
  id: string;
  name: string;
}

interface TemplateSetFormProps {
  initialValues?: any;
  onSubmit: (values: any) => void;
}

const TemplateSetForm: React.FC<TemplateSetFormProps> = ({
  initialValues,
  onSubmit
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateItems, setTemplateItems] = useState<any[]>([]);

  // 获取所有模板
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await axios.get(`${API_URL}/templates`, {
          params: { limit: 100 }
        });
        setTemplates(response.data.items || []);
      } catch (error) {
        console.error('获取模板列表失败', error);
        message.error('获取模板列表失败');
      }
    };

    fetchTemplates();
  }, []);

  // 初始化模板项
  useEffect(() => {
    if (initialValues && initialValues.items) {
      setTemplateItems(initialValues.items.map((item: any) => ({
        ...item,
        key: item.template_id
      })));
    }
  }, [initialValues]);

  // 表单提交
  const handleFinish = (values: any) => {
    const formData = {
      name: values.name,
      items: templateItems.map(item => ({
        template_id: item.template_id,
        order: item.order
      }))
    };

    onSubmit(formData);
  };

  // 添加模板项
  const handleAddItem = () => {
    if (templates.length === 0) {
      message.warning('没有可用的模板');
      return;
    }

    // 检查是否已经添加了所有模板
    if (templateItems.length >= templates.length) {
      message.warning('已添加所有可用模板');
      return;
    }

    // 找到第一个未被添加的模板
    const availableTemplates = templates.filter(
      template => !templateItems.some(item => item.template_id === template.id)
    );

    if (availableTemplates.length === 0) {
      message.warning('没有可用的模板');
      return;
    }

    const newTemplate = availableTemplates[0];
    const newItem = {
      key: newTemplate.id,
      template_id: newTemplate.id,
      template_name: newTemplate.name,
      order: templateItems.length + 1
    };

    setTemplateItems([...templateItems, newItem]);
  };

  // 删除模板项
  const handleRemoveItem = (key: string) => {
    setTemplateItems(templateItems.filter(item => item.key !== key));
  };

  // 更新模板项
  const handleUpdateItem = (record: any, field: string, value: any) => {
    const newItems = templateItems.map(item => {
      if (item.key === record.key) {
        return { ...item, [field]: value };
      }
      return item;
    });
    setTemplateItems(newItems);
  };

  // 表格列定义
  const columns = [
    {
      title: '序号',
      dataIndex: 'order',
      key: 'order',
      width: 100,
      render: (text: number, record: any) => (
        <InputNumber
          min={1}
          value={text}
          onChange={(value) => handleUpdateItem(record, 'order', value)}
        />
      )
    },
    {
      title: '模板',
      dataIndex: 'template_id',
      key: 'template_id',
      render: (text: string, record: any) => (
        <Select
          style={{ width: '100%' }}
          value={text}
          onChange={(value) => {
            const selectedTemplate = templates.find(t => t.id === value);
            handleUpdateItem(record, 'template_id', value);
            if (selectedTemplate) {
              handleUpdateItem(record, 'template_name', selectedTemplate.name);
            }
          }}
        >
          {templates.map(template => (
            <Select.Option 
              key={template.id} 
              value={template.id}
              disabled={templateItems.some(
                item => item.template_id === template.id && item.key !== record.key
              )}
            >
              {template.name}
            </Select.Option>
          ))}
        </Select>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: any) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveItem(record.key)}
        />
      )
    }
  ];

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ name: initialValues?.name || '' }}
      onFinish={handleFinish}
    >
      <Form.Item
        name="name"
        label="模板集名称"
        rules={[{ required: true, message: '请输入模板集名称' }]}
      >
        <Input placeholder="请输入模板集名称" />
      </Form.Item>

      <div style={{ marginBottom: 16 }}>
        <Button 
          type="dashed" 
          onClick={handleAddItem} 
          block 
          icon={<PlusOutlined />}
        >
          添加模板
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={templateItems}
        rowKey="key"
        pagination={false}
      />

      <Form.Item style={{ marginTop: 16 }}>
        <Space>
          <Button type="primary" htmlType="submit" loading={loading}>
            {initialValues ? '更新' : '创建'}
          </Button>
          <Button htmlType="button" onClick={() => form.resetFields()}>
            重置
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default TemplateSetForm; 