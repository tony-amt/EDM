const { Contact, Tag, User, sequelize } = require('../../../src/models');

describe('Contact模型测试', () => {
  let testUser;
  let testTag;
  
  beforeAll(async () => {
    // await sequelize.sync({ force: true }); // 移除了，由 test/setup.js 的 afterEach 清理和准备表
    
    testUser = await User.create({
      username: 'contact_model_user',
      email: 'contact_model_user@example.com',
      password_hash: 'password123',
      name: 'Contact Model Test User', // User model has 'name', Contact has first_name, last_name
      role: 'user'
    });
    
    testTag = await Tag.create({
      name: '测试标签_contactmodel',
      // color: '#FF5733', // Tag model does not have color
      description: 'Tag for contact model tests',
      user_id: testUser.id // Use user_id
    });
  });
  
  afterAll(async () => {
    // 清理这个测试套件创建的数据
    // 顺序可能重要，先清理依赖其他模型的，或者直接用 truncate (如果模型间没有强约束)
    // Contact依赖Tag和User, Tag依赖User
    await Contact.destroy({ where: {}, truncate: true, cascade: false }); // 清理所有Contact
    await Tag.destroy({ where: { id: testTag.id }, cascade: false });
    await User.destroy({ where: { id: testUser.id }, cascade: false });
    // await sequelize.close(); // 移除了，由 test/setup.js 的 afterAll 关闭连接
  });
  
  afterEach(async () => {
    // 清理每个测试中创建的联系人数据，避免测试间干扰
    // 如果 beforeAll 中创建了 testTag，并且它在测试中被关联给多个 Contact，
    // 那么这里只清理 Contact，testTag 会在 afterAll 中被清理。
    await Contact.destroy({ where: { user_id: testUser ? testUser.id : null } }); // Use user_id
  });
  
  test('应该创建联系人', async () => {
    const contactData = {
      email: 'test_contact@example.com',
      username: '测试联系人用户',
      source: 'manual',
      // status: 'active', // Contact model does not have status
      first_name: '测试',
      last_name: '联系人',
      user_id: testUser.id // Use user_id
    };
    
    const contact = await Contact.create(contactData);
    
    expect(contact).toBeDefined();
    expect(contact.id).toBeDefined();
    expect(contact.email).toBe(contactData.email);
    expect(contact.username).toBe(contactData.username);
    expect(contact.source).toBe(contactData.source);
    expect(contact.first_name).toBe(contactData.first_name);
    expect(contact.last_name).toBe(contactData.last_name);
    // expect(contact.status).toBe(contactData.status); // Removed
    expect(contact.user_id).toBe(testUser.id);
  });
  
  test('联系人邮箱对于同一用户应该是唯一的', async () => {
    const contactData = {
      email: 'unique_contact@example.com',
      username: '唯一联系人用户',
      user_id: testUser.id // Use user_id
    };
    
    // 创建第一个联系人
    await Contact.create(contactData);
    
    // 尝试创建具有相同邮箱的联系人
    await expect(Contact.create(contactData)).rejects.toThrow();
    
    // 创建不同用户的相同邮箱联系人应该成功
    const anotherUser = await User.create({
      username: 'another_contact_user',
      email: 'another_contact_user@example.com',
      password_hash: 'password123',
      name: 'Another Contact Test User',
      role: 'user'
    });
    
    const anotherContactData = {
      ...contactData,
      user_id: anotherUser.id // Different user_id
    };
    
    const anotherContact = await Contact.create(anotherContactData);
    expect(anotherContact).toBeDefined();
    expect(anotherContact.email).toBe(contactData.email);
    
    // 清理
    await User.destroy({ where: { id: anotherUser.id } }); // Clean up the additionally created user
  });
  
  test('应该支持联系人与标签的多对多关系', async () => {
    // 创建联系人
    const contact = await Contact.create({
      email: 'tagged_contact@example.com',
      username: '带标签联系人用户',
      user_id: testUser.id // Use user_id
    });
    
    // 创建第二个标签
    const secondTag = await Tag.create({
      name: '第二标签_contactmodel',
      // color: '#33FF57', // Tag model does not have color
      description: 'Second tag for contact model tests',
      user_id: testUser.id // Use user_id
    });
    
    // 添加标签到联系人
    await contact.setTags([testTag.id, secondTag.id]);
    
    // 获取带标签的联系人
    const contactWithTags = await Contact.findByPk(contact.id, {
      include: [{model: Tag, as: 'tags'}] // Use alias 'tags' as defined in association
    });
    
    expect(contactWithTags.tags).toBeDefined(); // Check for 'tags' alias
    expect(contactWithTags.tags.length).toBe(2);
    
    // 验证标签ID
    const tagIds = contactWithTags.tags.map(tag => tag.id);
    expect(tagIds).toContain(testTag.id);
    expect(tagIds).toContain(secondTag.id);
    
    // 从联系人中移除一个标签
    await contact.removeTag(secondTag); // Can pass model instance or PK
    
    // 重新获取联系人
    const updatedContact = await Contact.findByPk(contact.id, {
        include: [{model: Tag, as: 'tags'}]
    });
    
    expect(updatedContact.tags.length).toBe(1);
    expect(updatedContact.tags[0].id).toBe(testTag.id);
    
    // 清理
    await Tag.destroy({ where: { id: secondTag.id } }); // Clean up the additionally created tag
  });
  
  test('应该支持联系人的搜索 (基于模型现有字段)', async () => {
    // 创建多个联系人
    await Contact.bulkCreate([
      {
        email: 'john.doe@example.com',
        username: 'johndoe',
        first_name: 'John',
        last_name: 'Doe',
        source: 'manual',
        user_id: testUser.id
      },
      {
        email: 'jane.smith@example.com',
        username: 'janesmith',
        first_name: 'Jane',
        last_name: 'Smith',
        source: 'import',
        tiktok_unique_id: 'janesmithtiktok',
        user_id: testUser.id
      },
      {
        email: 'bob.brown@test.co',
        username: 'bobbrown',
        first_name: 'Bob',
        last_name: 'Brown',
        source: 'manual',
        user_id: testUser.id
      }
    ]);
    
    // 搜索邮箱包含example.com的联系人
    const exampleContacts = await Contact.findAll({
      where: {
        email: { [sequelize.Op.like]: '%example.com%' },
        user_id: testUser.id
      }
    });
    
    expect(exampleContacts.length).toBe(2);
    
    // 搜索 source 为 'manual' 的联系人
    const manualContacts = await Contact.findAll({
      where: {
        source: 'manual',
        user_id: testUser.id
      }
    });
    expect(manualContacts.length).toBe(2);

    // 搜索 tiktok_unique_id 不为 null 的联系人
    const tiktokContacts = await Contact.findAll({
        where: {
            tiktok_unique_id: { [sequelize.Op.ne]: null },
            user_id: testUser.id
        }
    });
    expect(tiktokContacts.length).toBe(1);
    expect(tiktokContacts[0].email).toBe('jane.smith@example.com');

    // 复杂搜索：姓氏为 'Doe' 且 source 为 'manual' 的联系人
    const complexContacts = await Contact.findAll({
      where: {
        last_name: 'Doe',
        source: 'manual',
        user_id: testUser.id
      }
    });
    
    expect(complexContacts.length).toBe(1);
    expect(complexContacts[0].email).toBe('john.doe@example.com');
  });
  
  test('应该支持更新联系人', async () => {
    const contact = await Contact.create({
      email: 'update_contact@example.com',
      username: '待更新联系人用户',
      first_name: '待更新名',
      user_id: testUser.id // Use user_id
    });
    
    // 更新联系人
    contact.username = '已更新联系人用户';
    contact.first_name = '已更新名';
    contact.last_name = '已更新姓';
    contact.source = 'api';
    // contact.company = '新公司'; // Contact model does not have company
    // contact.status = 'inactive'; // Contact model does not have status
    await contact.save();
    
    // 重新获取联系人
    const updatedContact = await Contact.findByPk(contact.id);
    
    expect(updatedContact.username).toBe('已更新联系人用户');
    expect(updatedContact.first_name).toBe('已更新名');
    expect(updatedContact.last_name).toBe('已更新姓');
    expect(updatedContact.source).toBe('api');
    // expect(updatedContact.company).toBe('新公司'); // Removed
    // expect(updatedContact.status).toBe('inactive'); // Removed
  });
}); 