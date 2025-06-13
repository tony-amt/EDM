# DEV-002-A.MT邮件冷发系统V2.0初始化步骤

## 文档信息

| 项目 | 内容 |
|------|------|
| 文档编号 | DEV-002 |
| 版本 | V1.0 |
| 创建日期 | 2023-07-21 |
| 状态 | 执行中 |

## 一、阶段一启动准备

根据DEV-001开发计划，现开始执行阶段一"项目启动与环境搭建"的具体实施步骤。本文档详细说明初始化环境、仓库创建及项目基础架构搭建的操作流程。

## 二、前置依赖确认

### 1. API访问凭证

- [ ] 极光邮件API的API_USER与API_KEY
- [ ] 极光邮件WebHook回调URL配置
- [ ] API测试账号准备

### 2. 基础环境检查

- [ ] 开发服务器环境准备
- [ ] 域名规划与DNS配置
- [ ] SSL证书申请

## 三、代码仓库初始化

### 1. 仓库创建

```bash
# 创建项目目录
mkdir -p A.MT-Email-System-V2
cd A.MT-Email-System-V2

# 初始化Git仓库
git init
echo "# A.MT邮件冷发系统V2.0" > README.md
git add README.md
git commit -m "初始化项目仓库"

# 创建基础目录结构
mkdir -p frontend backend docs scripts
```

### 2. 分支策略设定

```
- main：生产环境分支，保持稳定
- develop：开发主分支，功能集成测试
- feature/*：功能开发分支
- release/*：版本发布分支
- hotfix/*：紧急修复分支
```

### 3. 提交规范

```
- feat: 新功能
- fix: 修复bug
- docs: 文档更新
- style: 代码风格修改
- refactor: 代码重构
- perf: 性能优化
- test: 测试相关
- chore: 构建过程或辅助工具变动
```

## 四、前端项目初始化

### 1. 项目创建

```bash
cd frontend

# 使用Create React App创建项目
npx create-react-app a-mt-email-client --template typescript

cd a-mt-email-client

# 安装UI组件库和其他依赖
npm install antd @ant-design/icons @ant-design/pro-components
npm install axios react-router-dom redux react-redux @reduxjs/toolkit
npm install dayjs lodash

# 代码规范工具
npm install --save-dev eslint prettier eslint-config-prettier eslint-plugin-prettier
```

### 2. 目录结构设置

```bash
mkdir -p src/api src/components src/pages src/utils src/store src/hooks src/types
```

### 3. 基础配置文件

```bash
# 创建环境配置文件
touch .env.development .env.production

# 配置路由
touch src/routes.tsx

# 创建API请求封装
touch src/api/request.ts
```

## 五、后端项目初始化

### 1. 项目创建

```bash
cd ../backend

# 初始化Node.js项目
npm init -y

# 安装核心依赖
npm install express mongoose redis jsonwebtoken dotenv cors helmet morgan
npm install nodemailer axios winston mongoose-paginate-v2

# 开发依赖
npm install --save-dev typescript ts-node nodemon @types/express @types/node
npm install --save-dev jest supertest eslint prettier
```

### 2. TypeScript配置

```bash
# 初始化TypeScript配置
npx tsc --init

# 创建tsconfig.json
cat > tsconfig.json << EOL
{
  "compilerOptions": {
    "target": "es2018",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "**/*.test.ts"]
}
EOL
```

### 3. 目录结构设置

```bash
mkdir -p src/config src/controllers src/middlewares src/models src/routes src/services src/utils src/types
```

### 4. 基础配置文件

```bash
# 创建环境配置文件
touch .env.development .env.production

# 创建应用入口
touch src/app.ts
touch src/server.ts

# 创建数据库连接配置
touch src/config/database.ts
```

## 六、数据库初始化

### 1. MongoDB设置

```bash
# 创建MongoDB数据模型
touch src/models/user.model.ts
touch src/models/contact.model.ts
touch src/models/tag.model.ts
touch src/models/task.model.ts
touch src/models/emailRoute.model.ts
touch src/models/template.model.ts
```

### 2. 数据库初始化脚本

```bash
mkdir -p scripts/db
touch scripts/db/init-mongodb.js
```

### 3. Redis配置

```bash
touch src/config/redis.ts
```

## 七、极光API集成准备

### 1. API服务封装

```bash
mkdir -p src/services/email
touch src/services/email/engage-lab.service.ts
```

### 2. WebHook接收服务

```bash
touch src/routes/webhook.routes.ts
touch src/controllers/webhook.controller.ts
```

### 3. API测试脚本

```bash
mkdir -p scripts/api-tests
touch scripts/api-tests/engage-lab-test.js
```

## 八、Docker环境配置

### 1. 开发环境Docker配置

```bash
# 创建Docker配置文件
touch docker-compose.yml
touch frontend/Dockerfile
touch backend/Dockerfile
```

### 2. Docker Compose内容

```yaml
version: '3.8'

services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "4000:4000"
    volumes:
      - ./backend:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - MONGO_URI=mongodb://mongo:27017/amt_email
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongo
      - redis

  mongo:
    image: mongo:5.0
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

  redis:
    image: redis:6.2
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

volumes:
  mongo-data:
  redis-data:
```

## 九、初始提交

```bash
# 添加.gitignore文件
cat > .gitignore << EOL
# 依赖
node_modules/
npm-debug.log
yarn-debug.log
yarn-error.log

# 构建
/dist
/build
/out

# 环境变量
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
.env.development
.env.production

# 编辑器
.idea/
.vscode/
*.swp
*.swo

# 操作系统
.DS_Store
Thumbs.db

# 日志
logs
*.log

# 测试
coverage/
EOL

# 提交初始化代码
git add .
git commit -m "feat: 项目基础架构初始化"
```

## 十、第一周工作计划

### 第1天 - 环境搭建
- 完成代码仓库创建与初始化
- 前后端项目骨架搭建
- Docker环境配置

### 第2天 - 前端基础架构
- 路由配置
- Redux存储设置
- UI组件库集成
- 基础页面布局

### 第3天 - 后端基础架构
- Express服务器配置
- MongoDB连接设置
- JWT认证中间件
- 基础API路由

### 第4-5天 - 数据库设计与初始化
- 完成所有数据模型设计
- 编写数据库索引
- 创建初始测试数据
- API文档框架搭建

### 第6-7天 - 极光API集成
- 极光API调用封装
- WebHook接收服务实现
- API测试与验证
- 发送流程原型实现

## 十一、验收标准

阶段一完成后，应达到以下验收标准：

1. 完整的项目骨架，包括前后端代码仓库
2. 可运行的开发环境，支持本地开发和测试
3. 基础数据模型完成并可通过API进行CRUD操作
4. 极光API集成原型，能够发送测试邮件
5. 团队成员可按规范进行代码提交与协作 