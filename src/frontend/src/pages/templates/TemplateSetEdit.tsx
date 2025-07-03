import React, { useState, useEffect } from 'react';
import { Typography, Card, Spin, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import axios from '../../utils/axios';
import { API_URL } from '../../config/constants';
import TemplateSetForm from './components/TemplateSetForm';

const { Title } = Typography;

const TemplateSetEdit: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [templateSet, setTemplateSet] = useState<any>(null);
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // 获取模板集详情
  useEffect(() => {
    const fetchTemplateSet = async () => {
      try {
        const response = await axios.get(`${API_URL}/template-sets/${id}`);
        setTemplateSet(response.data);
      } catch (error) {
        console.error('获取模板集详情失败', error);
        message.error('获取模板集详情失败');
        navigate('/template-sets');
      } finally {
        setLoading(false);
      }
    };

    fetchTemplateSet();
  }, [id, navigate]);

  // 提交处理
  const handleSubmit = async (values: any) => {
    try {
      await axios.put(`${API_URL}/template-sets/${id}`, values);
      message.success('更新模板集成功');
      navigate('/template-sets');
    } catch (error) {
      console.error('更新模板集失败', error);
      message.error('更新模板集失败');
    }
  };

  if (loading) {
    return <Spin size="large" />;
  }

  return (
    <div>
      <Title level={4}>编辑模板集</Title>
      <Card>
        {templateSet && (
          <TemplateSetForm
            initialValues={templateSet}
            onSubmit={handleSubmit}
          />
        )}
      </Card>
    </div>
  );
};

export default TemplateSetEdit; 