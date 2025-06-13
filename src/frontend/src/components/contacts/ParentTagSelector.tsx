import React, { useState, useEffect } from 'react';
import { Select, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import tagService, { TagTreeNode } from '../../services/tag.service';

interface ParentTagSelectorProps {
  value?: string[];
  onChange?: (value: string[]) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  maxTagCount?: number;
}

const ParentTagSelector: React.FC<ParentTagSelectorProps> = ({
  value = [],
  onChange,
  placeholder = "请选择或输入标签名称",
  style,
  disabled = false,
  maxTagCount = 10
}) => {
  const [parentTags, setParentTags] = useState<TagTreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    fetchParentTags();
  }, []);

  // 获取一级标签列表
  const fetchParentTags = async () => {
    setLoading(true);
    try {
      const response = await tagService.getTagTree();
      const tagTree = response.data;
      
      // 只获取一级标签（父标签），按创建时间倒序排序
      const parentTags = tagTree
        .filter(tag => !tag.parentId && !(tag as any).parent_id)
        .sort((a, b) => {
          const timeA = new Date(a.createdAt || 0).getTime();
          const timeB = new Date(b.createdAt || 0).getTime();
          return timeB - timeA; // 倒序排序
        });
      
      console.log('🔧 [DEBUG] 获取到的父标签数据:', parentTags);
      setParentTags(parentTags);
    } catch (error) {
      console.error('获取标签失败:', error);
      message.error('获取标签失败');
    } finally {
      setLoading(false);
    }
  };

  // 创建新标签
  const createNewTag = async (tagName: string) => {
    try {
      setLoading(true);
      const newTag = await tagService.createTag({
        name: tagName,
        color: '#1677ff',
        description: `自动创建的标签: ${tagName}`
      });
      
      message.success(`标签"${tagName}"创建成功`);
      
      // 刷新标签列表
      await fetchParentTags();
      
      // 自动选中新创建的标签
      const newValue = [...(value || []), newTag.data.id];
      onChange?.(newValue);
      
      return newTag.data;
    } catch (error: any) {
      console.error('创建标签失败:', error);
      message.error('创建标签失败: ' + (error.response?.data?.message || error.message));
      return null;
    } finally {
      setLoading(false);
    }
  };

  // 处理搜索
  const handleSearch = (searchText: string) => {
    setSearchValue(searchText);
  };

  // 处理选择变化
  const handleChange = (selectedValues: string[]) => {
    onChange?.(selectedValues);
  };

  // 处理键盘事件（回车创建新标签）
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchValue.trim()) {
      e.preventDefault();
      
      // 检查是否已存在同名标签
      const existingTag = parentTags.find(tag => 
        tag.name.toLowerCase() === searchValue.trim().toLowerCase()
      );
      
      if (existingTag) {
        // 如果标签已存在，直接选中
        const newValue = [...(value || [])];
        if (!newValue.includes(existingTag.id)) {
          newValue.push(existingTag.id);
          onChange?.(newValue);
        }
        setSearchValue('');
      } else {
        // 创建新标签
        createNewTag(searchValue.trim());
        setSearchValue('');
      }
    }
  };

  // 过滤选项
  const filteredOptions = parentTags.filter(tag =>
    tag.name.toLowerCase().includes(searchValue.toLowerCase())
  );

  // 生成选项
  const options = filteredOptions.map(tag => ({
    label: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: tag.color || '#1677ff',
            display: 'inline-block'
          }}
        />
        <span>{tag.name}</span>
        {(tag.contact_count !== undefined || (tag as any).contactCount !== undefined) && (
          <span style={{ color: '#999', fontSize: '12px' }}>
            ({(tag.contact_count || (tag as any).contactCount || 0)}人)
          </span>
        )}
      </div>
    ),
    value: tag.id,
    key: tag.id
  }));

  // 如果搜索值不为空且没有匹配的标签，显示创建选项
  if (searchValue.trim() && !filteredOptions.some(tag => 
    tag.name.toLowerCase() === searchValue.toLowerCase()
  )) {
    options.push({
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1677ff' }}>
          <PlusOutlined />
          <span>创建标签 "{searchValue}"</span>
        </div>
      ),
      value: `__create__${searchValue}`,
      key: `__create__${searchValue}`
    });
  }

  return (
    <Select
      mode="multiple"
      value={value}
      onChange={handleChange}
      onSearch={handleSearch}
      onInputKeyDown={handleKeyDown}
      placeholder={placeholder}
      style={style}
      disabled={disabled}
      loading={loading}
      showSearch
      filterOption={false}
      searchValue={searchValue}
      maxTagCount={maxTagCount}
      options={options}
      dropdownRender={(menu) => (
        <div>
          {menu}
          {searchValue.trim() && !filteredOptions.some(tag => 
            tag.name.toLowerCase() === searchValue.toLowerCase()
          ) && (
            <div style={{ 
              padding: '8px 12px', 
              borderTop: '1px solid #f0f0f0',
              color: '#999',
              fontSize: '12px'
            }}>
              按回车键创建新标签 "{searchValue}"
            </div>
          )}
        </div>
      )}
      onSelect={(selectedValue) => {
        if (typeof selectedValue === 'string' && selectedValue.startsWith('__create__')) {
          const tagName = selectedValue.replace('__create__', '');
          createNewTag(tagName);
          setSearchValue('');
        }
      }}
    />
  );
};

export default ParentTagSelector; 