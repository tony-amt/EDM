import React, { useState } from 'react';
import {
  Modal,
  Button,
  Select,
  DatePicker,
  Form,
  Space,
  Alert,
  Progress,
  message,
  Radio,
  Checkbox,
  Row,
  Col,
  Divider
} from 'antd';
import {
  DownloadOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  ExportOutlined
} from '@ant-design/icons';

const { RangePicker } = DatePicker;

interface DataExportProps {
  visible: boolean;
  onCancel: () => void;
  dataType: 'campaigns' | 'contacts' | 'users' | 'services' | 'subtasks';
  data?: any[];
  title?: string;
}

const DataExport: React.FC<DataExportProps> = ({
  visible,
  onCancel,
  dataType,
  data = [],
  title = '数据导出'
}) => {
  const [form] = Form.useForm();
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  // 字段配置
  const fieldConfigs = {
    campaigns: [
      { key: 'name', label: '任务名称', default: true },
      { key: 'description', label: '任务描述', default: true },
      { key: 'status', label: '状态', default: true },
      { key: 'sender_name', label: '发信人', default: true },
      { key: 'total_contacts', label: '总联系人数', default: true },
      { key: 'sent_count', label: '已发送数', default: true },
      { key: 'success_count', label: '成功数', default: true },
      { key: 'failed_count', label: '失败数', default: true },
      { key: 'created_at', label: '创建时间', default: true }
    ],
    contacts: [
      { key: 'name', label: '姓名', default: true },
      { key: 'email', label: '邮箱', default: true },
      { key: 'phone', label: '电话', default: false },
      { key: 'company', label: '公司', default: false },
      { key: 'tags', label: '标签', default: true },
      { key: 'created_at', label: '创建时间', default: true }
    ],
    users: [
      { key: 'username', label: '用户名', default: true },
      { key: 'email', label: '邮箱', default: true },
      { key: 'role', label: '角色', default: true },
      { key: 'remaining_quota', label: '剩余额度', default: true },
      { key: 'created_at', label: '创建时间', default: true }
    ],
    services: [
      { key: 'name', label: '服务名称', default: true },
      { key: 'provider', label: '服务商', default: true },
      { key: 'domain', label: '域名', default: true },
      { key: 'daily_quota', label: '每日额度', default: true },
      { key: 'used_quota', label: '已用额度', default: true },
      { key: 'status', label: '状态', default: true }
    ],
    subtasks: [
      { key: 'campaign_name', label: '群发任务', default: true },
      { key: 'contact_email', label: '联系人邮箱', default: true },
      { key: 'status', label: '状态', default: true },
      { key: 'service_name', label: '发信服务', default: true },
      { key: 'sent_at', label: '发送时间', default: true }
    ]
  };

  const currentFields = fieldConfigs[dataType] || [];
  const defaultFields = currentFields.filter(field => field.default).map(field => field.key);

  // 执行导出
  const handleExport = async () => {
    try {
      const values = await form.validateFields();
      setExporting(true);
      setProgress(0);

      // 模拟进度
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      // 模拟导出过程
      setTimeout(() => {
        clearInterval(progressInterval);
        setProgress(100);
        
        setTimeout(() => {
          message.success('导出成功');
          onCancel();
        }, 500);
      }, 2000);

    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败');
    } finally {
      setTimeout(() => {
        setExporting(false);
        setProgress(0);
      }, 3000);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <ExportOutlined />
          {title}
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      width={600}
      footer={[
        <Button key="cancel" onClick={onCancel} disabled={exporting}>
          取消
        </Button>,
        <Button
          key="export"
          type="primary"
          onClick={handleExport}
          loading={exporting}
          icon={<DownloadOutlined />}
        >
          {exporting ? '导出中...' : '开始导出'}
        </Button>
      ]}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          format: 'excel',
          fields: defaultFields
        }}
      >
        {/* 导出格式 */}
        <Form.Item
          label="导出格式"
          name="format"
          rules={[{ required: true, message: '请选择导出格式' }]}
        >
          <Radio.Group>
            <Radio.Button value="excel">
              <FileExcelOutlined /> Excel
            </Radio.Button>
            <Radio.Button value="csv">
              <FileTextOutlined /> CSV
            </Radio.Button>
            <Radio.Button value="json">
              <FilePdfOutlined /> JSON
            </Radio.Button>
          </Radio.Group>
        </Form.Item>

        {/* 时间范围 */}
        <Form.Item label="时间范围" name="dateRange">
          <RangePicker
            style={{ width: '100%' }}
            placeholder={['开始时间', '结束时间']}
          />
        </Form.Item>

        {/* 导出字段 */}
        <Form.Item
          label="导出字段"
          name="fields"
          rules={[{ required: true, message: '请至少选择一个字段' }]}
        >
          <Checkbox.Group style={{ width: '100%' }}>
            <Row gutter={[16, 8]}>
              {currentFields.map(field => (
                <Col span={12} key={field.key}>
                  <Checkbox value={field.key}>
                    {field.label}
                  </Checkbox>
                </Col>
              ))}
            </Row>
          </Checkbox.Group>
        </Form.Item>

        {/* 数据统计 */}
        <Divider />
        <Alert
          message={`共 ${data.length} 条记录可导出`}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        {/* 导出进度 */}
        {exporting && (
          <div>
            <div style={{ marginBottom: 8 }}>导出进度:</div>
            <Progress percent={progress} status="active" />
          </div>
        )}
      </Form>
    </Modal>
  );
};

export default DataExport; 