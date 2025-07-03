import { ConfigProvider } from 'antd';
import zhCN from 'antd/lib/locale/zh_CN';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';

// 页面组件
import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound';
import Login from './pages/auth/Login';
import CampaignCreate from './pages/campaigns/CampaignCreate';
import CampaignDetail from './pages/campaigns/CampaignDetail';
import CampaignEdit from './pages/campaigns/CampaignEdit';
import CampaignList from './pages/campaigns/CampaignList';
import ContactCreate from './pages/contacts/ContactCreate';
import ContactDetail from './pages/contacts/ContactDetail';
import ContactEdit from './pages/contacts/ContactEdit';
import ContactList from './pages/contacts/ContactList';
import TagList from './pages/tags/TagList';
import TagManagement from './pages/tags/TagManagement';
import TaskCreate from './pages/tasks/TaskCreate';
import TaskDetail from './pages/tasks/TaskDetail';
import TaskEdit from './pages/tasks/TaskEdit';
import TaskList from './pages/tasks/TaskList';
import TemplateCreate from './pages/templates/TemplateCreate';
import TemplateDetail from './pages/templates/TemplateDetail';
import TemplateEdit from './pages/templates/TemplateEdit';
import TemplateList from './pages/templates/TemplateList';

// 会话管理页面组件
import ConversationCreate from './pages/conversations/ConversationCreate';
import ConversationDetail from './pages/conversations/ConversationDetail';
import ConversationList from './pages/conversations/ConversationList';

// V2.0 新增页面组件
import SenderList from './pages/senders/SenderList';
// import BulkTaskList from './pages/bulk-tasks/BulkTaskList';
// import BulkTaskDetail from './pages/bulk-tasks/BulkTaskDetail';
// import BulkTaskCreate from './pages/bulk-tasks/BulkTaskCreate';
// import BulkTaskEdit from './pages/bulk-tasks/BulkTaskEdit';
import EmailServiceDetail from './pages/email-services/EmailServiceDetail';
import EmailServiceList from './pages/email-services/EmailServiceList';

import EmailServiceEdit from './pages/email-services/EmailServiceEdit';
import ServiceAssociation from './pages/service-associations/ServiceAssociation';
import UserManagement from './pages/user-management/UserManagement';
import UserQuotaManagement from './pages/user-quotas/UserQuotaManagement';

// 系统配置页面
import SystemConfig from './pages/settings/SystemConfig';

// 布局组件
import AppLayout from './layouts/AppLayout';
import AuthLayout from './layouts/AuthLayout';

const App = () => {
  // 简单的认证检查函数
  const isAuthenticated = () => {
    return localStorage.getItem('token') !== null;
  };

  return (
    <ConfigProvider locale={zhCN}>
      <Router>
        <Routes>
          {/* 认证相关路由 */}
          <Route path="/login" element={
            <AuthLayout>
              <Login />
            </AuthLayout>
          } />

          {/* 受保护的主应用路由 */}
          <Route path="/" element={
            isAuthenticated() ? <AppLayout /> : <Navigate to="/login" replace />
          }>
            <Route index element={<Dashboard />} />

            {/* 联系人管理路由 - 特定路由要放在通用路由之前 */}
            <Route path="contacts" element={<ContactList />} />
            <Route path="contacts/create" element={<ContactCreate />} />
            <Route path="contacts/edit/:id" element={<ContactEdit />} />
            <Route path="contacts/:id" element={<ContactDetail />} />

            {/* 标签管理路由 */}
            <Route path="tags" element={<TagManagement />} />
            <Route path="tags/tree" element={<TagManagement />} />
            <Route path="tags/list" element={<TagList />} />

            {/* 活动管理路由 */}
            <Route path="campaigns" element={<CampaignList />} />
            <Route path="campaigns/create" element={<CampaignCreate />} />
            <Route path="campaigns/edit/:id" element={<CampaignEdit />} />
            <Route path="campaigns/:id" element={<CampaignDetail />} />

            {/* 任务管理路由 */}
            <Route path="tasks" element={<TaskList />} />
            <Route path="tasks/create" element={<TaskCreate />} />
            <Route path="tasks/edit/:id" element={<TaskEdit />} />
            <Route path="tasks/:id" element={<TaskDetail />} />

            {/* 模板管理路由 */}
            <Route path="templates" element={<TemplateList />} />
            <Route path="templates/create" element={<TemplateCreate />} />
            <Route path="templates/edit/:id" element={<TemplateEdit />} />
            <Route path="templates/:id" element={<TemplateDetail />} />

            {/* 会话管理路由 */}
            <Route path="conversations" element={<ConversationList />} />
            <Route path="conversations/new" element={<ConversationCreate />} />
            <Route path="conversations/:id" element={<ConversationDetail />} />

            {/* V2.0 发件管理路由 */}
            <Route path="senders" element={<SenderList />} />

            {/* V2.0 邮件服务管理路由（管理员） */}
            <Route path="email-services" element={<EmailServiceList />} />
            <Route path="email-services/edit/:id" element={<EmailServiceEdit />} />
            <Route path="email-services/:id" element={<EmailServiceDetail />} />

            {/* V2.0 用户管理路由（管理员） */}
            <Route path="user-management" element={<UserManagement />} />
            <Route path="user-quotas" element={<UserQuotaManagement />} />
            <Route path="service-associations" element={<ServiceAssociation />} />

            {/* 系统配置路由（管理员） */}
            <Route path="system-config" element={<SystemConfig />} />
          </Route>

          {/* 404页面 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </ConfigProvider>
  );
};

export default App; 