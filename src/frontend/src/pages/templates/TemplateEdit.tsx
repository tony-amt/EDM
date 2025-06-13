import React, { useState, useEffect } from 'react';
import { Typography, Card, Spin, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import TemplateForm from './components/TemplateForm';
import axios from '../../utils/axios';
import { API_URL } from '../../config/constants';

const { Title } = Typography;

const TemplateEdit: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [template, setTemplate] = useState<any>(null);
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // 获取模板详情
  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        const response = await axios.get(`${API_URL}/templates/${id}`);
        setTemplate(response.data);
      } catch (error) {
        console.error('获取模板详情失败', error);
        message.error('获取模板详情失败');
        navigate('/templates');
      } finally {
        setLoading(false);
      }
    };

    fetchTemplate();
  }, [id, navigate]);

  // 提交处理
  const handleSubmit = async (values: any) => {
    try {
      await axios.put(`${API_URL}/templates/${id}`, values);
      message.success('更新模板成功');
      navigate('/templates');
    } catch (error) {
      console.error('更新模板失败', error);
      message.error('更新模板失败');
    }
  };

  if (loading) {
    return <Spin size="large" />;
  }

  return (
    <div>
      <Title level={4}>编辑邮件模板</Title>
      <Card>
        {template && (
          <TemplateForm
            initialValues={template}
            onSubmit={handleSubmit}
          />
        )}
      </Card>
    </div>
  );
};

export default TemplateEdit; 