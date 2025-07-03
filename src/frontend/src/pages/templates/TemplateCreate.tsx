import React, { useState } from 'react';
import { Typography, Card, Button, Space, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftOutlined } from '@ant-design/icons';
import TemplateForm from './components/TemplateForm';
import axios from '../../utils/axios';
import { API_URL } from '../../config/constants';

const { Title } = Typography;

const TemplateCreate: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // 提交处理
  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      await axios.post(`${API_URL}/templates`, values);
      message.success('创建模板成功');
      // 提交后跳转回列表页
      navigate('/templates');
    } catch (error) {
      console.error('创建模板失败:', error);
      message.error('创建模板失败，请检查网络连接或稍后再试');
    } finally {
      setLoading(false);
    }
  };

  // 返回列表页
  const handleBack = () => {
    navigate('/templates');
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Title level={4}>创建邮件模板</Title>
        <Button 
          type="default" 
          icon={<ArrowLeftOutlined />} 
          onClick={handleBack}
        >
          返回列表
        </Button>
      </div>
      
      <Card>
        <TemplateForm onSubmit={handleSubmit} />
      </Card>
    </div>
  );
};

export default TemplateCreate; 