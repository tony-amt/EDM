// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = '1h';

const { sequelize, User, Tag, Contact, ContactTag /*, 他模型 */ } = require('../src/models');

// 全局测试前置处理
beforeAll(async () => {
  try {
    // 在所有测试开始前，强制同步一次数据库，创建所有表
    await sequelize.sync({ force: true });
    console.log('Global beforeAll: Database synchronized (force: true).');
  } catch (error) {
    console.error('Global beforeAll: Error during sequelize.sync:', error);
    throw error;
  }
});

// 全局测试后置处理
afterAll(async () => {
  try {
    await sequelize.close();
    console.log('Global afterAll: Database connection closed.');
  } catch (error) {
    console.error('Global afterAll: Error closing database connection:', error);
  }
});

// 每个测试之后清理数据库表
afterEach(async () => {
  // 清理所有已知模型的数据，避免测试间干扰
  // 顺序很重要，先清理有外键引用的子表，再清理父表
  try {
    // 1. 先删除中间表(联结表)
    if (ContactTag) {
      await ContactTag.destroy({ where: {}, truncate: { cascade: true } });
    }
    
    // 2. 再删除子表(引用外键的表)
    await Contact.destroy({ where: {}, truncate: { cascade: true } });
    await Tag.destroy({ where: {}, truncate: { cascade: true } });
    
    // 3. 最后删除父表(被引用的表)  
    await User.destroy({ where: {}, truncate: { cascade: true } });
    
  } catch (error) {
    console.error('Global afterEach: Error during data cleanup:', error);
    // 不在这里抛出错误，避免掩盖测试本身的失败，但要记录
  }
});

// 全局测试数据
global.testData = {
  admin: {
    username: 'testadmin',
    email: 'testadmin@example.com',
    password: 'Password123!',
    name: '测试管理员',
    role: 'admin'
  },
  user: {
    username: 'testuser',
    email: 'testuser@example.com',
    password: 'Password123!',
    name: '测试用户',
    role: 'user'
  },
  tag: {
    name: '测试标签',
    description: '这是一个测试标签',
    color: '#FF0000'
  },
  contact: {
    email: 'testcontact@example.com',
    name: '测试联系人',
    company: '测试公司',
    phone: '13800138000'
  }
}; 