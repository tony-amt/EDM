import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Button,
  Select,
  Upload,
  message,
  Row,
  Col,
  Space,
  Typography,
  Divider
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  PaperClipOutlined,
  SendOutlined
} from '@ant-design/icons';
import conversationService from '../../services/conversation.service';
import emailServiceService, { EmailService } from '../../services/email-service.service';

const { TextArea } = Input;
const { Option } = Select;
const { Title } = Typography;

const ConversationCreate: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [emailServices, setEmailServices] = useState<EmailService[]>([]);
  const [fileList, setFileList] = useState<any[]>([]);

  // 加载邮件服务列表
  useEffect(() => {
    const loadEmailServices = async () => {
      try {
        const response = await emailServiceService.getList();
        setEmailServices(response.data || []);
      } catch (error) {
        console.error('加载邮件服务失败:', error);
      }
    };

    loadEmailServices();
  }, []);

  // 处理表单提交
  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      // 处理参与者邮箱
      const participants = values.participants
        ? values.participants.split(',').map((email: string) => email.trim()).filter(Boolean)
        : [];

      // 处理抄送和密送邮箱
      const cc_emails = values.cc_emails
        ? values.cc_emails.split(',').map((email: string) => email.trim()).filter(Boolean)
        : [];
      
      const bcc_emails = values.bcc_emails
        ? values.bcc_emails.split(',').map((email: string) => email.trim()).filter(Boolean)
        : [];

      const conversationData = {
        sender_email: 'support@example.com', // 临时使用固定发件人
        recipient_email: values.to_email,
        subject: values.subject,
        content_text: values.body,
        content_html: values.html_body
      };

      const response = await conversationService.createConversation(conversationData);
      
      message.success('会话创建成功');
      navigate(`/conversations/${response.data.id}`);
    } catch (error) {
      console.error('创建会话失败:', error);
      message.error('创建会话失败');
    } finally {
      setLoading(false);
    }
  };

  // 文件上传处理
  const handleFileChange = ({ fileList: newFileList }: any) => {
    setFileList(newFileList);
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* 头部 */}
      <Card style={{ marginBottom: 16 }}>
        <Row align="middle" justify="space-between">
          <Col>
            <Space>
              <Button 
                icon={<ArrowLeftOutlined />} 
                onClick={() => navigate('/conversations')}
              >
                返回
              </Button>
              <Title level={4} style={{ margin: 0 }}>
                新建会话
              </Title>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 表单 */}
      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            email_service_id: emailServices[0]?.id
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="subject"
                label="会话主题"
                rules={[{ required: true, message: '请输入会话主题' }]}
              >
                <Input placeholder="请输入会话主题" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="email_service_id"
                label="邮件服务"
                rules={[{ required: true, message: '请选择邮件服务' }]}
              >
                <Select placeholder="请选择邮件服务">
                  {emailServices.map(service => (
                    <Option key={service.id} value={service.id}>
                      {service.name} ({service.provider})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="participants"
            label="参与者"
            rules={[{ required: true, message: '请输入参与者邮箱' }]}
            extra="多个邮箱用逗号分隔"
          >
            <Input placeholder="请输入参与者邮箱，多个邮箱用逗号分隔" />
          </Form.Item>

          <Divider>初始消息</Divider>

          <Form.Item
            name="to_email"
            label="收件人"
            rules={[
              { required: true, message: '请输入收件人邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input placeholder="收件人邮箱地址" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item 
                name="cc_emails" 
                label="抄送"
                extra="多个邮箱用逗号分隔"
              >
                <Input placeholder="抄送邮箱，多个邮箱用逗号分隔" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item 
                name="bcc_emails" 
                label="密送"
                extra="多个邮箱用逗号分隔"
              >
                <Input placeholder="密送邮箱，多个邮箱用逗号分隔" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="body"
            label="邮件内容"
            rules={[{ required: true, message: '请输入邮件内容' }]}
          >
            <TextArea
              rows={8}
              placeholder="请输入邮件内容..."
              showCount
              maxLength={10000}
            />
          </Form.Item>

          <Form.Item name="html_body" label="HTML内容（可选）">
            <TextArea
              rows={4}
              placeholder="可选：输入HTML格式的邮件内容"
              showCount
              maxLength={20000}
            />
          </Form.Item>

          <Form.Item label="附件">
            <Upload
              fileList={fileList}
              onChange={handleFileChange}
              beforeUpload={() => false} // 阻止自动上传
              multiple
            >
              <Button icon={<PaperClipOutlined />}>
                选择附件
              </Button>
            </Upload>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => navigate('/conversations')}>
                取消
              </Button>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading}
                icon={<SendOutlined />}
              >
                创建并发送
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default ConversationCreate; 