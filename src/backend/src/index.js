const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const db = require('./models/index'); // 修复模型导入路径
const config = require('./config');
const logger = require('./utils/logger');
const http = require('http'); // 引入 http 模块

// 导入路由
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const contactRoutes = require('./routes/contact.routes');
const tagRoutes = require('./routes/tag.routes');
const templateRoutes = require('./routes/template.routes');
const taskRoutes = require('./routes/task.routes');
// const routeRoutes = require('./routes/route.routes'); // V2.0已删除，使用EmailRoutingService
const apiAccountRoutes = require('./routes/apiAccount.routes');
const webhookRoutes = require('./routes/webhook.routes');
// const campaignRoutes = require('./routes/campaign.routes'); // V2.0暂不实现Campaign
const trackingRoutes = require('./routes/tracking.routes');
// // const emailReplyRoutes = require('./routes/emailReply.routes'); // 暂时注释，修复依赖问题 // 暂时注释，修复依赖问题
// mailServiceRoutes已删除，使用emailService路由
const uploadRoutes = require('./routes/upload.routes'); // 添加上传路由

// 初始化Express应用
const app = express();

// 确保日志目录存在
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 确保临时文件上传目录存在
const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
  logger.info(`Created temp directory at: ${tempDir}`); // 可选：添加日志记录
}

// 确保上传目录存在
const uploadsDir = path.join(__dirname, '../public/uploads/images');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  logger.info(`创建上传图片目录: ${uploadsDir}`);
}

// 中间件配置
app.use(helmet({
  contentSecurityPolicy: false // 禁用CSP以允许加载前端资源
})); // 安全头

// 临时CORS配置修复
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3000', 'http://127.0.0.1:3001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
})); // CORS配置

app.use(express.json({ limit: '10mb' })); // JSON解析
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // URL编码解析
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } })); // HTTP请求日志

// 静态文件服务
// 首先尝试从frontend/build目录提供静态文件（如果存在）
const frontendBuildPath = path.join(__dirname, '../../frontend/build');
if (fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath));
  logger.info(`提供前端静态文件从: ${frontendBuildPath}`);
}

// 提供上传的图片和其他静态文件
app.use(express.static(path.join(__dirname, '../public')));

// 🔧 EngageLab Webhook路由 (根路径，匹配tkmail.fun/webhook/engagelab)
const webhookController = require('./controllers/webhook.controller');
app.post('/webhook/engagelab', (req, res, next) => webhookController.handleMailEvent(req, res, next));

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/tasks', taskRoutes);
// app.use('/api/routes', routeRoutes); // V2.0已删除，使用EmailRoutingService
app.use('/api/api-accounts', apiAccountRoutes);
app.use('/api/webhook', webhookRoutes);
// app.use('/api/campaigns', campaignRoutes); // V2.0暂不实现Campaign
app.use('/api/tracking', trackingRoutes);
// app.use('/api/email-reply', emailReplyRoutes); // 暂时注释，修复依赖问题
// 已使用email-services路由替代
app.use('/api/upload', uploadRoutes); // 添加上传路由

// V2.0: 系统配置管理路由
try {
  const systemConfigRoutes = require('./routes/systemConfig.routes');
  app.use('/api/system-config', systemConfigRoutes);
  console.log('✅ V2.0功能：系统配置管理路由已注册');
} catch (error) {
  console.warn('⚠️ V2.0功能：系统配置管理路由注册失败:', error.message);
}

// V2.0: Webhook和追踪增强路由
try {
  const webhookEnhancedRoutes = require('./routes/webhooks.routes');
  app.use('/api/webhooks', webhookEnhancedRoutes);
  console.log('✅ V2.0功能：增强Webhook路由已注册');
} catch (error) {
  console.warn('⚠️ V2.0功能：增强Webhook路由注册失败:', error.message);
}

// V2.0: 邮件会话管理路由
try {
  const emailConversationRoutes = require('./routes/emailConversation.routes');
  app.use('/api/conversations', emailConversationRoutes);
  console.log('✅ V2.0功能：邮件会话管理路由已注册');
} catch (error) {
  console.warn('⚠️ V2.0功能：邮件会话管理路由注册失败:', error.message);
}

// 仪表盘路由
try {
  const dashboardRoutes = require('./routes/dashboard.routes');
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api', dashboardRoutes); // 支持 /api/users-v2/dashboard 路径
  console.log('✅ 仪表盘路由已注册');
} catch (error) {
  console.warn('⚠️ 仪表盘路由注册失败:', error.message);
}

// 🔧 【V2.0新增功能】注册新增功能路由
// V2.0发信服务管理
try {
  const emailServiceRoutes = require('./routes/emailService.routes');
  app.use('/api/email-services', emailServiceRoutes);
  console.log('✅ V2.0功能：发信服务管理路由已注册');
} catch (error) {
  console.warn('⚠️ V2.0功能：发信服务管理路由注册失败:', error.message);
}

// V2.0用户服务映射管理  
try {
  const userServiceMappingRoutes = require('./routes/userServiceMapping.routes');
  app.use('/api/user-service-mappings', userServiceMappingRoutes);
  console.log('✅ V2.0功能：用户服务关联管理路由已注册');
} catch (error) {
  console.warn('⚠️ V2.0功能：用户服务关联管理路由注册失败:', error.message);
}

// V2.0额度管理
try {
  const quotaRoutes = require('./routes/quota.routes');
  app.use('/api/quota', quotaRoutes);
  console.log('✅ V2.0功能：额度管理路由已注册');
} catch (error) {
  console.warn('⚠️ V2.0功能：额度管理路由注册失败:', error.message);
}

// 注意：以下V2.0路由需要重新实现或确认是否需要

try {
  const senderRoutes = require('./routes/sender.routes');
  app.use('/api/senders', senderRoutes);
  console.log('✅ V2.0功能：发信人管理路由已注册');
} catch (error) {
  console.warn('⚠️ V2.0功能：发信人管理路由注册失败:', error.message);
}

try {
  const subtaskRoutes = require('./routes/subtask.routes');
  app.use('/api/subtasks', subtaskRoutes);
  console.log('✅ V2.0功能：SubTask管理路由已注册');
} catch (error) {
  console.warn('⚠️ V2.0功能：SubTask管理路由注册失败:', error.message);
}

// V2.0功能：任务调度器路由
try {
  const schedulerRoutes = require('./routes/scheduler.routes');
  app.use('/api/scheduler', schedulerRoutes);
  console.log('✅ V2.0功能：任务调度器路由已注册');
} catch (error) {
  console.warn('⚠️ V2.0功能：任务调度器路由注册失败:', error.message);
}

// V2.0功能：监控系统路由
try {
  const monitoringRoutes = require('./routes/monitoring.routes');
  app.use('/api/monitoring', monitoringRoutes);
  console.log('✅ V2.0功能：监控系统路由已注册');
} catch (error) {
  console.warn('⚠️ V2.0功能：监控系统路由注册失败:', error.message);
}

// Phase 3功能：标签系统JSONB优化测试路由
try {
  const phase3TestRoutes = require('./routes/phase3Test.routes');
  app.use('/api/test/phase3', phase3TestRoutes);
  console.log('✅ Phase 3功能：标签系统优化测试路由已注册');
} catch (error) {
  console.warn('⚠️ Phase 3功能：标签系统优化测试路由注册失败:', error.message);
}

// Phase 4.1功能：队列调度系统V2路由
try {
  const queueV2Routes = require('./routes/queueV2.routes');
  app.use('/api/queue-v2', queueV2Routes);
  console.log('✅ Phase 4.1功能：队列调度系统V2路由已注册');
} catch (error) {
  console.warn('⚠️ Phase 4.1功能：队列调度系统V2路由注册失败:', error.message);
}

// Phase 4.2功能：故障恢复系统路由
try {
  const failureRecoveryRoutes = require('./routes/failureRecovery.routes');
  app.use('/api/failure-recovery', failureRecoveryRoutes);
  console.log('✅ Phase 4.2功能：故障恢复系统路由已注册');
} catch (error) {
  console.warn('⚠️ Phase 4.2功能：故障恢复系统路由注册失败:', error.message);
}

// Phase 4功能：两阶段队列系统测试路由
try {
  const phase4TestRoutes = require('./routes/phase4Test.routes');
  app.use('/api/test/phase4', phase4TestRoutes);
  console.log('✅ Phase 4功能：两阶段队列系统测试路由已注册');
} catch (error) {
  console.warn('⚠️ Phase 4功能：两阶段队列系统测试路由注册失败:', error.message);
}

// Phase 3功能：标签系统优化路由
try {
  const tagOptimizationRoutes = require('./routes/tagOptimization.routes');
  app.use('/api/tag-optimization', tagOptimizationRoutes);
  console.log('✅ Phase 3功能：标签系统优化路由已注册');
} catch (error) {
  console.warn('⚠️ Phase 3功能：标签系统优化路由注册失败:', error.message);
}

// 健康检查
app.get('/health', async (req, res) => {
  try {
    // 检查数据库连接状态
    const dbHealth = await db.checkHealth();

    const healthStatus = {
      status: dbHealth.status === 'healthy' ? 'ok' : 'error',
      service: 'amt-mail-system',
      database: dbHealth.status,
      database_message: dbHealth.message,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: config.server.env
    };

    // 如果数据库不健康，返回服务降级状态
    if (dbHealth.status !== 'healthy') {
      logger.warn('健康检查: 数据库连接不健康', dbHealth);
      return res.status(503).json(healthStatus);
    }

    res.status(200).json(healthStatus);
  } catch (err) {
    logger.error('健康检查失败:', err);
    res.status(503).json({
      status: 'error',
      service: 'amt-mail-system',
      database: 'error',
      error: '健康检查执行失败',
      timestamp: new Date().toISOString()
    });
  }
});

// 所有其他GET请求都返回前端应用（支持SPA路由）
// 但排除API路由，避免拦截API请求
app.get('*', (req, res, next) => {
  // 如果是API请求，跳过前端路由处理
  if (req.path.startsWith('/api/')) {
    return next();
  }

  // 首先尝试从frontend/build目录提供index.html
  const frontendIndexPath = path.join(frontendBuildPath, 'index.html');
  if (fs.existsSync(frontendIndexPath)) {
    return res.sendFile(frontendIndexPath);
  }

  // 如果没有前端构建，则提供简单的API信息页面
  res.send(`
    <html>
      <head>
        <title>AMT Mail System API</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #333; }
          .endpoint { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }
          code { background: #eee; padding: 2px 5px; border-radius: 3px; }
        </style>
      </head>
      <body>
        <h1>AMT Mail System API</h1>
        <p>API服务器已成功运行。要访问前端界面，请确保前端已构建并放置在正确的位置。</p>
        <h2>API端点</h2>
        <div class="endpoint"><code>GET /api/auth/me</code> - 获取当前用户信息</div>
        <div class="endpoint"><code>POST /api/auth/login</code> - 用户登录</div>
        <div class="endpoint"><code>GET /health</code> - 健康检查</div>
        <p>其他端点请参考API文档。</p>
      </body>
    </html>
  `);
});

// 错误处理中间件
app.use((err, req, res, next) => {
  logger.error(`错误: ${err.message}`);
  logger.error(err.stack);

  const statusCode = (typeof err.status === 'number' && err.status >= 100 && err.status < 600) ? err.status : 500;

  res.status(statusCode).json({
    error: {
      message: err.message || '服务器内部错误',
    },
  });
});

// 调试日志: Express app instance is configured

// 启动服务器
const startServer = async () => {
  try {
    await db.sequelize.authenticate();
    logger.info('数据库连接成功');

    // 数据库同步策略优化 - 保留现有数据
    if (config.server.env === 'development') {
      logger.info('开发环境：检查数据库结构...');

      // 默认使用alter模式，保留现有数据，不使用强制重建
      // await db.sequelize.sync({ alter: true });
      logger.info('数据库结构检查跳过（手动管理）');

      // 检查是否有管理员账户，没有则创建
      await ensureAdminExists();
    } else {
      // 生产环境：首次部署时创建表结构，后续使用alter模式
      logger.info('生产环境：检查并创建数据库结构...');
      // await db.sequelize.sync({ alter: true });
      logger.info('生产环境：数据库结构跳过（手动管理）');

      // 确保管理员账户存在
      await ensureAdminExists();
    }

    const PORT = config.server.port;
    return new Promise((resolve, reject) => {
      const server = http.createServer(app);
      server.listen(PORT, () => {
        logger.info(`服务器运行在端口 ${PORT}, 环境: ${config.server.env}`);

        // 🔧 修复：启动队列调度器（单例模式）
        startTaskScheduler();

        resolve(server);
      });
      server.on('error', (error) => {
        logger.error('服务器启动时发生错误:', error);
        reject(error);
      });
    });
  } catch (error) {
    logger.error('启动服务器预检失败:', error);
    return Promise.reject(error);
  }
};

// 🔧 修复：启动队列调度器（单例模式）
function startTaskScheduler() {
  try {
    // 🚨 临时禁用旧的QueueScheduler，因为它使用了已删除的is_frozen字段
    // Phase 4.1: 现在使用QueueSchedulerV2，通过API手动启动
    logger.info('✅ 旧版队列调度器已禁用，使用QueueSchedulerV2 (通过API启动)');
    return;

    /* 旧版QueueScheduler代码已注释
    // 🔧 修复：使用生产环境实际的文件路径
    const QueueScheduler = require('./services/infrastructure/QueueScheduler');

    // 🔧 修复：检查是否已有实例在运行
    let queueScheduler;
    if (global.queueSchedulerInstance) {
      queueScheduler = global.queueSchedulerInstance;
      logger.info('✅ 使用现有的队列调度器实例');
    } else {
      queueScheduler = new QueueScheduler();
      global.queueSchedulerInstance = queueScheduler;
      logger.info('✅ 创建新的队列调度器实例');
    }

    // 检查是否已经启动
    if (queueScheduler.getStatus && queueScheduler.getStatus().isRunning) {
      logger.info('✅ 队列调度器已在运行中，跳过重复启动');
      return;
    }

    // 启动队列调度器
    queueScheduler.start().then(() => {
      logger.info('✅ 队列调度器已启动');
    }).catch(error => {
      logger.error('❌ 队列调度器启动失败:', error);
    });
    */

  } catch (error) {
    logger.error('❌ 队列调度器初始化失败:', error);
  }
}

// 创建默认管理员账户
async function createDefaultAdmin() {
  try {
    const { User } = db;
    const adminExists = await User.findOne({ where: { role: 'admin' } });

    if (!adminExists) {
      // 直接传递明文密码，让模型的hook处理哈希
      await User.create({
        username: 'admin',
        email: 'admin@example.com',
        password_hash: 'admin123456', // 明文密码，模型hook会自动哈希
        role: 'admin'
      });

      logger.info('默认管理员账户已创建: admin/admin123456');
    } else {
      logger.info('管理员账户已存在，跳过创建');
    }
  } catch (error) {
    logger.error('创建管理员账户失败:', error);
  }
}

// 确保管理员账户存在
async function ensureAdminExists() {
  try {
    const { User } = db;
    const adminExists = await User.findOne({ where: { role: 'admin' } });

    if (!adminExists) {
      logger.info('未发现管理员账户，正在创建...');
      await createDefaultAdmin();
    } else {
      logger.info('管理员账户已存在');
    }
  } catch (error) {
    logger.error('检查管理员账户失败:', error);
  }
}

// 关闭服务器
const closeServer = (serverInstance) => {
  return new Promise((resolve, reject) => {
    if (serverInstance) {
      serverInstance.close((err) => {
        if (err) {
          logger.error('关闭服务器时出错:', err);
          return reject(err);
        }
        logger.info('服务器已成功关闭。');
        resolve();
      });
    } else {
      resolve(); // 如果没有服务器实例，直接 resolve
    }
  });
};

// 只在非测试环境中自动启动服务器
if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'ci_test') { // 增加一个 ci_test 环境判断
  startServer().catch(err => {
    logger.error('自动启动服务器失败:', err);
    process.exit(1);
  });
} else {
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  logger.error(`未捕获的异常: ${error.message}`);
  logger.error(error.stack);
});

// 处理未处理的Promise拒绝
process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的Promise拒绝:', reason);
});

// 为测试环境提供标准的app实例导出
if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'ci_test') {
  // 测试环境需要能够直接访问app实例
}

module.exports = { app, startServer, closeServer }; // 导出 app, startServer 和 closeServer 