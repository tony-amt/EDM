import { test, expect } from '@playwright/test';

test.describe('调试各页面结构', () => {
  
  test.beforeEach(async ({ page }) => {
    // 先登录
    await page.goto('/login');
    await page.fill('#username', 'admin@example.com');
    await page.fill('#password', 'admin123456');
    await page.click('#loginButton');
    await page.waitForURL(/dashboard|contacts|templates|tasks|\//, { timeout: 15000 });
  });

  test('调试联系人页面', async ({ page }) => {
    console.log('🔍 调试联系人页面...');
    
    await page.goto('/contacts');
    await page.waitForLoadState('networkidle');
    
    // 截图
    await page.screenshot({ path: 'debug-contacts-page.png', fullPage: true });
    
    // 查找所有按钮
    const buttons = await page.locator('button').all();
    console.log('找到的按钮数量:', buttons.length);
    
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];
      const text = await button.textContent();
      const type = await button.getAttribute('type');
      const className = await button.getAttribute('class');
      console.log(`Button ${i}:`, { text: text?.trim(), type, className });
    }
    
    // 查找链接和其他可点击元素
    const links = await page.locator('a').all();
    console.log('找到的链接数量:', links.length);
    
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const text = await link.textContent();
      const href = await link.getAttribute('href');
      console.log(`Link ${i}:`, { text: text?.trim(), href });
    }
  });

  test('调试模板页面', async ({ page }) => {
    console.log('🔍 调试模板页面...');
    
    await page.goto('/templates');
    await page.waitForLoadState('networkidle');
    
    // 截图
    await page.screenshot({ path: 'debug-templates-page.png', fullPage: true });
    
    // 查找所有按钮
    const buttons = await page.locator('button').all();
    console.log('找到的按钮数量:', buttons.length);
    
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];
      const text = await button.textContent();
      const type = await button.getAttribute('type');
      const className = await button.getAttribute('class');
      console.log(`Button ${i}:`, { text: text?.trim(), type, className });
    }
    
    // 查找链接和其他可点击元素
    const links = await page.locator('a').all();
    console.log('找到的链接数量:', links.length);
    
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const text = await link.textContent();
      const href = await link.getAttribute('href');
      console.log(`Link ${i}:`, { text: text?.trim(), href });
    }
  });
}); 