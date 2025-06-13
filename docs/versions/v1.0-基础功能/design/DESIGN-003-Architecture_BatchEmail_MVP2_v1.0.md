# 架构设计：批量发信模块 (MVP 方案二 v1.0)

## 1. 系统结构图 (Mermaid)

```mermaid
graph TD
    subgraph "用户端 (Web APP / UI)"
        U_OP[运营人员界面]
        U_ADMIN[超级管理员界面]
    end

    subgraph "应用服务层 (Backend API)"
        API_GW[API 网关/路由]

        subgraph "核心业务服务"
            SVC_CAMPAIGN[Campaign 管理服务]
            SVC_TASK[Task 管理服务]
            SVC_TEMPLATE[模板与变量管理服务]
            SVC_CONTACT_RULE[联系人规则解析服务]
            SVC_REPORT[统计报告服务]
        end

        subgraph "调度与执行服务"
            SCHEDULER[任务调度器 (Scheduler)]
            WORKER_POOL[邮件发送工作池 (Task Workers)]
            ROUTING_SVC[发件路由与管理服务 (Sender Picker & Manager)]
        end

        subgraph "支撑服务"
            AUTH_SVC[认证与授权服务 (已有)]
            CONTACT_SVC[联系人管理服务 (已有)]
            TAG_SVC[标签管理服务 (已有)]
            USER_MGT_SVC[用户管理服务 (已有)]
            NOTIFY_SVC[通知服务 (可选, 如任务暂停告警)]
        end

        subgraph "外部服务接口层"
            EXT_JIGUANG[极光邮件 API 客户端]
        end
    end

    subgraph "数据存储层"
        DB[(关系型数据库 MySQL/PostgreSQL)]
        CACHE[(缓存 Redis - 可选, 用于任务队列、计数器等)]
        LOG_DB[(日志存储 - ELK/Loki 可选)]
    end

    subgraph "外部依赖"
        JIGUANG_API[极光邮件服务 API]
        TRACKING_ENDPOINT[邮件追踪回调端点 (由本系统提供)]
    end

    %% UI to API
    U_OP --> API_GW
    U_ADMIN --> API_GW

    %% API Gateway to Services
    API_GW --> AUTH_SVC
    API_GW --> SVC_CAMPAIGN
    API_GW --> SVC_TASK
    API_GW --> SVC_TEMPLATE
    API_GW --> SVC_REPORT
    API_GW --> CONTACT_SVC
    API_GW --> TAG_SVC
    API_GW --> USER_MGT_SVC 
    API_GW --> ROUTING_SVC 

    %% Service Interactions
    SVC_CAMPAIGN -- CRUD --> DB
    SVC_TASK -- CRUD --> DB
    SVC_TASK -- uses --> SVC_CONTACT_RULE
    SVC_TASK -- uses --> SVC_TEMPLATE
    SVC_TEMPLATE -- CRUD --> DB
    SVC_REPORT -- reads --> DB
    SVC_CONTACT_RULE -- reads --> CONTACT_SVC
    SVC_CONTACT_RULE -- reads --> TAG_SVC
    SVC_CONTACT_RULE -- reads --> DB // Potentially direct read for system labels logic
    
    SCHEDULER -- scans --> SVC_TASK    // Scan for tasks
    SCHEDULER -- dispatches to --> WORKER_POOL // Dispatch tasks to workers

    WORKER_POOL -- resolves contacts via --> SVC_CONTACT_RULE
    WORKER_POOL -- renders template via --> SVC_TEMPLATE
    WORKER_POOL -- gets sender via --> ROUTING_SVC
    ROUTING_SVC -- reads/updates --> DB // Read sender_services, update used_today
    WORKER_POOL -- sends via --> EXT_JIGUANG
    WORKER_POOL -- logs to --> DB // e.g., event_log, task_contacts status
    WORKER_POOL -- uses --> CACHE // for distributed locks, rate limiting if not on sender_service
    
    EXT_JIGUANG --> JIGUANG_API
    
    %% Tracking
    TRACKING_ENDPOINT --> API_GW // Callbacks hit API Gateway
    API_GW -- tracking data --> SVC_TASK // Or a dedicated Tracking Service
    SVC_TASK -- logs tracking --> DB // event_log, task_contacts update

    %% Admin specific service interactions
    ROUTING_SVC -- CRUD sender_services, user_sender_service_access --> DB

    %% Optional Caching
    DB -- write-through/read-aside --> CACHE

    %% Notifications (Optional)
    SVC_TASK -- notifies via --> NOTIFY_SVC
    ROUTING_SVC -- notifies via --> NOTIFY_SVC
    
    %% Logging
    SVC_CAMPAIGN -- logs to --> LOG_DB
    SVC_TASK -- logs to --> LOG_DB
    SCHEDULER -- logs to --> LOG_DB
    WORKER_POOL -- logs to --> LOG_DB

```

**模块说明:**

*   **用户端 (Web APP / UI):**
    *   `运营人员界面`: 提供 Campaign、Task、邮件模板、模板组、邮件变量的管理功能。
    *   `超级管理员界面`: 提供发件服务管理、用户与发件服务关联管理等。
*   **应用服务层 (Backend API):**
    *   `API 网关/路由`: 统一的 API 入口，负责请求路由、基础认证、限流等。
    *   **核心业务服务:**
        *   `Campaign 管理服务`: 处理 Campaign 的增删改查和状态变更。
        *   `Task 管理服务`: 处理 Task 的增删改查、状态变更、触发执行、接收事件回调。
        *   `模板与变量管理服务`: 管理邮件模板、模板组、邮件变量。
        *   `联系人规则解析服务`: 根据 Task 的 `recipient_rule` 从 `contacts` 和 `tags` 服务获取目标联系人列表。生成 `task_contacts` 清单。
        *   `统计报告服务`: 生成 Campaign 和 Task 的统计数据。
    *   **调度与执行服务:**
        *   `任务调度器 (Scheduler)`: 定时扫描 `tasks` 表中状态为 `scheduled`且`plan_time`已到的任务，将其状态更新为`sending`的初始阶段（如 `pending_dispatch`），并推送任务ID到消息队列/任务队列。
        *   `邮件发送工作池 (Task Workers)`: 从消息队列/任务队列中获取任务ID，异步执行邮件发送任务。每个 Worker 处理一个Task下的分批联系人：获取联系人详情、渲染模板（替换变量）、通过 `发件路由与管理服务` 选择发件服务、调用 `极光邮件 API 客户端` 发送、记录发送日志和事件到`event_log`和`task_contacts`。
        *   `发件路由与管理服务 (Sender Picker & Manager)`: 根据 `sender_services` 表的健康状况和配额，为发送任务选择合适的发件服务。也负责管理服务本身（增删改查）和用户绑定关系 (P_ADMIN_01, P_ADMIN_02, P_ADMIN_03 相关逻辑)。
    *   **支撑服务:**
        *   `认证与授权服务 (已有)`: 负责用户登录认证和接口权限校验。
        *   `联系人管理服务 (已有)`: 提供联系人数据的 CRUD 操作。
        *   `标签管理服务 (已有)`: 提供标签数据的 CRUD 和联系人打标操作。
        *   `用户管理服务 (已有)`: 提供用户信息的管理，供 `created_by` 及权限模块使用。
        *   `通知服务 (可选)`: 用于发送系统告警，如任务暂停、服务冻结。
    *   **外部服务接口层:**
        *   `极光邮件 API 客户端`: 封装对极光邮件发送 API 的调用，处理认证、请求构建和响应解析。
*   **数据存储层:**
    *   `关系型数据库`: 存储所有业务数据 (MySQL/PostgreSQL)。
    *   `缓存 (可选)`: Redis 等，用于缓存热点数据（如发件服务状态、模板内容）、会话、分布式锁、任务队列（若不使用独立消息队列中间件）、计数器（如 `used_today` 的快速更新）。
    *   `日志存储 (可选)`: ELK Stack 或 Grafana Loki，用于集中式应用日志管理。
*   **外部依赖:**
    *   `极光邮件服务 API`: 实际的邮件发送通道。
    *   `邮件追踪回调端点`: 系统自身提供的 HTTP 端点，用于接收邮件打开和点击的追踪请求，通常部署在API网关之后，由`Task 管理服务`或专用追踪服务处理。

## 2. 技术选型建议

*   **后端框架:** (根据项目已有技术栈)
    *   Java: Spring Boot
    *   Python: Django / Flask (配合 Celery)
    *   Node.js: Express.js / NestJS (配合 BullMQ)
*   **前端框架:** (根据项目已有技术栈)
    *   React, Vue.js, Angular
*   **数据库:** MySQL 或 PostgreSQL
*   **富文本编辑器 (前端):** TinyMCE
*   **任务队列/后台作业:** (根据后端语言和复杂度选择)
    *   轻量级: 后端框架自带的异步任务执行器 (如 Spring `@Async`, Python `ThreadPoolExecutor`)
    *   中/重量级: RabbitMQ, Kafka, Redis Streams (作为消息代理), Celery, BullMQ, Sidekiq.
    *   *推荐使用独立的消息队列中间件，如 RabbitMQ，以实现更好的解耦和可靠性。*
*   **调度器:**
    *   APScheduler (Python), node-cron (Node.js), Quartz (Java), 或基于消息队列的延迟消息实现。
*   **缓存:** Redis
*   **API 网关:** Nginx, Kong, Spring Cloud Gateway, 或云服务商提供。
*   **邮件发送SDK:** 官方或社区维护的极光邮件Java/Python/Node.js SDK。
*   **日志系统:** ELK Stack 或 Grafana Loki。
*   **监控与告警:** Prometheus + Grafana。

## 3. 可复用模块清单

*   **认证与授权服务 (已有)**
*   **联系人管理服务 (已有)**
*   **标签管理服务 (已有)**
*   **用户管理服务 (已有)**
*   **统一数据库访问层/ORM (已有)**
*   **统一配置管理组件 (已有)**
*   **统一日志记录框架 (已有)**
*   **统一API响应格式化组件 (已有)**

## 4. 模块间接口建议 (高级概述)

*   **UI ↔ API 网关 (RESTful API):**
    *   Campaigns: `POST /v1/campaigns`, `GET /v1/campaigns`, `GET /v1/campaigns/{id}`, `PUT /v1/campaigns/{id}`, `DELETE /v1/campaigns/{id}`
    *   Tasks: `POST /v1/tasks`, `GET /v1/tasks` (可带 `campaign_id` query), `GET /v1/tasks/{id}`, `PUT /v1/tasks/{id}` (状态变更、内容修改), `GET /v1/tasks/{id}/report`, `POST /v1/tasks/{id}/retry` (手动重试)
    *   Templates: `POST /v1/templates`, `GET /v1/templates`, `GET /v1/templates/{id}`, `PUT /v1/templates/{id}`, `DELETE /v1/templates/{id}`
    *   TemplateSets: `POST /v1/template-sets`, `GET /v1/template-sets`, `GET /v1/template-sets/{id}`, `PUT /v1/template-sets/{id}`, `DELETE /v1/template-sets/{id}`
    *   EmailVariables: `POST /v1/settings/variables`, `GET /v1/settings/variables`, `GET /v1/settings/variables/{key}`, `PUT /v1/settings/variables/{key}`, `DELETE /v1/settings/variables/{key}`
    *   SenderServices (Admin): `POST /v1/admin/sender-services`, `GET /v1/admin/sender-services`, `GET /v1/admin/sender-services/{id}`, `PUT /v1/admin/sender-services/{id}`, `DELETE /v1/admin/sender-services/{id}`, `POST /v1/admin/sender-services/{id}/set-status` (冻结/解冻)
    *   UserSenderBindings (Admin): `GET /v1/admin/users/{userId}/sender-services`, `POST /v1/admin/users/{userId}/sender-services` (body: `[{serviceId, action: 'add'/'remove'}]`)
    *   Tracking Callbacks (通常无需认证或使用特定token):
        *   `GET /track/open/{event_tracking_uid}.gif`
        *   `GET /track/click/{event_tracking_uid}?url=encoded_original_url`

*   **内部服务间通信 (gRPC, REST, or Message Queue):**

    *   **Task 管理服务 → 联系人规则解析服务:**
        *   `ResolveContacts(ResolveContactsRequest{recipientRuleJson})`: returns `ResolveContactsResponse{contactIds[]}`

    *   **Task 管理服务 / Worker → 模板与变量管理服务:**
        *   `RenderEmailContent(RenderEmailRequest{templateId, contactContextMap, systemContextMap})`: returns `RenderEmailResponse{subject, body}`
        *   `GetTemplateSet(GetTemplateSetRequest{templateSetId})`: returns `GetTemplateSetResponse{templates[{templateId, order}]}`
        *   `GetVariableDefinitions()`: returns `VariableDefinitionList`

    *   **邮件发送工作池 (Worker) → 发件路由与管理服务:**
        *   `PickSenderService(PickSenderRequest{user_id_optional})`: returns `PickSenderResponse{senderServiceDetails}` or `Error_NoServiceAvailable`
        *   `RecordSendAttempt(RecordSendAttemptRequest{serviceId, success})`: updates `used_today`, `consecutive_errors` etc.

    *   **邮件发送工作池 (Worker) → 极光邮件 API 客户端:**
        *   `Send(SendRequest{credentials, toEmail, subject, htmlBody, ...})`: returns `SendResponse{success, messageId, error}`

    *   **调度器 (Scheduler) → Task 管理服务 (or directly to DB for read, then update via API/Message):**
        *   `QueryDueTasks()`: returns `TaskIDList`
        *   (Scheduler to Message Queue): `PublishTaskToProcess(TaskProcessMessage{taskId})`

    *   **Task 管理服务 (Callback Handler) → DB / Worker (via Message Queue for aggregation):**
        *   `ProcessTrackingEvent(TrackingEvent{type, event_tracking_uid, details})`

---
文档版本: v1.0
最后更新: {{CURRENT_DATE}} 