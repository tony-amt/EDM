const { setupTestEnvironment, teardownTestEnvironment, createTestContact, db } = require('./setup');
const axios = require('axios');
const API_URL = require('./setup').API_URL;

describe('联系人管理模块集成测试', () => {
  let adminUser, adminAuthToken;
  let apiClient;
  let createdContactIdByAdmin;
  let initialTestContacts = [];

  beforeAll(async () => {
    const setupData = await setupTestEnvironment();
    adminUser = setupData.adminUser;
    adminAuthToken = setupData.adminAuthToken;
    apiClient = setupData.adminApiClient;

    if (adminUser && adminUser.id) {
      initialTestContacts = [];
      for (let i = 0; i < 2; i++) {
        try {
          const contact = await createTestContact(adminUser.id, { 
            email: `initial.contact.admin${i}@example.com`,
            status: i % 2 === 0 ? 'active' : 'inactive',
            first_name: `InitialAdminContFirst${i}`,
            custom_field_1: `custom${i}`
          });
          initialTestContacts.push(contact);
        } catch (e) {
          console.error("Error creating initial contact in beforeAll:", e.message, e.stack);
        }
      }
    } else {
      console.error("Admin user not available for initial contact creation in beforeAll");
    }
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  describe('联系人创建功能', () => {
    test('创建有效联系人应成功', async () => {
      const newContactData = {
        email: 'new.valid.contact@example.com',
        firstName: 'NewValid',
        status: 'active'
      };
      const response = await apiClient.post('/contacts', newContactData);
      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveProperty('id');
      expect(response.data.data.email).toBe(newContactData.email);
      expect(response.data.data.first_name).toBe(newContactData.firstName);
      createdContactIdByAdmin = response.data.data.id;
    });

    test('创建没有邮箱的联系人应失败', async () => {
      const invalidContact = { firstName: 'NoEmailTest' };
      const response = await apiClient.post('/contacts', invalidContact);
      expect(response.status).toBe(400);
    });

    test('创建重复邮箱的联系人应失败', async () => {
      let emailToUse = 'unique.creation.test@example.com';
      if (initialTestContacts.length > 0 && initialTestContacts[0] && initialTestContacts[0].email) {
        emailToUse = initialTestContacts[0].email;
      } else {
        await apiClient.post('/contacts', { email: emailToUse, firstName: 'Temporary' });
      }
      const duplicateContactData = { email: emailToUse, firstName: 'DuplicateName' };
      const response = await apiClient.post('/contacts', duplicateContactData);
      expect(response.status).toBe(400);
    });
  });

  describe('联系人查询功能', () => {
    test('获取联系人列表应成功', async () => {
      const response = await apiClient.get('/contacts');
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toBeInstanceOf(Array);
      if (response.data.data.length > 0 && initialTestContacts.length > 0) {
        const createdEmails = initialTestContacts.map(c => c.email);
        const found = response.data.data.some(r => createdEmails.includes(r.email) && r.first_name);
      }
    });

    test('按邮箱搜索联系人应返回匹配结果', async () => {
      if (initialTestContacts.length === 0 || !initialTestContacts[0] || !initialTestContacts[0].email) {
        const c = await apiClient.post('/contacts', { email: 'search.byemail@example.com', firstName: 'Searchable' });
        if (c.data && c.data.data) initialTestContacts.push(c.data.data);
        else throw new Error("Fallback contact creation for search test failed");
      }
      const searchEmail = initialTestContacts[0].email;
      const response = await apiClient.get(`/contacts?search=${encodeURIComponent(searchEmail)}`);
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toBeInstanceOf(Array);
      expect(response.data.data.length).toBeGreaterThanOrEqual(1);
      expect(response.data.data.some(c => c.email === searchEmail && c.first_name)).toBe(true);
    });

    test('按名字搜索联系人应返回匹配结果', async () => {
      if (initialTestContacts.length === 0 || !initialTestContacts[0] || !initialTestContacts[0].first_name) {
        const c = await apiClient.post('/contacts', { email: 'search.byname@example.com', firstName: 'SearchByName' });
        if (c.data && c.data.data && c.data.data.first_name) initialTestContacts.push(c.data.data);
        else {
            console.error("Fallback contact for name search failed to create properly or missing first_name:", c.data.data);
            throw new Error("Fallback contact creation for name search test failed or missing first_name");
        }
      }
      const searchName = initialTestContacts[0].first_name;
      const response = await apiClient.get(`/contacts?search=${encodeURIComponent(searchName)}`);
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toBeInstanceOf(Array);
      expect(response.data.data.length).toBeGreaterThanOrEqual(1);
      expect(response.data.data.some(c => c.first_name === searchName)).toBe(true);
    });

    test('按状态筛选联系人应返回匹配结果', async () => {
      const searchStatus = 'active';
      const activeContactExists = initialTestContacts.some(c => c.status === searchStatus);
      if (!activeContactExists) {
         await apiClient.post('/contacts', { email: 'filter.status.active@example.com', status: searchStatus, firstName: 'StatusActive' });
      }

      const response = await apiClient.get(`/contacts?status=${searchStatus}`);
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toBeInstanceOf(Array);
      if (response.data.data.length > 0) {
        response.data.data.forEach(contact => {
          expect(contact.status).toBe(searchStatus);
        });
      }
    });

    test('获取单个联系人详情应成功', async () => {
      let contactIdToFetch = createdContactIdByAdmin;
      if (!contactIdToFetch && initialTestContacts.length > 0 && initialTestContacts[0] && initialTestContacts[0].id) {
        contactIdToFetch = initialTestContacts[0].id;
      }
      if (!contactIdToFetch) {
        const res = await apiClient.post('/contacts', { email: 'single.get.fallback@example.com', firstName: 'SingleGet' });
        if (res.data && res.data.data) contactIdToFetch = res.data.data.id;
        else throw new Error("Fallback contact creation failed for single get test");
      }
      const response = await apiClient.get(`/contacts/${contactIdToFetch}`);
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveProperty('id', contactIdToFetch);
      expect(response.data.data).toHaveProperty('first_name');
    });

    test('获取不存在的联系人应返回404', async () => {
      const response = await apiClient.get('/contacts/999999999');
      expect(response.status).toBe(404);
      expect(response.data.success).toBe(false);
    });
  });

  describe('联系人更新功能', () => {
    test('更新联系人信息应成功', async () => {
      let contactIdToUpdate = createdContactIdByAdmin;
       if (!contactIdToUpdate && initialTestContacts.length > 0 && initialTestContacts[0] && initialTestContacts[0].id) {
        contactIdToUpdate = initialTestContacts[0].id;
      }
      if (!contactIdToUpdate) {
        const res = await apiClient.post('/contacts', { email: 'update.me.fallback@example.com', firstName: 'UpdateMe' });
         if (res.data && res.data.data) contactIdToUpdate = res.data.data.id;
        else throw new Error("Fallback contact creation for update test failed");
      }

      const updatedData = { firstName: 'UpdatedNameByTest', status: 'inactive' };
      const response = await apiClient.put(`/contacts/${contactIdToUpdate}`, updatedData);
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveProperty('id', contactIdToUpdate);
      expect(response.data.data.first_name).toBe(updatedData.firstName);
      expect(response.data.data.status).toBe(updatedData.status);
    });

    test('更新不存在的联系人应返回404', async () => {
      const updatedData = { firstName: 'NoOneWillBeUpdated' };
      const response = await apiClient.put('/contacts/999999999', updatedData);
      expect(response.status).toBe(404);
      expect(response.data.success).toBe(false);
    });
  });

  describe('联系人删除功能', () => {
    test('删除联系人应成功', async () => {
      const tempContactData = { email: 'delete.me.successfully@example.com', firstName: 'DeleteMe' };
      const createResponse = await apiClient.post('/contacts', tempContactData);
      expect(createResponse.status).toBe(201);
      expect(createResponse.data.success).toBe(true);
      const tempContactId = createResponse.data.data.id;

      const deleteResponse = await apiClient.delete(`/contacts/${tempContactId}`);
      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.data.success).toBe(true);
      expect(deleteResponse.data.message).toContain('联系人删除成功');

      const getResponse = await apiClient.get(`/contacts/${tempContactId}`);
      expect(getResponse.status).toBe(404);
    });

    test('批量删除联系人应返回501 (功能待实现)', async () => {
      const response = await apiClient.post('/contacts/bulk-delete', { ids: [999999901, 999999902] });
      expect(response.status).toBe(501);
      expect(response.data.success).toBe(false);
      expect(response.data.message).toContain('功能待实现');
    });
  });
}); 