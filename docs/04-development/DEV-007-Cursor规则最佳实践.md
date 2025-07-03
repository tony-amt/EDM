# DEV-007 Cursor规则最佳实践

## 📋 文档信息
- **文档编号**: DEV-007
- **文档标题**: Cursor规则最佳实践 (基于官方说明优化)
- **创建时间**: 2025-01-13
- **版本**: v2.0
- **负责人**: 项目主控Agent
- **状态**: ✅ 生效中

## 🎯 Cursor官方规则类型说明

### 📊 官方规则类型详解

| 规则类型 | 官方说明 | 触发机制 | 推荐用途 |
|---------|----------|----------|----------|
| **Always** | 每次对话都加载 | 自动触发 | 最核心的项目信息 |
| **Auto Attached** | 基于文件类型/后缀自动触发 | 文件后缀匹配 | 特定技术栈的开发规范 |
| **Agent Requested** | AI根据规则描述判断是否需要 | AI智能判断 | 场景化的详细指导 |
| **Manual** | 手动指定时才加载 | 用户手动引用 | 完整规范手册 |

## 🎯 EDM项目优化配置方案

### 🟢 基于官方说明的最佳配置

```
.cursor/rules/
├── edm-core.mdc           # Always - 核心项目信息
├── edm-frontend.mdc       # Auto Attached - 前端文件触发
├── edm-backend.mdc        # Auto Attached - 后端文件触发  
├── edm-project.mdc        # Agent Requested - 场景化指导
└── edm-main-rules.mdc     # Manual - 完整规范手册
```

## 📄 规则文件详细配置

### 1. `edm-core.mdc` → **Always**
```markdown
内容：最核心的项目信息
✅ 项目基本信息 (技术栈、生产环境)
✅ 必读文档指引 (README、PROJECT-GUIDE)
✅ 核心开发规范 (提交格式、分支策略)
✅ 测试账号信息
✅ 常用命令

特点：精简核心，每次对话都加载，< 1KB
```

### 2. `edm-frontend.mdc` → **Auto Attached**
```markdown
文件匹配模式：*.tsx, *.ts, *.jsx, *.js, src/frontend/**/*
内容：前端开发专用规范
✅ React + TypeScript 开发规范
✅ Ant Design UI规范
✅ 前端目录结构
✅ 组件开发模式
✅ 前端检查清单

特点：处理前端文件时自动加载
```

### 3. `edm-backend.mdc` → **Auto Attached**
```markdown
文件匹配模式：src/backend/**/*.js, *.controller.js, *.model.js, *.service.js
内容：后端开发专用规范
✅ Node.js + Express 开发规范
✅ 数据库设计规范
✅ API设计规范
✅ 安全规范
✅ 后端检查清单

特点：处理后端文件时自动加载
```

### 4. `edm-project.mdc` → **Agent Requested**
```markdown
AI判断描述：当需要详细的EDM项目开发规范、目录结构说明、问题排查指南、测试账号信息或开发检查清单时，请参考此规则。适用于功能开发、代码重构、问题调试、项目配置等场景。

内容：场景化的详细指导
✅ 完整的开发规范和最佳实践
✅ 详细的目录结构说明
✅ 问题排查指南
✅ 质量原则和验收标准

特点：AI根据场景智能判断是否需要
```

### 5. `edm-main-rules.mdc` → **Manual**
```markdown
内容：完整规范手册
✅ 完整技术栈详细说明
✅ 系统架构和设计原则
✅ 性能要求和监控指标
✅ 部署和发布流程
✅ 最佳实践和技巧

特点：手动引用时加载，百科全书式
```

## 🔧 具体配置信息

### 📋 Auto Attached 文件匹配配置

#### 前端规则 (`edm-frontend.mdc`)
```
文件匹配模式：
*.tsx, *.ts, *.jsx, *.js
src/frontend/**/*
components/**/*
pages/**/*
hooks/**/*
services/**/*
types/**/*
```

#### 后端规则 (`edm-backend.mdc`)
```
文件匹配模式：
src/backend/**/*.js
*.controller.js
*.model.js
*.service.js
*.route.js
*.middleware.js
config/**/*.js
migrations/**/*.js
```

### 📝 Agent Requested 描述配置

#### 项目规则 (`edm-project.mdc`)
```
描述内容：
"当需要详细的EDM项目开发规范、目录结构说明、问题排查指南、测试账号信息或开发检查清单时，请参考此规则。适用于功能开发、代码重构、问题调试、项目配置等场景。"
```

## 📊 使用场景分析

### 🚀 日常前端开发
```
触发：编辑 src/frontend/components/ContactList.tsx
自动加载：
- edm-core.mdc (Always) - 基本项目信息
- edm-frontend.mdc (Auto Attached) - React/TS开发规范

结果：获得前端开发专用的规范和最佳实践
```

### 🔧 后端API开发
```
触发：编辑 src/backend/src/controllers/user.controller.js
自动加载：
- edm-core.mdc (Always) - 基本项目信息  
- edm-backend.mdc (Auto Attached) - Node.js/Express规范

结果：获得后端开发专用的API设计规范
```

### 🎯 复杂功能开发
```
场景：开发复杂的邮件营销功能
AI判断：需要详细的项目规范和最佳实践
自动请求：edm-project.mdc (Agent Requested)

结果：获得场景化的详细指导和检查清单
```

### 📚 学习和参考
```
手动引用：
"请参考 edm-main-rules.mdc 中的完整架构设计来重构邮件服务"

结果：获得最详细的技术规范和架构指导
```

## 💡 配置最佳实践

### ✅ 推荐配置策略

1. **Always规则精简化**
   - 只包含最核心的项目信息
   - 大小控制在 < 1KB
   - 避免技术细节，专注基本信息

2. **Auto Attached按技术栈分离**
   - 前端规则：React/TypeScript专用
   - 后端规则：Node.js/Express专用
   - 文件匹配精确，避免误触发

3. **Agent Requested场景化**
   - 描述要清晰具体，便于AI判断
   - 包含具体的使用场景关键词
   - 内容要有针对性，不要过于宽泛

4. **Manual作为完整参考**
   - 包含所有详细规范
   - 作为学习和深度参考使用
   - 定期更新维护

### ❌ 避免的配置错误

1. **Auto Attached文件匹配过宽**
   - 避免使用 `*.*` 这样的通配符
   - 不要让多个规则同时匹配同一文件

2. **Agent Requested描述模糊**
   - 避免"当需要帮助时"这样的模糊描述
   - 不要包含过多不相关的场景

3. **规则内容重复**
   - 不同规则文件避免包含相同信息
   - 保持规则职责单一

## 🎯 实施步骤

### 1️⃣ 立即配置
```bash
在Cursor中设置规则类型：

1. edm-core.mdc → Always
2. edm-frontend.mdc → Auto Attached
   文件匹配：*.tsx, *.ts, *.jsx, *.js, src/frontend/**/*
3. edm-backend.mdc → Auto Attached  
   文件匹配：src/backend/**/*.js, *.controller.js, *.model.js
4. edm-project.mdc → Agent Requested
   描述：当需要详细的EDM项目开发规范、目录结构说明、问题排查指南时使用
5. edm-main-rules.mdc → Manual
```

### 2️⃣ 验证效果
```bash
测试场景：
1. 编辑前端文件 → 检查是否加载前端规则
2. 编辑后端文件 → 检查是否加载后端规则
3. 询问项目问题 → 检查AI是否请求项目规则
4. 手动引用完整规则 → 检查是否正确加载
```

## 📈 预期效果对比

### 🔴 优化前 (多Always)
```
问题：
❌ 信息过载，AI理解困难
❌ 前后端规则混杂
❌ 不够精准，影响效率

效果：理解准确率 70-80%
```

### 🟢 优化后 (分层+精准)
```
优势：
✅ 规则精准触发，不会过载
✅ 前后端规则分离，更专业
✅ AI智能判断，按需加载
✅ 文件类型匹配，自动化程度高

效果：理解准确率 90%+，响应更快
```

## 🎉 总结

基于Cursor官方说明，优化后的规则配置策略：

1. **Always** - 精简核心信息，每次必需
2. **Auto Attached** - 按文件类型自动触发，技术栈专用
3. **Agent Requested** - AI智能判断，场景化指导
4. **Manual** - 完整规范手册，深度参考

**🎯 核心理念**: 精准触发 + 智能分层 + 场景化指导 = 最佳AI协作体验

---

**文档版本**: v2.0 (基于官方说明优化)  
**最后更新**: 2025-01-13  
**审核状态**: ✅ 已审核通过  
**生效状态**: ✅ 已生效 

## 🎯 核心原则

本文档记录了在EDM项目中使用Cursor AI的最佳实践和规则配置。

## 📋 规则配置

### 1. 自动验证规则

每次生成代码后，必须自动执行验证流程：

```bash
# 自动运行验证脚本
./scripts/ai-code-validator.sh
```

### 2. 代码规范检查

- 后端文件命名: `*.controller.js`, `*.model.js`, `*.service.js`, `*.routes.js`
- API路径必须包含 `/api/` 前缀
- 必须使用async/await和try-catch错误处理
- 禁止硬编码密码和密钥

### 3. 前端快速迭代热更新方案

#### 开发环境热更新
```bash
# 构建开发镜像
cd src/frontend
docker build -f Dockerfile.dev -t edm-frontend:dev .

# 启动开发容器（支持热更新）
docker run -d \
  --name edm-frontend-debug \
  --network edm_edm-debug-network \
  -p 3003:3001 \
  -v "$(pwd)/src/frontend/src:/app/src" \
  -v "$(pwd)/src/frontend/public:/app/public" \
  edm-frontend:dev
```

#### 生产环境快速部署
```bash
# 使用自动化部署脚本
./scripts/deploy-frontend.sh [版本号]

# 手动部署流程
cd src/frontend
docker build -f Dockerfile.prod -t edm-frontend:v1.x --platform linux/amd64 .
docker save edm-frontend:v1.x | gzip > edm-frontend-v1.x.tar.gz
scp edm-frontend-v1.x.tar.gz ubuntu@43.135.38.15:~/
```

#### 404问题根治方案
生产环境Dockerfile.prod中必须包含正确的nginx配置：
```dockerfile
# 配置nginx支持React SPA路由
RUN echo 'server {' > /etc/nginx/conf.d/default.conf && \
  echo '    listen 80;' >> /etc/nginx/conf.d/default.conf && \
  echo '    server_name localhost;' >> /etc/nginx/conf.d/default.conf && \
  echo '    root /usr/share/nginx/html;' >> /etc/nginx/conf.d/default.conf && \
  echo '    index index.html index.htm;' >> /etc/nginx/conf.d/default.conf && \
  echo '    location / {' >> /etc/nginx/conf.d/default.conf && \
  echo '        try_files $uri $uri/ /index.html;' >> /etc/nginx/conf.d/default.conf && \
  echo '    }' >> /etc/nginx/conf.d/default.conf && \
  echo '}' >> /etc/nginx/conf.d/default.conf
```

## 🛠️ 自动修正规则

### 文件命名修正
```javascript
// 错误示例
QuotaService.js → quota.service.js
EmailConversation.js → emailConversation.model.js

// 正确格式
*.controller.js, *.model.js, *.service.js, *.routes.js
```

### API路径修正
```javascript
// 错误示例
app.use('/users', userRoutes);

// 正确格式  
app.use('/api/users', userRoutes);
```

## 🎯 执行指令

每次生成代码后，必须：
1. 立即运行验证脚本
2. 分析验证结果
3. 自动修正发现的问题
4. 重新验证直到通过
5. 向用户报告验证结果

## 📝 最佳实践

### 1. 开发流程
- 使用热更新容器进行快速迭代
- 小步提交，频繁验证
- 及时更新文档

### 2. 部署流程
- 使用自动化脚本部署
- 部署前验证功能完整性
- 部署后验证线上效果

### 3. 问题排查
- 优先查看容器日志
- 检查nginx配置
- 验证网络连接

---

## 📝 变更记录

- 2025-06-26: 添加前端快速迭代热更新方案
- 2025-06-26: 添加404问题根治方案
- 2025-06-26: 完善自动化部署流程 