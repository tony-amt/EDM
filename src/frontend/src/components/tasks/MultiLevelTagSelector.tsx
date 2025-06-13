import React, { useState, useEffect } from 'react';
import { Select, Space, message, Cascader } from 'antd';
import { TagOutlined, FolderOutlined } from '@ant-design/icons';
import tagService, { TagTreeNode } from '../../services/tag.service';

interface MultiLevelTagSelectorProps {
  value?: string[];
  onChange?: (value: string[]) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  maxTagCount?: number;
}

interface CascaderOption {
  label: React.ReactNode;
  value: string;
  children?: CascaderOption[];
  isLeaf?: boolean;
}

const MultiLevelTagSelector: React.FC<MultiLevelTagSelectorProps> = ({
  value = [],
  onChange,
  placeholder = "请选择标签",
  style,
  disabled = false,
  maxTagCount = 10
}) => {
  const [tagTree, setTagTree] = useState<TagTreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTags, setSelectedTags] = useState<Array<{id: string, name: string, level: number}>>([]);

  useEffect(() => {
    fetchTagTree();
  }, []);

  useEffect(() => {
    // 根据value更新selectedTags显示
    if (value && value.length > 0) {
      updateSelectedTagsDisplay(value);
    } else {
      setSelectedTags([]);
    }
  }, [value, tagTree]);

  // 获取标签树
  const fetchTagTree = async () => {
    setLoading(true);
    try {
      const response = await tagService.getTagTree();
      setTagTree(response.data);
    } catch (error) {
      console.error('获取标签树失败:', error);
      message.error('获取标签树失败');
    } finally {
      setLoading(false);
    }
  };

  // 更新选中标签的显示信息
  const updateSelectedTagsDisplay = (selectedIds: string[]) => {
    const findTagInfo = (tags: TagTreeNode[], targetId: string, level = 1): {id: string, name: string, level: number} | null => {
      for (const tag of tags) {
        if (tag.id === targetId) {
          return { id: tag.id, name: tag.name, level };
        }
        if (tag.children && tag.children.length > 0) {
          const found = findTagInfo(tag.children, targetId, level + 1);
          if (found) return found;
        }
      }
      return null;
    };

    const tagInfos = selectedIds.map(id => findTagInfo(tagTree, id)).filter(Boolean) as Array<{id: string, name: string, level: number}>;
    setSelectedTags(tagInfos);
  };

  // 构建级联选择器选项
  const buildCascaderOptions = (tags: TagTreeNode[]): CascaderOption[] => {
    return tags.map(tag => {
      const hasChildren = tag.children && tag.children.length > 0;
      
      return {
        label: (
          <Space>
            {hasChildren ? (
              <FolderOutlined style={{ color: '#1890ff' }} />
            ) : (
              <TagOutlined style={{ color: tag.color || '#666' }} />
            )}
            <span>{tag.name}</span>
            {tag.contact_count !== undefined && (
              <span style={{ color: '#999', fontSize: '12px' }}>
                ({tag.contact_count}人)
              </span>
            )}
          </Space>
        ),
        value: tag.id,
                 children: hasChildren ? buildCascaderOptions(tag.children || []) : undefined,
        isLeaf: !hasChildren
      };
    });
  };

  // 处理级联选择
  const handleCascaderChange = (selectedPath: string[]) => {
    if (selectedPath.length === 0) return;
    
    const selectedId = selectedPath[selectedPath.length - 1];
    
    // 检查是否已选中
    if (value.includes(selectedId)) {
      message.info('该标签已选中');
      return;
    }

    // 如果选择的是一级标签，需要检查是否要选中所有子标签
    const selectedTag = findTagById(tagTree, selectedId);
    if (selectedTag && selectedTag.children && selectedTag.children.length > 0) {
      // 选择一级标签时，自动选中所有二级标签
      const childIds = selectedTag.children.map(child => child.id);
      const newValue = [...value.filter(id => !childIds.includes(id)), selectedId, ...childIds];
      onChange?.(newValue);
    } else {
      // 选择二级标签
      const newValue = [...value, selectedId];
      onChange?.(newValue);
    }
  };

  // 根据ID查找标签
  const findTagById = (tags: TagTreeNode[], targetId: string): TagTreeNode | null => {
    for (const tag of tags) {
      if (tag.id === targetId) return tag;
      if (tag.children && tag.children.length > 0) {
        const found = findTagById(tag.children, targetId);
        if (found) return found;
      }
    }
    return null;
  };

  // 移除标签
  const handleRemoveTag = (tagId: string) => {
    const newValue = value.filter(id => id !== tagId);
    
    // 如果移除的是一级标签，同时移除其所有子标签
    const removedTag = findTagById(tagTree, tagId);
    if (removedTag && removedTag.children && removedTag.children.length > 0) {
      const childIds = removedTag.children.map(child => child.id);
      const finalValue = newValue.filter(id => !childIds.includes(id));
      onChange?.(finalValue);
    } else {
      onChange?.(newValue);
    }
  };

  const cascaderOptions = buildCascaderOptions(tagTree);

  return (
    <div style={style}>
      <Cascader
        options={cascaderOptions}
        onChange={handleCascaderChange}
        placeholder={placeholder}
        disabled={disabled}
        loading={loading}
        style={{ width: '100%', marginBottom: selectedTags.length > 0 ? 8 : 0 }}
        expandTrigger="hover"
        changeOnSelect
        showSearch={{
          filter: (inputValue, path) =>
            path.some(option => 
              (option.label as any)?.props?.children?.[1]?.props?.children
                ?.toLowerCase()
                ?.includes(inputValue.toLowerCase())
            )
        }}
      />
      
      {selectedTags.length > 0 && (
        <div style={{ 
          border: '1px solid #d9d9d9', 
          borderRadius: 6, 
          padding: 8,
          minHeight: 32,
          backgroundColor: '#fafafa'
        }}>
          <Space size={[8, 4]} wrap>
            {selectedTags.map(tag => (
              <span
                key={tag.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 8px',
                  backgroundColor: tag.level === 1 ? '#e6f7ff' : '#f6ffed',
                  border: `1px solid ${tag.level === 1 ? '#91d5ff' : '#b7eb8f'}`,
                  borderRadius: 4,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
                onClick={() => handleRemoveTag(tag.id)}
              >
                {tag.level === 1 ? (
                  <FolderOutlined style={{ marginRight: 4, color: '#1890ff' }} />
                ) : (
                  <TagOutlined style={{ marginRight: 4, color: '#52c41a' }} />
                )}
                {tag.name}
                <span style={{ marginLeft: 4, color: '#999' }}>×</span>
              </span>
            ))}
          </Space>
          <div style={{ fontSize: '12px', color: '#999', marginTop: 4 }}>
            已选择 {selectedTags.length} 个标签，点击标签可移除
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiLevelTagSelector; 