# DESIGN-003-接口规范-核心模块_v1.0.md

## 1. 概述

本文档定义了A.MT邮件冷发系统V2.0核心模块（用户认证、联系人管理、标签管理）的RESTful API接口规范。这些规范基于项目需求文档 (REQ-001)、产品需求说明书 (SPEC-002) 以及相关的数据库设计和原型设计。

**版本**: 1.0
**状态**: 初稿
**创建日期**: (自动填写当前日期)
**最后更新**: (自动填写当前日期)

## 2. 通用约定

- **Base URL**: `/api/v1` (所有API均以此为前缀)
- **认证**: 
    - 登录、注册接口外，其他所有接口均需通过请求头传递JWT Token进行认证: `Authorization: Bearer <token>`
- **请求体格式**: `application/json`
- **响应体格式**: `application/json`
- **成功响应结构**:
  ```json
  {
    "success": true,
    "data": { ... } // 或 [ ... ] 视具体接口而定
  }
  ```
- **失败响应结构**:
  ```json
  {
    "success": false,
    "error": {
      "code": "ERROR_CODE_STRING", // 如 "VALIDATION_ERROR", "UNAUTHENTICATED", "RESOURCE_NOT_FOUND"
      "message": "详细错误信息",
      "details": { ... } // 可选，包含更具体的错误细节，如字段校验错误
    }
  }
  ```
- **HTTP状态码**:
    - `200 OK`: 请求成功，通常用于GET, PUT, PATCH, DELETE。
    - `201 Created`: 资源创建成功，通常用于POST。
    - `204 No Content`: 请求成功但无返回内容，通常用于DELETE。
    - `400 Bad Request`: 请求无效（如参数错误、格式错误）。
    - `401 Unauthorized`: 未认证或认证失败。
    - `403 Forbidden`: 已认证但无权限访问。
    - `404 Not Found`: 请求的资源不存在。
    - `409 Conflict`: 资源冲突（如尝试创建已存在的唯一资源）。
    - `500 Internal Server Error`: 服务器内部错误。
- **分页参数** (用于列表接口):
    - `page` (number, optional, default: 1): 当前页码。
    - `limit` (number, optional, default: 10): 每页数量。
- **分页响应结构** (在 `data` 字段中):
  ```json
  {
    "items": [ ... ], // 当前页数据
    "totalItems": 100, // 总条目数
    "totalPages": 10, // 总页数
    "currentPage": 1, // 当前页码
    "itemsPerPage": 10 // 每页条目数
  }
  ```

## 3. 用户认证模块API (`/auth`, `/users`)

### 3.1 注册新用户

- **Endpoint**: `POST /auth/register`
- **描述**: 创建一个新用户账户。
- **请求体**:
  ```json
  {
    "username": "testuser", // String, Required, Unique
    "email": "test@example.com", // String, Required, Unique, Valid Email
    "password": "password123" // String, Required, Min 8 chars
  }
  ```
- **成功响应 (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "username": "testuser",
      "email": "test@example.com",
      "role": "operator",
      "token": "jwt.token.string"
    }
  }
  ```
- **错误响应**: `400 Bad Request` (校验失败), `409 Conflict` (用户名或邮箱已存在)。

### 3.2 用户登录

- **Endpoint**: `POST /auth/login`
- **描述**: 用户通过邮箱/用户名和密码登录，获取JWT。
- **请求体**:
  ```json
  {
    "loginIdentifier": "testuser", // String, Required (可以是username或email)
    "password": "password123" // String, Required
  }
  ```
- **成功响应 (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "username": "testuser",
      "email": "test@example.com",
      "role": "operator",
      "token": "jwt.token.string"
    }
  }
  ```
- **错误响应**: `400 Bad Request` (校验失败), `401 Unauthorized` (凭证错误)。

### 3.3 获取当前用户信息

- **Endpoint**: `GET /users/me`
- **描述**: 获取当前已登录用户的信息。
- **认证**: JWT Required
- **成功响应 (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "username": "testuser",
      "email": "test@example.com",
      "role": "operator",
      "is_active": true,
      "created_at": "timestamp",
      "updated_at": "timestamp"
    }
  }
  ```
- **错误响应**: `401 Unauthorized`.

### 3.4 更新当前用户信息 (暂定, MVP可简化)

- **Endpoint**: `PUT /users/me`
- **描述**: 更新当前已登录用户的信息（如邮箱、用户名，密码更新建议单独接口）。
- **认证**: JWT Required
- **请求体**: (字段可选，只传递需要更新的字段)
  ```json
  {
    "username": "newusername",
    "email": "newemail@example.com"
  }
  ```
- **成功响应 (200 OK)**: 返回更新后的用户信息。
- **错误响应**: `400 Bad Request` (校验失败), `401 Unauthorized`, `409 Conflict` (如果新用户名/邮箱冲突)。

### 3.5 修改当前用户密码 (暂定, MVP可简化)

- **Endpoint**: `PUT /users/me/password`
- **描述**: 修改当前已登录用户的密码。
- **认证**: JWT Required
- **请求体**:
  ```json
  {
    "currentPassword": "oldPassword123",
    "newPassword": "newSecurePassword456"
  }
  ```
- **成功响应 (204 No Content)**.
- **错误响应**: `400 Bad Request` (校验失败), `401 Unauthorized` (旧密码错误)。

## 4. 联系人管理模块API (`/contacts`)

### 4.1 创建联系人

- **Endpoint**: `POST /contacts`
- **描述**: 为当前登录用户创建一个新联系人。
- **认证**: JWT Required
- **请求体**:
  ```json
  {
    "email": "contact@example.com", // String, Required, Valid Email
    "username": "contactUser", // String, Optional
    "first_name": "Contact", // String, Optional
    "last_name": "Person", // String, Optional
    "tiktok_unique_id": "tiktok123", // String, Optional
    "instagram_id": "insta456", // String, Optional
    "youtube_id": "yt789", // String, Optional
    "custom_field_1": "value1", // Text, Optional
    // ... custom_field_2 to 5
    "tag_ids": [1, 2, 3] // Array of Integers (Tag IDs), Optional. 用于创建联系人时直接关联标签
  }
  ```
- **成功响应 (201 Created)**: 返回创建的联系人对象 (包含关联的标签信息)。
- **错误响应**: `400 Bad Request`, `401 Unauthorized`, `409 Conflict` (如果该用户下邮箱已存在)。

### 4.2 获取联系人列表

- **Endpoint**: `GET /contacts`
- **描述**: 获取当前登录用户的所有联系人，支持分页和筛选。
- **认证**: JWT Required
- **查询参数**:
    - `page` (number, optional)
    - `limit` (number, optional)
    - `search` (string, optional): 按邮箱、用户名、姓名等模糊搜索。
    - `tag_ids` (string, optional, comma-separated: "1,2,3"): 按一个或多个标签ID筛选 (AND逻辑)。
    - `sort_by` (string, optional, e.g., "email", "created_at")
    - `sort_order` (string, optional, "asc" or "desc", default: "desc")
- **成功响应 (200 OK)**: 返回分页的联系人列表。
  ```json
  {
    "success": true,
    "data": {
      "items": [
        { 
          "id": 1, "email": "contact1@example.com", /* ... other fields ... */,
          "tags": [{ "id": 1, "name": "VIP"}]
        }
      ],
      "totalItems": 1,
      "totalPages": 1,
      "currentPage": 1,
      "itemsPerPage": 10
    }
  }
  ```
- **错误响应**: `400 Bad Request`, `401 Unauthorized`.

### 4.3 获取单个联系人详情

- **Endpoint**: `GET /contacts/{id}`
- **描述**: 获取指定ID的联系人详情。
- **认证**: JWT Required
- **成功响应 (200 OK)**: 返回联系人对象 (包含关联的标签信息)。
- **错误响应**: `401 Unauthorized`, `403 Forbidden` (如果联系人不属于当前用户), `404 Not Found`.

### 4.4 更新联系人信息

- **Endpoint**: `PUT /contacts/{id}`
- **描述**: 更新指定ID的联系人信息。
- **认证**: JWT Required
- **请求体**: (与创建联系人类似，所有字段可选，只传递需要更新的字段)
  ```json
  {
    "email": "newcontact@example.com", 
    "first_name": "NewContactName",
    "tag_ids": [2, 4] // 更新关联的标签列表 (会覆盖之前的关联)
  }
  ```
- **成功响应 (200 OK)**: 返回更新后的联系人对象。
- **错误响应**: `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`.

### 4.5 删除联系人

- **Endpoint**: `DELETE /contacts/{id}`
- **描述**: 删除指定ID的联系人。
- **认证**: JWT Required
- **成功响应 (204 No Content)**.
- **错误响应**: `401 Unauthorized`, `403 Forbidden`, `404 Not Found`.

### 4.6 批量删除联系人 (暂定, MVP可简化)

- **Endpoint**: `POST /contacts/batch-delete`
- **描述**: 批量删除联系人。
- **认证**: JWT Required
- **请求体**:
  ```json
  {
    "contact_ids": [1, 2, 3] // Array of contact IDs to delete
  }
  ```
- **成功响应 (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "deleted_count": 3,
      "errors": [] // Array of objects for contacts that failed to delete, e.g., { id: 4, message: "Not found" }
    }
  }
  ```
- **错误响应**: `400 Bad Request`, `401 Unauthorized`.

### 4.7 批量为联系人打标签 (暂定, MVP可简化)

- **Endpoint**: `POST /contacts/batch-tag`
- **描述**: 为一批联系人添加一个或多个标签。
- **认证**: JWT Required
- **请求体**:
  ```json
  {
    "contact_ids": [1, 2, 3],
    "tag_ids": [4, 5] // Tags to add
  }
  ```
- **成功响应 (200 OK)**: 返回操作结果。
- **错误响应**: `400 Bad Request`, `401 Unauthorized`.

### 4.8 批量为联系人移除标签 (暂定, MVP可简化)

- **Endpoint**: `POST /contacts/batch-untag`
- **描述**: 从一批联系人中移除一个或多个标签。
- **认证**: JWT Required
- **请求体**:
  ```json
  {
    "contact_ids": [1, 2, 3],
    "tag_ids": [4, 5] // Tags to remove
  }
  ```
- **成功响应 (200 OK)**: 返回操作结果。
- **错误响应**: `400 Bad Request`, `401 Unauthorized`.

### 4.9 导入联系人 (高阶接口，具体实现细节待定)

- **Endpoint**: `POST /contacts/import`
- **描述**: 通过上传CSV/Excel文件批量导入联系人。
- **认证**: JWT Required
- **请求类型**: `multipart/form-data`
- **请求体**: 
    - `file`: 上传的文件
    - `options` (JSON string, optional): 导入选项，如字段映射、冲突处理策略、默认标签等。
- **成功响应 (202 Accepted)**: 表示导入任务已接受并在后台处理。可返回一个任务ID用于查询导入状态。
  ```json
  {
    "success": true,
    "data": { "task_id": "import-task-uuid" }
  }
  ```
- **或者 (200 OK for synchronous small imports)**: 返回导入结果统计。
- **错误响应**: `400 Bad Request` (文件格式错误、选项错误), `401 Unauthorized`.

## 5. 标签管理模块API (`/tags`)

### 5.1 创建标签

- **Endpoint**: `POST /tags`
- **描述**: 为当前登录用户创建一个新标签。
- **认证**: JWT Required
- **请求体**:
  ```json
  {
    "name": "VIP Customers", // String, Required
    "parent_id": null, // Integer, Optional, ID of parent tag for hierarchical tags
    "description": "Very important customers" // String, Optional
  }
  ```
- **成功响应 (201 Created)**: 返回创建的标签对象。
- **错误响应**: `400 Bad Request`, `401 Unauthorized`, `409 Conflict` (如果标签名在同用户同父标签下已存在)。

### 5.2 获取标签列表

- **Endpoint**: `GET /tags`
- **描述**: 获取当前登录用户的所有标签，支持分页和筛选。
- **认证**: JWT Required
- **查询参数**:
    - `page` (number, optional)
    - `limit` (number, optional)
    - `search` (string, optional): 按名称模糊搜索。
    - `parent_id` (integer, optional): 获取指定父标签下的子标签 (传 `0` 或不传获取顶级标签)。
    - `include_counts` (boolean, optional, default: false): 是否包含每个标签关联的联系人数。
- **成功响应 (200 OK)**: 返回分页的标签列表。
  ```json
  {
    "success": true,
    "data": {
      "items": [
        { "id": 1, "name": "VIP Customers", "parent_id": null, "contacts_count": 10 (if include_counts=true) }
      ],
      "totalItems": 1, 
      // ... pagination fields
    }
  }
  ```
- **错误响应**: `400 Bad Request`, `401 Unauthorized`.

### 5.3 获取单个标签详情

- **Endpoint**: `GET /tags/{id}`
- **描述**: 获取指定ID的标签详情。
- **认证**: JWT Required
- **成功响应 (200 OK)**: 返回标签对象。
- **错误响应**: `401 Unauthorized`, `403 Forbidden`, `404 Not Found`.

### 5.4 更新标签信息

- **Endpoint**: `PUT /tags/{id}`
- **描述**: 更新指定ID的标签信息。
- **认证**: JWT Required
- **请求体**: (与创建标签类似，所有字段可选)
  ```json
  {
    "name": "Premium Clients",
    "description": "Updated description"
  }
  ```
- **成功响应 (200 OK)**: 返回更新后的标签对象。
- **错误响应**: `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`.

### 5.5 删除标签

- **Endpoint**: `DELETE /tags/{id}`
- **描述**: 删除指定ID的标签。注意：删除标签时，其与联系人的关联 (`contact_tags`) 会被级联删除。
- **认证**: JWT Required
- **成功响应 (204 No Content)**.
- **错误响应**: `401 Unauthorized`, `403 Forbidden`, `404 Not Found` (如果标签有子标签，行为需明确：是禁止删除还是级联删除子标签，或将子标签提升为顶级)。

## 6. 注意事项

- 本文档定义的是核心模块的初步接口，随着项目进展和更多模块（如批量任务、邮件内容、私域管理）的引入，接口会进一步丰富和细化。
- 对于联系人导入等复杂操作，可能需要异步任务处理机制，接口设计也会相应调整。
- 批量操作的接口（如批量打标签/删除联系人）在MVP阶段可以根据优先级简化或延后实现，优先保证单个资源CRUD的健壮性。 