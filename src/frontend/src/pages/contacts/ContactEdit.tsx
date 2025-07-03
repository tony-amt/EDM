import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Typography, message, Breadcrumb, Spin } from 'antd';
import { fetchContact, updateContact, clearCurrentContact } from '../../store/contact.slice';
import ContactForm from '../../components/contacts/ContactForm';
import { Contact } from '../../services/contact.service';
import { RootState } from '../../store';

const { Title } = Typography;

const ContactEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const { currentContact, isLoading } = useSelector((state: RootState) => state.contacts);

  // 加载联系人详情
  useEffect(() => {
    if (id) {
      dispatch(fetchContact(id) as any);
    }

    // 组件卸载时清除当前联系人
    return () => {
      dispatch(clearCurrentContact());
    };
  }, [dispatch, id]);

  const handleFinish = async (values: Partial<Contact>) => {
    if (!id) return;
    
    setLoading(true);
    try {
      await dispatch(updateContact({ id, contactData: values }) as any);
      message.success('联系人更新成功');
      navigate('/contacts');
    } catch (error) {
      console.error('更新联系人失败:', error);
      message.error('更新联系人失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/contacts');
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 0' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!currentContact) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 0' }}>
        <Title level={4}>联系人不存在或已被删除</Title>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { title: '联系人管理', href: '/contacts' },
          { title: '编辑联系人' },
        ]}
        style={{ marginBottom: 16 }}
      />
      
      <Title level={4} style={{ marginBottom: 24 }}>
        编辑联系人: {currentContact.email}
      </Title>
      
      <ContactForm
        initialValues={currentContact}
        onFinish={handleFinish}
        onCancel={handleCancel}
        loading={loading}
        mode="edit"
      />
    </div>
  );
};

export default ContactEdit; 