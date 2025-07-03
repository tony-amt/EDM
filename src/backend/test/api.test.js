const request = require('supertest');
const app = require('../src/index');
// const { connectDB, disconnectDB, sequelize } = require('../src/models'); // 移除，依赖全局 setup
const { User, Tag, Contact } = require('../src/models'); // 确保引入了测试中用到的模型

describe('API测试', () => {
  let token;
  let userId; // This will be the id of the logged-in user
  let contactId;
  let tagId;
  let createdUserForTest; // Renamed to avoid confusion with logged-in userId
  // let createdTag; // Will be created within tests as needed
  // let createdContact; // Will be created within tests as needed

  // beforeAll, afterAll, afterEach 由全局的 test/setup.js 处理
  // // 在所有测试之前连接数据库
  // beforeAll(async () => {
  //   // await connectDB(); // 移除
  // });

  // // 在所有测试之后断开数据库连接
  // afterAll(async () => {
  //   // await disconnectDB(); // 移除
  // });

  // // 清理测试数据
  // afterEach(async () => {
  //   // 由全局 setup 处理
  // });

  // 准备工作：确保有一个可登录的管理员用户
  // 由于 afterEach 会清空数据库，我们需要在每个 describe 或 test 块中按需创建数据
  // 或者在最外层的 beforeAll (由 test/setup.js 管理) 之后，创建一个持久的管理员用户
  // 但 test/setup.js 的 afterEach 会在每个测试后运行 sequelize.sync({ force: true })
  // 这意味着每个测试开始时数据库都是空的。

  describe('认证API', () => {
    beforeEach(async () => {
      // 为登录测试创建一个用户
      createdUserForTest = await User.create({ // Use createdUserForTest
        username: 'logintestuser_api', // Ensure unique username across tests
        email: 'login_api@example.com', // Ensure unique email
        password_hash: 'admin123456', // hook 会哈希
        name: 'Login Test User API',
        role: 'admin',
        is_active: true
      });
      userId = createdUserForTest.id; // Store the ID of the user being created/logged in
    });

    test('应该成功登录', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          usernameOrEmail: 'logintestuser_api',
          password: 'admin123456'
        });
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.success).toBe(true);
      expect(res.body.user.username).toBe('logintestuser_api');
      
      token = res.body.token; // Global token for subsequent tests that need an authenticated user
      // userId is already set from createdUserForTest.id in beforeEach
    });

    test('应该获取当前用户信息', async () => {
      // 先登录获取token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          usernameOrEmail: 'logintestuser_api',
          password: 'admin123456'
        });
      const localToken = loginRes.body.token;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${localToken}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.user || res.body.data).toHaveProperty('id', userId); // Check against the logged-in user's ID
      expect(res.body.success).toBe(true);
    });
  });

  // 用户相关测试 (需要 admin token)
  describe('用户管理API', () => {
    let adminToken; // Token for admin user in this block
    let adminUserId; // ID for admin user in this block

    beforeEach(async () => {
      // 创建一个管理员用户并登录以获取 token
      const adminUser = await User.create({
        username: 'admin_for_usertest_api',
        email: 'admin_user_api@example.com',
        password_hash: 'password123',
        name: 'Admin User Test API',
        role: 'admin',
        is_active: true
      });
      adminUserId = adminUser.id;

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ usernameOrEmail: 'admin_for_usertest_api', password: 'password123' });
      adminToken = loginRes.body.token;
    });

    test('应该获取用户列表 (admin)', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.success).toBe(true);
    });

    test('应该获取单个用户 (admin)', async () => {
      const res = await request(app)
        .get(`/api/users/${adminUserId}`) // 获取自己
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('id', adminUserId);
      expect(res.body.success).toBe(true);
    });
  });

  // 标签相关测试 (需要 token)
  describe('标签API', () => {
    let tagApiTestUser;
    let tagApiTestToken;

    beforeEach(async () => {
      // 创建用户并登录获取 token
      tagApiTestUser = await User.create({
        username: 'tagtestuser_api',
        email: 'tagtest_api@example.com',
        password_hash: 'password123',
        name: 'Tag Test User API',
        role: 'admin', 
        is_active: true
      });
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ usernameOrEmail: 'tagtestuser_api', password: 'password123' });
      tagApiTestToken = loginRes.body.token;
    });

    test('应该创建标签', async () => {
      const res = await request(app)
        .post('/api/tags')
        .set('Authorization', `Bearer ${tagApiTestToken}`)
        .send({
          name: 'API 测试标签',
          description: '这是一个通过API创建的测试标签' // Added description, removed color
          // color: '#FF5733' // Tag model no longer has color
        });
      
      expect(res.statusCode).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.name).toBe('API 测试标签');
      expect(res.body.data.description).toBe('这是一个通过API创建的测试标签');
      expect(res.body.success).toBe(true);
      tagId = res.body.data.id; // 保存ID供后续测试
    });

    test('应该获取标签列表', async () => {
      // 先创建一个标签确保列表不为空
      await Tag.create({ name: 'PreExisting Tag API', user_id: tagApiTestUser.id, description: "Pre-existing for list" });
      const res = await request(app)
        .get('/api/tags')
        .set('Authorization', `Bearer ${tagApiTestToken}`);
      
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.success).toBe(true);
    });

    test('应该获取标签树', async () => {
      // Create some hierarchical tags for the current user
      const parent = await Tag.create({ name: 'Parent Tag API', user_id: tagApiTestUser.id });
      await Tag.create({ name: 'Child Tag API', user_id: tagApiTestUser.id, parent_id: parent.id });

      const res = await request(app)
        .get('/api/tags/tree')
        .set('Authorization', `Bearer ${tagApiTestToken}`);
      
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      // Add more specific assertions for tree structure if needed
      // For example, check if parent tag exists and has children
      const parentTagInData = res.body.data.find(t => t.id === parent.id);
      expect(parentTagInData).toBeDefined();
      expect(parentTagInData.children).toBeDefined();
      expect(parentTagInData.children.length).toBeGreaterThanOrEqual(1);
      expect(res.body.success).toBe(true);
    });

    test('应该更新标签', async () => {
      const createdTagForUpdate = await Tag.create({ 
        name: 'TagToUpdate API', 
        user_id: tagApiTestUser.id, 
        description: 'Initial Description'
        // color: '#111111' // color removed
      });
      const res = await request(app)
        .put(`/api/tags/${createdTagForUpdate.id}`)
        .set('Authorization', `Bearer ${tagApiTestToken}`)
        .send({
          name: '更新后的API测试标签',
          description: '更新后的描述'
          // color: '#33FF57' // color removed
        });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.name).toBe('更新后的API测试标签');
      expect(res.body.data.description).toBe('更新后的描述');
      expect(res.body.success).toBe(true);
    });
  });

  // 联系人相关测试 (需要 token)
  describe('联系人API', () => {
    let contactApiTestUser;
    let contactApiTestToken;
    let contactTestTagId;


    beforeEach(async () => {
      // 创建用户并登录获取 token
      contactApiTestUser = await User.create({
        username: 'contacttestuser_api',
        email: 'contacttest_api@example.com',
        password_hash: 'password123',
        name: 'Contact Test User API',
        role: 'admin',
        is_active: true
      });
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ usernameOrEmail: 'contacttestuser_api', password: 'password123' });
      contactApiTestToken = loginRes.body.token;
      
      // 创建一个标签供联系人测试使用
      const tempTag = await Tag.create({ 
        name: 'ContactTestTag API', 
        user_id: contactApiTestUser.id, 
        description: 'Tag for contact API tests'
        // color: '#222222' // color removed
      });
      contactTestTagId = tempTag.id;
    });

    test('应该创建联系人', async () => {
      const res = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${contactApiTestToken}`)
        .send({
          email: 'contact_api@example.com',
          username: 'APITestContactUsername', // Contact model has username
          first_name: 'API测试', // Contact model has first_name
          last_name: '联系人', // Contact model has last_name
          // name: 'API测试联系人姓名', // Removed, use first_name, last_name
          tags: [contactTestTagId], // Ensure this tagId is valid for the user
          source: 'api_test'
        });
      
      expect(res.statusCode).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.email).toBe('contact_api@example.com');
      expect(res.body.data.username).toBe('APITestContactUsername');
      expect(res.body.data.first_name).toBe('API测试');
      expect(res.body.data.last_name).toBe('联系人');
      expect(res.body.data.source).toBe('api_test');
      expect(res.body.success).toBe(true);
      contactId = res.body.data.id; // 保存ID供后续测试
    });

    test('应该获取联系人列表', async () => {
      // 先创建一个联系人确保列表不为空
      await Contact.create({ 
        email: 'preexisting_api@example.com', 
        first_name: 'Pre',
        last_name: 'ContactAPI',
        user_id: contactApiTestUser.id 
      });
      const res = await request(app)
        .get('/api/contacts')
        .set('Authorization', `Bearer ${contactApiTestToken}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.success).toBe(true);
    });

    test('应该获取单个联系人', async () => {
      const createdContactForGet = await Contact.create({ 
        email: 'singlecontact_api@example.com', 
        first_name: 'Single',
        last_name: 'ContactAPI',
        user_id: contactApiTestUser.id 
      });
      const res = await request(app)
        .get(`/api/contacts/${createdContactForGet.id}`)
        .set('Authorization', `Bearer ${contactApiTestToken}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('id', createdContactForGet.id);
      expect(res.body.success).toBe(true);
    });

    test('应该更新联系人', async () => {
      const createdContactForUpdate = await Contact.create({ 
        email: 'updatecontact_api@example.com', 
        first_name: 'Update',
        last_name: 'ContactAPI',
        user_id: contactApiTestUser.id 
      });
      const res = await request(app)
        .put(`/api/contacts/${createdContactForUpdate.id}`)
        .set('Authorization', `Bearer ${contactApiTestToken}`)
        .send({
          first_name: '更新后的API联系人名',
          last_name: '更新后的API联系人姓',
          tiktok_unique_id: 'updatedTestTiktokID'
          // company: 'API测试公司' // Contact model does not have company
        });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.first_name).toBe('更新后的API联系人名');
      expect(res.body.data.last_name).toBe('更新后的API联系人姓');
      expect(res.body.data.tiktok_unique_id).toBe('updatedTestTiktokID');
      expect(res.body.success).toBe(true);
    });

    test('应该删除联系人', async () => {
      const createdContactForDelete = await Contact.create({ 
        email: 'deletecontact_api@example.com', 
        first_name: 'Delete',
        last_name: 'ContactAPI',
        user_id: contactApiTestUser.id 
      });
      const res = await request(app)
        .delete(`/api/contacts/${createdContactForDelete.id}`)
        .set('Authorization', `Bearer ${contactApiTestToken}`);
      
      expect(res.statusCode).toBe(200); // 或者 204 No Content, check API spec
      expect(res.body.success).toBe(true);

      const found = await Contact.findByPk(createdContactForDelete.id);
      expect(found).toBeNull();
    });
  });

  describe('标签清理API', () => { // Renamed for clarity, was '标签清理'
    let tagCleanupUser;
    let tagCleanupToken;
    let tagToDeleteId;

    beforeEach(async () => {
      // 创建用户并登录获取 token
      tagCleanupUser = await User.create({
        username: 'tagcleanupuser_api',
        email: 'tagcleanup_api@example.com',
        password_hash: 'password123',
        name: 'Tag Cleanup User API',
        role: 'admin',
        is_active: true
      });
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ usernameOrEmail: 'tagcleanupuser_api', password: 'password123' });
      tagCleanupToken = loginRes.body.token;
      
      // 创建一个标签供测试使用
      const tempTag = await Tag.create({ 
        name: 'TagToDelete API', 
        user_id: tagCleanupUser.id,
        description: "Tag for delete test"
        // color: '#333333' // color removed
      });
      tagToDeleteId = tempTag.id;
    });

    test('应该删除标签', async () => {
      const res = await request(app)
        .delete(`/api/tags/${tagToDeleteId}`)
        .set('Authorization', `Bearer ${tagCleanupToken}`);

      expect(res.statusCode).toBe(200); // 或者 204 No Content, check API spec
      expect(res.body.success).toBe(true);
      
      const found = await Tag.findByPk(tagToDeleteId);
      expect(found).toBeNull();
    });
  });
}); 