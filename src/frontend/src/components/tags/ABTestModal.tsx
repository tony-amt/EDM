import React, { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Button,
  Space,
  Card,
  Row,
  Col,
  Progress,
  Tag,
  Divider,
  Alert,
  Tooltip,
  message
} from 'antd';
import {
  ExperimentOutlined,
  PlusOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  UserOutlined
} from '@ant-design/icons';
import tagService from '../../services/tag.service';

interface ABTestGroup {
  name: string;
  ratio: number;
  color?: string;
}

interface ABTestModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  tagId: string;
  tagName: string;
  contactCount: number;
}

const ABTestModal: React.FC<ABTestModalProps> = ({
  visible,
  onCancel,
  onSuccess,
  tagId,
  tagName,
  contactCount
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<ABTestGroup[]>([
    { name: 'A组', ratio: 50, color: '#1890ff' },
    { name: 'B组', ratio: 50, color: '#52c41a' }
  ]);

  const defaultColors = [
    '#1890ff', '#52c41a', '#faad14', '#f5222d', 
    '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'
  ];

  // 添加分组
  const addGroup = () => {
    if (groups.length >= 8) {
      message.warning('最多支持8个分组');
      return;
    }
    
    const newGroup: ABTestGroup = {
      name: `${String.fromCharCode(65 + groups.length)}组`,
      ratio: 0,
      color: defaultColors[groups.length % defaultColors.length]
    };
    
    setGroups([...groups, newGroup]);
    
    // 重新平均分配比例
    const avgRatio = Math.floor(100 / (groups.length + 1));
    const newGroups = [...groups, newGroup].map((group, index) => ({
      ...group,
      ratio: index === groups.length ? 100 - avgRatio * groups.length : avgRatio
    }));
    setGroups(newGroups);
  };

  // 删除分组
  const removeGroup = (index: number) => {
    if (groups.length <= 2) {
      message.warning('至少需要2个分组');
      return;
    }
    
    const newGroups = groups.filter((_, i) => i !== index);
    
    // 重新分配比例
    const totalRatio = newGroups.reduce((sum, group) => sum + group.ratio, 0);
    if (totalRatio !== 100) {
      const avgRatio = Math.floor(100 / newGroups.length);
      newGroups.forEach((group, i) => {
        group.ratio = i === newGroups.length - 1 ? 100 - avgRatio * (newGroups.length - 1) : avgRatio;
      });
    }
    
    setGroups(newGroups);
  };

  // 更新分组名称
  const updateGroupName = (index: number, name: string) => {
    const newGroups = [...groups];
    newGroups[index].name = name;
    setGroups(newGroups);
  };

  // 更新分组比例
  const updateGroupRatio = (index: number, ratio: number) => {
    const newGroups = [...groups];
    newGroups[index].ratio = ratio;
    
    // 自动调整其他组的比例
    const otherGroupsTotal = newGroups.reduce((sum, group, i) => 
      i !== index ? sum + group.ratio : sum, 0
    );
    
    if (otherGroupsTotal + ratio > 100) {
      // 如果超过100%，按比例缩减其他组
      const scale = (100 - ratio) / otherGroupsTotal;
      newGroups.forEach((group, i) => {
        if (i !== index) {
          group.ratio = Math.round(group.ratio * scale);
        }
      });
    }
    
    setGroups(newGroups);
  };

  // 平均分配比例
  const distributeEvenly = () => {
    const avgRatio = Math.floor(100 / groups.length);
    const remainder = 100 - avgRatio * groups.length;
    
    const newGroups = groups.map((group, index) => ({
      ...group,
      ratio: index < remainder ? avgRatio + 1 : avgRatio
    }));
    
    setGroups(newGroups);
  };

  // 计算预期分组人数
  const getExpectedCount = (ratio: number) => {
    return Math.round(contactCount * ratio / 100);
  };

  // 验证表单
  const validateGroups = () => {
    const totalRatio = groups.reduce((sum, group) => sum + group.ratio, 0);
    if (totalRatio !== 100) {
      message.error('分组比例总和必须等于100%');
      return false;
    }
    
    const hasEmptyName = groups.some(group => !group.name.trim());
    if (hasEmptyName) {
      message.error('分组名称不能为空');
      return false;
    }
    
    const duplicateNames = groups.map(g => g.name).filter((name, index, arr) => 
      arr.indexOf(name) !== index
    );
    if (duplicateNames.length > 0) {
      message.error('分组名称不能重复');
      return false;
    }
    
    return true;
  };

  // 提交A/B测试
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (!validateGroups()) {
        return;
      }
      
      setLoading(true);
      
      const splitData = {
        testName: values.testName,
        groupCount: groups.length,
        splitRatio: groups.map(g => g.ratio / 100),
        groupNames: groups.map(g => g.name)
      };
      
      await tagService.createSplitTest(tagId, splitData);
      
      message.success('A/B测试分组创建成功');
      onSuccess();
      handleCancel();
      
    } catch (error: any) {
      console.error('创建A/B测试失败:', error);
      message.error('创建A/B测试失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setGroups([
      { name: 'A组', ratio: 50, color: '#1890ff' },
      { name: 'B组', ratio: 50, color: '#52c41a' }
    ]);
    onCancel();
  };

  const totalRatio = groups.reduce((sum, group) => sum + group.ratio, 0);

  return (
    <Modal
      title={
        <Space>
          <ExperimentOutlined />
          A/B测试分组
        </Space>
      }
      open={visible}
      onCancel={handleCancel}
      width={800}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          取消
        </Button>,
        <Button key="submit" type="primary" loading={loading} onClick={handleSubmit}>
          创建分组
        </Button>
      ]}
    >
      <Alert
        message="A/B测试说明"
        description={`将标签"${tagName}"下的${contactCount}个联系人随机分配到不同组别，用于邮件营销效果对比测试。`}
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Form form={form} layout="vertical">
        <Form.Item
          name="testName"
          label="测试名称"
          rules={[
            { required: true, message: '请输入测试名称' },
            { max: 50, message: '测试名称不能超过50个字符' }
          ]}
        >
          <Input placeholder="请输入测试名称，如：邮件主题A/B测试" />
        </Form.Item>
      </Form>

      <Divider>分组配置</Divider>

      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button 
            type="dashed" 
            icon={<PlusOutlined />} 
            onClick={addGroup}
            disabled={groups.length >= 8}
          >
            添加分组
          </Button>
          <Button onClick={distributeEvenly}>
            平均分配
          </Button>
          <Tooltip title="比例总和必须等于100%">
            <span>
              总比例: <Tag color={totalRatio === 100 ? 'green' : 'red'}>{totalRatio}%</Tag>
            </span>
          </Tooltip>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        {groups.map((group, index) => (
          <Col span={12} key={index}>
            <Card
              size="small"
              title={
                <Space>
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: group.color,
                      display: 'inline-block'
                    }}
                  />
                  分组 {index + 1}
                </Space>
              }
              extra={
                groups.length > 2 && (
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => removeGroup(index)}
                    danger
                  />
                )
              }
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <label>分组名称:</label>
                  <Input
                    value={group.name}
                    onChange={(e) => updateGroupName(index, e.target.value)}
                    placeholder="请输入分组名称"
                    style={{ marginTop: 4 }}
                  />
                </div>
                
                <div>
                  <label>分配比例:</label>
                  <InputNumber
                    value={group.ratio}
                    onChange={(value) => updateGroupRatio(index, value || 0)}
                    min={0}
                    max={100}
                    formatter={value => `${value}%`}
                    parser={value => parseInt(value!.replace('%', ''), 10)}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </div>
                
                <div>
                  <Progress
                    percent={group.ratio}
                    strokeColor={group.color}
                    size="small"
                    format={() => `${getExpectedCount(group.ratio)}人`}
                  />
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Divider>分组预览</Divider>

      <Card size="small">
        <Row gutter={16}>
          <Col span={12}>
            <div style={{ textAlign: 'center' }}>
              <UserOutlined style={{ fontSize: 24, color: '#1890ff' }} />
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 18, fontWeight: 'bold' }}>{contactCount}</div>
                <div style={{ color: '#666' }}>总联系人数</div>
              </div>
            </div>
          </Col>
          <Col span={12}>
            <div style={{ textAlign: 'center' }}>
              <ExperimentOutlined style={{ fontSize: 24, color: '#52c41a' }} />
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 18, fontWeight: 'bold' }}>{groups.length}</div>
                <div style={{ color: '#666' }}>分组数量</div>
              </div>
            </div>
          </Col>
        </Row>
        
        <Divider style={{ margin: '12px 0' }} />
        
        <Space wrap>
          {groups.map((group, index) => (
            <Tag key={index} color={group.color}>
              {group.name}: {group.ratio}% ({getExpectedCount(group.ratio)}人)
            </Tag>
          ))}
        </Space>
      </Card>
    </Modal>
  );
};

export default ABTestModal; 