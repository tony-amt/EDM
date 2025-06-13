import { test, expect } from '@playwright/test';

// 测试配置
const TEST_USER = {
  email: 'admin@example.com',
  password: 'admin123456'
};

const TEST_EMAIL = 'gloda2024@gmail.com';

test.describe('关键用户流程E2E测试', () => {
  // 每个测试前都先登录
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="usernameOrEmail"], input[type="email"], input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"], input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    
    // 等待登录完成
    await expect(page).toHaveURL(/.*\/dashboard/);
  });

  // Bug-010-1: 联系人编辑表单数据显示测试
  test('联系人编辑表单数据正确显示', async ({ page }) => {
    console.log('🧪 测试: 联系人编辑表单数据显示...');
    
    // 1. 先创建一个测试联系人
    await page.goto('/contacts');
    await page.click('text=创建联系人');
    
    await page.fill('input[name="name"]', '测试联系人-编辑');
    await page.fill('input[name="email"]', 'edit-test@example.com');
    await page.fill('input[name="company"]', '测试公司');
    await page.click('button[type="submit"]');
    
    // 等待创建成功
    await expect(page.locator('text=测试联系人-编辑')).toBeVisible();
    
    // 2. 点击编辑按钮
    await page.click('button:has-text("编辑"):near(:text("测试联系人-编辑"))');
    
    // 3. 验证表单数据正确显示
    await expect(page.locator('input[name="name"]')).toHaveValue('测试联系人-编辑');
    await expect(page.locator('input[name="email"]')).toHaveValue('edit-test@example.com');
    await expect(page.locator('input[name="company"]')).toHaveValue('测试公司');
    
    console.log('✅ 联系人编辑表单数据显示正常');
  });

  // Bug-010-2: 联系人创建后列表刷新测试
  test('联系人创建后列表正确显示', async ({ page }) => {
    console.log('🧪 测试: 联系人创建后列表刷新...');
    
    await page.goto('/contacts');
    
    // 记录创建前的联系人数量
    const beforeCount = await page.locator('[data-testid="contact-item"]').count();
    
    // 创建新联系人
    await page.click('text=创建联系人');
    
    const uniqueName = `测试联系人-${Date.now()}`;
    await page.fill('input[name="name"]', uniqueName);
    await page.fill('input[name="email"]', `test-${Date.now()}@example.com`);
    await page.click('button[type="submit"]');
    
    // 验证页面跳转回列表页
    await expect(page).toHaveURL(/.*\/contacts$/);
    
    // 验证新联系人在列表中显示
    await expect(page.locator(`text=${uniqueName}`)).toBeVisible({ timeout: 10000 });
    
    // 验证列表数量增加
    const afterCount = await page.locator('[data-testid="contact-item"]').count();
    expect(afterCount).toBeGreaterThan(beforeCount);
    
    console.log('✅ 联系人创建后列表显示正常');
  });

  // Bug-010-3: 富文本编辑器加载测试
  test('模板创建页面富文本编辑器正常加载', async ({ page }) => {
    console.log('🧪 测试: 富文本编辑器加载...');
    
    await page.goto('/templates');
    await page.click('text=创建模板');
    
    // 等待页面加载
    await page.waitForLoadState('networkidle');
    
    // 等待富文本编辑器加载 - 使用多种选择器尝试
    const editorSelectors = [
      '.ql-editor',
      '.quill-editor .ql-editor',
      '[contenteditable="true"]',
      '.rich-text-editor'
    ];
    
    let editorFound = false;
    for (const selector of editorSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 15000 });
        console.log(`✅ 找到富文本编辑器: ${selector}`);
        editorFound = true;
        
        // 测试编辑器可用性
        await page.click(selector);
        await page.type(selector, '这是富文本编辑器测试内容');
        
        // 验证内容被输入
        const content = await page.locator(selector).textContent();
        expect(content).toContain('这是富文本编辑器测试内容');
        
        break;
      } catch (error) {
        console.log(`❌ 编辑器选择器失败: ${selector}`);
        continue;
      }
    }
    
    if (!editorFound) {
      console.log('⚠️ 未找到富文本编辑器，检查页面结构...');
      
      // 截图调试
      await page.screenshot({ path: 'debug-editor.png' });
      
      // 打印页面内容用于调试
      const pageContent = await page.content();
      console.log('页面内容片段:', pageContent.substring(0, 1000));
    }
    
    expect(editorFound).toBe(true);
    console.log('✅ 富文本编辑器加载正常');
  });

  // Bug-010-4: 模板保存功能测试
  test('模板创建和保存功能正常', async ({ page }) => {
    console.log('🧪 测试: 模板创建和保存...');
    
    await page.goto('/templates');
    await page.click('text=创建模板');
    
    // 填写模板基础信息
    const templateName = `测试模板-${Date.now()}`;
    await page.fill('input[name="name"]', templateName);
    await page.fill('input[name="subject"]', '测试邮件主题');
    
    // 等待富文本编辑器并填写内容
    try {
      await page.waitForSelector('.ql-editor', { timeout: 10000 });
      await page.click('.ql-editor');
      await page.type('.ql-editor', '这是测试模板的邮件内容');
    } catch (error) {
      // 如果富文本编辑器不可用，使用textarea后备方案
      await page.fill('textarea[name="content"]', '这是测试模板的邮件内容');
    }
    
    // 保存模板
    await page.click('button[type="submit"]');
    
    // 验证保存成功 - 等待页面跳转或成功消息
    await Promise.race([
      expect(page).toHaveURL(/.*\/templates$/),
      expect(page.locator('text=创建成功')).toBeVisible(),
      expect(page.locator('text=保存成功')).toBeVisible()
    ]);
    
    // 验证模板在列表中显示
    await page.goto('/templates');
    await expect(page.locator(`text=${templateName}`)).toBeVisible({ timeout: 10000 });
    
    console.log('✅ 模板创建和保存正常');
  });

  // Bug-010-5: 模板集API测试
  test('任务创建页面模板集数据正确获取', async ({ page }) => {
    console.log('🧪 测试: 任务创建页面模板集API...');
    
    // 监听API请求
    let templateSetsApiCalled = false;
    page.on('response', response => {
      if (response.url().includes('/api/templates/sets') || response.url().includes('/api/template-sets')) {
        templateSetsApiCalled = true;
        console.log('📡 模板集API调用:', response.url(), '状态:', response.status());
      }
    });
    
    await page.goto('/tasks');
    await page.click('text=创建任务');
    
    // 等待页面加载完成
    await page.waitForLoadState('networkidle');
    
    // 验证模板选择器存在
    const templateSelector = await page.locator('select[name="templateId"], .template-selector').count();
    expect(templateSelector).toBeGreaterThan(0);
    
    // 验证API被调用
    expect(templateSetsApiCalled).toBe(true);
    
    console.log('✅ 模板集API调用正常');
  });

  // Bug-010-6: 端到端邮件发送测试
  test('完整邮件发送流程测试', async ({ page }) => {
    console.log('🧪 测试: 完整邮件发送流程...');
    
    // 1. 创建测试标签
    await page.goto('/tags');
    await page.click('text=创建标签');
    
    const tagName = `E2E测试标签-${Date.now()}`;
    await page.fill('input[name="name"]', tagName);
    await page.click('button[type="submit"]');
    
    // 2. 创建测试联系人
    await page.goto('/contacts');
    await page.click('text=创建联系人');
    
    const contactName = `E2E测试联系人-${Date.now()}`;
    await page.fill('input[name="name"]', contactName);
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.click('button[type="submit"]');
    
    // 3. 创建邮件模板
    await page.goto('/templates');
    await page.click('text=创建模板');
    
    const templateName = `E2E测试模板-${Date.now()}`;
    await page.fill('input[name="name"]', templateName);
    await page.fill('input[name="subject"]', 'E2E测试邮件');
    
    // 填写邮件内容
    try {
      await page.waitForSelector('.ql-editor', { timeout: 5000 });
      await page.click('.ql-editor');
      await page.type('.ql-editor', 'E2E测试邮件内容，发送时间：' + new Date().toLocaleString());
    } catch (error) {
      await page.fill('textarea[name="content"]', 'E2E测试邮件内容，发送时间：' + new Date().toLocaleString());
    }
    
    await page.click('button[type="submit"]');
    
    // 4. 创建邮件任务
    await page.goto('/tasks');
    await page.click('text=创建任务');
    
    const taskName = `E2E测试任务-${Date.now()}`;
    await page.fill('input[name="name"]', taskName);
    
    // 选择模板 - 尝试多种选择方式
    try {
      await page.selectOption('select[name="templateId"]', { label: templateName });
    } catch (error) {
      // 如果select不可用，尝试点击方式
      await page.click(`text=${templateName}`);
    }
    
    // 选择联系人
    await page.click(`text=${contactName}`);
    
    await page.click('button[type="submit"]');
    
    // 5. 发送邮件
    await page.click('button:has-text("发送")');
    
    // 验证发送状态
    await expect(page.locator('text=发送成功')).toBeVisible({ timeout: 30000 });
    
    console.log('✅ 完整邮件发送流程正常');
  });

  // 综合业务流程测试
  test('完整用户业务流程测试', async ({ page }) => {
    console.log('🧪 测试: 完整业务流程...');
    
    const timestamp = Date.now();
    
    // 1. 标签管理
    await page.goto('/tags');
    await page.click('text=创建标签');
    await page.fill('input[name="name"]', `业务流程标签-${timestamp}`);
    await page.click('button[type="submit"]');
    
    // 2. 联系人管理
    await page.goto('/contacts');
    await page.click('text=创建联系人');
    await page.fill('input[name="name"]', `业务流程联系人-${timestamp}`);
    await page.fill('input[name="email"]', `business-flow-${timestamp}@example.com`);
    await page.fill('input[name="company"]', '测试公司');
    await page.click('button[type="submit"]');
    
    // 验证联系人创建后列表显示
    await expect(page.locator(`text=业务流程联系人-${timestamp}`)).toBeVisible();
    
    // 编辑联系人验证
    await page.click(`button:has-text("编辑"):near(:text("业务流程联系人-${timestamp}"))`);
    await expect(page.locator('input[name="name"]')).toHaveValue(`业务流程联系人-${timestamp}`);
    await page.click('button:has-text("取消")');
    
    // 3. 模板管理
    await page.goto('/templates');
    await page.click('text=创建模板');
    await page.fill('input[name="name"]', `业务流程模板-${timestamp}`);
    await page.fill('input[name="subject"]', '业务流程测试邮件');
    
    // 富文本编辑器内容
    try {
      await page.waitForSelector('.ql-editor', { timeout: 5000 });
      await page.click('.ql-editor');
      await page.type('.ql-editor', '业务流程测试内容');
    } catch (error) {
      await page.fill('textarea[name="content"]', '业务流程测试内容');
    }
    
    await page.click('button[type="submit"]');
    
    // 4. 任务管理
    await page.goto('/tasks');
    await page.click('text=创建任务');
    await page.fill('input[name="name"]', `业务流程任务-${timestamp}`);
    
    // 验证模板集可用性
    const hasTemplateSelector = await page.locator('select[name="templateId"], .template-selector').count() > 0;
    expect(hasTemplateSelector).toBe(true);
    
    console.log('✅ 完整业务流程正常');
  });
}); 