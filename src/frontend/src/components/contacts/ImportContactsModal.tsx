import React, { useState } from 'react';
import { Modal, Upload, Button, message, Alert, Typography, Progress, Space } from 'antd';
import { UploadOutlined, InboxOutlined, FileExcelOutlined, FileTextOutlined, DownloadOutlined } from '@ant-design/icons';
import type { RcFile, UploadProps } from 'antd/es/upload';
import contactService from '../../services/contact.service';

interface ImportContactsModalProps {
  visible: boolean;
  onCancel: () => void;
  onFinish: (result: any) => void;
}

const { Dragger } = Upload;
const { Title, Text, Paragraph } = Typography;

const ImportContactsModal: React.FC<ImportContactsModalProps> = ({
  visible,
  onCancel,
  onFinish
}) => {
  const [fileList, setFileList] = useState<RcFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleUpload = async () => {
    const formData = new FormData();
    fileList.forEach(file => {
      formData.append('file', file);
    });

    setUploading(true);

    try {
      // 模拟上传进度
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev + 10;
          if (newProgress >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return newProgress;
        });
      }, 300);

      const result = await contactService.importContacts(fileList[0]);

      clearInterval(progressInterval);
      setProgress(100);
      
      message.success('联系人导入成功');
      setFileList([]);
      setUploading(false);
      onFinish(result.data);
    } catch (error) {
      console.error('Error uploading file:', error);
      message.error('导入失败，请重试');
      setUploading(false);
      setProgress(0);
    }
  };

  const uploadProps: UploadProps = {
    onRemove: file => {
      setFileList([]);
    },
    beforeUpload: file => {
      // 验证文件类型
      const isCSV = file.type === 'text/csv';
      const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                      file.type === 'application/vnd.ms-excel';
      
      if (!isCSV && !isExcel) {
        message.error('只支持上传CSV或Excel文件!');
        return Upload.LIST_IGNORE;
      }
      
      // 验证文件大小
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('文件大小不能超过10MB!');
        return Upload.LIST_IGNORE;
      }
      
      setFileList([file]);
      return false;
    },
    fileList
  };

  // 下载Excel模板
  const downloadExcelTemplate = () => {
    const headers = [
      'email', 'username', 'tikTokId', 'insId', 'youtubeId', 
      'customField1', 'customField2', 'customField3', 'customField4', 'customField5',
      'tags', 'status', 'source'
    ];
    
    const sampleData = [
      [
        'example@email.com', 'user1', 'tiktok_user1', 'ins_user1', 'youtube_user1',
        '自定义字段1', '自定义字段2', '自定义字段3', '自定义字段4', '自定义字段5',
        '重要客户,潜在客户', '正常', '手动导入'
      ]
    ];

    // 创建CSV内容
    const csvContent = [headers, ...sampleData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    // 创建并下载文件
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', '联系人导入模板.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    message.success('模板下载成功');
  };

  // 下载CSV模板
  const downloadCSVTemplate = () => {
    downloadExcelTemplate(); // 使用相同的逻辑
  };

  const renderTemplateInfo = () => (
    <div style={{ marginBottom: 16 }}>
      <Title level={5}>
        <Space>
          导入说明
          <Button 
            type="link" 
            size="small" 
            icon={<DownloadOutlined />}
            onClick={downloadCSVTemplate}
          >
            下载模板
          </Button>
        </Space>
      </Title>
      <Paragraph>
        支持CSV和Excel格式，文件大小不超过10MB
      </Paragraph>
      
      <Alert
        message="必需字段: email（邮箱）"
        description={
          <div>
            <p><strong>可选字段:</strong> username（用户名）、tags（标签，多个标签用逗号分隔）、status（状态）、source（来源）</p>
            <p><strong>标签功能:</strong> 如果标签不存在，系统会自动创建新标签</p>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        action={
          <Space>
            <Button 
              size="small" 
              icon={<FileTextOutlined />}
              onClick={downloadCSVTemplate}
            >
              CSV模板
            </Button>
          </Space>
        }
      />
    </div>
  );

  return (
    <Modal
      title="导入联系人"
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="back" onClick={onCancel} disabled={uploading}>
          取消
        </Button>,
        <Button
          key="upload"
          type="primary"
          onClick={handleUpload}
          loading={uploading}
          disabled={fileList.length === 0 || uploading}
        >
          {uploading ? '导入中...' : '开始导入'}
        </Button>
      ]}
      width={700}
    >
      {renderTemplateInfo()}

      <Dragger {...uploadProps} disabled={uploading}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
        <p className="ant-upload-hint">
          支持单个CSV或Excel文件上传，文件大小不超过10MB
        </p>
      </Dragger>

      {uploading && (
        <div style={{ marginTop: 16 }}>
          <Progress percent={progress} status={progress === 100 ? 'success' : 'active'} />
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            {progress < 100 ? '正在导入联系人...' : '导入完成，正在处理数据...'}
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ImportContactsModal; 