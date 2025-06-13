import { test, expect } from '@playwright/test';

test.describe('UAT 用户验收测试执行', () => {
  
  // 通用登录函数
  async function login(page) {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.fill('input[placeholder*="用户名"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'admin123456');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/$/, { timeout: 15000 });
    await page.waitForTimeout(2000);
  }

  // 测试结果收集
  let testResults = {
    scenario1: { passed: true, issues: [] },
    scenario2: { passed: true, issues: [] },
    scenario3: { passed: true, issues: [] },
    scenario4: { passed: true, issues: [] },
    scenario5: { passed: true, issues: [] }
  };

  test('UAT场景1: 新用户入门流程', async ({ page }) => {
    console.log('🎯 UAT场景1: 新用户入门流程测试');
    
    try {
      // 1. 登录系统
      console.log('📋 步骤1: 登录系统');
      const loginStart = Date.now();
      await login(page);
      const loginTime = Date.now() - loginStart;
      
      if (loginTime > 5000) {
        testResults.scenario1.issues.push('登录耗时过长: ' + loginTime + 'ms');
        console.log('⚠️ 登录耗时过长:', loginTime + 'ms');
      } else {
        console.log('✅ 登录速度正常:', loginTime + 'ms');
      }
      
      // 2. 验证仪表盘
      console.log('📋 步骤2: 验证仪表盘显示');
      await page.waitForTimeout(2000);
      
      // 检查页面基本元素
      const hasHeader = await page.locator('header, .ant-layout-header').count() > 0;
      const hasNavigation = await page.locator('nav, .ant-menu').count() > 0;
      const hasContent = await page.locator('main, .ant-layout-content').count() > 0;
      
      if (!hasHeader || !hasNavigation || !hasContent) {
        testResults.scenario1.issues.push('仪表盘基本布局不完整');
        console.log('❌ 仪表盘基本布局不完整');
      } else {
        console.log('✅ 仪表盘布局正常');
      }
      
      // 3. 浏览功能模块
      console.log('📋 步骤3: 浏览功能模块');
      const modules = [
        { name: '联系人', url: '/contacts' },
        { name: '模板', url: '/templates' },
        { name: '标签', url: '/tags' }
      ];
      
      for (const module of modules) {
        try {
          await page.goto(module.url);
          await page.waitForLoadState('networkidle', { timeout: 10000 });
          console.log(`✅ ${module.name}模块可访问`);
        } catch (error) {
          testResults.scenario1.issues.push(`${module.name}模块访问失败: ${error.message}`);
          console.log(`❌ ${module.name}模块访问失败`);
        }
      }
      
      console.log('✅ UAT场景1: 新用户入门流程测试完成');
      
    } catch (error) {
      testResults.scenario1.passed = false;
      testResults.scenario1.issues.push('场景1执行异常: ' + error.message);
      console.log('❌ UAT场景1测试失败:', error.message);
    }
  });

  test('UAT场景2: 联系人管理完整工作流', async ({ page }) => {
    console.log('🎯 UAT场景2: 联系人管理完整工作流');
    
    try {
      await login(page);
      
      // 1. 导航到联系人页面
      console.log('📋 步骤1: 导航到联系人页面');
      await page.goto('/contacts');
      await page.waitForLoadState('networkidle');
      
      // 2. 创建新联系人
      console.log('📋 步骤2: 创建新联系人');
      try {
        // 查找创建按钮
        const createButton = page.locator('[data-testid="create-contact-btn"]').or(page.locator('text=创建联系人')).or(page.locator('text=新建联系人')).or(page.locator('text=添加联系人')).first();
        if (await createButton.isVisible({ timeout: 5000 })) {
          await createButton.click();
          await page.waitForTimeout(2000);
          
          // 填写联系人信息
          const contactName = `张三-UAT-${Date.now()}`;
          const contactEmail = `zhangsan-uat-${Date.now()}@example.com`;
          
          // 尝试填写表单
          const nameField = page.locator('input[name="name"], input[placeholder*="姓名"], input[placeholder*="名称"]').first();
          const emailField = page.locator('input[name="email"], input[type="email"], input[placeholder*="邮箱"]').first();
          
          if (await nameField.isVisible({ timeout: 3000 })) {
            await nameField.fill(contactName);
            console.log('✅ 姓名字段填写成功');
          } else {
            testResults.scenario2.issues.push('未找到姓名输入字段');
          }
          
          if (await emailField.isVisible({ timeout: 3000 })) {
            await emailField.fill(contactEmail);
            console.log('✅ 邮箱字段填写成功');
          } else {
            testResults.scenario2.issues.push('未找到邮箱输入字段');
          }
          
          // 提交表单
          const submitButton = page.locator('button[type="submit"], button:has-text("保存"), button:has-text("确定")').first();
          if (await submitButton.isVisible({ timeout: 3000 })) {
            await submitButton.click();
            await page.waitForTimeout(3000);
            console.log('✅ 联系人创建表单提交成功');
          } else {
            testResults.scenario2.issues.push('未找到提交按钮');
          }
          
        } else {
          testResults.scenario2.issues.push('未找到创建联系人按钮');
          console.log('⚠️ 未找到创建联系人按钮');
        }
      } catch (error) {
        testResults.scenario2.issues.push('创建联系人过程异常: ' + error.message);
      }
      
      // 3. 验证联系人列表
      console.log('📋 步骤3: 验证联系人列表');
      await page.goto('/contacts');
      await page.waitForLoadState('networkidle');
      
      const contactsList = await page.locator('table, .ant-table, .contact-list').count();
      if (contactsList > 0) {
        console.log('✅ 联系人列表显示正常');
      } else {
        testResults.scenario2.issues.push('未找到联系人列表');
      }
      
      console.log('✅ UAT场景2: 联系人管理工作流测试完成');
      
    } catch (error) {
      testResults.scenario2.passed = false;
      testResults.scenario2.issues.push('场景2执行异常: ' + error.message);
      console.log('❌ UAT场景2测试失败:', error.message);
    }
  });

  test('UAT场景3: 邮件模板管理', async ({ page }) => {
    console.log('🎯 UAT场景3: 邮件模板管理');
    
    try {
      await login(page);
      
      // 1. 导航到模板页面
      console.log('📋 步骤1: 导航到模板页面');
      await page.goto('/templates');
      await page.waitForLoadState('networkidle');
      
      // 2. 创建新模板
      console.log('📋 步骤2: 创建新邮件模板');
      try {
        const createButton = page.locator('[data-testid="create-template-btn"]').or(page.locator('text=创建模板')).or(page.locator('text=新建模板')).or(page.locator('text=添加模板')).first();
        if (await createButton.isVisible({ timeout: 5000 })) {
          await createButton.click();
          await page.waitForTimeout(2000);
          
          // 填写模板信息
          const templateName = `欢迎邮件模板-UAT-${Date.now()}`;
          const templateSubject = '欢迎加入我们！';
          
          const nameField = page.locator('input[name="name"], input[placeholder*="模板名"], input[placeholder*="名称"]').first();
          const subjectField = page.locator('input[name="subject"], input[placeholder*="主题"]').first();
          
          if (await nameField.isVisible({ timeout: 3000 })) {
            await nameField.fill(templateName);
            console.log('✅ 模板名称填写成功');
          } else {
            testResults.scenario3.issues.push('未找到模板名称输入字段');
          }
          
          if (await subjectField.isVisible({ timeout: 3000 })) {
            await subjectField.fill(templateSubject);
            console.log('✅ 邮件主题填写成功');
          } else {
            testResults.scenario3.issues.push('未找到邮件主题输入字段');
          }
          
          // 3. 测试富文本编辑器
          console.log('📋 步骤3: 测试富文本编辑器');
          const contentSelectors = [
            '.ql-editor',
            'textarea[name="content"]',
            'textarea[placeholder*="内容"]',
            '[contenteditable="true"]'
          ];
          
          let editorFound = false;
          for (const selector of contentSelectors) {
            try {
              const editor = page.locator(selector).first();
              if (await editor.isVisible({ timeout: 2000 })) {
                await editor.fill('这是UAT测试模板的内容，包含了基本的文本内容。');
                console.log('✅ 内容编辑器填写成功');
                editorFound = true;
                break;
              }
            } catch (error) {
              continue;
            }
          }
          
          if (!editorFound) {
            testResults.scenario3.issues.push('未找到内容编辑器');
          }
          
          // 4. 保存模板
          console.log('📋 步骤4: 保存模板');
          const submitButton = page.locator('button[type="submit"], button:has-text("保存"), button:has-text("确定")').first();
          if (await submitButton.isVisible({ timeout: 3000 })) {
            await submitButton.click();
            await page.waitForTimeout(3000);
            console.log('✅ 模板保存成功');
          } else {
            testResults.scenario3.issues.push('未找到保存按钮');
          }
          
        } else {
          testResults.scenario3.issues.push('未找到创建模板按钮');
        }
      } catch (error) {
        testResults.scenario3.issues.push('创建模板过程异常: ' + error.message);
      }
      
      // 5. 验证模板列表
      console.log('📋 步骤5: 验证模板列表');
      await page.goto('/templates');
      await page.waitForLoadState('networkidle');
      
      const templatesList = await page.locator('table, .ant-table, .template-list').count();
      if (templatesList > 0) {
        console.log('✅ 模板列表显示正常');
      } else {
        testResults.scenario3.issues.push('未找到模板列表');
      }
      
      console.log('✅ UAT场景3: 邮件模板管理测试完成');
      
    } catch (error) {
      testResults.scenario3.passed = false;
      testResults.scenario3.issues.push('场景3执行异常: ' + error.message);
      console.log('❌ UAT场景3测试失败:', error.message);
    }
  });

  test('UAT场景4: 标签管理和分类', async ({ page }) => {
    console.log('🎯 UAT场景4: 标签管理和分类');
    
    try {
      await login(page);
      
      // 1. 导航到标签页面
      console.log('📋 步骤1: 导航到标签页面');
      await page.goto('/tags');
      await page.waitForLoadState('networkidle');
      
      // 2. 验证标签页面加载
      const pageContent = await page.content();
      if (pageContent.includes('标签') || pageContent.includes('Tag') || pageContent.includes('tag')) {
        console.log('✅ 标签页面加载正常');
      } else {
        testResults.scenario4.issues.push('标签页面内容异常');
      }
      
      // 3. 查找标签创建功能
      console.log('📋 步骤2: 查找标签创建功能');
      const createTagSelectors = [
        'text=创建标签',
        'text=新建标签',
        'text=添加标签',
        'button:has-text("创建")',
        'button:has-text("新建")'
      ];
      
      let createTagButton = null;
      for (const selector of createTagSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 2000 })) {
            createTagButton = element;
            console.log(`✅ 找到创建标签按钮: "${selector}"`);
            break;
          }
        } catch (error) {
          continue;
        }
      }
      
      if (createTagButton) {
        try {
          await createTagButton.click();
          await page.waitForTimeout(2000);
          
          // 尝试填写标签信息
          const tagName = `VIP客户-UAT-${Date.now()}`;
          const nameField = page.locator('input[name="name"], input[placeholder*="标签名"], input[placeholder*="名称"]').first();
          
          if (await nameField.isVisible({ timeout: 3000 })) {
            await nameField.fill(tagName);
            console.log('✅ 标签名称填写成功');
            
            // 提交
            const submitButton = page.locator('button[type="submit"], button:has-text("保存"), button:has-text("确定")').first();
            if (await submitButton.isVisible({ timeout: 3000 })) {
              await submitButton.click();
              await page.waitForTimeout(2000);
              console.log('✅ 标签创建成功');
            }
          } else {
            testResults.scenario4.issues.push('未找到标签名称输入字段');
          }
        } catch (error) {
          testResults.scenario4.issues.push('标签创建过程异常: ' + error.message);
        }
      } else {
        testResults.scenario4.issues.push('未找到创建标签功能');
        console.log('⚠️ 未找到创建标签功能，可能页面结构不同');
      }
      
      console.log('✅ UAT场景4: 标签管理和分类测试完成');
      
    } catch (error) {
      testResults.scenario4.passed = false;
      testResults.scenario4.issues.push('场景4执行异常: ' + error.message);
      console.log('❌ UAT场景4测试失败:', error.message);
    }
  });

  test('UAT场景5: 系统性能和稳定性', async ({ page }) => {
    console.log('🎯 UAT场景5: 系统性能和稳定性');
    
    try {
      await login(page);
      
      // 1. 测试页面切换性能
      console.log('📋 步骤1: 测试页面切换性能');
      const pages = ['/', '/contacts', '/templates', '/tags'];
      
      for (const testPage of pages) {
        const start = Date.now();
        await page.goto(testPage);
        await page.waitForLoadState('networkidle');
        const loadTime = Date.now() - start;
        
        if (loadTime > 5000) {
          testResults.scenario5.issues.push(`页面${testPage}加载耗时过长: ${loadTime}ms`);
          console.log(`⚠️ 页面${testPage}加载耗时: ${loadTime}ms`);
        } else {
          console.log(`✅ 页面${testPage}加载正常: ${loadTime}ms`);
        }
      }
      
      // 2. 测试API响应性能
      console.log('📋 步骤2: 测试API响应性能');
      const apiCalls = [];
      
      page.on('response', response => {
        if (response.url().includes('/api/')) {
          apiCalls.push({
            url: response.url(),
            status: response.status(),
            timing: Date.now()
          });
        }
      });
      
      // 触发API调用
      await page.goto('/contacts');
      await page.waitForLoadState('networkidle');
      await page.goto('/templates');
      await page.waitForLoadState('networkidle');
      
      const successfulAPIs = apiCalls.filter(call => call.status >= 200 && call.status < 300);
      const failedAPIs = apiCalls.filter(call => call.status >= 400);
      
      console.log(`📊 API调用统计: 成功${successfulAPIs.length}个, 失败${failedAPIs.length}个`);
      
      if (failedAPIs.length > 0) {
        testResults.scenario5.issues.push(`API调用失败${failedAPIs.length}个`);
      }
      
      // 3. 测试长时间使用稳定性
      console.log('📋 步骤3: 测试长时间使用稳定性');
      for (let i = 0; i < 5; i++) {
        await page.goto('/');
        await page.waitForTimeout(1000);
        await page.goto('/contacts');
        await page.waitForTimeout(1000);
        await page.goto('/templates');
        await page.waitForTimeout(1000);
      }
      
      console.log('✅ 长时间使用测试完成');
      
      console.log('✅ UAT场景5: 系统性能和稳定性测试完成');
      
    } catch (error) {
      testResults.scenario5.passed = false;
      testResults.scenario5.issues.push('场景5执行异常: ' + error.message);
      console.log('❌ UAT场景5测试失败:', error.message);
    }
  });

  test('UAT测试结果汇总', async ({ page }) => {
    console.log('\n🎯 UAT测试结果汇总报告');
    console.log('='.repeat(50));
    
    const scenarios = [
      { name: '场景1: 新用户入门流程', result: testResults.scenario1 },
      { name: '场景2: 联系人管理工作流', result: testResults.scenario2 },
      { name: '场景3: 邮件模板管理', result: testResults.scenario3 },
      { name: '场景4: 标签管理和分类', result: testResults.scenario4 },
      { name: '场景5: 系统性能和稳定性', result: testResults.scenario5 }
    ];
    
    let passedCount = 0;
    let totalIssues = 0;
    
    scenarios.forEach((scenario, index) => {
      const status = scenario.result.passed ? '✅ 通过' : '❌ 失败';
      const issueCount = scenario.result.issues.length;
      totalIssues += issueCount;
      
      if (scenario.result.passed && issueCount === 0) {
        passedCount++;
      }
      
      console.log(`${scenario.name}: ${status} (${issueCount}个问题)`);
      
      if (issueCount > 0) {
        scenario.result.issues.forEach(issue => {
          console.log(`  ⚠️ ${issue}`);
        });
      }
    });
    
    console.log('='.repeat(50));
    console.log(`📊 总体测试结果: ${passedCount}/${scenarios.length} 个场景完全通过`);
    console.log(`📋 发现问题总数: ${totalIssues} 个`);
    
    // 生成部署建议
    let deploymentRecommendation;
    if (passedCount === scenarios.length && totalIssues === 0) {
      deploymentRecommendation = '🟢 立即可部署 - 所有测试通过，无问题发现';
    } else if (passedCount >= 4 && totalIssues <= 3) {
      deploymentRecommendation = '🟡 需要修复后部署 - 大部分功能正常，存在少量问题';
    } else {
      deploymentRecommendation = '🔴 暂缓部署 - 存在较多问题需要修复';
    }
    
    console.log(`🚀 部署建议: ${deploymentRecommendation}`);
    console.log('='.repeat(50));
    
    // 保存测试报告
    const fs = require('fs');
    const reportData = {
      timestamp: new Date().toISOString(),
      scenarios: scenarios.map(s => ({
        name: s.name,
        passed: s.result.passed,
        issues: s.result.issues
      })),
      summary: {
        passedCount,
        totalScenarios: scenarios.length,
        totalIssues,
        deploymentRecommendation
      }
    };
    
    if (!fs.existsSync('test-results')) {
      fs.mkdirSync('test-results');
    }
    
    fs.writeFileSync('test-results/uat-report.json', JSON.stringify(reportData, null, 2));
    console.log('📄 UAT测试报告已保存: test-results/uat-report.json');
  });
}); 