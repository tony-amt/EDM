# 数据安全与恢复策略

## 1. 数据库安全防护

### 1.1 连接池管理

系统使用增强的数据库连接池配置，确保稳定和高效的数据库连接管理：

```javascript
const enhancedConfig = {
  pool: {
    max: 20,                 // 最大连接数
    min: 5,                  // 最小连接数
    acquire: 60000,          // 获取连接最长等待时间
    idle: 10000              // 连接池中连接的最大空闲时间
  }
}
```

### 1.2 自动重试机制

针对临时性数据库连接问题，系统实现了自动重试机制：

```javascript
retry: {
  max: 5,                  // 最大重试次数
  match: [                 // 哪些错误需要重试
    Sequelize.ConnectionError,
    Sequelize.ConnectionRefusedError,
    Sequelize.ConnectionTimedOutError,
    Sequelize.TimeoutError
  ]
}
```

### 1.3 事务管理

系统实现了统一的事务管理机制，确保数据一致性：

```javascript
// 使用示例
await DatabaseErrorHandler.withTransaction(db, async (transaction) => {
  // 在事务中执行的数据库操作
  await Model1.create(data1, { transaction });
  await Model2.update(data2, { where: { id }, transaction });
  return result;
}, '创建新记录');
```

## 2. 错误处理与日志

### 2.1 统一错误处理

系统提供了统一的数据库错误处理机制，将技术错误转换为友好的业务错误信息：

- 验证错误 → 400 错误，提示具体的验证失败字段
- 唯一约束错误 → 400 错误，提示冲突的字段
- 外键约束错误 → 400 错误，提示关联数据问题
- 连接错误 → 503 错误，建议用户稍后重试
- 查询超时 → 503 错误，建议优化查询或稍后重试

### 2.2 异常监控与日志

系统实现了全面的数据库操作日志记录：

- 所有SQL查询记录（debug级别）
- 数据库连接建立与关闭记录
- 记录模型加载与关联过程
- 记录所有CRUD操作的实体和ID
- 详细记录错误上下文和原始错误信息

## 3. 数据备份与恢复

### 3.1 自动备份策略

**定时备份**：
- 每日完整备份（凌晨3点）
- 每6小时增量备份
- 备份文件保留30天

**备份内容**：
- 数据库完整备份
- 上传的图片和静态文件
- 配置文件（不含敏感信息）

### 3.2 备份执行脚本

```bash
#!/bin/bash
# 数据库备份脚本

# 配置
DB_NAME="amt_mail_system"
DB_USER="postgres"
BACKUP_DIR="/backup/database"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${DATE}.sql"

# 创建备份目录
mkdir -p ${BACKUP_DIR}

# 执行备份
pg_dump -U ${DB_USER} -d ${DB_NAME} -F c -f ${BACKUP_FILE}

# 压缩备份
gzip ${BACKUP_FILE}

# 删除30天前的备份
find ${BACKUP_DIR} -name "${DB_NAME}_*.sql.gz" -mtime +30 -delete

echo "备份完成: ${BACKUP_FILE}.gz"
```

### 3.3 恢复流程

**完整恢复步骤**：

1. **停止应用服务**：
   ```bash
   docker-compose down
   ```

2. **恢复数据库**：
   ```bash
   gunzip -c /backup/database/amt_mail_system_20230515_030000.sql.gz | pg_restore -U postgres -d amt_mail_system -c
   ```

3. **恢复上传文件**：
   ```bash
   rsync -av /backup/uploads/ /app/public/uploads/
   ```

4. **重启服务**：
   ```bash
   docker-compose up -d
   ```

## 4. 高可用性策略

### 4.1 数据库高可用

**主从复制配置**：
- 主数据库负责写操作
- 从数据库负责读操作
- 自动故障转移

**读写分离策略**：
```javascript
const primaryDb = new Sequelize(/* 主库配置 */);
const replicaDb = new Sequelize(/* 从库配置 */);

// 写操作使用主库
await primaryDb.transaction(async (t) => {
  await Model.create(data, { transaction: t });
});

// 读操作使用从库
const records = await Model.findAll({
  where: { status: 'active' },
  useMaster: false // 使用从库
});
```

### 4.2 服务容错

**健康检查**：
- 定期检查数据库连接状态
- 自动重连机制
- 服务降级策略

**监控告警**：
- 数据库连接异常告警
- 查询性能监控
- 连接池使用率监控

## 5. 性能优化

### 5.1 查询优化

**索引优化**：
- 为常用查询字段创建索引
- 使用复合索引加速多字段查询
- 定期分析查询性能

**批量操作优化**：
```javascript
// 批量创建优化
await Model.bulkCreate(items, { 
  updateOnDuplicate: ['updated_field'], 
  returning: true 
});

// 批量更新优化
await Model.update(
  { status: 'processed' },
  { where: { id: { [Op.in]: ids } } }
);
```

### 5.2 缓存策略

**缓存层**：
- 使用Redis缓存频繁访问的数据
- 缓存失效策略
- 缓存预热机制

## 6. 安全检查清单

**部署前检查**：
- [x] 数据库密码强度检查
- [x] 数据库用户最小权限设置
- [x] 数据库防火墙规则检查
- [x] 敏感数据加密存储
- [x] SQL注入防护
- [x] 备份策略验证
- [x] 恢复流程测试 