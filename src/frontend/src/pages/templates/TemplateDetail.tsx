import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Descriptions,
  Button,
  Space,
  Spin,
  message,
  Tabs,
  Modal,
  Popconfirm,
  Divider,
  Badge,
  Tooltip
} from 'antd';
import {
  EditOutlined,
  ArrowLeftOutlined,
  DeleteOutlined,
  CopyOutlined,
  FileTextOutlined,
  MailOutlined,
  DownloadOutlined,
  FileMarkdownOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import axios from '../../utils/axios';
import { API_URL } from '../../config/constants';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

const TemplateDetail: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [template, setTemplate] = useState<any>(null);
  const [previewVisible, setPreviewVisible] = useState<boolean>(false);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);
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

  // 返回列表
  const handleBack = () => {
    navigate('/templates');
  };

  // 编辑模板
  const handleEdit = () => {
    navigate(`/templates/edit/${id}`);
  };

  // 删除模板
  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await axios.delete(`${API_URL}/templates/${id}`);
      message.success('删除模板成功');
      navigate('/templates');
    } catch (error) {
      console.error('删除模板失败', error);
      message.error('删除模板失败，可能该模板正在被使用');
    } finally {
      setDeleteLoading(false);
    }
  };

  // 复制模板
  const handleCopy = async () => {
    try {
      const newTemplate = {
        name: `${template.name} (副本)`,
        subject: template.subject,
        body: template.body
      };
      await axios.post(`${API_URL}/templates`, newTemplate);
      message.success('复制模板成功');
      navigate('/templates');
    } catch (error) {
      console.error('复制模板失败', error);
      message.error('复制模板失败');
    }
  };

  // 预览模板
  const handlePreview = () => {
    setPreviewVisible(true);
  };

  // 导出HTML
  const handleExportHTML = () => {
    const blob = new Blob([template.body], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Title level={4}>模板详情</Title>
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
          <Button
            icon={<CopyOutlined />}
            onClick={handleCopy}
          >
            复制
          </Button>
          <Popconfirm
            title="确定要删除这个模板吗？"
            onConfirm={handleDelete}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="primary"
              danger
              icon={<DeleteOutlined />}
              loading={deleteLoading}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      </div>
      
      {template && (
        <Tabs defaultActiveKey="basic">
          <TabPane 
            tab={
              <span>
                <FileTextOutlined />
                基本信息
              </span>
            } 
            key="basic"
          >
            <Card>
              <Descriptions bordered column={1}>
                <Descriptions.Item label="模板名称">{template.name}</Descriptions.Item>
                <Descriptions.Item label="邮件主题">{template.subject}</Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {template.created_at ? (
                    isNaN(Date.parse(template.created_at)) ? 
                      '时间格式错误' : 
                      new Date(template.created_at).toLocaleString('zh-CN')
                  ) : '未设置'}
                </Descriptions.Item>
                <Descriptions.Item label="更新时间">
                  {template.updated_at ? (
                    isNaN(Date.parse(template.updated_at)) ? 
                      '时间格式错误' : 
                      new Date(template.updated_at).toLocaleString('zh-CN')
                  ) : '未设置'}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </TabPane>
          
          <TabPane 
            tab={
              <span>
                <MailOutlined />
                邮件内容
              </span>
            } 
            key="content"
          >
            <Card
              title="邮件内容预览"
              extra={
                <Space>
                  <Tooltip title="预览">
                    <Button icon={<FileMarkdownOutlined />} onClick={handlePreview}>预览</Button>
                  </Tooltip>
                  <Tooltip title="导出HTML">
                    <Button icon={<DownloadOutlined />} onClick={handleExportHTML}>导出HTML</Button>
                  </Tooltip>
                </Space>
              }
            >
              <div 
                style={{ border: '1px solid #eee', padding: 16, borderRadius: 4, minHeight: 300 }}
                dangerouslySetInnerHTML={{ __html: template.body }}
              />
            </Card>
          </TabPane>
        </Tabs>
      )}

      <Modal
        title="模板预览"
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        width={700}
      >
        {template && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>邮件主题：</Text> {template.subject}
            </div>
            <div
              style={{ 
                border: '1px solid #eee', 
                padding: 16, 
                borderRadius: 4, 
                minHeight: 300,
                maxHeight: 600,
                overflow: 'auto'
              }}
              dangerouslySetInnerHTML={{ __html: template.body }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TemplateDetail; 