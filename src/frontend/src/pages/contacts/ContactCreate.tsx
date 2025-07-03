import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Typography, message, Breadcrumb } from 'antd';
import { createContact, fetchContacts } from '../../store/contact.slice';
import ContactForm from '../../components/contacts/ContactForm';
import { Contact } from '../../services/contact.service';

const { Title } = Typography;

const ContactCreate: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);

  const handleFinish = async (values: Partial<Contact>) => {
    setLoading(true);
    try {
      await dispatch(createContact(values) as any);
      message.success('联系人创建成功');
      
      // 🔧 修复数据不同步问题：创建成功后刷新列表数据
      await dispatch(fetchContacts({}) as any);
      
      navigate('/contacts');
    } catch (error) {
      console.error('创建联系人失败:', error);
      message.error('创建联系人失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/contacts');
  };

  return (
    <div>
      <Breadcrumb
        items={[
          { title: '联系人管理', href: '/contacts' },
          { title: '创建联系人' },
        ]}
        style={{ marginBottom: 16 }}
      />
      
      <Title level={4} style={{ marginBottom: 24 }}>创建联系人</Title>
      
      <ContactForm
        onFinish={handleFinish}
        onCancel={handleCancel}
        loading={loading}
        mode="create"
      />
    </div>
  );
};

export default ContactCreate; 