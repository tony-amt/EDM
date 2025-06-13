import { test, expect } from '@playwright/test';

test.describe('调试登录页面', () => {
  test('检查登录页面元素', async ({ page }) => {
    console.log('🔍 开始调试登录页面...');
    
    // 访问登录页面
    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');
    
    // 等待页面完全加载
    await page.waitForTimeout(3000);
    
    // 获取页面标题
    const title = await page.title();
    console.log('页面标题:', title);
    
    // 获取页面内容
    const content = await page.content();
    console.log('页面内容长度:', content.length);
    
    // 检查是否有登录相关元素
    const hasLoginCard = await page.locator('text=EDM系统登录').isVisible();
    console.log('是否有登录卡片:', hasLoginCard);
    
    const hasUsernameInput = await page.locator('input[placeholder*="用户名"]').isVisible();
    console.log('是否有用户名输入框:', hasUsernameInput);
    
    const hasPasswordInput = await page.locator('input[placeholder*="密码"]').isVisible();
    console.log('是否有密码输入框:', hasPasswordInput);
    
    const hasLoginButton = await page.locator('button:has-text("登录")').isVisible();
    console.log('是否有登录按钮:', hasLoginButton);
    
    // 截图保存
    await page.screenshot({ path: 'debug-login-page.png' });
    console.log('已保存截图: debug-login-page.png');
    
    // 如果找不到登录按钮，尝试其他选择器
    if (!hasLoginButton) {
      const allButtons = await page.locator('button').count();
      console.log('页面上的按钮数量:', allButtons);
      
      for (let i = 0; i < allButtons; i++) {
        const buttonText = await page.locator('button').nth(i).textContent();
        console.log(`按钮 ${i}: "${buttonText}"`);
      }
    }
  });
});

test('调试登录过程', async ({ page }) => {
  console.log('🔍 调试登录过程...');
  
  // 监听控制台消息
  page.on('console', msg => console.log('浏览器控制台:', msg.text()));
  
  // 监听网络请求
  page.on('request', request => {
    if (request.url().includes('/api/auth/login')) {
      console.log('登录请求:', request.url(), request.postData());
    }
  });
  
  page.on('response', response => {
    if (response.url().includes('/api/auth/login')) {
      console.log('登录响应:', response.status(), response.url());
    }
  });
  
  // 访问登录页面
  await page.goto('/');
  
  // 等待页面加载
  await page.waitForLoadState('networkidle');
  
  console.log('当前URL:', page.url());
  
  // 填写登录信息
  await page.fill('#username', 'admin@example.com');
  await page.fill('#password', 'admin123456');
  
  console.log('填写完成，准备点击登录按钮...');
  
  // 点击登录
  await page.click('#loginButton');
  
  // 等待一段时间看看发生了什么
  await page.waitForTimeout(5000);
  
  console.log('登录后URL:', page.url());
  
  // 检查localStorage
  const token = await page.evaluate(() => localStorage.getItem('token'));
  const user = await page.evaluate(() => localStorage.getItem('user'));
  
  console.log('Token:', token ? '已设置' : '未设置');
  console.log('User:', user ? '已设置' : '未设置');
  
  // 截图
  await page.screenshot({ path: 'debug-after-login.png', fullPage: true });
}); 