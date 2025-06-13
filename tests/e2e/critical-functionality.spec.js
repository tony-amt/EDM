// tests/e2e/critical-functionality.spec.js
import { test, expect } from '@playwright/test';

// 测试配置
const TEST_CONFIG = {
  frontend_url: 'http://localhost:3001',
  backend_url: 'http://localhost:3000',
  admin_credentials: {
    email: 'admin@example.com',
    password: 'admin123456'
  }
};

test.describe('🚨 关键功能测试 - 质量门禁检查', () => {
  
  test.beforeEach(async ({ page }) => {
    // 清除浏览器存储
    await page.context().clearCookies();
    try {
      await page.evaluate(() => {
        if (typeof Storage !== 'undefined') {
          localStorage.clear();
          sessionStorage.clear();
        }
      });
    } catch (error) {
      // 忽略localStorage访问错误
      console.log('localStorage清理跳过:', error.message);
    }
  });

  test('P0-001: 🔐 用户认证流程核心验证', async ({ page }) => {
    console.log('🧪 执行 P0-001: 用户认证流程测试...');
    
    // 1. 访问首页应自动跳转到登录页
    await page.goto('/');
    await expect(page).toHaveURL(/.*\/login/);
    console.log('✅ 首页自动跳转登录页面正常');
    
    // 2. 检查登录页面必要元素
    await expect(page.locator('[placeholder="用户名或邮箱"], input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('[placeholder="密码"], input[type="password"], input[name="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("登 录"), button:has-text("登录"), button[type="submit"]')).toBeVisible();
    console.log('✅ 登录页面基本元素检查通过');
    
    // 3. 测试错误登录凭据
    await page.fill('[placeholder="用户名或邮箱"], input[type="email"], input[name="email"]', 'wrong@example.com');
    await page.fill('[placeholder="密码"], input[type="password"], input[name="password"]', 'wrongpassword');
    await page.click('button:has-text("登 录"), button:has-text("登录"), button[type="submit"]');
    
    // 等待错误提示出现
    const errorMessage = page.locator('text=/用户名或密码错误|登录失败|Invalid credentials/i');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
    console.log('✅ 错误凭据登录失败提示正常');
    
    // 4. 测试正确登录凭据
    await page.fill('[placeholder="用户名或邮箱"], input[type="email"], input[name="email"]', TEST_CONFIG.admin_credentials.email);
    await page.fill('[placeholder="密码"], input[type="password"], input[name="password"]', TEST_CONFIG.admin_credentials.password);
    await page.click('button:has-text("登 录"), button:has-text("登录"), button[type="submit"]');
    
    // 等待页面跳转
    await page.waitForURL('/', { timeout: 10000 });
    console.log('✅ 正确凭据登录成功');
    
    // 5. 验证登录后页面状态
    await expect(page.locator('text=/首页|Dashboard|仪表盘/i')).toBeVisible();
    console.log('✅ 登录后页面显示正常');
  });

  test('P0-002: 📊 Dashboard页面核心数据显示', async ({ page }) => {
    console.log('🧪 执行 P0-002: Dashboard核心数据测试...');
    
    // 先登录
    await page.goto('/login');
    await page.fill('[placeholder="用户名或邮箱"], input[type="email"], input[name="email"]', TEST_CONFIG.admin_credentials.email);
    await page.fill('[placeholder="密码"], input[type="password"], input[name="password"]', TEST_CONFIG.admin_credentials.password);
    await page.click('button:has-text("登 录"), button:has-text("登录"), button[type="submit"]');
    await page.waitForURL('/');
    
    // 检查Dashboard必要数据显示
    await expect(page.locator('text=/用户管理|联系人管理|模板管理|任务管理/i')).toBeVisible();
    console.log('✅ Dashboard基本导航菜单正常');
    
    // 检查统计数据区域
    const statsElements = page.locator('[class*="statistic"], [class*="card"], [class*="metric"]');
    await expect(statsElements.first()).toBeVisible();
    console.log('✅ Dashboard统计数据区域显示正常');
  });

  test('P0-003: 👥 联系人管理基础功能验证', async ({ page }) => {
    console.log('🧪 执行 P0-003: 联系人管理功能测试...');
    
    // 登录并导航到联系人页面
    await page.goto('/login');
    await page.fill('[placeholder="用户名或邮箱"], input[type="email"], input[name="email"]', TEST_CONFIG.admin_credentials.email);
    await page.fill('[placeholder="密码"], input[type="password"], input[name="password"]', TEST_CONFIG.admin_credentials.password);
    await page.click('button:has-text("登 录"), button:has-text("登录"), button[type="submit"]');
    await page.waitForURL('/');
    
    // 导航到联系人页面
    await page.click('text=/联系人|Contacts/i');
    await expect(page).toHaveURL(/.*\/contacts/);
    console.log('✅ 联系人页面导航正常');
    
    // 检查联系人列表页面关键元素
    await expect(page.locator('text=/联系人列表|Contact List/i')).toBeVisible();
    await expect(page.locator('button:has-text("创建"), button:has-text("新建"), button:has-text("添加")')).toBeVisible();
    console.log('✅ 联系人列表页面基本元素正常');
  });

  test('P0-004: 📧 模板管理基础功能验证', async ({ page }) => {
    console.log('🧪 执行 P0-004: 模板管理功能测试...');
    
    await page.goto('/login');
    await page.fill('[placeholder="用户名或邮箱"], input[type="email"], input[name="email"]', TEST_CONFIG.admin_credentials.email);
    await page.fill('[placeholder="密码"], input[type="password"], input[name="password"]', TEST_CONFIG.admin_credentials.password);
    await page.click('button:has-text("登 录"), button:has-text("登录"), button[type="submit"]');
    await page.waitForURL('/');
    
    // 导航到模板页面
    await page.click('text=/模板|Templates/i');
    await expect(page).toHaveURL(/.*\/templates/);
    console.log('✅ 模板页面导航正常');
    
    // 检查模板列表页面
    await expect(page.locator('text=/模板列表|Template List/i')).toBeVisible();
    console.log('✅ 模板列表页面基本显示正常');
  });

  test('P0-005: 🏷️ 标签管理基础功能验证', async ({ page }) => {
    console.log('🧪 执行 P0-005: 标签管理功能测试...');
    
    await page.goto('/login');
    await page.fill('[placeholder="用户名或邮箱"], input[type="email"], input[name="email"]', TEST_CONFIG.admin_credentials.email);
    await page.fill('[placeholder="密码"], input[type="password"], input[name="password"]', TEST_CONFIG.admin_credentials.password);
    await page.click('button:has-text("登 录"), button:has-text("登录"), button[type="submit"]');
    await page.waitForURL('/');
    
    // 导航到标签页面
    await page.click('text=/标签|Tags/i');
    await expect(page).toHaveURL(/.*\/tags/);
    console.log('✅ 标签页面导航正常');
    
    // 检查标签列表页面
    await expect(page.locator('text=/标签列表|Tag List/i')).toBeVisible();
    console.log('✅ 标签列表页面基本显示正常');
  });

});

test.describe('🔍 V2.0新功能实现状态检查', () => {
  
  test.beforeEach(async ({ page }) => {
    // 登录准备
    await page.goto('/login');
    await page.fill('[placeholder="用户名或邮箱"], input[type="email"], input[name="email"]', TEST_CONFIG.admin_credentials.email);
    await page.fill('[placeholder="密码"], input[type="password"], input[name="password"]', TEST_CONFIG.admin_credentials.password);
    await page.click('button:has-text("登 录"), button:has-text("登录"), button[type="submit"]');
    await page.waitForURL('/');
  });

  test('V2-001: 👤 发信人管理功能状态检查', async ({ page }) => {
    console.log('🧪 检查 V2-001: 发信人管理实现状态...');
    
    try {
      await page.click('text=/发信人|Senders/i');
      await expect(page).toHaveURL(/.*\/senders/);
      
      // 检查页面是否有实际内容还是占位符
      const hasRealContent = await page.locator('text=/发信人列表|创建发信人|Sender/i').isVisible();
      const hasPlaceholder = await page.locator('text=/功能开发中|Coming Soon|待实现/i').isVisible();
      
      if (hasRealContent && !hasPlaceholder) {
        console.log('✅ 发信人管理功能已实现');
        
        // 进一步检查核心功能
        const createButton = page.locator('button:has-text("创建"), button:has-text("新建"), button:has-text("添加")');
        if (await createButton.isVisible()) {
          console.log('✅ 发信人创建功能按钮存在');
        } else {
          console.log('⚠️ 发信人创建功能按钮缺失');
        }
      } else {
        console.log('❌ 发信人管理功能未完全实现或显示占位符');
      }
    } catch (error) {
      console.log('❌ 发信人管理功能导航失败或页面不存在');
    }
  });

  test('V2-002: 📮 群发任务管理功能状态检查', async ({ page }) => {
    console.log('🧪 检查 V2-002: 群发任务管理实现状态...');
    
    try {
      await page.click('text=/群发任务|Bulk Tasks/i');
      await expect(page).toHaveURL(/.*\/bulk-tasks/);
      
      const hasRealContent = await page.locator('text=/任务列表|创建任务|Task/i').isVisible();
      const hasPlaceholder = await page.locator('text=/功能开发中|Coming Soon|待实现/i').isVisible();
      
      if (hasRealContent && !hasPlaceholder) {
        console.log('✅ 群发任务管理功能已实现');
      } else {
        console.log('❌ 群发任务管理功能未完全实现');
      }
    } catch (error) {
      console.log('❌ 群发任务管理功能导航失败或页面不存在');
    }
  });

  test('V2-003: ⚙️ 邮件服务管理功能状态检查', async ({ page }) => {
    console.log('🧪 检查 V2-003: 邮件服务管理实现状态...');
    
    try {
      await page.click('text=/邮件服务|Email Services/i');
      await expect(page).toHaveURL(/.*\/email-services/);
      
      const hasRealContent = await page.locator('text=/服务列表|创建服务|Service/i').isVisible();
      const hasPlaceholder = await page.locator('text=/功能开发中|Coming Soon|待实现/i').isVisible();
      
      if (hasRealContent && !hasPlaceholder) {
        console.log('✅ 邮件服务管理功能已实现');
      } else {
        console.log('❌ 邮件服务管理功能未完全实现');
      }
    } catch (error) {
      console.log('❌ 邮件服务管理功能导航失败或页面不存在');
    }
  });

  test('V2-004: 👥 用户管理增强功能状态检查', async ({ page }) => {
    console.log('🧪 检查 V2-004: 用户管理增强功能实现状态...');
    
    try {
      await page.click('text=/用户管理|User Management/i');
      await expect(page).toHaveURL(/.*\/user-management/);
      
      const hasRealContent = await page.locator('text=/用户列表|额度管理|User/i').isVisible();
      const hasPlaceholder = await page.locator('text=/功能开发中|Coming Soon|待实现/i').isVisible();
      
      if (hasRealContent && !hasPlaceholder) {
        console.log('✅ 用户管理增强功能已实现');
      } else {
        console.log('❌ 用户管理增强功能未完全实现');
      }
    } catch (error) {
      console.log('❌ 用户管理增强功能导航失败或页面不存在');
    }
  });

});

test.describe('🚫 未实现功能检测 - 阻止用户访问', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[placeholder="用户名或邮箱"], input[type="email"], input[name="email"]', TEST_CONFIG.admin_credentials.email);
    await page.fill('[placeholder="密码"], input[type="password"], input[name="password"]', TEST_CONFIG.admin_credentials.password);
    await page.click('button:has-text("登 录"), button:has-text("登录"), button[type="submit"]');
    await page.waitForURL('/');
  });

  test('BLOCKER-001: 🚨 检测占位符和"开发中"提示', async ({ page }) => {
    console.log('🧪 执行 BLOCKER-001: 检测未实现功能...');
    
    const blockerMessages = [
      'Coming Soon',
      '功能开发中',
      '敬请期待',
      '待实现',
      'Under Development',
      'TODO',
      'Not Implemented',
      'Placeholder',
      '占位符'
    ];
    
    let foundBlockers = [];
    
    for (const message of blockerMessages) {
      try {
        const elements = await page.locator(`text=/${message}/i`).all();
        if (elements.length > 0) {
          foundBlockers.push(`发现阻塞消息: "${message}" (${elements.length}处)`);
        }
      } catch (error) {
        // 忽略查找错误
      }
    }
    
    if (foundBlockers.length > 0) {
      console.log('❌ 发现未实现功能提示:');
      foundBlockers.forEach(blocker => console.log(`  - ${blocker}`));
      throw new Error(`发现${foundBlockers.length}个未实现功能，阻止上线！`);
    } else {
      console.log('✅ 未发现明显的未实现功能提示');
    }
  });

  test('BLOCKER-002: 🚨 检测无效按钮和链接', async ({ page }) => {
    console.log('🧪 执行 BLOCKER-002: 检测无效交互元素...');
    
    // 检查所有按钮是否可点击
    const buttons = await page.locator('button:visible').all();
    let invalidButtons = [];
    
    for (let i = 0; i < Math.min(buttons.length, 10); i++) { // 限制检查数量
      const button = buttons[i];
      try {
        const isDisabled = await button.isDisabled();
        const text = await button.textContent();
        
        if (isDisabled && text && text.trim()) {
          invalidButtons.push(`禁用按钮: "${text.trim()}"`);
        }
      } catch (error) {
        // 忽略检查错误
      }
    }
    
    if (invalidButtons.length > 0) {
      console.log('⚠️ 发现禁用的按钮:');
      invalidButtons.forEach(btn => console.log(`  - ${btn}`));
    } else {
      console.log('✅ 主要按钮状态正常');
    }
  });

}); 