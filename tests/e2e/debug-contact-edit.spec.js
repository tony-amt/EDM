const { test, expect } = require('@playwright/test');

test.describe('调试联系人编辑页面', () => {
  test('检查编辑页面内容', async ({ page }) => {
    console.log('🔍 开始调试联系人编辑页面...');
    
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
    
    // 导航到联系人列表
    await page.click('a[href="/contacts"]');
    await page.waitForLoadState('networkidle');
    
    // 等待联系人列表加载
    await page.waitForSelector('.ant-table-tbody tr', { timeout: 10000 });
    
    // 获取第一个联系人的ID
    const firstRow = page.locator('.ant-table-tbody tr').first();
    const emailCell = firstRow.locator('td').first();
    const email = await emailCell.textContent();
    console.log('第一个联系人邮箱:', email);
    
    // 点击编辑按钮
    const editButton = firstRow.locator('button').nth(1);
    await editButton.click();
    
    // 等待页面加载
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    
    // 获取当前URL
    const currentUrl = page.url();
    console.log('当前URL:', currentUrl);
    
    // 获取页面内容
    const pageContent = await page.textContent('body');
    console.log('页面内容长度:', pageContent.length);
    console.log('页面内容前500字符:', pageContent.substring(0, 500));
    
    // 检查是否有错误信息
    const hasError = pageContent.includes('错误') || pageContent.includes('失败') || pageContent.includes('不存在');
    console.log('是否有错误信息:', hasError);
    
    // 检查是否有加载中
    const hasLoading = pageContent.includes('加载中') || pageContent.includes('Loading');
    console.log('是否有加载中:', hasLoading);
    
    // 检查表单元素
    const formCount = await page.locator('form').count();
    console.log('表单数量:', formCount);
    
    const inputCount = await page.locator('input').count();
    console.log('输入框数量:', inputCount);
    
    const buttonCount = await page.locator('button').count();
    console.log('按钮数量:', buttonCount);
    
    // 截图
    await page.screenshot({ path: 'debug-contact-edit.png' });
    console.log('已保存截图: debug-contact-edit.png');
  });
}); 