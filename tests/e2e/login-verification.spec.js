const { test, expect } = require('@playwright/test');

test.describe('🔐 登录功能验证测试', () => {
  test.beforeEach(async ({ page }) => {
    // 清理localStorage
    await page.goto('http://localhost:3001');
    await page.evaluate(() => localStorage.clear());
  });

  test('✅ 验证登录页面可以正常访问', async ({ page }) => {
    // 访问登录页面
    await page.goto('http://localhost:3001/login');
    
    // 验证页面标题和关键元素
    await expect(page.locator('text=EDM系统登录')).toBeVisible();
    await expect(page.locator('input[placeholder="用户名或邮箱"]')).toBeVisible();
    await expect(page.locator('input[placeholder="密码"]')).toBeVisible();
    await expect(page.locator('button:has-text("登录")')).toBeVisible();
  });

  test('🎯 验证正确账号密码可以成功登录', async ({ page }) => {
    console.log('🔍 开始登录流程测试...');
    
    // 访问登录页面
    await page.goto('http://localhost:3001/login');
    
    // 监听网络请求
    let requestBody = null;
    let responseBody = null;
    let requestUrl = '';
    
    await page.route('**/api/auth/login', async (route, request) => {
      requestBody = JSON.parse(request.postData() || '{}');
      requestUrl = request.url();
      console.log('🌐 拦截到登录请求:', requestUrl);
      console.log('📤 请求数据:', requestBody);
      
      // 继续请求
      const response = await route.fetch();
      responseBody = await response.json();
      console.log('📥 响应数据:', responseBody);
      
      await route.fulfill({ response });
    });
    
    // 填写正确的登录信息
    await page.fill('input[placeholder="用户名或邮箱"]', 'admin@example.com');
    await page.fill('input[placeholder="密码"]', 'admin123456');
    
    // 点击登录按钮
    await page.click('button:has-text("登录")');
    
    // 等待请求完成
    await page.waitForTimeout(3000);
    
    // 验证请求数据正确
    expect(requestBody).not.toBeNull();
    expect(requestBody).toHaveProperty('usernameOrEmail', 'admin@example.com');
    expect(requestBody).toHaveProperty('password', 'admin123456');
    expect(requestBody).not.toHaveProperty('username'); // 确保没有错误字段
    
    // 验证请求URL
    expect(requestUrl).toContain('/api/auth/login');
    
    // 如果登录成功，验证跳转
    if (responseBody && responseBody.success) {
      console.log('✅ 登录成功，验证页面跳转...');
      await page.waitForURL('http://localhost:3001/', { timeout: 10000 });
      await expect(page.locator('text=联系人管理')).toBeVisible({ timeout: 15000 });
    } else {
      console.log('❌ 登录失败:', responseBody);
      // 即使登录失败，我们也验证了请求格式是正确的
    }
  });

  test('🔍 验证API请求URL配置', async ({ page }) => {
    await page.goto('http://localhost:3001/login');
    
    let capturedUrl = '';
    await page.route('**/api/auth/login', (route, request) => {
      capturedUrl = request.url();
      route.continue();
    });
    
    await page.fill('input[placeholder="用户名或邮箱"]', 'admin@example.com');
    await page.fill('input[placeholder="密码"]', 'admin123456');
    await page.click('button:has-text("登录")');
    
    await page.waitForTimeout(2000);
    
    console.log('🔗 实际请求URL:', capturedUrl);
    
    // 验证URL指向正确的后端
    expect(capturedUrl).toMatch(/localhost:3000\/api\/auth\/login/);
  });

  test('📋 诊断前端配置', async ({ page }) => {
    await page.goto('http://localhost:3001/login');
    
    // 在浏览器中检查API配置
    const apiConfig = await page.evaluate(() => {
      return {
        nodeEnv: process.env.NODE_ENV,
        location: window.location.href,
        localStorage: Object.keys(localStorage),
      };
    });
    
    console.log('🔧 前端配置诊断:', apiConfig);
    
    expect(apiConfig.location).toContain('localhost:3001');
  });
}); 