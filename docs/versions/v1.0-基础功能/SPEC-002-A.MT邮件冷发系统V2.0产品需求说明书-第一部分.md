# SPEC-002-A.MT邮件冷发系统V2.0产品需求说明书

## 文档信息

| 文档属性 | 内容                                |
| -------- | ----------------------------------- |
| 文档名称 | A.MT邮件冷发系统V2.0产品需求说明书  |
| 文档编号 | SPEC-002                            |
| 版本号   | V1.0                                |
| 创建日期 | 2023-12-20                          |
| 状态     | 草稿                                |
| 密级     | 内部文档                            |

## 修订历史

| 版本号 | 修订日期   | 修订人 | 修订说明       |
| ------ | ---------- | ------ | -------------- |
| V1.0   | 2023-12-20 | -      | 创建初始文档   |

## 目录

- [1. 引言](#1-引言)
  - [1.1 编写目的](#11-编写目的)
  - [1.2 项目背景](#12-项目背景)
  - [1.3 术语定义](#13-术语定义)
  - [1.4 参考资料](#14-参考资料)
- [2. 产品概述](#2-产品概述)
  - [2.1 产品定位](#21-产品定位)
  - [2.2 用户群体](#22-用户群体)
  - [2.3 产品目标](#23-产品目标)
  - [2.4 核心价值](#24-核心价值)
- [3. 系统架构](#3-系统架构)
  - [3.1 整体架构](#31-整体架构)
  - [3.2 功能模块](#32-功能模块)
  - [3.3 数据流图](#33-数据流图)
- [4. 功能需求](#4-功能需求)
  - [4.1 邮箱数据管理模块](#41-邮箱数据管理模块)
  - [4.2 批量任务系统](#42-批量任务系统)
  - [4.3 邮件内容管理模块](#43-邮件内容管理模块)
  - [4.4 发信系统与路由机制](#44-发信系统与路由机制)
  - [4.5 私域管理模块](#45-私域管理模块)
  - [4.6 系统管理与安全](#46-系统管理与安全)
- [5. 非功能需求](#5-非功能需求)
  - [5.1 性能需求](#51-性能需求)
  - [5.2 安全需求](#52-安全需求)
  - [5.3 可用性需求](#53-可用性需求)
  - [5.4 可扩展性需求](#54-可扩展性需求)
- [6. 界面要求](#6-界面要求)
  - [6.1 界面风格](#61-界面风格)
  - [6.2 关键界面描述](#62-关键界面描述)
- [7. 实施计划](#7-实施计划)
  - [7.1 开发阶段](#71-开发阶段)
  - [7.2 测试策略](#72-测试策略)
  - [7.3 上线策略](#73-上线策略)
- [8. 附录](#8-附录)
  - [8.1 功能与用户故事对应关系](#81-功能与用户故事对应关系)
  - [8.2 数据字典](#82-数据字典)

## 1. 引言

### 1.1 编写目的

本文档旨在详细描述A.MT邮件冷发系统V2.0的功能需求、非功能需求和界面要求，为系统开发、测试和验收提供依据。文档的主要读者包括产品经理、开发人员、测试人员和项目管理人员。

### 1.2 项目背景

A.MT邮件冷发系统是一个专注于批量邮件营销的平台，V1.0版本已经实现了基础的邮件发送功能。随着业务的发展，现有系统在联系人管理、任务调度、内容创建等方面存在一定局限性，难以满足更加精细化、个性化的营销需求。因此，V2.0版本旨在通过全面重构，提升系统在数据管理、任务执行、内容创建、发信路由以及私域管理等方面的能力。

### 1.3 术语定义

| 术语      | 定义                                                         |
| --------- | ------------------------------------------------------------ |
| KOL       | Key Opinion Leader，关键意见领袖，在特定领域具有较高知名度和影响力的人 |
| KOC       | Key Opinion Consumer，关键意见消费者，具有一定影响力但规模小于KOL的普通消费者 |
| 冷发      | 向未建立深度关系的目标用户批量发送邮件的营销方式             |
| 私域      | 企业或个人直接运营和管理的用户资产，如邮箱列表、社交关注者等 |
| ESP       | Email Service Provider，邮件服务提供商                       |
| 送达率    | 成功发送且未被ESP拒绝的邮件占比                             |
| 打开率    | 收件人打开邮件的比例                                         |
| 点击率    | 收件人点击邮件中链接的比例                                   |
| 退订率    | 收件人选择退订邮件的比例                                     |

### 1.4 参考资料

- A.MT邮件冷发系统V1.0产品文档
- REQ-001-A.MT邮件冷发系统V2.0需求文档
- SPEC-001-A.MT邮件冷发系统V2.0用户故事

## 2. 产品概述

### 2.1 产品定位

A.MT邮件冷发系统V2.0是一个专业的邮件营销平台，专注于帮助企业和个人向目标受众发送批量邮件，实现精准营销和用户转化。系统整合了邮箱数据管理、批量任务执行、内容智能创作、多通道发送路由以及私域用户管理等功能，为用户提供全流程的邮件营销解决方案。

### 2.2 用户群体

1. **电商/品牌营销团队**：需要进行产品推广、活动宣传、用户激活等邮件营销活动
2. **TikTok/社交媒体红人运营人员**：需要与KOL/KOC进行批量沟通，寻找合作机会
3. **需要进行大规模邮件触达的企业用户**：如SaaS企业、内容平台、教育机构等

### 2.3 产品目标

1. 提供高效的联系人管理和标签分类功能，实现精准人群定位
2. 优化任务创建和执行流程，提高邮件发送的效率和成功率
3. 强化内容创建能力，支持个性化和智能化邮件内容生成
4. 完善发信通道管理和路由策略，最大化邮件送达率
5. 构建以邮箱为中心的私域用户管理体系，提升长期运营效果
6. 确保系统安全、稳定、可扩展，满足不同规模用户的需求

### 2.4 核心价值

1. **精准触达**：多维度标签体系支持精细化人群筛选，实现精准营销
2. **高效执行**：智能任务调度和多通道发送，提高邮件营销效率
3. **个性化内容**：AI辅助内容创作，提升邮件吸引力和转化率
4. **数据驱动**：全面的数据分析，指导营销策略优化
5. **私域运营**：构建以邮箱为核心的用户资产，支持长期价值挖掘

## 3. 系统架构

### 3.1 整体架构

A.MT邮件冷发系统V2.0采用前后端分离架构，包括以下主要部分：

1. **前端应用层**：基于React的Web应用，提供用户界面和交互
2. **后端服务层**：基于Node.js/Express的API服务，处理业务逻辑
3. **数据存储层**：MongoDB存储联系人和标签数据，MySQL存储系统配置和任务数据
4. **队列与调度层**：基于Redis和RabbitMQ的任务队列和调度系统
5. **外部集成层**：与极光发信API、AI服务等第三方系统的集成

### 3.2 功能模块

系统主要包含以下功能模块：

1. **邮箱数据管理模块**：联系人管理、标签体系
2. **批量任务系统**：任务创建、任务调度与监控、任务数据分析、多轮营销任务
3. **邮件内容管理模块**：正文模板管理、AI内容模板、底部模板管理
4. **发信系统与路由机制**：发件通道管理、发信路由策略
5. **私域管理模块**：基础用户画像、互动历史管理
6. **系统管理与安全**：用户权限管理、系统配置

### 3.3 数据流图

系统主要数据流包括：

1. **联系人数据流**：导入 → 标签分类 → 筛选 → 任务目标人群
2. **任务数据流**：创建 → 调度 → 执行 → 监控 → 分析
3. **内容数据流**：模板创建 → 变量配置 → AI生成 → 预览 → 应用
4. **发信数据流**：任务触发 → 路由决策 → 通道分配 → 发送执行 → 状态反馈
5. **互动数据流**：邮件发送 → 打开/点击/回复追踪 → 用户画像更新 → 标签调整

## 4. 功能需求

### 4.1 邮箱数据管理模块

#### 4.1.1 联系人管理 (F01)

##### 功能描述

提供多维度联系人导入、管理与标签分类功能，支持批量操作和详细信息查看。

##### 详细需求

1. **联系人导入**
   - 支持CSV/Excel批量导入，自动字段匹配
   - 导入字段包括：id、用户名、邮箱、TikTok_uniqued_id、Ins_id、Youtobe_id、自定义字段1-5
   - 导入过程提供进度反馈和结果统计
   - 支持导入时进行初步过滤和标签分配

2. **联系人去重与合并**
   - 基于邮箱地址自动识别重复联系人
   - 提供手动合并功能，保留所有关联信息
   - 支持设置合并规则和优先级

3. **联系人搜索与筛选**
   - 支持多条件组合搜索
   - 支持基于标签、属性、互动历史等筛选
   - 提供保存常用筛选条件功能

4. **联系人详情页**
   - 显示基本信息(邮箱、用户名等)
   - 显示社媒账号信息(TikTok、Instagram、YouTube ID)
   - 显示历史互动记录(邮件打开、点击、回复)
   - 显示所属标签列表
   - 提供编辑和标签管理功能

5. **联系人批量操作**
   - 支持批量删除/移动/打标
   - 支持批量导出
   - 支持批量属性更新

##### 业务规则

1. 邮箱地址作为联系人的唯一标识
2. 导入时自动检测并提示重复联系人
3. 联系人删除操作需二次确认
4. 批量操作最大支持10万条记录

##### 界面原型

联系人管理界面应包括以下部分：
- 顶部操作栏(导入、导出、批量操作按钮)
- 左侧标签筛选面板
- 中部联系人列表(分页显示)
- 右侧联系人详情面板(选中时显示)
- 底部统计信息和分页控制

#### 4.1.2 标签体系 (F02)

##### 功能描述

构建多层级标签体系，支持精准人群定位，实现联系人的灵活分类和管理。

##### 详细需求

1. **标签创建与管理**
   - 支持创建多级嵌套标签(如KOC→美国→女性→时尚类)
   - 支持创建多个平行标签
   - 提供标签可视化管理界面
   - 支持标签重命名、移动、删除、合并操作

2. **标签规则创建**
   - 支持基于联系人属性设置自动分类规则
   - 规则支持条件组合(与/或/非逻辑)
   - 新导入联系人自动应用规则打标
   - 提供规则测试和预览功能

3. **标签组合筛选**
   - 支持多标签组合筛选(与/或/非逻辑)
   - 显示符合条件的联系人数量
   - 筛选结果可保存为新标签或直接用于创建任务

4. **标签批量操作**
   - 支持标签批量合并/拆分/重命名
   - 支持标签批量应用到联系人
   - 支持标签导入/导出

5. **基于标签的人群查看**
   - 支持查看单个标签下的所有联系人
   - 支持标签组合查询下的联系人列表
   - 提供标签人群的基本统计分析

##### 业务规则

1. 标签支持最多5级嵌套
2. 单个联系人可同时拥有多个标签
3. 父级标签删除时，需确认是否同时删除子标签
4. 标签规则冲突时，按规则优先级执行

##### 界面原型

标签管理界面应包括以下部分：
- 标签树形结构显示
- 标签创建/编辑/删除控制
- 标签规则配置面板
- 标签应用统计信息
- 标签组合筛选器 