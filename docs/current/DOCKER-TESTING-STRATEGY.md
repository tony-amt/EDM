# 🐳 V2.0 Docker环境测试策略

## 📋 测试规范总则

**严格按照README.md规定：项目100%在Docker环境中运行和测试！**

### 🚨 绝对禁止的测试方式
- ❌ **本地npm运行测试** - 违反项目规范
- ❌ **本地数据库连接** - 环境不一致
- ❌ **混合环境测试** - 可能产生假阳性结果
- ❌ **跳过Docker步骤** - 不符合部署环境

### ✅ 强制的Docker测试方式
- ✅ **docker-compose环境** - 完全模拟生产环境
- ✅ **容器间网络通信** - 真实部署场景
- ✅ **Docker数据库连接** - 环境配置一致
- ✅ **Docker服务调用** - API调用路径正确

## 🧪 测试分级策略

### 1️⃣ **Docker环境健康检查** (P0级)
```bash
# 必须通过的基础检查
docker-compose ps                    # 所有服务运行正常
docker-compose logs backend         # 后端无错误日志
docker-compose logs postgres        # 数据库连接正常
curl http://localhost:3000/health    # API健康检查通过
```

### 2️⃣ **Docker单元测试** (P0级)
```bash
# 在Docker容器内执行单元测试
npm run test:docker
```

**测试要求**：
- 测试覆盖率 ≥ 85%
- 所有核心业务逻辑通过
- 数据库模型同步成功
- 外键约束验证通过

### 3️⃣ **Docker集成测试** (P0级)
```bash
# V2.0核心功能集成测试
npm run test:docker-v2
```

**测试范围**：
- ✅ EmailService CRUD + 连接测试
- ✅ UserServiceMapping 用户服务关联
- ✅ TaskScheduler 任务调度核心逻辑
- ✅ SubTask 子任务状态管理
- ✅ sender@domain 自动生成逻辑
- ✅ V2.0数据库结构验证

### 4️⃣ **Docker E2E业务流程测试** (P1级)
```bash
# 完整业务流程测试
npm run test:e2e-docker
```

**业务流程**：
1. 用户登录认证 → JWT Token获取
2. 创建邮件服务 → SMTP配置
3. 创建联系人 → 用户数据管理
4. 创建邮件模板 → 内容管理
5. 创建发送任务 → 任务调度
6. 验证发送状态 → 结果监控

### 5️⃣ **Docker Playwright E2E测试** (P1级)
```bash
# 前端UI自动化测试
npm run test:e2e-playwright-all
```

**测试场景**：
- 用户界面完整操作流程
- 跨浏览器兼容性验证
- 前后端数据流验证
- 错误处理与用户体验

## 🛠️ Docker测试环境配置

### Docker Compose测试服务
```yaml
# docker-compose.test.yml (测试专用)
version: '3.8'
services:
  backend-test:
    build: ./src/backend
    depends_on:
      - postgres-test
      - redis-test
    environment:
      - NODE_ENV=test
      - DATABASE_URL=postgresql://postgres:password@postgres-test:5432/amt_mail_system_test
      - REDIS_URL=redis://redis-test:6379
  
  postgres-test:
    image: postgres:14
    environment:
      POSTGRES_DB: amt_mail_system_test
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    
  redis-test:
    image: redis:7-alpine
```

### 测试数据管理
```bash
# 测试前数据清理
docker-compose exec postgres psql -U postgres -d amt_mail_system -c "TRUNCATE TABLE sub_tasks, tasks, campaigns, templates, contacts, email_services RESTART IDENTITY CASCADE;"

# 测试后数据恢复
docker-compose exec postgres psql -U postgres -d amt_mail_system -f /docker-entrypoint-initdb.d/init.sql
```

## 📊 测试质量标准

### ✅ **通过标准**
- **P0级测试**: 100%通过率，无妥协
- **P1级测试**: 100%通过率，无妥协  
- **代码覆盖率**: ≥85%，核心业务逻辑100%
- **性能基准**: API响应 <500ms，页面加载 <2s
- **错误处理**: 所有异常场景有适当处理

### ❌ **失败处理**
- **立即停止测试** - 发现P0级问题立即中止
- **问题根因分析** - 详细记录Docker环境配置问题
- **修复验证** - 在Docker环境中完整验证修复效果
- **回归测试** - 修复后重新执行完整测试套件

## 🚀 测试执行流程

### 阶段1: 环境准备
```bash
# 1. 启动Docker服务
./start-edm-system.sh

# 2. 验证服务状态
docker-compose ps
curl http://localhost:3000/health
curl http://localhost:3001

# 3. 数据库初始化检查
docker-compose exec postgres psql -U postgres -d amt_mail_system -c "\dt"
```

### 阶段2: 单元测试
```bash
# Docker容器内单元测试
npm run test:docker

# 覆盖率检查
npm run test:coverage-docker
```

### 阶段3: 集成测试
```bash
# V2.0核心功能集成测试
npm run test:docker-v2

# API集成测试
npm run test:docker-integration
```

### 阶段4: E2E测试
```bash
# 业务流程E2E测试
npm run test:e2e-docker

# 前端UI自动化测试
npm run test:e2e-playwright-all
```

### 阶段5: 测试报告
```bash
# 生成测试报告
docker-compose exec backend npm run test:report

# 导出测试结果
docker cp edm_backend_1:/app/test-results ./test-results
```

## 🔧 故障排除

### 常见Docker测试问题

**Q: 容器无法启动**
```bash
# 检查Docker服务状态
docker-compose ps
docker-compose logs backend

# 重新构建镜像
docker-compose down
docker-compose up -d --build
```

**Q: 数据库连接失败**
```bash
# 验证数据库容器
docker-compose exec postgres psql -U postgres -l

# 检查网络连接
docker-compose exec backend ping postgres
```

**Q: 测试数据残留**
```bash
# 清理测试数据
docker-compose exec postgres psql -U postgres -d amt_mail_system -c "TRUNCATE TABLE sub_tasks CASCADE;"
```

**Q: 端口冲突**
```bash
# 清理端口占用
sudo lsof -ti:3000,3001,5432 | xargs kill -9

# 重启服务
docker-compose restart
```

## 📋 测试检查清单

### 开发提测前自检
- [ ] ✅ Docker环境完整启动：`docker-compose ps`显示所有服务Running
- [ ] ✅ 健康检查通过：`curl http://localhost:3000/health`返回200
- [ ] ✅ 数据库连接正常：容器间可以正常访问PostgreSQL
- [ ] ✅ 单元测试通过：`npm run test:docker`覆盖率≥85%
- [ ] ✅ 集成测试通过：`npm run test:docker-v2`所有V2.0功能正常
- [ ] ✅ E2E测试通过：完整业务流程可执行
- [ ] ✅ 前端UI测试通过：Playwright自动化测试无错误
- [ ] ✅ 无Docker环境外的依赖：完全在容器内运行

### 测试团队验证清单
- [ ] ✅ 测试环境Docker化：使用docker-compose启动测试环境
- [ ] ✅ 测试数据Docker化：所有测试数据在Docker数据库中
- [ ] ✅ 测试执行Docker化：所有测试命令通过Docker容器执行
- [ ] ✅ 测试结果Docker化：测试报告从Docker容器中导出
- [ ] ✅ 环境一致性验证：测试环境与生产Docker环境配置一致
- [ ] ✅ 性能基准验证：Docker环境中的性能指标达标
- [ ] ✅ 部署验证：确认Docker镜像可以正常构建和部署

## 🎯 成功标准

### 🟢 **Docker测试通过标准**
- **环境一致性**: 100%Docker环境，无本地依赖
- **功能完整性**: 所有V2.0功能在Docker中正常运行
- **数据一致性**: Docker数据库结构与代码模型完全匹配
- **性能达标**: Docker环境中的性能指标满足要求
- **部署就绪**: Docker镜像构建成功，部署流程验证通过

---

**🚨 重要声明：任何不在Docker环境中进行的测试结果都视为无效！严格按照项目规范执行！** 