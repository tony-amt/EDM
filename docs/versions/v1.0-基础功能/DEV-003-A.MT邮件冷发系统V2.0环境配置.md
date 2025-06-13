# DEV-003-A.MT邮件冷发系统V2.0环境配置

## 文档信息

| 项目     | 内容                                     |
| -------- | ---------------------------------------- |
| 文档编号 | DEV-003                                  |
| 版本     | V1.1 (更新为PostgreSQL和后端环境变量)    |
| 创建日期 | 2023-07-25                               |
| 最后更新 | (自动填写当前日期)                       |
| 状态     | 已更新                                   |

## 一、概述

本文档描述了 A.MT 邮件冷发系统 V2.0 开发和运行所需的环境配置，包括数据库服务和后端应用程序的环境变量。

## 二、数据库环境配置 (PostgreSQL)

项目使用 PostgreSQL 作为数据库服务，推荐通过 Docker 容器运行。

### 1. Docker 环境 (推荐)

`docker-compose.yml` 文件已配置 PostgreSQL 服务。关键配置信息如下（通常由环境变量在 `.env` 文件中定义，并通过 `docker-compose.yml` 传递给 PostgreSQL 服务和后端服务）：

| 配置项 (环境变量) | 示例值             | 描述                                       |
| ----------------- | ------------------ | ------------------------------------------ |
| `DB_USER`         | `postgres`         | PostgreSQL 用户名                          |
| `DB_PASSWORD`     | `postgres`         | PostgreSQL 密码                            |
| `DB_NAME`         | `amt_mail_system`  | PostgreSQL 数据库名称                      |
| `DB_HOST`         | `postgres`         | PostgreSQL 服务主机名 (在Docker网络中)     |
| `DB_PORT`         | `5432`             | PostgreSQL 服务端口                        |

**pgAdmin (数据库管理界面):**

`docker-compose.yml` 也包含了一个 `pgAdmin` 服务，用于通过 Web 界面管理 PostgreSQL 数据库。

| 配置项     | 值                        |
| ---------- | ------------------------- |
| 访问地址   | `http://localhost:5050`   |
| 默认邮箱   | `admin@example.com`       |
| 默认密码   | `admin`                   |

首次访问 pgAdmin 时，需要设置主密码，然后添加新的服务器连接，连接信息如下：
- **Host name/address**: `postgres` (这是 Docker Compose 中 PostgreSQL 服务的名称)
- **Port**: `5432`
- **Maintenance database**: `postgres` (或者您在 `DB_NAME` 中指定的数据库)
- **Username**: 您在 `DB_USER` 中指定的值 (例如 `postgres`)
- **Password**: 您在 `DB_PASSWORD` 中指定的值 (例如 `postgres`)

### 2. 手动安装 PostgreSQL (不推荐用于标准开发环境)

如果无法使用 Docker，可以手动安装 PostgreSQL。请参考 [PostgreSQL官方文档](https://www.postgresql.org/download/) 进行特定操作系统的安装。安装后，需要创建相应的用户和数据库，并确保网络可访问。

## 三、后端服务环境变量配置

后端应用程序 (`src/backend/`) 通过 `.env` 文件加载环境变量。请在 `src/backend/` 目录下创建名为 `.env` 的文件，并包含以下内容：

```dotenv
# PostgreSQL Database Configuration (for development)
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=amt_mail_system
DB_HOST=postgres
DB_PORT=5432

# JWT Configuration
# 重要: 请替换为实际的、强随机的密钥!
JWT_SECRET=superSecretKeyForAMTv2Projectjsonwebtoken!@#$
JWT_EXPIRES_IN=1d

# Server Configuration
NODE_ENV=development
PORT=5001

# Optional: Database Force Sync (BE CAREFUL WITH THIS IN PRODUCTION)
# true = drop and recreate tables on every app start (development only)
# false = do not force sync (safer for existing data)
DB_FORCE_SYNC=false

# Logging Level (optional, depends on your logger setup, e.g., trace, debug, info, warn, error)
# LOG_LEVEL=info
```

### 环境变量说明:

| 变量名             | 描述                                                                 |
| ------------------ | -------------------------------------------------------------------- |
| `DB_USER`          | 连接 PostgreSQL 的用户名。                                               |
| `DB_PASSWORD`      | 连接 PostgreSQL 的密码。                                               |
| `DB_NAME`          | 要连接的 PostgreSQL 数据库名称。                                         |
| `DB_HOST`          | PostgreSQL 服务的主机名或IP地址。                                        |
| `DB_PORT`          | PostgreSQL 服务的端口号。                                                |
| `JWT_SECRET`       | 用于签发和验证 JSON Web Tokens (JWT) 的密钥。**必须保密且足够复杂。**     |
| `JWT_EXPIRES_IN`   | JWT 的有效期 (例如 `1h`, `1d`, `7d`)。                                   |
| `NODE_ENV`         | Node.js 运行环境 (`development`, `test`, `production`)。                 |
| `PORT`             | 后端 Express 服务监听的端口号。                                          |
| `DB_FORCE_SYNC`    | (可选, 仅限开发) 设置为 `true` 时，Sequelize 会在应用启动时删除并重建所有表。**生产环境严禁使用!** |
| `LOG_LEVEL`        | (可选) 应用的日志级别，具体取决于项目中的日志库实现。                        |

## 四、Docker 环境启动指南

### 1. 安装 Docker 和 Docker Compose

如果尚未安装，请从 Docker 官方网站下载并安装 Docker Desktop (包含了 Docker Compose)。
- Windows/macOS: [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Linux: 请参考 Docker 官方文档进行安装。

### 2. 启动所有服务

在项目根目录下 (包含 `docker-compose.yml` 文件的目录) 打开终端，运行以下命令：

```bash
docker-compose up -d
```

这将会在后台启动 `docker-compose.yml` 中定义的所有服务 (例如 PostgreSQL, pgAdmin, 后端应用服务)。

### 3. 查看服务状态

```bash
docker-compose ps
```

此命令会列出当前运行的服务及其状态。

### 4. 查看服务日志

```bash
# 查看所有服务的日志
docker-compose logs -f

# 查看特定服务的日志 (例如后端服务，假设服务名为 backend)
docker-compose logs -f backend

# 查看 PostgreSQL 服务的日志
docker-compose logs -f postgres
```

### 5. 停止服务

```bash
# 停止并移除容器
docker-compose down

# 停止、移除容器和关联的卷 (例如数据库数据)
# 警告: 这将删除 PostgreSQL 数据库中的所有数据!
docker-compose down -v
```

## 五、注意事项

- 确保 `.env` 文件已正确放置在 `src/backend/` 目录下，并且包含了正确的配置信息。
- `.env` 文件不应提交到版本控制系统 (如 Git)。确保已将其添加到 `.gitignore` 文件中。
- 定期更新和审查 `JWT_SECRET`，尤其是在生产环境中。

## 六、极光API集成说明

根据项目需求，极光API集成将在后期进行。集成时需要提供的信息：

1. API User ID
2. API Key

这些信息将在集成测试阶段由团队提供。

## 七、故障排除

### 1. PostgreSQL连接问题

如果遇到PostgreSQL连接错误，请检查：

- PostgreSQL服务是否正常运行
- 连接字符串是否正确
- 用户名密码是否正确
- 网络防火墙是否允许连接
- 数据库端口是否正确开放

### 2. Docker相关问题

如果Docker服务出现问题，可以尝试：

```bash
# 重启Docker服务
sudo systemctl restart docker

# 或者在macOS上
killall Docker && open /Applications/Docker.app
``` 