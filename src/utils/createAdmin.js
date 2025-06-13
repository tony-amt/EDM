// 引入配置和数据库模型
require('dotenv').config();
const db = require('../backend/src/models');
const { User } = db;

async function createAdmin() {
  try {
    // 检查是否已存在管理员用户
    const existingAdmin = await User.findOne({
      where: { username: 'admin' }
    });

    if (existingAdmin) {
      console.log('✅ 管理员用户已存在');
      console.log('   用户名: admin');
      console.log('   如需重置密码，请手动删除该用户后重新运行此脚本');
      return;
    }

    // 创建管理员用户
    const adminUser = await User.create({
      username: 'admin',
      email: 'admin@example.com',
      password: 'admin123456', // 会被model的beforeCreate钩子自动加密
      role: 'admin',
      status: 'active'
    });

    console.log('🎉 管理员用户创建成功！');
    console.log('   用户名: admin');
    console.log('   密码: admin123456');
    console.log('   邮箱: admin@example.com');
    console.log('   角色: 管理员');
    console.log('\n🔐 安全提醒: 首次登录后请立即修改默认密码');
    
  } catch (error) {
    console.error('❌ 创建管理员用户失败:', error.message);
    if (error.name === 'SequelizeValidationError') {
      error.errors.forEach(err => {
        console.error(`   - ${err.path}: ${err.message}`);
      });
    }
  } finally {
    process.exit(0);
  }
}

// 运行创建管理员用户
createAdmin(); 