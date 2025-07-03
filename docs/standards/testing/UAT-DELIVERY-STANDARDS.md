# EDM系统UAT测试与交付规范

## 🚨 核心原则

**本规范为强制性文档，任何UAT测试和交付必须严格遵守，不得简化或跳过任何步骤。**

## 📋 第一部分：UAT前置条件检查清单

### 1.1 环境清理检查 ✅

**必须按顺序执行，全部通过才能继续：**

```bash
# 步骤1：强制清理所有进程
sudo lsof -ti:3000,3001,4000 | xargs kill -9 2>/dev/null || true
pkill -f "react-scripts|webpack|node.*3000|node.*3001" || true
sleep 5

# 步骤2：验证端口清空
lsof -i:3000 && echo "❌ 端口3000未清理" && exit 1
lsof -i:3001 && echo "❌ 端口3001未清理" && exit 1
echo "✅ 端口清理完成"

# 步骤3：清理缓存
cd src/frontend && rm -rf build node_modules/.cache .eslintcache
cd ../../
echo "✅ 缓存清理完成"
```

### 1.2 技术架构一致性检查 ✅

**验证技术栈配置统一性：**

```bash
# 检查1：前端必须是React应用
curl -s http://localhost:3001 | grep -q "react" || echo "❌ 前端非React应用"

# 检查2：后端必须是API服务
curl -s http://localhost:3000/health | jq .status | grep -q "ok" || echo "❌ 后端API异常"

# 检查3：端口配置一致性检查
grep -r "3001" src/frontend/package.json || echo "❌ 前端端口配置不一致"
grep -r "3000" src/backend/package.json || echo "❌ 后端端口配置不一致"
```

### 1.3 配置文件统一性验证 ✅

**所有端口和URL配置必须从统一配置文件读取：**

```javascript
// 配置文件：config/ports.json
{
  "development": {
    "backend": 3000,
    "frontend": 3001,
    "api_base": "http://localhost:3000/api"
  },
  "production": {
    "backend": 8080,
    "frontend": 8081,
    "api_base": "/api"
  }
}
```

## 📋 第二部分：UAT执行标准

### 2.1 启动服务标准 ✅

**强制执行顺序，不得调整：**

```bash
# 1. 启动后端
cd src/backend && npm run dev &
BACKEND_PID=$!
echo "后端PID: $BACKEND_PID"

# 2. 等待后端完全启动
for i in {1..30}; do
  curl -s http://localhost:3000/health >/dev/null && break
  echo "等待后端... ($i/30)"
  sleep 2
done

# 3. 验证后端健康
curl http://localhost:3000/health | jq .status | grep -q "ok" || {
  echo "❌ 后端启动失败"
  kill $BACKEND_PID
  exit 1
}

# 4. 启动前端
cd ../frontend && PORT=3001 npm start &
FRONTEND_PID=$!
echo "前端PID: $FRONTEND_PID"

# 5. 等待前端完全启动
for i in {1..60}; do
  RESPONSE=$(curl -s http://localhost:3001)
  echo "$RESPONSE" | grep -q "EDM系统" && break
  echo "等待前端... ($i/60)"
  sleep 3
done

# 6. 验证前端为React应用
curl -s http://localhost:3001 | grep -q "react\|React\|EDM系统" || {
  echo "❌ 前端不是React应用"
  kill $BACKEND_PID $FRONTEND_PID
  exit 1
}

echo "✅ 服务启动验证通过"
```

### 2.2 API接口一致性验证 ✅

**前后端字段命名必须完全一致：**

```bash
# 验证登录接口
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usernameOrEmail":"admin@example.com","password":"admin123456"}')

echo "$LOGIN_RESPONSE" | jq .success | grep -q true || {
  echo "❌ 登录接口失败"
  echo "响应: $LOGIN_RESPONSE"
  exit 1
}

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r .token)

# 验证联系人接口
CONTACTS_RESPONSE=$(curl -s http://localhost:3000/api/contacts \
  -H "Authorization: Bearer $TOKEN")

echo "$CONTACTS_RESPONSE" | jq .data || {
  echo "❌ 联系人接口失败"
  exit 1
}

echo "✅ API接口验证通过"
```

### 2.3 核心功能测试标准 ✅

**必须通过的核心功能测试用例：**

1. **登录功能**
   - 正确用户名密码登录成功
   - 错误密码登录失败
   - 登录后正确跳转

2. **联系人管理**
   - 联系人列表正确显示
   - 联系人详情页无undefined错误
   - 新建联系人后列表立即更新
   - 编辑联系人功能正常

3. **模板管理**
   - 模板列表正确显示
   - 富文本编辑器正常加载
   - 模板创建和编辑功能

4. **任务管理**
   - 任务列表正确显示
   - 任务与模板集正确关联
   - 任务创建和编辑功能

## 📋 第三部分：自动化测试要求

### 3.1 Playwright测试执行标准 ✅

**所有测试必须通过，0失败率：**

```bash
# 1. 基础功能测试
npx playwright test tests/e2e/simple-login-test.spec.js --reporter=line

# 2. 联系人功能测试  
npx playwright test tests/e2e/contact-detail-test.spec.js --reporter=line

# 3. 完整回归测试
npx playwright test tests/e2e/comprehensive-uat.spec.js --reporter=line

# 4. 验证测试结果
echo "所有测试必须显示 'passed'，任何 'failed' 都不能接受"
```

### 3.2 手动验证检查清单 ✅

**自动化测试通过后，必须进行手动验证：**

- [ ] 浏览器打开 http://localhost:3001 显示React应用界面
- [ ] 登录页面输入正确账号密码能成功登录
- [ ] 联系人列表能正确显示，点击详情无undefined错误
- [ ] 新建联系人保存后列表立即刷新显示
- [ ] 模板页面富文本编辑器能正常加载
- [ ] 任务创建页面能正确关联模板集

## 📋 第四部分：问题修复标准

### 4.1 问题优先级定义

**P0 - 阻塞级（必须立即修复）：**
- 前端显示API静态页面而非React应用
- 登录功能完全无法使用
- 端口冲突导致服务无法启动

**P1 - 严重级（当轮必须修复）：**
- 联系人详情显示undefined
- 创建后列表不更新
- 富文本编辑器无法加载

**P2 - 一般级（可延后修复）：**
- 界面样式问题
- 非核心功能异常

### 4.2 修复验证流程

**每个问题修复后必须执行：**

1. **代码修改** → 2. **重启服务** → 3. **自动化测试** → 4. **手动验证** → 5. **回归测试**

**任何一步失败都必须重新修复，不得跳过。**

## 📋 第五部分：交付标准

### 5.1 交付前检查清单 ✅

**必须全部通过的交付条件：**

- [ ] 环境清理和启动验证100%通过
- [ ] 所有P0和P1问题已修复
- [ ] Playwright自动化测试0失败率
- [ ] 手动验证检查清单100%通过
- [ ] 主流程端到端测试成功
- [ ] 提供详细测试截图和日志

### 5.2 文档要求

**交付时必须提供：**

1. **测试执行报告**：包含所有测试步骤和结果
2. **问题修复清单**：列出发现和修复的所有问题
3. **系统架构文档**：确认技术栈统一性
4. **配置清单**：所有端口和URL配置说明

### 5.3 回滚策略

**如果UAT测试失败：**

1. 立即停止交付流程
2. 记录失败原因和现象
3. 按问题优先级制定修复计划
4. 重新执行完整UAT流程
5. 只有100%通过才能交付

## ⚠️ 违规处理

**以下行为被视为违规，必须重新执行完整流程：**

- 跳过任何检查步骤
- 简化测试用例
- 修改端口规避问题
- 声称"测试通过"但未提供证据
- 不修复P0/P1问题就尝试交付

## 🎯 成功标准

**只有满足以下条件才算UAT成功：**

1. ✅ 所有自动化测试通过率100%
2. ✅ 手动验证检查清单100%完成
3. ✅ 前端确认为React应用而非API页面
4. ✅ 核心功能完全正常
5. ✅ 提供完整测试文档和截图

**EDM系统的稳定性和可预测性是一人公司成功的基础。** 