import React from 'react';
import { Typography, Card, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import axios from '../../utils/axios';
import { API_URL } from '../../config/constants';
import TemplateSetForm from './components/TemplateSetForm';

const { Title } = Typography;

const TemplateSetCreate: React.FC = () => {
  const navigate = useNavigate();

  // 提交处理
  const handleSubmit = async (values: any) => {
    try {
      await axios.post(`${API_URL}/template-sets`, values);
      message.success('创建模板集成功');
      navigate('/template-sets');
    } catch (error) {
      console.error('创建模板集失败', error);
      message.error('创建模板集失败');
    }
  };

  return (
    <div>
      <Title level={4}>创建模板集</Title>
      <Card>
        <TemplateSetForm onSubmit={handleSubmit} />
      </Card>
    </div>
  );
};

export default TemplateSetCreate; 