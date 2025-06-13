# SPEC-002: EDM系统目录结构规范

## 📁 目录结构标准化

### 🎯 问题背景

当前系统存在目录结构混乱问题：
- `src/backend/services/` vs `src/backend/src/services/`
- `src/backend/routes/` vs `src/backend/src/routes/`
- 代码引用路径不一致
- 职责划分不清晰

### 📋 标准化方案

#### 🏗️ 统一目录结构

```
src/backend/
├── src/                          # 核心应用代码
│   ├── index.js                  # 应用入口
│   ├── config/                   # 配置文件
│   ├── models/                   # 数据模型 (Sequelize)
│   ├── controllers/              # 控制器 (业务逻辑入口)
│   ├── services/                 # 业务服务层
│   │   ├── core/                 # 核心业务服务
│   │   │   ├── user.service.js
│   │   │   ├── contact.service.js
│   │   │   ├── template.service.js
│   │   │   ├── task.service.js
│   │   │   └── subtask.service.js
│   │   ├── infrastructure/       # 基础设施服务
│   │   │   ├── TaskScheduler.js
│   │   │   ├── EmailRoutingService.js
│   │   │   └── QuotaService.js
│   │   └── third-party/          # 第三方集成
│   │       ├── mail.service.js
│   │       └── mailWorker.service.js
│   ├── routes/                   # API路由
│   ├── middlewares/              # 中间件
│   └── utils/                    # 工具函数
├── config/                       # 外部配置 (数据库等)
├── migrations/                   # 数据库迁移
├── seeders/                      # 数据种子
├── scripts/                      # 脚本工具
├── test/                         # 测试文件
├── logs/                         # 日志文件
├── temp/                         # 临时文件
└── docs/                         # 项目文档
```

#### 🎯 目录职责划分

##### 核心业务服务 (`src/services/core/`)
- **用途**: 业务领域逻辑，直接对应业务概念
- **命名**: `[实体名].service.js`
- **示例**: `user.service.js`, `task.service.js`
- **职责**: CRUD操作、业务规则验证、数据转换

##### 基础设施服务 (`src/services/infrastructure/`)
- **用途**: 技术基础设施，支撑业务运行
- **命名**: `[功能名]Service.js` 或 `[功能名]Scheduler.js`
- **示例**: `TaskScheduler.js`, `EmailRoutingService.js`
- **职责**: 调度、路由、监控、缓存等

##### 第三方集成 (`src/services/third-party/`)
- **用途**: 外部系统集成和适配
- **命名**: `[服务商名].service.js`
- **示例**: `sendgrid.service.js`, `mailgun.service.js`
- **职责**: API调用、数据格式转换、错误处理

### 🔧 迁移方案

#### Step 1: 重新组织services目录

```bash
# 创建新的目录结构
mkdir -p src/backend/src/services/core
mkdir -p src/backend/src/services/infrastructure
mkdir -p src/backend/src/services/third-party

# 移动业务服务到core
mv src/backend/src/services/user.service.js src/backend/src/services/core/
mv src/backend/src/services/contact.service.js src/backend/src/services/core/
mv src/backend/src/services/template.service.js src/backend/src/services/core/
mv src/backend/src/services/task.service.js src/backend/src/services/core/
mv src/backend/src/services/subtask.service.js src/backend/src/services/core/

# 移动基础设施服务到infrastructure
mv src/backend/services/TaskScheduler.js src/backend/src/services/infrastructure/
mv src/backend/services/EmailRoutingService.js src/backend/src/services/infrastructure/
mv src/backend/services/QuotaService.js src/backend/src/services/infrastructure/

# 移动第三方服务到third-party
mv src/backend/src/services/mail.service.js src/backend/src/services/third-party/
mv src/backend/src/services/mailWorker.service.js src/backend/src/services/third-party/

# 删除外层重复目录
rm -rf src/backend/services
rm -rf src/backend/routes
```

#### Step 2: 更新引用路径

所有服务引用统一为：
```javascript
// ✅ 正确的引用方式
const TaskScheduler = require('../services/infrastructure/TaskScheduler');
const UserService = require('../services/core/user.service');
const ContactService = require('../services/core/contact.service');
const MailService = require('../services/third-party/mail.service');
```

#### Step 3: 清理Campaign相关代码

需要删除的文件和引用：
- ❌ `campaign.service.js` (V2.0暂不实现Campaign)
- ❌ `routing.service.js` (已由EmailRoutingService替代)
- ❌ 所有`campaign_id`引用

### 📏 引用路径规范

#### 路径别名配置
```javascript
// 在src/index.js中配置路径别名
const path = require('path');

// 设置基础路径
const basePath = path.join(__dirname);

// 服务引用别名
const SERVICES = {
  CORE: path.join(basePath, 'services/core'),
  INFRASTRUCTURE: path.join(basePath, 'services/infrastructure'),
  THIRD_PARTY: path.join(basePath, 'services/third-party')
};

module.exports = { SERVICES };
```

#### 标准引用方式
```javascript
// 在controllers中引用services
const UserService = require('../services/core/user.service');
const TaskScheduler = require('../services/infrastructure/TaskScheduler');

// 在routes中引用controllers
const UserController = require('../controllers/user.controller');

// 在services中引用models
const { User, Task, SubTask } = require('../models');
```

### 🚨 强制性规范

#### 1. 文件命名
- **业务服务**: `[实体名].service.js` (小写+点分隔)
- **基础设施**: `[功能名]Service.js` (驼峰命名)
- **控制器**: `[实体名].controller.js`
- **路由**: `[模块名].js` 或 `[功能名].routes.js`

#### 2. 目录禁令
- ❌ 禁止在`src/backend/`外层创建`services/`, `routes/`, `models/`
- ❌ 禁止混合使用相对路径和绝对路径
- ❌ 禁止跨层级目录引用

#### 3. 引用规范
- ✅ 同层级使用相对路径: `./xxx.service.js`
- ✅ 跨层级使用从src开始的相对路径: `../models/`
- ✅ 第三方包使用包名: `require('express')`

### 📊 迁移前后对比

#### 迁移前 (混乱状态)
```
src/backend/
├── services/           # 基础设施服务 (新)
├── routes/             # 外层路由 (冗余)
└── src/
    ├── services/       # 业务服务 (旧)
    └── routes/         # 内层路由 (正式)
```

#### 迁移后 (标准状态)
```
src/backend/
└── src/
    ├── services/
    │   ├── core/           # 业务服务
    │   ├── infrastructure/ # 基础设施服务
    │   └── third-party/    # 第三方集成
    └── routes/             # 统一路由
```

### ✅ 迁移验证清单

- [ ] 所有服务文件正确分类
- [ ] 引用路径全部更新
- [ ] 测试用例路径修正
- [ ] 删除冗余目录
- [ ] 清理Campaign相关代码
- [ ] 更新文档引用

---

**📝 维护者**: 项目控制中心  
**📅 创建时间**: V2.0架构重构  
**🔄 更新频率**: 架构调整时更新  
**🎯 强制等级**: 必须遵守 