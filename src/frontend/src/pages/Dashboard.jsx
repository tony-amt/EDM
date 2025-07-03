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
      
      // 🔧 使用统一的仪表盘API
      const response = await axios.get(`${API_URL}/dashboard/stats`);
      
      console.log('仪表盘API响应:', response.data);

      if (response.data.success) {
        setStats(response.data.data);
      } else {
        throw new Error(response.data.message || '获取仪表盘数据失败');
      }
      
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