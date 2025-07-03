const { setupTestEnvironment, teardownTestEnvironment, createTestTag, createTestContact, db } = require('./setup');
const axios = require('axios');
const API_URL = require('./setup').API_URL;

describe('标签管理模块集成测试', () => {
  let testUser, authToken, adminUser, adminAuthToken; // 由 setupTestEnvironment 初始化
  let userApiClient;    // 普通用户的 HTTP 客户端
  let adminApiClient;   // 管理员的 HTTP 客户端
  let createdTagId;     // 测试中创建的标签ID
  let adminCreatedTagId; // For admin-created tag
  let userTestContact;  // beforeAll中由testUser创建的联系人
  let userCreatedTagForLinking; // Tag created by testUser for linking tests

  beforeAll(async () => {
    const setupData = await setupTestEnvironment();
    testUser = setupData.testUser;
    authToken = setupData.authToken;
    adminUser = setupData.adminUser;
    adminAuthToken = setupData.adminAuthToken;

    userApiClient = axios.create({
      baseURL: API_URL,
      validateStatus: () => true,
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    adminApiClient = axios.create({
      baseURL: API_URL,
      validateStatus: () => true,
      headers: { 'Authorization': `Bearer ${adminAuthToken}` }
    });

    // Create a contact for the testUser to be used in linking tests
    const contactRes = await userApiClient.post('/contacts', {
        firstName: 'TagLink',
        lastName: 'TestContact',
        email: 'taglink.contact@example.com'
    });
    if (contactRes.status === 201 && contactRes.data.success) {
        userTestContact = contactRes.data.data; 
    } else {
        console.error("Failed to create contact for tag linking tests in beforeAll:", contactRes.data);
        throw new Error("Setup failed: Could not create contact for tag linking.");
    }

    // Create a tag by testUser for linking tests
    const tagLinkRes = await userApiClient.post('/tags', { name: 'TagForLinking' });
    if (tagLinkRes.status === 201 && tagLinkRes.data.success) {
        userCreatedTagForLinking = tagLinkRes.data.data;
    } else {
        console.error("Failed to create tag for linking tests in beforeAll:", tagLinkRes.data);
        throw new Error("Setup failed: Could not create tag for linking.");
    }
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  describe('标签创建功能', () => {
    test('普通用户创建自己的标签应成功', async () => {
      const newTagData = { name: '用户新标签CCC' };
      const response = await userApiClient.post('/tags', newTagData);
      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveProperty('id');
      expect(response.data.data.name).toBe(newTagData.name);
      createdTagId = response.data.data.id;
    });

    test('管理员创建标签应成功', async () => {
      const newTagData = { name: '管理员新标签CCC' };
      const response = await adminApiClient.post('/tags', newTagData);
      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveProperty('id');
      expect(response.data.data.name).toBe(newTagData.name);
      adminCreatedTagId = response.data.data.id;
    });

    test('创建没有名称的标签应失败', async () => {
      const response = await userApiClient.post('/tags', { description: 'No name tag' });
      expect(response.status).toBe(400);
    });

    test('同一用户创建同名标签应失败', async () => {
      const tagName = '用户重复标签CCC';
      await userApiClient.post('/tags', { name: tagName });
      const response = await userApiClient.post('/tags', { name: tagName });
      expect(response.status).toBe(400);
    });
  });

  describe('标签查询功能', () => {
    test('获取标签列表 (用户视角)', async () => {
      const response = await userApiClient.get('/tags');
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.data)).toBe(true);
      if(createdTagId) {expect(response.data.data.some(tag => tag.id === createdTagId)).toBe(true);}
    });

    test('获取标签列表 (管理员视角)', async () => {
      const response = await adminApiClient.get('/tags');
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.data)).toBe(true);
      if (adminCreatedTagId) {
        expect(response.data.data.some(tag => tag.id === adminCreatedTagId)).toBe(true);
      }
      if (createdTagId) {
        expect(response.data.data.some(tag => tag.id === createdTagId)).toBe(true);
      }
    });

    test('获取标签树结构应成功', async () => {
      const response = await userApiClient.get('/tags/tree');
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.data)).toBe(true);
    });

    test('获取单个标签详情应成功', async () => {
      let tagIdToFetch = createdTagId;
      if (!tagIdToFetch && adminCreatedTagId) {
        tagIdToFetch = adminCreatedTagId;
      }
      if (!tagIdToFetch) {
        const tempTagRes = await userApiClient.post('/tags', {name: 'Temp Fetch Tag'});
        tagIdToFetch = tempTagRes.data.data.id;
      }

      const response = await userApiClient.get(`/tags/${tagIdToFetch}`);
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveProperty('id', tagIdToFetch);
      expect(response.data.data).not.toHaveProperty('color');
    });

    test('获取不存在的标签应返回404', async () => {
      const response = await userApiClient.get('/tags/999999');
      expect(response.status).toBe(404);
      expect(response.data.success).toBe(false);
    });
  });

  describe('标签更新功能', () => {
    test('用户更新自己的标签应成功', async () => {
      let tagIdToUpdate = createdTagId;
      if (!tagIdToUpdate) {
        const res = await userApiClient.post('/tags', {name: '临时更新用户标签'});
        if (res.status === 201 && res.data.success) tagIdToUpdate = res.data.data.id;
        else throw new Error("Failed to create fallback tag for update by user.");
      }
      const updatedData = { name: '更新后用户标签名' };
      const response = await userApiClient.put(`/tags/${tagIdToUpdate}`, updatedData);
      expect(response.status).toBe(200);
      expect(response.data.data.name).toBe(updatedData.name);
      expect(response.data.data).not.toHaveProperty('color');
    });

    test('用户尝试更新他人标签应失败 (或根据权限策略)', async () => {
      if (!adminCreatedTagId) {
        console.warn("No admin tag to test unauthorized update. Skipping.");
        return;
      }
      const response = await userApiClient.put(`/tags/${adminCreatedTagId}`, { name: '偷偷更新管理员标签' });
      expect(response.status).toBe(404);
    });

    test('管理员更新任意标签应成功', async () => {
      let tagIdToUpdate = createdTagId;
      if (!tagIdToUpdate && adminCreatedTagId) tagIdToUpdate = adminCreatedTagId;
      if (!tagIdToUpdate) {
        const res = await adminApiClient.post('/tags', {name: '临时更新管理标签'});
        if (res.status === 201 && res.data.success) tagIdToUpdate = res.data.data.id;
        else throw new Error("Failed to create fallback tag for update by admin.");
      }
      const updatedData = { name: '管理员已更新此标签' };
      const response = await adminApiClient.put(`/tags/${tagIdToUpdate}`, updatedData);
      expect(response.status).toBe(200);
      expect(response.data.data.name).toBe(updatedData.name);
      expect(response.data.data).not.toHaveProperty('color');
    });
  });

  describe('标签删除功能', () => {
    test('用户删除自己的未使用标签应成功', async () => {
      const tempTagResponse = await userApiClient.post('/tags', { name: '用户待删标签' });
      expect(tempTagResponse.status).toBe(201);
      const tempTagId = tempTagResponse.data.data.id;
      const response = await userApiClient.delete(`/tags/${tempTagId}`);
      expect(response.status).toBe(204);
      const getResponse = await userApiClient.get(`/tags/${tempTagId}`);
      expect(getResponse.status).toBe(404);
    });

    test('用户尝试删除他人标签应失败', async () => {
      if (!adminCreatedTagId) {
        console.warn("No admin tag to test unauthorized delete. Skipping.");
        return;
      }
      const response = await userApiClient.delete(`/tags/${adminCreatedTagId}`);
      expect(response.status).toBe(404);
    });
  });

  describe('标签与联系人关联功能', () => {
    test('用户给自己的联系人打上自己的标签应成功', async () => {
      console.log(`[Test Pre-check] Contact ID: ${userTestContact?.id}, Tag ID for Linking: ${userCreatedTagForLinking?.id}`);
      expect(userTestContact).toBeDefined();
      expect(userCreatedTagForLinking).toBeDefined();
      
      const response = await userApiClient.post(`/contacts/${userTestContact.id}/tags`, { tagId: userCreatedTagForLinking.id });
      console.log("[addTagToContact Test Response]", response.status, response.data);
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveProperty('contactId', userTestContact.id);
      expect(response.data.data).toHaveProperty('tagId', userCreatedTagForLinking.id);
    });

    test('用户获取自己标签关联的联系人应成功', async () => {
      expect(userCreatedTagForLinking).toBeDefined();
      const response = await userApiClient.get(`/tags/${userCreatedTagForLinking.id}/contacts`);
      console.log("[getContactsByTag Test Response]", response.status, response.data);
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toBeDefined();
      expect(Array.isArray(response.data.data.contacts)).toBe(true);
      if (userTestContact) {
          expect(response.data.data.contacts.some(c => c.id === userTestContact.id)).toBe(true);
      }
      expect(response.data.data).not.toHaveProperty('color');
    });
  });
}); 