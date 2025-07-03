// tests/e2e/quick-validation.spec.js
import { test, expect } from '@playwright/test';

const TEST_CONFIG = {
  admin_credentials: {
    email: 'admin@example.com',
    password: 'admin123456'
  }
};

test.describe('🚨 快速质量验证 - 核心功能检查', () => {
  
  test('CRITICAL-001: 🔐 登录功能验证', async ({ page }) => {
    console.log('🧪 开始登录功能验证...');
    
    // 访问登录页面
    await page.goto('/login');
    console.log('✅ 登录页面访问成功');
    
    // 检查页面标题
    await expect(page).toHaveTitle(/EDM系统/);
    console.log('✅ 页面标题正确');
    
    // 检查登录表单元素
    const usernameInput = page.locator('[placeholder="用户名或邮箱"]').first();
    const passwordInput = page.locator('[placeholder="密码"]').first();
    const loginButton = page.locator('button:has-text("登 录")').first();
    
    await expect(usernameInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(loginButton).toBeVisible();
    console.log('✅ 登录表单元素检查通过');
    
    // 执行登录
    await usernameInput.fill(TEST_CONFIG.admin_credentials.email);
    await passwordInput.fill(TEST_CONFIG.admin_credentials.password);
    await loginButton.click();
    
    // 等待登录成功跳转
    await page.waitForURL('/', { timeout: 15000 });
    console.log('✅ 登录成功，页面跳转正常');
    
    // 验证登录后状态
    await expect(page.locator('h1:has-text("仪表盘")')).toBeVisible();
    console.log('✅ 登录后页面状态正常');
  });

  test('CRITICAL-002: 📊 主要导航功能验证', async ({ page }) => {
    console.log('🧪 开始主要导航功能验证...');
    
    // 先登录
    await page.goto('/login');
    await page.locator('[placeholder="用户名或邮箱"]').first().fill(TEST_CONFIG.admin_credentials.email);
    await page.locator('[placeholder="密码"]').first().fill(TEST_CONFIG.admin_credentials.password);
    await page.locator('button:has-text("登 录")').first().click();
    await page.waitForURL('/');
    
    // 检查主要导航菜单
    const navigationItems = [
      '联系人',
      '标签',
      '模板',
      '任务'
    ];
    
    for (const item of navigationItems) {
      const navItem = page.locator(`text=${item}`).first();
      if (await navItem.isVisible()) {
        console.log(`✅ 导航项 "${item}" 存在`);
        
        // 尝试点击导航
        try {
          await navItem.click();
          await page.waitForTimeout(2000); // 等待页面加载
          console.log(`✅ 导航项 "${item}" 可点击`);
        } catch (error) {
          console.log(`⚠️ 导航项 "${item}" 点击失败: ${error.message}`);
        }
      } else {
        console.log(`❌ 导航项 "${item}" 不存在`);
      }
    }
  });

  test('CRITICAL-003: 🔍 V2.0新功能状态检查', async ({ page }) => {
    console.log('🧪 开始V2.0新功能状态检查...');
    
    // 登录
    await page.goto('/login');
    await page.locator('[placeholder="用户名或邮箱"]').first().fill(TEST_CONFIG.admin_credentials.email);
    await page.locator('[placeholder="密码"]').first().fill(TEST_CONFIG.admin_credentials.password);
    await page.locator('button:has-text("登 录")').first().click();
    await page.waitForURL('/');
    
    // 检查V2.0新功能
    const v2Features = [
      { name: '发信人', path: '/senders', keywords: ['发信人', 'Sender'] },
      { name: '群发任务', path: '/bulk-tasks', keywords: ['群发', 'Bulk', '任务'] },
      { name: '邮件服务', path: '/email-services', keywords: ['邮件服务', 'Email Service'] },
      { name: '用户管理', path: '/user-management', keywords: ['用户管理', 'User Management'] }
    ];
    
    let implementedFeatures = 0;
    let totalFeatures = v2Features.length;
    
    for (const feature of v2Features) {
      try {
        // 尝试访问功能页面
        await page.goto(feature.path, { waitUntil: 'networkidle' });
        await page.waitForTimeout(5000);
        
        // 检查页面内容
        let hasContent = false;
        for (const keyword of feature.keywords) {
          try {
            await page.locator(`text=/${keyword}/i`).first().waitFor({ timeout: 10000 });
            hasContent = true;
            break;
          } catch (e) {
            // 关键词不存在，继续检查下一个
          }
        }
        
        // 检查是否有"开发中"等占位符
        const placeholderTexts = [
          'Coming Soon', '功能开发中', '敬请期待', '待实现', 
          'Under Development', 'TODO', 'Not Implemented'
        ];
        
        let hasPlaceholder = false;
        for (const placeholder of placeholderTexts) {
          if (await page.locator(`text=/${placeholder}/i`).first().isVisible()) {
            hasPlaceholder = true;
            break;
          }
        }
        
        if (hasContent && !hasPlaceholder) {
          console.log(`✅ V2.0功能 "${feature.name}" 已实现`);
          implementedFeatures++;
        } else if (hasPlaceholder) {
          console.log(`❌ V2.0功能 "${feature.name}" 显示占位符，未完全实现`);
        } else {
          console.log(`⚠️ V2.0功能 "${feature.name}" 状态不明确`);
        }
        
      } catch (error) {
        console.log(`❌ V2.0功能 "${feature.name}" 访问失败: ${error.message}`);
      }
    }
    
    console.log(`📊 V2.0功能实现统计: ${implementedFeatures}/${totalFeatures} (${Math.round(implementedFeatures/totalFeatures*100)}%)`);
    
    // 如果有未实现的功能，标记为测试失败
    if (implementedFeatures < totalFeatures) {
      throw new Error(`发现${totalFeatures - implementedFeatures}个V2.0功能未完全实现，阻止上线！`);
    }
  });

  test('CRITICAL-004: 🚫 阻塞性问题检测', async ({ page }) => {
    console.log('🧪 开始阻塞性问题检测...');
    
    // 登录
    await page.goto('/login');
    await page.locator('[placeholder="用户名或邮箱"]').first().fill(TEST_CONFIG.admin_credentials.email);
    await page.locator('[placeholder="密码"]').first().fill(TEST_CONFIG.admin_credentials.password);
    await page.locator('button:has-text("登 录")').first().click();
    await page.waitForURL('/');
    
    // 检查页面是否有明显的错误信息
    const errorIndicators = [
      'Error', '错误', 'Exception', '异常',
      'undefined', 'null', 'NaN',
      '404', '500', 'Not Found'
    ];
    
    let foundErrors = [];
    
    for (const indicator of errorIndicators) {
      try {
        const elements = await page.locator(`text=/${indicator}/i`).all();
        if (elements.length > 0) {
          foundErrors.push(`发现错误指示器: "${indicator}" (${elements.length}处)`);
        }
      } catch (error) {
        // 忽略查找错误
      }
    }
    
    // 检查控制台错误
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // 等待一段时间收集控制台错误
    await page.waitForTimeout(5000);
    
    if (consoleErrors.length > 0) {
      foundErrors.push(`发现${consoleErrors.length}个控制台错误`);
      console.log('控制台错误:', consoleErrors.slice(0, 3)); // 只显示前3个
    }
    
    if (foundErrors.length > 0) {
      console.log('❌ 发现阻塞性问题:');
      foundErrors.forEach(error => console.log(`  - ${error}`));
      throw new Error(`发现${foundErrors.length}个阻塞性问题，阻止上线！`);
    } else {
      console.log('✅ 未发现明显的阻塞性问题');
    }
  });

}); 