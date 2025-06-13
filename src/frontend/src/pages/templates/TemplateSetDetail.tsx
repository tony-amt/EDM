import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Descriptions,
  Button,
  Space,
  Spin,
  message,
  Table
} from 'antd';
import { EditOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import axios from '../../utils/axios';
import { API_URL } from '../../config/constants';

const { Title } = Typography;

interface TemplateItem {
  template_id: string;
  template_name: string;
  order: number;
}

const TemplateSetDetail: React.FC = () => {
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

  // 返回列表
  const handleBack = () => {
    navigate('/template-sets');
  };

  // 编辑模板集
  const handleEdit = () => {
    navigate(`/template-sets/edit/${id}`);
  };

  // 查看模板详情
  const handleViewTemplate = (templateId: string) => {
    navigate(`/templates/${templateId}`);
  };

  // 表格列定义
  const columns = [
    {
      title: '序号',
      dataIndex: 'order',
      key: 'order',
      width: 80
    },
    {
      title: '模板名称',
      dataIndex: 'template_name',
      key: 'template_name'
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: TemplateItem) => (
        <Button
          type="link"
          onClick={() => handleViewTemplate(record.template_id)}
        >
          查看模板
        </Button>
      )
    }
  ];

  if (loading) {
    return <Spin size="large" />;
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Title level={4}>模板集详情</Title>
        <Space>
          <Button
            type="default"
            icon={<ArrowLeftOutlined />}
            onClick={handleBack}
          >
            返回
          </Button>
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={handleEdit}
          >
            编辑
          </Button>
        </Space>
      </div>
      
      {templateSet && (
        <Card>
          <Descriptions bordered column={1}>
            <Descriptions.Item label="模板集名称">{templateSet.name}</Descriptions.Item>
            <Descriptions.Item label="模板数量">{templateSet.items?.length || 0}</Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {new Date(templateSet.created_at).toLocaleString('zh-CN')}
            </Descriptions.Item>
          </Descriptions>
          
          <div style={{ marginTop: 20 }}>
            <Title level={5}>包含的模板</Title>
            <Table
              columns={columns}
              dataSource={templateSet.items || []}
              rowKey="template_id"
              pagination={false}
            />
          </div>
        </Card>
      )}
    </div>
  );
};

export default TemplateSetDetail; 