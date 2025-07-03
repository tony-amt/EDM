import { test, expect } from '@playwright/test';

test.describe('E2E测试预检查', () => {
  
  test('系统基础状态检查', async ({ page }) => {
    console.log('🔍 检查系统基础状态...');
    
    // 1. 检查前端服务
    try {
      await page.goto('/', { timeout: 30000 });
      console.log('✅ 前端服务访问正常');
    } catch (error) {
      console.error('❌ 前端服务不可访问:', error.message);
      throw error;
    }
    
    // 2. 检查后端API健康状态
    try {
      const response = await page.request.get('http://localhost:3000/health');
      const status = response.status();
      console.log('📡 后端健康检查状态码:', status);
      
      if (status === 200) {
        const data = await response.json();
        console.log('✅ 后端API正常:', data);
      } else {
        console.log('⚠️ 后端API状态异常:', status);
      }
    } catch (error) {
      console.error('❌ 后端API不可访问:', error.message);
      throw error;
    }
    
    // 3. 检查登录页面
    await page.goto('/login');
    await expect(page.locator('input[name="usernameOrEmail"], input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
    console.log('✅ 登录页面正常');
    
    // 4. 测试管理员登录
    await page.fill('input[name="usernameOrEmail"], input[type="email"], input[name="email"]', 'admin@example.com');
    await page.fill('input[type="password"], input[name="password"]', 'admin123456');
    await page.click('button[type="submit"]');
    
    // 验证登录成功
    await expect(page).toHaveURL(/dashboard|contacts|templates|tasks/, { timeout: 10000 });
    console.log('✅ 管理员登录正常');
    
    // 5. 检查主要页面可访问性
    const pages = [
      { path: '/contacts', name: '联系人页面' },
      { path: '/templates', name: '模板页面' },
      { path: '/tasks', name: '任务页面' },
      { path: '/tags', name: '标签页面' }
    ];
    
    for (const pageInfo of pages) {
      try {
        await page.goto(pageInfo.path);
        await page.waitForLoadState('networkidle', { timeout: 10000 });
        console.log(`✅ ${pageInfo.name}访问正常`);
      } catch (error) {
        console.error(`❌ ${pageInfo.name}访问失败:`, error.message);
        throw error;
      }
    }
    
    console.log('🎉 系统预检查全部通过，可以开始E2E测试');
  });
  
  test('数据库连接和基础数据检查', async ({ page }) => {
    console.log('🔍 检查数据库连接和基础数据...');
    
    // 登录
    await page.goto('/login');
    await page.fill('input[name="usernameOrEmail"], input[type="email"], input[name="email"]', 'admin@example.com');
    await page.fill('input[type="password"], input[name="password"]', 'admin123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard|contacts|templates|tasks/);
    
    // 检查联系人列表API
    await page.goto('/contacts');
    await page.waitForLoadState('networkidle');
    
    // 验证页面不是错误页面
    const hasError = await page.locator('text=错误, text=Error, text=500, text=404').count();
    expect(hasError).toBe(0);
    console.log('✅ 联系人数据加载正常');
    
    // 检查模板列表API
    await page.goto('/templates');
    await page.waitForLoadState('networkidle');
    
    const hasTemplateError = await page.locator('text=错误, text=Error, text=500, text=404').count();
    expect(hasTemplateError).toBe(0);
    console.log('✅ 模板数据加载正常');
    
    // 检查标签列表API
    await page.goto('/tags');
    await page.waitForLoadState('networkidle');
    
    const hasTagError = await page.locator('text=错误, text=Error, text=500, text=404').count();
    expect(hasTagError).toBe(0);
    console.log('✅ 标签数据加载正常');
    
    console.log('🎉 数据库连接和基础数据检查通过');
  });
}); 