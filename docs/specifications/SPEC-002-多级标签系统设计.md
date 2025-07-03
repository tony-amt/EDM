# 多级标签系统设计规范

## 📋 概述

本文档定义了EDM系统中多级标签的完整实现方案，包括数据结构、业务逻辑、API设计和前端交互。

## 🎯 业务需求

### 核心功能
1. **两级标签树**：支持父标签-子标签的两级结构
2. **灵活关联**：联系人可以关联到任意层级的标签
3. **自动继承**：关联子标签时自动关联父标签
4. **随机分组**：支持对标签下联系人进行A/B测试分组
5. **智能查询**：选择父标签时包含所有子标签的联系人

### 业务场景
- **客户分类** → VIP客户、普通客户
- **行业分类** → 互联网、金融、教育
- **地区分类** → 华东、华南、华北
- **A/B测试**：对同一标签下联系人随机分组

## 🏗️ 技术架构

### 数据冗余策略（推荐方案）

**原理**：联系人关联子标签时，同时自动关联父标签
- `contact.tags = ["parent_id", "child_id"]`
- `parent_tag.contacts = ["contact_id"]`  
- `child_tag.contacts = ["contact_id"]`

**优势**：
- 查询性能优异
- 前端逻辑简单
- API响应快速
- 符合V3.0 JSONB设计

## 📊 数据结构

### 标签表 (tags)
```sql
CREATE TABLE tags (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES tags(id),
  contacts JSONB DEFAULT '[]',
  level INTEGER DEFAULT 1, -- 1=父标签, 2=子标签
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### 联系人表 (contacts)
```sql
ALTER TABLE contacts ADD COLUMN tags JSONB DEFAULT '[]';
```

## 🔄 业务逻辑

### 1. 标签关联逻辑

#### 关联子标签
```javascript
// 用户选择子标签时
const childTag = await Tag.findByPk(childTagId);
const parentTag = await Tag.findByPk(childTag.parent_id);

// 同时关联父标签和子标签
contact.tags = [...contact.tags, parentTag.id, childTag.id];
parentTag.contacts = [...parentTag.contacts, contact.id];
childTag.contacts = [...childTag.contacts, contact.id];
```

#### 关联父标签
```javascript
// 用户只选择父标签时
contact.tags = [...contact.tags, parentTag.id];
parentTag.contacts = [...parentTag.contacts, contact.id];
```

### 2. 标签删除逻辑

#### 删除子标签
```javascript
// 1. 从所有联系人中移除该子标签
// 2. 保留父标签关联（如果联系人没有其他子标签）
// 3. 删除子标签记录
```

#### 删除父标签
```javascript
// 1. 检查是否有子标签（有则拒绝删除）
// 2. 从所有联系人中移除该父标签
// 3. 删除父标签记录
```

### 3. 查询逻辑

#### 获取标签下的联系人
```javascript
// 选择父标签：返回所有关联该父标签的联系人（包括通过子标签关联的）
// 选择子标签：返回只关联该子标签的联系人
const contacts = await Contact.findAll({
  where: {
    tags: { [Op.contains]: [tagId] }
  }
});
```

## 🎲 A/B测试分组功能

### 随机分组API
```javascript
POST /api/tags/:tagId/split-test
{
  "groupCount": 2,
  "groupNames": ["A组", "B组"],
  "splitRatio": [0.5, 0.5]
}
```

### 分组逻辑
1. 获取标签下所有联系人
2. 随机打乱顺序
3. 按比例分配到不同组
4. 创建临时分组标签
5. 返回分组结果

## 🔧 API设计

### 标签管理API

#### 创建标签
```http
POST /api/tags
{
  "name": "VIP客户",
  "description": "高价值客户",
  "parentId": "parent-tag-id" // 可选
}
```

#### 获取标签树
```http
GET /api/tags/tree
Response: {
  "data": [
    {
      "id": "parent-id",
      "name": "客户分类",
      "level": 1,
      "contact_count": 100,
      "children": [
        {
          "id": "child-id",
          "name": "VIP客户", 
          "level": 2,
          "contact_count": 30
        }
      ]
    }
  ]
}
```

### 联系人标签API

#### 批量关联标签
```http
POST /api/contacts/bulk-tag
{
  "contactIds": ["contact1", "contact2"],
  "tagIds": ["tag1", "tag2"],
  "autoInherit": true // 自动关联父标签
}
```

#### 获取联系人的标签
```http
GET /api/contacts/:id/tags
Response: {
  "data": {
    "directTags": ["child-tag-id"], // 直接关联的标签
    "inheritedTags": ["parent-tag-id"], // 继承的父标签
    "allTags": ["parent-tag-id", "child-tag-id"] // 所有标签
  }
}
```

### A/B测试API

#### 创建分组测试
```http
POST /api/tags/:tagId/split-test
{
  "testName": "邮件A/B测试",
  "groupCount": 2,
  "splitRatio": [0.6, 0.4]
}
```

## 🎨 前端交互设计

### 标签选择器
- **树形结构**：显示父子关系
- **多选支持**：可选择多个标签
- **智能提示**：选择子标签时提示会自动包含父标签
- **统计显示**：显示每个标签的联系人数量

### 联系人管理
- **标签展示**：区分直接标签和继承标签
- **批量操作**：支持批量添加/移除标签
- **筛选功能**：按标签层级筛选联系人

### A/B测试界面
- **分组配置**：设置分组数量和比例
- **结果预览**：显示分组结果统计
- **导出功能**：导出分组联系人列表

## ✅ 测试用例

### 单元测试
1. **标签CRUD**：创建、读取、更新、删除
2. **层级关系**：父子标签关联
3. **数据一致性**：双向JSONB同步
4. **边界条件**：循环引用、深度限制

### 集成测试
1. **联系人关联**：单个/批量关联标签
2. **自动继承**：子标签自动关联父标签
3. **查询逻辑**：父标签包含子标签联系人
4. **删除级联**：标签删除时的数据清理

### 业务测试
1. **A/B分组**：随机分组功能
2. **邮件任务**：基于标签创建邮件任务
3. **统计报表**：标签使用情况统计
4. **性能测试**：大量数据下的查询性能

## 📈 性能优化

### 数据库优化
- **索引策略**：为tags JSONB字段创建GIN索引
- **查询优化**：使用JSONB操作符提高查询效率
- **缓存策略**：缓存标签树结构

### 前端优化
- **虚拟滚动**：大量标签时的渲染优化
- **懒加载**：按需加载标签数据
- **本地缓存**：缓存标签树结构

## 🔒 数据一致性保证

### 事务处理
- 所有标签关联操作使用数据库事务
- 确保双向JSONB字段同步更新
- 失败时自动回滚

### 数据校验
- 定期检查数据一致性
- 自动修复不一致的数据
- 提供数据修复工具

## 📝 实施计划

### 阶段1：核心功能（1周）
- [ ] 完善标签CRUD API
- [ ] 实现双向JSONB同步
- [ ] 添加层级限制逻辑

### 阶段2：高级功能（1周）
- [ ] A/B测试分组功能
- [ ] 批量操作API
- [ ] 数据一致性检查

### 阶段3：前端实现（1周）
- [ ] 标签树组件
- [ ] 联系人标签管理
- [ ] A/B测试界面

### 阶段4：测试优化（3天）
- [ ] 完整测试用例
- [ ] 性能优化
- [ ] 文档完善

---

**版本**: v1.0  
**创建时间**: 2025-01-13  
**最后更新**: 2025-01-13  
**负责人**: AI Assistant 