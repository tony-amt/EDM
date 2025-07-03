#!/usr/bin/env node

/**
 * Phase 3 测试数据创建脚本
 * 创建联系人和标签数据来验证反向查询功能
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:8082';
const TEST_TOKEN = 'dev-permanent-test-token-admin-2025';

const config = {
  headers: {
    'Authorization': `Bearer ${TEST_TOKEN}`,
    'Content-Type': 'application/json'
  }
};

console.log('🚀 Phase 3 测试数据创建工具');
console.log('='.repeat(50));

async function createTestData() {
  try {
    // 1. 创建测试标签
    console.log('\n📋 创建测试标签...');
    const tags = [
      { name: 'VIP客户', description: 'VIP等级客户' },
      { name: '潜在客户', description: '有潜在购买意向的客户' },
      { name: '已成交', description: '已经成交的客户' },
      { name: '海外客户', description: '来自海外的客户' }
    ];

    const createdTags = [];
    for (const tag of tags) {
      try {
        const response = await axios.post(`${BASE_URL}/api/tags`, tag, config);
        if (response.data.success) {
          createdTags.push(response.data.data);
          console.log(`✅ 标签创建成功: ${tag.name} (ID: ${response.data.data.id})`);
        }
      } catch (error) {
        if (error.response?.status === 409) {
          console.log(`⚠️ 标签已存在: ${tag.name}`);
          // 获取现有标签
          const listResponse = await axios.get(`${BASE_URL}/api/tags`, config);
          if (listResponse.data.success) {
            const existingTag = listResponse.data.data.find(t => t.name === tag.name);
            if (existingTag) {
              createdTags.push(existingTag);
            }
          }
        } else {
          console.error(`❌ 标签创建失败: ${tag.name}`, error.response?.data?.message || error.message);
        }
      }
    }

    // 2. 创建测试联系人
    console.log('\n👥 创建测试联系人...');
    const contacts = [
      {
        email: 'john.doe@example.com',
        name: 'John Doe',
        company: 'Tech Corp',
        phone: '+1-555-0123'
      },
      {
        email: 'jane.smith@company.com',
        name: 'Jane Smith',
        company: 'Global Inc',
        phone: '+1-555-0456'
      },
      {
        email: 'bob.wilson@startup.io',
        name: 'Bob Wilson',
        company: 'Startup Ltd',
        phone: '+1-555-0789'
      },
      {
        email: 'alice.johnson@enterprise.com',
        name: 'Alice Johnson',
        company: 'Enterprise Solutions',
        phone: '+1-555-0321'
      }
    ];

    const createdContacts = [];
    for (const contact of contacts) {
      try {
        const response = await axios.post(`${BASE_URL}/api/contacts`, contact, config);
        if (response.data.success) {
          createdContacts.push(response.data.data);
          console.log(`✅ 联系人创建成功: ${contact.name} (ID: ${response.data.data.id})`);
        }
      } catch (error) {
        if (error.response?.status === 409) {
          console.log(`⚠️ 联系人已存在: ${contact.email}`);
        } else {
          console.error(`❌ 联系人创建失败: ${contact.name}`, error.response?.data?.message || error.message);
        }
      }
    }

    // 3. 为联系人分配标签
    if (createdTags.length > 0 && createdContacts.length > 0) {
      console.log('\n🏷️ 为联系人分配标签...');

      // 为不同联系人分配不同标签组合
      const tagAssignments = [
        { contactIndex: 0, tagIndexes: [0, 1] }, // John: VIP客户, 潜在客户
        { contactIndex: 1, tagIndexes: [0, 2] }, // Jane: VIP客户, 已成交
        { contactIndex: 2, tagIndexes: [1, 3] }, // Bob: 潜在客户, 海外客户
        { contactIndex: 3, tagIndexes: [2, 3] }  // Alice: 已成交, 海外客户
      ];

      for (const assignment of tagAssignments) {
        const contact = createdContacts[assignment.contactIndex];
        if (!contact) continue;

        for (const tagIndex of assignment.tagIndexes) {
          const tag = createdTags[tagIndex];
          if (!tag) continue;

          try {
            const response = await axios.post(
              `${BASE_URL}/api/contacts/${contact.id}/tags/${tag.id}`,
              {},
              config
            );
            if (response.data.success) {
              console.log(`✅ 标签分配成功: ${contact.name} -> ${tag.name}`);
            }
          } catch (error) {
            console.error(`❌ 标签分配失败: ${contact.name} -> ${tag.name}`, error.response?.data?.message || error.message);
          }
        }
      }
    }

    console.log('\n🎉 测试数据创建完成！');
    console.log(`📊 统计: ${createdTags.length} 个标签, ${createdContacts.length} 个联系人`);

  } catch (error) {
    console.error('❌ 测试数据创建失败:', error.message);
    process.exit(1);
  }
}

createTestData(); 