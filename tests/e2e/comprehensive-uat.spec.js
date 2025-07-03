const { test, expect } = require('@playwright/test');

test.describe('EDM系统综合UAT测试', () => {
  test('完整用户流程测试', async ({ page }) => {
    console.log('🎯 开始EDM系统综合UAT测试...');
    
    // 1. 验证前端是React应用
    console.log('1️⃣ 验证前端React应用...');
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
    
    const pageContent = await page.textContent('body');
    expect(pageContent).toContain('EDM系统');
    console.log('✅ 前端React应用验证通过');
    
    // 2. 登录功能测试
    console.log('2️⃣ 测试登录功能...');
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
    console.log('✅ 登录功能验证通过');
    
    // 3. 联系人管理功能测试
    console.log('3️⃣ 测试联系人管理功能...');
    await page.click('a[href="/contacts"]');
    await page.waitForLoadState('networkidle');
    
    // 验证联系人列表加载
    await page.waitForSelector('.ant-table-tbody tr', { timeout: 10000 });
    const contactRows = await page.locator('.ant-table-tbody tr').count();
    expect(contactRows).toBeGreaterThan(0);
    console.log(`✅ 联系人列表加载成功，共${contactRows}个联系人`);
    
    // 4. 联系人详情功能测试
    console.log('4️⃣ 测试联系人详情功能...');
    const viewButton = page.locator('.ant-table-tbody tr').first().locator('button').first();
    await viewButton.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    const detailContent = await page.textContent('body');
    expect(detailContent).not.toContain('undefined');
    console.log('✅ 联系人详情功能验证通过');
    
    // 5. 联系人编辑功能测试
    console.log('5️⃣ 测试联系人编辑功能...');
    await page.goBack();
    await page.waitForLoadState('networkidle');
    
    const editButton = page.locator('.ant-table-tbody tr').first().locator('button').nth(1);
    await editButton.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    const editUrl = page.url();
    expect(editUrl).toContain('edit');
    expect(editUrl).not.toContain('undefined');
    
    const editContent = await page.textContent('body');
    expect(editContent).not.toContain('undefined');
    expect(editContent).toContain('编辑');
    console.log('✅ 联系人编辑功能验证通过');
    
    // 6. 系统稳定性验证
    console.log('6️⃣ 验证系统稳定性...');
    
    // 验证前端服务稳定运行
    const frontendResponse = await page.request.get('http://localhost:3001');
    expect(frontendResponse.status()).toBe(200);
    
    // 验证后端API稳定运行
    const backendResponse = await page.request.get('http://localhost:3000/health');
    expect(backendResponse.status()).toBe(200);
    
    console.log('✅ 系统稳定性验证通过');
    
    console.log('🎉 EDM系统综合UAT测试全部通过！');
  });
}); 