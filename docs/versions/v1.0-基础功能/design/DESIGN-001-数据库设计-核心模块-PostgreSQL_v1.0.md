# DESIGN-001-数据库设计-核心模块-PostgreSQL_v1.0.md

## 1. 概述

本文档定义了A.MT邮件冷发系统V2.0核心模块（用户认证、联系人管理、标签管理）的PostgreSQL数据库表结构。这些设计基于项目需求文档 (REQ-001) 和产品需求说明书 (SPEC-002)。

**版本**: 1.0
**状态**: 初稿
**创建日期**: (自动填写当前日期)
**最后更新**: (自动填写当前日期)

## 2. 表结构定义

### 2.1 `users` 表

存储系统用户信息，用于认证和权限管理。

| 字段名         | 数据类型                    | 主键/外键 | 索引  | 约束条件                               | 默认值        | 描述                                     |
|----------------|-----------------------------|-----------|-------|----------------------------------------|---------------|------------------------------------------|
| `id`           | `SERIAL`                    | PK        | 是    | `PRIMARY KEY`                          | (自增)        | 用户唯一标识符                           |
| `username`     | `VARCHAR(255)`              |           | 是    | `UNIQUE`, `NOT NULL`                   |               | 用户名 (用于登录)                        |
| `email`        | `VARCHAR(255)`              |           | 是    | `UNIQUE`, `NOT NULL`                   |               | 用户邮箱 (用于登录、通知)                |
| `password_hash`| `VARCHAR(255)`              |           |       | `NOT NULL`                             |               | 加密后的用户密码                         |
| `role`         | `VARCHAR(50)`               |           |       | `NOT NULL`, `CHECK (role IN ('admin', 'operator', 'read_only'))` | `'operator'`  | 用户角色 (admin, operator, read_only)   |
| `is_active`    | `BOOLEAN`                   |           |       | `NOT NULL`                             | `TRUE`        | 账户是否激活                             |
| `created_at`   | `TIMESTAMP WITH TIME ZONE`  |           |       | `NOT NULL`                             | `NOW()`       | 记录创建时间                             |
| `updated_at`   | `TIMESTAMP WITH TIME ZONE`  |           |       | `NOT NULL`                             | `NOW()`       | 记录最后更新时间                         |

### 2.2 `contacts` 表

存储联系人信息。

| 字段名             | 数据类型                    | 主键/外键 | 索引  | 约束条件                               | 默认值    | 描述                                     |
|--------------------|-----------------------------|-----------|-------|----------------------------------------|-----------|------------------------------------------|
| `id`               | `SERIAL`                    | PK        | 是    | `PRIMARY KEY`                          | (自增)    | 联系人唯一标识符                         |
| `user_id`          | `INTEGER`                   | FK        | 是    | `NOT NULL`, `REFERENCES users(id) ON DELETE CASCADE` |           | 所属系统用户的ID                         |
| `email`            | `VARCHAR(255)`              |           | 是    | `NOT NULL`                             |           | 联系人邮箱                               |
| `username`         | `VARCHAR(255)`              |           |       |                                        | `NULL`    | 联系人用户名/昵称 (来自导入)             |
| `first_name`       | `VARCHAR(255)`              |           |       |                                        | `NULL`    | 联系人名字                               |
| `last_name`        | `VARCHAR(255)`              |           |       |                                        | `NULL`    | 联系人姓氏                               |
| `tiktok_unique_id` | `VARCHAR(255)`              |           |       |                                        | `NULL`    | TikTok Unique ID                         |
| `instagram_id`     | `VARCHAR(255)`              |           |       |                                        | `NULL`    | Instagram ID                             |
| `youtube_id`       | `VARCHAR(255)`              |           |       |                                        | `NULL`    | YouTube ID                               |
| `custom_field_1`   | `TEXT`                      |           |       |                                        | `NULL`    | 自定义字段1                              |
| `custom_field_2`   | `TEXT`                      |           |       |                                        | `NULL`    | 自定义字段2                              |
| `custom_field_3`   | `TEXT`                      |           |       |                                        | `NULL`    | 自定义字段3                              |
| `custom_field_4`   | `TEXT`                      |           |       |                                        | `NULL`    | 自定义字段4                              |
| `custom_field_5`   | `TEXT`                      |           |       |                                        | `NULL`    | 自定义字段5                              |
| `source`           | `VARCHAR(100)`              |           |       |                                        | `NULL`    | 联系人来源 (如 'import_csv', 'manual') |
| `imported_at`      | `TIMESTAMP WITH TIME ZONE`  |           |       |                                        | `NULL`    | 导入时间 (如果适用)                      |
| `created_at`       | `TIMESTAMP WITH TIME ZONE`  |           |       | `NOT NULL`                             | `NOW()`   | 记录创建时间                             |
| `updated_at`       | `TIMESTAMP WITH TIME ZONE`  |           |       | `NOT NULL`                             | `NOW()`   | 记录最后更新时间                         |
| **Constraint**: `UNIQUE (user_id, email)` (每个用户下的联系人邮箱唯一) |

### 2.3 `tags` 表

存储用户定义的标签信息。

| 字段名         | 数据类型                    | 主键/外键 | 索引  | 约束条件                               | 默认值    | 描述                                   |
|----------------|-----------------------------|-----------|-------|----------------------------------------|-----------|----------------------------------------|
| `id`           | `SERIAL`                    | PK        | 是    | `PRIMARY KEY`                          | (自增)    | 标签唯一标识符                         |
| `user_id`      | `INTEGER`                   | FK        | 是    | `NOT NULL`, `REFERENCES users(id) ON DELETE CASCADE` |           | 所属系统用户的ID                       |
| `name`         | `VARCHAR(255)`              |           | 是    | `NOT NULL`                             |           | 标签名称                               |
| `parent_id`    | `INTEGER`                   | FK        | 是    | `NULLABLE`, `REFERENCES tags(id) ON DELETE SET NULL` | `NULL`    | 父标签ID (用于层级标签)              |
| `description`  | `TEXT`                      |           |       |                                        | `NULL`    | 标签描述 (可选)                        |
| `created_at`   | `TIMESTAMP WITH TIME ZONE`  |           |       | `NOT NULL`                             | `NOW()`   | 记录创建时间                           |
| `updated_at`   | `TIMESTAMP WITH TIME ZONE`  |           |       | `NOT NULL`                             | `NOW()`   | 记录最后更新时间                       |
| **Constraint**: `UNIQUE (user_id, name, parent_id)` (同一用户、同一父标签下的标签名唯一，若parent_id为NULL，则同一用户下顶级标签名唯一。PostgreSQL需要特殊处理NULL的唯一性，或通过应用层保证) |
| **Alternative Constraint**: `UNIQUE (user_id, name)` (更简单，标签名在用户内全局唯一，层级仅为组织方式) |

*Note on `tags.parent_id` constraint: True unique constraint on `(user_id, name, parent_id)` where `parent_id` can be NULL requires careful handling in PostgreSQL, e.g., using two separate unique indexes (one for `parent_id IS NULL` and one for `parent_id IS NOT NULL`). For simplicity, this document notes the intent; precise DDL might vary. The alternative constraint `UNIQUE (user_id, name)` is simpler to implement.*

### 2.4 `contact_tags` 表 (关联表)

用于存储联系人与标签之间的多对多关系。

| 字段名        | 数据类型                    | 主键/外键 | 索引 | 约束条件                               | 默认值  | 描述             |
|---------------|-----------------------------|-----------|------|----------------------------------------|---------|------------------|
| `contact_id`  | `INTEGER`                   | PK, FK    | 是   | `NOT NULL`, `REFERENCES contacts(id) ON DELETE CASCADE` |         | 联系人ID         |
| `tag_id`      | `INTEGER`                   | PK, FK    | 是   | `NOT NULL`, `REFERENCES tags(id) ON DELETE CASCADE`    |         | 标签ID           |
| `assigned_at` | `TIMESTAMP WITH TIME ZONE`  |           |      | `NOT NULL`                             | `NOW()` | 分配时间         |
| **Primary Key**: `(contact_id, tag_id)`     |

## 3. ER 图 (Mermaid)

```mermaid
erDiagram
    users {
        SERIAL id PK
        VARCHAR username "用户名 (UNIQUE, NOT NULL)"
        VARCHAR email "邮箱 (UNIQUE, NOT NULL)"
        VARCHAR password_hash "密码哈希 (NOT NULL)"
        VARCHAR role "角色 (NOT NULL, DEFAULT 'operator')"
        BOOLEAN is_active "是否激活 (NOT NULL, DEFAULT TRUE)"
        TIMESTAMP_TZ created_at "创建时间 (NOT NULL, DEFAULT NOW())"
        TIMESTAMP_TZ updated_at "更新时间 (NOT NULL, DEFAULT NOW())"
    }

    contacts {
        SERIAL id PK
        INTEGER user_id FK "所属用户ID (NOT NULL)"
        VARCHAR email "邮箱 (NOT NULL, UNIQUE per user_id)"
        VARCHAR username "联系人用户名"
        VARCHAR first_name "名"
        VARCHAR last_name "姓"
        VARCHAR tiktok_unique_id "TikTok ID"
        VARCHAR instagram_id "Instagram ID"
        VARCHAR youtube_id "YouTube ID"
        TEXT custom_field_1 "自定义字段1"
        TEXT custom_field_2 "自定义字段2"
        TEXT custom_field_3 "自定义字段3"
        TEXT custom_field_4 "自定义字段4"
        TEXT custom_field_5 "自定义字段5"
        VARCHAR source "来源"
        TIMESTAMP_TZ imported_at "导入时间"
        TIMESTAMP_TZ created_at "创建时间 (NOT NULL, DEFAULT NOW())"
        TIMESTAMP_TZ updated_at "更新时间 (NOT NULL, DEFAULT NOW())"
    }

    tags {
        SERIAL id PK
        INTEGER user_id FK "所属用户ID (NOT NULL)"
        VARCHAR name "标签名 (NOT NULL, UNIQUE per user_id or user_id+parent_id)"
        INTEGER parent_id FK "父标签ID (NULLABLE)"
        TEXT description "描述"
        TIMESTAMP_TZ created_at "创建时间 (NOT NULL, DEFAULT NOW())"
        TIMESTAMP_TZ updated_at "更新时间 (NOT NULL, DEFAULT NOW())"
    }

    contact_tags {
        INTEGER contact_id PK FK "联系人ID (NOT NULL)"
        INTEGER tag_id PK FK "标签ID (NOT NULL)"
        TIMESTAMP_TZ assigned_at "分配时间 (NOT NULL, DEFAULT NOW())"
    }

    users ||--o{ contacts : "has"
    users ||--o{ tags : "creates"
    contacts ||--|{ contact_tags : "has"
    tags ||--|{ contact_tags : "belongs to"
    tags }o--o{ tags : "is parent of (parent_id)"

```

## 4. 索引策略

- **`users`**:
    - `id` (Primary Key)
    - `username` (Unique Index)
    - `email` (Unique Index)
- **`contacts`**:
    - `id` (Primary Key)
    - `user_id` (Foreign Key Index)
    - `(user_id, email)` (Composite Unique Index)
    - Potentially on `tiktok_unique_id`, `instagram_id`, `youtube_id` if frequently searched.
- **`tags`**:
    - `id` (Primary Key)
    - `user_id` (Foreign Key Index)
    - `(user_id, name, parent_id)` or `(user_id, name)` (Unique Index - see note in table definition)
    - `parent_id` (Foreign Key Index)
- **`contact_tags`**:
    - `(contact_id, tag_id)` (Primary Key - composite index)
    - `tag_id` (Index - for finding all contacts with a specific tag)

## 5. 数据类型说明

- `SERIAL`: PostgreSQL auto-incrementing integer.
- `VARCHAR(n)`: Variable-length string with a limit.
- `TEXT`: Variable-length string with no predefined limit.
- `BOOLEAN`: True/False.
- `INTEGER`: Standard integer.
- `TIMESTAMP WITH TIME ZONE` (`TIMESTAMP_TZ` in Mermaid): Timestamp including time zone information, recommended for storing date/time globally.

## 6. 注意事项和未来考虑

- **角色权限细化**: `users.role` 目前较为简单。未来可能需要更细致的RBAC（Role-Based Access Control）系统，可能涉及额外的 `permissions` 和 `role_permissions` 表。
- **联系人互动历史**: PRD中提到联系人详情包含"历史互动记录"。这部分数据（如邮件打开、点击、回复）将存储在独立的表中，并通过 `contact_id` 与 `contacts` 表关联。这些表将在后续设计中定义。
- **标签自动规则**: PRD中提到的"标签规则创建（基于用户属性自动分类）"的实现将主要在应用层逻辑中，数据库层面主要提供标签存储和关联。
- **自定义字段**: `contacts` 表中的 `custom_field_1` 到 `custom_field_5` 是通用文本字段。如果需要更结构化或更多自定义字段，未来可能需要采用EAV（Entity-Attribute-Value）模型或JSONB类型的字段。
- **软删除**: 目前所有删除操作（如 `ON DELETE CASCADE`）都是硬删除。如果需要软删除功能，可以为相关表添加 `deleted_at TIMESTAMP WITH TIME ZONE NULLABLE` 字段。
- **唯一性约束中的NULL**: PostgreSQL处理 `UNIQUE` 约束时，多个 `NULL` 值不被视为相等。因此，`tags` 表中 `(user_id, name, parent_id)` 的唯一性约束，如果 `parent_id` 为 `NULL`，需要特别设计（例如，使用两个部分唯一索引）。 