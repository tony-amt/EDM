const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function updateAdminPassword() {
  const client = new Client({
    host: '43.135.38.15',
    port: 5432,
    database: 'amt_mail_system',
    user: 'postgres',
    password: 'postgres'
  });

  try {
    await client.connect();
    console.log('数据库连接成功');

    // 新密码
    const newPassword = 'AdminSecure2025!';
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 更新密码
    const result = await client.query(
      'UPDATE "Users" SET password_hash = $1 WHERE username = $2',
      [hashedPassword, 'admin']
    );

    if (result.rowCount > 0) {
      console.log('✅ Admin密码已更新为: AdminSecure2025!');
    } else {
      console.log('❌ 未找到admin用户');
    }

    await client.end();
  } catch (error) {
    console.error('❌ 更新失败:', error.message);
    process.exit(1);
  }
}

updateAdminPassword(); 