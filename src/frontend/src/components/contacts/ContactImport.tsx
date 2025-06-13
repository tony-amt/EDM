import React, { useState } from 'react';
import { Modal, Upload, Button, message, Alert, Table, Progress, Space, Typography } from 'antd';
import { UploadOutlined, InboxOutlined } from '@ant-design/icons';
import axios from '../../utils/axios';
import { API_URL } from '../../config/constants';

const { Dragger } = Upload;
const { Text } = Typography;

interface ContactImportProps {
  visible: boolean;
  onCancel: () => void;
  onFinished: (result: any) => void;
}

const ContactImport: React.FC<ContactImportProps> = ({
  visible,
  onCancel,
  onFinished
}) => {
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<any>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'result'>('upload');

  // 文件上传配置
  const uploadProps = {
    name: 'file',
    multiple: false,
    accept: '.csv,.xlsx,.xls',
    beforeUpload: (file: File) => {
      const isValidType = file.type === 'text/csv' || 
                         file.type === 'application/vnd.ms-excel' ||
                         file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      
      if (!isValidType) {
        message.error('只支持CSV和Excel文件格式');
        return false;
      }

      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('文件大小不能超过10MB');
        return false;
      }

      handleFileUpload(file);
      return false; // 阻止自动上传
    },
    onDrop(e: any) {
      console.log('Dropped files', e.dataTransfer.files);
    },
  };

  // 处理文件上传和预览
  const handleFileUpload = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_URL}/contacts/preview-import`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data && response.data.preview) {
        setPreviewData(response.data.preview);
        setStep('preview');
        message.success(`成功解析文件，共${response.data.preview.length}条记录`);
      }
    } catch (error: any) {
      console.error('文件预览失败:', error);
      message.error(error.response?.data?.message || '文件解析失败，请检查文件格式');
    } finally {
      setUploading(false);
    }
  };

  // 确认导入
  const handleConfirmImport = async () => {
    setImporting(true);
    setStep('importing');

    try {
      const response = await axios.post(`${API_URL}/contacts/import`, {
        data: previewData,
        options: {
          createTags: true, // 自动创建不存在的标签
          updateExisting: false, // 是否更新已存在的联系人
        }
      });

      setImportResult(response.data);
      setStep('result');
      message.success('导入完成');
    } catch (error: any) {
      console.error('导入失败:', error);
      message.error(error.response?.data?.message || '导入失败，请重试');
      setStep('preview');
    } finally {
      setImporting(false);
    }
  };

  // 重置状态
  const handleReset = () => {
    setStep('upload');
    setPreviewData([]);
    setImportResult(null);
  };

  // 完成导入
  const handleFinish = () => {
    onFinished(importResult);
    handleReset();
  };

  // 预览表格列定义
  const previewColumns = [
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 200,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 150,
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string) => tags || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => status || 'active',
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      render: (source: string) => source || 'import',
    },
  ];

  const renderContent = () => {
    switch (step) {
      case 'upload':
        return (
          <div>
            <Alert
              message="导入说明"
              description={
                <div>
                  <p>支持CSV和Excel文件格式，文件大小不超过10MB</p>
                  <p>必需字段：email（邮箱）</p>
                  <p>可选字段：username（用户名）、tags（标签，多个标签用逗号分隔）、status（状态）、source（来源）</p>
                  <p>标签功能：如果标签不存在，系统会自动创建新标签</p>
                </div>
              }
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <Dragger {...uploadProps} style={{ padding: '20px 0' }}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">
                支持单个文件上传，严格禁止上传公司数据或其他敏感文件
              </p>
            </Dragger>
          </div>
        );

      case 'preview':
        return (
          <div>
            <Alert
              message={`预览数据（共${previewData.length}条记录）`}
              description="请确认数据无误后点击确认导入"
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <Table
              columns={previewColumns}
              dataSource={previewData}
              rowKey={(record, index) => index?.toString() || '0'}
              pagination={{ pageSize: 10 }}
              scroll={{ y: 300 }}
              size="small"
            />
            
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Space>
                <Button onClick={handleReset}>重新上传</Button>
                <Button type="primary" onClick={handleConfirmImport}>
                  确认导入
                </Button>
              </Space>
            </div>
          </div>
        );

      case 'importing':
        return (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Progress type="circle" percent={100} status="active" />
            <p style={{ marginTop: 16 }}>正在导入联系人，请稍候...</p>
          </div>
        );

      case 'result':
        return (
          <div>
            <Alert
              message="导入完成"
              description={
                <div>
                  <p>成功导入：{importResult?.imported || 0} 个联系人</p>
                  <p>失败记录：{importResult?.failed || 0} 个</p>
                  <p>创建标签：{importResult?.tagsCreated || 0} 个</p>
                  {importResult?.errors && importResult.errors.length > 0 && (
                    <div>
                      <p>错误详情：</p>
                      <ul>
                        {importResult.errors.slice(0, 5).map((error: string, index: number) => (
                          <li key={index}>{error}</li>
                        ))}
                        {importResult.errors.length > 5 && (
                          <li>...还有{importResult.errors.length - 5}个错误</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              }
              type={importResult?.failed > 0 ? "warning" : "success"}
              showIcon
            />
            
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Space>
                <Button onClick={handleReset}>再次导入</Button>
                <Button type="primary" onClick={handleFinish}>
                  完成
                </Button>
              </Space>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      title="导入联系人"
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={800}
      destroyOnClose
    >
      {renderContent()}
    </Modal>
  );
};

export default ContactImport; 