# EDM系统测试文档

## ⚠️ 重要提醒

**所有测试必须在Docker环境下运行，确保环境一致性！**

请先启动系统：

```bash
# 在项目根目录执行
./start-edm-system.sh
```

## 🧪 测试结构

测试分为以下几个部分：

1. **端到端测试 (E2E)**：使用Playwright测试完整业务流程
2. **API集成测试**：测试后端API功能和数据流
3. **前端单元测试**：测试React组件和Redux状态管理

## 🚀 运行测试

### E2E测试 (推荐)

端到端测试验证完整的业务流程，模拟真实用户操作：

```bash
# 在项目根目录下运行
npm run test:e2e-playwright-all

# 运行简化版E2E测试
npm run test:e2e-playwright-simple
```

### API集成测试

API集成测试验证后端API接口的功能：

```bash
# 在Docker环境中运行后端集成测试
docker-compose exec backend npm run test:integration
```

### 前端单元测试

前端单元测试使用Jest和React Testing Library：

```bash
# 在Docker环境中运行前端测试
docker-compose exec frontend npm test
```

## 📊 测试覆盖范围

当前测试覆盖以下功能：

### P0级核心功能 (必须测试)
- ✅ 用户认证与登录流程
- ✅ 联系人基础管理 (增删改查)
- ✅ 标签基础功能
- ✅ 模板基础功能
- ✅ 任务基础功能

### P1级高级功能
- 🔄 联系人高级功能 (导入导出、批量操作)
- 🔄 邮件发送流程
- 🔄 统计报告

### P2级系统功能
- 🔄 错误处理和用户反馈
- 🔄 性能和稳定性测试

## 🔧 测试环境

### 数据库
- 测试使用独立的测试数据库 (`amt_mail_test`)
- 每次测试前自动清理和重置数据
- 确保测试不影响开发数据

### 端口配置
- 前端测试端口：3001
- 后端测试端口：3000
- 数据库测试端口：5432

## 📝 测试用例参考

详细的测试用例请参考：
- `docs/UAT-MAIN-FLOW-TESTCASES.md` - UAT主流程测试用例
- `tests/playwright/` - E2E测试脚本
- `src/backend/tests/` - 后端集成测试
- `src/frontend/src/tests/` - 前端单元测试

## 🐛 测试故障排除

### 常见问题

**Q: E2E测试失败**
```bash
# 检查服务是否正常启动
docker-compose ps

# 查看服务日志
docker-compose logs -f
```

**Q: API测试失败**
```bash
# 检查后端服务健康状态
curl http://localhost:3000/health

# 查看后端日志
docker-compose logs backend
```

**Q: 前端测试失败**
```bash
# 检查前端容器状态
docker-compose logs frontend
```

## ✨ 添加新测试

### 添加E2E测试
在 `tests/playwright/` 目录下创建新的测试文件：

```typescript
// tests/playwright/new-feature.spec.ts
import { test, expect } from '@playwright/test';

test('新功能测试', async ({ page }) => {
  // 测试代码
});
```

### 添加API集成测试
在 `src/backend/tests/integration/` 目录下创建测试文件：

```javascript
// src/backend/tests/integration/new-api.test.js
describe('新API测试', () => {
  test('应该正确处理请求', async () => {
    // 测试代码
  });
});
```

## 📋 测试检查清单

### 测试前检查
- [ ] Docker Desktop已启动
- [ ] 系统已通过 `./start-edm-system.sh` 启动
- [ ] 所有服务健康检查通过
- [ ] 端口3000,3001,5432可访问

### 测试后验证
- [ ] 所有P0级测试用例通过
- [ ] 核心业务流程正常
- [ ] 错误日志无关键问题
- [ ] 测试数据已清理

---

**记住：测试环境统一使用Docker，确保测试结果的可靠性和一致性！** 