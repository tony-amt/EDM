const request = require('supertest');
// process.env.NODE_ENV = 'test'; // test/setup.js 应该已经设置了
const { app } = require('../../src/index'); // Express app - 解构导入
const { User } = require('../../src/models'); // Sequelize User model
// const dbHelper = require('../helpers/db'); // 不再需要 MongoDB helper

describe('Auth Routes', () => {
  // beforeAll, afterAll, afterEach 都在 test/setup.js 中全局处理了
  // beforeAll(async () => {
  //   // await dbHelper.connect(); // Sequelize 连接由 setup.js 处理
  // }, 30000);

  // afterAll(async () => {
  //   // await dbHelper.closeDatabase(); // Sequelize 关闭由 setup.js 处理
  //   // await new Promise(resolve => setTimeout(() => resolve(), 500)); // 如果app.close()是异步的，可能需要
  // }, 30000);

  // beforeEach(async () => {
  //   // await dbHelper.clearDatabase(); // Sequelize 清理由 setup.js 中的 afterEach 处理
  //   // await User.destroy({ where: {}, truncate: true, cascade: true }); // 确保清理
  // });

  describe('POST /api/auth/register', () => {
    it('should register a new user and return 201', async () => {
      const userData = {
        username: 'testuser_register', // 使用唯一用户名
        email: 'test_register@example.com', // 使用唯一邮箱
        password: 'password123', // 修正：使用password而不是password_hash
        name: 'Test User Register'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // 根据实际API响应调整断言
      expect(response.body.success).toBe(true); 
      expect(response.body.message).toBe('用户注册成功');

      const user = await User.findOne({ where: { email: userData.email } });
      expect(user).toBeTruthy();
      expect(user.username).toBe(userData.username);
    });

    it('should not register a user with invalid data (e.g., missing fields)', async () => {
      const userData = {
        username: 'testuser_invalid_register',
        // email, password, name 缺失
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400); // 或API返回的实际错误码

      expect(response.body.success).toBe(false);
      // 根据实际API响应调整错误信息断言
      // expect(response.body.error.message).toContain('email is required'); 

      const user = await User.findOne({ where: { username: userData.username } });
      expect(user).toBeFalsy();
    });

    it('should not register a user with existing username', async () => {
      const existingUserData = {
        username: 'existinguser_reg',
        email: 'existing_reg@example.com',
        password_hash: 'password123',
        name: 'Existing User Reg',
        is_active: true
      };
      await User.create(existingUserData);

      const newUserData = {
        username: 'existinguser_reg', // 使用已存在的用户名
        email: 'new_reg@example.com',
        password: 'password123', // 修正：API期望password字段
        name: 'New User Reg'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(newUserData)
        .expect(400); // 或API返回的实际错误码

      expect(response.body.success).toBe(false);
      // 根据实际API响应调整错误信息断言
      expect(response.body.error.message).toContain('用户名或邮箱已存在');
    });

    it('should not register a user with existing email', async () => {
      const existingUserData = {
        username: 'anotheruser_reg_email',
        email: 'existing_email_reg@example.com',
        password_hash: 'password123',
        name: 'Another User Reg Email',
        is_active: true
      };
      await User.create(existingUserData);

      const newUserData = {
        username: 'newuser_reg_email',
        email: 'existing_email_reg@example.com', // 使用已存在的邮箱
        password: 'password123', // 修正：API期望password字段
        name: 'New User Reg Email'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(newUserData)
        .expect(400); // 或API返回的实际错误码

      expect(response.body.success).toBe(false);
      // 根据实际API响应调整错误信息断言
      expect(response.body.error.message).toContain('用户名或邮箱已存在');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // test/setup.js 的 afterEach 会清理数据库
      // 创建测试用户
      await User.create({
        username: 'loginuser',
        email: 'login@example.com',
        password_hash: 'password123', // hook会哈希
        is_active: true // 确保用户是激活的
      });
    });

    it('should login with correct username and password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          usernameOrEmail: 'loginuser', // API可能接受 username 或 email
          password: 'password123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeTruthy();
      expect(response.body.data).toMatchObject({
        username: 'loginuser',
        email: 'login@example.com'
      });
    });
    
    it('should login with correct email and password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          usernameOrEmail: 'login@example.com', // API可能接受 username 或 email
          password: 'password123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeTruthy();
      expect(response.body.data).toMatchObject({
        username: 'loginuser',
        email: 'login@example.com'
      });
    });

    it('should not login with incorrect password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          usernameOrEmail: 'loginuser',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('用户名/邮箱或密码错误');
    });

    it('should not login with non-existent username', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          usernameOrEmail: 'nonexistentuser',
          password: 'password123'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('用户名/邮箱或密码错误');
    });

    it('should not login if user is inactive', async () => {
      await User.update({ is_active: false }, { where: { username: 'loginuser' } });
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          usernameOrEmail: 'loginuser',
          password: 'password123'
        })
        .expect(403); // 修正期望状态码

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('用户账户未激活或已被禁用');
    });
  });

  describe('GET /api/auth/me', () => {
    let token;
    let testUser;

    beforeEach(async () => {
      // test/setup.js 的 afterEach 会清理数据库
      testUser = await User.create({
        username: 'me_user',
        email: 'me@example.com',
        password_hash: 'password123',
        is_active: true
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          usernameOrEmail: 'me_user',
          password: 'password123'
        });
      token = response.body.token;
    });

    it('should get current user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: testUser.id,
        username: 'me_user',
        email: 'me@example.com'
      });
    });

    it('should not get profile without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401); // Atau 403 jika tidak ada token

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('未授权');
    });

    it('should not get profile with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      // 根据实际API调整错误信息
      expect(response.body.error.message).toContain('令牌'); 
    });
  });

  describe('PUT /api/auth/password', () => {
    let token;
    let userId;

    beforeEach(async () => {
      // test/setup.js 的 afterEach 会清理数据库
      const user = await User.create({
        username: 'changepw_user',
        email: 'changepw@example.com',
        password_hash: 'oldPassword123', // 钩子处理哈希
        name: 'Change PW User',
        is_active: true
      });
      userId = user.id;

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          usernameOrEmail: 'changepw_user',
          password: 'oldPassword123'
        });
      token = response.body.token;
    });

    it('should change password with correct current password', async () => {
      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'oldPassword123',
          newPassword: 'newPassword456'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('密码修改成功');

      // 验证新密码可以登录
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          usernameOrEmail: 'changepw_user',
          password: 'newPassword456'
        })
        .expect(200);
      expect(loginResponse.body.success).toBe(true);
    });

    it('should not change password with incorrect current password', async () => {
      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'wrongOldPassword',
          newPassword: 'newPassword456'
        })
        .expect(400); // 或者 API 返回的实际状态码

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('当前密码错误');

      // 验证旧密码仍然可以登录
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          usernameOrEmail: 'changepw_user',
          password: 'oldPassword123' // 旧密码
        })
        .expect(200);
      expect(loginResponse.body.success).toBe(true);
    });

    it('should not change password without authentication', async () => {
      const response = await request(app)
        .put('/api/auth/password')
        .send({
          currentPassword: 'oldPassword123',
          newPassword: 'newPassword456'
        })
        .expect(401); // 或 403

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('未授权');
    });
  });
}); 