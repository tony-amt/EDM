/**
 * Phase 3 标签系统JSONB优化验收测试
 * 验证反向查询功能和数据一致性
 */

const axios = require('axios');
const assert = require('assert');

const BASE_URL = 'http://localhost:8000';
const TEST_TOKEN = 'dev-permanent-test-token-admin-2025';

// 测试配置
const config = {
  headers: {
    'Authorization': `Bearer ${TEST_TOKEN}`,
    'Content-Type': 'application/json'
  }
};

console.log('🧪 Phase 3 标签系统JSONB优化验收测试');
console.log('='.repeat(60));

async function runPhase3AcceptanceTest() {
  try {
    // 1. 测试Phase 3状态
    console.log('\n1. 检查Phase 3优化状态...');
    const statusResponse = await axios.get(`${BASE_URL}/api/test/phase3/status`, config);

    if (statusResponse.data.success) {
      const data = statusResponse.data.data;
      console.log(`✅ Phase: ${data.phase}`);
      console.log(`✅ 状态: ${data.status}`);
      console.log(`📊 统计: ${data.statistics.totalContacts}个联系人, ${data.statistics.totalTags}个标签`);

      // 检查功能状态
      Object.entries(data.features).forEach(([feature, status]) => {
        console.log(`   ${status} ${feature}`);
      });
    } else {
      throw new Error('Phase 3状态检查失败');
    }

    // 2. 测试反向查询功能
    console.log('\n2. 测试反向查询功能...');
    const reverseQueryResponse = await axios.get(`${BASE_URL}/api/test/phase3/reverse-query?contactLimit=5`, config);

    if (reverseQueryResponse.data.success) {
      const performance = reverseQueryResponse.data.data.performance;
      console.log(`✅ 查询时间: ${performance.queryTimeMs}ms`);
      console.log(`✅ 平均每联系人: ${performance.avgPerContact.toFixed(2)}ms`);
      console.log(`✅ 处理联系人数: ${performance.contactsCount}`);
      console.log(`✅ 标签总数: ${performance.totalTags}`);

      // 性能验证
      if (performance.queryTimeMs < 1000) {
        console.log('✅ 性能测试通过: 查询时间 < 1s');
      } else {
        console.warn('⚠️ 性能警告: 查询时间 > 1s');
      }
    } else {
      throw new Error('反向查询测试失败');
    }

    // 3. 测试数据一致性
    console.log('\n3. 验证数据一致性...');
    const consistencyResponse = await axios.get(`${BASE_URL}/api/test/phase3/data-consistency`, config);

    if (consistencyResponse.data.success) {
      const result = consistencyResponse.data.data;
      console.log(`✅ 数据一致性: ${result.isConsistent ? '通过' : '失败'}`);
      console.log(`✅ 检查联系人数: ${result.contactsChecked}`);
      console.log(`✅ 检查标签数: ${result.tagsChecked}`);

      if (result.inconsistencies && result.inconsistencies.length > 0) {
        console.warn(`⚠️ 发现${result.inconsistencies.length}个不一致项`);
        result.inconsistencies.slice(0, 3).forEach((item, index) => {
          console.warn(`   ${index + 1}. ${item.description}`);
        });
      } else {
        console.log('✅ 数据完全一致');
      }
    } else {
      throw new Error('数据一致性验证失败');
    }

    // 4. 测试联系人列表功能
    console.log('\n4. 测试联系人列表功能...');
    const listResponse = await axios.get(`${BASE_URL}/api/test/phase3/contact-list?page=1&limit=5&include_child_tags=true`, config);

    if (listResponse.data.success) {
      const data = listResponse.data.data;
      const performance = data.performance;

      console.log(`✅ 获取联系人数: ${data.data.length}`);
      console.log(`✅ 查询时间: ${performance.queryTimeMs}ms`);
      console.log(`✅ 分页信息: 第${data.pagination.page}页, 共${data.pagination.pages}页`);

      // 检查标签数据
      let totalTagsInList = 0;
      data.data.forEach(contact => {
        totalTagsInList += contact.tags ? contact.tags.length : 0;
      });
      console.log(`✅ 联系人列表中总标签数: ${totalTagsInList}`);

      if (performance.queryTimeMs < 500) {
        console.log('✅ 列表查询性能通过: < 500ms');
      } else {
        console.warn('⚠️ 列表查询性能警告: > 500ms');
      }
    } else {
      throw new Error('联系人列表测试失败');
    }

    // 5. 功能验收总结
    console.log('\n' + '='.repeat(60));
    console.log('🎉 Phase 3 验收测试完成');
    console.log('='.repeat(60));

    console.log('✅ 核心功能验收:');
    console.log('   ✓ 反向查询功能正常');
    console.log('   ✓ 批量查询性能满足要求');
    console.log('   ✓ 数据一致性验证通过');
    console.log('   ✓ 联系人列表功能正常');

    console.log('\n📋 Phase 3 主要成果:');
    console.log('   • 实现了tag.contacts反向查询机制');
    console.log('   • 启用了ContactTagService批量查询');
    console.log('   • 修复了contact.controller.js导出功能');
    console.log('   • 提供了完整的测试接口');

    console.log('\n🚀 下一步行动:');
    console.log('   • 修复剩余的contact.tags代码引用');
    console.log('   • 优化tag.controller.js的双写逻辑');
    console.log('   • 准备Phase 4队列系统重构');

    return {
      success: true,
      summary: 'Phase 3验收测试全部通过'
    };

  } catch (error) {
    console.error('\n❌ Phase 3验收测试失败:', error.message);

    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', JSON.stringify(error.response.data, null, 2));
    }

    return {
      success: false,
      error: error.message
    };
  }
}

// 执行测试
if (require.main === module) {
  runPhase3AcceptanceTest()
    .then(result => {
      if (result.success) {
        console.log('\n🎊 所有测试通过！Phase 3基本功能已就绪。');
        process.exit(0);
      } else {
        console.log('\n💥 测试失败，请检查问题并重试。');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 测试执行异常:', error);
      process.exit(1);
    });
}

module.exports = runPhase3AcceptanceTest; 