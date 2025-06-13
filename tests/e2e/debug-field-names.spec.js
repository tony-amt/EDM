const { test, expect } = require('@playwright/test');

test.describe('调试字段名称问题', () => {
  test('检查前端发送的实际字段名', async ({ page }) => {
    console.log('🔍 开始调试字段名称...');
    
    // 监听所有网络请求
    const requests = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/auth/login') && request.method() === 'POST') {
        const postData = request.postData();
        console.log('🔍 捕获到登录请求:');
        console.log('URL:', request.url());
        console.log('Method:', request.method());
        console.log('Post Data:', postData);
        try {
          const jsonData = JSON.parse(postData);
          console.log('解析后的JSON:', JSON.stringify(jsonData, null, 2));
          requests.push(jsonData);
        } catch (e) {
          console.log('无法解析POST数据为JSON');
        }
      }
    });
    
    // 访问登录页面
    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // 情况1: 正常输入
    console.log('\n📍 测试情况1: 正常输入');
    const usernameInput = page.locator('input[placeholder*="用户名"], input[placeholder*="邮箱"]').first();
    const passwordInput = page.locator('input[placeholder*="密码"]').first();
    const loginButton = page.locator('button:has-text("登录")').first();
    
    await usernameInput.fill('admin@example.com');
    await passwordInput.fill('admin123456');
    await loginButton.click();
    await page.waitForTimeout(3000);
    
    // 情况2: 清空并重新填写
    console.log('\n📍 测试情况2: 清空重填');
    await page.goto('http://localhost:3001/login');
    await page.waitForTimeout(2000);
    
    await usernameInput.clear();
    await passwordInput.clear();
    await usernameInput.fill('admin@example.com');
    await passwordInput.fill('admin123456');
    await loginButton.click();
    await page.waitForTimeout(3000);
    
    // 情况3: 检查form提交事件
    console.log('\n📍 测试情况3: 直接检查表单数据');
    await page.goto('http://localhost:3001/login');
    await page.waitForTimeout(2000);
    
    // 注入脚本来监听表单提交
    await page.addInitScript(() => {
      window.originalFetch = window.fetch;
      window.fetch = function(...args) {
        if (args[0].includes('/api/auth/login')) {
          console.log('Fetch intercepted:', args);
          if (args[1] && args[1].body) {
            console.log('Fetch body:', args[1].body);
          }
        }
        return window.originalFetch.apply(this, args);
      };
    });
    
    await usernameInput.fill('admin@example.com');
    await passwordInput.fill('admin123456');
    
    // 检查表单数据
    const formData = await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form) {
        const formData = new FormData(form);
        const result = {};
        for (let [key, value] of formData.entries()) {
          result[key] = value;
        }
        return result;
      }
      return null;
    });
    
    console.log('表单数据:', formData);
    
    await loginButton.click();
    await page.waitForTimeout(3000);
    
    console.log('\n📊 所有捕获的请求:', requests);
  });
}); 