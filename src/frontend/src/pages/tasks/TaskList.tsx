import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Table,
  Button,
  Input,
  Space,
  Tag,
  Popconfirm,
  message,
  Typography,
  Tooltip,
  Select,
  Card
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  StopOutlined,
  SendOutlined
} from '@ant-design/icons';
import axios from '../../utils/axios';
import { API_URL } from '../../config/constants';
import ScheduleTimeModal from '../../components/ScheduleTimeModal';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

// 定义任务状态类型和对应的展示样式
const taskStatusMap: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
  'draft': { color: 'default', text: '草稿', icon: <EditOutlined /> },
  'scheduled': { color: 'processing', text: '计划中', icon: <ClockCircleOutlined /> },
  'sending': { color: 'blue', text: '发送中', icon: <SyncOutlined spin /> },
  'paused': { color: 'orange', text: '暂停中', icon: <PauseCircleOutlined /> },
  'completed': { color: 'success', text: '发送完成', icon: <CheckCircleOutlined /> },
  'failed': { color: 'error', text: '失败', icon: <CloseCircleOutlined /> },
  'cancelled': { color: 'default', text: '已取消', icon: <StopOutlined /> },
  'closed': { color: 'volcano', text: '已关闭', icon: <StopOutlined /> }
};

// 任务类型定义
interface Task {
  id: string;
  name: string;
  description: string;
  status: string;
  type: string;
  schedule_time: string;
  campaign_id: string;
  campaign_name: string;
  pause_reason?: string;
  created_at: string;
  updated_at: string;
}

const TaskList: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchText, setSearchText] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [scheduleModalVisible, setScheduleModalVisible] = useState<boolean>(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const campaignId = queryParams.get('campaign_id');

  // 获取任务列表
  const fetchTasks = async (page = 1, name = '', status = '') => {
    setLoading(true);
    try {
      const params: any = {
        page,
        limit: pagination.pageSize,
        name,
        status
      };
      
      if (campaignId) {
        params.campaign_id = campaignId;
      }
      
      const response = await axios.get(`${API_URL}/tasks`, {
        params
      });
      
      // 🔧 修复：正确解析后端返回的数据格式
      const taskData = response.data.data || response.data;
      setTasks(taskData.items || []);
      setPagination({
        ...pagination,
        current: taskData.page || 1,
        total: taskData.total || 0
      });
    } catch (error) {
      console.error('获取任务列表失败', error);
      message.error('获取任务列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks(pagination.current, searchText, statusFilter);
  }, [campaignId]);

  // 删除任务
  const handleDelete = async (id: string) => {
    try {
      await axios.delete(`${API_URL}/tasks/${id}`);
      message.success('删除任务成功');
      fetchTasks(pagination.current, searchText, statusFilter);
    } catch (error) {
      console.error('删除任务失败', error);
      message.error('删除任务失败');
    }
  };

  // 更新任务状态
  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await axios.patch(`${API_URL}/tasks/${id}/status`, { status });
      message.success('更新任务状态成功');
      fetchTasks(pagination.current, searchText, statusFilter);
    } catch (error) {
      console.error('更新任务状态失败', error);
      message.error('更新任务状态失败');
    }
  };

  // 暂停任务
  const handlePauseTask = async (id: string, reason: string) => {
    try {
      await axios.patch(`${API_URL}/tasks/${id}/status`, { 
        status: 'paused',
        pause_reason: reason 
      });
      message.success('任务已暂停');
      fetchTasks(pagination.current, searchText, statusFilter);
    } catch (error) {
      console.error('暂停任务失败', error);
      message.error('暂停任务失败');
    }
  };

  // 查看任务详情
  const handleView = (id: string) => {
    navigate(`/tasks/${id}`);
  };

  // 编辑任务
  const handleEdit = (id: string) => {
    navigate(`/tasks/edit/${id}`);
  };

  // 创建新任务
  const handleCreate = () => {
    if (campaignId) {
      navigate(`/tasks/create?campaign_id=${campaignId}`);
    } else {
      navigate('/tasks/create');
    }
  };

  // 搜索
  const handleSearch = (value: string) => {
    setSearchText(value);
    fetchTasks(1, value, statusFilter);
  };

  // 状态筛选
  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    fetchTasks(1, searchText, value);
  };

  // 分页变化
  const handleTableChange = (pagination: any) => {
    setPagination(pagination);
    fetchTasks(pagination.current, searchText, statusFilter);
  };

  // 🔧 新增：启动发送（弹出时间选择）
  const handleStartSending = (taskId: string) => {
    setSelectedTaskId(taskId);
    setScheduleModalVisible(true);
  };

  // 🔧 修复：处理时间选择确认 - 分别调用更新任务和更新状态的API
  const handleScheduleConfirm = async (scheduleTime: string, isImmediate: boolean) => {
    setScheduleModalVisible(false);
    try {
      // 1. 先更新任务的计划时间
      await axios.put(`${API_URL}/tasks/${selectedTaskId}`, {
        schedule_time: scheduleTime
      });
      
      // 2. 然后更新任务状态为scheduled
      await axios.patch(`${API_URL}/tasks/${selectedTaskId}/status`, {
        status: 'scheduled'
      });
      
      // 3. 如果是立即发送，再更新状态为sending
      if (isImmediate) {
        await axios.patch(`${API_URL}/tasks/${selectedTaskId}/status`, {
          status: 'sending'
        });
      }
      
      message.success(isImmediate ? '任务已启动，将立即开始发送' : '任务已调度成功');
      fetchTasks(pagination.current, searchText, statusFilter);
    } catch (error: any) {
      console.error('启动任务失败', error);
      let errorMessage = '启动任务失败';
      if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      message.error(errorMessage);
    } finally {
      setSelectedTaskId('');
    }
  };

  // 渲染状态标签
  const renderStatus = (status: string, record?: Task) => {
    const { color, text, icon } = taskStatusMap[status] || { color: 'default', text: status, icon: null };
    
    if (status === 'paused' && record?.pause_reason) {
      const reasonMap: Record<string, string> = {
        'manual': '手动暂停',
        'insufficient_balance': '余额不足',
        'service_error': '服务错误'
      };
      const reasonText = reasonMap[record.pause_reason] || record.pause_reason;
      
      return (
        <Tooltip title={`暂停原因: ${reasonText}`}>
          <Tag color={color} icon={icon}>{text}</Tag>
        </Tooltip>
      );
    }
    
    return <Tag color={color} icon={icon}>{text}</Tag>;
  };

  // 渲染状态操作按钮
  const renderStatusActions = (record: Task) => {
    const { status } = record;
    
    switch (status) {
      case 'draft':
        // 草稿：启动发送、编辑、删除
        return (
          <Tooltip title="启动发送">
            <Button
              type="text"
              icon={<SendOutlined />}
              onClick={() => handleStartSending(record.id)}
            />
          </Tooltip>
        );
      case 'scheduled':
        // 计划中：取消计划（回到草稿）
        return (
          <Tooltip title="取消计划">
            <Button
              type="text"
              icon={<CloseCircleOutlined />}
              onClick={() => handleUpdateStatus(record.id, 'draft')}
            />
          </Tooltip>
        );
      case 'sending':
        // 发送中：暂停发送
        return (
          <Tooltip title="暂停发送">
            <Button
              type="text"
              icon={<PauseCircleOutlined />}
              onClick={() => handlePauseTask(record.id, 'manual')}
            />
          </Tooltip>
        );
      case 'paused':
        // 暂停中：重新启动、关闭任务
        return (
          <Space>
            <Tooltip title="重新启动">
              <Button
                type="text"
                icon={<PlayCircleOutlined />}
                onClick={() => handleStartSending(record.id)}
              />
            </Tooltip>
            <Tooltip title="关闭任务">
              <Button
                type="text"
                danger
                icon={<StopOutlined />}
                onClick={() => handleUpdateStatus(record.id, 'closed')}
              />
            </Tooltip>
          </Space>
        );
      default:
        // completed、failed、cancelled、closed：无操作按钮
        return null;
    }
  };

  // 🔧 修复：安全的时间渲染函数，统一使用北京时间
  const renderDateTime = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleString('zh-CN', { 
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // 表格列定义
  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: Task) => renderStatus(status, record)
    },
    {
      title: '任务类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        // 🔧 修复：处理type为undefined的情况
        if (!type) return '单次发送';
        return type === 'one_time' ? '单次发送' : '序列发送';
      }
    },
    {
      title: '计划时间',
      dataIndex: 'schedule_time',
      key: 'schedule_time',
      render: (text: string) => renderDateTime(text) // 🔧 修复：使用安全的时间渲染函数
    },
    {
      title: '所属活动',
      dataIndex: 'campaign_name',
      key: 'campaign_name',
      render: (text: string) => text || '-' // 🔧 修复：处理空值
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => renderDateTime(text) // 🔧 修复：使用安全的时间渲染函数
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Task) => (
        <Space size="middle">
          {renderStatusActions(record)}
          <Tooltip title="查看">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleView(record.id)}
            />
          </Tooltip>
          {record.status === 'draft' && (
            <Tooltip title="编辑">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record.id)}
              />
            </Tooltip>
          )}
          {['draft', 'scheduled', 'paused', 'cancelled'].includes(record.status) && (
            <Tooltip title="删除">
              <Popconfirm
                title="确定要删除这个任务吗？"
                onConfirm={() => handleDelete(record.id)}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}>
          {campaignId ? '活动任务列表' : '邮件任务管理'}
        </Title>
        <Space>
          <Select
            placeholder="状态筛选"
            allowClear
            style={{ width: 120 }}
            onChange={handleStatusChange}
            value={statusFilter || undefined}
          >
            {Object.entries(taskStatusMap).map(([key, { text }]) => (
              <Option key={key} value={key}>{text}</Option>
            ))}
          </Select>
          <Search
            placeholder="搜索任务名称"
            onSearch={handleSearch}
            style={{ width: 250 }}
            allowClear
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            创建任务
          </Button>
        </Space>
      </div>
      
      <Table
        columns={columns}
        dataSource={tasks}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
      />

      <ScheduleTimeModal
        visible={scheduleModalVisible}
        onCancel={() => {
          setScheduleModalVisible(false);
          setSelectedTaskId('');
        }}
        onOk={handleScheduleConfirm}
        title="设置任务发送时间"
      />
    </div>
  );
};

export default TaskList; 