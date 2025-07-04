# EDM系统开发标准

## 🚨 核心问题总结

基于多轮开发和测试，发现以下反复出现的问题：

1. **前端服务不稳定**：React开发服务器经常被其他进程占用端口
2. **端口冲突混乱**：3001端口经常被后端API占用而不是前端
3. **测试结果不可信**：自动化测试通过但实际功能失败
4. **联系人undefined问题**：反复修复但问题依然存在
5. **创建后列表不更新**：Redux状态管理问题
6. **富文本编辑器加载失败**：组件依赖问题

## 🔧 强制性开发流程

### 1. 环境启动标准

**必须按以下顺序执行，不得跳过任何步骤：**

```bash
# 1. 彻底清理环境
./scripts/clean-restart.sh

# 2. 验证服务状态
curl http://localhost:3000/health  # 必须返回健康状态
curl http://localhost:3001 | head -5  # 必须包含"EDM系统"

# 3. 运行基础功能测试
npx playwright test tests/e2e/simple-login-test.spec.js

# 4. 只有所有验证通过后才能开始开发
```

### 2. 代码修改标准

**任何代码修改后必须：**

1. 重启相关服务
2. 运行对应的E2E测试
3. 手动验证功能
4. 截图记录结果

### 3. 测试标准

**禁止以下行为：**
- 仅依赖自动化测试结果
- 不验证实际用户体验
- 修改代码后不重启服务
- 声称"测试通过"但未进行手动验证

**必须执行：**
- 每次修改后手动测试核心功能
- 截图记录测试结果
- 验证前端确实是React应用而非API页面

### 4. 问题追踪

**已知反复出现的问题：**

| 问题 | 根本原因 | 解决方案 | 验证方法 |
|------|----------|----------|----------|
| 前端显示API页面 | 端口被后端占用 | 强制杀死进程，重启前端 | curl检查返回内容 |
| 联系人详情undefined | Redux状态清除 | 改进错误处理和状态管理 | 手动点击联系人链接 |
| 创建后列表不更新 | Redux状态未刷新 | 创建成功后重新获取列表 | 创建联系人后检查列表 |
| 登录功能不稳定 | 字段名不一致 | 统一使用usernameOrEmail | 多次登录测试 |
| 富文本编辑器失败 | 组件依赖缺失 | 检查依赖安装 | 访问模板创建页面 |

### 5. 协作标准

**开发者承诺：**
- 不会声称功能正常除非经过完整验证
- 不会重复犯已知错误
- 每次交付前必须运行完整测试套件
- 提供详细的测试截图和日志

**业务方权利：**
- 拒绝未经验证的交付
- 要求重新修复反复出现的问题
- 要求提供详细的测试证据

## 🎯 立即行动计划

1. **修复当前环境**：运行clean-restart.sh
2. **验证所有核心功能**：登录、联系人、模板、任务
3. **记录测试结果**：截图和日志
4. **建立监控机制**：定期检查服务状态

## ⚠️ 警告

如果这些标准不能解决反复出现的问题，说明：
1. 技术架构存在根本缺陷
2. 开发流程需要重新设计
3. 可能需要考虑重构或更换技术栈

**一人公司的成功依赖于系统的稳定性和可预测性。** 