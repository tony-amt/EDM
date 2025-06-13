#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');

class SimpleE2ETest {
  constructor() {
    this.baseURL = 'http://localhost:3000';
    this.frontendURL = 'http://localhost:3001';
    this.token = null;
    this.testResults = [];
  }

  async runTests() {
    console.log('🚀 开始简化E2E测试...');
    console.log('📅 测试时间:', new Date().toLocaleString());
    console.log('');

    try {
      await this.testSystemHealth();
      await this.testLogin();
      await this.testContactsCRUD();
      await this.testTemplatesCRUD();
      await this.generateReport();
      
      console.log('🎉 E2E测试完成!');
    } catch (error) {
      console.error('❌ 测试失败:', error.message);
      this.generateReport();
      process.exit(1);
    }
  }

  async testSystemHealth() {
    console.log('🔍 Phase 1: 系统健康检查...');
    
    try {
      // 检查后端健康状态
      const healthResponse = await axios.get(`${this.baseURL}/health`);
      if (healthResponse.status === 200) {
        console.log('✅ 后端服务正常');
        this.addResult('后端健康检查', true, '服务正常运行');
      }
    } catch (error) {
      console.log('❌ 后端服务异常:', error.message);
      this.addResult('后端健康检查', false, error.message);
      throw error;
    }

    try {
      // 检查前端服务
      const frontendResponse = await axios.get(this.frontendURL);
      if (frontendResponse.status === 200) {
        console.log('✅ 前端服务正常');
        this.addResult('前端服务检查', true, '服务正常运行');
      }
    } catch (error) {
      console.log('❌ 前端服务异常:', error.message);
      this.addResult('前端服务检查', false, error.message);
      throw error;
    }

    console.log('');
  }

  async testLogin() {
    console.log('🔐 Phase 2: 登录功能测试...');
    
    try {
      const loginData = {
        usernameOrEmail: 'admin@example.com',
        password: 'admin123456'
      };

      const response = await axios.post(`${this.baseURL}/api/auth/login`, loginData);
      
      if (response.data.success && response.data.token) {
        this.token = response.data.token;
        console.log('✅ 登录成功');
        this.addResult('管理员登录', true, '获取到JWT token');
      } else {
        throw new Error('登录响应格式异常');
      }
    } catch (error) {
      console.log('❌ 登录失败:', error.response?.data || error.message);
      this.addResult('管理员登录', false, error.response?.data || error.message);
      throw error;
    }

    console.log('');
  }

  async testContactsCRUD() {
    console.log('👥 Phase 3: 联系人管理测试...');
    
    if (!this.token) {
      throw new Error('需要先登录');
    }

    const headers = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };

    try {
      // 1. 获取联系人列表
      const listResponse = await axios.get(`${this.baseURL}/api/contacts`, { headers });
      console.log('✅ 联系人列表获取成功');
      this.addResult('联系人列表获取', true, `返回${listResponse.data.data?.length || 0}个联系人`);

      // 2. 创建联系人
      const contactData = {
        name: `测试联系人-${Date.now()}`,
        email: `test-${Date.now()}@example.com`,
        company: '测试公司'
      };

      const createResponse = await axios.post(`${this.baseURL}/api/contacts`, contactData, { headers });
      
      if (createResponse.status === 201 || createResponse.status === 200) {
        const contactId = createResponse.data.id;
        console.log('✅ 联系人创建成功');
        this.addResult('联系人创建', true, `ID: ${contactId}`);

        // 3. 获取联系人详情
        const detailResponse = await axios.get(`${this.baseURL}/api/contacts/${contactId}`, { headers });
        if (detailResponse.data.name === contactData.name) {
          console.log('✅ 联系人详情获取成功');
          this.addResult('联系人详情获取', true, '数据一致性验证通过');
        }

        // 4. 更新联系人
        const updateData = { ...contactData, name: contactData.name + '-已更新' };
        const updateResponse = await axios.put(`${this.baseURL}/api/contacts/${contactId}`, updateData, { headers });
        if (updateResponse.status === 200) {
          console.log('✅ 联系人更新成功');
          this.addResult('联系人更新', true, '更新操作正常');
        }

      } else {
        throw new Error('联系人创建失败');
      }

    } catch (error) {
      console.log('❌ 联系人管理测试失败:', error.response?.data || error.message);
      this.addResult('联系人管理', false, error.response?.data || error.message);
    }

    console.log('');
  }

  async testTemplatesCRUD() {
    console.log('📧 Phase 4: 模板管理测试...');
    
    if (!this.token) {
      throw new Error('需要先登录');
    }

    const headers = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };

    try {
      // 1. 获取模板列表
      const listResponse = await axios.get(`${this.baseURL}/api/templates`, { headers });
      console.log('✅ 模板列表获取成功');
      this.addResult('模板列表获取', true, `返回${listResponse.data.data?.length || 0}个模板`);

      // 2. 创建模板
      const templateData = {
        name: `测试模板-${Date.now()}`,
        subject: '测试邮件主题',
        content: '这是测试模板的内容'
      };

      const createResponse = await axios.post(`${this.baseURL}/api/templates`, templateData, { headers });
      
      if (createResponse.status === 201 || createResponse.status === 200) {
        const templateId = createResponse.data.id;
        console.log('✅ 模板创建成功');
        this.addResult('模板创建', true, `ID: ${templateId}`);

        // 3. 获取模板详情
        const detailResponse = await axios.get(`${this.baseURL}/api/templates/${templateId}`, { headers });
        if (detailResponse.data.name === templateData.name) {
          console.log('✅ 模板详情获取成功');
          this.addResult('模板详情获取', true, '数据一致性验证通过');
        }

      } else {
        throw new Error('模板创建失败');
      }

      // 4. 测试模板集API
      try {
        const templateSetsResponse = await axios.get(`${this.baseURL}/api/templates/sets`, { headers });
        console.log('✅ 模板集API调用成功');
        this.addResult('模板集API', true, '接口可正常访问');
      } catch (error) {
        console.log('⚠️ 模板集API可能不存在，这是已知问题');
        this.addResult('模板集API', false, '接口不存在或路径错误');
      }

    } catch (error) {
      console.log('❌ 模板管理测试失败:', error.response?.data || error.message);
      this.addResult('模板管理', false, error.response?.data || error.message);
    }

    console.log('');
  }

  addResult(testName, passed, detail) {
    this.testResults.push({
      name: testName,
      passed,
      detail,
      timestamp: new Date().toISOString()
    });
  }

  generateReport() {
    console.log('📋 测试结果报告...');
    
    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

    console.log(`📊 总体结果: ${passed}/${total} 通过 (${passRate}%)`);
    console.log('');

    console.log('详细结果:');
    this.testResults.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`  ${status} ${result.name}: ${result.detail}`);
    });

    // 保存JSON报告
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total,
        passed,
        failed: total - passed,
        passRate
      },
      results: this.testResults
    };

    if (!fs.existsSync('test-results')) {
      fs.mkdirSync('test-results');
    }

    fs.writeFileSync('test-results/simple-e2e-report.json', JSON.stringify(report, null, 2));
    console.log('');
    console.log('📄 报告已保存: test-results/simple-e2e-report.json');

    if (passRate >= 80) {
      console.log('');
      console.log('🎉 ===============================================');
      console.log('🎉 E2E测试通过率达标，系统基本功能正常!');
      console.log('🎉 可以进行进一步的UAT测试');
      console.log('🎉 ===============================================');
    } else {
      console.log('');
      console.log('⚠️ ===============================================');
      console.log('⚠️ E2E测试通过率不足，需要修复问题');
      console.log('⚠️ ===============================================');
    }
  }
}

// 执行测试
if (require.main === module) {
  const tester = new SimpleE2ETest();
  tester.runTests().catch(console.error);
}

module.exports = SimpleE2ETest; 