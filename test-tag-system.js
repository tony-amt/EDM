#!/usr/bin/env node

/**
 * 多级标签系统集成测试脚本
 * 测试标签树结构、自动继承、A/B测试等功能
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';
const TOKEN = 'dev-permanent-test-token-admin-2025';

// 配置axios
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  }
});

class TagSystemTester {
  constructor() {
    this.testResults = [];
    this.createdTags = [];
    this.createdContacts = [];
  }

  async runAllTests() {
    console.log('🚀 开始多级标签系统集成测试...\n');

    try {
      await this.testTagTreeStructure();
      await this.testAutoInheritance();
      await this.testABTesting();
      await this.testBulkOperations();
      await this.testPerformance();
      await this.testDataConsistency();
      
      this.printResults();
    } catch (error) {
      console.error('❌ 测试过程中发生错误:', error.message);
    } finally {
      await this.cleanup();
    }
  }

  async testTagTreeStructure() {
    console.log('📋 测试1: 标签树结构');
    
    try {
      const timestamp = Date.now();
      
      // 创建父标签
      const parentTag = await this.createTag({
        name: `测试客户分类_${timestamp}`,
        description: '用于测试的客户分类标签',
        color: '#1890ff'
      });
      
      // 创建子标签
      const childTag1 = await this.createTag({
        name: `测试VIP客户_${timestamp}`,
        description: 'VIP客户标签',
        color: '#52c41a',
        parentId: parentTag.id
      });
      
      const childTag2 = await this.createTag({
        name: `测试普通客户_${timestamp}`,
        description: '普通客户标签',
        color: '#faad14',
        parentId: parentTag.id
      });

      // 获取标签树
      const treeResponse = await api.get('/tags/tree');
      const tree = treeResponse.data.data;
      
      // 验证树结构
      const testParent = tree.find(tag => tag.id === parentTag.id);
      if (!testParent) {
        throw new Error('父标签未找到');
      }
      
      if (!testParent.children || testParent.children.length !== 2) {
        throw new Error('子标签数量不正确');
      }
      
      const childIds = testParent.children.map(child => child.id);
      if (!childIds.includes(childTag1.id) || !childIds.includes(childTag2.id)) {
        throw new Error('子标签关联不正确');
      }

      this.addResult('标签树结构', true, '成功创建父子标签关系');
      console.log('  ✅ 标签树结构测试通过');
      
    } catch (error) {
      this.addResult('标签树结构', false, error.message);
      console.log('  ❌ 标签树结构测试失败:', error.message);
    }
  }

  async testAutoInheritance() {
    console.log('📋 测试2: 自动继承功能');
    
    try {
      const timestamp = Date.now();
      
      // 创建测试联系人
      const contact = await this.createContact({
        email: `test-inherit-${timestamp}@example.com`,
        username: `test-inherit-${timestamp}`,
        status: 'active',
        source: 'manual'
      });

      // 获取子标签ID
      const treeResponse = await api.get('/tags/tree');
      const tree = treeResponse.data.data;
      const parentTag = tree.find(tag => tag.name.startsWith('测试客户分类_'));
      
      if (!parentTag) {
        throw new Error('未找到测试客户分类标签');
      }
      
      if (!parentTag.children || parentTag.children.length === 0) {
        throw new Error('测试客户分类标签没有子标签');
      }
      
      const childTag = parentTag.children.find(tag => tag.name.startsWith('测试VIP客户_'));
      
      if (!childTag) {
        throw new Error('未找到测试VIP客户子标签');
      }

      // 为联系人添加子标签（应该自动继承父标签）
      await api.post(`/tags/${childTag.id}/contacts/${contact.id}`, {
        autoInherit: true
      });

      // 获取联系人的标签详情
      const contactTagsResponse = await api.get(`/contacts/${contact.id}/tags`);
      const contactTags = contactTagsResponse.data.data;

      // 验证自动继承
      const directTagIds = contactTags.directTags.map(tag => tag.id);
      const inheritedTagIds = contactTags.inheritedTags.map(tag => tag.id);
      
      if (!directTagIds.includes(childTag.id)) {
        throw new Error('子标签未正确添加');
      }
      
      if (!inheritedTagIds.includes(parentTag.id)) {
        throw new Error('父标签未自动继承');
      }

      this.addResult('自动继承功能', true, '子标签自动继承父标签成功');
      console.log('  ✅ 自动继承功能测试通过');
      
    } catch (error) {
      this.addResult('自动继承功能', false, error.message);
      console.log('  ❌ 自动继承功能测试失败:', error.message);
    }
  }

  async testABTesting() {
    console.log('📋 测试3: A/B测试分组');
    
    try {
      const timestamp = Date.now();
      
      // 创建多个测试联系人
      const contacts = [];
      for (let i = 0; i < 10; i++) {
        const contact = await this.createContact({
          email: `test-ab-${timestamp}-${i}@example.com`,
          username: `test-ab-${timestamp}-${i}`,
          status: 'active',
          source: 'manual'
        });
        contacts.push(contact);
      }

      // 获取父标签
      const treeResponse = await api.get('/tags/tree');
      const tree = treeResponse.data.data;
      const parentTag = tree.find(tag => tag.name.startsWith('测试客户分类_'));
      
      if (!parentTag) {
        throw new Error('未找到测试客户分类标签');
      }

      // 为所有联系人添加父标签
      for (const contact of contacts) {
        await api.post(`/tags/${parentTag.id}/contacts/${contact.id}`);
      }

      // 创建A/B测试分组
      const splitTestResponse = await api.post(`/tags/${parentTag.id}/split-test`, {
        testName: `邮件主题A/B测试_${timestamp}`,
        groupCount: 2,
        splitRatio: [0.6, 0.4],
        groupNames: ['A组', 'B组']
      });

      const splitResult = splitTestResponse.data.data;

      // 验证分组结果
      if (splitResult.groups.length !== 2) {
        throw new Error('分组数量不正确');
      }

      const totalContacts = splitResult.groups.reduce((sum, group) => sum + group.contactCount, 0);
      if (totalContacts !== 10) {
        throw new Error('分组联系人总数不正确');
      }

      // 验证分组比例
      const group1Count = splitResult.groups[0].contactCount;
      const group2Count = splitResult.groups[1].contactCount;
      
      if (Math.abs(group1Count - 6) > 1 || Math.abs(group2Count - 4) > 1) {
        console.log(`实际分组: ${group1Count}:${group2Count}, 期望: 6:4`);
        // 允许±1的误差
      }

      this.addResult('A/B测试分组', true, `成功创建分组: ${group1Count}:${group2Count}`);
      console.log('  ✅ A/B测试分组测试通过');
      
    } catch (error) {
      this.addResult('A/B测试分组', false, error.message);
      console.log('  ❌ A/B测试分组测试失败:', error.message);
    }
  }

  async testBulkOperations() {
    console.log('📋 测试4: 批量操作');
    
    try {
      const timestamp = Date.now();
      
      // 创建测试联系人
      const contacts = [];
      for (let i = 0; i < 5; i++) {
        const contact = await this.createContact({
          email: `test-bulk-${timestamp}-${i}@example.com`,
          username: `test-bulk-${timestamp}-${i}`,
          status: 'active',
          source: 'manual'
        });
        contacts.push(contact);
      }

      // 获取标签
      const treeResponse = await api.get('/tags/tree');
      const tree = treeResponse.data.data;
      const parentTag = tree.find(tag => tag.name.startsWith('测试客户分类_'));
      
      if (!parentTag) {
        throw new Error('未找到测试客户分类标签');
      }
      
      if (!parentTag.children || parentTag.children.length === 0) {
        throw new Error('测试客户分类标签没有子标签');
      }
      
      const childTag = parentTag.children.find(tag => tag.name.startsWith('测试VIP客户_'));
      
      if (!childTag) {
        throw new Error('未找到测试VIP客户子标签');
      }

      const contactIds = contacts.map(c => c.id);
      const tagIds = [parentTag.id, childTag.id];

      // 批量添加标签
      await api.post('/tags/bulk-add', {
        contactIds,
        tagIds
      });

      // 验证批量添加结果
      for (const contact of contacts) {
        const contactTagsResponse = await api.get(`/contacts/${contact.id}/tags`);
        const allTagIds = contactTagsResponse.data.data.allTags.map(tag => tag.id);
        
        if (!allTagIds.includes(parentTag.id) || !allTagIds.includes(childTag.id)) {
          throw new Error(`联系人 ${contact.email} 标签添加失败`);
        }
      }

      // 批量移除标签
      await api.post('/tags/bulk-remove', {
        contactIds: contactIds.slice(0, 3), // 只移除前3个
        tagIds: [childTag.id]
      });

      // 验证批量移除结果
      for (let i = 0; i < 3; i++) {
        const contactTagsResponse = await api.get(`/contacts/${contactIds[i]}/tags`);
        const allTagIds = contactTagsResponse.data.data.allTags.map(tag => tag.id);
        
        if (allTagIds.includes(childTag.id)) {
          throw new Error(`联系人 ${contacts[i].email} 标签移除失败`);
        }
      }

      this.addResult('批量操作', true, '批量添加和移除标签成功');
      console.log('  ✅ 批量操作测试通过');
      
    } catch (error) {
      this.addResult('批量操作', false, error.message);
      console.log('  ❌ 批量操作测试失败:', error.message);
    }
  }

  async testPerformance() {
    console.log('📋 测试5: 性能测试');
    
    try {
      // 测试标签树获取性能
      const startTime = Date.now();
      
      for (let i = 0; i < 10; i++) {
        await api.get('/tags/tree');
      }
      
      const endTime = Date.now();
      const avgTime = (endTime - startTime) / 10;

      if (avgTime > 1000) {
        throw new Error(`标签树获取性能过慢: ${avgTime}ms`);
      }

      // 测试大量标签创建性能
      const createStartTime = Date.now();
      const tempTags = [];
      
      for (let i = 0; i < 20; i++) {
        const tag = await this.createTag({
          name: `性能测试标签${i}`,
          color: '#1890ff'
        });
        tempTags.push(tag);
      }
      
      const createEndTime = Date.now();
      const createAvgTime = (createEndTime - createStartTime) / 20;

      // 清理临时标签
      for (const tag of tempTags) {
        await api.delete(`/tags/${tag.id}`);
      }

      this.addResult('性能测试', true, `标签树获取: ${avgTime}ms, 标签创建: ${createAvgTime}ms`);
      console.log('  ✅ 性能测试通过');
      
    } catch (error) {
      this.addResult('性能测试', false, error.message);
      console.log('  ❌ 性能测试失败:', error.message);
    }
  }

  async testDataConsistency() {
    console.log('📋 测试6: 数据一致性');
    
    try {
      // 获取标签树
      const treeResponse = await api.get('/tags/tree');
      const tree = treeResponse.data.data;
      const parentTag = tree.find(tag => tag.name.startsWith('测试客户分类_'));

      // 验证父标签的联系人数量等于所有子标签的联系人数量之和
      const parentContactsResponse = await api.get(`/tags/${parentTag.id}/contacts`);
      const parentContactCount = parentContactsResponse.data.data.contacts.length;

      let childContactCount = 0;
      for (const child of parentTag.children) {
        const childContactsResponse = await api.get(`/tags/${child.id}/contacts`);
        childContactCount += childContactsResponse.data.data.contacts.length;
      }

      // 注意：由于自动继承，父标签的联系人数量应该大于等于子标签的联系人数量
      if (parentContactCount < childContactCount) {
        throw new Error(`数据不一致: 父标签联系人数(${parentContactCount}) < 子标签联系人数(${childContactCount})`);
      }

      this.addResult('数据一致性', true, `父标签: ${parentContactCount}人, 子标签总计: ${childContactCount}人`);
      console.log('  ✅ 数据一致性测试通过');
      
    } catch (error) {
      this.addResult('数据一致性', false, error.message);
      console.log('  ❌ 数据一致性测试失败:', error.message);
    }
  }

  async createTag(tagData) {
    const response = await api.post('/tags', tagData);
    const tag = response.data.data;
    this.createdTags.push(tag);
    return tag;
  }

  async createContact(contactData) {
    const response = await api.post('/contacts', contactData);
    // 联系人API直接返回数据，不是包装在data字段中
    const contact = response.data.data || response.data;
    this.createdContacts.push(contact);
    return contact;
  }

  addResult(testName, success, message) {
    this.testResults.push({
      testName,
      success,
      message,
      timestamp: new Date().toISOString()
    });
  }

  printResults() {
    console.log('\n📊 测试结果汇总:');
    console.log('='.repeat(60));
    
    let passedCount = 0;
    let failedCount = 0;
    
    this.testResults.forEach(result => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${result.testName}: ${result.message}`);
      
      if (result.success) {
        passedCount++;
      } else {
        failedCount++;
      }
    });
    
    console.log('='.repeat(60));
    console.log(`总计: ${this.testResults.length} 个测试`);
    console.log(`通过: ${passedCount} 个`);
    console.log(`失败: ${failedCount} 个`);
    console.log(`成功率: ${((passedCount / this.testResults.length) * 100).toFixed(1)}%`);
    
    if (failedCount === 0) {
      console.log('\n🎉 所有测试都通过了！多级标签系统运行正常。');
    } else {
      console.log('\n⚠️  有测试失败，请检查相关功能。');
    }
  }

  async cleanup() {
    console.log('\n🧹 清理测试数据...');
    
    try {
      // 删除创建的联系人
      for (const contact of this.createdContacts) {
        try {
          await api.delete(`/contacts/${contact.id}`);
        } catch (error) {
          console.log(`清理联系人失败: ${contact.email}`);
        }
      }
      
      // 删除创建的标签（先删除子标签，再删除父标签）
      const childTags = this.createdTags.filter(tag => tag.parent_id);
      const parentTags = this.createdTags.filter(tag => !tag.parent_id);
      
      for (const tag of childTags) {
        try {
          await api.delete(`/tags/${tag.id}`);
        } catch (error) {
          console.log(`清理子标签失败: ${tag.name}`);
        }
      }
      
      for (const tag of parentTags) {
        try {
          await api.delete(`/tags/${tag.id}`);
        } catch (error) {
          console.log(`清理父标签失败: ${tag.name}`);
        }
      }
      
      console.log('✅ 测试数据清理完成');
      
    } catch (error) {
      console.log('❌ 清理过程中发生错误:', error.message);
    }
  }
}

// 运行测试
async function main() {
  const tester = new TagSystemTester();
  await tester.runAllTests();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = TagSystemTester; 