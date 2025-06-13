const { test, expect } = require('@playwright/test');

test.describe('完整手动验证测试', () => {
  test('完整的用户体验验证', async ({ page }) => {
    console.log('🔍 开始完整验证测试...');
    
    // 访问登录页面
    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    console.log('📍 步骤1: 检查登录页面');
    await page.screenshot({ path: 'test-results/step1-login-page.png' });
    
    // 检查页面元素
    const usernameInput = page.locator('input[placeholder*="用户名"], input[placeholder*="邮箱"]').first();
    const passwordInput = page.locator('input[placeholder*="密码"]').first();
    const loginButton = page.locator('button:has-text("登录"), .ant-btn-primary').first();
    
    await expect(usernameInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(loginButton).toBeVisible();
    
    console.log('✅ 登录页面元素正常');
    
    // 填写登录信息
    console.log('📍 步骤2: 填写登录信息');
    await usernameInput.fill('admin@example.com');
    await passwordInput.fill('admin123456');
    await page.screenshot({ path: 'test-results/step2-filled-form.png' });
    
    // 监听登录请求和响应
    let loginResponse = null;
    page.on('response', async (response) => {
      if (response.url().includes('/api/auth/login') && response.request().method() === 'POST') {
        loginResponse = response;
        const responseBody = await response.text();
        console.log('登录响应状态:', response.status());
        console.log('登录响应体:', responseBody);
      }
    });
    
    // 点击登录
    console.log('📍 步骤3: 提交登录');
    await loginButton.click();
    
    // 等待响应
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'test-results/step3-after-login.png' });
    
    // 检查是否有错误消息
    const errorMessages = await page.locator('.ant-message-error, .error, [class*="error"]').allTextContents();
    if (errorMessages.length > 0) {
      console.log('❌ 发现错误消息:', errorMessages);
    }
    
    // 检查当前URL
    const currentUrl = page.url();
    console.log('当前页面URL:', currentUrl);
    
    // 检查是否成功跳转到主页面
    if (currentUrl.includes('/login')) {
      console.log('❌ 登录后仍在登录页面，可能登录失败');
      
      // 检查表单validation错误
      const formErrors = await page.locator('.ant-form-item-explain-error, .ant-form-item-has-error').allTextContents();
      if (formErrors.length > 0) {
        console.log('表单验证错误:', formErrors);
      }
    } else {
      console.log('✅ 登录后成功跳转');
    }
    
    // 等待更长时间观察页面状态
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/step4-final-state.png' });
    
    console.log('📍 步骤4: 检查最终状态');
    const finalUrl = page.url();
    console.log('最终页面URL:', finalUrl);
    
    // 检查是否有任何JavaScript错误
    const jsErrors = [];
    page.on('pageerror', error => {
      jsErrors.push(error.message);
    });
    
    if (jsErrors.length > 0) {
      console.log('❌ JavaScript错误:', jsErrors);
    }
    
    console.log('🔍 完整验证测试完成');
  });
}); 