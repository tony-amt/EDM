import {
  BranchesOutlined,
  DeleteOutlined,
  EditOutlined,
  ExperimentOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Row,
  Space,
  Table,
  Tag,
  Typography
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useEffect, useState } from 'react';
import tagService, { TagTreeNode } from '../../services/tag.service';

const { Title } = Typography;

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

      // 过滤：确保只显示根标签，排除所有子标签和奇怪的标签
      const parentTags = tagTree.filter(tag => {
        // 排除有parent_id的标签（子标签）
        if (tag.parent_id) return false;

        // 排除名称包含分组字样的标签
        if (tag.name && (tag.name.includes('_分组') || tag.name.includes('分组'))) return false;

        // 排除系统内部标签（以下划线开头或特殊字符）
        if (tag.name && (tag.name.startsWith('_') || tag.name.startsWith('$'))) return false;

        // 排除空名称或无效名称的标签
        if (!tag.name || tag.name.trim() === '') return false;

        // 排除名称过长的异常标签（可能是数据错误）
        if (tag.name && tag.name.length > 50) return false;

        // 排除包含特殊系统关键词的标签
        const systemKeywords = ['system', 'admin', 'internal', 'temp', 'test_auto', 'debug'];
        const tagNameLower = tag.name.toLowerCase();
        if (systemKeywords.some(keyword => tagNameLower.includes(keyword))) return false;

        return true;
      });

      // 计算统计信息
      const tagsWithStats: TagWithStats[] = await Promise.all(
        parentTags.map(async (tag) => {
          const children = tag.children || [];
          const groupCount = children.length;
          const totalContacts = tag.contact_count || 0;

          // 计算已分组和未分组人数
          const groupedContacts = children.reduce((sum, child) => sum + (child.contact_count || 0), 0);
          const ungroupedContacts = Math.max(0, totalContacts - groupedContacts);

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



      setTags(tagsWithStats);

      // 不自动展开任何标签，让用户手动选择要查看的标签
      setExpandedRowKeys([]);

    } catch (error) {
      console.error('获取标签失败:', error);
      message.error('获取标签失败');
    } finally {
      setLoading(false);
    }
  };

  // 展开/收起子标签 - 只允许展开一个
  const handleExpand = (expanded: boolean, record: TagWithStats) => {
    if (expanded) {
      // 只展开当前标签，收起其他所有标签
      setExpandedRowKeys([record.id]);
    } else {
      setExpandedRowKeys([]);
    }
  };

  // 随机分组
  const handleRandomGroup = (tag: TagWithStats, isRegroup = false) => {
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
        groupNames: Array.from({ length: groupCount }, (_, i) => `分组${i + 1}`),
        isRegroup: randomGroupModal.isRegroup
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

      // 处理不同的响应格式
      let contacts = [];
      if (response.success && response.data) {
        // 如果有 contacts 字段
        if (response.data.contacts) {
          contacts = response.data.contacts;
        }
        // 如果 data 本身就是数组
        else if (Array.isArray(response.data)) {
          contacts = response.data;
        }
        // 如果 data 是对象但包含联系人信息
        else if (response.data.length !== undefined) {
          contacts = response.data;
        }
      }

      Modal.info({
        title: `标签"${tag.name}"的联系人`,
        width: 800,
        content: (
          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            {contacts.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {contacts.map((contact: any, index: number) => (
                  <li key={contact.id || index} style={{
                    padding: '8px 0',
                    borderBottom: '1px solid #f0f0f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <strong>{contact.email}</strong>
                      {contact.name && <span style={{ marginLeft: '8px', color: '#666' }}>({contact.name})</span>}
                    </div>
                    {contact.created_at && (
                      <span style={{ fontSize: '12px', color: '#999' }}>
                        {new Date(contact.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                暂无联系人
              </div>
            )}
          </div>
        )
      });
    } catch (error: any) {
      console.error('获取联系人失败:', error);
      const errorMessage = error.response?.data?.message || error.message || '获取联系人失败';
      message.error(errorMessage);
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
      render: (text: string, record: TagWithStats) => {
        const hasChildren = record.children && record.children.length > 0;
        const isExpanded = expandedRowKeys.includes(record.id);

        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              cursor: hasChildren ? 'pointer' : 'default',
              padding: '4px 0',
              borderRadius: '4px',
              transition: 'background-color 0.2s ease'
            }}
            onClick={() => {
              if (hasChildren) {
                handleExpand(!isExpanded, record);
              }
            }}
            onMouseEnter={(e) => {
              if (hasChildren) {
                e.currentTarget.style.backgroundColor = '#f5f5f5';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: record.color || '#1677ff',
                display: 'inline-block',
                marginRight: '8px'
              }}
            />
            <span style={{ fontWeight: 'bold' }}>{text}</span>
            {hasChildren && (
              <span style={{
                marginLeft: '8px',
                fontSize: '12px',
                color: '#999',
                userSelect: 'none'
              }}>
                {isExpanded ? '点击收起' : '点击展开'}
              </span>
            )}
          </div>
        );
      }
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
      return (
        <div style={{
          padding: '16px 24px',
          textAlign: 'center',
          color: '#999',
          backgroundColor: '#fafafa',
          borderRadius: '4px',
          margin: '8px 0'
        }}>
          暂无子标签
        </div>
      );
    }

    // 超过5条时使用滚动容器
    const hasScroll = record.children.length > 5;

    return (
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '16px 24px',
        margin: '8px 0',
        borderRadius: '6px',
        border: '1px solid #e8e8e8'
      }}>
        <div style={{
          marginBottom: '12px',
          fontWeight: 'bold',
          color: '#666',
          fontSize: '14px'
        }}>
          子标签列表 ({record.children.length})
        </div>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          maxHeight: hasScroll ? '300px' : 'none',
          overflowY: hasScroll ? 'auto' : 'visible',
          paddingRight: hasScroll ? '8px' : '0'
        }}>
          {record.children?.map((child: TagTreeNode) => (
            <div
              key={child.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px', // 减少内边距，提高信息密度
                backgroundColor: 'white',
                borderRadius: '4px',
                border: '1px solid #e8e8e8',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                e.currentTarget.style.borderColor = '#1677ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)';
                e.currentTarget.style.borderColor = '#e8e8e8';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: child.color || '#52c41a',
                    marginRight: '10px',
                    flexShrink: 0
                  }}
                />
                <div style={{ flex: 1 }}>
                  <span style={{
                    fontWeight: 500,
                    fontSize: '13px', // 稍微减小字体
                    color: '#262626'
                  }}>
                    {child.name}
                  </span>
                </div>
                <div style={{
                  marginLeft: '10px',
                  padding: '1px 6px',
                  backgroundColor: '#f0f0f0',
                  borderRadius: '10px',
                  fontSize: '11px',
                  color: '#666'
                }}>
                  {child.contact_count || 0}人
                </div>
              </div>
              <div style={{ marginLeft: '12px' }}>
                <Button
                  icon={<EyeOutlined />}
                  size="small"
                  type="text"
                  onClick={() => handleViewContacts(child as TagWithStats)}
                  style={{
                    border: 'none',
                    boxShadow: 'none',
                    fontSize: '11px',
                    height: '24px'
                  }}
                >
                  查看
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
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
        loading={loading}
        dataSource={tags}
        columns={columns}
        rowKey="id"
        expandable={{
          expandedRowRender,
          expandedRowKeys,
          onExpand: handleExpand,
          showExpandColumn: true,
          childrenColumnName: 'nonExistentField', // 阻止Ant Design自动渲染children
          expandIcon: ({ expanded, onExpand, record }) => {
            if (!record.children || record.children.length === 0) {
              return <span style={{ width: 17, display: 'inline-block' }} />;
            }
            return expanded ? (
              <Button
                type="text"
                size="small"
                icon={<PlusOutlined style={{ transform: 'rotate(45deg)' }} />}
                onClick={(e) => onExpand(record, e)}
                style={{ width: 17, height: 17, padding: 0 }}
              />
            ) : (
              <Button
                type="text"
                size="small"
                icon={<PlusOutlined />}
                onClick={(e) => onExpand(record, e)}
                style={{ width: 17, height: 17, padding: 0 }}
              />
            );
          }
        }}
        pagination={false}
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