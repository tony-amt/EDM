const { Tag, User, sequelize } = require('../../../src/models');

describe('Tag模型测试', () => {
  let testUser;
  
  beforeAll(async () => {
    // await sequelize.sync({ force: true }); // 移除了，由 test/setup.js 的 afterEach 清理和准备表
    
    // 创建测试用户，每个测试套件如果需要特定用户，可以在这里创建
    // 或者依赖一个由全局setup创建的通用测试用户
    testUser = await User.create({
      username: 'tag_model_user', // 确保用户名唯一，避免与其他测试冲突
      email: 'tag_model_user@example.com',
      password_hash: 'password123', // sequelize hook会处理
      name: 'Tag Model Test User',
      role: 'user'
    });
  });
  
  afterAll(async () => {
    // 清理这个测试套件创建的用户数据
    if (testUser) {
      await User.destroy({ where: { id: testUser.id } });
    }
    // await sequelize.close(); // 移除了，由 test/setup.js 的 afterAll 关闭连接
  });
  
  afterEach(async () => {
    // 清理这个测试套件在每个测试用例中创建的标签数据
    await Tag.destroy({ where: { user_id: testUser ? testUser.id : null } });
    // 如果有其他与标签相关的模型数据也需要清理，可以在这里添加
  });
  
  test('应该创建标签', async () => {
    const tagData = {
      name: '测试标签_tagmodel',
      description: '这是一个测试描述',
      user_id: testUser.id
    };
    
    const tag = await Tag.create(tagData);
    
    expect(tag).toBeDefined();
    expect(tag.id).toBeDefined();
    expect(tag.name).toBe(tagData.name);
    expect(tag.description).toBe(tagData.description);
    expect(tag.user_id).toBe(testUser.id);
  });
  
  test('标签名称对于同一用户和同一父标签应该是唯一的', async () => {
    // 测试根标签的唯一性 (parent_id is null)
    const rootTagData = {
      name: '唯一根标签',
      user_id: testUser.id,
      parent_id: null
    };
    
    await Tag.create(rootTagData); // 创建第一个根标签
    await expect(Tag.create(rootTagData)).rejects.toThrow(); // 尝试创建同名同用户根标签

    // 测试不同用户的同名根标签应该成功
    const anotherUser = await User.create({
      username: 'another_tag_user',
      email: 'another_tag_user@example.com',
      password_hash: 'password123',
      name: 'Another Tag User',
      role: 'user'
    });
    const anotherUserRootTagData = { ...rootTagData, user_id: anotherUser.id };
    const anotherUserRootTag = await Tag.create(anotherUserRootTagData);
    expect(anotherUserRootTag).toBeDefined();
    expect(anotherUserRootTag.name).toBe(rootTagData.name);

    // 测试子标签的唯一性
    const parentTag = await Tag.create({
      name: '父标签_唯一性测试',
      user_id: testUser.id
    });

    const childTagData1 = {
      name: '唯一子标签',
      user_id: testUser.id,
      parent_id: parentTag.id
    };
    await Tag.create(childTagData1); // 创建第一个子标签
    await expect(Tag.create(childTagData1)).rejects.toThrow(); // 尝试创建同名同用户同父标签的子标签

    // 不同父标签下的同名子标签应该成功
    const anotherParentTag = await Tag.create({
        name: '另一父标签_唯一性测试',
        user_id: testUser.id
    });
    const childTagData2 = {
        name: '唯一子标签', // 与 childTagData1 同名
        user_id: testUser.id,
        parent_id: anotherParentTag.id // 但父标签不同
    };
    const childTag2 = await Tag.create(childTagData2);
    expect(childTag2).toBeDefined();
    expect(childTag2.name).toBe(childTagData1.name);


    // 不同用户的同名同父子标签 (理论上父标签也应该属于另一用户，或者父标签可共享)
    // 此处简化为：如果父标签是同一个，但用户不同，子标签名相同，也应该可以创建
    // (假设父标签的 user_id 与子标签的 user_id 可以不同，或者说父标签是共享的 - 这取决于业务逻辑)
    // 根据当前模型定义，父标签和子标签都有各自的 user_id，通常它们应属于同一用户。
    // 但唯一性约束是 (user_id, name, parent_id)，所以如果 user_id 不同，即使 name 和 parent_id 相同，也应该允许。

    const childTagDataForAnotherUser = {
      name: '唯一子标签',
      user_id: anotherUser.id, // 不同用户
      parent_id: parentTag.id   // 同一个父标签 (属于 testUser)
    };
    // 注意：如果业务逻辑要求子标签的 user_id 必须与父标签的 user_id 一致，这里可能需要调整
    // 但基于数据库约束，这应该是允许的。
    const anotherUserChildTag = await Tag.create(childTagDataForAnotherUser);
    expect(anotherUserChildTag).toBeDefined();
    expect(anotherUserChildTag.name).toBe(childTagData1.name);
    
    // 清理
    await anotherUser.destroy();
    // parentTag, anotherParentTag, etc. will be cleaned by afterEach
  });
  
  test('应该支持父子标签关系', async () => {
    // 创建父标签
    const parentTag = await Tag.create({
      name: '父标签',
      description: '父标签描述',
      user_id: testUser.id
    });
    
    // 创建子标签
    const childTag = await Tag.create({
      name: '子标签',
      description: '子标签描述',
      parentId: parentTag.id, // Sequelize 会将 parentId 转换为 parent_id
      user_id: testUser.id
    });
    
    expect(childTag.parent_id).toBe(parentTag.id); // 校验数据库字段 parent_id
    
    // 查询带有父标签的子标签
    const childWithParent = await Tag.findByPk(childTag.id, {
      include: [{
        model: Tag,
        as: 'parent'
      }]
    });
    
    expect(childWithParent.parent).toBeDefined();
    expect(childWithParent.parent.id).toBe(parentTag.id);
    expect(childWithParent.parent.name).toBe('父标签');
    
    // 查询带有子标签的父标签
    const parentWithChildren = await Tag.findByPk(parentTag.id, {
      include: [{
        model: Tag,
        as: 'children'
      }]
    });
    
    expect(parentWithChildren.children).toBeDefined();
    expect(parentWithChildren.children.length).toBe(1);
    expect(parentWithChildren.children[0].id).toBe(childTag.id);
    expect(parentWithChildren.children[0].name).toBe('子标签');
  });
  
  test('应该支持更新标签', async () => {
    const tag = await Tag.create({
      name: '待更新标签',
      description: '旧描述',
      user_id: testUser.id
    });
    
    // 更新标签
    const updatedName = '已更新标签';
    const updatedDescription = '新描述';
    tag.name = updatedName;
    tag.description = updatedDescription;
    await tag.save();
    
    // 重新获取标签
    const updatedTag = await Tag.findByPk(tag.id);
    
    expect(updatedTag.name).toBe(updatedName);
    expect(updatedTag.description).toBe(updatedDescription);
  });
}); 