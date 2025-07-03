#!/usr/bin/env node

/**
 * 快速验证脚本 - 检查7个修复项
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

console.log('🔍 开始快速验证修复项...\n');

const checks = [
  {
    name: '1. 后端服务健康检查',
    test: async () => {
      try {
        const response = await axios.get('http://localhost:3000/health', { timeout: 5000 });
        return response.status === 200 && response.data.status === 'ok';
      } catch (error) {
        console.log('   ❌ 后端服务未启动或不健康');
        return false;
      }
    }
  },
  {
    name: '2. 路由配置正确性检查',
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
    name: '3. ContactForm API集成检查',
    test: () => {
      const formPath = 'src/frontend/src/components/contacts/ContactForm.tsx';
      if (!fs.existsSync(formPath)) return false;
      
      const content = fs.readFileSync(formPath, 'utf8');
      return content.includes('axios.get(`${API_URL}/tags`)') &&
             content.includes('tag.id || tag._id');
    }
  },
  {
    name: '4. ContactImport组件存在检查',
    test: () => {
      const importPath = 'src/frontend/src/components/contacts/ContactImport.tsx';
      if (!fs.existsSync(importPath)) return false;
      
      const content = fs.readFileSync(importPath, 'utf8');
      return content.includes('createTags: true') &&
             content.includes('preview');
    }
  },
  {
    name: '5. TemplateForm HTML编辑器检查',
    test: () => {
      const templatePath = 'src/frontend/src/pages/templates/components/TemplateForm.tsx';
      if (!fs.existsSync(templatePath)) return false;
      
      const content = fs.readFileSync(templatePath, 'utf8');
      return content.includes('isHtmlMode') &&
             content.includes('Switch') &&
             content.includes('Input.TextArea');
    }
  },
  {
    name: '6. 数据库connectDB函数检查',
    test: () => {
      const modelsPath = 'src/backend/src/models/index.js';
      if (!fs.existsSync(modelsPath)) return false;
      
      const content = fs.readFileSync(modelsPath, 'utf8');
      return content.includes('db.connectDB') &&
             content.includes('Skipping database sync to preserve existing data');
    }
  },
  {
    name: '7. 配置文件端口检查',
    test: () => {
      const configPath = 'src/config/index.js';
      if (!fs.existsSync(configPath)) return false;
      
      const content = fs.readFileSync(configPath, 'utf8');
      return content.includes('port: process.env.PORT || 3000');
    }
  }
];

async function runChecks() {
  let passed = 0;
  
  for (const check of checks) {
    process.stdout.write(`🧪 ${check.name}... `);
    
    try {
      const result = await check.test();
      if (result) {
        console.log('✅');
        passed++;
      } else {
        console.log('❌');
      }
    } catch (error) {
      console.log('❌ (错误)', error.message);
    }
  }
  
  console.log(`\n📊 验证结果: ${passed}/${checks.length} 通过`);
  
  if (passed === checks.length) {
    console.log('🎉 所有修复项验证通过！');
    console.log('\n📋 下一步操作:');
    console.log('1. 启动前端: cd src/frontend && npm start');
    console.log('2. 访问系统: http://localhost:3001');
    console.log('3. 进行功能验收测试');
  } else {
    console.log('⚠️  部分修复项需要检查');
  }
  
  console.log('\n🗄️  数据库管理命令:');
  console.log('- npm run db:check  检查数据库连接');
  console.log('- npm run db:alter  更新表结构（保留数据）');
  console.log('- npm run db:reset  重置数据库（清空数据）⚠️');
}

runChecks().catch(console.error); 