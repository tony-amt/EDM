import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Button, Spin, Alert } from 'antd';
import { UserOutlined, TagOutlined, MailOutlined, FileTextOutlined, SendOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import { API_URL } from '../config/constants';

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    contacts: 0,
    tags: 0,
    templates: 0,
    tasks: 0,
    recentContacts: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    fetchDashboardData();
  }, []);
  
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('开始获取Dashboard数据...');
      
      // 🔧 修复API调用，使用正确的端点和数据格式
      const responses = await Promise.allSettled([
        // 获取联系人统计
        axios.get(`${API_URL}/contacts`, { params: { limit: 1 } }),
        // 获取标签数量
        axios.get(`${API_URL}/tags`, { params: { limit: 1 } }),
        // 获取模板数量
        axios.get(`${API_URL}/templates`, { params: { limit: 1 } }),
        // 获取任务数量
        axios.get(`${API_URL}/tasks`, { params: { limit: 1 } }),
        // 获取最新联系人
        axios.get(`${API_URL}/contacts`, { params: { limit: 5, sort: 'created_at', order: 'desc' } })
      ]);

      console.log('API响应结果:', responses);

      const newStats = { ...stats };

      // 处理联系人数量
      if (responses[0].status === 'fulfilled') {
        const contactData = responses[0].value.data;
        newStats.contacts = contactData.pagination?.total || contactData.total || 0;
      }

      // 处理标签数量
      if (responses[1].status === 'fulfilled') {
        const tagData = responses[1].value.data;
        newStats.tags = tagData.pagination?.total || tagData.total || (tagData.data?.length || 0);
      }

      // 处理模板数量
      if (responses[2].status === 'fulfilled') {
        const templateData = responses[2].value.data;
        newStats.templates = templateData.pagination?.total || templateData.total || (templateData.data?.length || 0);
      }

      // 处理任务数量
      if (responses[3].status === 'fulfilled') {
        const taskData = responses[3].value.data;
        newStats.tasks = taskData.pagination?.total || taskData.total || (taskData.data?.length || 0);
      }

      // 处理最新联系人
      if (responses[4].status === 'fulfilled') {
        const recentData = responses[4].value.data;
        newStats.recentContacts = recentData.data || [];
      }

      console.log('处理后的统计数据:', newStats);
      setStats(newStats);
      
    } catch (error) {
      console.error('获取仪表盘数据错误:', error);
      setError('获取数据失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };
  
  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (text) => text || '未设置'
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => {
        if (!text) return '未知';
        try {
          return new Date(text).toLocaleString('zh-CN');
        } catch (e) {
          return '时间格式错误';
        }
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button 
          type="link" 
          onClick={() => navigate(`/contacts/${record.id}`)}
        >
          查看
        </Button>
      ),
    }
  ];

  if (error) {
    return (
      <div className="dashboard">
        <h1>仪表盘</h1>
        <Alert
          message="数据加载失败"
          description={error}
          type="error"
          action={
            <Button size="small" onClick={fetchDashboardData}>
              重试
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="dashboard">
      <h1>仪表盘</h1>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="联系人总数"
              value={stats.contacts}
              loading={loading}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="标签总数"
              value={stats.tags}
              loading={loading}
              prefix={<TagOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="邮件模板数"
              value={stats.templates}
              loading={loading}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="邮件任务数"
              value={stats.tasks}
              loading={loading}
              prefix={<SendOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card 
        title="最新添加的联系人" 
        extra={
          <Button type="link" onClick={() => navigate('/contacts')}>
            查看全部
          </Button>
        }
      >
        <Table 
          columns={columns} 
          dataSource={stats.recentContacts}
          rowKey="id"
          loading={loading}
          pagination={false}
          locale={{ emptyText: '暂无联系人数据' }}
        />
      </Card>
    </div>
  );
};

export default Dashboard; 