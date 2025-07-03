const request = require('supertest');
const app = require('../src/backend/src/index');

describe('🔍 API一致性测试', () => {
  let server;
  
  beforeAll(async () => {
    // 启动测试服务器
    server = app.listen(0); // 使用随机端口
  });
  
  afterAll(async () => {
    if (server) {
      await server.close();
    }
  });

  describe('POST /api/auth/login', () => {
    test('✅ 前端发送正确字段名（usernameOrEmail）后端能接收', async () => {
      const frontendRequest = {
        usernameOrEmail: 'admin@example.com',
        password: 'admin123456'
      };
      
      const response = await request(app)
        .post('/api/auth/login')
        .send(frontendRequest)
        .expect(200);
        
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('username', 'admin');
    });
    
    test('❌ 使用错误字段名（username）应该返回400错误', async () => {
      const wrongRequest = {
        username: 'admin@example.com', // 错误的字段名
        password: 'admin123456'
      };
      
      const response = await request(app)
        .post('/api/auth/login')
        .send(wrongRequest)
        .expect(400);
        
      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty('errors');
    });
    
    test('❌ 缺失必填字段应返回详细错误信息', async () => {
      const incompleteRequest = {
        usernameOrEmail: 'admin@example.com'
        // 缺失 password 字段
      };
      
      const response = await request(app)
        .post('/api/auth/login')
        .send(incompleteRequest)
        .expect(400);
        
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'password',
            message: expect.stringContaining('密码不能为空')
          })
        ])
      );
    });
    
    test('🔒 响应格式应该符合预期结构', async () => {
      const validRequest = {
        usernameOrEmail: 'admin@example.com',
        password: 'admin123456'
      };
      
      const response = await request(app)
        .post('/api/auth/login')
        .send(validRequest)
        .expect(200);
      
      // 验证响应结构
      expect(response.body).toMatchObject({
        success: expect.any(Boolean),
        token: expect.any(String),
        data: expect.objectContaining({
          id: expect.any(String),
          username: expect.any(String),
          email: expect.any(String),
          role: expect.any(String),
          is_active: expect.any(Boolean)
        })
      });
      
      // 确保敏感信息不被返回
      expect(response.body.data).not.toHaveProperty('password_hash');
      expect(response.body.data).not.toHaveProperty('password');
    });
  });

  describe('GET /api/auth/me', () => {
    let authToken;
    
    beforeAll(async () => {
      // 先登录获取token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          usernameOrEmail: 'admin@example.com',
          password: 'admin123456'
        });
      
      authToken = loginResponse.body.token;
    });
    
    test('✅ 带有效token应返回用户信息', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          username: 'admin',
          email: 'admin@example.com',
          role: 'admin'
        })
      });
    });
    
    test('❌ 无token应返回401错误', async () => {
      await request(app)
        .get('/api/auth/me')
        .expect(401);
    });
    
    test('❌ 无效token应返回401错误', async () => {
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('🔍 通用API一致性检查', () => {
    test('所有API响应都应该有success字段', async () => {
      const endpoints = [
        { method: 'get', path: '/api/auth/test', expectAuth: false }
      ];
      
      for (const endpoint of endpoints) {
        const req = request(app)[endpoint.method](endpoint.path);
        
        if (endpoint.expectAuth && authToken) {
          req.set('Authorization', `Bearer ${authToken}`);
        }
        
        const response = await req;
        
        if (response.status < 500) { // 排除服务器错误
          expect(response.body).toHaveProperty('success');
        }
      }
    });
    
    test('错误响应应该有统一格式', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({}) // 空请求体
        .expect(400);
      
      expect(response.body).toMatchObject({
        success: false,
        errors: expect.any(Array)
      });
      
      // 检查错误格式
      response.body.errors.forEach(error => {
        expect(error).toMatchObject({
          field: expect.any(String),
          message: expect.any(String)
        });
      });
    });
  });
});

// 导出供其他测试使用
module.exports = {
  testApiConsistency: true
}; 