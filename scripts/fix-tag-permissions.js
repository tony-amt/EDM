const fs = require('fs');
const path = require('path');

// 修复标签权限控制问题
function fixTagPermissions() {
  const tagControllerPath = path.join(__dirname, '../src/backend/src/controllers/tag.controller.js');
  
  console.log('🔧 修复标签权限控制问题...');
  
  let content = fs.readFileSync(tagControllerPath, 'utf8');
  
  // 要修复的权限检查模式
  const patterns = [
    {
      find: /if \(req\.user\.role !== 'admin'\) {\s*(\w+)\.user_id = req\.user\.id;\s*}/g,
      replace: '// 🔒 安全修复：所有用户（包括管理员）只能访问自己的数据\n    $1.user_id = req.user.id;'
    },
    {
      find: /if \(req\.user\.role !== 'admin'\) {\s*contactWhere\.user_id = req\.user\.id;\s*tagWhere\.user_id = req\.user\.id;\s*}/g,
      replace: '// 🔒 安全修复：所有用户（包括管理员）只能访问自己的数据\n    contactWhere.user_id = req.user.id;\n    tagWhere.user_id = req.user.id;'
    }
  ];
  
  patterns.forEach(pattern => {
    content = content.replace(pattern.find, pattern.replace);
  });

  fs.writeFileSync(tagControllerPath, content, 'utf8');
  console.log('✅ 标签权限控制问题修复完成');
}

fixTagPermissions(); 