import React, { useState, useEffect } from 'react';
import { Tree, Input, Space, Badge, Tag, Tooltip, Spin } from 'antd';
import { SearchOutlined, FolderOutlined, TagOutlined } from '@ant-design/icons';
import tagService from '../../services/tag.service';

const { Search } = Input;

interface TagTreeSelectorProps {
  value?: string[];
  onChange?: (selectedKeys: string[], selectedTags: any[]) => void;
  multiple?: boolean;
  placeholder?: string;
  disabled?: boolean;
  showSearch?: boolean;
  showCount?: boolean;
  autoInherit?: boolean;
  maxTagCount?: number;
  style?: React.CSSProperties;
}

const TagTreeSelector: React.FC<TagTreeSelectorProps> = ({
  value = [],
  onChange,
  multiple = true,
  placeholder = "请选择标签",
  disabled = false,
  showSearch = true,
  showCount = true,
  autoInherit = true,
  maxTagCount = 10,
  style
}) => {
  const [treeData, setTreeData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(value);
  const [allTags, setAllTags] = useState<any[]>([]);

  useEffect(() => {
    fetchTagTree();
  }, []);

  useEffect(() => {
    setSelectedKeys(value);
  }, [value]);

  // 获取标签树
  const fetchTagTree = async () => {
    setLoading(true);
    try {
      const response = await tagService.getTagTree();
      const tagTree = response.data;
      
      // 扁平化所有标签
      const flatTags = flattenTags(tagTree);
      setAllTags(flatTags);
      
      // 构建树形数据
      const treeData = buildTreeData(tagTree);
      setTreeData(treeData);
      
      // 默认展开所有父节点
      const parentKeys = tagTree.map((tag: any) => tag.id);
      setExpandedKeys(parentKeys);
    } catch (error) {
      console.error('获取标签树失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 扁平化标签数据
  const flattenTags = (tags: any[]): any[] => {
    const result: any[] = [];
    const traverse = (tagList: any[]) => {
      tagList.forEach((tag: any) => {
        result.push(tag);
        if (tag.children && tag.children.length > 0) {
          traverse(tag.children);
        }
      });
    };
    traverse(tags);
    return result;
  };

  // 构建树形数据
  const buildTreeData = (tags: any[]): any[] => {
    return tags.map((tag: any) => ({
      key: tag.id,
      title: renderTagTitle(tag),
      children: tag.children && tag.children.length > 0 ? buildTreeData(tag.children) : undefined,
      isLeaf: !tag.children || tag.children.length === 0,
      tagData: tag
    }));
  };

  // 渲染标签标题
  const renderTagTitle = (tag: any) => {
    const isParent = tag.children && tag.children.length > 0;
    const isSelected = selectedKeys.includes(tag.id);
    
    return (
      <Space size={4}>
        {isParent ? (
          <FolderOutlined style={{ color: '#1890ff' }} />
        ) : (
          <TagOutlined style={{ color: tag.color || '#666' }} />
        )}
        <span style={{ 
          fontWeight: isParent ? 'bold' : 'normal',
          color: isSelected ? '#1890ff' : undefined
        }}>
          {tag.name}
        </span>
        {showCount && (
          <Badge 
            count={tag.contact_count || 0} 
            size="small" 
            style={{ backgroundColor: '#f0f0f0', color: '#666' }}
          />
        )}
        {tag.description && (
          <Tooltip title={tag.description}>
            <span style={{ color: '#999', fontSize: '12px' }}>(?)</span>
          </Tooltip>
        )}
      </Space>
    );
  };

  // 处理选择变化
  const handleCheck = (checkedKeys: any) => {
    if (disabled) return;

    let newSelectedKeys: string[] = [];
    
    if (Array.isArray(checkedKeys)) {
      newSelectedKeys = checkedKeys.map(key => String(key));
    } else {
      newSelectedKeys = checkedKeys.checked.map((key: any) => String(key));
    }

    // 限制选择数量
    if (multiple && maxTagCount && newSelectedKeys.length > maxTagCount) {
      return;
    }

    setSelectedKeys(newSelectedKeys);
    
    // 获取选中的标签对象
    const selectedTags = allTags.filter(tag => newSelectedKeys.includes(tag.id));
    onChange?.(newSelectedKeys, selectedTags);
  };

  // 处理单选
  const handleSelect = (selectedKeys: any) => {
    if (disabled || multiple) return;
    
    const newSelectedKeys = selectedKeys.map((key: any) => String(key));
    setSelectedKeys(newSelectedKeys);
    
    const selectedTags = allTags.filter(tag => newSelectedKeys.includes(tag.id));
    onChange?.(newSelectedKeys, selectedTags);
  };

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchValue(value);
    if (value) {
      // 搜索时展开所有匹配的节点
      const matchedKeys: string[] = [];
      allTags.forEach(tag => {
        if (tag.name.toLowerCase().includes(value.toLowerCase())) {
          matchedKeys.push(tag.id);
          if (tag.parent_id) {
            matchedKeys.push(tag.parent_id);
          }
        }
      });
      setExpandedKeys(Array.from(new Set(matchedKeys)));
    }
  };

  // 过滤树数据
  const filterTreeData = (data: any[], searchValue: string): any[] => {
    if (!searchValue) return data;
    
    return data.reduce<any[]>((acc, node) => {
      const tagData = node.tagData;
      const isMatch = tagData?.name.toLowerCase().includes(searchValue.toLowerCase());
      
      if (node.children) {
        const filteredChildren = filterTreeData(node.children, searchValue);
        if (isMatch || filteredChildren.length > 0) {
          acc.push({
            ...node,
            children: filteredChildren.length > 0 ? filteredChildren : undefined
          });
        }
      } else if (isMatch) {
        acc.push(node);
      }
      
      return acc;
    }, []);
  };

  const filteredTreeData = filterTreeData(treeData, searchValue);

  // 渲染选中的标签
  const renderSelectedTags = () => {
    if (selectedKeys.length === 0) return null;
    
    const selectedTags = allTags.filter(tag => selectedKeys.includes(tag.id));
    
    return (
      <div style={{ marginTop: 8, marginBottom: 8 }}>
        <Space wrap>
          {selectedTags.map(tag => (
            <Tag
              key={tag.id}
              closable={!disabled}
              color={tag.color}
              onClose={() => {
                const newKeys = selectedKeys.filter(key => key !== tag.id);
                setSelectedKeys(newKeys);
                const selectedTags = allTags.filter(tag => newKeys.includes(tag.id));
                onChange?.(newKeys, selectedTags);
              }}
            >
              {tag.name}
            </Tag>
          ))}
        </Space>
      </div>
    );
  };

  return (
    <div style={style}>
      {showSearch && (
        <Search
          placeholder="搜索标签"
          prefix={<SearchOutlined />}
          value={searchValue}
          onChange={(e) => handleSearch(e.target.value)}
          style={{ marginBottom: 8 }}
          disabled={disabled}
        />
      )}
      
      {renderSelectedTags()}
      
      <Spin spinning={loading}>
        <Tree
          checkable={multiple}
          checkedKeys={selectedKeys}
          selectedKeys={multiple ? [] : selectedKeys}
          expandedKeys={expandedKeys}
          onExpand={(keys) => setExpandedKeys(keys.map(key => String(key)))}
          onCheck={multiple ? handleCheck : undefined}
          onSelect={!multiple ? handleSelect : undefined}
          treeData={filteredTreeData}
          height={300}
          disabled={disabled}
          showLine={{ showLeafIcon: false }}
          style={{
            border: '1px solid #d9d9d9',
            borderRadius: '6px',
            padding: '8px',
            backgroundColor: disabled ? '#f5f5f5' : '#fff'
          }}
        />
      </Spin>
      
      {multiple && maxTagCount && (
        <div style={{ 
          marginTop: 4, 
          fontSize: '12px', 
          color: '#999',
          textAlign: 'right'
        }}>
          已选择 {selectedKeys.length}/{maxTagCount}
        </div>
      )}
    </div>
  );
};

export default TagTreeSelector; 