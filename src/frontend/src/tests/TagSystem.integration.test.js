// 多级标签系统集成测试
describe('多级标签系统集成测试', () => {
  
  // 测试数据
  const mockTagTree = [
    {
      id: '1',
      name: '客户分类',
      color: '#1890ff',
      description: '客户分类标签',
      contact_count: 5,
      children: [
        {
          id: '2',
          name: 'VIP客户',
          color: '#52c41a',
          parent_id: '1',
          contact_count: 3,
          children: []
        },
        {
          id: '3',
          name: '普通客户',
          color: '#faad14',
          parent_id: '1',
          contact_count: 2,
          children: []
        }
      ]
    }
  ];

  describe('标签树结构测试', () => {
    test('应该正确构建标签树', () => {
      expect(mockTagTree).toHaveLength(1);
      expect(mockTagTree[0].children).toHaveLength(2);
      expect(mockTagTree[0].children[0].parent_id).toBe('1');
    });

    test('应该正确计算联系人数量', () => {
      const parentTag = mockTagTree[0];
      const childrenCount = parentTag.children.reduce((sum, child) => sum + child.contact_count, 0);
      expect(parentTag.contact_count).toBe(childrenCount);
    });
  });

  describe('自动继承逻辑测试', () => {
    test('选择子标签应该自动选择父标签', () => {
      const selectedTags = ['2']; // VIP客户
      const expectedTags = ['2', '1']; // VIP客户 + 客户分类
      
      // 模拟自动继承逻辑
      const result = addParentTags(selectedTags, mockTagTree);
      expect(result).toEqual(expect.arrayContaining(expectedTags));
    });

    test('取消子标签应该智能处理父标签', () => {
      const currentTags = ['1', '2', '3']; // 父标签 + 两个子标签
      const removedTag = '2'; // 移除VIP客户
      
      // 模拟智能删除逻辑
      const result = removeTagIntelligently(currentTags, removedTag, mockTagTree);
      expect(result).toEqual(['1', '3']); // 保留父标签和另一个子标签
    });
  });

  describe('A/B测试分组测试', () => {
    test('应该正确分配联系人到不同组', () => {
      const contacts = [
        { id: '1', email: 'test1@example.com' },
        { id: '2', email: 'test2@example.com' },
        { id: '3', email: 'test3@example.com' },
        { id: '4', email: 'test4@example.com' },
        { id: '5', email: 'test5@example.com' }
      ];
      
      const splitRatio = [0.6, 0.4]; // 60% vs 40%
      const result = splitContacts(contacts, splitRatio);
      
      expect(result.groups).toHaveLength(2);
      expect(result.groups[0].contacts).toHaveLength(3); // 60% of 5 = 3
      expect(result.groups[1].contacts).toHaveLength(2); // 40% of 5 = 2
    });

    test('应该处理不均匀分配', () => {
      const contacts = Array.from({ length: 7 }, (_, i) => ({ 
        id: `${i + 1}`, 
        email: `test${i + 1}@example.com` 
      }));
      
      const splitRatio = [0.33, 0.33, 0.34]; // 三组分配
      const result = splitContacts(contacts, splitRatio);
      
      expect(result.groups).toHaveLength(3);
      expect(result.groups[0].contacts).toHaveLength(2); // 33% of 7 ≈ 2
      expect(result.groups[1].contacts).toHaveLength(2); // 33% of 7 ≈ 2
      expect(result.groups[2].contacts).toHaveLength(3); // 34% of 7 ≈ 3
    });
  });

  describe('性能测试', () => {
    test('大量标签处理性能', () => {
      const largeTagTree = generateLargeTagTree(100, 10); // 100个父标签，每个10个子标签
      
      const startTime = performance.now();
      const flatTags = flattenTags(largeTagTree);
      const endTime = performance.now();
      
      expect(flatTags).toHaveLength(1100); // 100 + 100*10
      expect(endTime - startTime).toBeLessThan(100); // 应该在100ms内完成
    });

    test('搜索性能测试', () => {
      const largeTagTree = generateLargeTagTree(50, 20);
      const searchTerm = 'VIP';
      
      const startTime = performance.now();
      const results = searchTags(largeTagTree, searchTerm);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(50); // 搜索应该很快
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('数据一致性测试', () => {
    test('标签-联系人关联一致性', () => {
      const tagContactMap = {
        '1': ['contact1', 'contact2', 'contact3', 'contact4', 'contact5'],
        '2': ['contact1', 'contact2', 'contact3'],
        '3': ['contact4', 'contact5']
      };
      
      // 验证父标签包含所有子标签的联系人
      const parentContacts = tagContactMap['1'];
      const childContacts = [...tagContactMap['2'], ...tagContactMap['3']];
      
      expect(parentContacts).toEqual(expect.arrayContaining(childContacts));
    });

    test('删除标签时的数据清理', () => {
      const initialTags = ['1', '2', '3'];
      const deletedTag = '2';
      
      // 模拟删除标签后的清理
      const result = cleanupAfterTagDeletion(initialTags, deletedTag, mockTagTree);
      
      expect(result.remainingTags).not.toContain(deletedTag);
      expect(result.affectedContacts).toHaveLength(3); // VIP客户的3个联系人
    });
  });
});

// 辅助函数
function addParentTags(selectedTags, tagTree) {
  const result = [...selectedTags];
  const flatTags = flattenTags(tagTree);
  
  selectedTags.forEach(tagId => {
    const tag = flatTags.find(t => t.id === tagId);
    if (tag && tag.parent_id && !result.includes(tag.parent_id)) {
      result.push(tag.parent_id);
    }
  });
  
  return result;
}

function removeTagIntelligently(currentTags, removedTag, tagTree) {
  const result = currentTags.filter(id => id !== removedTag);
  const flatTags = flattenTags(tagTree);
  const removedTagData = flatTags.find(t => t.id === removedTag);
  
  if (removedTagData && removedTagData.parent_id) {
    // 检查是否还有其他子标签
    const siblings = flatTags.filter(t => t.parent_id === removedTagData.parent_id);
    const hasOtherSelectedSiblings = siblings.some(s => 
      s.id !== removedTag && result.includes(s.id)
    );
    
    if (!hasOtherSelectedSiblings) {
      return result.filter(id => id !== removedTagData.parent_id);
    }
  }
  
  return result;
}

function splitContacts(contacts, splitRatio) {
  const shuffled = [...contacts].sort(() => Math.random() - 0.5);
  const groups = [];
  let startIndex = 0;
  
  splitRatio.forEach((ratio, index) => {
    const groupSize = index === splitRatio.length - 1 
      ? contacts.length - startIndex // 最后一组取剩余的
      : Math.round(contacts.length * ratio);
    
    groups.push({
      contacts: shuffled.slice(startIndex, startIndex + groupSize),
      ratio: ratio
    });
    
    startIndex += groupSize;
  });
  
  return { groups };
}

function flattenTags(tagTree) {
  const result = [];
  
  function traverse(tags) {
    tags.forEach(tag => {
      result.push(tag);
      if (tag.children && tag.children.length > 0) {
        traverse(tag.children);
      }
    });
  }
  
  traverse(tagTree);
  return result;
}

function generateLargeTagTree(parentCount, childrenPerParent) {
  return Array.from({ length: parentCount }, (_, i) => ({
    id: `parent-${i}`,
    name: `父标签${i}`,
    color: '#1890ff',
    contact_count: Math.floor(Math.random() * 100),
    children: Array.from({ length: childrenPerParent }, (_, j) => ({
      id: `child-${i}-${j}`,
      name: `子标签${i}-${j}`,
      color: '#52c41a',
      parent_id: `parent-${i}`,
      contact_count: Math.floor(Math.random() * 50),
      children: []
    }))
  }));
}

function searchTags(tagTree, searchTerm) {
  const results = [];
  const flatTags = flattenTags(tagTree);
  
  flatTags.forEach(tag => {
    if (tag.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      results.push(tag);
    }
  });
  
  return results;
}

function cleanupAfterTagDeletion(tags, deletedTag, tagTree) {
  const flatTags = flattenTags(tagTree);
  const deletedTagData = flatTags.find(t => t.id === deletedTag);
  
  return {
    remainingTags: tags.filter(id => id !== deletedTag),
    affectedContacts: deletedTagData ? 
      Array.from({ length: deletedTagData.contact_count }, (_, i) => `contact${i + 1}`) : 
      []
  };
} 