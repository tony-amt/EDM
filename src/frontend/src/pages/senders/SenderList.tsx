import React, { useState, useEffect } from 'react';
import { 
  Card,
  Table,
  Button, 
  Modal,
  Input,
  message, 
  Space,
  Popconfirm,
  Form,
  Typography,
  Alert
} from 'antd';
import { PlusOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;
const { Search } = Input;

interface Sender {
  id: string;
  senderName: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  usageCount: number;
}

interface SenderListResponse {
  success: boolean;
  data: {
    items: Sender[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
}

const SenderList: React.FC = () => {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  // 获取发信人列表
  const fetchSenders = async (page = 1, pageSize = 20, keyword = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        ...(keyword && { keyword }),
      });

      const response = await fetch(`/api/senders?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        // 转换数据格式以匹配前端期望
        const senders = (result.data || []).map((sender: any) => ({
          id: sender.id,
          senderName: sender.name,
          createdBy: sender.user_id,
          createdByName: 'admin', // 可以后续从用户表获取
          createdAt: sender.created_at,
          usageCount: 0 // 可以后续从任务表统计
        }));
        
        setSenders(senders);
        // 发信人API目前没有分页，暂时设置默认值
        setPagination({
          current: 1,
          pageSize: 20,
          total: senders.length,
        });
      } else {
        message.error('获取发信人列表失败');
      }
    } catch (error) {
      console.error('获取发信人列表失败:', error);
      message.error('网络请求失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 创建发信人
  const handleCreateSender = async (values: { senderName: string }) => {
    try {
      const response = await fetch('/api/senders', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: values.senderName
        }),
      });

      const result = await response.json();

      if (result.success) {
        message.success('发信人创建成功');
        setModalVisible(false);
        form.resetFields();
        fetchSenders(pagination.current, pagination.pageSize, searchKeyword);
      } else {
        if (result.error?.code === 'SENDER_NAME_EXISTS') {
          message.error('发信人名称已存在');
        } else if (result.error?.code === 'SENDER_NAME_INVALID') {
          message.error('发信人名称格式不合法（只能包含字母、数字、点号、连字符、下划线）');
        } else {
          message.error(result.error?.message || '创建失败');
        }
      }
    } catch (error) {
      console.error('创建发信人失败:', error);
      message.error('操作失败，请重试');
    }
  };

  // 删除发信人
  const handleDeleteSender = async (senderId: string) => {
    try {
      const response = await fetch(`/api/senders/${senderId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        message.success('发信人删除成功');
        fetchSenders(pagination.current, pagination.pageSize, searchKeyword);
      } else {
        if (result.error?.code === 'SENDER_IN_USE') {
          message.error('该发信人正在被任务使用，无法删除');
        } else if (result.error?.code === 'PERMISSION_DENIED') {
          message.error('无权删除该发信人');
          } else {
          message.error(result.error?.message || '删除失败');
        }
          }
        } catch (error) {
          console.error('删除发信人失败:', error);
      message.error('操作失败，请重试');
        }
  };

  // 搜索处理
  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchSenders(1, pagination.pageSize, value);
  };

  // 表格列配置
  const columns: ColumnsType<Sender> = [
    {
      title: '发信人名称',
      dataIndex: 'senderName',
      key: 'senderName',
      width: 200,
    },
    {
      title: '创建人',
      dataIndex: 'createdByName',
      key: 'createdByName',
      width: 120,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '关联任务数',
      dataIndex: 'usageCount',
      key: 'usageCount',
      width: 120,
      align: 'center',
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      align: 'center',
      render: (_, record) => (
        <Popconfirm
          title={
            record.usageCount > 0 
              ? `该发信人正在被${record.usageCount}个任务使用，确定要删除吗？`
              : '确定要删除这个发信人吗？'
          }
          onConfirm={() => handleDeleteSender(record.id)}
          okText="确定"
          cancelText="取消"
          disabled={record.usageCount > 0}
        >
            <Button
            type="link" 
              danger
              icon={<DeleteOutlined />}
            disabled={record.usageCount > 0}
          >
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  // 表格分页处理
  const handleTableChange = (page: number, pageSize?: number) => {
    const newPageSize = pageSize || pagination.pageSize;
    setPagination(prev => ({ ...prev, current: page, pageSize: newPageSize }));
    fetchSenders(page, newPageSize, searchKeyword);
  };

  // 发信人名称验证规则
  const senderNameValidator = (_: any, value: string) => {
    if (!value) {
      return Promise.reject('请输入发信人名称');
    }
    // 发信人名称格式验证：只能包含字母、数字、点号、连字符、下划线
    const pattern = /^[a-zA-Z0-9._-]+$/;
    if (!pattern.test(value)) {
      return Promise.reject('发信人名称只能包含字母、数字、点号(.)、连字符(-)、下划线(_)');
    }
    if (value.length > 64) {
      return Promise.reject('发信人名称长度不能超过64个字符');
    }
    return Promise.resolve();
  };

  useEffect(() => {
    fetchSenders();
  }, []);

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={4} style={{ margin: 0 }}>发信人管理</Title>
            <Space>
              <Search
                placeholder="搜索发信人名称"
                allowClear
                onSearch={handleSearch}
                style={{ width: 300 }}
                enterButton={<SearchOutlined />}
              />
          <Button
            type="primary"
            icon={<PlusOutlined />}
                onClick={() => setModalVisible(true)}
          >
                新增发信人
          </Button>
            </Space>
          </div>
        </div>

        <Alert
          message="说明"
          description="发信人名称将用于生成发信地址（发信人名称@发信服务域名），请确保名称符合邮箱规范。发信人名称在全系统范围内唯一，不可重复。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Table
          columns={columns}
          dataSource={senders}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: handleTableChange,
            onShowSizeChange: handleTableChange,
          }}
        />
      </Card>

      <Modal
        title="新增发信人"
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateSender}
        >
          <Form.Item
            label="发信人名称"
            name="senderName"
            rules={[
              { validator: senderNameValidator }
            ]}
            extra="只能包含字母、数字、点号(.)、连字符(-)、下划线(_)，长度1-64个字符"
          >
            <Input 
              placeholder="例如：marketing-team"
              maxLength={64}
            />
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                创建
              </Button>
              <Button onClick={() => {
                setModalVisible(false);
                form.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SenderList; 