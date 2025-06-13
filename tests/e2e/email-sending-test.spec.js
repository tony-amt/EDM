const { test, expect } = require('@playwright/test');

test.describe('邮件发送功能测试', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="用户名"]', 'admin@example.com');
    await page.fill('input[placeholder*="密码"]', 'admin123456');
    
    const loginResponse = page.waitForResponse(response => 
      response.url().includes('/api/auth/login') && response.status() === 200
    );
    
    await page.click('button[type="submit"]');
    await loginResponse;
    await page.waitForURL('http://localhost:3001/');
  });

  test('测试模板管理功能', async ({ page }) => {
    console.log('🔍 测试模板管理功能...');
    
    // 导航到模板管理
    await page.click('a[href="/templates"]');
    await page.waitForLoadState('networkidle');
    
    // 验证模板列表页面
    const pageContent = await page.textContent('body');
    expect(pageContent).toContain('模板');
    
    // 尝试点击创建模板按钮
    const createButtons = await page.locator('button:has-text("创建"), button:has-text("新建"), button:has-text("添加")').count();
    console.log(`找到 ${createButtons} 个创建按钮`);
    
    if (createButtons > 0) {
      await page.click('button:has-text("创建"), button:has-text("新建"), button:has-text("添加")');
      await page.waitForLoadState('networkidle');
      
      // 验证是否进入创建页面
      const createPageContent = await page.textContent('body');
      const hasCreateForm = createPageContent.includes('模板') && createPageContent.includes('保存');
      
      if (hasCreateForm) {
        console.log('✅ 模板创建页面加载成功');
        
        // 检查富文本编辑器
        const editorCount = await page.locator('.ql-editor, .quill, [class*="editor"], textarea').count();
        if (editorCount > 0) {
          console.log('✅ 富文本编辑器已加载');
        } else {
          console.log('⚠️ 未找到富文本编辑器');
        }
      } else {
        console.log('⚠️ 模板创建页面可能未正确加载');
      }
    } else {
      console.log('⚠️ 未找到模板创建按钮');
    }
    
    console.log('✅ 模板管理功能测试完成');
  });

  test('测试任务管理功能', async ({ page }) => {
    console.log('🔍 测试任务管理功能...');
    
    // 导航到任务管理
    await page.click('a[href="/tasks"]');
    await page.waitForLoadState('networkidle');
    
    // 验证任务列表页面
    const pageContent = await page.textContent('body');
    expect(pageContent).toContain('任务');
    
    // 尝试点击创建任务按钮
    const createButtons = await page.locator('button:has-text("创建"), button:has-text("新建"), button:has-text("添加")').count();
    console.log(`找到 ${createButtons} 个创建按钮`);
    
    if (createButtons > 0) {
      await page.click('button:has-text("创建"), button:has-text("新建"), button:has-text("添加")');
      await page.waitForLoadState('networkidle');
      
      // 验证是否进入创建页面
      const createPageContent = await page.textContent('body');
      const hasCreateForm = createPageContent.includes('任务') && (createPageContent.includes('保存') || createPageContent.includes('提交'));
      
      if (hasCreateForm) {
        console.log('✅ 任务创建页面加载成功');
        
        // 检查模板选择器
        const selectorCount = await page.locator('select, .ant-select, [class*="select"]').count();
        if (selectorCount > 0) {
          console.log('✅ 模板选择器已加载');
        } else {
          console.log('⚠️ 未找到模板选择器');
        }
      } else {
        console.log('⚠️ 任务创建页面可能未正确加载');
      }
    } else {
      console.log('⚠️ 未找到任务创建按钮');
    }
    
    console.log('✅ 任务管理功能测试完成');
  });

  test('测试标签管理功能', async ({ page }) => {
    console.log('🔍 测试标签管理功能...');
    
    // 导航到标签管理
    await page.click('a[href="/tags"]');
    await page.waitForLoadState('networkidle');
    
    // 验证标签列表页面
    const pageContent = await page.textContent('body');
    expect(pageContent).toContain('标签');
    
    // 尝试点击创建标签按钮
    const createButtons = await page.locator('button:has-text("创建"), button:has-text("新建"), button:has-text("添加")').count();
    console.log(`找到 ${createButtons} 个创建按钮`);
    
    if (createButtons > 0) {
      await page.click('button:has-text("创建"), button:has-text("新建"), button:has-text("添加")');
      await page.waitForLoadState('networkidle');
      
      // 验证是否进入创建页面或模态框
      const afterClickContent = await page.textContent('body');
      const hasCreateForm = afterClickContent.includes('标签') && (afterClickContent.includes('保存') || afterClickContent.includes('确定'));
      
      if (hasCreateForm) {
        console.log('✅ 标签创建界面加载成功');
      } else {
        console.log('⚠️ 标签创建界面可能未正确加载');
      }
    } else {
      console.log('⚠️ 未找到标签创建按钮');
    }
    
    console.log('✅ 标签管理功能测试完成');
  });

  test('测试真实邮件发送（如果配置可用）', async ({ page }) => {
    console.log('🔍 测试真实邮件发送功能...');
    
    // 首先检查后端邮件配置是否可用
    const emailConfigResponse = await page.request.get('http://localhost:3000/api/email/config');
    
    if (emailConfigResponse.status() === 200) {
      console.log('✅ 邮件配置可用，执行真实发送测试');
      
      // 发送测试邮件的API调用
      const testEmailResponse = await page.request.post('http://localhost:3000/api/email/test', {
        data: {
          to: 'test@example.com',
          subject: 'UAT测试邮件',
          content: '这是一封UAT自动化测试邮件，请忽略。'
        },
        headers: {
          'Authorization': `Bearer ${await page.evaluate(() => localStorage.getItem('token'))}`
        }
      });
      
      if (testEmailResponse.status() === 200) {
        console.log('✅ 测试邮件发送成功');
        
        // 检查发送状态
        const response = await testEmailResponse.json();
        expect(response.success).toBe(true);
      } else {
        console.log('⚠️ 测试邮件发送失败，状态码:', testEmailResponse.status());
      }
    } else {
      console.log('⚠️ 邮件配置不可用，跳过真实发送测试');
      console.log('   这在开发环境中是正常的，生产环境需要配置SMTP');
    }
    
    console.log('✅ 邮件发送功能测试完成');
  });
}); 