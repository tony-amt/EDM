import React from 'react';
import { Card, Typography, Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;

const EmailServiceEdit: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/email-services')}>
          返回服务列表
        </Button>
      </div>
      
      <Card>
        <Title level={4}>编辑邮件服务</Title>
        <p>邮件服务编辑功能开发中...</p>
      </Card>
    </div>
  );
};

export default EmailServiceEdit; 