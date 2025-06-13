# EDM系统 - 前端应用

## ⚠️ 重要提醒

**请使用项目根目录的统一启动方式，不要在此目录单独启动前端服务！**

所有开发和部署都必须通过Docker Compose进行：

```bash
# 回到项目根目录
cd ../../

# 使用统一启动脚本
./start-edm-system.sh
```

## 🏗️ 技术栈

- React 18
- TypeScript
- Ant Design 5
- Redux Toolkit
- React Router Dom

## 📁 目录结构

```
src/frontend/
  ├── src/
  │   ├── components/     # 公共组件
  │   ├── pages/          # 页面组件
  │   ├── services/       # API服务
  │   ├── store/          # Redux状态管理
  │   ├── utils/          # 工具函数
  │   └── App.tsx         # 主应用组件
  ├── public/             # 静态资源
  ├── Dockerfile          # Docker配置
  └── package.json        # 依赖配置
```

## 🎨 功能模块

### 用户认证
- 用户登录
- JWT认证
- 权限控制

### 联系人管理
- 联系人列表/搜索/筛选
- 联系人创建/编辑/删除
- 联系人详情查看
- 批量操作

### 标签管理
- 标签创建/编辑/删除
- 标签关联联系人
- 标签筛选

### 模板管理
- 邮件模板创建/编辑
- 富文本编辑器
- 模板预览

### 任务管理
- 任务创建/调度
- 发送状态监控
- 统计报告

## 🧪 开发调试

如需查看前端日志：

```bash
# 在项目根目录执行
docker-compose logs -f frontend
```

如需进入前端容器调试：

```bash
# 在项目根目录执行
docker-compose exec frontend sh
```

## 🌐 访问地址

- **前端界面**: http://localhost:3001
- **API接口**: http://localhost:3000/api

## 📋 注意事项

- 前端通过REACT_APP_API_BASE_URL连接后端API
- 所有环境变量在 `docker-compose.yml` 中统一管理
- 不要在此目录单独安装依赖或启动服务
- 界面使用Ant Design组件库，保持设计一致性

---

**请遵循项目统一规范，使用Docker方式开发和部署！** 