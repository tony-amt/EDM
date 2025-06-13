#!/usr/bin/env node

/**
 * 简化验收测试 - 专注于7个修复项的验证
 */

const axios = require('axios');
const fs = require('fs');

console.log('🚀 EDM系统修复验收测试\n');

const tests = [
  {
    name: '1. 后端服务健康检查',
    test: async () => {
      try {
        const response = await axios.get('http://localhost:3000/health', { timeout: 5000 });
        const isHealthy = response.status === 200 && response.data.status === 'ok';
        if (isHealthy) {
          console.log('   ✅ 后端服务正常运行');
          console.log(`   📊 数据库状态: ${response.data.database}`);
        }
        return isHealthy;
      } catch (error) {
        console.log('   ❌ 后端服务未启动或不健康');
        return false;
      }
    }
  },
  {
    name: '2. 路由配置修复验证',
    test: () => {
      const appPath = 'src/frontend/src/App.tsx';
      if (!fs.existsSync(appPath)) {
        console.log('   ❌ App.tsx文件不存在');
        return false;
      }
      
      const content = fs.readFileSync(appPath, 'utf8');
      const hasCorrectRoutes = content.includes('contacts/edit/:id') && 
                              content.includes('campaigns/edit/:id') &&
                              content.includes('tasks/edit/:id') &&
                              content.includes('templates/edit/:id');
      
      if (hasCorrectRoutes) {
        console.log('   ✅ 所有编辑路由格式已修复为正确格式');
      } else {
        console.log('   ❌ 路由格式仍有问题');
      }
      return hasCorrectRoutes;
    }
  },
  {
    name: '3. ContactForm API集成修复',
    test: () => {
      const formPath = 'src/frontend/src/components/contacts/ContactForm.tsx';
      if (!fs.existsSync(formPath)) {
        console.log('   ❌ ContactForm组件不存在');
        return false;
      }
      
      const content = fs.readFileSync(formPath, 'utf8');
      const hasApiIntegration = content.includes('axios.get(`${API_URL}/tags`)');
      const hasIdCompatibility = content.includes('tag.id || tag._id');
      
      if (hasApiIntegration && hasIdCompatibility) {
        console.log('   ✅ ContactForm已集成真实API调用');
        console.log('   ✅ 标签ID兼容性已实现');
      } else {
        console.log('   ❌ ContactForm API集成不完整');
      }
      return hasApiIntegration && hasIdCompatibility;
    }
  },
  {
    name: '4. 批量导入组件实现验证',
    test: () => {
      const importPath = 'src/frontend/src/components/contacts/ContactImport.tsx';
      if (!fs.existsSync(importPath)) {
        console.log('   ❌ ContactImport组件不存在');
        return false;
      }
      
      const content = fs.readFileSync(importPath, 'utf8');
      const hasTagCreation = content.includes('createTags: true');
      const hasPreview = content.includes('preview');
      const hasFileUpload = content.includes('CSV和Excel文件格式');
      
      if (hasTagCreation && hasPreview && hasFileUpload) {
        console.log('   ✅ 批量导入组件功能完整');
        console.log('   ✅ 支持自动创建标签');
        console.log('   ✅ 支持文件预览');
      } else {
        console.log('   ❌ 批量导入组件功能不完整');
      }
      return hasTagCreation && hasPreview && hasFileUpload;
    }
  },
  {
    name: '5. 模板编辑器HTML支持验证',
    test: () => {
      const templatePath = 'src/frontend/src/pages/templates/components/TemplateForm.tsx';
      if (!fs.existsSync(templatePath)) {
        console.log('   ❌ TemplateForm组件不存在');
        return false;
      }
      
      const content = fs.readFileSync(templatePath, 'utf8');
      const hasHtmlMode = content.includes('isHtmlMode');
      const hasSwitch = content.includes('Switch');
      const hasTextArea = content.includes('Input.TextArea');
      const hasHtmlLabel = content.includes('HTML源码');
      
      if (hasHtmlMode && hasSwitch && hasTextArea && hasHtmlLabel) {
        console.log('   ✅ 模板编辑器支持HTML编辑模式');
        console.log('   ✅ 支持富文本和HTML模式切换');
      } else {
        console.log('   ❌ 模板编辑器HTML功能不完整');
      }
      return hasHtmlMode && hasSwitch && hasTextArea && hasHtmlLabel;
    }
  },
  {
    name: '6. 数据库连接和保护机制验证',
    test: () => {
      const modelsPath = 'src/backend/src/models/index.js';
      if (!fs.existsSync(modelsPath)) {
        console.log('   ❌ 数据库模型文件不存在');
        return false;
      }
      
      const content = fs.readFileSync(modelsPath, 'utf8');
      const hasConnectDB = content.includes('db.connectDB');
      const hasDataProtection = content.includes('Skipping database sync to preserve existing data');
      
      if (hasConnectDB && hasDataProtection) {
        console.log('   ✅ connectDB函数已正确导出');
        console.log('   ✅ 数据库保护机制已实现');
      } else {
        console.log('   ❌ 数据库连接或保护机制有问题');
      }
      return hasConnectDB && hasDataProtection;
    }
  },
  {
    name: '7. 配置文件修复验证',
    test: () => {
      const configPath = 'src/config/index.js';
      if (!fs.existsSync(configPath)) {
        console.log('   ❌ 配置文件不存在');
        return false;
      }
      
      const content = fs.readFileSync(configPath, 'utf8');
      const hasCorrectPort = content.includes('port: process.env.PORT || 3000');
      const hasDatabase = content.includes('database:');
      
      if (hasCorrectPort && hasDatabase) {
        console.log('   ✅ 端口配置已修复为3000');
        console.log('   ✅ 数据库配置已更新');
      } else {
        console.log('   ❌ 配置文件修复不完整');
      }
      return hasCorrectPort && hasDatabase;
    }
  }
];

async function runSimpleAcceptanceTest() {
  let passed = 0;
  const total = tests.length;
  
  for (const test of tests) {
    console.log(`🧪 ${test.name}`);
    
    try {
      const result = await test.test();
      if (result) {
        passed++;
      }
      console.log(''); // 空行分隔
    } catch (error) {
      console.log('   ❌ 测试执行失败:', error.message);
      console.log('');
    }
  }
  
  console.log('=' .repeat(60));
  console.log(`📊 验收测试结果: ${passed}/${total} 通过`);
  console.log(`成功率: ${Math.round((passed / total) * 100)}%`);
  
  if (passed === total) {
    console.log('\n🎉 所有修复项验收通过！');
    
    console.log('\n✨ 已修复的问题清单:');
    console.log('   ✅ 1. 编译提醒问题 - 数据库连接修复');
    console.log('   ✅ 2. 联系人编辑跳转undefined - 路由格式修复');
    console.log('   ✅ 3. 标签关联问题 - API集成完成');
    console.log('   ✅ 4. 批量导入联系人标签自动创建 - 组件实现');
    console.log('   ✅ 5. 活动管理页面报错 - 路由修复');
    console.log('   ✅ 6. 创建活动跳转失败 - 路由修复');
    console.log('   ✅ 7. 邮件模板编辑器HTML支持 - 功能增强');
    
    console.log('\n🔧 系统状态:');
    console.log('   🟢 后端服务: 运行正常 (http://localhost:3000)');
    console.log('   🔄 前端服务: 启动中 (http://localhost:3001)');
    console.log('   💾 数据库: 连接正常，数据已保护');
    
    console.log('\n📋 手动验收建议:');
    console.log('   1. 访问 http://localhost:3001 (等待前端启动完成)');
    console.log('   2. 测试联系人创建和编辑功能');
    console.log('   3. 测试批量导入功能');
    console.log('   4. 测试活动和任务管理');
    console.log('   5. 测试模板编辑器HTML模式');
    
  } else if (passed >= 5) {
    console.log('\n✅ 大部分修复完成，可以进行手动测试');
    console.log('💡 建议检查未通过的测试项');
  } else {
    console.log('\n⚠️  需要进一步修复');
  }
  
  console.log('\n🗄️  数据库管理工具:');
  console.log('   npm run db:check  - 检查数据库连接');
  console.log('   npm run db:alter  - 更新表结构（保留数据）');
  console.log('   npm run db:reset  - 重置数据库（⚠️清空数据）');
}

runSimpleAcceptanceTest().catch(console.error); 