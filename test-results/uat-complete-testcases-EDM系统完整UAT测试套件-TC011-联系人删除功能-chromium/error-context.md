# Test info

- Name: EDM系统完整UAT测试套件 >> TC011: 联系人删除功能
- Location: /Users/tony/Desktop/cursor/EDM/tests/e2e/uat-complete-testcases.spec.js:188:7

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
    at /Users/tony/Desktop/cursor/EDM/tests/e2e/uat-complete-testcases.spec.js:221:25
```

# Page snapshot

```yaml
- complementary:
  - text: EDM系统
  - menu:
    - menuitem "dashboard 仪表盘":
      - img "dashboard"
      - link "仪表盘":
        - /url: /
    - menuitem "user 联系人管理":
      - img "user"
      - link "联系人管理":
        - /url: /contacts
    - menuitem "tag 标签管理":
      - img "tag"
      - link "标签管理":
        - /url: /tags
    - menuitem "carry-out 任务管理":
      - img "carry-out"
      - link "任务管理":
        - /url: /tasks
    - menuitem "mail 模板管理":
      - img "mail"
      - link "模板管理":
        - /url: /templates
    - menuitem "send 发件管理":
      - img "send"
      - text: 发件管理
    - menuitem "setting 系统管理":
      - img "setting"
      - text: 系统管理
- banner:
  - img "menu-fold"
  - img "user"
  - text: admin
- main:
  - heading "联系人管理" [level=4]
  - img "search"
  - textbox "搜索联系人"
  - button "upload 导入联系人":
    - img "upload"
    - text: 导入联系人
  - button "plus 创建联系人":
    - img "plus"
    - text: 创建联系人
  - img "search"
  - textbox "搜索邮箱、用户名或社交媒体ID"
  - combobox
  - text: 按状态筛选
  - combobox
  - text: 按标签筛选
  - table:
    - rowgroup:
      - row "Select all 邮箱 用户名 社交媒体ID 标签 状态 操作":
        - columnheader "Select all":
          - checkbox "Select all"
        - columnheader "邮箱"
        - columnheader "用户名"
        - columnheader "社交媒体ID"
        - columnheader "标签"
        - columnheader "状态"
        - columnheader "操作"
    - rowgroup:
      - row "test@example.com 正常 eye edit delete":
        - cell:
          - checkbox
        - cell "test@example.com"
        - cell
        - cell
        - cell
        - cell "正常"
        - cell "eye edit delete":
          - button "eye":
            - img "eye"
          - button "edit":
            - img "edit"
          - button "delete":
            - img "delete"
  - list:
    - listitem: 共 1 个联系人
    - listitem "上一页":
      - button "left" [disabled]:
        - img "left"
    - listitem "1"
    - listitem "下一页":
      - button "right" [disabled]:
        - img "right"
    - listitem:
      - combobox "页码"
      - text: 10 条/页
```

# Test source

```ts
  121 |       // 基本检查：访问联系人页面，验证列表功能
  122 |       const navElement = page.locator('a:has-text("联系人"), a[href*="contact"]').first();
  123 |       if (await navElement.count() > 0) {
  124 |         await navElement.click();
  125 |         await page.waitForTimeout(2000);
  126 |         
  127 |         // 验证列表存在
  128 |         const listExists = await page.locator('table, .ant-table, .list').count();
  129 |         expect(listExists).toBeGreaterThan(0);
  130 |         console.log('✅ TC009测试通过 - 联系人列表功能正常');
  131 |       } else {
  132 |         console.log('❌ TC009测试失败 - 联系人页面入口未找到');
  133 |         expect(false).toBeTruthy(); // 强制失败，这是P0级测试
  134 |       }
  135 |       
  136 |     } catch (error) {
  137 |       console.error('❌ TC009测试失败:', error.message);
  138 |       throw error;
  139 |     }
  140 |   });
  141 |
  142 |   test('TC010: 联系人编辑功能', async ({ page }) => {
  143 |     console.log('🧪 P0级测试: TC010 - 联系人编辑');
  144 |     
  145 |     try {
  146 |       await doLogin(page);
  147 |       
  148 |       const navElement = page.locator('a:has-text("联系人"), a[href*="contact"]').first();
  149 |       if (await navElement.count() > 0) {
  150 |         await navElement.click();
  151 |         await page.waitForTimeout(2000);
  152 |         
  153 |         // 查找编辑按钮
  154 |         const editSelectors = [
  155 |           'button:has-text("编辑")',
  156 |           'a:has-text("编辑")',
  157 |           '.ant-btn:has-text("编辑")',
  158 |           '[title="编辑"]'
  159 |         ];
  160 |         
  161 |         let editFound = false;
  162 |         for (const selector of editSelectors) {
  163 |           const element = page.locator(selector);
  164 |           if (await element.count() > 0) {
  165 |             editFound = true;
  166 |             console.log(`✅ 找到编辑功能: ${selector}`);
  167 |             break;
  168 |           }
  169 |         }
  170 |         
  171 |         if (editFound) {
  172 |           console.log('✅ TC010测试通过 - 联系人编辑功能可访问');
  173 |         } else {
  174 |           console.log('❌ TC010测试失败 - 编辑功能未找到');
  175 |           expect(false).toBeTruthy(); // 强制失败，这是P0级测试
  176 |         }
  177 |       } else {
  178 |         console.log('❌ TC010测试失败 - 联系人页面入口未找到');
  179 |         expect(false).toBeTruthy(); // 强制失败，这是P0级测试
  180 |       }
  181 |       
  182 |     } catch (error) {
  183 |       console.error('❌ TC010测试失败:', error.message);
  184 |       throw error;
  185 |     }
  186 |   });
  187 |
  188 |   test('TC011: 联系人删除功能', async ({ page }) => {
  189 |     console.log('🧪 P0级测试: TC011 - 联系人删除');
  190 |     
  191 |     try {
  192 |       await doLogin(page);
  193 |       
  194 |       const navElement = page.locator('a:has-text("联系人"), a[href*="contact"]').first();
  195 |       if (await navElement.count() > 0) {
  196 |         await navElement.click();
  197 |         await page.waitForTimeout(2000);
  198 |         
  199 |         // 查找删除按钮
  200 |         const deleteSelectors = [
  201 |           'button:has-text("删除")',
  202 |           'a:has-text("删除")',
  203 |           '.ant-btn-danger',
  204 |           '[title="删除"]'
  205 |         ];
  206 |         
  207 |         let deleteFound = false;
  208 |         for (const selector of deleteSelectors) {
  209 |           const element = page.locator(selector);
  210 |           if (await element.count() > 0) {
  211 |             deleteFound = true;
  212 |             console.log(`✅ 找到删除功能: ${selector}`);
  213 |             break;
  214 |           }
  215 |         }
  216 |         
  217 |         if (deleteFound) {
  218 |           console.log('✅ TC011测试通过 - 联系人删除功能可访问');
  219 |         } else {
  220 |           console.log('❌ TC011测试失败 - 删除功能未找到');
> 221 |           expect(false).toBeTruthy(); // 强制失败，这是P0级测试
      |                         ^ Error: expect(received).toBeTruthy()
  222 |         }
  223 |       } else {
  224 |         console.log('❌ TC011测试失败 - 联系人页面入口未找到');
  225 |         expect(false).toBeTruthy(); // 强制失败，这是P0级测试
  226 |       }
  227 |       
  228 |     } catch (error) {
  229 |       console.error('❌ TC011测试失败:', error.message);
  230 |       throw error;
  231 |     }
  232 |   });
  233 |
  234 |   // ===================
  235 |   // P0级测试用例 - 模板基础功能 (TC023-025)
  236 |   // ===================
  237 |
  238 |   test('TC023: 模板列表正确显示', async ({ page }) => {
  239 |     console.log('🧪 P0级测试: TC023 - 模板列表');
  240 |     
  241 |     try {
  242 |       await doLogin(page);
  243 |       
  244 |       // 查找模板导航
  245 |       const templateNavigation = [
  246 |         'a:has-text("模板")',
  247 |         'a[href*="template"]',
  248 |         '.ant-menu-item:has-text("模板")'
  249 |       ];
  250 |       
  251 |       let templateFound = false;
  252 |       for (const selector of templateNavigation) {
  253 |         const element = page.locator(selector);
  254 |         if (await element.count() > 0) {
  255 |           await element.first().click();
  256 |           await page.waitForTimeout(2000);
  257 |           templateFound = true;
  258 |           console.log('✅ 访问模板页面成功');
  259 |           break;
  260 |         }
  261 |       }
  262 |       
  263 |       if (templateFound) {
  264 |         // 验证模板列表存在
  265 |         const listExists = await page.locator('table, .ant-table, .list, .ant-card').count();
  266 |         expect(listExists).toBeGreaterThan(0);
  267 |         console.log('✅ TC023测试通过 - 模板列表功能正常');
  268 |       } else {
  269 |         console.log('❌ TC023测试失败 - 模板页面入口未找到');
  270 |         expect(false).toBeTruthy(); // 强制失败，这是P0级测试
  271 |       }
  272 |       
  273 |     } catch (error) {
  274 |       console.error('❌ TC023测试失败:', error.message);
  275 |       throw error;
  276 |     }
  277 |   });
  278 |
  279 |   test('TC024: 模板创建功能', async ({ page }) => {
  280 |     console.log('🧪 P0级测试: TC024 - 模板创建');
  281 |     
  282 |     try {
  283 |       await doLogin(page);
  284 |       
  285 |       // 访问模板页面
  286 |       const templateNav = page.locator('a:has-text("模板"), a[href*="template"]').first();
  287 |       if (await templateNav.count() > 0) {
  288 |         await templateNav.click();
  289 |         await page.waitForTimeout(2000);
  290 |         
  291 |         // 查找创建模板按钮
  292 |         const createSelectors = [
  293 |           'button:has-text("新建")',
  294 |           'button:has-text("创建")',
  295 |           'button:has-text("添加模板")',
  296 |           '.ant-btn-primary'
  297 |         ];
  298 |         
  299 |         let createFound = false;
  300 |         for (const selector of createSelectors) {
  301 |           const element = page.locator(selector);
  302 |           if (await element.count() > 0) {
  303 |             createFound = true;
  304 |             console.log(`✅ 找到创建模板按钮: ${selector}`);
  305 |             break;
  306 |           }
  307 |         }
  308 |         
  309 |         if (createFound) {
  310 |           console.log('✅ TC024测试通过 - 模板创建功能可访问');
  311 |         } else {
  312 |           console.log('❌ TC024测试失败 - 创建模板按钮未找到');
  313 |           expect(false).toBeTruthy(); // 强制失败，这是P0级测试
  314 |         }
  315 |       } else {
  316 |         console.log('❌ TC024测试失败 - 模板页面入口未找到');
  317 |         expect(false).toBeTruthy(); // 强制失败，这是P0级测试
  318 |       }
  319 |       
  320 |     } catch (error) {
  321 |       console.error('❌ TC024测试失败:', error.message);
```