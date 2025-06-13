const { test, expect } = require('@playwright/test');

test.describe('联系人详情页面测试', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="用户名"]', 'admin@example.com');
    await page.fill('input[placeholder*="密码"]', 'admin123456');
    
    const loginResponse = page.waitForResponse(response => 
      response.url().includes('/api/auth/login') && response.status() === 200
    );
    
    // 修复：使用更宽松的选择器匹配登录按钮
    await page.click('button[type="submit"]');
    await loginResponse;
    
    await page.waitForURL('http://localhost:3001/');
  });
  
  test('验证联系人详情页面不显示undefined', async ({ page }) => {
    console.log('🔍 开始联系人详情页面测试...');
    
    // 导航到联系人列表 - 使用Link导航
    await page.click('a[href="/contacts"]');
    await page.waitForLoadState('networkidle');
    
    // 等待联系人列表加载
    await page.waitForSelector('.ant-table-tbody tr', { timeout: 10000 });
    
    // 点击第一个联系人的查看按钮（眼睛图标）
    const viewButton = page.locator('.ant-table-tbody tr').first().locator('button').first();
    await viewButton.click();
    
    // 等待详情页面加载
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // 检查页面内容不包含 undefined
    const pageContent = await page.textContent('body');
    
    // 验证不包含 undefined 文本
    expect(pageContent).not.toContain('undefined');
    
    // 验证页面包含联系人相关信息（更宽松的验证）
    const hasContactContent = pageContent.includes('联系人') || pageContent.includes('邮箱') || pageContent.includes('用户名');
    expect(hasContactContent).toBe(true);
    
    console.log('✅ 联系人详情页面测试通过！');
  });
  
  test('验证联系人编辑功能', async ({ page }) => {
    console.log('🔍 开始联系人编辑功能测试...');
    
    // 导航到联系人列表 - 使用Link导航
    await page.click('a[href="/contacts"]');
    await page.waitForLoadState('networkidle');
    
    // 等待联系人列表加载
    await page.waitForSelector('.ant-table-tbody tr', { timeout: 10000 });
    
    // 点击第一个联系人的编辑按钮（第二个按钮，编辑图标）
    const editButton = page.locator('.ant-table-tbody tr').first().locator('button').nth(1);
    await editButton.click();
    
    // 等待编辑页面加载
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // 检查页面URL是否包含edit
    const currentUrl = page.url();
    expect(currentUrl).toContain('edit');
    
    // 验证页面不包含undefined
    const pageContent = await page.textContent('body');
    expect(pageContent).not.toContain('undefined');
    
    // 验证页面包含编辑相关内容
    const hasEditContent = pageContent.includes('编辑') || pageContent.includes('保存') || pageContent.includes('取消');
    expect(hasEditContent).toBe(true);
    
    console.log('✅ 联系人编辑功能测试通过！');
  });
}); 