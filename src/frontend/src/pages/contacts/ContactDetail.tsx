import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Typography,
  Breadcrumb,
  Spin,
  Descriptions,
  Button,
  Space,
  Tag,
  Card,
  Row,
  Col,
  Badge,
  Tooltip,
  Modal,
  message,
  Alert
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  MailOutlined,
  PhoneOutlined,
  UserOutlined,
  BankOutlined,
  LinkOutlined
} from '@ant-design/icons';
import { fetchContact, deleteContact, clearCurrentContact } from '../../store/contact.slice';
import { RootState } from '../../store';

const { Title, Text } = Typography;
const { confirm } = Modal;

const ContactDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { currentContact, isLoading, error } = useSelector((state: RootState) => state.contacts);
  const [fetchAttempted, setFetchAttempted] = useState(false);

  // 加载联系人详情
  useEffect(() => {
    if (id && id !== 'undefined' && id !== 'null') {
      console.log('正在获取联系人详情, ID:', id);
      setFetchAttempted(true);
      dispatch(fetchContact(id) as any);
    } else {
      console.error('无效的联系人ID:', id);
      setFetchAttempted(true);
    }

    // 组件卸载时清除当前联系人
    return () => {
      dispatch(clearCurrentContact());
    };
  }, [dispatch, id]);

  // 处理编辑联系人
  const handleEdit = () => {
    if (id && id !== 'undefined') {
      navigate(`/contacts/edit/${id}`);
    } else {
      message.error('无效的联系人ID');
    }
  };

  // 处理删除联系人
  const handleDelete = () => {
    if (!id || id === 'undefined') {
      message.error('无效的联系人ID');
      return;
    }

    confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: '确定要删除此联系人吗？此操作不可逆。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk() {
        dispatch(deleteContact(id) as any).then(() => {
          message.success('联系人删除成功');
          navigate('/contacts');
        });
      }
    });
  };

  // 返回列表
  const handleBack = () => {
    navigate('/contacts');
  };

  // 重新获取数据
  const handleRetry = () => {
    if (id && id !== 'undefined' && id !== 'null') {
      dispatch(fetchContact(id) as any);
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 0' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  // 显示错误信息
  if (error && fetchAttempted) {
    return (
      <div style={{ padding: '20px' }}>
        <Alert
          message="加载失败"
          description={`获取联系人详情失败: ${error}`}
          type="error"
          showIcon
          action={
            <Space>
              <Button size="small" onClick={handleRetry}>
                重试
              </Button>
              <Button type="primary" size="small" onClick={handleBack}>
                返回列表
              </Button>
            </Space>
          }
        />
        <div style={{ marginTop: 16 }}>
          <Text type="secondary">调试信息: ID = {id}</Text>
        </div>
      </div>
    );
  }

  // 检查ID有效性
  if (!id || id === 'undefined' || id === 'null') {
    return (
      <div style={{ textAlign: 'center', padding: '50px 0' }}>
        <Alert
          message="无效的联系人ID"
          description="URL中的联系人ID无效，请检查链接是否正确"
          type="warning"
          showIcon
        />
        <Button type="primary" onClick={handleBack} style={{ marginTop: 16 }}>
          返回列表
        </Button>
      </div>
    );
  }

  // 确保currentContact存在后再渲染UI
  if (!currentContact) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 0' }}>
        <Alert
          message="数据加载中"
          description="正在获取联系人信息，请稍候..."
          type="info"
          showIcon
        />
      </div>
    );
  }

  // 格式化状态显示
  const renderStatus = (status: string) => {
    let color = 'green';
    let text = '正常';
    
    switch (status) {
      case 'active':
        color = 'green';
        text = '正常';
        break;
      case 'inactive':
        color = 'orange';
        text = '未激活';
        break;
      case 'bounced':
        color = 'red';
        text = '退信';
        break;
      case 'unsubscribed':
        color = 'gray';
        text = '已退订';
        break;
      case 'complained':
        color = 'volcano';
        text = '投诉';
        break;
    }
    
    return <Tag color={color}>{text}</Tag>;
  };

  // 格式化来源显示
  const renderSource = (source?: string) => {
    if (!source) return '-';
    switch (source) {
      case 'manual':
        return '手动添加';
      case 'import':
        return '导入';
      case 'api':
        return 'API';
      default:
        return source;
    }
  };

  // 格式化日期显示
  const formatDate = (date?: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('zh-CN');
  };

  return (
    <div>
      <Breadcrumb
        items={[
          { title: '联系人管理', href: '/contacts' },
          { title: '联系人详情' },
        ]}
        style={{ marginBottom: 16 }}
      />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4}>联系人详情</Title>
        <Space>
          <Button onClick={handleBack}>返回列表</Button>
          <Button type="primary" icon={<EditOutlined />} onClick={handleEdit}>
            编辑
          </Button>
          <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
            删除
          </Button>
        </Space>
      </div>
      
      <Card title="基本信息" style={{ marginBottom: 16 }}>
        <Descriptions bordered column={2}>
          <Descriptions.Item label="邮箱" span={2}>
            <Space>
              <MailOutlined />
              <Text copyable>{currentContact.email}</Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="用户名">
            <Space>
              <UserOutlined />
              {currentContact.username || '-'}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            {renderStatus(currentContact.status)}
          </Descriptions.Item>
          <Descriptions.Item label="来源">
            {renderSource(currentContact.source)}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {formatDate(currentContact.createdAt)}
          </Descriptions.Item>
        </Descriptions>
      </Card>
      
      <Card title="社交媒体账号" style={{ marginBottom: 16 }}>
        <Descriptions bordered column={1}>
          <Descriptions.Item label="TikTok ID">
            {currentContact.tikTokId ? (
              <Space>
                <Text copyable>{currentContact.tikTokId}</Text>
                <Tooltip title="打开TikTok个人页">
                  <a href={`https://www.tiktok.com/@${currentContact.tikTokId}`} target="_blank" rel="noopener noreferrer">
                    <LinkOutlined />
                  </a>
                </Tooltip>
              </Space>
            ) : (
              '-'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Instagram ID">
            {currentContact.insId ? (
              <Space>
                <Text copyable>{currentContact.insId}</Text>
                <Tooltip title="打开Instagram个人页">
                  <a href={`https://www.instagram.com/${currentContact.insId}`} target="_blank" rel="noopener noreferrer">
                    <LinkOutlined />
                  </a>
                </Tooltip>
              </Space>
            ) : (
              '-'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="YouTube ID">
            {currentContact.youtubeId ? (
              <Space>
                <Text copyable>{currentContact.youtubeId}</Text>
                <Tooltip title="打开YouTube个人页">
                  <a href={`https://www.youtube.com/channel/${currentContact.youtubeId}`} target="_blank" rel="noopener noreferrer">
                    <LinkOutlined />
                  </a>
                </Tooltip>
              </Space>
            ) : (
              '-'
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>
      
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card title="自定义字段" style={{ height: '100%' }}>
            <Descriptions bordered column={1}>
              <Descriptions.Item label="自定义字段1">
                {currentContact.customField1 || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="自定义字段2">
                {currentContact.customField2 || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="自定义字段3">
                {currentContact.customField3 || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="自定义字段4">
                {currentContact.customField4 || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="自定义字段5">
                {currentContact.customField5 || '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="邮件统计" style={{ height: '100%' }}>
            <Descriptions bordered column={1}>
              <Descriptions.Item label="发送">
                {currentContact.statistics?.sent || 0}
              </Descriptions.Item>
              <Descriptions.Item label="打开">
                {currentContact.statistics?.opened || 0}
              </Descriptions.Item>
              <Descriptions.Item label="点击">
                {currentContact.statistics?.clicked || 0}
              </Descriptions.Item>
              <Descriptions.Item label="回复">
                {currentContact.statistics?.replied || 0}
              </Descriptions.Item>
              <Descriptions.Item label="退信">
                {currentContact.statistics?.bounced || 0}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
      
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card title="标签" style={{ height: '100%' }}>
            <Space size={[0, 8]} wrap>
              {currentContact.tags && currentContact.tags.length > 0 ? (
                currentContact.tags.map((tag: any) => (
                  <Tag color={tag.color} key={tag.id}>
                    {tag.name}
                  </Tag>
                ))
              ) : (
                <Text type="secondary">暂无标签</Text>
              )}
            </Space>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="最近活动" style={{ height: '100%' }}>
            <Descriptions bordered column={1}>
              <Descriptions.Item label="最近联系">
                {formatDate(currentContact.lastContacted)}
              </Descriptions.Item>
              <Descriptions.Item label="最近打开">
                {formatDate(currentContact.lastOpened)}
              </Descriptions.Item>
              <Descriptions.Item label="最近点击">
                {formatDate(currentContact.lastClicked)}
              </Descriptions.Item>
              <Descriptions.Item label="最近回复">
                {formatDate(currentContact.lastReplied)}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
      
      <Card title="备注">
        <div style={{ minHeight: 80 }}>
          {currentContact.notes ? currentContact.notes : <Text type="secondary">暂无备注</Text>}
        </div>
      </Card>
    </div>
  );
};

export default ContactDetail; 