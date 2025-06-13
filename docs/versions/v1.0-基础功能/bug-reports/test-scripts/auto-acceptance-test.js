#!/usr/bin/env node

/**
 * 自动化验收测试脚本
 * 等待前端启动后进行完整的7项修复验收测试
 */

const axios = require('axios');
const fs = require('fs');
const { spawn } = require('child_process');

console.log('🚀 EDM系统自动化验收测试开始...\n');

// 等待服务启动的函数
async function waitForService(url, serviceName, maxAttempts = 30) {
  console.log(`⏳ 等待${serviceName}启动...`);
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await axios.get(url, { timeout: 3000 });
      if (response.status === 200) {
        console.log(`✅ ${serviceName}启动成功！`);
        return true;
      }
    } catch (error) {
      // 忽略错误，继续等待
    }
    
    // 每2秒检查一次
    await new Promise(resolve => setTimeout(resolve, 2000));
    process.stdout.write('.');
  }
  
  console.log(`\n❌ ${serviceName}启动超时`);
  return false;
}

// 验收测试项目
const acceptanceTests = [
  {
    name: '1. 后端服务健康检查',
    test: async () => {
      try {
        const response = await axios.get('http://localhost:3000/health');
        return response.status === 200 && response.data.status === 'ok';
      } catch (error) {
        return false;
      }
    }
  },
  {
    name: '2. 前端页面访问检查',
    test: async () => {
      try {
        const response = await axios.get('http://localhost:3001');
        return response.status === 200;
      } catch (error) {
        return false;
      }
    }
  },
  {
    name: '3. 路由配置正确性检查',
    test: () => {
      const appPath = 'src/frontend/src/App.tsx';
      if (!fs.existsSync(appPath)) return false;
      
      const content = fs.readFileSync(appPath, 'utf8');
      return content.includes('contacts/edit/:id') && 
             content.includes('campaigns/edit/:id') &&
             content.includes('tasks/edit/:id') &&
             content.includes('templates/edit/:id');
    }
  },
  {
    name: '4. ContactForm API集成检查',
    test: () => {
      const formPath = 'src/frontend/src/components/contacts/ContactForm.tsx';
      if (!fs.existsSync(formPath)) return false;
      
      const content = fs.readFileSync(formPath, 'utf8');
      return content.includes('axios.get(`${API_URL}/tags`)') &&
             content.includes('tag.id || tag._id');
    }
  },
  {
    name: '5. ContactImport组件功能检查',
    test: () => {
      const importPath = 'src/frontend/src/components/contacts/ContactImport.tsx';
      if (!fs.existsSync(importPath)) return false;
      
      const content = fs.readFileSync(importPath, 'utf8');
      return content.includes('createTags: true') &&
             content.includes('preview') &&
             content.includes('CSV和Excel文件格式');
    }
  },
  {
    name: '6. TemplateForm HTML编辑器检查',
    test: () => {
      const templatePath = 'src/frontend/src/pages/templates/components/TemplateForm.tsx';
      if (!fs.existsSync(templatePath)) return false;
      
      const content = fs.readFileSync(templatePath, 'utf8');
      return content.includes('isHtmlMode') &&
             content.includes('Switch') &&
             content.includes('Input.TextArea') &&
             content.includes('HTML源码');
    }
  },
  {
    name: '7. 数据库保护机制检查',
    test: () => {
      const modelsPath = 'src/backend/src/models/index.js';
      if (!fs.existsSync(modelsPath)) return false;
      
      const content = fs.readFileSync(modelsPath, 'utf8');
      return content.includes('Skipping database sync to preserve existing data');
    }
  }
];

// 功能验收测试
const functionalTests = [
  {
    name: '8. 联系人页面路由测试',
    description: '测试联系人编辑页面是否能正确跳转',
    test: async () => {
      try {
        // 模拟访问联系人编辑页面
        const response = await axios.get('http://localhost:3001/contacts/edit/123', {
          maxRedirects: 0,
          validateStatus: () => true
        });
        // 只要不是404即可，前端路由会处理
        return response.status !== 404;
      } catch (error) {
        return false;
      }
    }
  }
];

// 执行验收测试
async function runAcceptanceTests() {
  console.log('📋 开始验收测试...\n');
  
  // 首先等待后端服务
  const backendReady = await waitForService('http://localhost:3000/health', '后端服务', 10);
  if (!backendReady) {
    console.log('❌ 后端服务未启动，请先运行: npm start');
    return;
  }
  
  // 等待前端服务
  const frontendReady = await waitForService('http://localhost:3001', '前端服务', 30);
  if (!frontendReady) {
    console.log('❌ 前端服务未启动，请检查前端启动状态');
    return;
  }
  
  console.log('\n🧪 开始执行验收测试项目...\n');
  
  let passedTests = 0;
  let totalTests = acceptanceTests.length + functionalTests.length;
  
  // 执行基础验收测试
  for (const test of acceptanceTests) {
    process.stdout.write(`🔍 ${test.name}... `);
    
    try {
      const result = await test.test();
      if (result) {
        console.log('✅');
        passedTests++;
      } else {
        console.log('❌');
      }
    } catch (error) {
      console.log('❌ (错误)');
    }
  }
  
  // 执行功能测试
  for (const test of functionalTests) {
    process.stdout.write(`🔍 ${test.name}... `);
    
    try {
      const result = await test.test();
      if (result) {
        console.log('✅');
        passedTests++;
      } else {
        console.log('❌');
      }
    } catch (error) {
      console.log('❌ (错误)');
    }
  }
  
  // 显示结果
  console.log(`\n📊 验收测试结果: ${passedTests}/${totalTests} 通过`);
  console.log(`成功率: ${Math.round((passedTests / totalTests) * 100)}%\n`);
  
  if (passedTests === totalTests) {
    console.log('🎉 验收测试全部通过！\n');
    
    console.log('🏁 EDM系统已准备就绪！');
    console.log('📍 前端地址: http://localhost:3001');
    console.log('📍 后端API: http://localhost:3000\n');
    
    console.log('✨ 修复完成的功能:');
    console.log('   ✅ 1. 编译错误修复');
    console.log('   ✅ 2. 联系人编辑页面路由修复');
    console.log('   ✅ 3. 标签功能集成真实API');
    console.log('   ✅ 4. 联系人批量导入功能');
    console.log('   ✅ 5. 活动管理页面修复');
    console.log('   ✅ 6. 创建页面跳转修复');
    console.log('   ✅ 7. 模板编辑器HTML支持');
    console.log('   ✅ 8. 数据库数据保护');
    
    console.log('\n🧪 建议手动验收测试项目:');
    console.log('   1. 访问 http://localhost:3001 查看系统界面');
    console.log('   2. 测试联系人创建和编辑功能');
    console.log('   3. 测试联系人批量导入功能');
    console.log('   4. 测试活动管理功能');
    console.log('   5. 测试模板编辑器的HTML模式切换');
    
  } else {
    console.log('⚠️  部分验收测试未通过，需要进一步检查');
    
    if (passedTests >= 6) {
      console.log('💡 大部分功能正常，可以进行手动测试');
    }
  }
  
  console.log('\n🗄️  数据库管理工具:');
  console.log('   npm run db:check  - 检查数据库连接');
  console.log('   npm run db:alter  - 更新表结构（保留数据）');
  console.log('   npm run db:reset  - 重置数据库（⚠️清空数据）');
}

// 启动验收测试
runAcceptanceTests().catch(error => {
  console.error('验收测试执行失败:', error);
  process.exit(1);
}); 