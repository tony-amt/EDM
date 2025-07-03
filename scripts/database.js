#!/usr/bin/env node

/**
 * 数据库管理脚本
 * 提供数据库重置、清空等功能
 */

const { connectDB, sequelize } = require('../src/backend/src/models');

async function resetDatabase() {
  console.log('⚠️  正在重置数据库（清空所有数据）...');
  try {
    await connectDB();
    await sequelize.sync({ force: true });
    console.log('✅ 数据库重置完成！');
  } catch (error) {
    console.error('❌ 数据库重置失败:', error);
  } finally {
    process.exit(0);
  }
}

async function alterDatabase() {
  console.log('🔧 正在更新数据库结构（保留数据）...');
  try {
    await connectDB();
    await sequelize.sync({ alter: true });
    console.log('✅ 数据库结构更新完成！');
  } catch (error) {
    console.error('❌ 数据库结构更新失败:', error);
  } finally {
    process.exit(0);
  }
}

async function checkDatabase() {
  console.log('🔍 检查数据库连接...');
  try {
    await connectDB();
    console.log('✅ 数据库连接正常！');
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
  } finally {
    process.exit(0);
  }
}

// 处理命令行参数
const command = process.argv[2];

switch (command) {
  case 'reset':
    console.log('⚠️  警告：此操作将清空所有数据！');
    console.log('如需继续，请等待3秒...');
    setTimeout(resetDatabase, 3000);
    break;
  case 'alter':
    alterDatabase();
    break;
  case 'check':
    checkDatabase();
    break;
  default:
    console.log('EDM数据库管理工具');
    console.log('');
    console.log('使用方法:');
    console.log('  node scripts/database.js check  - 检查数据库连接');
    console.log('  node scripts/database.js alter  - 更新数据库结构（保留数据）');
    console.log('  node scripts/database.js reset  - 重置数据库（⚠️ 清空所有数据）');
    console.log('');
    process.exit(0);
} 