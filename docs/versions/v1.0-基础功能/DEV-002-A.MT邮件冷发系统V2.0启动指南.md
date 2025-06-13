# DEV-002-A.MT邮件冷发系统V2.0启动指南

## 一、环境准备

### 1.1 必需软件

| 软件 | 最低版本 | 下载链接 |
|------|---------|---------|
| Node.js | v16.0.0+ | [https://nodejs.org/](https://nodejs.org/) |
| Docker (推荐) | 最新版 | [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/) |
| Docker Compose (推荐) | 最新版 | 通常包含在Docker Desktop中 |
| MongoDB (Docker替代方案) | v4.4+ | [https://www.mongodb.com/try/download/community](https://www.mongodb.com/try/download/community) |
| Redis (Docker替代方案) | v6.0+ | [https://redis.io/download](https://redis.io/download) |
| Git | 最新版 | [https://git-scm.com/downloads](https://git-scm.com/downloads) |

### 1.2 极光API账号准备

使用本系统前，需要先获取极光邮件服务的API账号：

1. 注册/登录极光开发者服务平台
2. 创建应用并开通邮件服务
3. 获取API_USER和API_KEY
4. 配置WebHook回调URL

**注意**：极光API集成将在后期进行，目前可以跳过此步骤。

## 二、系统安装

### 2.1 获取代码

```bash
# 克隆代码仓库
git clone <repository-url> amt-mail-system
cd amt-mail-system
```

### 2.2 环境设置（二选一）

#### 方案A：使用Docker（推荐）

```bash
# 在项目根目录下启动Docker容器
docker-compose up -d
```

这将启动以下服务：
- MongoDB 数据库 (端口: 27017)
- Mongo Express 管理界面 (端口: 8081)
- Redis 服务 (端口: 6379)
- Redis Commander 管理界面 (端口: 8082)

#### 方案B：手动安装

##### B.1 安装MongoDB

###### Windows/macOS:
1. 从[MongoDB官网](https://www.mongodb.com/try/download/community)下载并安装MongoDB Community Edition
2. 按照安装向导完成安装
3. 创建数据目录（如需要）
4. 启动MongoDB服务

###### Linux:
```bash
# 安装MongoDB
sudo apt-get update
sudo apt-get install -y mongodb
# 启动服务
sudo systemctl start mongodb
```

##### B.2 安装Redis

###### Windows:
1. 从[Redis Windows官方Github](https://github.com/microsoftarchive/redis/releases)下载Redis安装包
2. 安装Redis服务
3. 启动Redis服务

###### macOS:
```bash
# 使用Homebrew安装
brew install redis
# 启动Redis服务
brew services start redis
```

###### Linux:
```bash
# 安装Redis
sudo apt-get update
sudo apt-get install -y redis-server
# 启动Redis服务
sudo systemctl start redis-server
```

##### B.3 创建MongoDB用户和数据库

连接到MongoDB并创建用户和数据库：

```bash
# 连接MongoDB
mongosh

# 创建管理员用户
use admin
db.createUser({
  user: "amt_admin",
  pwd: "amt_secure_password",
  roles: [{ role: "userAdminAnyDatabase", db: "admin" }, "readWriteAnyDatabase"]
})

# 创建项目数据库
use amt-mail-system
db.createCollection("users")
exit
```

### 2.3 安装后端

```bash
# 进入后端目录
cd src/backend

# 安装依赖
npm install

# 如果需要，创建环境配置文件
# cp .env-example .env
# 注意：项目已默认配置为使用推荐的数据库配置，通常不需要修改
```

### 2.4 安装前端

```bash
# 进入前端目录
cd ../frontend

# 安装依赖
npm install
```

## 三、开发运行

### 3.1 启动后端开发服务器

```bash
# 在backend目录下
npm run dev
```

后端服务将在默认端口3000启动。

### 3.2 启动前端开发服务器

```bash
# 在frontend目录下
npm start
```

前端服务将在默认端口3001启动，并自动打开浏览器。

### 3.3 访问系统

- 前端访问地址：http://localhost:3001
- 后端API地址：http://localhost:3000/api
- API文档地址：http://localhost:3000/api-docs

#### 如果使用Docker环境：
- Redis管理界面：http://localhost:8082

## 四、初始化系统

### 4.1 创建管理员账号

首次运行系统时，需要创建一个管理员账号：

1. 访问注册页面：http://localhost:3001/register
2. 填写管理员信息并提交
3. 使用MongoDB客户端修改用户角色为"admin"：

```javascript
// MongoDB命令
use amt-mail-system
db.users.updateOne(
  { email: "admin@example.com" }, // 替换为您注册的邮箱
  { $set: { role: "admin" } }
);
```

如果使用Docker环境，您也可以通过Mongo Express界面完成此操作：
1. 访问 http://localhost:8081
2. 选择 amt-mail-system 数据库
3. 选择 users 集合
4. 找到对应用户记录并编辑role字段为"admin"

### 4.2 初始化标签系统

系统需要一些基础标签来支持联系人分类：

```javascript
// MongoDB命令
use amt-mail-system
db.tags.insertMany([
  { name: "未分类", description: "默认标签", createdAt: new Date(), updatedAt: new Date() },
  { name: "重要客户", description: "高价值客户", createdAt: new Date(), updatedAt: new Date() },
  { name: "潜在客户", description: "有转化可能的潜在客户", createdAt: new Date(), updatedAt: new Date() }
]);
```

## 五、开发指南

### 5.1 代码结构

后端代码结构：
- `/src/backend/src/config`: 配置文件
- `/src/backend/src/controllers`: 控制器
- `/src/backend/src/middlewares`: 中间件
- `/src/backend/src/models`: 数据模型
- `/src/backend/src/routes`: 路由
- `/src/backend/src/services`: 服务
- `/src/backend/src/utils`: 工具函数

前端代码结构：
- `/src/frontend/src/components`: 组件
- `/src/frontend/src/contexts`: 上下文
- `/src/frontend/src/pages`: 页面
- `/src/frontend/src/services`: API服务
- `/src/frontend/src/utils`: 工具函数

### 5.2 开发流程

1. 创建功能分支：`git checkout -b feature/xxx`
2. 开发功能
3. 提交代码：`git commit -m "feat: xxx"`
4. 合并回开发分支：`git checkout develop && git merge feature/xxx`

## 六、数据库管理

### 6.1 MongoDB管理

#### 6.1.1 Docker环境
您可以通过以下方式管理MongoDB数据库：

1. Mongo Express界面：http://localhost:8081
   - 用户名：amt_admin
   - 密码：amt_secure_password

2. MongoDB Shell：
```bash
# 连接MongoDB
docker exec -it amt-mongodb mongosh -u amt_admin -p amt_secure_password --authenticationDatabase admin
```

#### 6.1.2 手动安装环境
1. 使用MongoDB Compass图形界面：
   - 下载地址：[https://www.mongodb.com/try/download/compass](https://www.mongodb.com/try/download/compass)
   - 连接字符串：`mongodb://amt_admin:amt_secure_password@localhost:27017/amt-mail-system?authSource=admin`

2. 使用命令行：
```bash
# 连接MongoDB
mongosh -u amt_admin -p amt_secure_password --authenticationDatabase admin
```

### 6.2 Redis管理

#### 6.2.1 Docker环境
您可以通过以下方式管理Redis缓存：

1. Redis Commander界面：http://localhost:8082

2. Redis CLI：
```bash
# 连接Redis
docker exec -it amt-redis redis-cli
```

#### 6.2.2 手动安装环境
1. 使用Redis Desktop Manager：
   - 下载地址：[https://redisdesktop.com/download](https://redisdesktop.com/download)
   - 连接信息：localhost:6379

2. 使用命令行：
```bash
# 连接Redis
redis-cli
```

## 七、常见问题

### 7.1 MongoDB连接问题

如果遇到MongoDB连接错误，请检查：
- 数据库服务是否正常运行
- 连接字符串是否正确
- 用户名密码是否正确
- 网络防火墙是否允许MongoDB连接

### 7.2 Redis连接问题

如果遇到Redis连接错误，请检查：
- Redis服务是否正常运行
- 连接字符串是否正确
- 网络连接是否正常

### 7.3 极光API调用问题

如果极光API调用失败，请检查：
- API_USER和API_KEY是否正确
- 账号是否有足够的余额或权限
- 网络连接是否正常

## 八、联系与支持

如有任何问题，请联系技术支持团队：

- 邮箱：support@example.com
- 项目管理工具：[项目地址] 