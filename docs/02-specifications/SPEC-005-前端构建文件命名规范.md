# SPEC-005 前端构建文件命名规范

## 📋 概述

本文档规定了EDM系统前端构建文件的命名规范，确保文件版本管理的一致性和可维护性。

## 🏗️ 当前构建配置

### Webpack配置
- 使用 `react-scripts` 默认配置
- 生产环境文件命名规则：`[name].[contenthash:8].[ext]`
- 开发环境文件命名规则：`bundle.js`

### 文件类型命名规范

| 文件类型 | 命名规则 | 示例 | 说明 |
|---------|---------|------|------|
| 主JS文件 | `main.[contenthash:8].js` | `main.49954b55.js` | 应用主入口文件 |
| 代码分割文件 | `[name].[contenthash:8].chunk.js` | `vendors.a1b2c3d4.chunk.js` | 异步加载的代码块 |
| CSS文件 | `main.[contenthash:8].css` | `main.f8e7d6c5.css` | 样式文件 |
| 静态资源 | `[name].[hash].[ext]` | `logo.b4a3c2d1.png` | 图片、字体等资源 |
| Source Map | `[filename].map` | `main.49954b55.js.map` | 调试映射文件 |

## 🔍 哈希值说明

### contenthash（内容哈希）
- **生成规则**：基于文件内容的MD5哈希值前8位
- **变更触发**：只有文件内容改变时才会变更
- **缓存优势**：未变更的文件保持相同哈希，利用浏览器缓存

### 哈希值示例分析
```bash
# 当前构建文件
main.49954b55.js          # 8位内容哈希
main.49954b55.js.map      # 对应的source map

# 代码更新后可能变为
main.a1b2c3d4.js          # 新的8位内容哈希
main.a1b2c3d4.js.map      # 对应的source map
```

## 📁 文件结构规范

### 构建输出目录结构
```
build/
├── static/
│   ├── css/
│   │   ├── main.[contenthash:8].css
│   │   └── main.[contenthash:8].css.map
│   ├── js/
│   │   ├── main.[contenthash:8].js
│   │   ├── main.[contenthash:8].js.map
│   │   └── [chunk].[contenthash:8].chunk.js
│   └── media/
│       └── [name].[hash].[ext]
├── index.html
└── manifest.json
```

## 🔄 版本管理策略

### 自动版本控制
1. **构建时自动生成**：每次 `npm run build` 自动生成新哈希
2. **内容驱动更新**：只有代码变更才会产生新文件名
3. **缓存友好**：未变更文件保持原有文件名和缓存

### 部署文件跟踪
```bash
# 部署前记录当前文件
ls -la build/static/js/main.*.js

# 部署后验证
curl -I https://tkmail.fun/static/js/main.[hash].js
```

## 🛠️ 维护建议

### 构建文件清理
```bash
# 清理旧的构建文件
rm -rf src/frontend/build/

# 重新构建
cd src/frontend && npm run build
```

### 文件名变更检查
```bash
# 检查构建前后文件名变化
diff <(ls build/static/js/) <(ls build.old/static/js/)
```

## 🚨 注意事项

### 不要手动修改文件名
- ❌ 不要手动重命名构建文件
- ❌ 不要删除哈希值
- ✅ 依赖webpack自动生成

### 部署验证清单
- [ ] 检查新文件是否正确生成
- [ ] 验证index.html中的文件引用是否更新
- [ ] 确认服务器上的旧文件可以安全删除
- [ ] 测试页面是否正常加载

## 📊 文件大小监控

### 建议文件大小范围
- 主JS文件：< 2MB（当前：2.3MB，需要优化）
- CSS文件：< 500KB
- 代码分割块：< 1MB

### 优化建议
1. **代码分割**：使用React.lazy()进行路由级别分割
2. **依赖分析**：使用webpack-bundle-analyzer分析包大小
3. **Tree Shaking**：移除未使用的代码

## 🔗 相关文档
- [SPEC-001 配置管理规范](./SPEC-001-配置管理规范.md)
- [部署指南](../standards/deployment/deployment-guide.md)

---
**文档版本**：v1.0  
**创建日期**：2025-01-13  
**最后更新**：2025-01-13 