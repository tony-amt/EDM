#!/usr/bin/env node

/**
 * 🔧 Webhook处理机制测试脚本
 * 测试重构后的webhook控制器是否正确处理EngageLab的两种格式
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

// 🔧 配置从环境变量读取，避免硬编码
const BASE_URL = process.env.BASE_URL || process.env.API_BASE_URL || 'https://tkmail.fun';
const WEBHOOK_ENDPOINT = `${BASE_URL}/webhook/engagelab`;

console.log(`🔧 测试配置:`);
console.log(`  - BASE_URL: ${BASE_URL}`);
console.log(`  - WEBHOOK_ENDPOINT: ${WEBHOOK_ENDPOINT}`);

// 测试数据
const TEST_CASES = {
  // 格式1：message_status (状态返回)
  delivered: {
    message_status: 'delivered',
    status_data: {
      message: 'successfully delivered'
    },
    task_id: 12345,
    api_user: 'test_user',
    email_id: 'test_email_123',
    custom_args: {
      subtask_id: 'test-subtask-id-001',
      task_id: 'test-task-id-001'
    }
  },

  invalid_email: {
    message_status: 'invalid_email',
    status_data: {
      message: 'invalid email address',
      error_detail: '邮箱格式不正确，无法送达'
    },
    task_id: 12346,
    api_user: 'test_user',
    email_id: 'test_email_124',
    custom_args: {
      subtask_id: 'test-subtask-id-002',
      task_id: 'test-task-id-001'
    }
  },

  soft_bounce: {
    message_status: 'soft_bounce',
    status_data: {
      message: 'soft bounce',
      error_detail: '邮箱服务器临时不可达，建议稍后重试'
    },
    task_id: 12347,
    api_user: 'test_user',
    email_id: 'test_email_125',
    custom_args: {
      subtask_id: 'test-subtask-id-003',
      task_id: 'test-task-id-001'
    }
  },

  // 格式2：event (用户回应)
  open: {
    event: 'open',
    response_data: {
      server: 'email',
      message_id: '1676618583015_104117_18546_8822.sc-10_43_7_16-inbound0$12345@hotmail.com',
      to: '12345@hotmail.com',
      time: 1676620370426,
      response: {
        event: 'open'
      }
    },
    custom_args: {
      subtask_id: 'test-subtask-id-004',
      task_id: 'test-task-id-002'
    }
  },

  click: {
    event: 'click',
    response_data: {
      server: 'email',
      message_id: '1676618583015_104117_18546_8822.sc-10_43_7_16-inbound0$12345@hotmail.com',
      to: '12345@hotmail.com',
      time: 1676620370426,
      response: {
        event: 'click',
        url: 'https://example.com/clicked-link'
      }
    },
    custom_args: {
      subtask_id: 'test-subtask-id-005',
      task_id: 'test-task-id-002'
    }
  },

  unsubscribe: {
    event: 'unsubscribe',
    response_data: {
      server: 'email',
      message_id: '1676618583015_104117_18546_8822.sc-10_43_7_16-inbound0$12345@hotmail.com',
      to: '12345@hotmail.com',
      from_email: '12345@hotmail.com',
      time: 1676620370426,
      response: {
        event: 'unsubscribe'
      }
    },
    custom_args: {
      subtask_id: 'test-subtask-id-006',
      task_id: 'test-task-id-002'
    }
  },

  report_spam: {
    event: 'report_spam',
    response_data: {
      server: 'email',
      message_id: '1676618583015_104117_18546_8822.sc-10_43_7_16-inbound0$12345@hotmail.com',
      to: '12345@hotmail.com',
      from_email: '12345@hotmail.com',
      time: 1676620370426,
      response: {
        event: 'report_spam'
      }
    },
    custom_args: {
      subtask_id: 'test-subtask-id-007',
      task_id: 'test-task-id-002'
    }
  },

  route: {
    event: 'route',
    response_data: {
      server: 'email',
      message_id: '1676618583015_104117_18546_8822.sc-10_43_7_16-inbound0$12345@hotmail.com',
      to: 'support@example.com',
      from_email: '12345@hotmail.com',
      subject: 'Re: 您的邮件主题',
      body: '这是一封回复邮件的内容...',
      time: 1676620370426,
      response: {
        event: 'route'
      }
    },
    custom_args: {
      subtask_id: 'test-subtask-id-008',
      task_id: 'test-task-id-002'
    }
  }
};

/**
 * 发送webhook测试请求
 */
async function sendWebhookTest(testName, webhookData) {
  const startTime = performance.now();

  try {
    console.log(`\n🧪 测试: ${testName}`);
    console.log(`📤 发送数据:`, JSON.stringify(webhookData, null, 2));

    const response = await axios.post(WEBHOOK_ENDPOINT, webhookData, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'EngageLab-Webhook-Test/1.0'
      },
      timeout: 10000
    });

    const duration = performance.now() - startTime;

    console.log(`✅ 响应成功 (${Math.round(duration)}ms)`);
    console.log(`📥 响应状态: ${response.status}`);
    console.log(`📥 响应数据:`, JSON.stringify(response.data, null, 2));

    return {
      success: true,
      status: response.status,
      data: response.data,
      duration: Math.round(duration)
    };

  } catch (error) {
    const duration = performance.now() - startTime;

    console.error(`❌ 测试失败 (${Math.round(duration)}ms)`);
    console.error(`错误信息: ${error.message}`);

    if (error.response) {
      console.error(`响应状态: ${error.response.status}`);
      console.error(`响应数据:`, JSON.stringify(error.response.data, null, 2));
    }

    return {
      success: false,
      error: error.message,
      status: error.response?.status,
      data: error.response?.data,
      duration: Math.round(duration)
    };
  }
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log('🚀 开始Webhook处理机制测试');
  console.log(`🔗 测试端点: ${WEBHOOK_ENDPOINT}`);
  console.log(`⏰ 测试时间: ${new Date().toISOString()}`);

  const results = [];

  for (const [testName, webhookData] of Object.entries(TEST_CASES)) {
    const result = await sendWebhookTest(testName, webhookData);
    results.push({ testName, ...result });

    // 测试间隔，避免过快请求
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 生成测试报告
  console.log('\n📊 测试报告');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ 成功: ${successful.length}/${results.length}`);
  console.log(`❌ 失败: ${failed.length}/${results.length}`);

  if (successful.length > 0) {
    console.log(`⚡ 平均响应时间: ${Math.round(successful.reduce((sum, r) => sum + r.duration, 0) / successful.length)}ms`);
  }

  if (failed.length > 0) {
    console.log('\n❌ 失败的测试:');
    failed.forEach(result => {
      console.log(`  - ${result.testName}: ${result.error}`);
    });
  }

  console.log('\n🎯 测试重点验证:');
  console.log('1. EngageLab两种webhook格式是否正确识别');
  console.log('2. EventLog是否正确记录原始数据');
  console.log('3. SubTask关联是否通过custom_args.subtask_id正确建立');
  console.log('4. message_status和event事件是否正确处理');
  console.log('5. 联系人标签是否在unsubscribe/spam事件中正确更新');

  return results;
}

/**
 * 测试webhook状态检查
 */
async function testWebhookStatus() {
  try {
    console.log('\n🔍 测试Webhook状态检查...');

    // 尝试访问健康检查端点
    const response = await axios.get(`${BASE_URL}/health`, {
      timeout: 5000
    });

    console.log(`✅ 服务状态: ${response.data.status}`);
    console.log(`📋 服务信息: ${response.data.service}`);

    return true;
  } catch (error) {
    console.error(`❌ 服务状态检查失败: ${error.message}`);
    // 即使状态检查失败，也继续webhook测试
    console.log(`⚠️ 跳过状态检查，继续webhook测试...`);
    return true;
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    // 检查服务状态
    const statusOk = await testWebhookStatus();
    if (!statusOk) {
      console.error('❌ Webhook服务不可用，退出测试');
      process.exit(1);
    }

    // 运行所有测试
    const results = await runAllTests();

    // 检查整体测试结果
    const allPassed = results.every(r => r.success);

    if (allPassed) {
      console.log('\n🎉 所有测试通过！Webhook处理机制工作正常。');
      process.exit(0);
    } else {
      console.error('\n❌ 部分测试失败，请检查webhook处理逻辑。');
      process.exit(1);
    }

  } catch (error) {
    console.error(`💥 测试运行失败: ${error.message}`);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  main();
}

module.exports = {
  sendWebhookTest,
  runAllTests,
  TEST_CASES
}; 