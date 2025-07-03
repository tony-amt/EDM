const { User, sequelize } = require('../../../src/models');
const bcrypt = require('bcryptjs');

describe('User模型测试', () => {
  const userData = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User',
    role: 'user'
  };
  
  // 在所有测试之前设置数据库
  beforeAll(async () => {
    // 创建表
    await sequelize.sync({ force: true });
  });
  
  // 在所有测试之后清理
  afterAll(async () => {
    // 关闭数据库连接
    await sequelize.close();
  });
  
  // 每个测试之后清理用户表
  afterEach(async () => {
    await User.destroy({ where: {}, truncate: true, cascade: true });
  });
  
  test('应该创建新用户', async () => {
    const user = await User.create(userData);
    
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.username).toBe(userData.username);
    expect(user.email).toBe(userData.email);
    expect(user.name).toBe(userData.name);
    expect(user.role).toBe(userData.role);
    // 密码应该被哈希处理
    expect(user.password).not.toBe(userData.password);
  });
  
  test('创建用户时应该自动对密码进行哈希处理', async () => {
    const user = await User.create(userData);
    
    // 验证密码是否已哈希
    const isPasswordHashed = await bcrypt.compare(userData.password, user.password);
    expect(isPasswordHashed).toBe(true);
  });
  
  test('comparePassword方法应该正确验证密码', async () => {
    const user = await User.create(userData);
    
    // 测试正确密码
    const isValidPassword = await user.comparePassword(userData.password);
    expect(isValidPassword).toBe(true);
    
    // 测试错误密码
    const isInvalidPassword = await user.comparePassword('wrongpassword');
    expect(isInvalidPassword).toBe(false);
  });
  
  test('用户名和邮箱应该是唯一的', async () => {
    // 创建第一个用户
    await User.create(userData);
    
    // 尝试创建具有相同用户名的用户
    await expect(
      User.create({
        ...userData,
        email: 'different@example.com'
      })
    ).rejects.toThrow();
    
    // 尝试创建具有相同邮箱的用户
    await expect(
      User.create({
        ...userData,
        username: 'differentuser'
      })
    ).rejects.toThrow();
  });
  
  test('应该支持更新用户信息', async () => {
    const user = await User.create(userData);
    
    // 更新用户信息
    user.name = 'Updated Name';
    user.email = 'updated@example.com';
    await user.save();
    
    // 重新获取用户
    const updatedUser = await User.findByPk(user.id);
    
    expect(updatedUser.name).toBe('Updated Name');
    expect(updatedUser.email).toBe('updated@example.com');
  });
  
  test('更新密码时应该重新哈希', async () => {
    const user = await User.create(userData);
    const originalPassword = user.password;
    
    // 更新密码
    user.password = 'newpassword123';
    await user.save();
    
    // 检查密码是否被重新哈希
    expect(user.password).not.toBe(originalPassword);
    
    // 验证新密码
    const isValidPassword = await user.comparePassword('newpassword123');
    expect(isValidPassword).toBe(true);
  });
  
  test('角色应该限制为预定义的值', async () => {
    // 尝试创建具有无效角色的用户
    await expect(
      User.create({
        ...userData,
        role: 'invalid_role'
      })
    ).rejects.toThrow();
  });
}); 