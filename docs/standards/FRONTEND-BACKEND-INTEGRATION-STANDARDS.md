# 前后端集成开发规范

## 🎯 目标
确保前后端开发过程中接口契约一致，避免类型不匹配和方法缺失问题。

## 📋 问题回顾
### 本次出现的主要问题：
1. **字段命名不一致**: `body` vs `content_text`, `html_body` vs `content_html`
2. **方法缺失**: 前端调用不存在的service方法
3. **类型定义分散**: 多处重复定义相似类型
4. **API响应格式不统一**: 缺乏统一的响应包装

## 🛠️ 解决方案

### 1. 统一类型定义层
```typescript
// ✅ 正确做法: 集中在 src/types/api.ts
export interface ConversationMessage {
  content_text?: string;    // 标准字段名
  content_html?: string;    // 标准字段名
  status: 'read' | 'sent';  // 状态枚举
}

// ❌ 错误做法: 各文件分散定义
interface Message { body: string }  // 字段名不一致
```

### 2. Service方法标准化
```typescript
// ✅ 正确做法: 每个方法都明确对应API端点
class ConversationService {
  /**
   * 获取会话详情
   * 对应API: GET /api/conversations/:id
   */
  async getConversationDetail(id: string) {
    // 实现
  }
  
  /**
   * 向后兼容方法
   * 别名: getConversationDetail
   */
  async getConversationById(id: string) {
    return this.getConversationDetail(id);
  }
}
```

### 3. API响应统一格式
```typescript
// ✅ 统一响应格式
interface BaseApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}
```

## 📝 开发流程规范

### Phase 1: 接口设计阶段
1. **后端先行**: 先确定数据模型和API端点
2. **生成类型定义**: 根据后端模型生成TypeScript类型
3. **前端确认**: 前端确认类型定义无误

### Phase 2: 开发阶段
1. **类型导入**: 前端只从 `types/api.ts` 导入类型
2. **Service实现**: 每个方法必须对应明确的API端点
3. **向后兼容**: 新方法提供旧方法的别名

### Phase 3: 测试阶段
1. **编译检查**: 确保TypeScript编译无错误
2. **集成测试**: 验证前后端接口联调
3. **类型检查**: 使用工具验证类型一致性

## 🔧 工具和检查机制

### 1. 预编译检查
```bash
# 编译检查脚本
npm run type-check
npm run build --dry-run
```

### 2. API契约测试
```typescript
// 接口一致性测试
describe('API Contract Tests', () => {
  it('should match backend response structure', async () => {
    const response = await conversationService.getConversations();
    expect(response).toMatchSchema(ConversationListResponse);
  });
});
```

### 3. 自动化验证
```yaml
# CI/CD 流程中添加
- name: Frontend Type Check
  run: npm run type-check
  
- name: API Contract Test
  run: npm run test:contract
```

## 🚫 禁止的做法

### ❌ 直接在组件中定义类型
```typescript
// 错误: 组件内定义类型
const ConversationDetail = () => {
  interface Message { body: string }  // ❌
}
```

### ❌ 硬编码字段名
```typescript
// 错误: 硬编码访问不存在的字段
message.body              // ❌ 应使用 content_text
message.html_body         // ❌ 应使用 content_html
message.is_read          // ❌ 应使用 status === 'read'
```

### ❌ 方法名不对应API
```typescript
// 错误: 方法名与API不对应
getConversationById()     // ❌ API是 /conversations/:id
sendMessage()            // ❌ API是 /conversations/:id/reply
```

## ✅ 推荐的做法

### ✅ 集中类型管理
```typescript
// src/types/api.ts - 统一类型定义
export interface ConversationMessage {
  content_text?: string;
  content_html?: string;
  status: MessageStatus;
}
```

### ✅ 清晰的API映射
```typescript
class ConversationService {
  // 每个方法都有清晰的API文档
  /**
   * 获取会话列表
   * @api GET /api/conversations
   * @param params 查询参数
   * @returns 会话列表响应
   */
  async getConversations(params?: ConversationListParams) {
    // 实现
  }
}
```

### ✅ 向后兼容策略
```typescript
// 提供别名方法保持向后兼容
async getConversationById(id: string) {
  return this.getConversationDetail(id);
}

// 导出类型别名
export type EmailMessage = ConversationMessage;
```

## 📊 质量检查清单

在提交代码前，请确认：

- [ ] 所有类型定义都在 `types/api.ts` 中
- [ ] Service方法都有对应的API端点注释
- [ ] 字段名与后端模型完全一致
- [ ] 提供了向后兼容的别名方法
- [ ] TypeScript编译无错误
- [ ] 通过了API契约测试

## 🔄 版本控制策略

### 重大变更 (Breaking Changes)
1. 先添加新接口，保留旧接口
2. 标记旧接口为 `@deprecated`
3. 提供迁移指南
4. 下个版本删除旧接口

### 新增功能
1. 直接添加新方法和类型
2. 确保向后兼容
3. 更新文档

## 📚 相关文档
- [API文档](./API-DOCUMENTATION.md)
- [TypeScript规范](./TYPESCRIPT-STANDARDS.md)
- [测试规范](./TESTING-STANDARDS.md)

---

**记住**: 前后端接口契约是团队协作的基础，任何变更都必须经过双方确认！ 