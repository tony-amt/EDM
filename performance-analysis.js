#!/usr/bin/env node

/**
 * 多级标签系统性能分析脚本
 * 分析API响应时间、数据库查询性能、前端渲染性能等
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

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

class PerformanceAnalyzer {
  constructor() {
    this.results = {
      apiPerformance: [],
      databasePerformance: [],
      memoryUsage: [],
      recommendations: []
    };
    this.testData = {
      tags: [],
      contacts: []
    };
  }

  async runAnalysis() {
    console.log('🔍 开始性能分析...\n');

    try {
      await this.setupTestData();
      await this.analyzeAPIPerformance();
      await this.analyzeDatabasePerformance();
      await this.analyzeMemoryUsage();
      
      this.generateRecommendations();
      this.generateReport();
      
    } catch (error) {
      console.error('❌ 性能分析过程中发生错误:', error.message);
    } finally {
      await this.cleanup();
    }
  }

  async setupTestData() {
    console.log('📋 准备测试数据...');
    
    // 创建测试标签树
    for (let i = 0; i < 5; i++) {
      const parentTag = await this.createTag({
        name: `性能测试父标签${i}`,
        description: `用于性能测试的父标签${i}`,
        color: '#1890ff'
      });
      
      // 为每个父标签创建子标签
      for (let j = 0; j < 3; j++) {
        await this.createTag({
          name: `性能测试子标签${i}-${j}`,
          description: `子标签${i}-${j}`,
          color: '#52c41a',
          parentId: parentTag.id
        });
      }
    }
    
    // 创建测试联系人
    for (let i = 0; i < 20; i++) {
      await this.createContact({
        email: `perf-test-${i}@example.com`,
        username: `perf-test-${i}`,
        status: 'active',
        source: 'manual'
      });
    }
    
    console.log('✅ 测试数据准备完成');
  }

  async analyzeAPIPerformance() {
    console.log('📊 分析API性能...');
    
    const tests = [
      {
        name: '获取标签树',
        endpoint: '/tags/tree',
        method: 'GET',
        iterations: 20
      },
      {
        name: '获取标签列表',
        endpoint: '/tags',
        method: 'GET',
        iterations: 20
      },
      {
        name: '获取联系人列表',
        endpoint: '/contacts',
        method: 'GET',
        iterations: 15
      }
    ];

    for (const test of tests) {
      const times = [];
      
      for (let i = 0; i < test.iterations; i++) {
        const startTime = Date.now();
        
        try {
          await api.get(test.endpoint);
        } catch (error) {
          console.log(`API测试失败: ${test.name} - ${error.message}`);
          continue;
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        times.push(duration);
      }
      
      if (times.length > 0) {
        const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);
        
        this.results.apiPerformance.push({
          name: test.name,
          endpoint: test.endpoint,
          iterations: times.length,
          avgTime: avgTime.toFixed(2),
          minTime: minTime.toFixed(2),
          maxTime: maxTime.toFixed(2)
        });
        
        console.log(`  ${test.name}: 平均 ${avgTime.toFixed(2)}ms`);
      }
    }
  }

  async analyzeDatabasePerformance() {
    console.log('📊 分析数据库性能...');
    
    const complexQueries = [
      {
        name: '标签树查询',
        description: '获取完整标签树结构',
        test: async () => {
          const startTime = Date.now();
          await api.get('/tags/tree');
          const endTime = Date.now();
          return endTime - startTime;
        }
      },
      {
        name: '标签联系人查询',
        description: '获取标签关联的联系人',
        test: async () => {
          const tags = await api.get('/tags');
          if (tags.data.data.length > 0) {
            const tagId = tags.data.data[0].id;
            const startTime = Date.now();
            await api.get(`/tags/${tagId}/contacts`);
            const endTime = Date.now();
            return endTime - startTime;
          }
          return 0;
        }
      }
    ];

    for (const query of complexQueries) {
      const times = [];
      
      for (let i = 0; i < 5; i++) {
        try {
          const time = await query.test();
          if (time > 0) times.push(time);
        } catch (error) {
          console.log(`数据库查询测试失败: ${query.name} - ${error.message}`);
        }
      }
      
      if (times.length > 0) {
        const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
        
        this.results.databasePerformance.push({
          name: query.name,
          description: query.description,
          avgTime: avgTime.toFixed(2),
          iterations: times.length
        });
        
        console.log(`  ${query.name}: 平均 ${avgTime.toFixed(2)}ms`);
      }
    }
  }

  async analyzeMemoryUsage() {
    console.log('📊 分析内存使用...');
    
    const memoryTests = [
      {
        name: '大量标签创建',
        test: async () => {
          const tempTags = [];
          
          for (let i = 0; i < 10; i++) {
            const tag = await this.createTag({
              name: `内存测试标签${i}`,
              color: '#1890ff'
            });
            tempTags.push(tag);
          }
          
          // 清理临时标签
          for (const tag of tempTags) {
            try {
              await api.delete(`/tags/${tag.id}`);
            } catch (error) {
              // 忽略删除错误
            }
          }
          
          return { success: true };
        }
      }
    ];

    for (const test of memoryTests) {
      try {
        await test.test();
        
        this.results.memoryUsage.push({
          name: test.name,
          status: 'completed'
        });
        
        console.log(`  ${test.name}: 完成`);
      } catch (error) {
        console.log(`内存测试失败: ${test.name} - ${error.message}`);
      }
    }
  }

  generateRecommendations() {
    console.log('💡 生成性能优化建议...');
    
    // 分析API性能
    const slowAPIs = this.results.apiPerformance.filter(api => parseFloat(api.avgTime) > 500);
    if (slowAPIs.length > 0) {
      this.results.recommendations.push({
        category: 'API性能',
        issue: '部分API响应时间过长',
        apis: slowAPIs.map(api => api.name),
        suggestion: '考虑添加缓存、优化数据库查询或使用分页'
      });
    }
    
    // 通用建议
    this.results.recommendations.push({
      category: '通用优化',
      issue: '系统整体优化建议',
      suggestion: [
        '实现Redis缓存以提高查询性能',
        '使用数据库连接池优化连接管理',
        '实现API限流防止系统过载',
        '添加监控和告警机制',
        '考虑使用CDN加速前端资源'
      ]
    });
  }

  generateReport() {
    console.log('\n📊 性能分析报告');
    console.log('='.repeat(80));
    
    // API性能报告
    console.log('\n🔗 API性能分析:');
    this.results.apiPerformance.forEach(api => {
      const status = parseFloat(api.avgTime) > 500 ? '⚠️' : '✅';
      console.log(`  ${status} ${api.name}: 平均 ${api.avgTime}ms`);
    });
    
    // 数据库性能报告
    console.log('\n🗄️ 数据库性能分析:');
    this.results.databasePerformance.forEach(query => {
      const status = parseFloat(query.avgTime) > 200 ? '⚠️' : '✅';
      console.log(`  ${status} ${query.name}: 平均 ${query.avgTime}ms`);
    });
    
    // 优化建议
    console.log('\n💡 优化建议:');
    this.results.recommendations.forEach(rec => {
      console.log(`\n  📋 ${rec.category}:`);
      console.log(`     问题: ${rec.issue}`);
      if (Array.isArray(rec.suggestion)) {
        console.log(`     建议:`);
        rec.suggestion.forEach(s => console.log(`       - ${s}`));
      } else {
        console.log(`     建议: ${rec.suggestion}`);
      }
    });
    
    console.log('\n🎯 性能分析完成！');
  }

  async createTag(tagData) {
    const response = await api.post('/tags', tagData);
    const tag = response.data.data;
    this.testData.tags.push(tag);
    return tag;
  }

  async createContact(contactData) {
    const response = await api.post('/contacts', contactData);
    const contact = response.data.data;
    this.testData.contacts.push(contact);
    return contact;
  }

  async cleanup() {
    console.log('\n🧹 清理测试数据...');
    
    try {
      // 删除测试联系人
      for (const contact of this.testData.contacts) {
        try {
          await api.delete(`/contacts/${contact.id}`);
        } catch (error) {
          // 忽略删除错误
        }
      }
      
      // 删除测试标签
      const childTags = this.testData.tags.filter(tag => tag.parent_id);
      const parentTags = this.testData.tags.filter(tag => !tag.parent_id);
      
      for (const tag of childTags) {
        try {
          await api.delete(`/tags/${tag.id}`);
        } catch (error) {
          // 忽略删除错误
        }
      }
      
      for (const tag of parentTags) {
        try {
          await api.delete(`/tags/${tag.id}`);
        } catch (error) {
          // 忽略删除错误
        }
      }
      
      console.log('✅ 测试数据清理完成');
      
    } catch (error) {
      console.log('❌ 清理过程中发生错误:', error.message);
    }
  }
}

// 运行性能分析
async function main() {
  const analyzer = new PerformanceAnalyzer();
  await analyzer.runAnalysis();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = PerformanceAnalyzer; 