import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Table,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Typography,
  Tag,
  Popconfirm,
  Collapse,
  Badge,
  Row,
  Col,
  Statistic,
  Alert
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  ExperimentOutlined,
  ReloadOutlined,
  BranchesOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import tagService, { TagTreeNode } from '../../services/tag.service';

const { Title } = Typography;
const { Panel } = Collapse;

interface TagWithStats extends TagTreeNode {
  groupCount: number;
  totalContacts: number;
  ungroupedContacts: number;
  hasUngrouped: boolean;
}

interface RandomGroupModalData {
  visible: boolean;
  tagId: string;
  tagName: string;
  totalContacts: number;
  isRegroup: boolean;
}

const TagManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [tags, setTags] = useState<TagWithStats[]>([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  
  // 模态框状态
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [randomGroupModal, setRandomGroupModal] = useState<RandomGroupModalData>({
    visible: false,
    tagId: '',
    tagName: '',
    totalContacts: 0,
    isRegroup: false
  });
  
  // 表单
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [groupForm] = Form.useForm();
  const [editingTag, setEditingTag] = useState<TagWithStats | null>(null);

  useEffect(() => {
    fetchTags();
  }, []);

  // 获取标签列表
  const fetchTags = async () => {
    setLoading(true);
    try {
      const response = await tagService.getTagTree();
      const tagTree = response.data;
      
      console.log('🔧 [DEBUG] 获取到的标签树数据:', tagTree);
      
      // 只获取一级标签（父标签）
      const parentTags = tagTree.filter(tag => !(tag as any).parent_id);
      
      console.log('🔧 [DEBUG] 过滤后的父标签:', parentTags);
      
      // 计算统计信息
      const tagsWithStats: TagWithStats[] = await Promise.all(
        parentTags.map(async (tag) => {
          const children = tagTree.filter(child => (child as any).parent_id === tag.id);
          const groupCount = children.length;
          const totalContacts = tag.contact_count || 0;
          
          console.log(`🔧 [DEBUG] 标签 "${tag.name}" - 子标签数: ${groupCount}, 总联系人: ${totalContacts}`);
          console.log(`🔧 [DEBUG] 子标签列表:`, children.map(c => ({ name: c.name, contact_count: c.contact_count })));
          
          // 计算已分组和未分组人数
          const groupedContacts = children.reduce((sum, child) => sum + (child.contact_count || 0), 0);
          const ungroupedContacts = Math.max(0, totalContacts - groupedContacts);
          
          console.log(`🔧 [DEBUG] 标签 "${tag.name}" - 已分组联系人: ${groupedContacts}, 未分组联系人: ${ungroupedContacts}`);
          
          return {
            ...tag,
            groupCount,
            totalContacts,
            ungroupedContacts,
            hasUngrouped: ungroupedContacts > 0,
            children
          };
        })
      );
      
      console.log('🔧 [DEBUG] 最终的标签统计数据:', tagsWithStats);
      setTags(tagsWithStats);
    } catch (error) {
      console.error('获取标签失败:', error);
      message.error('获取标签失败');
    } finally {
      setLoading(false);
    }
  };

  // 展开/收起子标签
  const handleExpand = (expanded: boolean, record: TagWithStats) => {
    if (expanded) {
      // 收起其他标签，只展开当前标签
      setExpandedRowKeys([record.id]);
    } else {
      setExpandedRowKeys([]);
    }
  };

  // 随机分组
  const handleRandomGroup = (tag: TagWithStats, isRegroup = false) => {
    // 重置表单字段，清除输入缓存
    groupForm.resetFields();
    
    setRandomGroupModal({
      visible: true,
      tagId: tag.id,
      tagName: tag.name,
      totalContacts: isRegroup ? tag.totalContacts : tag.ungroupedContacts,
      isRegroup
    });
  };

  // 执行随机分组
  const executeRandomGroup = async () => {
    try {
      const values = await groupForm.validateFields();
      const { groupCount, groupSize } = values;
      
      // 数值边缘控制
      const totalContacts = randomGroupModal.totalContacts;
      
      // 检查分组数是否超过总人数
      if (groupCount > totalContacts) {
        message.error(`分组数不能大于${randomGroupModal.isRegroup ? '总' : '剩余未分组'}人数(${totalContacts})`);
        return;
      }
      
      // 如果设置了每组人数，检查是否合理
      if (groupSize) {
        const totalNeeded = groupCount * groupSize;
        if (totalNeeded > totalContacts) {
          message.error(`分组数 × 每组人数(${totalNeeded}) 不能大于${randomGroupModal.isRegroup ? '总' : '剩余未分组'}人数(${totalContacts})`);
          return;
        }
        
        // 如果每组人数设置较小，提醒用户
        if (totalNeeded < totalContacts * 0.8) {
          const confirmed = await new Promise((resolve) => {
            Modal.confirm({
              title: '分组提醒',
              content: `按当前设置，将有 ${totalContacts - totalNeeded} 人无法分组。是否继续平均分配？`,
              onOk: () => resolve(true),
              onCancel: () => resolve(false)
            });
          });
          
          if (!confirmed) return;
        }
      }
      
      setLoading(true);
      
      const splitData = {
        testName: `${randomGroupModal.tagName}_随机分组_${new Date().getTime()}`,
        groupCount: groupCount,
        splitRatio: Array(groupCount).fill(1 / groupCount),
        groupNames: Array.from({ length: groupCount }, (_, i) => `分组${i + 1}`)
      };
      
      await tagService.createSplitTest(randomGroupModal.tagId, splitData);
      
      message.success('随机分组创建成功');
      setRandomGroupModal({ ...randomGroupModal, visible: false });
      groupForm.resetFields();
      fetchTags();
      
    } catch (error: any) {
      console.error('创建随机分组失败:', error);
      message.error('创建随机分组失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 查看联系人
  const handleViewContacts = async (tag: TagWithStats) => {
    try {
      const response = await tagService.getTagContacts(tag.id);
      const contacts = response.data?.contacts || [];
      
      Modal.info({
        title: `标签"${tag.name}"的联系人`,
        width: 800,
        content: (
          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            {contacts.length > 0 ? (
              <ul>
                {contacts.map((contact: any, index: number) => (
                  <li key={index}>
                    {contact.email} - {contact.name || '未命名'}
                  </li>
                ))}
              </ul>
            ) : (
              <p>暂无联系人</p>
            )}
          </div>
        )
      });
    } catch (error) {
      console.error('获取联系人失败:', error);
      message.error('获取联系人失败');
    }
  };

  // 编辑标签
  const handleEdit = (tag: TagWithStats) => {
    setEditingTag(tag);
    editForm.setFieldsValue({
      name: tag.name,
      description: tag.description || '',
      color: tag.color || '#1677ff'
    });
    setEditModalVisible(true);
  };

  // 删除标签
  const handleDelete = async (tagId: string) => {
    try {
      setLoading(true);
      await tagService.deleteTag(tagId);
      message.success('标签删除成功');
      fetchTags();
    } catch (error: any) {
      console.error('删除标签失败:', error);
      message.error('删除标签失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 创建标签
  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setLoading(true);
      await tagService.createTag(values);
      message.success('标签创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      fetchTags();
    } catch (error: any) {
      console.error('创建标签失败:', error);
      message.error('创建标签失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 更新标签
  const handleUpdate = async () => {
    try {
      const values = await editForm.validateFields();
      if (!editingTag) return;
      
      setLoading(true);
      await tagService.updateTag(editingTag.id, values);
      message.success('标签更新成功');
      setEditModalVisible(false);
      editForm.resetFields();
      setEditingTag(null);
      fetchTags();
    } catch (error: any) {
      console.error('更新标签失败:', error);
      message.error('更新标签失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 表格列定义
  const columns: ColumnsType<TagWithStats> = [
    {
      title: '标签名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: TagWithStats) => (
        <Space>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: record.color || '#1677ff',
              display: 'inline-block'
            }}
          />
          <span style={{ fontWeight: 'bold' }}>{text}</span>
          {record.description && (
            <span style={{ color: '#999', fontSize: '12px' }}>({record.description})</span>
          )}
        </Space>
      )
    },
    {
      title: '已分组组数',
      dataIndex: 'groupCount',
      key: 'groupCount',
      width: 120,
      render: (count: number) => (
        <Badge count={count} style={{ backgroundColor: '#52c41a' }} />
      )
    },
    {
      title: '包含联系人数',
      dataIndex: 'totalContacts',
      key: 'totalContacts',
      width: 140,
      render: (count: number, record: TagWithStats) => (
        <Button
          type="link"
          style={{ padding: 0, fontSize: '14px', fontWeight: 'bold' }}
          onClick={() => handleViewContacts(record)}
        >
          {count}人
        </Button>
      )
    },
    {
      title: '未分组人数',
      dataIndex: 'ungroupedContacts',
      key: 'ungroupedContacts',
      width: 120,
      render: (count: number, record: TagWithStats) => (
        <Tag color={count > 0 ? 'orange' : 'green'}>
          {count}人
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 300,
      render: (_, record: TagWithStats) => {
        const showRandomGroup = record.groupCount === 0 && record.ungroupedContacts > 0;
        const showContinueGroup = record.groupCount > 0 && record.ungroupedContacts > 0;
        const showRegroupOnly = record.groupCount > 0 && record.ungroupedContacts === 0;
        
        return (
          <Space size="small">
            {/* 随机分组：未分组且有未分组人数 */}
            {showRandomGroup && (
              <Button
                type="primary"
                icon={<ExperimentOutlined />}
                size="small"
                onClick={() => handleRandomGroup(record, false)}
                title="随机分组"
              />
            )}
            
            {/* 继续分组：已分组且有未分组人数 */}
            {showContinueGroup && (
              <Button
                icon={<BranchesOutlined />}
                size="small"
                onClick={() => handleRandomGroup(record, false)}
                title="继续分组"
              />
            )}
            
            {/* 重新分组：已分组（无论是否有未分组人数） */}
            {(showContinueGroup || showRegroupOnly) && (
              <Button
                icon={<ReloadOutlined />}
                size="small"
                onClick={() => handleRandomGroup(record, true)}
                title="重新分组"
              />
            )}
            
            <Button
              icon={<EyeOutlined />}
              size="small"
              onClick={() => handleViewContacts(record)}
              title="查看联系人"
            />
            
            <Button
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEdit(record)}
              title="编辑标签"
            />
            
            <Popconfirm
              title="确定要删除此标签吗？"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                icon={<DeleteOutlined />}
                size="small"
                danger
                title="删除标签"
              />
            </Popconfirm>
          </Space>
        );
      }
    }
  ];

  // 子标签展开内容
  const expandedRowRender = (record: TagWithStats) => {
    if (!record.children || record.children.length === 0) {
      return <p style={{ margin: 0, padding: 16, color: '#999' }}>暂无子标签</p>;
    }

    const subColumns: ColumnsType<TagTreeNode> = [
      {
        title: '子标签名称',
        dataIndex: 'name',
        key: 'name',
        render: (text: string, subRecord: TagTreeNode) => (
          <Space>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: subRecord.color || '#1677ff',
                display: 'inline-block'
              }}
            />
            {text}
          </Space>
        )
      },
      {
        title: '联系人数',
        dataIndex: 'contact_count',
        key: 'contact_count',
        width: 100,
        render: (count: number) => `${count || 0}人`
      },
      {
        title: '操作',
        key: 'actions',
        width: 100,
        render: (_, subRecord: TagTreeNode) => (
          <Button
            icon={<EyeOutlined />}
            size="small"
            onClick={() => handleViewContacts(subRecord as TagWithStats)}
          >
            查看联系人
          </Button>
        )
      }
    ];

    return (
      <Table
        columns={subColumns}
        dataSource={record.children}
        pagination={false}
        size="small"
        rowKey="id"
        style={{ margin: '0 16px' }}
      />
    );
  };

  return (
    <Card>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>标签管理</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchTags}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            创建标签
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={tags}
        loading={loading}
        rowKey="id"
        expandable={{
          expandedRowKeys,
          onExpand: handleExpand,
          expandedRowRender,
          expandIcon: ({ expanded, onExpand, record }) => (
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined style={{ transform: expanded ? 'rotate(45deg)' : 'none' }} />}
              onClick={(e) => onExpand(record, e)}
              disabled={!record.children || record.children.length === 0}
            />
          )
        }}
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 个标签`
        }}
      />

      {/* 创建标签模态框 */}
      <Modal
        title="创建标签"
        open={createModalVisible}
        onOk={handleCreate}
        onCancel={() => setCreateModalVisible(false)}
        confirmLoading={loading}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="name"
            label="标签名称"
            rules={[{ required: true, message: '请输入标签名称' }]}
          >
            <Input placeholder="请输入标签名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="请输入标签描述" rows={3} />
          </Form.Item>
          <Form.Item name="color" label="颜色" initialValue="#1677ff">
            <Input type="color" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑标签模态框 */}
      <Modal
        title="编辑标签"
        open={editModalVisible}
        onOk={handleUpdate}
        onCancel={() => setEditModalVisible(false)}
        confirmLoading={loading}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="name"
            label="标签名称"
            rules={[{ required: true, message: '请输入标签名称' }]}
          >
            <Input placeholder="请输入标签名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="请输入标签描述" rows={3} />
          </Form.Item>
          <Form.Item name="color" label="颜色">
            <Input type="color" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 随机分组模态框 */}
      <Modal
        title={`${randomGroupModal.isRegroup ? '重新分组' : '随机分组'} - ${randomGroupModal.tagName}`}
        open={randomGroupModal.visible}
        onOk={executeRandomGroup}
        onCancel={() => setRandomGroupModal({ ...randomGroupModal, visible: false })}
        confirmLoading={loading}
        width={600}
      >
        <Alert
          message={`将对 ${randomGroupModal.totalContacts} 个联系人进行${randomGroupModal.isRegroup ? '重新' : ''}分组`}
          type="info"
          style={{ marginBottom: 16 }}
        />
        
        <Form form={groupForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="groupCount"
                label="计划分组数"
                rules={[
                  { required: true, message: '请输入分组数' },
                  { 
                    type: 'number', 
                    min: 2, 
                    max: Math.min(10, randomGroupModal.totalContacts), 
                    message: `分组数应在2-${Math.min(10, randomGroupModal.totalContacts)}之间` 
                  }
                ]}
              >
                <InputNumber
                  placeholder="请输入分组数"
                  style={{ width: '100%' }}
                  min={2}
                  max={Math.min(10, randomGroupModal.totalContacts)}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="groupSize"
                label="每组人数（可选）"
                help="不填写则平均分配"
              >
                <InputNumber
                  placeholder="每组人数"
                  style={{ width: '100%' }}
                  min={1}
                  max={Math.floor(randomGroupModal.totalContacts / 2)}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </Card>
  );
};

export default TagManagement; 