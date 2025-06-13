const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { connectDB } = require('./backend/src/models');
const config = require('./config');

// 导入路由
const authRoutes = require('./backend/src/routes/auth.routes');
const userRoutes = require('./backend/src/routes/user.routes');
const contactRoutes = require('./backend/src/routes/contact.routes');
const tagRoutes = require('./backend/src/routes/tag.routes');
const campaignRoutes = require('./backend/src/routes/campaign.routes');
const taskRoutes = require('./backend/src/routes/task.routes');
const templateRoutes = require('./backend/src/routes/template.routes');
const uploadRoutes = require('./backend/src/routes/upload.routes');
const mailServiceRoutes = require('./backend/src/routes/mailService.routes');
const trackingRoutes = require('./backend/src/routes/tracking.routes');
const webhookRoutes = require('./backend/src/routes/webhook.routes');
const routeRoutes = require('./backend/src/routes/route.routes');
const apiAccountRoutes = require('./backend/src/routes/apiAccount.routes');

// 初始化Express应用
const app = express();

// 异步初始化函数
async function initializeApp() {
  try {
    // 连接数据库
    await connectDB();
    
    // 中间件
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cors(config.cors));
    app.use(morgan('dev'));

    // API路由
    app.use('/api/auth', authRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/contacts', contactRoutes);
    app.use('/api/tags', tagRoutes);
    app.use('/api/campaigns', campaignRoutes);
    app.use('/api/tasks', taskRoutes);
    app.use('/api/templates', templateRoutes);
    app.use('/api/upload', uploadRoutes);
    app.use('/api/mail-services', mailServiceRoutes);
    app.use('/api/tracking', trackingRoutes);
    app.use('/api/webhook', webhookRoutes);
    app.use('/api/routes', routeRoutes);
    app.use('/api/api-accounts', apiAccountRoutes);

    // 健康检查端点
    app.get('/health', (req, res) => {
      res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        database: 'connected',
        routes: 'loaded'
      });
    });

    // 错误处理中间件
    app.use((err, req, res, next) => {
      console.error(err.stack);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        error: config.env === 'development' ? err.message : undefined
      });
    });

    // 启动服务器
    const PORT = config.port;
    const server = app.listen(PORT, () => {
      console.log(`🚀 EDM服务器启动成功！`);
      console.log(`📍 服务器地址: http://localhost:${PORT}`);
      console.log(`🌍 环境: ${config.env}`);
      console.log(`💾 数据库: PostgreSQL`);
    });

    // 处理未捕获的异常
    process.on('uncaughtException', (err) => {
      console.error('未捕获的异常:', err);
      // 防止进程立即终止，允许正常关闭
      server.close(() => {
        process.exit(1);
      });
    });

    // 处理未处理的Promise拒绝
    process.on('unhandledRejection', (err) => {
      console.error('未处理的Promise拒绝:', err);
      // 防止进程立即终止，允许正常关闭
      server.close(() => {
        process.exit(1);
      });
    });

    return server;
  } catch (error) {
    console.error('应用初始化失败:', error);
    process.exit(1);
  }
}

// 启动应用
initializeApp();

module.exports = app; 