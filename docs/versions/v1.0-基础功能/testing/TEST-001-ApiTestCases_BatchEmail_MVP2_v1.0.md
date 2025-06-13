# 测试用例：批量发信模块 API (MVP 方案二 v1.0)

**文档目标：** 确保API接口按照规范 (`DESIGN-004-ApiSpec_BatchEmail_MVP2_v1.0.md`) 正确实现，覆盖功能、安全、性能（初步）和错误处理等方面。

**通用测试前提：**
*   有效的JWT Token用于认证。
*   测试用户具有相应的角色和权限（运营人员、超级管理员）。
*   基础数据已准备（如用户、联系人、标签等，用于关联测试）。
*   API基础路径为 `/api/v1`。
*   所有ID均以字符串形式传递和接收。

**测试分类：**
*   **[P]**: Positive Test Case (验证功能正常工作)
*   **[N]**: Negative Test Case (验证错误处理、边界条件)
*   **[S]**: Security Test Case (验证认证、授权)
*   **[I]**: Integration Point (标记需要与其他服务/模块交互验证的点)
*   **[L]**: Load/Performance Point (标记需要关注性能的测试点)

---

## 1. 任务组 (Campaigns) - `SVC_CAMPAIGN`

### 1.1 `POST /campaigns` (创建任务组)

*   **TC_CAM_1.1.1 [P]:** 使用有效名称和未来 `start_time` 创建 Campaign。
    *   **输入:** `{"name": "Q1 Product Launch", "start_time": "2024-12-01T10:00:00Z"}`
    *   **预期:** `201 Created`，响应体包含 Campaign详情，`status`为`draft`，`created_by`为当前用户ID。
*   **TC_CAM_1.1.2 [P]:** 使用有效名称，不提供 `start_time` 创建 Campaign。
    *   **输入:** `{"name": "Weekly Newsletter"}`
    *   **预期:** `201 Created`，响应体中 `start_time` 为 `null`。
*   **TC_CAM_1.1.3 [N]:** `name` 为空。
    *   **输入:** `{"name": "", "start_time": "2024-12-01T10:00:00Z"}`
    *   **预期:** `400 Bad Request`，含错误信息。
*   **TC_CAM_1.1.4 [N]:** `name` 超过最大长度 (255 chars)。
    *   **输入:** `{"name": "<string_of_256_chars>", "start_time": "2024-12-01T10:00:00Z"}`
    *   **预期:** `400 Bad Request`.
*   **TC_CAM_1.1.5 [N]:** `start_time` 格式无效。
    *   **输入:** `{"name": "Test Campaign", "start_time": "invalid-date-format"}`
    *   **预期:** `400 Bad Request`.
*   **TC_CAM_1.1.6 [N]:** `start_time` 为过去时间 (如果业务规则禁止)。
    *   **输入:** `{"name": "Test Campaign", "start_time": "2020-01-01T10:00:00Z"}`
    *   **预期:** `400 Bad Request`.
*   **TC_CAM_1.1.7 [S]:** 未提供认证 Token。
    *   **预期:** `401 Unauthorized`.
*   **TC_CAM_1.1.8 [S]:** 使用无创建权限的角色的 Token。
    *   **预期:** `403 Forbidden`.

### 1.2 `GET /campaigns` (获取任务组列表)

*   **TC_CAM_1.2.1 [P]:** 无参数获取列表，验证默认分页和排序。
    *   **预期:** `200 OK`，返回分页结果 (items, total_items, total_pages, current_page, limit)，默认按 `created_at` 降序。
*   **TC_CAM_1.2.2 [P]:** 使用 `page` 和 `limit` 参数进行正确分页。
    *   **输入:** `?page=2&limit=5`
    *   **预期:** `200 OK`，返回第二页的5条记录。
*   **TC_CAM_1.2.3 [P]:** 按 `status` (e.g., `draft`) 筛选。
    *   **输入:** `?status=draft`
    *   **预期:** `200 OK`，只返回 `draft` 状态的Campaigns。
*   **TC_CAM_1.2.4 [P]:** 按 `name` (部分匹配) 模糊搜索。
    *   **输入:** `?name=Newsletter`
    *   **预期:** `200 OK`，返回名称包含 "Newsletter" 的Campaigns。
*   **TC_CAM_1.2.5 [P]:** 按 `sort_by=name` 和 `order=asc` 正确排序。
    *   **输入:** `?sort_by=name&order=asc`
    *   **预期:** `200 OK`，按名称升序排列。
*   **TC_CAM_1.2.6 [N]:** 使用无效的 `status` 值进行筛选。
    *   **输入:** `?status=invalid_status_value`
    *   **预期:** `400 Bad Request` 或返回空列表 (取决于实现细节)。
*   **TC_CAM_1.2.7 [S]:** 未提供认证 Token。
    *   **预期:** `401 Unauthorized`.
*   **TC_CAM_1.2.8 [I]:** 验证返回的 `created_by` 字段是否是正确的用户ID，UI是否能正确显示用户名（如果需要关联查询）。
*   **TC_CAM_1.2.9 [I]:** 验证 `task_summary` (total_tasks, active_tasks) 是否准确反映了关联 `tasks` 表的聚合数据。
*   **TC_CAM_1.2.10 [L]:** 大量Campaigns存在时，分页和筛选的性能。

### 1.3 `GET /campaigns/{campaign_id}` (获取单个任务组详情)

*   **TC_CAM_1.3.1 [P]:** 使用有效的 `campaign_id` 获取详情。
    *   **前提:** 已创建 Campaign `C1`。
    *   **输入:** `/campaigns/{C1_id}`
    *   **预期:** `200 OK`，返回 `C1` 的完整详情。
*   **TC_CAM_1.3.2 [N]:** 使用不存在的 `campaign_id`。
    *   **输入:** `/campaigns/non_existent_id_string`
    *   **预期:** `404 Not Found`.
*   **TC_CAM_1.3.3 [S]:** 未提供认证 Token。
    *   **预期:** `401 Unauthorized`.
*   **TC_CAM_1.3.4 [S]:** 用户A尝试获取用户B创建且用户A无权访问的Campaign (如果存在严格的数据隔离)。
    *   **预期:** `403 Forbidden` 或 `404 Not Found` (取决于权限策略的具体实现)。

### 1.4 `PUT /campaigns/{campaign_id}` (更新任务组信息)

*   **TC_CAM_1.4.1 [P]:** 更新 `draft` 状态 Campaign 的 `name` 和 `start_time`。
    *   **前提:** 已创建 Campaign `C1` (status: `draft`)。
    *   **输入:** `/campaigns/{C1_id}`, body: `{"name": "Updated Q1 Launch", "start_time": "2025-01-01T00:00:00Z"}`
    *   **预期:** `200 OK`，返回更新后的 `C1` 详情，`updated_at` 时间戳已更新。
*   **TC_CAM_1.4.2 [N]:** 更新一个处于 `active` 状态的 Campaign (假设业务规则不允许修改活动中Campaign的核心信息)。
    *   **前提:** Campaign `C2` (status: `active`)。
    *   **输入:** `/campaigns/{C2_id}`, body: `{"name": "New Name Attempt"}`
    *   **预期:** `403 Forbidden` 或 `400 Bad Request` (提示状态不允许修改)。
*   **TC_CAM_1.4.3 [N]:** 提供空的 `name` 或过长的 `name` 进行更新。
    *   **预期:** `400 Bad Request`.
*   **TC_CAM_1.4.4 [S]:** 用户A尝试更新用户B的Campaign (如果非管理员且无权限)。
    *   **预期:** `403 Forbidden` 或 `404 Not Found`.
*   **TC_CAM_1.4.5 [P]:** 只更新 `name`，不提供 `start_time`。
    *   **输入:** `/campaigns/{C1_id}`, body: `{"name": "Just Name Update"}`
    *   **预期:** `200 OK`, `start_time` 保持不变。

### 1.5 `DELETE /campaigns/{campaign_id}` (删除任务组)

*   **TC_CAM_1.5.1 [P]:** 删除一个 `draft` 状态且无关联Task的Campaign。
    *   **前提:** Campaign `C1` (status: `draft`, no tasks associated)。
    *   **输入:** `/campaigns/{C1_id}`
    *   **预期:** `200 OK` 或 `204 No Content`。后续GET该ID应返回 `404 Not Found`。
*   **TC_CAM_1.5.2 [N]:** 尝试删除一个 `active` 状态的Campaign。
    *   **前提:** Campaign `C2` (status: `active`)。
    *   **预期:** `403 Forbidden` 或 `400 Bad Request` (提示状态不允许删除)。
*   **TC_CAM_1.5.3 [N]:** 尝试删除一个 `draft` 状态但其下有关联Tasks的Campaign。
    *   **前提:** Campaign `C3` (status: `draft`, has associated tasks)。
    *   **预期:** `409 Conflict` (或 `400 Bad Request`，提示有依赖项)。
*   **TC_CAM_1.5.4 [S]:** 用户A尝试删除用户B的Campaign (如果非管理员且无权限)。
    *   **预期:** `403 Forbidden` 或 `404 Not Found`.
*   **TC_CAM_1.5.5 [N]:** 删除不存在的 `campaign_id`。
    *   **预期:** `404 Not Found`。

### 1.6 `POST /campaigns/{campaign_id}/status` (修改任务组状态)

*   **TC_CAM_1.6.1 [P]:** 将 `draft` 状态的 Campaign 修改为 `active`。
    *   **前提:** Campaign `C1` (status: `draft`)。
    *   **输入:** `/campaigns/{C1_id}/status`, body: `{"status": "active"}`
    *   **预期:** `200 OK`，返回更新后的 `C1`，`status` 字段为 `active`。
*   **TC_CAM_1.6.2 [P]:** 将 `active` 状态的 Campaign 修改为 `paused`。
    *   **前提:** Campaign `C2` (status: `active`)。
    *   **输入:** `/campaigns/{C2_id}/status`, body: `{"status": "paused"}`
    *   **预期:** `200 OK`。
*   **TC_CAM_1.6.3 [P]:** 将 `paused` 状态的 Campaign 修改为 `active` (恢复)。
    *   **预期:** `200 OK`。
*   **TC_CAM_1.6.4 [P]:** 将 `active` 或 `paused` 状态的 Campaign 修改为 `cancelled`。
    *   **预期:** `200 OK`。
*   **TC_CAM_1.6.5 [N]:** 提供无效的 `status` 值。
    *   **输入:** body: `{"status": "non_existent_status"}`
    *   **预期:** `400 Bad Request`.
*   **TC_CAM_1.6.6 [N]:** 不允许的状态转换 (e.g., 从 `completed` 到 `draft`, 或从 `cancelled` 到 `active`)。
    *   **预期:** `400 Bad Request` (或 `409 Conflict`)。
*   **TC_CAM_1.6.7 [S]:** 用户A尝试修改用户B的Campaign状态 (如果非管理员且无权限)。
    *   **预期:** `403 Forbidden` 或 `404 Not Found`.
*   **TC_CAM_1.6.8 [I]:** 修改为 `active` 后，如果 `start_time` 已过，关联的 `scheduled` Tasks 是否会立即被调度器考虑 (需结合调度器逻辑)。
*   **TC_CAM_1.6.9 [I]:** Campaign 状态变为 `paused` 或 `cancelled` 时，其下 `active` 或 `sending` 的Tasks是否会相应地被暂停或取消。

---
## 2. 任务 (Tasks) - `SVC_TASK`

### 2.1 `POST /tasks` (创建任务)

*   **TC_TSK_2.1.1 [P]:** 在有效Campaign下创建具有所有必需字段的Task。
    *   **前提:** Campaign `C1` (ID: `c1_id`), TemplateSet `TS1` (ID: `ts1_id`) 已存在。
    *   **输入:** `{"campaign_id": "c1_id", "name": "Task Alpha", "plan_time": "2024-12-10T10:00:00Z", "recipient_rule": {"type": "ALL_CONTACTS"}, "template_set_id": "ts1_id"}`
    *   **预期:** `201 Created`，返回Task详情，`status`为`draft`，`created_by`为当前用户ID。
*   **TC_TSK_2.1.2 [P]:** 创建带 `TAG_BASED` recipient rule (含 include/exclude tags) 的Task。
    *   **输入:** `... "recipient_rule": {"type": "TAG_BASED", "include_tags": ["vip_customer"], "exclude_tags": ["unsubscribed_former_vip"]} ...`
    *   **预期:** `201 Created`.
*   **TC_TSK_2.1.3 [P]:** 创建带 `MANUAL_LIST` recipient rule (含 contact_ids) 的Task。
    *   **前提:** 联系人 ID `contact1_id`, `contact2_id` 存在。
    *   **输入:** `... "recipient_rule": {"type": "MANUAL_LIST", "contact_ids": ["contact1_id", "contact2_id"]} ...`
    *   **预期:** `201 Created`.
*   **TC_TSK_2.1.4 [N]:** `campaign_id` 为空或不存在。
    *   **预期:** `400 Bad Request` (或 `404 Not Found` for non-existent campaign_id).
*   **TC_TSK_2.1.5 [N]:** `template_set_id` 为空或不存在。
    *   **预期:** `400 Bad Request` (或 `404 Not Found` for non-existent template_set_id).
*   **TC_TSK_2.1.6 [N]:** `plan_time` 为空或为过去时间。
    *   **预期:** `400 Bad Request`.
*   **TC_TSK_2.1.7 [N]:** `recipient_rule` 为空、格式错误或包含不支持的类型。
    *   **预期:** `400 Bad Request`.
*   **TC_TSK_2.1.8 [N]:** `recipient_rule` 中 `TAG_BASED` 的 `include_tags` 或 `exclude_tags` 格式错误 (e.g., 非数组)。
    *   **预期:** `400 Bad Request`.
*   **TC_TSK_2.1.9 [N]:** `recipient_rule` 中 `MANUAL_LIST` 的 `contact_ids` 格式错误或包含不存在的联系人ID (如果校验)。
    *   **预期:** `400 Bad Request` (or `404` if contact_id validation is strict at creation).
*   **TC_TSK_2.1.10 [S]:** 未提供认证 Token。
    *   **预期:** `401 Unauthorized`.
*   **TC_TSK_2.1.11 [I]:** `recipient_rule` 中的tag是否存在于标签服务 (`TAG_SVC`) (此校验可能在后续解析阶段进行)。
*   **TC_TSK_2.1.12 [I]:** Task 创建后，所属Campaign的 `task_summary` 是否可能更新 (如果实时更新)。

### 2.2 `GET /tasks` (获取任务列表)

*   **TC_TSK_2.2.1 [P]:** 使用 `campaign_id` 筛选获取其下的Tasks列表。
    *   **前提:** Campaign `C1` (ID: `c1_id`) 下有多个Tasks。
    *   **输入:** `?campaign_id=c1_id`
    *   **预期:** `200 OK`，返回 `C1` 下的Tasks列表，分页结构正确。
*   **TC_TSK_2.2.2 [P]:** 不提供 `campaign_id` (如果允许，可能返回当前用户所有可访问的Tasks)。
    *   **预期:** `200 OK` 或 `400 Bad Request` (如果 `campaign_id` 是必需的)。
*   **TC_TSK_2.2.3 [P]:** 分页 (`page`, `limit`)、筛选 `status` (e.g. `scheduled`)、按 `name` 模糊搜索、按 `plan_time` 升序排序。
    *   **(类似 TC_CAM_1.2.x)**
*   **TC_TSK_2.2.4 [S]:** 未提供认证 Token。
    *   **预期:** `401 Unauthorized`.
*   **TC_TSK_2.2.5 [I]:** 列表中的 `summary_stats` 是否准确 (可能是初步/缓存的统计)。
*   **TC_TSK_2.2.6 [L]:** 大量Tasks存在时，获取列表（尤其带复杂筛选和排序）的性能。

### 2.3 `GET /tasks/{task_id}` (获取单个任务详情)

*   **TC_TSK_2.3.1 [P]:** 使用有效的 `task_id` 获取详情。
    *   **预期:** `200 OK`，返回Task完整详情，包括 `recipient_rule`, `summary_stats` 等。
*   **TC_TSK_2.3.2 [N]:** 使用不存在的 `task_id`。
    *   **预期:** `404 Not Found`.
*   **TC_TSK_2.3.3 [S]:** 用户A尝试获取用户B创建且用户A无权访问的Task。
    *   **预期:** `403 Forbidden` 或 `404 Not Found`.
*   **TC_TSK_2.3.4 [I]:** 详情中的 `summary_stats` 是否与数据库中聚合的最新统计一致。

### 2.4 `PUT /tasks/{task_id}` (更新任务信息)

*   **TC_TSK_2.4.1 [P]:** 更新 `draft` 状态Task的 `name`, `plan_time`, `recipient_rule`, `template_set_id`。
    *   **前提:** Task `T1` (status: `draft`).
    *   **输入:** Body with updated fields.
    *   **预期:** `200 OK`，返回更新后的Task，`updated_at` 已更新。
*   **TC_TSK_2.4.2 [P]:** 更新 `paused` 状态Task的上述字段 (如果允许)。
    *   **预期:** `200 OK`.
*   **TC_TSK_2.4.3 [N]:** 尝试更新 `sending` 或 `finished` 状态Task的信息 (通常不允许)。
    *   **预期:** `400 Bad Request` 或 `403 Forbidden` (提示状态不允许修改)。
*   **TC_TSK_2.4.4 [N]:** 提供无效的 `template_set_id` (不存在)。
    *   **预期:** `400 Bad Request` 或 `404 Not Found`.
*   **TC_TSK_2.4.5 [N]:** `plan_time` 更新为过去时间。
    *   **预期:** `400 Bad Request`.
*   **TC_TSK_2.4.6 [S]:** 用户A尝试更新用户B的Task (如果非管理员且无权限)。
    *   **预期:** `403 Forbidden` 或 `404 Not Found`.

### 2.5 `DELETE /tasks/{task_id}` (删除任务)

*   **TC_TSK_2.5.1 [P]:** 删除一个 `draft` 状态的Task。
    *   **预期:** `200 OK` 或 `204 No Content`。后续GET该ID应返回 `404`。
*   **TC_TSK_2.5.2 [P]:** 删除一个 `finished` 或 `failed` 状态的Task (如果允许)。
    *   **预期:** `200 OK` 或 `204 No Content`。
*   **TC_TSK_2.5.3 [N]:** 尝试删除一个 `sending` 状态的Task (通常不允许)。
    *   **预期:** `400 Bad Request` 或 `403 Forbidden` (提示状态不允许删除)。
*   **TC_TSK_2.5.4 [S]:** 用户A尝试删除用户B的Task (如果非管理员且无权限)。
    *   **预期:** `403 Forbidden` 或 `404 Not Found`.
*   **TC_TSK_2.5.5 [N]:** 删除不存在的 `task_id`。
    *   **预期:** `404 Not Found`。

### 2.6 `POST /tasks/{task_id}/status` (修改任务状态)

*   **TC_TSK_2.6.1 [P]:** 将 `draft` Task 状态修改为 `scheduled`。
    *   **输入:** body: `{"status": "scheduled"}`
    *   **预期:** `200 OK`，返回更新后的Task，`status` 为 `scheduled`。
*   **TC_TSK_2.6.2 [P]:** 将 `scheduled` Task 状态修改为 `paused`。
    *   **预期:** `200 OK`.
*   **TC_TSK_2.6.3 [P]:** 将 `sending` Task 状态修改为 `paused`。
    *   **预期:** `200 OK`.
*   **TC_TSK_2.6.4 [P]:** 将 `paused` Task 状态修改为 `scheduled` (恢复/重新调度)。
    *   **预期:** `200 OK`.
*   **TC_TSK_2.6.5 [P]:** 将 `draft`, `scheduled`, `paused` Task 状态修改为 `cancelled`。
    *   **预期:** `200 OK`.
*   **TC_TSK_2.6.6 [P]:** 将 `failed` Task 状态修改为 `scheduled` (如果支持手动重试，请求体可能包含 `retry` 指示)。
    *   **输入:** body: `{"status": "scheduled", "action": "retry"}` (或类似)
    *   **预期:** `200 OK`.
*   **TC_TSK_2.6.7 [N]:** 提供无效的 `status` 值。
    *   **预期:** `400 Bad Request`.
*   **TC_TSK_2.6.8 [N]:** 不允许的状态转换 (e.g., `finished` 到 `scheduled`, `cancelled` 到 `paused`)。
    *   **预期:** `400 Bad Request` (或 `409 Conflict`)。
*   **TC_TSK_2.6.9 [I]:** 修改为 `scheduled` 后，任务是否能被 `SCHEDULER` 正确拾取。如果 `plan_time` 已过，是否立即处理。
*   **TC_TSK_2.6.10 [I]:** 修改为 `paused` 后，`WORKER_POOL` 是否能优雅地停止处理该任务的邮件，并保存当前进度。
*   **TC_TSK_2.6.11 [I]:** 修改为 `cancelled` 后，是否清理相关的待处理项（如在队列中的消息）。

### 2.7 `GET /tasks/{task_id}/recipients` (获取任务的收件人列表)

*   **TC_TSK_2.7.1 [P]:** 获取已解析规则并生成 `task_contacts` 的Task的收件人列表（第一页）。
    *   **前提:** Task `T1` 已进入 `sending` 或 `finished` 阶段，`task_contacts` 已填充。
    *   **预期:** `200 OK`，返回分页的收件人列表及各自状态 (`pending`, `sent`, `delivered`, etc.)。
*   **TC_TSK_2.7.2 [P]:** 使用 `page` 和 `limit` 进行分页。
    *   **预期:** `200 OK`.
*   **TC_TSK_2.7.3 [P]:** 按 `status` (`task_contacts.status`, e.g., `opened`) 筛选收件人。
    *   **输入:** `?status=opened`
    *   **预期:** `200 OK`.
*   **TC_TSK_2.7.4 [P]:** 按 `email` (部分匹配) 搜索收件人。
    *   **输入:** `?email=test@example`
    *   **预期:** `200 OK`.
*   **TC_TSK_2.7.5 [N]:** Task 处于 `draft` 状态且尚未解析收件人规则。
    *   **预期:** `200 OK` 返回空列表，或根据实现返回特定提示。
*   **TC_TSK_2.7.6 [I]:** 返回的 `status`, `sent_at`, `error_message` 等字段是否与 `task_contacts` 表数据一致。
*   **TC_TSK_2.7.7 [L]:** 对于包含大量收件人的Task，分页获取列表的性能。

### 2.8 `GET /tasks/{task_id}/report` (获取任务的统计报告)

*   **TC_TSK_2.8.1 [P]:** 获取已完成 (status: `finished`) Task的统计报告。
    *   **前提:** Task `T1` 已发送完毕，有 `event_log` 数据用于聚合。
    *   **预期:** `200 OK`，返回详细的 `summary_stats` (total_recipients, sent, delivered, opened, clicked, etc.)。
*   **TC_TSK_2.8.2 [P]:** 获取正在发送中 (status: `sending`) Task的实时统计报告。
    *   **预期:** `200 OK`，返回当前已聚合的统计数据。
*   **TC_TSK_2.8.3 [P]:** 获取 `draft` 或 `scheduled` (未开始发送) Task的报告。
    *   **预期:** `200 OK`，统计数据大部分为0或null，`total_recipients` 可能已根据规则解析得出。
*   **TC_TSK_2.8.4 [P]:** 验证 `timeline_stats` (如果实现) 是否按时间正确聚合数据。
*   **TC_TSK_2.8.5 [I]:** 报告中的各项统计数据是否准确反映了 `task_contacts` 和 `event_log` 中的数据，包括各种状态计数。
*   **TC_TSK_2.8.6 [N]:** 获取不存在的 `task_id` 的报告。
    *   **预期:** `404 Not Found`。

---
## 3. 邮件模板 (Templates) - `SVC_TEMPLATE`

### 3.1 `POST /templates` (创建邮件模板)

*   **TC_TPL_3.1.1 [P]:** 创建包含名称、主题和HTML正文的有效模板。
    *   **输入:** `{"name": "Welcome Email Template", "subject": "Welcome, {{contact.nickname}}!", "body": "<h1>Hello!</h1><p>Thanks for signing up.</p>"}`
    *   **预期:** `201 Created`，返回模板详情，`created_by` 为当前用户。
*   **TC_TPL_3.1.2 [N]:** `name` 为空或过长。
    *   **预期:** `400 Bad Request`.
*   **TC_TPL_3.1.3 [N]:** `subject` 为空或过长。
    *   **预期:** `400 Bad Request`.
*   **TC_TPL_3.1.4 [N]:** `body` 为空。
    *   **预期:** `400 Bad Request`.
*   **TC_TPL_3.1.5 [N]:** `body` 包含不规范或恶意HTML (如果系统有清理/校验机制，验证其行为)。
    *   **预期:** `400 Bad Request` 或 创建成功但内容被清理。
*   **TC_TPL_3.1.6 [S]:** 未认证用户尝试创建。
    *   **预期:** `401 Unauthorized`.

### 3.2 `GET /templates` (获取邮件模板列表)

*   **TC_TPL_3.2.1 [P]:** 获取模板列表，验证分页和默认排序。
    *   **预期:** `200 OK`.
*   **TC_TPL_3.2.2 [P]:** 按 `name` 或 `subject` 搜索。
    *   **预期:** `200 OK`.
*   **TC_TPL_3.2.3 [L]:** 大量模板存在时列表接口的性能。

### 3.3 `GET /templates/{template_id}` (获取单个邮件模板详情)

*   **TC_TPL_3.3.1 [P]:** 获取存在的模板详情。
    *   **预期:** `200 OK`，返回完整 `name`, `subject`, `body`。
*   **TC_TPL_3.3.2 [N]:** 获取不存在的模板。
    *   **预期:** `404 Not Found`.

### 3.4 `PUT /templates/{template_id}` (更新邮件模板)

*   **TC_TPL_3.4.1 [P]:** 更新模板的 `name`, `subject`, `body`。
    *   **预期:** `200 OK`，返回更新后的模板，`updated_at` 已更新。
*   **TC_TPL_3.4.2 [N]:** 提供空的 `name`, `subject`, 或 `body` 进行更新 (如果这些字段是必需的)。
    *   **预期:** `400 Bad Request`.
*   **TC_TPL_3.4.3 [S]:** 用户A尝试修改用户B创建的模板 (如果无权限)。
    *   **预期:** `403 Forbidden` 或 `404 Not Found`.

### 3.5 `DELETE /templates/{template_id}` (删除邮件模板)

*   **TC_TPL_3.5.1 [P]:** 删除未被任何模板组引用的模板。
    *   **预期:** `200 OK` 或 `204 No Content`.
*   **TC_TPL_3.5.2 [N]:** 尝试删除被模板组 (`template_sets`) 引用的模板。
    *   **预期:** `409 Conflict` (或 `400 Bad Request` 提示有依赖)。
*   **TC_TPL_3.5.3 [N]:** 删除不存在的模板。
    *   **预期:** `404 Not Found`.

### 3.6 `POST /templates/preview` 或 `POST /templates/{template_id}/preview` (预览邮件模板)

*   **TC_TPL_3.6.1 [P]:** 使用存在的 `template_id` 和示例数据进行预览。
    *   **输入:** `{"sample_contact_data": {"nickname": "John"}}` (for template with `{{contact.nickname}}`)
    *   **预期:** `200 OK`，返回 `rendered_subject` 和 `rendered_body`，变量已替换。
*   **TC_TPL_3.6.2 [P]:** 直接提供 `template_content` (subject, body) 和示例数据进行预览。
    *   **预期:** `200 OK`.
*   **TC_TPL_3.6.3 [N]:** `template_id` 不存在 (当使用路径参数时)。
    *   **预期:** `404 Not Found`.
*   **TC_TPL_3.6.4 [N]:** 模板内容中的变量在示例数据中未提供 (验证如何处理，e.g., 保留原样或为空)。
    *   **预期:** `200 OK`，未匹配变量按规则处理。
*   **TC_TPL_3.6.5 [I]:** 预览使用的变量替换逻辑是否与实际发送时 `WORKER_POOL` 中的渲染逻辑一致。

---
## 4. 模板组 (Template Sets) - `SVC_TEMPLATE`

### 4.1 `POST /template-sets` (创建模板组)

*   **TC_TSET_4.1.1 [P]:** 创建包含名称和多个有效模板项 (template_id, order) 的模板组。
    *   **前提:** Template IDs `t1_id`, `t2_id` 存在。
    *   **输入:** `{"name": "Welcome Sequence", "items": [{"template_id": "t1_id", "order": 0}, {"template_id": "t2_id", "order": 1}]}`
    *   **预期:** `201 Created`，返回模板组详情，包括items。
*   **TC_TSET_4.1.2 [N]:** `name` 为空。
    *   **预期:** `400 Bad Request`.
*   **TC_TSET_4.1.3 [N]:** `items` 数组为空。
    *   **预期:** `400 Bad Request`.
*   **TC_TSET_4.1.4 [N]:** `items` 中包含不存在的 `template_id`。
    *   **预期:** `400 Bad Request` (或 `404 Not Found` for template_id).
*   **TC_TSET_4.1.5 [N]:** `items` 中 `order` 值重复。
    *   **预期:** `400 Bad Request`.
*   **TC_TSET_4.1.6 [N]:** `items` 中 `order` 为负数。
    *   **预期:** `400 Bad Request`.

### 4.2 `GET /template-sets` (获取模板组列表)

*   **TC_TSET_4.2.1 [P]:** 获取模板组列表，验证分页和默认排序。
    *   **预期:** `200 OK`，包含 `item_count`。
*   **TC_TSET_4.2.2 [P]:** 按 `name` 搜索。
    *   **预期:** `200 OK`.

### 4.3 `GET /template-sets/{template_set_id}` (获取单个模板组详情)

*   **TC_TSET_4.3.1 [P]:** 获取存在的模板组详情。
    *   **预期:** `200 OK`，返回完整items列表，包含 `template_name`, `template_subject_preview` (如果实现)。
*   **TC_TSET_4.3.2 [N]:** 获取不存在的模板组。
    *   **预期:** `404 Not Found`.
*   **TC_TSET_4.3.3 [I]:** `items` 中的 `template_name` 等信息是否准确来自关联的 `templates` 表。

### 4.4 `PUT /template-sets/{template_set_id}` (更新模板组)

*   **TC_TSET_4.4.1 [P]:** 更新模板组的 `name` 和 `items` (更改顺序、增删模板)。
    *   **预期:** `200 OK`，返回更新后的模板组。
*   **TC_TSET_4.4.2 [N]:** `items` 更新为无效结构 (e.g., 重复order, 不存在的template_id)。
    *   **预期:** `400 Bad Request`.
*   **TC_TSET_4.4.3 [S]:** 用户A尝试修改用户B的模板组 (如果无权限)。
    *   **预期:** `403 Forbidden` 或 `404 Not Found`.

### 4.5 `DELETE /template-sets/{template_set_id}` (删除模板组)

*   **TC_TSET_4.5.1 [P]:** 删除未被任何Task引用的模板组。
    *   **预期:** `200 OK` 或 `204 No Content`.
*   **TC_TSET_4.5.2 [N]:** 尝试删除被Task (`tasks.template_set_id`) 引用的模板组。
    *   **预期:** `409 Conflict` (或 `400 Bad Request` 提示有依赖)。
*   **TC_TSET_4.5.3 [N]:** 删除不存在的模板组。
    *   **预期:** `404 Not Found`.

---
## 5. 邮件变量 (Email Variables) - `SVC_TEMPLATE` (管理员操作)

*   **前提:** 执行这些测试需要管理员权限的Token。

### 5.1 `POST /settings/variables` (创建邮件变量定义)

*   **TC_VAR_5.1.1 [P]:** 创建一个 `CONTACT_FIELD` 类型的变量。
    *   **输入:** `{"variable_key": "contact.first_name", "display_name": "Contact First Name", "source_type": "CONTACT_FIELD", "source_details": {"field_name": "first_name"}}`
    *   **预期:** `201 Created`.
*   **TC_VAR_5.1.2 [P]:** 创建一个 `SYSTEM` 类型的变量。
    *   **输入:** `{"variable_key": "system.current_year", "display_name": "Current Year", "source_type": "SYSTEM", "source_details": {"generator": "current_year"}}`
    *   **预期:** `201 Created`.
*   **TC_VAR_5.1.3 [N]:** `variable_key` 重复。
    *   **预期:** `400 Bad Request` (或 `409 Conflict`)。
*   **TC_VAR_5.1.4 [N]:** `source_type` 无效。
    *   **预期:** `400 Bad Request`.
*   **TC_VAR_5.1.5 [N]:** `source_details` 与 `source_type` 不匹配 (e.g., type `CONTACT_FIELD` 但 details 为空)。
    *   **预期:** `400 Bad Request`.
*   **TC_VAR_5.1.6 [S]:** 普通运营用户尝试创建。
    *   **预期:** `403 Forbidden`.

### 5.2 `GET /settings/variables` (获取邮件变量定义列表)

*   **TC_VAR_5.2.1 [P]:** 获取所有变量列表。
    *   **预期:** `200 OK`.
*   **TC_VAR_5.2.2 [P]:** 按 `source_type` 筛选。
    *   **输入:** `?source_type=CONTACT_FIELD`
    *   **预期:** `200 OK`.
*   **TC_VAR_5.2.3 [S]:** 普通运营用户尝试获取 (如果UI中需要展示给运营，则此接口可能对普通用户也开放只读)。
    *   **预期:** `200 OK` (如果允许) 或 `403 Forbidden` (如果严格管理员权限)。

### 5.3 `GET /settings/variables/{variable_id_or_key}` (获取单个邮件变量定义)

*   **TC_VAR_5.3.1 [P]:** 使用 `variable_key` 获取。
    *   **预期:** `200 OK`.
*   **TC_VAR_5.3.2 [N]:** 使用不存在的 `variable_key`。
    *   **预期:** `404 Not Found`.

### 5.4 `PUT /settings/variables/{variable_id_or_key}` (更新邮件变量定义)

*   **TC_VAR_5.4.1 [P]:** 更新 `display_name`, `source_details`, `description`。
    *   **预期:** `200 OK`.
*   **TC_VAR_5.4.2 [N]:** 尝试更新 `variable_key` (通常不允许)。
    *   **预期:** `400 Bad Request` 或 更新被忽略。
*   **TC_VAR_5.4.3 [N]:** `source_details` 与更新后的 `source_type` (如果允许修改) 不匹配。
    *   **预期:** `400 Bad Request`.

### 5.5 `DELETE /settings/variables/{variable_id_or_key}` (删除邮件变量定义)

*   **TC_VAR_5.5.1 [P]:** 删除一个变量。
    *   **预期:** `200 OK` 或 `204 No Content`.
*   **TC_VAR_5.5.2 [N]:** 删除一个被模板广泛使用的变量 (系统可能不阻止，但需考虑影响)。
    *   **预期:** `200 OK`.
*   **TC_VAR_5.5.3 [N]:** 删除不存在的变量。
    *   **预期:** `404 Not Found`.

---
## 6. 发件服务管理 (Sender Services) - `ROUTING_SVC` (管理员操作)

*   **前提:** 执行这些测试需要管理员权限的Token。

### 6.1 `POST /admin/sender-services` (创建发件服务)

*   **TC_SND_6.1.1 [P]:** 创建一个 `jiguang` 类型的服务，提供有效凭证。
    *   **输入:** `{"name": "JG Service 1", "type": "jiguang", "credentials": {"api_key": "key", "api_secret": "secret"}, "daily_quota": 1000, "throttle_sec": 1}`
    *   **预期:** `201 Created`，`health_status` 为 `active`, `used_today`为0。
*   **TC_SND_6.1.2 [P]:** 创建一个 `smtp` 类型的服务。
    *   **预期:** `201 Created`.
*   **TC_SND_6.1.3 [N]:** `type` 无效。
    *   **预期:** `400 Bad Request`.
*   **TC_SND_6.1.4 [N]:** `credentials` 与 `type` 不匹配或缺少必需字段。
    *   **预期:** `400 Bad Request`.
*   **TC_SND_6.1.5 [N]:** `daily_quota` 或 `throttle_sec` 为负数。
    *   **预期:** `400 Bad Request`.
*   **TC_SND_6.1.6 [I]:** 创建后，服务凭证是否已加密存储。

### 6.2 `GET /admin/sender-services` (获取发件服务列表)

*   **TC_SND_6.2.1 [P]:** 获取列表，验证分页、筛选(`type`, `health_status`)、搜索(`name`)。
    *   **预期:** `200 OK`.
*   **TC_SND_6.2.2 [P]:** 验证返回的 `used_today` 是否准确。

### 6.3 `GET /admin/sender-services/{service_id}` (获取单个发件服务详情)

*   **TC_SND_6.3.1 [P]:** 获取详情，验证返回信息（凭证是否屏蔽）。
    *   **预期:** `200 OK`。API Spec建议`credentials`在详情中屏蔽或不返回，测试确保这点。

### 6.4 `PUT /admin/sender-services/{service_id}` (更新发件服务)

*   **TC_SND_6.4.1 [P]:** 更新 `name`, `credentials`, `daily_quota`, `throttle_sec`, `health_status` (`active`/`frozen`)。
    *   **预期:** `200 OK`.
*   **TC_SND_6.4.2 [N]:** 将 `health_status` 更新为无效值。
    *   **预期:** `400 Bad Request`.
*   **TC_SND_6.4.3 [I]:** 更新凭证后，旧凭证是否失效，新凭证是否加密。
*   **TC_SND_6.4.4 [I]:** 将服务 `health_status` 设置为 `frozen`，发件路由服务 (`ROUTING_SVC`) 是否不再选择此服务。

### 6.5 `DELETE /admin/sender-services/{service_id}` (删除发件服务)

*   **TC_SND_6.5.1 [P]:** 删除未被使用的服务。
    *   **预期:** `200 OK` 或 `204 No Content`.
*   **TC_SND_6.5.2 [N]:** 尝试删除被用户关联或有正在进行/计划任务使用的服务 (如果业务逻辑阻止)。
    *   **预期:** `409 Conflict` 或 `400 Bad Request`。

### 6.6 `POST /admin/sender-services/{service_id}/reset-usage` (重置用量)

*   **TC_SND_6.6.1 [P]:** 重置服务的 `used_today` 和 `consecutive_errors`。
    *   **预期:** `200 OK`。后续GET该服务详情，`used_today` 和 `consecutive_errors` 为0。
*   **TC_SND_6.6.2 [I]:** 验证此操作是否影响 `ROUTING_SVC` 对该服务的选择逻辑 (例如，之前因超额而冻结的服务可能恢复可用)。

---
## 7. 用户与发件服务关联 - `ROUTING_SVC` (管理员操作)

*   **前提:** 管理员Token。用户 `U1` (ID: `u1_id`), 服务 `S1` (ID: `s1_id`), `S2` (ID: `s2_id`) 已存在。

### 7.1 `GET /admin/users/{user_id}/sender-services`

*   **TC_USR_SND_7.1.1 [P]:** 获取用户 `U1` 已关联的服务列表。
    *   **前提:** `U1` 已关联 `S1`。
    *   **输入:** `/admin/users/u1_id/sender-services`
    *   **预期:** `200 OK`，items包含 `S1` 的信息。
*   **TC_USR_SND_7.1.2 [P]:** 获取未关联任何服务的用户的列表。
    *   **预期:** `200 OK`，items为空数组。
*   **TC_USR_SND_7.1.3 [N]:** `user_id` 不存在。
    *   **预期:** `404 Not Found`.

### 7.2 `POST /admin/users/{user_id}/sender-services` (分配/取消)

*   **TC_USR_SND_7.2.1 [P]:** 为用户 `U1` 添加服务 `S2` 的关联。
    *   **输入:** `/admin/users/u1_id/sender-services`, body: `{"assignments": [{"sender_service_id": "s2_id", "action": "add"}]}`
    *   **预期:** `200 OK`，响应包含 `status: "added"`。后续GET `U1` 的服务列表应包含 `S2`。
*   **TC_USR_SND_7.2.2 [P]:** 从用户 `U1` 移除服务 `S1` 的关联。
    *   **前提:** `U1` 已关联 `S1`。
    *   **输入:** body: `{"assignments": [{"sender_service_id": "s1_id", "action": "remove"}]}`
    *   **预期:** `200 OK`，响应包含 `status: "removed"`。
*   **TC_USR_SND_7.2.3 [P]:** 批量操作：为一个请求添加一个服务，移除另一个服务。
    *   **预期:** `200 OK`，响应中分别指示各操作状态。
*   **TC_USR_SND_7.2.4 [N]:** `sender_service_id` 不存在。
    *   **预期:** `400 Bad Request` (或响应中该项操作失败)。
*   **TC_USR_SND_7.2.5 [N]:** `action` 无效。
    *   **预期:** `400 Bad Request`.
*   **TC_USR_SND_7.2.6 [P]:** 尝试添加已关联的服务。
    *   **预期:** `200 OK`，响应中该项 `status: "unchanged"` 或 `"already_added"`。
*   **TC_USR_SND_7.2.7 [P]:** 尝试移除未关联的服务。
    *   **预期:** `200 OK`，响应中该项 `status: "unchanged"` 或 `"not_found_to_remove"`。
*   **TC_USR_SND_7.2.8 [I]:** 用户分配/取消服务后，`ROUTING_SVC` 在为该用户选择发送服务时是否能正确识别其可用服务池。

---
## 8. 邮件追踪 (Tracking) - `SVC_TASK` / `TRACKING_ENDPOINT`

*   **前提:** Task `T1` 已发送，其中一个联系人 `CT1` 的 `event_tracking_uid` 为 `uid123`。

### 8.1 `GET /track/open/{event_tracking_uid}.gif` (追踪邮件打开)

*   **TC_TRK_8.1.1 [P]:** 使用有效的 `event_tracking_uid` 请求追踪像素。
    *   **输入:** `/track/open/uid123.gif`
    *   **预期:** `200 OK`，`Content-Type: image/gif`，返回1x1透明GIF。
    *   **[I]:** `event_log` 表新增一条 `type='open'` 记录，关联 `task_id`, `contact_id`, `event_tracking_uid`。
    *   **[I]:** `task_contacts` 表中对应记录的 `status` 更新为 `opened` (如果之前未打开)。
*   **TC_TRK_8.1.2 [N]:** 使用无效/不存在的 `event_tracking_uid`。
    *   **预期:** `200 OK` (仍返回GIF以避免暴露UID有效性)，但不记录事件；或者 `404 Not Found` (取决于策略)。
*   **TC_TRK_8.1.3 [P]:** 多次请求同一个 `event_tracking_uid` (多次打开)。
    *   **预期:** `200 OK`。`event_log` 表新增多条 `open` 事件，但 `task_contacts.status` 保持 `opened`，相关计数器（如 `summary_stats.opened`）应只计一次（独立打开）。
*   **TC_TRK_8.1.4 [L]:** 大量并发打开请求的性能和可靠性。

### 8.2 `GET /track/click/{event_tracking_uid}?url={encoded_original_url}` (追踪链接点击)

*   **TC_TRK_8.2.1 [P]:** 使用有效的 `event_tracking_uid` 和 `url` 参数请求。
    *   **输入:** `/track/click/uid123?url=https%3A%2F%2Fexample.com%2Fproduct`
    *   **预期:** `302 Found`，`Location` header 为 `https://example.com/product`。
    *   **[I]:** `event_log` 表新增一条 `type='click'` 记录，包含 `original_url`。
    *   **[I]:** `task_contacts` 表中对应记录的 `status` 更新为 `clicked` (如果之前未点击)。
*   **TC_TRK_8.2.2 [N]:** `url` 参数缺失。
    *   **预期:** `400 Bad Request` 或重定向到预定义的错误/首页。
*   **TC_TRK_8.2.3 [N]:** 无效/不存在的 `event_tracking_uid`。
    *   **预期:** `302 Found` (仍重定向以避免暴露UID有效性)，但不记录事件；或者 `404 Not Found`。
*   **TC_TRK_8.2.4 [P]:** 同一用户点击同一邮件中的不同链接。
    *   **预期:** `302 Found`。`event_log` 为每个不同URL的点击都记录事件。
*   **TC_TRK_8.2.5 [P]:** 同一用户多次点击同一链接。
    *   **预期:** `302 Found`。`event_log` 记录多次 `click` 事件，`summary_stats.clicked` 可能只计独立点击。
*   **TC_TRK_8.2.6 [L]:** 大量并发点击请求的性能和可靠性。

---

## 用户流程测试 (API层面模拟)

*   **UFT_01: 完整运营流程**
    1.  `POST /campaigns` (创建Campaign `C1`) → 获 Campaign ID `c1_id`。
    2.  `POST /templates` (创建模板 `TPL1`) → 获 Template ID `tpl1_id`。
    3.  `POST /template-sets` (创建模板组 `TS1`，包含 `TPL1`) → 获 TemplateSet ID `ts1_id`。
    4.  `POST /tasks` (在 `C1`下创建Task `TK1`，使用 `TS1`) → 获 Task ID `tk1_id`。
    5.  `GET /tasks/{tk1_id}` (验证Task状态为 `draft`)。
    6.  `POST /tasks/{tk1_id}/status` (将 `TK1` 状态改为 `scheduled`)。
    7.  *(等待调度器执行，模拟)* `SVC_CONTACT_RULE` 解析收件人, `task_contacts` 生成。
    8.  *(等待Worker执行，模拟)* `WORKER_POOL` 发送邮件，`ROUTING_SVC` 选择发件服务, `EXT_JIGUANG` 调用。
    9.  `GET /track/open/{uid_for_TK1_contact1}.gif` (模拟邮件打开)。
    10. `GET /track/click/{uid_for_TK1_contact1}?url=...` (模拟链接点击)。
    11. `GET /tasks/{tk1_id}/recipients` (验证联系人状态已更新为 `opened`, `clicked`)。
    12. `GET /tasks/{tk1_id}/report` (验证统计报告准确性)。
    13. `POST /campaigns/{c1_id}/status` (Campaign完成后，状态可能由系统更新为 `completed` 或手动更新)。

*   **UFT_02: 管理员配置流程**
    1.  `POST /admin/sender-services` (创建发件服务 `S1`) → 获 `s1_id`。
    2.  `GET /admin/sender-services` (验证 `S1` 在列表中)。
    3.  `POST /settings/variables` (创建邮件变量 `V1`) → 获 `v1_id`。
    4.  `POST /admin/users/{user_id}/sender-services` (为运营用户 `U1` 分配服务 `S1`)。
    5.  `GET /admin/users/{user_id}/sender-services` (验证 `U1` 已关联 `S1`)。

*   **UFT_03: 任务暂停与恢复**
    1.  ...创建并调度 Task `TK2` ...
    2.  `POST /tasks/{tk2_id}/status` (将 `TK2` 状态改为 `paused` 在其 `sending` 期间)。
    3.  *(验证 `WORKER_POOL` 停止处理 `TK2`)*。
    4.  `GET /tasks/{tk2_id}/report` (查看暂停时的统计)。
    5.  `POST /tasks/{tk2_id}/status` (将 `TK2` 状态改回 `scheduled` 或 `sending` 以恢复)。
    6.  *(验证 `WORKER_POOL` 从暂停点继续处理 `TK2` 或重新开始)*。

---

**自动化建议：**
*   上述所有接口级别的测试用例都非常适合自动化测试，尤其是 [P] 和 [N] 类型。
*   使用API测试框架 (如 Postman/Newman, RestAssured, PyTest+Requests, Karate DSL) 进行自动化。
*   将测试套件集成到CI/CD流程中，确保每次代码变更都经过API测试的验证。
*   核心用户流程 (如UFT_01, UFT_02) 应有端到端的自动化API测试脚本。
*   对于邮件追踪，自动化测试可以模拟 `open` 和 `click` 事件的HTTP GET请求，并通过API查询 `event_log` 和 `task_contacts` 的更新，以及 `report` 接口来验证数据一致性。
*   安全测试 [S] 应确保在没有Token、过期Token、无效Token或权限不足的Token情况下，接口按预期拒绝访问。
*   性能测试点 [L] 应用专门的性能测试工具 (如 k6, JMeter, Locust) 进行测试，关注高并发下的响应时间、吞吐量和错误率。
*   数据准备和清理应成为自动化测试脚本的一部分，确保测试环境的一致性和可重复性。

---
文档版本: v1.0
最后更新: {{CURRENT_DATE}} 