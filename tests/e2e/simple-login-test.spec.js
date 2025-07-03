import { test, expect } from '@playwright/test';

test('简化登录测试', async ({ page }) => {
  console.log('🧪 开始简化登录测试...');
  
  // 监听网络请求
  let loginRequest = null;
  let loginResponse = null;
  
  page.on('request', request => {
    if (request.url().includes('/auth/login')) {
      loginRequest = request;
      console.log('📤 登录请求:', request.method(), request.url());
      console.log('📤 请求数据:', request.postData());
    }
  });
  
  page.on('response', response => {
    if (response.url().includes('/auth/login')) {
      loginResponse = response;
      console.log('📥 登录响应:', response.status(), response.url());
    }
  });
  
  try {
    // 访问前端
    await page.goto('/', { timeout: 30000 });
    await page.waitForLoadState('networkidle');
    
    // 等待登录表单
    await page.waitForSelector('input[placeholder*="用户名"]');
    
    // 填写表单
    await page.fill('input[placeholder*="用户名"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'admin123456');
    
    console.log('✅ 表单填写完成');
    
    // 点击登录按钮
    await page.click('button[type="submit"]');
    
    // 等待一下看是否有请求
    await page.waitForTimeout(5000);
    
    if (loginRequest) {
      console.log('✅ 成功捕获登录请求!');
      if (loginResponse) {
        const body = await loginResponse.json();
        console.log('📄 响应:', JSON.stringify(body, null, 2));
        
        if (body.success) {
          console.log('🎉 登录API调用成功!');
        } else {
          console.log('❌ 登录API返回失败:', body.message);
        }
      }
    } else {
      console.log('❌ 未捕获到登录请求');
      
      // 检查页面是否有错误
      const errors = await page.locator('.ant-message-error, [class*="error"]').count();
      if (errors > 0) {
        console.log('🔍 页面显示错误信息');
      }
      
      // 检查当前URL
      console.log('📍 当前URL:', page.url());
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}); 