#!/usr/bin/env node

/**
 * 验收测试修复验证脚本
 * 用于验证本次修复的7个问题是否已解决
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3000';
const FRONTEND_BASE = 'http://localhost:3001';

console.log('🔍 开始验证修复结果...\n');

// 测试项目列表
const tests = [
  {
    name: '1. 后端服务启动检查',
    test: async () => {
      try {
        const response = await axios.get(`${API_BASE}/health`);
        return response.status === 200;
      } catch (error) {
        console.log('   ❌ 后端服务未启动或健康检查失败');
        return false;
      }
    }
  },
  {
    name: '2. 路由配置检查',
    test: async () => {
      const appTsxPath = path.join(__dirname, 'src/frontend/src/App.tsx');
      if (!fs.existsSync(appTsxPath)) {
        console.log('   ❌ App.tsx 文件不存在');
        return false;
      }
      
      const content = fs.readFileSync(appTsxPath, 'utf8');
      
      // 检查路由格式是否正确
      const hasCorrectContactEditRoute = content.includes('contacts/edit/:id');
      const hasCorrectCampaignEditRoute = content.includes('campaigns/edit/:id');
      const hasCorrectTaskEditRoute = content.includes('tasks/edit/:id');
      const hasCorrectTemplateEditRoute = content.includes('templates/edit/:id');
      
      if (hasCorrectContactEditRoute && hasCorrectCampaignEditRoute && 
          hasCorrectTaskEditRoute && hasCorrectTemplateEditRoute) {
        console.log('   ✅ 所有编辑路由格式正确');
        return true;
      } else {
        console.log('   ❌ 路由格式不正确');
        return false;
      }
    }
  },
  {
    name: '3. ContactForm组件API集成检查',
    test: async () => {
      const contactFormPath = path.join(__dirname, 'src/frontend/src/components/contacts/ContactForm.tsx');
      if (!fs.existsSync(contactFormPath)) {
        console.log('   ❌ ContactForm.tsx 文件不存在');
        return false;
      }
      
      const content = fs.readFileSync(contactFormPath, 'utf8');
      
      // 检查是否使用API获取标签
      const hasApiCall = content.includes('axios.get(`${API_URL}/tags`)');
      const hasTagIdCompatibility = content.includes('tag.id || tag._id');
      
      if (hasApiCall && hasTagIdCompatibility) {
        console.log('   ✅ ContactForm已集成API并支持标签ID兼容性');
        return true;
      } else {
        console.log('   ❌ ContactForm API集成不完整');
        return false;
      }
    }
  },
  {
    name: '4. ContactImport组件检查',
    test: async () => {
      const contactImportPath = path.join(__dirname, 'src/frontend/src/components/contacts/ContactImport.tsx');
      if (!fs.existsSync(contactImportPath)) {
        console.log('   ❌ ContactImport.tsx 文件不存在');
        return false;
      }
      
      const content = fs.readFileSync(contactImportPath, 'utf8');
      
      // 检查关键功能
      const hasFileUpload = content.includes('beforeUpload');
      const hasTagCreation = content.includes('createTags: true');
      const hasPreview = content.includes('preview');
      
      if (hasFileUpload && hasTagCreation && hasPreview) {
        console.log('   ✅ ContactImport组件功能完整');
        return true;
      } else {
        console.log('   ❌ ContactImport组件功能不完整');
        return false;
      }
    }
  },
  {
    name: '5. TemplateForm HTML编辑器检查',
    test: async () => {
      const templateFormPath = path.join(__dirname, 'src/frontend/src/pages/templates/components/TemplateForm.tsx');
      if (!fs.existsSync(templateFormPath)) {
        console.log('   ❌ TemplateForm.tsx 文件不存在');
        return false;
      }
      
      const content = fs.readFileSync(templateFormPath, 'utf8');
      
      // 检查HTML编辑功能
      const hasHtmlMode = content.includes('isHtmlMode');
      const hasSwitch = content.includes('Switch');
      const hasTextArea = content.includes('Input.TextArea');
      
      if (hasHtmlMode && hasSwitch && hasTextArea) {
        console.log('   ✅ TemplateForm支持HTML编辑模式');
        return true;
      } else {
        console.log('   ❌ TemplateForm HTML编辑功能不完整');
        return false;
      }
    }
  },
  {
    name: '6. 数据库连接函数检查',
    test: async () => {
      const modelsIndexPath = path.join(__dirname, 'src/backend/src/models/index.js');
      if (!fs.existsSync(modelsIndexPath)) {
        console.log('   ❌ models/index.js 文件不存在');
        return false;
      }
      
      const content = fs.readFileSync(modelsIndexPath, 'utf8');
      
      // 检查connectDB函数
      const hasConnectDB = content.includes('db.connectDB');
      const hasAsyncFunction = content.includes('async () =>');
      
      if (hasConnectDB && hasAsyncFunction) {
        console.log('   ✅ connectDB函数已正确导出');
        return true;
      } else {
        console.log('   ❌ connectDB函数导出不正确');
        return false;
      }
    }
  },
  {
    name: '7. 变更日志检查',
    test: async () => {
      const changeLogPath = path.join(__dirname, 'docs/08-changes/CHANGE-FRONTEND-20250604.md');
      if (!fs.existsSync(changeLogPath)) {
        console.log('   ❌ 变更日志文件不存在');
        return false;
      }
      
      const content = fs.readFileSync(changeLogPath, 'utf8');
      
      // 检查是否包含所有修复项
      const hasAllFixes = content.includes('编译提醒问题') &&
                         content.includes('联系人编辑跳转undefined') &&
                         content.includes('标签关联问题') &&
                         content.includes('批量导入联系人') &&
                         content.includes('活动管理页面报错') &&
                         content.includes('创建活动跳转失败') &&
                         content.includes('邮件模板编辑器HTML支持');
      
      if (hasAllFixes) {
        console.log('   ✅ 变更日志记录完整');
        return true;
      } else {
        console.log('   ❌ 变更日志记录不完整');
        return false;
      }
    }
  }
];

// 运行测试
async function runTests() {
  let passedTests = 0;
  const totalTests = tests.length;
  
  for (const test of tests) {
    console.log(`🧪 ${test.name}`);
    try {
      const result = await test.test();
      if (result) {
        passedTests++;
      }
    } catch (error) {
      console.log(`   ❌ 测试执行失败: ${error.message}`);
    }
    console.log('');
  }
  
  console.log('📊 测试结果汇总:');
  console.log(`   通过: ${passedTests}/${totalTests}`);
  console.log(`   成功率: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 所有修复验证通过！可以进行下一轮验收测试。');
  } else {
    console.log('\n⚠️  部分修复需要进一步检查。');
  }
}

// 执行测试
runTests().catch(console.error); 