#!/usr/bin/env node

/**
 * 清理测试数据脚本
 * 清理所有测试相关的数据，保留基础配置
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../src/backend/.env') });

// 引入数据库模型
const db = require('../src/backend/src/models');

async function clearTestData() {
  console.log('🧹 开始清理测试数据...\n');

  try {
    // 确保数据库连接
    await db.sequelize.authenticate();
    console.log('✅ 数据库连接成功');

    // 清理顺序很重要，先清理有外键依赖的表
    console.log('\n📋 清理数据表:');

    // 1. 清理任务联系人关联表
    const taskContactsDeleted = await db.TaskContact.destroy({
      where: {},
      force: true
    });
    console.log(`  - TaskContact: 删除 ${taskContactsDeleted} 条记录`);

    // 2. 清理联系人标签关联表
    const contactTagsDeleted = await db.ContactTag.destroy({
      where: {},
      force: true
    });
    console.log(`  - ContactTag: 删除 ${contactTagsDeleted} 条记录`);

    // 3. 清理任务表
    const tasksDeleted = await db.Task.destroy({
      where: {},
      force: true
    });
    console.log(`  - Task: 删除 ${tasksDeleted} 条记录`);

    // 4. 清理联系人表
    const contactsDeleted = await db.Contact.destroy({
      where: {},
      force: true
    });
    console.log(`  - Contact: 删除 ${contactsDeleted} 条记录`);

    // 5. 清理模板集合项表
    const templateSetItemsDeleted = await db.TemplateSetItem.destroy({
      where: {},
      force: true
    });
    console.log(`  - TemplateSetItem: 删除 ${templateSetItemsDeleted} 条记录`);

    // 6. 清理模板集合表
    const templateSetsDeleted = await db.TemplateSet.destroy({
      where: {},
      force: true
    });
    console.log(`  - TemplateSet: 删除 ${templateSetsDeleted} 条记录`);

    // 7. 清理模板表
    const templatesDeleted = await db.Template.destroy({
      where: {},
      force: true
    });
    console.log(`  - Template: 删除 ${templatesDeleted} 条记录`);

    // 8. 清理邮件变量表
    const emailVariablesDeleted = await db.EmailVariable.destroy({
      where: {},
      force: true
    });
    console.log(`  - EmailVariable: 删除 ${emailVariablesDeleted} 条记录`);

    // 9. 清理标签表 (保留系统必要标签)
    const tagsDeleted = await db.Tag.destroy({
      where: {
        // 不删除系统预设标签
        name: {
          [db.Sequelize.Op.notIn]: ['VIP客户', '潜在客户', '活跃用户']
        }
      },
      force: true
    });
    console.log(`  - Tag: 删除 ${tagsDeleted} 条记录 (保留系统标签)`);

    // 10. 清理事件日志表
    const eventLogsDeleted = await db.EventLog.destroy({
      where: {},
      force: true
    });
    console.log(`  - EventLog: 删除 ${eventLogsDeleted} 条记录`);

    // 11. 清理营销活动表
    const campaignsDeleted = await db.Campaign.destroy({
      where: {},
      force: true
    });
    console.log(`  - Campaign: 删除 ${campaignsDeleted} 条记录`);

    console.log('\n✅ 测试数据清理完成！');
    console.log('\n📊 清理汇总:');
    console.log(`  - 联系人数据: ${contactsDeleted} 条`);
    console.log(`  - 模板数据: ${templatesDeleted} 条`);
    console.log(`  - 任务数据: ${tasksDeleted} 条`);
    console.log(`  - 标签数据: ${tagsDeleted} 条`);
    console.log(`  - 营销活动: ${campaignsDeleted} 条`);
    console.log(`  - 事件日志: ${eventLogsDeleted} 条`);

  } catch (error) {
    console.error('❌ 清理数据时发生错误:', error.message);
    console.error('详细错误:', error);
  } finally {
    // 关闭数据库连接
    await db.sequelize.close();
    console.log('\n🔌 数据库连接已关闭');
  }
}

// 执行清理
if (require.main === module) {
  clearTestData().catch(error => {
    console.error('清理脚本执行失败:', error);
    process.exit(1);
  });
}

module.exports = { clearTestData }; 