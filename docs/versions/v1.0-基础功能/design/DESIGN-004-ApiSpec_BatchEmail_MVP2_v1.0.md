# API 接口设计：批量发信模块 (MVP 方案二 v1.0)

**版本:** 1.0
**基础路径:** `/api/v1`

**通用约定:**
*   所有请求和响应体均为 JSON 格式。
*   成功的 GET, PUT, DELETE 请求通常返回 `200 OK`。
*   成功的 POST 请求通常返回 `201 Created`。
*   客户端错误返回 `4xx` 状态码，服务端错误返回 `5xx` 状态码。
*   认证: 通过 JWT Bearer Token 在 Authorization header 中传递。
*   分页: 使用 `page` (从1开始) 和 `limit` (默认为10或20) query 参数。
    响应中包含 `total_items`, `total_pages`, `current_page`, `items`。
*   所有ID均为 `BIGINT` 类型，在JSON中表现为数字或字符串（取决于序列化库和前端处理能力，推荐字符串以避免JS精度问题）。

## 1. 任务组 (Campaigns) - `SVC_CAMPAIGN`

### 1.1 创建任务组
*   **P05: Campaign 创建/编辑页**
*   **Endpoint:** `POST /campaigns`
*   **描述:** 创建一个新的 Campaign。
*   **请求体:**
    ```json
    {
      "name": "string (required, max 255)",
      "start_time": "datetime (ISO8601 string, optional, future time)" // 计划的首次启动时间 T
    }
    ```
*   **响应 (201 Created):**
    ```json
    {
      "id": "string (campaign_id)",
      "name": "string",
      "start_time": "datetime (ISO8601 string) | null",
      "status": "draft", // 初始状态
      "created_by": "string (user_id)",
      "created_at": "datetime (ISO8601 string)",
      "updated_at": "datetime (ISO8601 string)"
    }
    ```
*   **错误响应:**
    *   `400 Bad Request`: 参数校验失败 (e.g., name 为空, start_time 格式错误)。
    *   `401 Unauthorized`: 未认证。
    *   `403 Forbidden`: 无权限创建。

### 1.2 获取任务组列表
*   **P04: Campaign 列表页**
*   **Endpoint:** `GET /campaigns`
*   **描述:** 获取当前用户可访问的 Campaign 列表，支持分页和筛选。
*   **Query 参数:**
    *   `page`: `integer` (页码, 从1开始, 默认1)
    *   `limit`: `integer` (每页数量, 默认20)
    *   `status`: `string` (可选, 筛选状态: 'draft', 'active', 'paused', 'completed', 'cancelled')
    *   `name`: `string` (可选, 按名称模糊搜索)
    *   `sort_by`: `string` (可选, 排序字段, e.g., 'created_at', 'name', 'start_time', 默认为 'created_at')
    *   `order`: `string` (可选, 'asc' 或 'desc', 默认 'desc' 当 sort_by 为 'created_at' 时)
*   **响应 (200 OK):**
    ```json
    {
      "total_items": 150,
      "total_pages": 8,
      "current_page": 1,
      "limit": 20,
      "items": [
        {
          "id": "string (campaign_id)",
          "name": "string",
          "start_time": "datetime (ISO8601 string) | null",
          "status": "string",
          "created_by": "string (user_id)", // Consider returning username or an object if needed by UI
          "created_at": "datetime (ISO8601 string)",
          "updated_at": "datetime (ISO8601 string)",
          "task_summary": { // 简要的任务统计，可选
            "total_tasks": 5,
            "active_tasks": 2
          }
        }
        // ... more campaigns
      ]
    }
    ```

### 1.3 获取单个任务组详情
*   **P05: Campaign 创建/编辑页 (加载数据), P06: Campaign 详情页**
*   **Endpoint:** `GET /campaigns/{campaign_id}`
*   **描述:** 获取指定 Campaign 的详细信息。
*   **路径参数:**
    *   `campaign_id`: `string` (必填)
*   **响应 (200 OK):**
    ```json
    {
      "id": "string (campaign_id)",
      "name": "string",
      "start_time": "datetime (ISO8601 string) | null",
      "status": "string",
      "created_by": "string (user_id)",
      "created_at": "datetime (ISO8601 string)",
      "updated_at": "datetime (ISO8601 string)"
      // Potentially more details if needed, like associated tasks list or summary
    }
    ```
*   **错误响应:**
    *   `401 Unauthorized`
    *   `403 Forbidden`
    *   `404 Not Found`: Campaign 不存在或无权访问。

### 1.4 更新任务组信息
*   **P05: Campaign 创建/编辑页**
*   **Endpoint:** `PUT /campaigns/{campaign_id}`
*   **描述:** 更新指定 Campaign 的信息。通常只允许修改 `name` 和 `start_time`。状态通过专门的接口修改。
*   **路径参数:**
    *   `campaign_id`: `string` (必填)
*   **请求体:**
    ```json
    {
      "name": "string (optional, max 255)",
      "start_time": "datetime (ISO8601 string, optional, future time)"
    }
    ```
*   **响应 (200 OK):**
    ```json
    {
      "id": "string (campaign_id)",
      "name": "string",
      "start_time": "datetime (ISO8601 string) | null",
      "status": "string",
      "created_by": "string (user_id)",
      "created_at": "datetime (ISO8601 string)",
      "updated_at": "datetime (ISO8601 string)" // updated timestamp
    }
    ```
*   **错误响应:**
    *   `400 Bad Request`: 参数校验失败。
    *   `401 Unauthorized`
    *   `403 Forbidden`: 无权限修改或 Campaign 状态不允许修改。
    *   `404 Not Found`.

### 1.5 删除任务组
*   **P04: Campaign 列表页**
*   **Endpoint:** `DELETE /campaigns/{campaign_id}`
*   **描述:** 删除指定的 Campaign。通常只允许删除 `draft` 或 `cancelled` 状态的 Campaign，且其下没有 `active` 或 `sending` 状态的 Task。
*   **路径参数:**
    *   `campaign_id`: `string` (必填)
*   **响应 (200 OK or 204 No Content):**
    ```json
    {
      "message": "Campaign deleted successfully."
    }
    ```
*   **错误响应:**
    *   `401 Unauthorized`
    *   `403 Forbidden`: 无权限删除或 Campaign 状态/其下 Task 状态不允许删除。
    *   `404 Not Found`.
    *   `409 Conflict`: 如果有关联的活动任务，无法删除。

### 1.6 修改任务组状态
*   **P04: Campaign 列表页, P06: Campaign 详情页**
*   **Endpoint:** `POST /campaigns/{campaign_id}/status`
*   **描述:** 修改 Campaign 的状态 (e.g., 'active', 'paused', 'cancelled')。
*   **路径参数:**
    *   `campaign_id`: `string` (必填)
*   **请求体:**
    ```json
    {
      "status": "string (required, one of: 'active', 'paused', 'completed', 'cancelled')"
      // 'completed' 通常由系统根据所有 Task 完成情况自动设置
    }
    ```
*   **响应 (200 OK):**
    ```json
    {
      "id": "string (campaign_id)",
      "name": "string",
      "start_time": "datetime (ISO8601 string) | null",
      "status": "string (new_status)",
      "created_by": "string (user_id)",
      "created_at": "datetime (ISO8601 string)",
      "updated_at": "datetime (ISO8601 string)"
    }
    ```
*   **错误响应:**
    *   `400 Bad Request`: 无效的状态或状态转换不被允许。
    *   `401 Unauthorized`
    *   `403 Forbidden`
    *   `404 Not Found`.

## 2. 任务 (Tasks) - `SVC_TASK`

### 2.1 创建任务
*   **P07: Task 创建/编辑页**
*   **Endpoint:** `POST /tasks`
*   **描述:** 在一个 Campaign 下创建一个新的 Task。
*   **请求体:**
    ```json
    {
      "campaign_id": "string (required, existing campaign_id)",
      "name": "string (required, max 255)",
      "plan_time": "datetime (ISO8601 string, required, future time)", // 计划发送时间
      "recipient_rule": { // US03.1
        "type": "TAG_BASED | ALL_CONTACTS | MANUAL_LIST", // 示例
        "include_tags": ["string (tag_name_or_id)"], // type=TAG_BASED
        "exclude_tags": ["string (tag_name_or_id)"], // type=TAG_BASED
        "contact_ids": ["string (contact_id)"] // type=MANUAL_LIST
        // 其他规则类型可扩展
      },
      "template_set_id": "string (required, existing template_set_id)" // US04.2
    }
    ```
*   **响应 (201 Created):**
    ```json
    {
      "id": "string (task_id)",
      "campaign_id": "string",
      "name": "string",
      "plan_time": "datetime (ISO8601 string)",
      "status": "draft", // 初始状态
      "recipient_rule": { /*...*/ },
      "template_set_id": "string",
      "created_by": "string (user_id)",
      "created_at": "datetime (ISO8601 string)",
      "updated_at": "datetime (ISO8601 string)",
      "summary_stats": null
    }
    ```
*   **错误响应:**
    *   `400 Bad Request`: 参数校验失败 (e.g., campaign_id 不存在, template_set_id 不存在, plan_time 非未来)。
    *   `401 Unauthorized`.
    *   `403 Forbidden`.

### 2.2 获取任务列表
*   **P06: Campaign 详情页 (显示其下的 Tasks)**
*   **Endpoint:** `GET /tasks`
*   **描述:** 获取任务列表，通常会带 `campaign_id` 过滤，支持分页和筛选。
*   **Query 参数:**
    *   `campaign_id`: `string` (可选, 强烈建议用于过滤)
    *   `page`: `integer` (默认1)
    *   `limit`: `integer` (默认20)
    *   `status`: `string` (可选, 筛选状态: 'draft', 'scheduled', 'sending', 'finished', 'paused', 'failed')
    *   `name`: `string` (可选, 按名称模糊搜索)
    *   `sort_by`: `string` (可选, e.g., 'plan_time', 'created_at', 默认 'plan_time')
    *   `order`: `string` (可选, 'asc' 或 'desc', 默认 'asc' 当 sort_by 为 'plan_time')
*   **响应 (200 OK):**
    ```json
    {
      "total_items": 25,
      "total_pages": 2,
      "current_page": 1,
      "limit": 20,
      "items": [
        {
          "id": "string (task_id)",
          "campaign_id": "string",
          "name": "string",
          "plan_time": "datetime (ISO8601 string)",
          "status": "string",
          // "recipient_rule": { /* succinct representation or omit for list view */ },
          "template_set_id": "string",
          // "template_set_name": "string", // 可选，方便前端显示
          "created_by": "string (user_id)",
          "created_at": "datetime (ISO8601 string)",
          "updated_at": "datetime (ISO8601 string)",
          "summary_stats": {
            "total_recipients": 1000,
            "sent": 500,
            "failed_to_send": 10,
            "delivered": 450,
            "opened": 100,
            "clicked": 20
          } // 可选, 可能需要异步计算或单独接口获取
        }
        // ... more tasks
      ]
    }
    ```

### 2.3 获取单个任务详情
*   **P07: Task 创建/编辑页 (加载数据), P08: Task 详情/监控页**
*   **Endpoint:** `GET /tasks/{task_id}`
*   **描述:** 获取指定 Task 的详细信息。
*   **路径参数:**
    *   `task_id`: `string` (必填)
*   **响应 (200 OK):**
    ```json
    {
      "id": "string (task_id)",
      "campaign_id": "string",
      "name": "string",
      "plan_time": "datetime (ISO8601 string)",
      "status": "string",
      "recipient_rule": { /* full details */ },
      "template_set_id": "string",
      "actual_start_time": "datetime (ISO8601 string) | null",
      "actual_end_time": "datetime (ISO8601 string) | null",
      "summary_stats": { /*...*/ },
      "created_by": "string (user_id)",
      "created_at": "datetime (ISO8601 string)",
      "updated_at": "datetime (ISO8601 string)"
    }
    ```
*   **错误响应:** `401`, `403`, `404`.

### 2.4 更新任务信息
*   **P07: Task 创建/编辑页**
*   **Endpoint:** `PUT /tasks/{task_id}`
*   **描述:** 更新指定 Task 的信息。通常只允许修改 `name`, `plan_time`, `recipient_rule`, `template_set_id` 且 Task 状态为 `draft` 或 `paused`。
*   **路径参数:**
    *   `task_id`: `string` (必填)
*   **请求体:** (字段均为可选，按需提供)
    ```json
    {
      "name": "string (max 255)",
      "plan_time": "datetime (ISO8601 string, future time)",
      "recipient_rule": { /*...*/ },
      "template_set_id": "string (existing template_set_id)"
    }
    ```
*   **响应 (200 OK):** (返回更新后的 Task 对象，类似 GET 详情)
*   **错误响应:** `400`, `401`, `403` (无权限或 Task 状态不允许修改), `404`.

### 2.5 删除任务
*   **P06: Campaign 详情页 (操作 Task)**
*   **Endpoint:** `DELETE /tasks/{task_id}`
*   **描述:** 删除指定的 Task。通常只允许删除 `draft`, `failed`, `finished`, `paused` 状态的 Task。
*   **路径参数:**
    *   `task_id`: `string` (必填)
*   **响应 (200 OK or 204 No Content):**
    ```json
    {
      "message": "Task deleted successfully."
    }
    ```
*   **错误响应:** `401`, `403` (无权限或 Task 状态不允许删除), `404`.

### 2.6 修改任务状态
*   **P06: Campaign 详情页, P08: Task 详情/监控页 (操作 Task: 提交调度、暂停、取消)**
*   **Endpoint:** `POST /tasks/{task_id}/status`
*   **描述:** 修改 Task 的状态 (e.g., 'scheduled', 'paused', 'cancelled')。
    *   'scheduled': 将 `draft` 状态的任务提交给调度器。
    *   'paused': 暂停 `sending` 或 `scheduled` 状态的任务。
    *   'cancelled': 取消任务。
    *   'sending', 'finished', 'failed' 通常由系统内部更新。
*   **路径参数:**
    *   `task_id`: `string` (必填)
*   **请求体:**
    ```json
    {
      "status": "string (required, one of: 'scheduled', 'paused', 'cancelled')"
      // 'retry' 也可以考虑在此处，如果 'failed' 任务允许手动重试
    }
    ```
*   **响应 (200 OK):** (返回更新后的 Task 对象，类似 GET 详情，包含新 status)
*   **错误响应:** `400` (无效状态或状态转换不允许), `401`, `403`, `404`.

### 2.7 获取任务的收件人列表 (带状态)
*   **P08: Task 详情/监控页**
*   **Endpoint:** `GET /tasks/{task_id}/recipients`
*   **描述:** 获取指定 Task 下所有目标联系人的发送状态列表，用于展示发送进度和结果。
*   **路径参数:**
    *   `task_id`: `string` (必填)
*   **Query 参数:**
    *   `page`: `integer` (默认1)
    *   `limit`: `integer` (默认50)
    *   `status`: `string` (可选, 筛选 `task_contacts.status`)
    *   `email`: `string` (可选, 按邮箱搜索)
*   **响应 (200 OK):**
    ```json
    {
      "total_items": 1000,
      "total_pages": 20,
      "current_page": 1,
      "limit": 50,
      "items": [
        {
          "contact_id": "string",
          "email": "string",
          "nickname": "string | null",
          "status": "string (task_contacts.status: pending, sent, delivered, opened, clicked, bounced, failed_to_send)",
          "selected_template_id": "string | null",
          "sent_at": "datetime (ISO8601 string) | null",
          "error_message": "string | null",
          "event_tracking_uid": "string | null"
        }
        // ... more recipients
      ]
    }
    ```
*   **错误响应:** `401`, `403`, `404`.

### 2.8 获取任务的统计报告
*   **P08: Task 详情/监控页**
*   **Endpoint:** `GET /tasks/{task_id}/report`
*   **描述:** 获取指定 Task 的详细统计数据。
*   **路径参数:**
    *   `task_id`: `string` (必填)
*   **响应 (200 OK):**
    ```json
    {
      "task_id": "string",
      "task_name": "string",
      "status": "string",
      "plan_time": "datetime (ISO8601 string)",
      "actual_start_time": "datetime (ISO8601 string) | null",
      "actual_end_time": "datetime (ISO8601 string) | null",
      "summary_stats": {
        "total_recipients": 1000, // 目标总数，来自 recipient_rule 解析
        "processed_recipients": 950, // 已尝试处理的收件人数 (生成了 task_contacts)
        "pending_dispatch": 50, // 待处理 (未进入 worker)
        "sending_attempts": 900, // 已尝试发送的API调用次数 (可能大于 processed_recipients 如果有重试)
        "sent_successfully_api": 880, // API调用成功数
        "failed_to_send_api": 20, // API调用失败数
        "delivered": 800, // 送达数 (来自追踪或回执)
        "bounced_hard": 15,
        "bounced_soft": 5,
        "opened": 200, // 打开数
        "clicked": 50, // 点击数 (独立点击用户数可能需要额外计算)
        "unsubscribed": 5
      },
      "timeline_stats": [ // 可选，按时间聚合的统计，例如每小时发送量/打开率
        {
          "time_bucket": "YYYY-MM-DDTHH:00:00Z",
          "sent": 100,
          "opened": 20
        }
      ]
      // 还可以包含 top_links_clicked, open_by_device_type 等更详细的统计
    }
    ```
*   **错误响应:** `401`, `403`, `404`.

## 3. 邮件模板 (Templates) - `SVC_TEMPLATE`

### 3.1 创建邮件模板
*   **P02: 邮件模板编辑/创建页**
*   **Endpoint:** `POST /templates`
*   **描述:** 创建一个新的邮件模板。
*   **请求体:**
    ```json
    {
      "name": "string (required, max 255)",
      "subject": "string (required, max 500, supports variables like {{contact.nickname}})",
      "body": "string (required, HTML content, supports variables)"
    }
    ```
*   **响应 (201 Created):**
    ```json
    {
      "id": "string (template_id)",
      "name": "string",
      "subject": "string",
      "body": "string (HTML)",
      "created_by": "string (user_id)",
      "created_at": "datetime (ISO8601 string)",
      "updated_at": "datetime (ISO8601 string)"
    }
    ```
*   **错误响应:** `400`, `401`, `403`.

### 3.2 获取邮件模板列表
*   **P01: 邮件模板列表页**
*   **Endpoint:** `GET /templates`
*   **描述:** 获取邮件模板列表，支持分页和筛选。
*   **Query 参数:**
    *   `page`: `integer` (默认1)
    *   `limit`: `integer` (默认20)
    *   `name`: `string` (可选, 按名称模糊搜索)
    *   `subject`: `string` (可选, 按主题模糊搜索)
    *   `sort_by`: `string` (可选, e.g., 'name', 'created_at', 默认 'created_at')
    *   `order`: `string` (可选, 'asc' 或 'desc', 默认 'desc')
*   **响应 (200 OK):**
    ```json
    {
      "total_items": 50,
      "total_pages": 3,
      "current_page": 1,
      "limit": 20,
      "items": [
        {
          "id": "string (template_id)",
          "name": "string",
          "subject": "string",
          // "body_preview": "string (first 100 chars or so, optional)",
          "created_by": "string (user_id)",
          "created_at": "datetime (ISO8601 string)",
          "updated_at": "datetime (ISO8601 string)"
        }
        // ... more templates
      ]
    }
    ```

### 3.3 获取单个邮件模板详情
*   **P02: 邮件模板编辑/创建页 (加载数据), P03: 模板预览页**
*   **Endpoint:** `GET /templates/{template_id}`
*   **描述:** 获取指定邮件模板的完整内容。
*   **路径参数:**
    *   `template_id`: `string` (必填)
*   **响应 (200 OK):**
    ```json
    {
      "id": "string (template_id)",
      "name": "string",
      "subject": "string",
      "body": "string (HTML)",
      "created_by": "string (user_id)",
      "created_at": "datetime (ISO8601 string)",
      "updated_at": "datetime (ISO8601 string)"
    }
    ```
*   **错误响应:** `401`, `403`, `404`.

### 3.4 更新邮件模板
*   **P02: 邮件模板编辑/创建页**
*   **Endpoint:** `PUT /templates/{template_id}`
*   **描述:** 更新指定邮件模板的内容。
*   **路径参数:**
    *   `template_id`: `string` (必填)
*   **请求体:** (字段均为可选，按需提供)
    ```json
    {
      "name": "string (max 255)",
      "subject": "string (max 500)",
      "body": "string (HTML content)"
    }
    ```
*   **响应 (200 OK):** (返回更新后的 Template 对象)
*   **错误响应:** `400`, `401`, `403`, `404`.

### 3.5 删除邮件模板
*   **P01: 邮件模板列表页**
*   **Endpoint:** `DELETE /templates/{template_id}`
*   **描述:** 删除指定的邮件模板。如果模板被任何 `template_sets` 引用，可能需要先解除引用或禁止删除。
*   **路径参数:**
    *   `template_id`: `string` (必填)
*   **响应 (200 OK or 204 No Content):**
    ```json
    {
      "message": "Template deleted successfully."
    }
    ```
*   **错误响应:** `401`, `403`, `404`, `409 Conflict` (如果被引用且策略为禁止删除)。

### 3.6 预览邮件模板 (可选)
*   **P03: 模板预览页**
*   **Endpoint:** `POST /templates/preview` or `POST /templates/{template_id}/preview`
*   **描述:** 预览邮件模板渲染后的效果，可以传入示例联系人数据。
*   **请求体:**
    ```json
    {
      "template_id": "string (optional, if not in path)", 
      "template_content": { // 或者直接提供临时内容进行预览
         "subject": "string",
         "body": "string (HTML)"
      },
      "sample_contact_data": { // 模拟 contact 对象中的字段
        "nickname": "Test User",
        "email": "test@example.com",
        "tags": ["VIP"]
        // ...其他在 email_variables 中定义的 contact 字段
      },
      "sample_system_data": { // 模拟系统变量
        "unsubscribe_link": "#unsubscribe-preview",
        "view_in_browser_link": "#view-in-browser-preview"
      }
    }
    ```
*   **响应 (200 OK):**
    ```json
    {
      "rendered_subject": "string",
      "rendered_body": "string (HTML with variables replaced)"
    }
    ```
*   **错误响应:** `400`, `404` (如果指定 template_id 且不存在)。

## 4. 模板组 (Template Sets) - `SVC_TEMPLATE`

### 4.1 创建模板组
*   **P09: 模板组管理页 (类似 P01)**
*   **Endpoint:** `POST /template-sets`
*   **描述:** 创建一个新的模板组。
*   **请求体:**
    ```json
    {
      "name": "string (required, max 255)",
      "items": [ // US04.1
        {
          "template_id": "string (required, existing template_id)",
          "order": "integer (required, non-negative, for sequence)"
        }
        // ... more template items
      ]
    }
    ```
*   **响应 (201 Created):**
    ```json
    {
      "id": "string (template_set_id)",
      "name": "string",
      "created_by": "string (user_id)",
      "created_at": "datetime (ISO8601 string)",
      "updated_at": "datetime (ISO8601 string)",
      "items": [
        {
          "template_id": "string",
          "template_name": "string (for display)", // 可选
          "order": "integer"
        }
      ]
    }
    ```
*   **错误响应:** `400` (e.g., template_id 不存在, items 为空, order 重复), `401`, `403`.

### 4.2 获取模板组列表
*   **P09: 模板组管理页, P07 Task 创建/编辑页 (选择模板组)**
*   **Endpoint:** `GET /template-sets`
*   **描述:** 获取模板组列表。
*   **Query 参数:**
    *   `page`, `limit`, `name` (search), `sort_by`, `order` (同模板列表)
*   **响应 (200 OK):**
    ```json
    {
      "total_items": 20,
      "total_pages": 1,
      "current_page": 1,
      "limit": 20,
      "items": [
        {
          "id": "string (template_set_id)",
          "name": "string",
          "item_count": 3, // 包含的模板数量
          "created_by": "string (user_id)",
          "created_at": "datetime (ISO8601 string)",
          "updated_at": "datetime (ISO8601 string)"
        }
      ]
    }
    ```

### 4.3 获取单个模板组详情
*   **P09: 模板组管理页 (编辑时加载)**
*   **Endpoint:** `GET /template-sets/{template_set_id}`
*   **描述:** 获取指定模板组的详细信息，包括其包含的模板。
*   **路径参数:**
    *   `template_set_id`: `string` (必填)
*   **响应 (200 OK):** (类似创建时的响应)
    ```json
    {
      "id": "string (template_set_id)",
      "name": "string",
      "created_by": "string (user_id)",
      "created_at": "datetime (ISO8601 string)",
      "updated_at": "datetime (ISO8601 string)",
      "items": [
        {
          "template_id": "string",
          "template_name": "string (for display)",
          "template_subject_preview": "string (for display)",
          "order": "integer"
        }
      ]
    }
    ```
*   **错误响应:** `401`, `403`, `404`.

### 4.4 更新模板组
*   **P09: 模板组管理页**
*   **Endpoint:** `PUT /template-sets/{template_set_id}`
*   **描述:** 更新指定模板组的名称或其包含的模板及顺序。
*   **路径参数:**
    *   `template_set_id`: `string` (必填)
*   **请求体:**
    ```json
    {
      "name": "string (optional, max 255)",
      "items": [ // 提供完整的 items 列表以替换现有
        {
          "template_id": "string (required)",
          "order": "integer (required)"
        }
      ]
    }
    ```
*   **响应 (200 OK):** (返回更新后的 TemplateSet 对象)
*   **错误响应:** `400`, `401`, `403`, `404`.

### 4.5 删除模板组
*   **P09: 模板组管理页**
*   **Endpoint:** `DELETE /template-sets/{template_set_id}`
*   **描述:** 删除指定的模板组。如果模板组被任何 `tasks` 引用，可能需要先解除引用或禁止删除。
*   **路径参数:**
    *   `template_set_id`: `string` (必填)
*   **响应 (200 OK or 204 No Content):**
*   **错误响应:** `401`, `403`, `404`, `409 Conflict` (如果被引用)。

## 5. 邮件变量 (Email Variables) - `SVC_TEMPLATE` (通常为管理员操作)

### 5.1 创建邮件变量定义
*   **P11: 邮件变量全局管理页**
*   **Endpoint:** `POST /settings/variables` (路径可能调整，如 `/admin/email-variables`)
*   **描述:** 定义一个新的全局邮件变量。
*   **请求体:**
    ```json
    {
      "variable_key": "string (required, unique, e.g., contact.nickname, system.date)",
      "display_name": "string (required, for UI selection)",
      "source_type": "string (required, ENUM: 'CONTACT_FIELD', 'CONTACT_TAG', 'SYSTEM')",
      "source_details": { // 根据 source_type 不同而不同
        // if CONTACT_FIELD: { "field_name": "nickname" }
        // if CONTACT_TAG: { "tag_pattern": "prefix:*" } // (更复杂，可能只是检查是否存在)
        // if SYSTEM: { "generator": "current_date", "format": "YYYY-MM-DD" }
      },
      "description": "string (optional)"
    }
    ```
*   **响应 (201 Created):** (返回创建的 Variable 对象)
*   **错误响应:** `400` (key 重复, source_type 无效), `401`, `403` (非管理员)。

### 5.2 获取邮件变量定义列表
*   **P11: 邮件变量全局管理页, P02: 邮件模板编辑器 (用于变量选择器)**
*   **Endpoint:** `GET /settings/variables`
*   **描述:** 获取所有已定义的邮件变量。
*   **Query 参数:**
    *   `source_type`: `string` (可选, 筛选)
*   **响应 (200 OK):**
    ```json
    {
      "items": [
        {
          "id": "string (variable_id)",
          "variable_key": "string",
          "display_name": "string",
          "source_type": "string",
          "source_details": { /*...*/ },
          "description": "string | null",
          "created_by": "string (user_id)",
          "created_at": "datetime (ISO8601 string)",
          "updated_at": "datetime (ISO8601 string)"
        }
      ]
    }
    ```

### 5.3 获取单个邮件变量定义
*   **P11: 邮件变量全局管理页 (编辑时加载)**
*   **Endpoint:** `GET /settings/variables/{variable_id_or_key}`
*   **路径参数:**
    *   `variable_id_or_key`: `string` (ID 或 variable_key)
*   **响应 (200 OK):** (同上单个 item 结构)
*   **错误响应:** `401`, `403`, `404`.

### 5.4 更新邮件变量定义
*   **P11: 邮件变量全局管理页**
*   **Endpoint:** `PUT /settings/variables/{variable_id_or_key}`
*   **请求体:** (字段均为可选，variable_key 一般不允许修改)
    ```json
    {
      "display_name": "string",
      "source_type": "string (ENUM)",
      "source_details": { /*...*/ },
      "description": "string"
    }
    ```
*   **响应 (200 OK):** (返回更新后的 Variable 对象)
*   **错误响应:** `400`, `401`, `403`, `404`.

### 5.5 删除邮件变量定义
*   **P11: 邮件变量全局管理页**
*   **Endpoint:** `DELETE /settings/variables/{variable_id_or_key}`
*   **响应 (200 OK or 204 No Content):**
*   **错误响应:** `401`, `403`, `404`.

## 6. 发件服务管理 (Sender Services) - `ROUTING_SVC` (管理员操作)

### 6.1 创建发件服务
*   **P_ADMIN_01: 发件服务管理页**
*   **Endpoint:** `POST /admin/sender-services`
*   **请求体:**
    ```json
    {
      "name": "string (required)",
      "type": "string (required, e.g., 'jiguang', 'smtp')", // ENUM
      "credentials": { // 加密存储
        // if jiguang: { "api_key": "string", "api_secret": "string" }
        // if smtp: { "host": "string", "port": "integer", "username": "string", "password": "string", "encryption": "none|ssl|tls" }
      },
      "daily_quota": "integer (required, 0 for unlimited)",
      "throttle_sec": "integer (required, min 0 or 1, seconds between emails from this service)"
    }
    ```
*   **响应 (201 Created):**
    ```json
    {
      "id": "string (service_id)",
      "name": "string",
      "type": "string",
      // "credentials": "object (masked or not returned for security)",
      "daily_quota": "integer",
      "used_today": 0,
      "throttle_sec": "integer",
      "health_status": "active", // initial status
      "created_at": "datetime",
      "updated_at": "datetime"
    }
    ```
*   **错误响应:** `400`, `401`, `403`.

### 6.2 获取发件服务列表
*   **P_ADMIN_01: 发件服务管理页, P_ADMIN_03: 用户与发件服务关联页 (选择服务)**
*   **Endpoint:** `GET /admin/sender-services`
*   **Query 参数:** `page`, `limit`, `name` (search), `type`, `health_status`
*   **响应 (200 OK):**
    ```json
    {
      "total_items": 10,
      "items": [
        {
          "id": "string",
          "name": "string",
          "type": "string",
          "daily_quota": "integer",
          "used_today": "integer",
          "throttle_sec": "integer",
          "health_status": "string (active, frozen)",
          "last_error_at": "datetime | null",
          "consecutive_errors": "integer"
        }
      ]
    }
    ```

### 6.3 获取单个发件服务详情
*   **P_ADMIN_01: 发件服务管理页 (编辑时加载)**
*   **Endpoint:** `GET /admin/sender-services/{service_id}`
*   **响应 (200 OK):** (同上列表单个 item，可能会包含未屏蔽的 credentials 用于编辑，需小心处理)
*   **错误响应:** `401`, `403`, `404`.

### 6.4 更新发件服务
*   **P_ADMIN_01: 发件服务管理页**
*   **Endpoint:** `PUT /admin/sender-services/{service_id}`
*   **请求体:** (类似创建，但通常不直接更新 `used_today`)
    ```json
    {
      "name": "string",
      "type": "string",
      "credentials": { /*...*/ }, // Can be partial if only updating one part like password
      "daily_quota": "integer",
      "throttle_sec": "integer",
      "health_status": "string (active, frozen)" // Admin can manually freeze
    }
    ```
*   **响应 (200 OK):** (返回更新后的对象)
*   **错误响应:** `400`, `401`, `403`, `404`.

### 6.5 删除发件服务
*   **P_ADMIN_01: 发件服务管理页**
*   **Endpoint:** `DELETE /admin/sender-services/{service_id}`
*   **描述:** 如果服务被用户关联或正在被任务使用，可能需要有相应处理逻辑 (禁止或警告)。
*   **错误响应:** `401`, `403`, `404`, `409 Conflict`.

### 6.6 重置发件服务当日用量 (系统内部，或管理员手动)
*   **Endpoint:** `POST /admin/sender-services/{service_id}/reset-usage`
*   **描述:** 将 `used_today` 和 `consecutive_errors` 清零。通常由定时任务每日执行。
*   **错误响应:** `401`, `403`, `404`.

## 7. 用户与发件服务关联 - `ROUTING_SVC` (管理员操作)

### 7.1 获取某用户可用的发件服务列表
*   **P_ADMIN_03: 用户与发件服务关联页 (左栏用户选择后，显示其已关联服务)**
*   **Endpoint:** `GET /admin/users/{user_id}/sender-services`
*   **路径参数:**
    *   `user_id`: `string`
*   **响应 (200 OK):**
    ```json
    {
      "items": [
        {
          "sender_service_id": "string",
          "name": "string (service name for display)",
          "type": "string (service type)",
          "assigned_at": "datetime"
        }
      ]
    }
    ```
*   **错误响应:** `401`, `403`, `404` (用户不存在)。

### 7.2 为用户分配/取消分配发件服务
*   **P_ADMIN_03: 用户与发件服务关联页 (右栏选择服务后，点击添加/移除)**
*   **Endpoint:** `POST /admin/users/{user_id}/sender-services`
*   **描述:** 批量添加或移除用户与发件服务的关联。
*   **路径参数:**
    *   `user_id`: `string`
*   **请求体:**
    ```json
    {
      "assignments": [
        {
          "sender_service_id": "string (required)",
          "action": "string (required, ENUM: 'add', 'remove')"
        }
      ]
    }
    ```
*   **响应 (200 OK):**
    ```json
    {
      "message": "Assignments updated successfully.",
      "updated_assignments": [
         {
           "user_id": "string",
           "sender_service_id": "string",
           "status": "added | removed | unchanged (e.g. already_added)"
         }
      ]
    }
    ```
*   **错误响应:** `400` (service_id 不存在, action 无效), `401`, `403`, `404`.

## 8. 邮件追踪 (Tracking) - `SVC_TASK` / `TRACKING_ENDPOINT`

### 8.1 追踪邮件打开 (Pixel)
*   **邮件内容中嵌入: `<img src="{api_base_url}/track/open/{event_tracking_uid}.gif">`**
*   **Endpoint:** `GET /track/open/{event_tracking_uid}.gif` (通常不需要API版本前缀，部署在根路径或特定子路径)
*   **描述:** 当邮件中的追踪像素被加载时调用。记录 `open` 事件到 `event_log`，更新 `task_contacts` 状态。
*   **路径参数:**
    *   `event_tracking_uid`: `string` (来自 `task_contacts.event_tracking_uid`)
*   **响应 (200 OK):**
    *   **Headers:** `Content-Type: image/gif`
    *   **Body:** 一个1x1的透明GIF图片数据。
*   **注意:** 此接口应快速响应，无复杂逻辑，主要为记录。

### 8.2 追踪链接点击
*   **邮件内容中的链接改写为: `{api_base_url}/track/click/{event_tracking_uid}?url={encoded_original_url}`**
*   **Endpoint:** `GET /track/click/{event_tracking_uid}`
*   **描述:** 当邮件中的追踪链接被点击时调用。记录 `click` 事件，然后302重定向到原始URL。
*   **路径参数:**
    *   `event_tracking_uid`: `string`
*   **Query 参数:**
    *   `url`: `string` (URL encoded, 原始目标链接)
*   **响应 (302 Found):**
    *   **Headers:** `Location: {decoded_original_url}`
*   **注意:** 记录 `click` 事件，包含被点击的 `original_url`。

---
文档版本: v1.0
最后更新: {{CURRENT_DATE}} 