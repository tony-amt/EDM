#!/usr/bin/env node

/**
 * Phase 3 contact.tags迁移辅助工具
 * 用于检查和修复系统中的contact.tags引用
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Phase 3: contact.tags引用检查工具');
console.log('='.repeat(50));

// 需要检查的关键文件
const criticalFiles = [
  'src/backend/src/services/core/contact.service.js',
  'src/backend/src/controllers/contact.controller.js',
  'src/backend/src/controllers/tag.controller.js',
  'src/backend/src/utils/contactTagManager.js'
];

// 检查每个文件的contact.tags引用
criticalFiles.forEach(filePath => {
  const fullPath = path.join(__dirname, '..', filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`❌ 文件不存在: ${filePath}`);
    return;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const lines = content.split('\n');

  const matches = [];
  lines.forEach((line, index) => {
    if (line.includes('contact.tags') && !line.trim().startsWith('//')) {
      matches.push({
        lineNumber: index + 1,
        content: line.trim()
      });
    }
  });

  if (matches.length > 0) {
    console.log(`\n🔍 ${filePath}:`);
    console.log(`   发现 ${matches.length} 个contact.tags引用:`);
    matches.forEach(match => {
      console.log(`   📍 第${match.lineNumber}行: ${match.content}`);
    });
  } else {
    console.log(`\n✅ ${filePath}: 无contact.tags引用`);
  }
});

console.log('\n' + '='.repeat(50));
console.log('🎯 修复建议:');
console.log('1. contact.service.js - 已启用反向查询 ✅');
console.log('2. contact.controller.js - 已修复导出功能 ✅');
console.log('3. tag.controller.js - 需要重构双写逻辑 ⚠️');
console.log('4. contactTagManager.js - 需要适配Phase 3 ⚠️');

console.log('\n🚀 下一步行动:');
console.log('- 测试反向查询功能是否正常工作');
console.log('- 修复tag.controller.js的复杂双写逻辑');
console.log('- 更新contactTagManager.js为单向写入');
console.log('- 运行充分的功能测试'); 