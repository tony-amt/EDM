import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
  StopOutlined,
  SyncOutlined
} from '@ant-design/icons';
import {
  Button,
  Card,
  Descriptions,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography
} from 'antd';
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ScheduleTimeModal from '../../components/ScheduleTimeModal';
import taskService, { QueryParams, Task } from '../../services/task.service';

const { Search } = Input;
const { Option } = Select;
const { Text, Title } = Typography;

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

const TaskList: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total: number) => `共 ${total} 条记录`
  });
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [scheduleModalVisible, setScheduleModalVisible] = useState<boolean>(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');

  // 🔧 新增：查看内容相关状态
  const [contentModalVisible, setContentModalVisible] = useState<boolean>(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskTemplates, setTaskTemplates] = useState<any[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const campaignId = queryParams.get('campaign_id');

  // 获取任务列表 - 使用统一的taskService
  const fetchTasks = async (page = 1, name = '', status = '') => {
    setLoading(true);
    try {
      const params: QueryParams = {
        page,
        limit: pagination.pageSize,
        name,
        status
      };

      if (campaignId) {
        params.campaign_id = campaignId;
      }

      const response = await taskService.getTasks(params);

      // 🔧 修复：正确解析后端返回的数据格式
      const taskData = response.data || response;
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
    fetchTasks(pagination.current, searchKeyword, statusFilter);
  }, [campaignId]);

  // 删除任务 - 使用统一的taskService
  const handleDelete = async (id: string) => {
    try {
      await taskService.deleteTask(id);
      message.success('删除任务成功');
      fetchTasks(pagination.current, searchKeyword, statusFilter);
    } catch (error) {
      console.error('删除任务失败', error);
      message.error('删除任务失败');
    }
  };

  // 更新任务状态 - 使用统一的taskService
  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await taskService.updateTaskStatus(id, status);
      message.success('更新任务状态成功');
      fetchTasks(pagination.current, searchKeyword, statusFilter);
    } catch (error) {
      console.error('更新任务状态失败', error);
      message.error('更新任务状态失败');
    }
  };

  // 暂停任务 - 使用统一的taskService
  const handlePauseTask = async (id: string, reason: string) => {
    try {
      await taskService.updateTaskStatus(id, 'paused', reason);
      message.success('任务已暂停');
      fetchTasks(pagination.current, searchKeyword, statusFilter);
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
    navigate(`/tasks/${id}/edit`);
  };

  // 创建新任务
  const handleCreate = () => {
    if (campaignId) {
      navigate(`/campaigns/${campaignId}/tasks/create`);
    } else {
      navigate('/tasks/create');
    }
  };

  // 搜索
  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    fetchTasks(1, value, statusFilter);
  };

  // 状态筛选
  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    fetchTasks(1, searchKeyword, value);
  };

  // 分页变化
  const handleTableChange = (pagination: any) => {
    setPagination(pagination);
    fetchTasks(pagination.current, searchKeyword, statusFilter);
  };

  // 🔧 新增：启动发送（弹出时间选择）
  const handleStartSending = (taskId: string) => {
    setSelectedTaskId(taskId);
    setScheduleModalVisible(true);
  };

  // 🔧 修复：处理时间选择确认 - 使用统一的taskService
  const handleScheduleConfirm = async (scheduleTime: string, isImmediate: boolean) => {
    setScheduleModalVisible(false);
    try {
      // 1. 先更新任务的计划时间
      await taskService.updateTask(selectedTaskId, {
        schedule_time: scheduleTime
      });

      // 2. 然后更新任务状态为scheduled
      await taskService.updateTaskStatus(selectedTaskId, 'scheduled');

      // 3. 如果是立即发送，再更新状态为sending
      if (isImmediate) {
        await taskService.updateTaskStatus(selectedTaskId, 'sending');
      }

      message.success(isImmediate ? '任务已启动，将立即开始发送' : '任务已调度成功');
      fetchTasks(pagination.current, searchKeyword, statusFilter);
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

    // 使用北京时间显示
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

  // 🔧 新增：查看任务内容 - 使用统一的taskService
  const handleViewContent = async (task: Task) => {
    try {
      setSelectedTask(task);
      const response = await taskService.getTaskTemplates(task.id);
      setTaskTemplates(response.data || []);
      setContentModalVisible(true);
    } catch (error) {
      console.error('获取任务模板失败', error);
      message.error('获取任务内容失败');
    }
  };

  // 渲染统计数据
  const renderStats = (record: Task) => {
    const stats = record.summary_stats;
    if (!stats) return <Text type="secondary">暂无数据</Text>;

    return (
      <Space size="small">
        <Tag>总数: {stats.total_recipients}</Tag>
        <Tag color="blue">已发: {stats.sent}</Tag>
        <Tag color="green">送达: {stats.delivered}</Tag>
        <Tag color="orange">打开: {stats.opened}</Tag>
        <Tag color="purple">点击: {stats.clicked}</Tag>
        {stats.failed > 0 && <Tag color="red">失败: {stats.failed}</Tag>}
        {stats.bounced > 0 && <Tag color="volcano">退信: {stats.bounced}</Tag>}
      </Space>
    );
  };

  // 表格列定义
  const columns = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Task) => (
        <Space direction="vertical" size="small">
          <Text strong>{text}</Text>
          {record.description && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.description}
            </Text>
          )}
        </Space>
      ),
      width: '20%'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: Task) => renderStatus(status, record),
      width: '10%'
    },
    {
      title: '发送统计',
      key: 'stats',
      render: (_: any, record: Task) => renderStats(record),
      width: '25%'
    },
    {
      title: '计划时间',
      dataIndex: 'schedule_time',
      key: 'schedule_time',
      render: (text: string) => renderDateTime(text),
      width: '15%'
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => renderDateTime(text),
      width: '15%'
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Task) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleView(record.id)}
            />
          </Tooltip>
          <Tooltip title="查看内容">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleViewContent(record)}
            />
          </Tooltip>
          {record.status === 'cancelled' && (
            <Tooltip title="重新编辑">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record.id)}
              />
            </Tooltip>
          )}
          {renderStatusActions(record)}
          {(record.status === 'draft' || record.status === 'failed' || record.status === 'cancelled') && (
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
      ),
      width: '15%'
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}>
          {campaignId ? '活动任务管理' : '群发任务管理'}
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
            icon={<ReloadOutlined />}
            onClick={() => fetchTasks(pagination.current, searchKeyword, statusFilter)}
            loading={loading}
          >
            刷新
          </Button>
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
        scroll={{ x: 1200 }}
      />

      {/* 时间调度弹窗 */}
      <ScheduleTimeModal
        visible={scheduleModalVisible}
        onCancel={() => setScheduleModalVisible(false)}
        onOk={handleScheduleConfirm}
      />

      {/* 任务内容查看弹窗 */}
      <Modal
        title="任务内容预览"
        visible={contentModalVisible}
        onCancel={() => setContentModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedTask && (
          <div>
            <Descriptions title="任务信息" bordered size="small">
              <Descriptions.Item label="任务名称">{selectedTask.name}</Descriptions.Item>
              <Descriptions.Item label="状态">{renderStatus(selectedTask.status, selectedTask)}</Descriptions.Item>
              <Descriptions.Item label="计划时间">{renderDateTime(selectedTask.schedule_time)}</Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 16 }}>
              <Title level={5}>邮件模板</Title>
              {taskTemplates.length > 0 ? (
                <Tabs>
                  {taskTemplates.map((template, index) => (
                    <Tabs.TabPane tab={template.name} key={index}>
                      <Card>
                        <p><strong>邮件主题：</strong>{template.subject}</p>
                        <p><strong>邮件内容：</strong></p>
                        <div
                          dangerouslySetInnerHTML={{ __html: template.body }}
                          style={{
                            border: '1px solid #d9d9d9',
                            padding: '12px',
                            borderRadius: '6px',
                            backgroundColor: '#fafafa'
                          }}
                        />
                      </Card>
                    </Tabs.TabPane>
                  ))}
                </Tabs>
              ) : (
                <Text type="secondary">暂无模板信息</Text>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TaskList; 