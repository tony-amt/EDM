# API与配置说明文档

## 1. 环境配置

### 1.1 基本配置

系统配置主要通过环境变量进行管理，所有配置项都存放在`.env`文件中，部署前需根据实际环境调整配置。

主要配置项包括：

```
# 服务器配置
NODE_ENV=production
PORT=3000

# PostgreSQL 数据库配置
DB_HOST=postgres
DB_PORT=5432
DB_NAME=amt_mail_system
DB_USER=postgres
DB_PASSWORD=postgres
DB_FORCE_SYNC=false # 是否在启动时重建表（仅开发环境使用）

# Redis配置 - Docker环境
REDIS_HOST=redis
REDIS_PORT=6379
#REDIS_PASSWORD=

# JWT配置
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=24h

# 极光API配置
ENGAGELAB_BASE_URL=https://email.api.engagelab.cc/v1
WEBHOOK_PATH=/api/webhook/mail
ENGAGELAB_API_USER=your_api_user
ENGAGELAB_API_KEY=your_api_key

# 邮件任务配置
MAIL_BATCH_SIZE=50  # 每批处理的邮件数量
MAIL_SEND_INTERVAL=1000  # 批次间隔，毫秒
MAIL_MAX_RETRIES=3  # 最大重试次数

# 日志配置
LOG_LEVEL=info
LOG_FILE=app.log

# CORS配置
CORS_ORIGIN=*
```

### 1.2 图片上传配置

系统支持图片上传功能，用于邮件模板中插入图片。相关配置说明：

1. 上传目录：默认为 `public/uploads/images`
2. 支持的文件类型：jpg、jpeg、png、gif、webp
3. 文件大小限制：默认5MB

使用时无需额外配置，系统会自动创建必要的目录。图片上传后会进行优化处理：

- 非GIF图片会转换为WebP格式以减小文件大小
- 保持较高的图片质量(80%)
- 自动生成访问URL

## 2. API接口说明

### 2.1 图片上传接口

#### POST /api/upload/image

上传图片并返回URL。

**请求参数**：
- `image`: 图片文件（multipart/form-data）

**请求头**：
- `Authorization`: Bearer {token} - 用户认证token

**响应示例**：
```json
{
  "success": true,
  "url": "http://example.com/uploads/images/f5a8c460-c8f1-4e3b-b78d-6e3e826f317b.webp",
  "filename": "f5a8c460-c8f1-4e3b-b78d-6e3e826f317b.webp",
  "original_size": 125000,
  "optimized_size": 42000,
  "compression_rate": "66%"
}
```

### 2.2 Webhook回调

系统支持接收邮件发送服务商（如极光）的事件回调，用于跟踪邮件的发送状态、打开、点击等事件。

#### POST /api/webhook/mail

接收邮件事件回调。

**请求参数**（JSON格式）:
```json
{
  "event": "delivered",
  "message_id": "message_id_from_provider",
  "tracking_id": "optional_tracking_id",
  "timestamp": 1679808000,
  "email": "recipient@example.com",
  "reason": "optional_reason_for_bounce_or_complaint",
  "url": "optional_clicked_url"
}
```

**支持的事件类型**:
- `delivered`: 邮件已送达
- `open`: 邮件已打开
- `click`: 邮件链接已点击
- `bounce`: 邮件退回
- `dropped`: 邮件投递失败
- `unsubscribe`: 用户退订
- `complaint`: 用户投诉

**响应示例**:
```json
{
  "success": true,
  "message": "事件已处理",
  "task_contact_id": "123e4567-e89b-12d3-a456-426614174000",
  "task_id": "123e4567-e89b-12d3-a456-426614174001"
}
```

## 3. 生产环境部署说明

### 3.1 基础设施要求

- **服务器**：建议至少2核4G内存
- **数据库**：PostgreSQL 12+
- **缓存**：Redis 6+
- **网络**：开放必要端口（默认3000）
- **存储**：至少50GB可用空间

### 3.2 使用Docker部署

推荐使用Docker进行部署，确保稳定一致的运行环境。

1. **构建镜像**:
```bash
docker build -t amt-mail-system:latest .
```

2. **准备docker-compose.yml**:
```yaml
version: '3'
services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: amt_mail_system
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always

  redis:
    image: redis:alpine
    volumes:
      - redis_data:/data
    restart: always

  app:
    image: amt-mail-system:latest
    depends_on:
      - postgres
      - redis
    environment:
      NODE_ENV: production
      PORT: 3000
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: amt_mail_system
      DB_USER: postgres
      DB_PASSWORD: postgres
      REDIS_HOST: redis
      REDIS_PORT: 6379
      JWT_SECRET: your_jwt_secret_key
      JWT_EXPIRES_IN: 24h
      ENGAGELAB_BASE_URL: https://email.api.engagelab.cc/v1
      ENGAGELAB_API_USER: your_api_user
      ENGAGELAB_API_KEY: your_api_key
      MAIL_BATCH_SIZE: 50
      MAIL_SEND_INTERVAL: 1000
      MAIL_MAX_RETRIES: 3
    ports:
      - "3000:3000"
    volumes:
      - ./uploads:/app/public/uploads
      - ./logs:/app/logs
    restart: always

volumes:
  postgres_data:
  redis_data:
```

3. **启动服务**:
```bash
docker-compose up -d
```

### 3.3 生产环境注意事项

1. **安全配置**：
   - 使用强密码和安全的JWT密钥
   - 适当配置防火墙，只开放必要端口
   - 启用HTTPS，保护API通信安全

2. **性能优化**：
   - 根据实际负载调整`MAIL_BATCH_SIZE`和`MAIL_SEND_INTERVAL`参数
   - 监控系统资源使用情况，适时增加资源
   - 为数据库设置适当的连接池大小

3. **监控与维护**：
   - 定期备份数据库
   - 设置系统监控，关注CPU、内存、磁盘使用情况
   - 检查日志文件大小，避免磁盘空间耗尽
   - 定期检查/清理上传的图片文件

4. **极光API配置**：
   - 确保正确配置`ENGAGELAB_API_USER`和`ENGAGELAB_API_KEY`
   - 在极光平台设置Webhook回调URL为：`https://your-domain.com/api/webhook/mail`

5. **数据安全**：
   - 遵循数据保护法规
   - 实施适当的数据保留和删除策略
   - 考虑敏感数据加密存储 