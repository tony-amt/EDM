# SPEC-011-性能和超时配置规范

## 文档信息
- **文档编号**: SPEC-011
- **版本**: V1.0
- **创建日期**: 2025-06-27
- **状态**: 生效

## 🚨 问题背景

### 发现的问题
在2025-06-27的生产环境中，发现curl请求挂起导致系统性能严重下降：
- API响应时间从正常的10ms增加到1-5秒
- 发现挂起的curl进程：`PID 927774`
- Node.js应用陷入JWT验证死循环

### 根本原因
1. **Node.js默认超时配置不当**
   - `server.timeout = 0` (无限等待)
   - 缺乏请求超时保护

2. **中间件死循环**
   - JWT验证中间件可能重复调用
   - 大量调试日志阻塞I/O

3. **缺乏监控和自动恢复机制**

## 🛡️ 强制性配置规范

### 1. Node.js服务器超时配置
```javascript
// src/index.js 或服务器启动文件
const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// 强制性超时配置
server.timeout = 30000;           // 30秒请求超时
server.keepAliveTimeout = 5000;   // 5秒keep-alive
server.headersTimeout = 60000;    // 60秒headers超时
```

### 2. Express应用超时中间件
```javascript
// 请求级别超时保护
app.use((req, res, next) => {
  req.setTimeout(25000, () => {
    const err = new Error('Request timeout');
    err.status = 408;
    next(err);
  });
  next();
});
```

### 3. 中间件循环保护
```javascript
// 防止中间件重复调用
const processedRequests = new WeakSet();

const authMiddleware = (req, res, next) => {
  if (processedRequests.has(req)) {
    return next(); // 已处理过，直接跳过
  }
  processedRequests.add(req);
  
  // JWT验证逻辑...
  next();
};
```

### 4. 生产环境调试日志控制
```javascript
// 环境变量控制调试日志
const DEBUG_AUTH = process.env.NODE_ENV !== 'production';

if (DEBUG_AUTH) {
  console.log('[AUTH_DEBUG]', message);
}
```

## 🔧 curl/API调用规范

### 1. 强制超时参数
```bash
# 正确的curl调用方式
curl --max-time 30 --connect-timeout 10 http://api/endpoint

# 错误的调用方式（可能挂起）
curl http://api/endpoint  # 没有超时限制
```

### 2. API测试脚本规范
```bash
#!/bin/bash
# 测试脚本必须包含超时保护
TIMEOUT=30
CONNECT_TIMEOUT=10

test_api() {
  local endpoint=$1
  timeout $TIMEOUT curl \
    --connect-timeout $CONNECT_TIMEOUT \
    --max-time $TIMEOUT \
    -s "$endpoint"
}
```

## 📊 监控和告警

### 1. 进程监控
```bash
# 定期检查挂起的curl进程
ps aux | grep curl | grep -v grep | awk '{print $2, $11, $12}'
```

### 2. 响应时间监控
```javascript
// 响应时间中间件
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`Slow request: ${req.method} ${req.path} - ${duration}ms`);
    }
  });
  next();
});
```

### 3. 自动恢复机制
```bash
# 健康检查脚本
#!/bin/bash
RESPONSE_TIME=$(curl -w "%{time_total}" -s -o /dev/null http://localhost:8080/api/health)
if (( $(echo "$RESPONSE_TIME > 5.0" | bc -l) )); then
  echo "API响应过慢，重启服务"
  docker restart edm-backend-prod
fi
```

## ⚠️ 禁止事项

1. **禁止无超时的网络请求**
   - 所有curl命令必须有`--max-time`参数
   - 所有HTTP客户端必须设置timeout

2. **禁止生产环境开启详细调试日志**
   - JWT验证调试信息
   - 请求/响应完整内容打印

3. **禁止中间件无限递归**
   - 必须有循环检测机制
   - 必须有调用深度限制

## 🚀 实施检查清单

- [ ] Node.js服务器超时配置已添加
- [ ] Express超时中间件已实现
- [ ] 中间件循环保护已添加
- [ ] 生产环境调试日志已关闭
- [ ] API测试脚本已添加超时参数
- [ ] 监控脚本已部署
- [ ] 自动恢复机制已配置

## 📝 版本记录

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| V1.0 | 2025-06-27 | 初始版本，基于生产环境curl挂起问题分析 | AI Assistant | 